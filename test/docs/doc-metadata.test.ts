import { describe, expect, test } from "bun:test";
import { parseDocSource } from "../../scripts/docs/doc-metadata.ts";

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
});
