import { expect, test } from "bun:test";
import { answerModelLabel } from "../src/lib/models";
import { readSearchEvents } from "../src/lib/stream";
import type { Message } from "../src/lib/types";

const message: Message = { id: "old", role: "assistant", content: "Old answer", sources: [], followUps: [], status: "complete", created_at: "now" };
const qwen = { id: "qwen/qwen3.8-27b", name: "Qwen 3.8 27B", provider: "Groq" as const, preview: true };
test("older messages remain unknown and partial answers do not claim a model", () => {
  expect(answerModelLabel(message)).toBe("Model unknown");
  expect(answerModelLabel({ ...message, status: "failed", model: qwen })).toBeNull();
  expect(answerModelLabel({ ...message, status: "streaming", model: qwen })).toBeNull();
  expect(answerModelLabel({ ...message, answerKind: "no-sources" })).toContain("No model used");
  expect(answerModelLabel({ ...message, answerKind: "sources-only" })).toContain("No model used");
});
test("saved answer labels use immutable per-message metadata including Preview and serving provider", () => {
  const first = { ...message, model: qwen, answerKind: "ai" as const };
  const second = { ...message, model: { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", provider: "Groq" as const, preview: false } };
  expect(answerModelLabel(first)).toBe("Qwen 3.8 27B · Preview · Served by Groq");
  expect(answerModelLabel(second)).toBe("GPT-OSS 120B · Served by Groq");
  expect(answerModelLabel(first)).toContain("Qwen");
});
async function completion(fields: Record<string, unknown>) {
  const bytes = new TextEncoder().encode(`event: done\ndata: ${JSON.stringify({ conversationId: "thread", ...fields })}\n\n`);
  const body = new ReadableStream<Uint8Array>({ start(controller) {
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  }});
  const result = [];
  for await (const event of readSearchEvents(body)) result.push(event);
  return result;
}
test("fragmented completion events validate actual model metadata and preserve older unknown messages", async () => {
  expect((await completion({ model: qwen, answerKind: "ai" }))[0]).toMatchObject({ event: "done", data: { model: qwen } });
  await expect(completion({ model: null, answerKind: "ai" })).rejects.toThrow("could not be confirmed");
  await expect(completion({ model: { ...qwen, provider: "fake" }, answerKind: "ai" })).rejects.toThrow();
  await expect(completion({ model: qwen, answerKind: "sources-only" })).rejects.toThrow();
  expect((await completion({}))[0]?.event).toBe("done");
});
