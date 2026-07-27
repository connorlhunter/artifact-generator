import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  assembleSiteArtifacts,
  publishOutputs,
} from "../../scripts/publish/assemble-site-artifacts.ts";
import { sourceInputDirs, sourceInputRoot } from "../../scripts/core/script-constants.ts";

describe("assemble site artifacts", () => {
  const originalCwd = process.cwd();
  let tempDir = "";

  beforeEach(() => {
    rmSync(sourceInputRoot, { force: true, recursive: true });
    tempDir = mkdtempSync(join(tmpdir(), "artifact-publish-"));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { force: true, recursive: true });
    rmSync(sourceInputRoot, { force: true, recursive: true });
  });

  test("copies generated docs, diagrams, content, icons, and resume assets", () => {
    writeFixtureFile("dist/docs-preview/index.html", "<html>docs</html>");
    writeFixtureFile("dist/docs-preview/index.pdf", "%PDF-1.4");
    writeFixtureFile(`${sourceInputDirs.diagrams}/diagram-style-key.svg`, "<svg>key</svg>");
    writeFixtureFile(
      `${sourceInputDirs.diagrams}/example/example-overview.svg`,
      "<svg>example</svg>",
    );
    writeFixtureFile(`${sourceInputDirs.diagrams}/example/example-overview.mmd`, "flowchart TD");
    writeFixtureFile(`${sourceInputDirs.manifests}/content-manifest.json`, "{}");
    writeFixtureFile(
      `${sourceInputDirs.manifests}/project-artifacts.json`,
      JSON.stringify({ projects: { example: { docsPath: "docs/example/index.html" } } }),
    );
    writeFixtureFile(`${sourceInputDirs.profile}/profile.md`, "---\n{}\n---");
    writeFixtureFile(`${sourceInputDirs.projects}/example.md`, "---\n{}\n---");
    writeFixtureFile(`${sourceInputDirs.projects}/.local-metadata`, "junk");
    writeFixtureFile(
      `${sourceInputDirs.projects}/example/coverage/index.html`,
      "<html>app coverage</html>",
    );
    writeFixtureFile("coverage/index.html", "<html>coverage</html>");
    writeFixtureFile(`${sourceInputDirs.icons}/example/mark.svg`, "<svg>icon</svg>");
    writeFixtureFile(`${sourceInputDirs.resume}/example.pdf`, "%PDF-1.4");

    const output = assembleSiteArtifacts();

    expect(output).toEqual({
      diagramCount: 2,
      siteArtifacts: publishOutputs.siteArtifacts,
      siteAssets: publishOutputs.siteAssets,
    });
    expect(
      readFileSync("dist/site-artifacts/docs/artifact-generator/index.html", "utf8"),
    ).toContain("docs");
    expect(readFileSync("dist/site-artifacts/docs/artifact-generator/index.pdf", "utf8")).toContain(
      "%PDF-1.4",
    );
    expect(
      JSON.parse(readFileSync("dist/site-artifacts/manifests/project-artifacts.json", "utf8")) as {
        projects: { example: { docsPdfPath: string } };
      },
    ).toEqual({
      projects: {
        example: { docsPath: "docs/example/index.html", docsPdfPath: "docs/example/index.pdf" },
      },
    });
    expect(
      readFileSync("dist/site-artifacts/diagrams/example/example-overview.svg", "utf8"),
    ).toContain("example");
    expect(existsSync("dist/site-artifacts/diagrams/example/example-overview.mmd")).toBe(false);
    expect(existsSync("dist/site-artifacts/manifests/content-manifest.json")).toBe(true);
    expect(existsSync("dist/site-artifacts/profile/profile.md")).toBe(true);
    expect(existsSync("dist/site-artifacts/projects/example.md")).toBe(true);
    expect(existsSync("dist/site-artifacts/projects/.local-metadata")).toBe(false);
    expect(existsSync("dist/site-artifacts/projects/example/coverage/index.html")).toBe(false);
    expect(existsSync("dist/site-artifacts/coverage/index.html")).toBe(true);
    expect(existsSync("dist/site-artifacts/projects/artifact-generator/coverage/index.html")).toBe(
      true,
    );
    expect(existsSync("dist/site-assets/icons/example/mark.svg")).toBe(true);
    expect(existsSync("dist/site-assets/resume/example.pdf")).toBe(true);
  });

  test("requires the rendered docs preview before publishing", () => {
    writeFixtureFile(`${sourceInputDirs.manifests}/content-manifest.json`, "{}");
    writeFixtureFile(`${sourceInputDirs.profile}/profile.md`, "---\n{}\n---");
    writeFixtureFile(`${sourceInputDirs.projects}/example.md`, "---\n{}\n---");
    writeFixtureFile(`${sourceInputDirs.icons}/example/mark.svg`, "<svg>icon</svg>");
    writeFixtureFile(`${sourceInputDirs.resume}/example.pdf`, "%PDF-1.4");

    expect(() => assembleSiteArtifacts()).toThrow("Missing publish input: dist/docs-preview");
  });

  test("can place a rendered docs preview under a selected project slug", () => {
    writeFixtureFile("dist/docs-preview/index.html", "<html>docs</html>");
    writeFixtureFile(`${sourceInputDirs.manifests}/content-manifest.json`, "{}");
    writeFixtureFile(
      `${sourceInputDirs.manifests}/project-artifacts.json`,
      JSON.stringify({ projects: { example: { docsPath: "docs/example/index.html" } } }),
    );
    writeFixtureFile(`${sourceInputDirs.profile}/profile.md`, "---\n{}\n---");
    writeFixtureFile(`${sourceInputDirs.projects}/example.md`, "---\n{}\n---");
    writeFixtureFile(`${sourceInputDirs.icons}/example/mark.svg`, "<svg>icon</svg>");
    writeFixtureFile(`${sourceInputDirs.resume}/example.pdf`, "%PDF-1.4");

    assembleSiteArtifacts({ docsProject: "example" });

    expect(readFileSync("dist/site-artifacts/docs/example/index.html", "utf8")).toContain("docs");
  });
});

/**
 * @param path - Fixture file path.
 * @param content - Fixture file contents.
 */
function writeFixtureFile(path: string, content: string): void {
  const directory = path.split("/").slice(0, -1).join("/");

  if (directory) {
    mkdirSync(directory, { recursive: true });
  }

  writeFileSync(path, content);
}
