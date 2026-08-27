import { describe, expect, test } from "bun:test";
import {
  assertCurrentRelease,
  parseChangelog,
} from "../../scripts/changelog/changelog-artifact.ts";

describe("changelog artifact", () => {
  test("supports bracketed and prerelease version headings", () => {
    const releases = parseChangelog(
      "# Changelog\n\n## [0.1.0-alpha.1] - 2026-08-26\n\n### Added\n\n- Published Markdown artifacts.\n",
    );

    assertCurrentRelease("0.1.0-alpha.1", releases);
    expect(releases[0]?.sections[0]?.entries).toEqual(["Published Markdown artifacts."]);
  });
});
