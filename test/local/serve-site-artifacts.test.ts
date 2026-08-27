import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  localArtifactPath,
  localProjectArtifactPath,
} from "../../scripts/local/serve-site-artifacts.ts";

let temporaryDirectory = "";

afterEach(() => {
  if (temporaryDirectory) rmSync(temporaryDirectory, { force: true, recursive: true });
  temporaryDirectory = "";
});

describe("local artifact server", () => {
  test("maps project-owned coverage and changelog outputs to their local repositories", () => {
    expect(localProjectArtifactPath("connor-hunter", "coverage", "index.json", "/workspace")).toBe(
      "/workspace/connorhunter/coverage/index.json",
    );
    expect(localProjectArtifactPath("cipher", "changelog", "CHANGELOG.md", "/workspace")).toBe(
      "/workspace/cipher/changelog/CHANGELOG.md",
    );
    expect(
      localProjectArtifactPath("artifact-generator", "changelog", "changelog.pdf", "/workspace"),
    ).toBe("/workspace/artifact-generator/dist/changelog/artifact-generator/changelog.pdf");
    expect(
      localProjectArtifactPath("cipher", "coverage", "lcov.info", "/workspace"),
    ).toBeUndefined();
  });

  test("prefers an existing project-owned report and falls back to the assembled bundle", () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "artifact-local-server-"));
    const workspace = join(temporaryDirectory, "workspace");
    const bundle = join(temporaryDirectory, "bundle");
    const coverage = join(workspace, "cipher", "coverage", "index.json");
    const docs = join(bundle, "docs", "cipher", "index.json");
    mkdirSync(join(workspace, "cipher", "coverage"), { recursive: true });
    mkdirSync(join(bundle, "docs", "cipher"), { recursive: true });
    writeFileSync(coverage, "{}\n");
    writeFileSync(docs, "{}\n");

    expect(localArtifactPath("projects/cipher/coverage/index.json", workspace, bundle)).toBe(
      coverage,
    );
    expect(localArtifactPath("docs/cipher/index.json", workspace, bundle)).toBe(docs);
    expect(localArtifactPath("../private.json", workspace, bundle)).toBeUndefined();
  });
});
