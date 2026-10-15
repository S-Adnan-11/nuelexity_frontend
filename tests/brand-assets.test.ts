import { expect, test } from "bun:test";
import path from "node:path";

const root = path.join(import.meta.dir, "..", "public", "brand", "v2");
test("the supplied manifest resolves real, correctly sized app icons", async () => {
  const manifest = await Bun.file(path.join(root, "icons/site.webmanifest")).json();
  expect(manifest.name).toBe("Nuelexity");
  expect(manifest.theme_color).toBe("#111916");
  for (const icon of manifest.icons) {
    const bytes = Buffer.from(await Bun.file(path.join(import.meta.dir, "..", "public", icon.src)).arrayBuffer());
    const size = Number(icon.sizes.split("x")[0]);
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  }
});

test("fonts are bundled WOFF files with their OFL licences", async () => {
  for (const [font, licence] of [["Manrope-Variable.woff", "Manrope-OFL.txt"], ["DMSerifDisplay-Regular.woff", "DMSerifDisplay-OFL.txt"]]) {
    const bytes = Buffer.from(await Bun.file(path.join(root, "fonts", font!)).arrayBuffer());
    expect(bytes.subarray(0, 4).toString()).toBe("wOFF");
    expect(await Bun.file(path.join(root, "fonts", licence!)).text()).toContain("SIL OPEN FONT LICENSE");
  }
});

test("metadata uses the owner-confirmed domain and a single manifest", async () => {
  const head = await Bun.file(path.join(import.meta.dir, "../src/index.html")).text();
  expect(head.match(/rel="manifest"/g)).toHaveLength(1);
  expect(head).toContain('content="https://nuelexity.devs.surf/brand/v2/social/open-graph.png"');
  expect(head).not.toContain("REPLACE_WITH");
  expect(head).not.toContain("logo.svg");
  const bytes = Buffer.from(await Bun.file(path.join(root, "social/open-graph.png")).arrayBuffer());
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(630);
});
