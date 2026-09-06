import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { compileMarkdownBlocks } from "../../scripts/docs/markdown-document.ts";
import { writePdf } from "../../scripts/pdf/write-pdf.ts";
import { pdfLink } from "../../scripts/pdf/pdf-text.ts";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "artifact-pdf-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

test("embeds fonts, links, bookmarks, and paginated technical content", async () => {
  const source = { id: "manual", input: "docs/project/manual.md", project: "project" };
  const markdown = [
    "## Installation",
    "",
    "Use **strong**, *emphasis*, `code`, and [the reference](reference.md).",
    "",
    "[Website](https://example.test) and [diagram](project-overview.mmd).",
    "",
    "> A quote with a [contact](mailto:person@example.test).",
    "",
    "1. First",
    "2. Second",
    "   - Nested item",
    "",
    "---",
    "",
    "```ts",
    ...Array.from({ length: 80 }, (_, index) => `const line${index} = ${index};`),
    "\t" + "x".repeat(160),
    "",
    "```",
    "",
    "| Name | Description |",
    "| --- | --- |",
    ...Array.from(
      { length: 80 },
      (_, index) => `| Row ${index} | A useful description for item ${index}. |`,
    ),
  ].join("\n");
  const output = join(root, "manual.pdf");
  await writePdf({
    output,
    title: "Technical manual",
    contents: true,
    projectUrl: "https://example.test/projects/project",
    sections: [
      {
        heading: "Manual",
        id: "manual",
        blocks: compileMarkdownBlocks(
          markdown,
          source,
          new Map([["docs/project/reference.md", "reference"]]),
        ),
      },
      {
        heading: "Reference",
        id: "reference",
        blocks: [
          { type: "paragraph", content: [] },
          { type: "table", rows: [] },
        ],
      },
    ],
  });
  const pdf = readFileSync(output, "latin1");
  expect(pdf.startsWith("%PDF-")).toBe(true);
  expect([...pdf.matchAll(/\/Type \/Page\b/gu)].length).toBeGreaterThan(5);
  expect(pdf).toContain("/FontFile3");
  expect(pdf).toContain("/Outlines");
  expect(pdf).toContain("/Subtype /Link");
  expect(pdf).toContain("https://example.test/projects/project/diagrams/overview");
  expect(pdf).toContain("mailto:person@example.test");
  expect(readdirSync(root)).toEqual(["manual.pdf"]);
});

test("preserves a previous PDF and removes staging files when layout fails", async () => {
  const output = join(root, "manual.pdf");
  writeFileSync(output, "%PDF-previous");
  const text = spyOn(PDFDocument.prototype, "text").mockImplementationOnce(() => {
    throw new Error("Layout failed");
  });
  try {
    await expect(writePdf({ output, title: "Manual", sections: [] })).rejects.toThrow(
      "Layout failed",
    );
  } finally {
    text.mockRestore();
  }
  expect(readFileSync(output, "utf8")).toBe("%PDF-previous");
  expect(readdirSync(root)).toEqual(["manual.pdf"]);
});

test("only emits supported links and known document destinations", () => {
  const links = { destinations: new Set(["reference"]) };
  expect(
    pdfLink({ type: "link", children: [], target: { kind: "document", id: "reference" } }, links),
  ).toEqual({ goTo: "reference" });
  for (const href of ["javascript:alert(1)", "file:///private/file", "../missing.md"]) {
    expect(pdfLink({ type: "link", children: [], href }, links)).toEqual({});
  }
  expect(
    pdfLink({ type: "link", children: [], target: { kind: "document", id: "missing" } }, links),
  ).toEqual({});
});
