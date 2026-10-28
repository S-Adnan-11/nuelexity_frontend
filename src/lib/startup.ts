export type StartupState = "starting" | "ready" | "configuration" | "unavailable" | "unreachable";
export class StartupError extends Error {
  constructor(public state: StartupState, message: string) { super(message); }
}
type Probe = (path: string, signal: AbortSignal) => Promise<Response>;
type Wake = (signal: AbortSignal) => Promise<Response>;

export function withAbort<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
const pause = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  signal.throwIfAborted();
  const abort = () => { clearTimeout(timer); reject(signal.reason); };
  const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
  signal.addEventListener("abort", abort, { once: true });
});

// One workspace operation. Reuse an existing safe GET as the wake request;
// never pass a mutation, challenge exchange or search into this retry loop.
export class BackendStartup {
  state: StartupState = "starting";
  private listeners = new Set<() => void>();
  private pending?: Promise<void>;
  private controller?: AbortController;
  private failure?: StartupError;
  constructor(private probe: Probe, private totalMs = 120000, private attemptMs = 8000, private backoffMs = 1000) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private update(state: StartupState) { this.state = state; this.listeners.forEach(listener => listener()); }
  reset() {
    this.stop(); this.failure = undefined; this.pending = undefined; this.update("starting");
  }
  stop() { this.controller?.abort(); }
  ensure(wake?: Wake): Promise<void> {
    if (this.pending) return this.pending;
    if (this.state === "ready") return Promise.resolve();
    if (this.failure) return Promise.reject(this.failure);
    const controller = new AbortController(); this.controller = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(this.totalMs)]);
    this.update("starting");
    let alive = false, delay = this.backoffMs;
    const attempt = async (run: Wake) => {
      const response = await run(AbortSignal.any([signal, AbortSignal.timeout(this.attemptMs)]));
      if (!response.headers.get("Content-Type")?.includes("application/json")) throw new Error("Platform startup response");
      const body = await response.clone().json();
      if (body?.error && ["NOT_CONFIGURED", "GUESTS_UNAVAILABLE", "CLIENT_IP_UNAVAILABLE"].includes(body.error.code))
        throw new StartupError("configuration", "The service needs configuration from its owner.");
      return { response, body };
    };
    const work = Promise.resolve().then(async () => {
      while (true) {
        signal.throwIfAborted();
        try {
          if (!alive) {
            await attempt(wake || (s => this.probe("/health", s)));
            alive = true;
          }
          const { response, body } = await attempt(s => this.probe("/ready", s));
          if (response.ok && body?.status === "ready") { this.update("ready"); return; }
          if (![429, 502, 503, 504].includes(response.status))
            throw new StartupError("configuration", "The service returned an unexpected readiness response.");
        } catch (error) {
          if (error instanceof StartupError) throw error;
          signal.throwIfAborted();
        }
        await pause(delay, signal);
        delay = Math.min(delay * 2, 8000);
      }
    }).catch(error => {
      if (controller.signal.aborted) throw error;
      const failure = error instanceof StartupError ? error : new StartupError(alive ? "unavailable" : "unreachable",
        alive ? "The service is running but could not become ready. Try again later."
          : "The service could not be reached in time. It may be starting, suspended or offline.");
      this.failure = failure; this.update(failure.state); throw failure;
    }).finally(() => { if (this.pending === work) this.pending = undefined; });
    this.pending = work;
    return work;
  }
}
