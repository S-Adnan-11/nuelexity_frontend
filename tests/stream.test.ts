import { expect, test } from "bun:test";
import { readSearchEvents } from "../src/lib/stream";
import { publicEnv } from "../public-env";
import { safeSourceUrl } from "../src/components/Answer";

function stream(text: string, size = 1) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size));
      controller.close();
    },
  });
}
async function collect(text: string) {
  const events = [];
  for await (const event of readSearchEvents(stream(text))) events.push(event);
  return events;
}
test("handles fragmented UTF-8, CRLF, heartbeats and all answer chunks", async () => {
  const events = await collect(
    ': keep-alive\r\n\r\nevent: delta\r\ndata: {"text":"Cook sha 😹"}\r\n\r\nevent: delta\ndata: {"text":" [1]"}\n\nevent: done\ndata: {"conversationId":null}\n\n',
  );
  expect(events).toEqual([
    { event: "delta", data: { text: "Cook sha 😹" } },
    { event: "delta", data: { text: " [1]" } },
    { event: "done", data: { conversationId: null } },
  ]);
});
test("an interrupted stream never reports success", async () => {
  await expect(collect('event: delta\ndata: {"text":"Partial"}\n\n')).rejects.toThrow(
    "before the answer finished",
  );
  await expect(collect('event: done\ndata: {"conversationId":null}')).rejects.toThrow();
});
test("error events are terminal and do not accept a later done", async () => {
  const events = await collect(
    'event: error\ndata: {"code":"TIMEOUT","message":"Too slow"}\n\nevent: done\ndata: {}\n\n',
  );
  expect(events).toHaveLength(1);
  expect(events[0]?.event).toBe("error");
});
test("rejects malformed and oversized events", async () => {
  await expect(collect('event: delta\ndata: {"text":123}\n\n')).rejects.toThrow("Invalid answer");
  await expect(collect('event: follow_ups\ndata: {"questions":[1]}\n\n')).rejects.toThrow();
  await expect(collect(`event: delta\ndata: ${"x".repeat(70000)}`)).rejects.toThrow("oversized");
});
test("public environment whitelist never includes secret values and supports old local names", () => {
  const settings = publicEnv({
    VITE_SUPABASE_URL: "https://example.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    DATABASE_URL: "private-db",
    SUPABASE_SECRET_KEY: "private-secret",
    GROQ_API_KEY: "private-model-key",
  });
  expect(settings.BUN_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
  expect(JSON.stringify(settings)).not.toContain("private-");
  expect(Object.keys(settings)).toHaveLength(4);
});
test("blocks Supabase secret/service role keys from browser settings", () => {
  expect(() => publicEnv({ BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_example" })).toThrow();
  const jwt = `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
  expect(() => publicEnv({ VITE_SUPABASE_PUBLISHABLE_KEY: jwt })).toThrow();
});
test("source links accept only credential-free HTTP(S)", () => {
  expect(safeSourceUrl("https://example.org/article")).toBe("https://example.org/article");
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///etc/passwd",
    "https://user:password@example.org",
    "not-a-url",
  ])
    expect(safeSourceUrl(value)).toBeNull();
});
