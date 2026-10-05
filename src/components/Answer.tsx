import type { Source } from "@/lib/types";

export function safeSourceUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function Answer({ content, sources }: { content: string; sources: Source[] }) {
  // Text stays text. A webpage/model can't sneak HTML into your browser sha.
  const parts = content.split(/(\[\d{1,3}\])/g);
  return (
    <div className="answer-text">
      {parts.map((part, index) => {
        const match = /^\[(\d+)\]$/.exec(part);
        const source = match ? sources.find((s) => s.id === Number(match[1])) : undefined;
        const url = source && safeSourceUrl(source.url);
        return url ? (
          <a
            className="citation"
            key={index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Source ${source!.id}: ${source!.title}`}
          >
            {source!.id}
          </a>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </div>
  );
}
