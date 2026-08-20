import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createIsolatedSourceInputs } from "../resources/isolated-source-inputs.ts";

const originalCwd = process.cwd();
const isolatedSourceInputs = createIsolatedSourceInputs();
process.chdir(isolatedSourceInputs.workspace);
const { artifactPaths, sourceInputDirs, sourceInputRoot } =
  await import("../../scripts/core/script-constants.ts");
const { assembleSiteArtifacts, publishOutputs } =
  await import("../../scripts/publish/assemble-site-artifacts.ts");
process.chdir(originalCwd);

if (sourceInputRoot !== isolatedSourceInputs.sourceInputRoot) {
  throw new Error(`Source input test root was not isolated: ${sourceInputRoot}`);
}

describe("assemble site artifacts", () => {
  let tempDir = "";

  beforeEach(() => {
    isolatedSourceInputs.reset(sourceInputRoot);
    tempDir = mkdtempSync(join(tmpdir(), "artifact-publish-"));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { force: true, recursive: true });
    isolatedSourceInputs.reset(sourceInputRoot);
  });

  afterAll(() => isolatedSourceInputs.dispose());

  test("copies generated docs, diagrams, content, icons, and resume assets", () => {
    writeFixtureFile("dist/docs-preview/index.html", "<html>docs</html>");
    writeFixtureFile("dist/docs-preview/index.pdf", "%PDF-1.4");
    writeFixtureFile(
      `${sourceInputDirs.diagrams}/diagram-style-key-v1.0.0-2026-08-18.svg`,
      "<svg>key</svg>",
    );
    writeFixtureFile(
      `${sourceInputDirs.diagrams}/example/example-overview-v2.1.0-2026-08-17.svg`,
      "<svg>example</svg>",
    );
    writeFixtureFile(
      `${sourceInputDirs.diagrams}/example/example-overview.svg`,
      "<svg>legacy</svg>",
    );
    writeFixtureFile(
      `${sourceInputDirs.diagrams}/example/example-overview.mmd`,
      "%% artifact-generator:version=2.1.0 lastUpdated=2026-08-17\nflowchart TD",
    );
    writeFixtureFile(
      `${sourceInputDirs.manifests}/content-manifest.json`,
      JSON.stringify({ lastUpdated: "1999-12-31" }),
    );
    writeFixtureFile(
      `${sourceInputDirs.manifests}/project-artifacts.json`,
      JSON.stringify({
        projects: {
          example: {
            diagramPaths: ["diagrams/example/example-overview.svg"],
            docsPath: "docs/example/index.html",
            overviewDiagramPath: "diagrams/example/example-overview.svg",
          },
          "artifact-generator": {
            coveragePath: "projects/artifact-generator/coverage/index.html",
            docsPath: "docs/artifact-generator/index.html",
          },
        },
      }),
    );
    writeFixtureFile(`${sourceInputDirs.profile}/profile.md`, "---\n{}\n---");
    writeFixtureFile(`${sourceInputDirs.projects}/example.md`, "---\n{}\n---");
    writeFixtureFile(`${sourceInputDirs.projects}/.local-metadata`, "junk");
    writeFixtureFile(
      `${sourceInputDirs.projects}/example/coverage/index.html`,
      "<html>app coverage</html>",
    );
    writeFixtureFile("coverage/index.html", "<html>coverage</html>");
    writeFixtureFile("coverage/index.pdf", "%PDF-1.4");
    writeFixtureFile(`${sourceInputDirs.icons}/example/mark.svg`, "<svg>icon</svg>");
    writeFixtureFile(artifactPaths.resumePdf, "%PDF-1.4");

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
        projects: { example: { docsPath: string; docsPdfPath: string } };
      },
    ).toMatchObject({
      projects: {
        example: {
          diagramPaths: ["diagrams/example/example-overview-v2.1.0-2026-08-17.svg"],
          docsPath: "docs/example/index.html",
          docsPdfPath: "docs/example/index.pdf",
          overviewDiagramPath: "diagrams/example/example-overview-v2.1.0-2026-08-17.svg",
        },
      },
    });
    expect(
      readFileSync(
        "dist/site-artifacts/diagrams/example/example-overview-v2.1.0-2026-08-17.svg",
        "utf8",
      ),
    ).toContain("example");
    expect(existsSync("dist/site-artifacts/diagrams/example/example-overview.svg")).toBe(false);
    expect(existsSync("dist/site-artifacts/diagrams/example/example-overview.mmd")).toBe(false);
    expect(
      JSON.parse(readFileSync("dist/site-artifacts/manifests/content-manifest.json", "utf8")),
    ).toEqual({ lastUpdated: "1999-12-31" });
    expect(existsSync("dist/site-artifacts/profile/profile.md")).toBe(true);
    expect(existsSync("dist/site-artifacts/projects/example.md")).toBe(true);
    expect(existsSync("dist/site-artifacts/projects/.local-metadata")).toBe(false);
    expect(existsSync("dist/site-artifacts/projects/example/coverage/index.html")).toBe(false);
    expect(existsSync("dist/site-artifacts/coverage")).toBe(false);
    expect(existsSync("dist/site-artifacts/projects/artifact-generator/coverage/index.html")).toBe(
      true,
    );
    expect(existsSync("dist/site-artifacts/projects/artifact-generator/coverage/index.pdf")).toBe(
      true,
    );
    expect(
      JSON.parse(readFileSync("dist/site-artifacts/manifests/project-artifacts.json", "utf8")),
    ).toMatchObject({
      projects: {
        "artifact-generator": {
          coveragePdfPath: "projects/artifact-generator/coverage/index.pdf",
          coveragePages: [
            {
              id: "typescript",
              label: "TypeScript",
              path: "projects/artifact-generator/coverage/index.html",
              pdfPath: "projects/artifact-generator/coverage/index.pdf",
            },
          ],
        },
      },
    });
    expect(existsSync("dist/site-assets/icons/example/mark.svg")).toBe(true);
    expect(existsSync("dist/site-assets/resume/connor-hunter-resume.pdf")).toBe(true);
  });

  test("requires the rendered docs preview before publishing", () => {
    writeFixtureFile(`${sourceInputDirs.manifests}/content-manifest.json`, "{}");
    writeFixtureFile(`${sourceInputDirs.profile}/profile.md`, "---\n{}\n---");
    writeFixtureFile(`${sourceInputDirs.projects}/example.md`, "---\n{}\n---");
    writeFixtureFile(`${sourceInputDirs.icons}/example/mark.svg`, "<svg>icon</svg>");
    writeFixtureFile(artifactPaths.resumePdf, "%PDF-1.4");

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
    writeFixtureFile(artifactPaths.resumePdf, "%PDF-1.4");

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
