import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { createIsolatedSourceInputs } from "../resources/isolated-source-inputs.ts";

const originalCwd = process.cwd();
const isolatedSourceInputs = createIsolatedSourceInputs();
process.chdir(isolatedSourceInputs.workspace);
const { artifactPaths, sourceInputDirs, sourceInputRoot } =
  await import("../../scripts/core/script-constants.ts");
const {
  docSectionTitle,
  docLinkLabel,
  findMarkdownDocs,
  getDocRoots,
  groupDocsByProject,
  isOverviewDoc,
  localMarkdownTargetId,
  markdownSourcePath,
  orderedDocGroups,
  orderedDocSections,
  orderedDocsForArtifact,
} = await import("../../scripts/docs/docs-utils.ts");
const { buildDocsArtifact, compileMarkdownBlocks } =
  await import("../../scripts/docs/document-artifact.ts");
const { buildSiteContentArtifact } = await import("../../scripts/content/build-site-content.ts");
const {
  compileProjectArtifactManifest,
  assembleSiteArtifacts,
  cleanPublishOutputs,
  copyRenderedDiagrams,
  copyDocsArtifact,
  publishOutputs,
} = await import("../../scripts/publish/assemble-site-artifacts.ts");
process.chdir(originalCwd);

if (sourceInputRoot !== isolatedSourceInputs.sourceInputRoot) {
  throw new Error(`Source input test root was not isolated: ${sourceInputRoot}`);
}

describe("native project artifacts", () => {
  afterEach(() => {
    isolatedSourceInputs.reset(sourceInputRoot);
    removeWorkspacePath("coverage");
    removeWorkspacePath("dist");
    removeWorkspacePath("CHANGELOG.md");
    removeWorkspacePath("package.json");
    removeWorkspacePath("README.md");
    removeWorkspacePath("temp.md");
  });

  afterAll(() => isolatedSourceInputs.dispose());

  test("discovers ordered project docs and preserves semantic local targets", () => {
    seedProjectInputs();

    const docs = inWorkspace(() =>
      findMarkdownDocs([join(sourceInputDirs.docs, "artifact-generator")]),
    );
    const knownIds = new Map(docs.map((doc) => [doc.input, doc.id]));
    const overview = docs.find((doc) => doc.input.endsWith("artifact-generator-overview.md"));

    expect(docs.map((doc) => doc.input)).toEqual([
      "docs/artifact-generator/artifact-generator-overview.md",
      "docs/artifact-generator/api.md",
    ]);
    expect(overview && docLinkLabel(overview)).toBe("Overview");
    expect(orderedDocGroups(docs).map(([group]) => group)).toEqual(["artifact-generator"]);
    expect(orderedDocSections(docs).map((section) => section.title)).toEqual([
      "Artifact Generator",
    ]);
    expect(orderedDocsForArtifact(docs).map((doc) => doc.id)).toEqual(docs.map((doc) => doc.id));
    expect(overview && localMarkdownTargetId(overview, "api.md#contract", knownIds)).toBe(
      "doc-docs-artifact-generator-api-md",
    );
    expect(
      overview && localMarkdownTargetId(overview, "https://example.test/api.md", knownIds),
    ).toBeNull();
  });

  test("supports explicit doc roots, nested navigation, and rich Markdown blocks", () => {
    seedProjectInputs();
    writeSource(
      "artifacts/docs/artifact-generator/nested/guide.md",
      "# Guide\n\nNested documentation.\n",
    );
    writeSource("artifacts/docs/artifact-generator/dist/ignored.md", "# Ignored\n");
    writeSource(
      "artifacts/docs/pipeline.md",
      "<!-- artifact-generator:version=1.7.4 lastUpdated=2026-08-27 -->\n# Pipeline\n",
    );
    writeSource(
      "artifacts/docs/cipher/cipher-overview.md",
      "<!-- artifact-generator:version=1.7.4 lastUpdated=2026-08-27 -->\n# Cipher\n",
    );
    writeSource("artifacts/diagrams/notes.md", "# Diagram notes\n");
    const externalDoc = workspacePath("manual/external.md");
    writeWorkspaceFile(
      "manual/external.md",
      "<!-- artifact-generator:version=1.7.4 lastUpdated=2026-08-27 -->\n# External\n",
    );
    const ignoredDoc = workspacePath("temp.md");
    writeWorkspaceFile("temp.md", "# Ignored\n");
    const rootDoc = workspacePath("README.md");
    writeWorkspaceFile(
      "README.md",
      "<!-- artifact-generator:version=1.7.4 lastUpdated=2026-08-27 -->\n# Root\n",
    );

    const roots = inWorkspace(() =>
      getDocRoots([
        "artifact-generator",
        "--artifact-generator",
        join(sourceInputDirs.docs, "artifact-generator", "api.md"),
        join(sourceInputDirs.docs, "cipher"),
        externalDoc,
        ignoredDoc,
        rootDoc,
      ]),
    );
    const docs = inWorkspace(() => findMarkdownDocs(roots));
    const blocks = compileMarkdownBlocks(
      [
        "# Rich `heading`",
        "",
        "**strong** and *emphasis*  ",
        "next line with [external](https://example.test) and ![image](mark.svg).",
        "",
        "> Quoted text.",
        "",
        "1. First",
        "2. Second",
        "",
        "| Name | Value |",
        "| --- | --- |",
        "| Artifact | Ready |",
        "",
        "---",
        "",
        "```ts",
        "const ready = true;",
        "```",
      ].join("\n"),
      { id: "rich", input: "docs/artifact-generator/rich.md", project: "artifact-generator" },
    );

    expect(roots).toContain(join(sourceInputDirs.docs, "artifact-generator"));
    expect(roots).toContain(externalDoc);
    expect(inWorkspace(() => getDocRoots(["docs/artifact-generator", "missing-project"]))).toEqual([
      join(sourceInputDirs.docs, "artifact-generator"),
      join(sourceInputDirs.docs, "missing-project"),
    ]);
    expect(docs.map((doc) => doc.input)).toContain("docs/artifact-generator/nested/guide.md");
    expect(docs.map((doc) => doc.input)).toContain("docs/pipeline.md");
    expect(docs.map((doc) => doc.input)).not.toContain("temp.md");
    expect(docs.map((doc) => doc.input)).not.toContain("docs/artifact-generator/dist/ignored.md");
    expect(isOverviewDoc("docs\\artifact-generator\\artifact-generator-overview.md")).toBe(true);
    expect(docSectionTitle({ id: "root", input: "README.md", project: "root" })).toBe("Root");
    expect(
      docSectionTitle({ id: "shared", input: "docs/pipeline.md", project: "general-docs" }),
    ).toBe("General Docs");
    expect(
      markdownSourcePath({
        id: "cached",
        input: "docs/api.md",
        project: "artifact-generator",
        sourcePath: "tmp/api.md",
      }),
    ).toBe("tmp/api.md");
    expect([...groupDocsByProject(docs).keys()]).toContain("artifact-generator");
    expect(orderedDocGroups(docs).map(([group]) => group)).toEqual([
      "artifact-generator",
      "cipher",
      "manual",
      "root",
      "general-docs",
    ]);
    expect(JSON.stringify(blocks)).toContain('"type":"quote"');
    expect(JSON.stringify(blocks)).toContain('"type":"table"');
    expect(JSON.stringify(blocks)).toContain('"type":"list"');
    expect(JSON.stringify(blocks)).toContain('"type":"rule"');
    expect(JSON.stringify(blocks)).toContain('"type":"strong"');
    expect(JSON.stringify(blocks)).toContain('"type":"emphasis"');
    expect(JSON.stringify(blocks)).toContain('"type":"code"');
    expect(
      inWorkspace(() => findMarkdownDocs([join(sourceInputDirs.diagrams, "notes.md")])).map(
        (doc) => doc.input,
      ),
    ).toEqual(["diagrams/notes.md"]);

    writeSource("artifacts/manifests/project-artifacts.json", "not JSON");
    expect(orderedDocGroups(docs).map(([group]) => group)).toContain("artifact-generator");
  });

  test("compiles docs into native Markdown pages, navigation metadata, and a PDF", async () => {
    seedProjectInputs();

    const output = await inWorkspaceAsync(() => buildDocsArtifact("artifact-generator"));
    const outputDirectory = workspacePath(output);
    const index = JSON.parse(readFileSync(join(outputDirectory, "index.json"), "utf8")) as {
      pages: Array<{ id: string; path: string; sourcePath: string; title: string }>;
      schemaVersion: number;
      title: string;
    };

    expect(index).toMatchObject({ schemaVersion: 2, title: "Artifact Generator" });
    expect(index.pages).toMatchObject([
      {
        id: "doc-docs-artifact-generator-artifact-generator-overview-md",
        path: "pages/doc-docs-artifact-generator-artifact-generator-overview-md.md",
        sourcePath: "docs/artifact-generator/artifact-generator-overview.md",
        title: "Overview",
      },
      {
        id: "doc-docs-artifact-generator-api-md",
        path: "pages/doc-docs-artifact-generator-api-md.md",
        sourcePath: "docs/artifact-generator/api.md",
        title: "API",
      },
    ]);
    expect(readFileSync(join(outputDirectory, index.pages[0]!.path), "utf8")).toContain(
      "Native artifacts",
    );
    expect(readFileSync(join(outputDirectory, "docs.pdf")).subarray(0, 4).toString()).toBe("%PDF");

    await expect(inWorkspaceAsync(() => buildDocsArtifact("unknown"))).rejects.toThrow(
      "Unknown docs project",
    );
  });

  test("compiles source frontmatter into ordered public site content", () => {
    seedProjectInputs();
    const output = join(isolatedSourceInputs.workspace, "content", "site.json");

    expect(inWorkspace(() => buildSiteContentArtifact(output))).toBe(output);

    const content = JSON.parse(readFileSync(output, "utf8")) as {
      lastUpdated?: string;
      projects: Array<{ notes: unknown[]; slug: string; title: string }>;
      schemaVersion: number;
    };
    expect(content).toMatchObject({ lastUpdated: "2026-08-27", schemaVersion: 2 });
    expect(content.projects.map((project) => project.slug)).toEqual([
      "artifact-generator",
      "cipher",
    ]);
    expect(content.projects[0]?.notes).toHaveLength(2);

    writeSource("artifacts/projects/cipher.md", "Not frontmatter");
    expect(() => inWorkspace(() => buildSiteContentArtifact(output))).toThrow(
      "Expected JSON frontmatter",
    );
  });

  test("assembles only native resources and keeps application coverage project-owned", async () => {
    expect(inWorkspace(() => copyRenderedDiagrams())).toBe(0);
    seedProjectInputs();
    await inWorkspaceAsync(() => buildDocsArtifact("artifact-generator"));
    inWorkspace(() => buildSiteContentArtifact());
    writeWorkspaceFile(join(artifactPaths.coverageDir, "index.json"), '{"schemaVersion":2}\n');
    writeWorkspaceFile(join(artifactPaths.coverageDir, "coverage.pdf"), "%PDF-1.4\n");
    writeWorkspaceFile(
      join("dist", "changelog", "artifact-generator", "CHANGELOG.md"),
      "# Changelog\n",
    );
    writeWorkspaceFile(
      join("dist", "changelog", "artifact-generator", "changelog.pdf"),
      "%PDF-1.4\n",
    );
    writeWorkspaceFile(artifactPaths.resumePdf, "%PDF-1.4\n");

    const assembled = inWorkspace(() => assembleSiteArtifacts());
    const publicManifest = JSON.parse(
      readFileSync(
        workspacePath(join(publishOutputs.siteArtifacts, "manifests", "content-manifest.json")),
        "utf8",
      ),
    ) as Record<string, unknown>;
    const projectManifest = JSON.parse(
      readFileSync(
        workspacePath(join(publishOutputs.siteArtifacts, "manifests", "project-artifacts.json")),
        "utf8",
      ),
    ) as {
      projects: {
        "artifact-generator": {
          changelog: { markdownPath: string; pdfPath: string };
          coverage: { indexPath: string; pdfPath: string };
          diagrams: Array<{ overview?: boolean; svgPath: string }>;
          docs: { indexPath: string; pdfPath: string };
        };
      };
      schemaVersion: number;
    };

    expect(assembled).toMatchObject({ diagramCount: 1 });
    expect(
      existsSync(
        workspacePath(
          join(publishOutputs.siteArtifacts, "docs", "artifact-generator", "index.json"),
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        workspacePath(
          join(
            publishOutputs.siteArtifacts,
            "projects",
            "artifact-generator",
            "coverage",
            "index.json",
          ),
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        workspacePath(
          join(
            publishOutputs.siteArtifacts,
            "projects",
            "artifact-generator",
            "changelog",
            "CHANGELOG.md",
          ),
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(workspacePath(join(publishOutputs.siteAssets, "icons", "artifact-generator.svg"))),
    ).toBe(true);
    expect(publicManifest.profile).toBeUndefined();
    expect(projectManifest).toMatchObject({
      projects: {
        "artifact-generator": {
          changelog: {
            markdownPath: "projects/artifact-generator/changelog/CHANGELOG.md",
            pdfPath: "projects/artifact-generator/changelog/changelog.pdf",
          },
          coverage: {
            indexPath: "projects/artifact-generator/coverage/index.json",
            pdfPath: "projects/artifact-generator/coverage/coverage.pdf",
          },
          diagrams: [
            {
              overview: true,
              svgPath:
                "diagrams/artifact-generator/artifact-generator-overview-v1.7.4-2026-08-27.svg",
            },
          ],
          docs: {
            indexPath: "docs/artifact-generator/index.json",
            pdfPath: "docs/artifact-generator/docs.pdf",
          },
        },
      },
      schemaVersion: 2,
    });

    inWorkspace(() => cleanPublishOutputs());
    removeWorkspacePath("dist/docs-artifacts");
    expect(() => inWorkspace(() => copyDocsArtifact())).toThrow("Missing publish input");
    expect(inWorkspace(() => copyRenderedDiagrams())).toBe(1);

    const invalidManifest = workspacePath("invalid-project-artifacts.json");
    writeWorkspaceFile(
      "invalid-project-artifacts.json",
      JSON.stringify({
        projects: {
          cipher: {
            diagramPaths: ["notpaths/artifact-generator/artifact-generator-overview.svg"],
            iconPath: "asset://icons/cipher/mark.svg",
          },
        },
      }),
    );
    expect(() => inWorkspace(() => compileProjectArtifactManifest(invalidManifest))).toThrow(
      "requires at least one diagram",
    );
  });
});

function inWorkspace<T>(action: () => T): T {
  const cwd = process.cwd();
  process.chdir(isolatedSourceInputs.workspace);

  try {
    return action();
  } finally {
    process.chdir(cwd);
  }
}

async function inWorkspaceAsync<T>(action: () => Promise<T>): Promise<T> {
  const cwd = process.cwd();
  process.chdir(isolatedSourceInputs.workspace);

  try {
    return await action();
  } finally {
    process.chdir(cwd);
  }
}

function seedProjectInputs(): void {
  writeSource(
    "artifacts/manifests/content-manifest.json",
    JSON.stringify(
      {
        featuredWork: [{ slug: "artifact-generator" }],
        lastUpdated: "2026-08-27",
        profile: {
          experiencePath: "profile/experience.md",
          navigationPath: "profile/navigation.md",
          profilePath: "profile/profile.md",
          skillsPath: "profile/skills.md",
          socialLinksPath: "profile/social.md",
        },
      },
      null,
      2,
    ),
  );
  writeSource(
    "artifacts/manifests/project-artifacts.json",
    JSON.stringify(
      {
        projects: {
          "artifact-generator": {
            diagramPaths: ["diagrams/artifact-generator/artifact-generator-overview.svg"],
            iconPath: "asset://icons/artifact-generator/mark.svg",
            overviewDiagramPath: "diagrams/artifact-generator/artifact-generator-overview.svg",
          },
          cipher: {
            diagramPaths: ["diagrams/cipher/cipher-overview.svg"],
            iconPath: "asset://icons/cipher/mark.svg",
            overviewDiagramPath: "diagrams/cipher/cipher-overview.svg",
          },
        },
      },
      null,
      2,
    ),
  );
  writeSource("artifacts/profile/profile.md", frontmatter({ name: "Connor Hunter" }));
  writeSource(
    "artifacts/profile/navigation.md",
    frontmatter([{ href: "/projects", label: "Projects" }]),
  );
  writeSource(
    "artifacts/profile/experience.md",
    frontmatter({ certifications: [], education: [], experience: [] }),
  );
  writeSource("artifacts/profile/skills.md", frontmatter([{ label: "TypeScript" }]));
  writeSource(
    "artifacts/profile/social.md",
    frontmatter({ contacts: [{ label: "Email" }], resume: { href: "/resume.pdf" } }),
  );
  writeSource(
    "artifacts/projects/artifact-generator.md",
    frontmatter(
      {
        architecture: "Native artifacts",
        downloads: [],
        kind: "web",
        links: [],
        order: 1,
        problem: "Avoid browser viewers.",
        stack: ["Bun"],
        status: "active",
        summary: "Artifact compiler",
        title: "Artifact Generator",
      },
      "# Artifact Generator\n\nPublish [Cipher](cipher.md).",
    ),
  );
  writeSource(
    "artifacts/projects/cipher.md",
    frontmatter(
      {
        architecture: "Client-owned encryption",
        downloads: [],
        kind: "desktop",
        links: [],
        order: 2,
        problem: "Keep messages private.",
        stack: ["Rust"],
        status: "active",
        summary: "Private messaging",
        title: "Cipher",
      },
      "# Cipher\n\nDesktop messaging.",
    ),
  );
  writeSource(
    "artifacts/docs/artifact-generator/document-metadata.json",
    `${JSON.stringify({ lastUpdated: "2026-08-27", version: "1.7.4" }, null, 2)}\n`,
  );
  writeSource(
    "artifacts/docs/artifact-generator/artifact-generator-overview.md",
    "# Native artifacts\n\nRead the [API](api.md) and inspect the [diagram](artifact-generator-overview.mmd).\n",
  );
  writeSource(
    "artifacts/docs/artifact-generator/api.md",
    [
      "# API",
      "",
      "> Direct readers keep content portable.",
      "",
      "- JSON index",
      "- Markdown page",
      "",
      "| Resource | Format |",
      "| --- | --- |",
      "| Docs | Markdown |",
      "",
      "```ts",
      "const artifact = true;",
      "```",
      "",
      "<!-- omitted from PDF text -->",
    ].join("\n"),
  );
  writeSource(
    "artifacts/diagrams/artifact-generator/artifact-generator-overview.mmd",
    "%% artifact-generator:version=1.7.4 lastUpdated=2026-08-27\nflowchart LR\n  A --> B\n",
  );
  writeSource(
    "artifacts/diagrams/artifact-generator/artifact-generator-overview-v1.7.4-2026-08-27.svg",
    '<svg viewBox="0 0 100 100" />\n',
  );
  writeSource(
    "artifacts/diagrams/cipher/cipher-overview.mmd",
    "%% artifact-generator:version=1.7.4 lastUpdated=2026-08-27\nflowchart LR\n  A --> B\n",
  );
  writeSource("assets/icons/artifact-generator.svg", '<svg viewBox="0 0 1 1" />\n');
}

function frontmatter(metadata: unknown, body = ""): string {
  return `---\n${JSON.stringify(metadata, null, 2)}\n---\n${body}\n`;
}

function writeSource(path: string, value: string): void {
  const target = join(sourceInputRoot, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, value);
}

function writeWorkspaceFile(path: string, value: string): void {
  const target = workspacePath(path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, value);
}

function workspacePath(path: string): string {
  return resolve(isolatedSourceInputs.workspace, path);
}

function removeWorkspacePath(path: string): void {
  const target = resolve(isolatedSourceInputs.workspace, path);

  if (relative(isolatedSourceInputs.workspace, target).startsWith("..")) {
    throw new Error(`Refusing to remove a path outside the test workspace: ${target}`);
  }

  rmSync(target, { force: true, recursive: true });
}
