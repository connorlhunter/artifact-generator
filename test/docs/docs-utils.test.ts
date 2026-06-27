import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  docId,
  docGroupTitle,
  docLinkLabel,
  docsPreviewTitle,
  docSectionTitle,
  findMarkdownDocs,
  getDocRoots,
  groupDocsByProject,
  isOverviewDoc,
  localMarkdownTargetId,
  localMermaidTargetHref,
  normalizeRepoPath,
  orderedDocsForPreview,
  orderedDocGroups,
  orderedDocSections,
  primaryProjectIconAsset,
  projectIconAsset,
  projectIconAssetsForDocs,
} from "../../scripts/docs/docs-utils.ts";
import { sourceInputDirs, sourceInputRoot } from "../../scripts/core/script-constants.ts";
import {
  diagramPaths,
  existingPreviewPath,
  markdownPaths,
  repoFixtureDocsRoot,
  repoFixtureProjectName,
  repoFixtureRoot,
} from "../resources/docs.constants.ts";

const originalCwd = process.cwd();
const repoFixturePath = resolve(originalCwd, repoFixtureRoot);
const fixtureIndexDoc = {
  id: docId(markdownPaths.fixtureDocsIndex),
  input: markdownPaths.fixtureDocsIndex,
  project: "docs-fixture",
};
const fixtureNestedDoc = {
  id: docId(markdownPaths.fixtureNestedGuide),
  input: markdownPaths.fixtureNestedGuide,
  project: "docs-fixture",
};
const fixtureMarkdownDocs = [fixtureIndexDoc, fixtureNestedDoc];

describe("docs utils", () => {
  beforeEach(() => {
    rmSync(sourceInputRoot, { force: true, recursive: true });
    process.chdir(repoFixturePath);
    copyFixtureFile(
      "icons/docs-fixture/mark.svg",
      `${sourceInputDirs.icons}/docs-fixture/mark.svg`,
    );
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(resolve(repoFixturePath, "dist"), { force: true, recursive: true });
    rmSync(resolve(repoFixturePath, "tmp"), { force: true, recursive: true });
    rmSync(sourceInputRoot, { force: true, recursive: true });
  });

  test("discovers markdown docs from the selected source root", () => {
    const docs = findMarkdownDocs([repoFixtureDocsRoot]);
    const inputs = docs.map((doc) => doc.input);

    expect(inputs[0]).toBe(markdownPaths.fixtureDocsIndex);
    expect(inputs).toEqual(
      expect.arrayContaining([markdownPaths.fixtureDocsIndex, markdownPaths.fixtureNestedGuide]),
    );
  });

  test("maps S3 source-cache docs to logical artifact paths", () => {
    const sourcePath = `${sourceInputDirs.docs}/${repoFixtureProjectName}/artifact-generator-overview.md`;
    const logicalPath = `docs/${repoFixtureProjectName}/artifact-generator-overview.md`;

    copyFixtureFile(markdownPaths.fixtureProjectOverview, sourcePath);

    const docs = findMarkdownDocs([`${sourceInputDirs.docs}/${repoFixtureProjectName}`]);

    expect(docs).toEqual([
      {
        id: docId(logicalPath),
        input: logicalPath,
        project: repoFixtureProjectName,
        sourcePath: normalizeRepoPath(sourcePath),
      },
    ]);
    expect(docs[0]?.input).not.toContain("artifact-generator-source-cache");
  });

  test("includes root pipeline docs only with Artifact Generator", () => {
    const artifactGeneratorRoot = `${sourceInputDirs.docs}/artifact-generator`;
    const cipherRoot = `${sourceInputDirs.docs}/cipher`;
    const sharedDoc = `${sourceInputDirs.docs}/script-overview.md`;

    copyFixtureFile(markdownPaths.fixtureProjectOverview, sharedDoc);
    copyFixtureFile(markdownPaths.fixtureProjectOverview, `${artifactGeneratorRoot}/overview.md`);
    copyFixtureFile(markdownPaths.fixtureProjectOverview, `${cipherRoot}/overview.md`);

    expect(findMarkdownDocs([artifactGeneratorRoot]).map((doc) => doc.input)).toContain(
      "docs/script-overview.md",
    );
    expect(findMarkdownDocs([cipherRoot]).map((doc) => doc.input)).not.toContain(
      "docs/script-overview.md",
    );
  });

  test("normalizes paths, ids, roots, groups, and local markdown targets", () => {
    const idsByPath = new Map(fixtureMarkdownDocs.map((doc) => [doc.input, doc.id]));

    expect(getDocRoots([`--${repoFixtureProjectName}`, "--missing-root"])).toEqual([
      `${sourceInputDirs.docs}/${repoFixtureProjectName}`,
      `${sourceInputDirs.docs}/missing-root`,
    ]);
    expect(getDocRoots([])).toEqual([]);
    expect(getDocRoots(["."])).toEqual([]);
    expect(normalizeRepoPath(markdownPaths.fixtureNestedGuide)).toBe(
      markdownPaths.fixtureNestedGuide,
    );
    expect(docId(markdownPaths.fixtureNestedGuide)).toBe(fixtureNestedDoc.id);
    expect(
      isOverviewDoc(`docs/${repoFixtureProjectName}/${repoFixtureProjectName}-overview.md`),
    ).toBe(true);
    expect(isOverviewDoc(`docs/${repoFixtureProjectName}/api.md`)).toBe(false);
    expect(isOverviewDoc("docs/script-overview.md")).toBe(false);
    expect(docGroupTitle("example-project")).toBe("Example Project");
    expect(
      docSectionTitle({
        id: "doc-docs-artifact-generator-auth-model-md",
        input: `docs/${repoFixtureProjectName}/auth/model.md`,
        project: repoFixtureProjectName,
      }),
    ).toBe("Artifact Generator Auth");
    expect(
      docSectionTitle({
        id: "doc-docs-script-overview-md",
        input: markdownPaths.fixtureSharedScriptOverview,
        project: "general-docs",
      }),
    ).toBe("General Docs");
    expect(
      docSectionTitle({
        id: fixtureIndexDoc.id,
        input: markdownPaths.fixtureDocsIndex,
        project: "docs-fixture",
      }),
    ).toBe("Docs Fixture");
    expect(
      docLinkLabel({
        id: "doc-docs-artifact-generator-artifact-generator-overview-md",
        input: markdownPaths.fixtureProjectOverview,
        project: repoFixtureProjectName,
      }),
    ).toBe("Overview");
    expect(
      docLinkLabel({
        id: "doc-docs-artifact-generator-api-md",
        input: `docs/${repoFixtureProjectName}/api.md`,
        project: repoFixtureProjectName,
      }),
    ).toBe("API");
    expect([...groupDocsByProject(fixtureMarkdownDocs).keys()]).toEqual(["docs-fixture"]);
    expect(projectIconAsset("docs-fixture")).toEqual({
      href: "icons/docs-fixture/mark.svg",
      project: "docs-fixture",
      source: normalizeRepoPath(`${sourceInputDirs.icons}/docs-fixture/mark.svg`),
      target: "dist/docs-preview/icons/docs-fixture/mark.svg",
    });
    expect(projectIconAsset("general-docs")).toBeNull();
    expect(projectIconAsset("root")).toBeNull();
    expect(projectIconAsset("test")).toBeNull();
    expect(projectIconAssetsForDocs(fixtureMarkdownDocs)).toEqual([
      {
        href: "icons/docs-fixture/mark.svg",
        project: "docs-fixture",
        source: normalizeRepoPath(`${sourceInputDirs.icons}/docs-fixture/mark.svg`),
        target: "dist/docs-preview/icons/docs-fixture/mark.svg",
      },
    ]);
    expect(primaryProjectIconAsset(fixtureMarkdownDocs)?.project).toBe("docs-fixture");
    expect(docsPreviewTitle(fixtureMarkdownDocs)).toBe("Docs Fixture");
    expect(
      docsPreviewTitle([
        {
          id: "doc-docs-artifact-generator-artifact-generator-overview-md",
          input: "docs/artifact-generator/artifact-generator-overview.md",
          project: "artifact-generator",
        },
      ]),
    ).toBe("Artifact Generator");
    expect(
      docsPreviewTitle([
        {
          id: "doc-cipher-overview-md",
          input: "docs/cipher/cipher-overview.md",
          project: "cipher",
        },
        {
          id: "doc-docs-artifact-generator-artifact-generator-overview-md",
          input: "docs/artifact-generator/artifact-generator-overview.md",
          project: "artifact-generator",
        },
      ]),
    ).toBe("Project Documentation");
    expect(
      docsPreviewTitle([
        {
          id: "doc-root",
          input: "README.md",
          project: "root",
        },
      ]),
    ).toBe("Documentation Preview");
    expect(
      orderedDocGroups([
        {
          id: "doc-docs-artifact-generator-artifact-generator-overview-md",
          input: markdownPaths.fixtureProjectOverview,
          project: repoFixtureProjectName,
        },
        {
          id: "doc-root",
          input: "README.md",
          project: "root",
        },
        {
          id: "doc-diagram-directions-md",
          input: "diagram-directions.md",
          project: "root",
        },
        {
          id: "doc-ledger-ledger-overview-md",
          input: "docs/ledger/ledger-overview.md",
          project: "ledger",
        },
        {
          id: "doc-docs-script-overview-md",
          input: markdownPaths.fixtureSharedScriptOverview,
          project: "general-docs",
        },
        {
          id: "doc-external-md",
          input: "external.md",
          project: "external",
        },
      ]).map(([project]) => project),
    ).toEqual(["artifact-generator", "ledger", "external", "root", "general-docs"]);
    mkdirSync(sourceInputDirs.manifests, { recursive: true });
    writeFileSync(
      `${sourceInputDirs.manifests}/project-artifacts.json`,
      JSON.stringify({
        projects: {
          "connor-hunter": {},
          "artifact-generator": {},
          cipher: {},
          "cipher-pay": {},
        },
      }),
    );
    expect(
      orderedDocGroups([
        {
          id: "doc-cipher-pay-overview-md",
          input: "docs/cipher-pay/cipher-pay-overview.md",
          project: "cipher-pay",
        },
        {
          id: "doc-docs-artifact-generator-artifact-generator-overview-md",
          input: "docs/artifact-generator/artifact-generator-overview.md",
          project: "artifact-generator",
        },
        {
          id: "doc-cipher-overview-md",
          input: "docs/cipher/cipher-overview.md",
          project: "cipher",
        },
        {
          id: "doc-connor-hunter-overview-md",
          input: "docs/connor-hunter/connor-hunter-overview.md",
          project: "connor-hunter",
        },
      ]).map(([project]) => project),
    ).toEqual(["connor-hunter", "artifact-generator", "cipher", "cipher-pay"]);
    expect(
      orderedDocsForPreview([
        {
          id: "doc-docs-artifact-generator-artifact-generator-overview-md",
          input: markdownPaths.fixtureProjectOverview,
          project: repoFixtureProjectName,
        },
        {
          id: "doc-root",
          input: "README.md",
          project: "root",
        },
        {
          id: "doc-docs-script-overview-md",
          input: markdownPaths.fixtureSharedScriptOverview,
          project: "general-docs",
        },
      ]).map((doc) => doc.input),
    ).toEqual([
      markdownPaths.fixtureProjectOverview,
      "README.md",
      markdownPaths.fixtureSharedScriptOverview,
    ]);
    expect(
      orderedDocGroups(findMarkdownDocs([markdownPaths.fixtureProjectOverview])).map(
        ([project]) => project,
      ),
    ).toEqual(["artifact-generator"]);
    expect(
      findMarkdownDocs([markdownPaths.fixtureProjectOverview]).map((doc) => doc.input),
    ).toEqual([markdownPaths.fixtureProjectOverview]);
    expect(
      groupDocsByProject(findMarkdownDocs([`docs/${repoFixtureProjectName}`]))
        .get(repoFixtureProjectName)
        ?.map((doc) => doc.input)[0],
    ).toBe(`docs/${repoFixtureProjectName}/${repoFixtureProjectName}-overview.md`);
    expect(
      orderedDocGroups(findMarkdownDocs([markdownPaths.fixtureSharedScriptOverview])).map(
        ([project]) => project,
      ),
    ).toEqual(["general-docs"]);
    expect(
      orderedDocSections([
        {
          id: "doc-docs-artifact-generator-auth-model-md",
          input: `docs/${repoFixtureProjectName}/auth/model.md`,
          project: repoFixtureProjectName,
        },
        {
          id: "doc-docs-artifact-generator-auth-roles-md",
          input: `docs/${repoFixtureProjectName}/auth/roles.md`,
          project: repoFixtureProjectName,
        },
        {
          id: "doc-docs-artifact-generator-services-media-s3-md",
          input: `docs/${repoFixtureProjectName}/services/media/s3.md`,
          project: repoFixtureProjectName,
        },
      ]),
    ).toEqual([
      {
        title: "Artifact Generator Auth",
        docs: [
          {
            id: "doc-docs-artifact-generator-auth-model-md",
            input: `docs/${repoFixtureProjectName}/auth/model.md`,
            project: repoFixtureProjectName,
          },
          {
            id: "doc-docs-artifact-generator-auth-roles-md",
            input: `docs/${repoFixtureProjectName}/auth/roles.md`,
            project: repoFixtureProjectName,
          },
        ],
      },
      {
        title: "Artifact Generator Services Media",
        docs: [
          {
            id: "doc-docs-artifact-generator-services-media-s3-md",
            input: `docs/${repoFixtureProjectName}/services/media/s3.md`,
            project: repoFixtureProjectName,
          },
        ],
      },
    ]);
    expect(localMarkdownTargetId(fixtureIndexDoc, "./nested/guide.md", idsByPath)).toBe(
      fixtureNestedDoc.id,
    );
    expect(localMermaidTargetHref(fixtureIndexDoc, "../diagrams/diagram-style-key.mmd")).toBe(
      "diagrams/diagram-style-key.html",
    );
    process.chdir(originalCwd);
    expect(localMermaidTargetHref(fixtureIndexDoc, `../${diagramPaths.projectDiagram}`)).toBe(
      diagramPaths.projectDiagram.replace(/\.mmd$/, ".html"),
    );
    process.chdir(repoFixturePath);
    expect(localMermaidTargetHref(fixtureIndexDoc, "./missing.mmd")).toBeNull();
    expect(localMermaidTargetHref(fixtureIndexDoc, "https://example.com/chart.mmd")).toBeNull();
    expect(localMermaidTargetHref(fixtureIndexDoc, "#diagram")).toBeNull();
    expect(localMermaidTargetHref(fixtureIndexDoc, "./nested/guide.md")).toBeNull();
    expect(localMarkdownTargetId(fixtureIndexDoc, "https://example.com", idsByPath)).toBeNull();
    expect(localMarkdownTargetId(fixtureIndexDoc, "#anchor", idsByPath)).toBeNull();
    expect(findMarkdownDocs([markdownPaths.fixtureDocsIndex]).map((doc) => doc.input)).toEqual([
      markdownPaths.fixtureDocsIndex,
    ]);
    expect(localMarkdownTargetId(fixtureIndexDoc, "./missing.md", idsByPath)).toBeNull();
    expect(localMarkdownTargetId(fixtureIndexDoc, "", idsByPath)).toBeNull();
    expect(
      findMarkdownDocs([resolve(originalCwd, existingPreviewPath)]).map((doc) => doc.input),
    ).toEqual([]);
    expect(findMarkdownDocs()).toEqual([]);

    expect(getDocRoots([])).toEqual([]);
  });
});

/**
 * @param source - Existing fixture source path.
 * @param target - Staged fixture target path.
 */
function copyFixtureFile(source: string, target: string): void {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
