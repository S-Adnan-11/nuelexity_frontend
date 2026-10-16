// Optional, untrusted display text. A bad suggestion never fails a good answer.
export function safeFollowUps(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 3) return [];
  const seen = new Set<string>();
  return value.flatMap(entry => {
    if (typeof entry !== "string") return [];
    const question = entry.trim();
    const key = question.normalize("NFKC").toLowerCase();
    if (question.length < 12 || question.length > 160 || /[<>`\r\n\u0000-\u001f]/.test(question) || seen.has(key) ||
      /^(?:what are the key facts about|what do other sources say about|explain .+ in simpler terms)/i.test(question)) return [];
    seen.add(key);
    return [question];
  });
}
