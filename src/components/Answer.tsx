import type { Source } from "@/lib/types";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  // Resolve citations in text nodes, never inside code or existing links.
  function citations() {
    type Node = { type: string; value?: string; children?: Node[]; [key: string]: unknown };
    return (tree: Node) => {
      function walk(node: Node) {
        if (!node.children || ["link", "linkReference", "code", "inlineCode", "html"].includes(node.type)) return;
        node.children = node.children.flatMap((child): Node[] => {
          if (child.type !== "text") { walk(child); return [child]; }
          return (child.value || "").split(/(\[\d{1,3}\])/g).filter(Boolean).map((value): Node => {
            const match = /^\[(\d+)\]$/.exec(value);
            const source = match && sources.find((source) => source.id === Number(match[1]));
            const url = source && safeSourceUrl(source.url);
            return source && url ? { type: "link", url, children: [{ type: "text", value: String(source.id) }],
              data: { hProperties: { className: "citation", "aria-label": `Source ${source.id}: ${source.title}` } } }
              : { type: "text", value };
          });
        });
      }
      walk(tree);
    };
  }
  return (
    <div className="answer-text">
      <Markdown skipHtml remarkPlugins={[remarkGfm, citations]}
        urlTransform={(value) => safeSourceUrl(value) || ""}
        components={{
          a: ({ node, children, href, ...props }) => href ?
            <a {...props} href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
          img: ({ alt }) => <span>{alt}</span>,
          table: ({ node, ...props }) => <div className="table-scroll" tabIndex={0} role="region" aria-label="Answer table"><table {...props} /></div>,
        }}>{content}</Markdown>
    </div>
  );
}
