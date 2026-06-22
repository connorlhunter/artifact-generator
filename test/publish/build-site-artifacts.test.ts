import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { projectSlugsFromManifest } from "../../scripts/publish/build-site-artifacts.ts";

describe("build site artifacts", () => {
  const originalCwd = process.cwd();
  let tempDir = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "artifact-build-"));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { force: true, recursive: true });
  });

  test("reads stable project slugs from the shared manifest", () => {
    writeFileSync(
      "project-artifacts.json",
      JSON.stringify({
        projects: {
          "zeta-service": {},
          "alpha-app": {},
        },
      }),
    );

    expect(projectSlugsFromManifest("project-artifacts.json")).toEqual([
      "alpha-app",
      "zeta-service",
    ]);
  });
});
