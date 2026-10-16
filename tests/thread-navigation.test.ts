import { afterEach, expect, test, vi } from "vitest";
import { rememberSignInThread, takeSignInThread } from "../src/lib/thread-navigation";

afterEach(() => vi.unstubAllGlobals());

function storage() {
  const values = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  return values;
}

test("OAuth thread return is consumed once and rejects URLs or malformed identifiers", () => {
  const values = storage();
  const id = "33333333-3333-4333-8333-333333333333";
  rememberSignInThread(id);
  expect(takeSignInThread()).toBe(id);
  expect(takeSignInThread()).toBeNull();
  for (const unsafe of ["https://example.test", "//example.test", "/dashboard/" + id, id + "?next=evil", "../auth"]) {
    rememberSignInThread(unsafe);
    expect(takeSignInThread()).toBeNull();
    values.set("nuelexity:sign-in-thread", unsafe);
    expect(takeSignInThread()).toBeNull();
    expect(values.size).toBe(0);
  }
});

test("an unrelated or cancelled sign-in clears a pending thread return", () => {
  storage();
  rememberSignInThread("33333333-3333-4333-8333-333333333333");
  rememberSignInThread(null);
  expect(takeSignInThread()).toBeNull();
});

test("blocked tab storage does not prevent sign-in", () => {
  vi.stubGlobal("sessionStorage", {
    getItem: () => { throw new Error("Blocked"); },
    setItem: () => { throw new Error("Blocked"); },
    removeItem: () => { throw new Error("Blocked"); },
  });
  expect(() => rememberSignInThread("33333333-3333-4333-8333-333333333333")).not.toThrow();
  expect(takeSignInThread()).toBeNull();
});
