import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { compileMarkdownBlocks } from "../../scripts/docs/markdown-document.ts";
import { artifactProjectSlug } from "../../scripts/docs/docs-utils.ts";

describe("document artifact", () => {
  let tempDirectory = "";

  afterEach(() => {
    if (tempDirectory) rmSync(tempDirectory, { force: true, recursive: true });
    tempDirectory = "";
  });

  test("keeps local document and diagram links as semantic targets", () => {
    const blocks = compileMarkdownBlocks(
      "# Overview\n\nRead [details](details.md) and [diagram](cipher-overview.mmd).",
      { id: "overview", input: "docs/cipher/overview.md", project: "cipher" },
      new Map([["docs/cipher/details.md", "details"]]),
    );

    expect(blocks[0]).toMatchObject({ id: "overview-1", type: "heading" });
    expect(JSON.stringify(blocks)).toContain('"kind":"document"');
    expect(JSON.stringify(blocks)).toContain('"kind":"diagram"');
  });

  test("uses the source manifest instead of an untrusted project path", () => {
    tempDirectory = mkdtempSync(join(tmpdir(), "artifact-project-slug-"));
    const manifest = join(tempDirectory, "project-artifacts.json");
    writeFileSync(manifest, JSON.stringify({ projects: { cipher: {} } }));

    expect(artifactProjectSlug("cipher", manifest)).toBe("cipher");
    expect(() => artifactProjectSlug("../outside", manifest)).toThrow("Unknown docs project");
  });

  test("flows source line wrapping around inline code and preserves explicit breaks", () => {
    const blocks = compileMarkdownBlocks(
      "A wrapped\nparagraph with `inline code` followed\nby more text.  \nNext line.",
      { id: "overview", input: "docs/project/overview.md", project: "project" },
    );
    expect(blocks).toEqual([
      {
        type: "paragraph",
        content: [
          { type: "text", value: "A wrapped paragraph with " },
          { type: "code", value: "inline code" },
          { type: "text", value: " followed by more text." },
          { type: "text", value: "\n" },
          { type: "text", value: "Next line." },
        ],
      },
    ]);
  });
});
