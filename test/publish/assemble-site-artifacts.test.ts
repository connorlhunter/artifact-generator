import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  cleanPublishOutputs,
  copyDocsArtifact,
  publishOutputs,
  sanitizeContentManifest,
} from "../../scripts/publish/assemble-site-artifacts.ts";

let temporaryDirectory = "";
let originalDirectory = "";

beforeEach(() => {
  originalDirectory = process.cwd();
  temporaryDirectory = mkdtempSync("/tmp/artifact-assemble-");
  process.chdir(temporaryDirectory);
});

afterEach(() => {
  process.chdir(originalDirectory);
  rmSync(temporaryDirectory, { force: true, recursive: true });
});

describe("assemble site artifacts", () => {
  test("copies a structured docs collection into the public bundle", () => {
    const source = join("dist", "docs-artifacts", "example");
    const output = join(publishOutputs.siteArtifacts, "docs", "example", "index.json");
    cleanPublishOutputs();
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "index.json"), '{"schemaVersion":2}\n');

    copyDocsArtifact("example");

    expect(existsSync(output)).toBe(true);
    expect(readFileSync(output, "utf8")).toContain('"schemaVersion":2');
  });

  test("publishes the Portfolio content manifest contract", () => {
    const manifestPath = join("dist", "site-artifacts", "manifests", "content-manifest.json");
    mkdirSync(join("dist", "site-artifacts", "manifests"), { recursive: true });
    writeFileSync(
      manifestPath,
      `${JSON.stringify({
        lastUpdated: "2026-08-27",
        profile: { profilePath: "profile/profile.md" },
        projectsManifestPath: "manifests/project-artifacts.json",
      })}\n`,
    );

    sanitizeContentManifest(manifestPath);

    expect(JSON.parse(readFileSync(manifestPath, "utf8"))).toEqual({
      lastUpdated: "2026-08-27",
      projectsManifestPath: "manifests/project-artifacts.json",
      schemaVersion: 2,
      siteContentPath: "content/site.json",
    });
  });
});
