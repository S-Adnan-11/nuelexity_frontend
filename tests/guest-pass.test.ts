import { afterEach, expect, test } from "bun:test";
import { createGuestPassStorage, guestPassStore } from "../src/lib/guest-pass";
import { getGuestSession, search, verifyGuestChallenge } from "../src/lib/api";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  guestPassStore.clear();
});

test("guest proof survives a refreshed storage wrapper and is cleared explicitly", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  createGuestPassStorage(() => storage).save("v1.test-only.signature");
  const refreshed = createGuestPassStorage(() => storage);
  expect(refreshed.read()).toBe("v1.test-only.signature");
  refreshed.clear();
  expect(refreshed.read()).toBe("");
});
test("blocked browser storage retains clearance in memory for the current page", () => {
  const store = createGuestPassStorage(() => {
    throw new Error("Storage blocked");
  });
  store.save("v1.test-only.signature");
  expect(store.read()).toBe("v1.test-only.signature");
  store.clear();
  expect(store.read()).toBe("");
});
test("expired or rejected server clearance is discarded on refresh", async () => {
  guestPassStore.save("v1.old.signature");
  globalThis.fetch = (async (_input, options) => {
    expect(new Headers(options?.headers).get("X-Guest-Pass")).toBe("v1.old.signature");
    return Response.json({ verified: false, verificationRequired: true, expiresAt: null });
  }) as typeof fetch;
  expect((await getGuestSession()).verified).toBe(false);
  expect(guestPassStore.read()).toBe("");
});
test("a single-use challenge becomes a session proof sent only on guest searches", async () => {
  let step = 0;
  globalThis.fetch = (async (_input, options) => {
    step++;
    const headers = new Headers(options?.headers);
    if (step === 1) {
      expect(JSON.parse(options?.body as string)).toEqual({
        turnstileToken: "challenge-test-only",
      });
      expect(headers.has("X-Guest-Pass")).toBe(false);
      return Response.json({ pass: "v1.test-only.signature", expiresAt: Date.now() + 60000 });
    }
    expect(headers.get("X-Guest-Pass")).toBe(step === 2 ? "v1.test-only.signature" : null);
    expect(headers.get("Authorization")).toBe(step === 3 ? "Bearer account-test-only" : null);
    expect(JSON.parse(options?.body as string)).not.toHaveProperty("turnstileToken");
    return new Response('event: done\ndata: {"conversationId":null}\n\n', {
      headers: { "Content-Type": "text/event-stream" },
    });
  }) as typeof fetch;
  await verifyGuestChallenge("challenge-test-only", new AbortController().signal);
  await search({ query: "guest" }, undefined, new AbortController().signal, () => {});
  await search({ query: "account" }, "account-test-only", new AbortController().signal, () => {});
  expect(step).toBe(3);
});
