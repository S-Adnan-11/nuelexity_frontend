import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
import path from "node:path";

const root = path.join(import.meta.dirname, "..", "public", "brand", "v2");
test("the supplied manifest resolves real, correctly sized app icons", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "icons/site.webmanifest"), "utf8"));
  expect(manifest.name).toBe("Nuelexity");
  expect(manifest.theme_color).toBe("#111916");
  for (const icon of manifest.icons) {
    const bytes = Buffer.from(await readFile(path.join(import.meta.dirname, "..", "public", icon.src)));
    const size = Number(icon.sizes.split("x")[0]);
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  }
});

test("fonts are bundled WOFF files with their OFL licences", async () => {
  for (const [font, licence] of [["Manrope-Variable.woff", "Manrope-OFL.txt"], ["DMSerifDisplay-Regular.woff", "DMSerifDisplay-OFL.txt"]]) {
    const bytes = Buffer.from(await readFile(path.join(root, "fonts", font!)));
    expect(bytes.subarray(0, 4).toString()).toBe("wOFF");
    expect(await readFile(path.join(root, "fonts", licence!), "utf8")).toContain("SIL OPEN FONT LICENSE");
  }
});

test("metadata uses the owner-confirmed domain and a single manifest", async () => {
  const head = await readFile(path.join(import.meta.dirname, "../src/index.html"), "utf8");
  expect(head.match(/rel="manifest"/g)).toHaveLength(1);
  expect(head).toContain('content="https://nuelexity.devs.surf/brand/v2/social/open-graph.png"');
  expect(head).not.toContain("REPLACE_WITH");
  expect(head).not.toContain("logo.svg");
  const bytes = Buffer.from(await readFile(path.join(root, "social/open-graph.png")));
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(630);
});
