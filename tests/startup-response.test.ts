import { expect, test } from "vitest";
import { serveFixture } from "../scripts/http-fixture";
import { backendStartup, getGuestSession, getModels } from "../src/lib/api";

test.each(["guest", "models"])("%s wake body survives its deadline while shared readiness is delayed", async first => {
  const originalFetch = globalThis.fetch, originalTimeout = AbortSignal.timeout;
  const reads: string[] = []; let readiness = 0;
  const server = await serveFixture(async req => {
    const path = new URL(req.url).pathname; reads.push(path);
    if (path === "/ready") return Response.json(++readiness === 1 ? {} : { status: "ready" }, { status: readiness === 1 ? 503 : 200 });
    return Response.json(path === "/models" ? { defaultModelId: "fixture", canSelect: false, answerMode: "sources-only", models: [] }
      : { verified: false, verificationRequired: true, expiresAt: null });
  });
  // Real fetch bodies remain linked to their request's signal even after headers
  // arrive. The old retained response failed when readiness outlived that signal.
  globalThis.fetch = (input, options) => originalFetch(new URL(new URL(String(input)).pathname, server.url), options);
  AbortSignal.timeout = ms => originalTimeout(ms === 8000 ? 80 : ms);
  backendStartup.reset();
  try {
    const guest = first === "guest" ? getGuestSession() : undefined;
    const models = getModels();
    expect((await (guest ?? getGuestSession())).verificationRequired).toBe(true);
    expect((await models).answerMode).toBe("sources-only");
    expect(reads.filter(p => p === "/ready")).toHaveLength(2);
    expect(reads.filter(p => p === "/guest/session")).toHaveLength(1);
    expect(reads.filter(p => p === "/models")).toHaveLength(1);
    expect(reads).not.toContain("/health");
  } finally {
    backendStartup.stop(); backendStartup.reset();
    globalThis.fetch = originalFetch; AbortSignal.timeout = originalTimeout; server.stop();
  }
});
