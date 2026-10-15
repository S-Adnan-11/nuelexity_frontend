import type { Message, ModelAttribution } from "./types";

export function isModelAttribution(value: unknown): value is ModelAttribution {
  if (!value || typeof value !== "object") return false;
  const model = value as Record<string, unknown>;
  return typeof model.id === "string" && model.id.length > 0 && model.id.length <= 100 &&
    typeof model.name === "string" && model.name.length <= 100 && model.provider === "Groq" && typeof model.preview === "boolean";
}
export function answerModelLabel(message: Message) {
  if (message.status !== "complete") return null;
  if (message.model && isModelAttribution(message.model))
    return `${message.model.name}${message.model.preview ? " · Preview" : ""} · Served by ${message.model.provider}`;
  if (message.answerKind === "sources-only") return "Sources only · No model used";
  if (message.answerKind === "no-sources") return "No usable sources · No model used";
  return "Model unknown";
}
