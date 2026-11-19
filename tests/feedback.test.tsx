import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportAnswer } from "../src/components/ReportAnswer";
import { requestErrorMessage } from "../src/lib/request-error";
import { Answer } from "../src/components/Answer";

test("reports use a static public link without message, thread, account or referrer data", () => {
  const html = renderToStaticMarkup(<ReportAnswer />);
  const href = /href="([^"]+)"/.exec(html)![1]!;
  expect(href).toBe("https://github.com/S-Adnan-11/nuelexity_backend/issues/new");
  expect(html).toContain('referrerPolicy="no-referrer"');
  expect(html).toContain("voluntarily");
  expect(html).toContain("public");
});

test("personal, shared and provider exhaustion use server timing and retain useful messages", () => {
  const now = Date.UTC(2026, 10, 17);
  const cases = [
    ["DAILY_LIMIT", "Your daily"], ["IP_DAILY_LIMIT", "This network"],
    ["GLOBAL_DAILY_LIMIT", "shared daily"], ["GLOBAL_MONTHLY_LIMIT", "shared monthly"],
    ["GLOBAL_MINUTE_LIMIT", "capacity is busy"], ["MODEL_RATE_LIMIT", "selected model"],
    ["SEARCH_RATE_LIMIT", "search provider"],
  ];
  for (const [code, expected] of cases) {
    const message = requestErrorMessage({ message: "Old API message", code, retryAfter: 17 }, now);
    expect(message).toContain(expected);
    expect(message).toContain("draft");
    expect(message).toContain(new Date(now + 17000).toLocaleString());
  }
  expect(requestErrorMessage({ message: "Unknown error", code: "OLD_CODE" })).toBe("Unknown error");
});

test("citation mapping keeps unsupported in-range claims inspectable without certifying them", () => {
  const html = renderToStaticMarkup(<Answer content="A flight is bookable [1]. Missing [2], [0] and [999]."
    sources={[{ id: 1, title: "Airport project only", url: "https://example.test/proposal", snippet: "Construction is proposed." }]} />);
  expect(html.match(/class="citation"/g)).toHaveLength(1);
  expect(html).toContain("https://example.test/proposal");
  expect(html).toContain("[2]");
  expect(html).toContain("[0]");
  expect(html).toContain("[999]");
  expect(html).not.toMatch(/verified|fact.checked/i);
});

test("provider bracket variants use the same stable IDs, including old saved answers", () => {
  const html = renderToStaticMarkup(<Answer content="Evidence [1] and 【1】. Unknown 【2】. Code `【1】`."
    sources={[{ id: 1, title: "Evidence", url: "https://example.test/evidence", snippet: "Evidence" }]} />);
  expect(html.match(/class="citation"/g)).toHaveLength(2);
  expect(html).toContain("【2】");
  expect(html).toContain("<code>【1】</code>");
});
