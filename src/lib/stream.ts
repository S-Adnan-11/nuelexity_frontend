import type { SearchEvent } from "./types";

const names = new Set(["meta", "status", "sources", "delta", "follow_ups", "done", "error"]);
export async function* readSearchEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SearchEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "",
    completed = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (buffer.length > 65536) throw new Error("The server returned an oversized stream event.");
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const packet = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const lines = packet.split(/\r?\n/);
        const name = lines
          .find((l) => l.startsWith("event:"))
          ?.slice(6)
          .trim();
        const text = lines
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trimStart())
          .join("\n");
        if (!name || !text || !names.has(name)) continue;
        const data: unknown = JSON.parse(text);
        if (!data || typeof data !== "object")
          throw new Error("The server returned an invalid event.");
        const fields = data as Record<string, unknown>;
        if (name === "delta" && typeof fields.text !== "string")
          throw new Error("Invalid answer event.");
        if (
          name === "sources" &&
          (!Array.isArray(fields.sources) ||
            fields.sources.length > 5 ||
            !fields.sources.every(
              (source) =>
                source &&
                typeof source === "object" &&
                Number.isInteger(source.id) &&
                source.id >= 1 &&
                source.id <= 5 &&
                typeof source.title === "string" &&
                typeof source.url === "string" &&
                typeof source.snippet === "string",
            ))
        )
          throw new Error("Invalid sources event.");
        if (
          name === "follow_ups" &&
          (!Array.isArray(fields.questions) ||
            !fields.questions.every((q) => typeof q === "string"))
        )
          throw new Error("Invalid follow-up event.");
        if (
          name === "meta" &&
          (typeof fields.requestId !== "string" ||
            !(fields.conversationId === null || typeof fields.conversationId === "string") ||
            typeof fields.remaining !== "number" ||
            !["ai", "sources-only"].includes(String(fields.answerMode)))
        )
          throw new Error("Invalid metadata event.");
        if (name === "status" && !["searching", "answering"].includes(String(fields.stage)))
          throw new Error("Invalid status event.");
        if (
          name === "done" &&
          !(fields.conversationId === null || typeof fields.conversationId === "string")
        )
          throw new Error("Invalid completion event.");
        if (
          name === "error" &&
          (typeof fields.message !== "string" || typeof fields.code !== "string")
        )
          throw new Error("Invalid error event.");
        if (name === "done" || name === "error") completed = true;
        yield { event: name, data } as SearchEvent;
        if (completed) return;
      }
      if (done) break;
    }
    if (!completed)
      throw new Error(
        "The connection closed before the answer finished. Your sources may still be available.",
      );
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
