import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router";
import { EligibilityGate } from "../src/components/EligibilityGate";
import { confirmEligibility, eligibilityKey, hasEligibility } from "../src/lib/eligibility";
test("confirmation requires the current affirmative adult and terms record", () => {
  const data = new Map<string, string>();
  const store = { getItem: (key: string) => data.get(key) || null, setItem: (key: string, value: string) => { data.set(key, value); } };
  expect(hasEligibility(store)).toBe(false);
  for (const value of ["true", "{}", '{"adult":true}', "invalid"]) { data.set(eligibilityKey, value); expect(hasEligibility(store)).toBe(false); }
  confirmEligibility(store); expect(hasEligibility(store)).toBe(true);
  expect(store.getItem(eligibilityKey)).not.toMatch(/birth|password|token/);
});
test("research children cannot render before declaration, and assent is separate from consent", () => {
  const html = renderToStaticMarkup(<StaticRouter location="/dashboard"><EligibilityGate><div>private research marker</div></EligibilityGate></StaticRouter>);
  expect(html).not.toContain("private research marker");
  expect(html).toContain("I confirm I am at least 18");
  expect(html.match(/type="checkbox"/g)).toHaveLength(2);
  expect(html).not.toContain("checked=");
  expect(html).toContain('disabled=""');
  expect(html).not.toMatch(/type="date"|identification document/);
});
