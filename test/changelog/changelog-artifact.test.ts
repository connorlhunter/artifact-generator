import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  assertCurrentRelease,
  buildChangelogArtifact,
  parseChangelog,
} from "../../scripts/changelog/changelog-artifact.ts";

describe("changelog artifact", () => {
  const originalCwd = process.cwd();
  let temporaryDirectory = "";

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "artifact-changelog-"));
    process.chdir(temporaryDirectory);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = "";
  });

  test("supports bracketed and prerelease version headings", () => {
    const releases = parseChangelog(
      "# Changelog\n\n## [0.1.0-alpha.1] - 2026-08-26\n\n### Added\n\n- Published Markdown artifacts.\n",
    );

    assertCurrentRelease("0.1.0-alpha.1", releases);
    expect(releases[0]?.sections[0]?.entries).toEqual(["Published Markdown artifacts."]);
  });

  test("writes the canonical Markdown unchanged alongside a direct PDF", async () => {
    const changelog = [
      "# Changelog",
      "",
      "## 1.7.4 - 2026-08-27",
      "",
      "### Added",
      "",
      "- Publish native changelog artifacts.",
      "",
      "## 1.7.3 - 2026-08-26",
      "",
      "- Prior release.",
      "",
    ].join("\n");
    const output = join(temporaryDirectory, "dist", "changelog", "artifact-generator");
    writeFileSync("package.json", JSON.stringify({ version: "1.7.4" }));
    writeFileSync("CHANGELOG.md", changelog);

    await expect(buildChangelogArtifact(output, "2026-08-27T12:00:00.000Z")).resolves.toBe(output);

    expect(readFileSync(join(output, "CHANGELOG.md"), "utf8")).toBe(changelog);
    expect(existsSync(join(output, "changelog.pdf"))).toBe(true);
    expect(readFileSync(join(output, "changelog.pdf")).subarray(0, 4).toString()).toBe("%PDF");
  });

  test("requires the current package release to lead the changelog", async () => {
    writeFileSync("package.json", JSON.stringify({ version: "1.7.4" }));
    writeFileSync("CHANGELOG.md", "# Changelog\n\n## 1.7.3 - 2026-08-26\n");

    await expect(buildChangelogArtifact()).rejects.toThrow("CHANGELOG.md must begin with 1.7.4");
    expect(() => parseChangelog("# Changelog\n")).toThrow("does not contain a release heading");
  });
});
