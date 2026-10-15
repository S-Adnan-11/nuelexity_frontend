import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Answer } from "../src/components/Answer";

const sources = [{ id: 1, title: 'Evidence "quoted"', url: "https://example.test/evidence", snippet: "" }];
const render = (content: string) => renderToStaticMarkup(<Answer content={content} sources={sources} />);

describe("untrusted answer Markdown", () => {
  test("formats emphasis, lists, code and tables while preserving citations", () => {
    const result = render('**Evidence** [1]\n\n- One\n- Two\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```js\nconst citation = "[1]";\n```');
    expect(result).toContain("<strong>Evidence</strong>");
    expect(result).toContain("<ul>");
    expect(result).toContain("<table>");
    expect(result.match(/class="citation"/g)).toHaveLength(1);
    expect(result).toContain('const citation = &quot;[1]&quot;');
    expect(result).toContain('rel="noopener noreferrer"');
  });
  test("blocks raw HTML, script URLs, credentials and remote tracking images", () => {
    const result = render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert(1)) [private](https://user:secret@example.test) ![image](https://tracker.test/pixel)');
    expect(result).not.toContain("<script");
    expect(result).not.toContain("<img");
    expect(result).not.toContain("javascript:");
    expect(result).not.toContain("secret");
    expect(result).not.toContain("tracker.test");
  });
  test("every streaming prefix renders safely and final markers become emphasis", () => {
    const answer = "A **streamed answer** with [1] and `code`.";
    for (let end = 0; end <= answer.length; end++) expect(() => render(answer.slice(0, end))).not.toThrow();
    expect(render(answer)).toContain("<strong>streamed answer</strong>");
  });
});
