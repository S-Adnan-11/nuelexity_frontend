import { ArrowUpRight } from "lucide-react";
import type { Source } from "../lib/types";
import { safeSourceUrl } from "./Answer";

// Presentation only: shared by real answers and the isolated About example.
export function SourceCards({ sources }: { sources: Source[] }) {
  return <div className="source-grid" aria-label="Sources">{sources.map(source => {
    const url = safeSourceUrl(source.url);
    return url ? <a href={url} target="_blank" rel="noopener noreferrer" className="source-card" key={source.id}>
      <span className="source-domain"><span>{source.id}</span>{new URL(url).hostname.replace(/^www\./, "")}</span>
      <strong>{source.title}</strong><ArrowUpRight size={13} />
    </a> : null;
  })}</div>;
}
