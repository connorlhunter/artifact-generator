import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  buildSiteArtifacts,
  projectSlugsFromManifest,
  type BuildSiteArtifactActions,
} from "../../scripts/publish/build-site-artifacts.ts";

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

  test("preserves project slugs from the shared manifest order", () => {
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
      "zeta-service",
      "alpha-app",
    ]);
  });

  test("builds each project artifact before assembling shared outputs", async () => {
    const calls: string[] = [];
    const actions: BuildSiteArtifactActions = {
      buildChangelogArtifact: async () => {
        calls.push("changelog");
        return "dist/changelog";
      },
      buildDocsArtifact: async (slug) => {
        calls.push(`docs:${slug}`);
        return `dist/docs/${slug}`;
      },
      buildResume: async () => {
        calls.push("resume");
        return "dist/resume.pdf";
      },
      buildSiteContentArtifact: () => {
        calls.push("content");
        return "dist/content.json";
      },
      cleanPublishOutputs: () => {
        calls.push("clean");
      },
      copyDocsArtifact: (slug) => {
        calls.push(`copy-docs:${slug}`);
      },
      copyRenderedDiagrams: () => {
        calls.push("copy-diagrams");
        return 3;
      },
      copySharedPublishInputs: () => {
        calls.push("copy-shared");
      },
      projectSlugsFromManifest: () => ["cipher", "artifact-generator"],
      renderCoveragePdf: async () => {
        calls.push("coverage-pdf");
        return "coverage/coverage.pdf";
      },
      renderCoverageReport: async () => {
        calls.push("coverage-json");
        return "coverage/index.json";
      },
      renderDiagrams: async (slugs) => {
        calls.push(`diagrams:${slugs.join(",")}`);
      },
      validateSourceInputSelection: () => {
        calls.push("validate");
      },
    };

    await buildSiteArtifacts([], actions);

    expect(calls).toEqual([
      "validate",
      "clean",
      "coverage-json",
      "coverage-pdf",
      "changelog",
      "content",
      "resume",
      "diagrams:cipher,artifact-generator",
      "docs:cipher",
      "copy-docs:cipher",
      "docs:artifact-generator",
      "copy-docs:artifact-generator",
      "copy-diagrams",
      "copy-shared",
    ]);
  });

  test("rejects an empty project manifest before building outputs", async () => {
    const calls: string[] = [];
    const actions = {
      projectSlugsFromManifest: () => [],
      validateSourceInputSelection: () => {
        calls.push("validate");
      },
    } as unknown as BuildSiteArtifactActions;

    await expect(buildSiteArtifacts([], actions)).rejects.toThrow("No projects found");
    expect(calls).toEqual(["validate"]);
  });
});
