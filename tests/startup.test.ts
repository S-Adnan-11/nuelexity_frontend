import { afterEach, expect, test, vi } from "vitest";
import { BackendStartup, withAbort } from "../src/lib/startup";

afterEach(() => vi.useRealTimers());
test.each(["guest", "returning guest", "signed in"])("%s reuses one existing early read and shares readiness", async () => {
  const probe = vi.fn(async (_path: string, _signal: AbortSignal) => Response.json({ status: "ready" }));
  const startup = new BackendStartup(probe);
  const wake = vi.fn(async () => Response.json({ verified: true }));
  const first = startup.ensure(wake);
  expect(startup.ensure()).toBe(first);
  await first;
  await startup.ensure();
  expect(wake).toHaveBeenCalledTimes(1);
  expect(probe.mock.calls.map(call => call[0])).toEqual(["/ready"]);
  expect(startup.state).toBe("ready");
});
test("slow startup tolerates platform HTML, network failure and transient readiness, then stops", async () => {
  vi.useFakeTimers();
  let wakeCalls = 0, readyCalls = 0;
  const startup = new BackendStartup(async () => ++readyCalls === 1 ? Response.json({}, { status: 503 }) : Response.json({ status: "ready" }), 10000, 100, 10);
  const work = startup.ensure(async () => {
    wakeCalls++;
    if (wakeCalls === 1) return new Response("<html>Starting</html>");
    if (wakeCalls === 2) throw new TypeError("Network unavailable");
    return Response.json({});
  });
  await vi.advanceTimersByTimeAsync(1000); await work;
  expect(wakeCalls).toBe(3); expect(readyCalls).toBe(2);
  await vi.advanceTimersByTimeAsync(60000);
  expect(readyCalls).toBe(2); expect(vi.getTimerCount()).toBe(0);
});
test("missing config is terminal; the same operation never keeps polling or restarts itself", async () => {
  const probe = vi.fn(async () => Response.json({ error: { code: "NOT_CONFIGURED" } }, { status: 503 }));
  const startup = new BackendStartup(probe);
  await expect(startup.ensure()).rejects.toMatchObject({ state: "configuration" });
  await expect(startup.ensure()).rejects.toMatchObject({ state: "configuration" });
  expect(probe).toHaveBeenCalledTimes(1);
});
test("startup timeout distinguishes unreachable platform from failed application readiness", async () => {
  // AbortSignal.timeout uses the runtime clock, so these short deadlines use real timers.
  for (const running of [false, true]) {
    const startup = new BackendStartup(async path => path === "/health" && running ? Response.json({ status: "ok" }) : new Response("unavailable", { status: 503 }), 25, 10, 5);
    await expect(startup.ensure()).rejects.toMatchObject({ state: running ? "unavailable" : "unreachable" });
  }
});
test("cancelling a waiter cannot continue a stale submission; stopping the workspace aborts the loop", async () => {
  const startup = new BackendStartup(async (_path, signal) => {
    await withAbort(new Promise(() => {}), signal);
    return Response.json({});
  });
  const waiter = new AbortController();
  let submits = 0;
  const wait = withAbort(startup.ensure(), waiter.signal).then(() => { submits++; });
  waiter.abort(new Error("navigation"));
  await expect(wait).rejects.toThrow("navigation");
  const shared = startup.ensure(); startup.stop();
  await expect(shared).rejects.toThrow();
  expect(submits).toBe(0);
});
