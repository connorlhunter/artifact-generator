import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  parseCentralizedDocSource,
  parseDocSource,
  readDocumentMetadata,
} from "../../scripts/docs/doc-metadata.ts";

let directory = "";

afterEach(() => {
  if (directory) rmSync(directory, { force: true, recursive: true });
  directory = "";
});

describe("document metadata", () => {
  test("parses and removes the required first-line metadata comment", () => {
    expect(
      parseDocSource(
        "<!-- artifact-generator:version=2.4.1 lastUpdated=2026-08-18 -->\n# Guide\n",
        "docs/example/guide.md",
      ),
    ).toEqual({
      body: "# Guide\n",
      metadata: { lastUpdated: "2026-08-18", version: "2.4.1" },
    });
  });

  test("rejects missing, misplaced, and duplicate metadata", () => {
    expect(() => parseDocSource("# Guide\n", "guide.md")).toThrow("missing");
    expect(() =>
      parseDocSource(
        "# Guide\n<!-- artifact-generator:version=1.0.0 lastUpdated=2026-08-18 -->\n",
        "guide.md",
      ),
    ).toThrow("first line");
    expect(() =>
      parseDocSource(
        "<!-- artifact-generator:version=1.0.0 lastUpdated=2026-08-18 -->\n\n<!-- artifact-generator:version=1.0.1 lastUpdated=2026-08-19 -->\n# Guide\n",
        "guide.md",
      ),
    ).toThrow("duplicate");
  });

  test("allows the metadata syntax to appear in documentation examples", () => {
    const markdown = [
      "<!-- artifact-generator:version=1.0.0 lastUpdated=2026-08-18 -->",
      "# Metadata",
      "",
      "```md",
      "<!-- artifact-generator:version=2.0.0 lastUpdated=2026-08-19 -->",
      "```",
      "",
      "    <!-- artifact-generator:version=3.0.0 lastUpdated=2026-08-20 -->",
      "",
    ].join("\n");

    expect(parseDocSource(markdown, "metadata.md").body).toContain(
      "artifact-generator:version=2.0.0",
    );
    expect(parseDocSource(markdown, "metadata.md").body).toContain(
      "artifact-generator:version=3.0.0",
    );
  });

  test("rejects invalid versions and dates", () => {
    expect(() =>
      parseDocSource(
        "<!-- artifact-generator:version=1.0 lastUpdated=2026-02-30 -->\n# Guide\n",
        "guide.md",
      ),
    ).toThrow("major.minor.patch");
    expect(() =>
      parseDocSource(
        "<!-- artifact-generator:version=1.0.0 lastUpdated=2026-02-30 -->\n# Guide\n",
        "guide.md",
      ),
    ).toThrow("real calendar date");
  });

  test("requires the canonical first-line declaration", () => {
    expect(() =>
      parseDocSource(
        "<!-- artifact-generator: version=1.0.0 lastUpdated=2026-08-18 -->\n# Guide\n",
        "guide.md",
      ),
    ).toThrow("must begin with");
    expect(() =>
      parseDocSource(
        "<!-- artifact-generator:version=1.0.0 lastUpdated=2026-08-18  -->\n# Guide\n",
        "guide.md",
      ),
    ).toThrow("must begin with");
  });

  test("reads centralized document metadata and rejects legacy page declarations", async () => {
    directory = mkdtempSync(join(tmpdir(), "document-metadata-"));
    const metadataPath = join(directory, "document-metadata.json");
    writeFileSync(metadataPath, '{\n  "lastUpdated": "2026-08-18",\n  "version": "2.4.1"\n}');

    await expect(readDocumentMetadata(metadataPath)).resolves.toEqual({
      lastUpdated: "2026-08-18",
      version: "2.4.1",
    });
    expect(parseCentralizedDocSource("# Guide\n", "docs/example/guide.md")).toBe("# Guide\n");
    expect(() =>
      parseCentralizedDocSource(
        "<!-- artifact-generator:version=2.4.1 lastUpdated=2026-08-18 -->\n# Guide\n",
        "docs/example/guide.md",
      ),
    ).toThrow("metadata belongs");
  });
});
