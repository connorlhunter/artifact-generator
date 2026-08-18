import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  artifactUpdatedDate,
  formatArtifactUpdatedDate,
  readArtifactUpdatedDate,
  writeArtifactUpdatedDate,
} from "../../scripts/publish/update-content-manifest.ts";

describe("artifact updated date", () => {
  let tempDirectory = "";

  afterEach(() => {
    if (tempDirectory) rmSync(tempDirectory, { force: true, recursive: true });
    tempDirectory = "";
  });

  test("writes a UTC publication date and reads it for rendered docs", () => {
    tempDirectory = mkdtempSync(join(tmpdir(), "artifact-updated-date-"));
    const manifestPath = join(tempDirectory, "content-manifest.json");
    writeFileSync(manifestPath, JSON.stringify({ projects: {} }));

    expect(writeArtifactUpdatedDate(manifestPath, new Date("2026-08-18T23:59:59.000Z"))).toBe(
      "2026-08-18",
    );
    expect(readArtifactUpdatedDate(manifestPath)).toBe("2026-08-18");
    expect(formatArtifactUpdatedDate("2026-08-18")).toBe("August 18, 2026");
    expect(JSON.parse(readFileSync(manifestPath, "utf8"))).toEqual({
      lastUpdated: "2026-08-18",
      projects: {},
    });
  });

  test("uses the UTC calendar date", () => {
    expect(artifactUpdatedDate(new Date("2026-08-19T00:15:00.000Z"))).toBe("2026-08-19");
  });

  test("rejects a missing or malformed date", () => {
    tempDirectory = mkdtempSync(join(tmpdir(), "artifact-updated-date-"));
    const manifestPath = join(tempDirectory, "content-manifest.json");

    writeFileSync(manifestPath, JSON.stringify({}));
    expect(() => readArtifactUpdatedDate(manifestPath)).toThrow("missing lastUpdated");

    writeFileSync(manifestPath, JSON.stringify({ lastUpdated: "Aug 18" }));
    expect(() => readArtifactUpdatedDate(manifestPath)).toThrow("invalid lastUpdated");
  });
});
