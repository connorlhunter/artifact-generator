import { expect, test } from "bun:test";
import { parseFrontmatter } from "../../scripts/content/frontmatter.ts";

test("accepts trailing commas without rewriting punctuation inside strings", () => {
  const metadata = {
    summary: 'Punctuation ,} and ,] and an escaped " quote',
    stack: ["Bun", "TypeScript"],
  };
  const json = JSON.stringify(metadata)
    .replace('"TypeScript"]', '"TypeScript",]')
    .replace(/\}$/u, ",}");
  const result = parseFrontmatter(`---\r\n${json}\r\n---\r\n\n# Notes\n`);
  expect(result.metadata).toEqual(metadata);
  expect(result.body).toBe("# Notes");
});

test("accepts array frontmatter used by navigation and skills", () => {
  expect(parseFrontmatter('---\n["Projects", "Skills",]\n---').metadata).toEqual([
    "Projects",
    "Skills",
  ]);
});

test("rejects missing or malformed frontmatter", () => {
  for (const input of ["# No metadata", "---\n{broken}\n---"]) {
    expect(() => parseFrontmatter(input)).toThrow();
  }
});
