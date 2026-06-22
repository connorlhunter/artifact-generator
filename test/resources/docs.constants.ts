import { join } from "node:path";

export const testResourcesRoot = join("test", "resources");
export const repoFixtureRoot = join(testResourcesRoot, "repo-fixture");
export const repoFixtureDocsRoot = "docs-fixture";
export const repoFixtureEmptyRoot = "empty-fixture";
export const repoFixtureProjectName = "artifact-generator";
export const diagramsFixtureRoot = join(testResourcesRoot, "diagrams-fixture");
export const missingPreviewPath = join(testResourcesRoot, "missing-preview.html");
export const existingPreviewPath = join(testResourcesRoot, "existing-preview.html");

export const markdownPaths = {
  rootReadme: "README.md",
  fixtureDocsIndex: join("docs-fixture", "index.md"),
  fixtureNestedGuide: join("docs-fixture", "nested", "guide.md"),
  fixtureProjectOverview: join("docs", repoFixtureProjectName, "artifact-generator-overview.md"),
  fixtureSharedScriptOverview: join("docs", "script-overview.md"),
};

export const diagramPaths = {
  projectOverview: join(diagramsFixtureRoot, "project", "project-overview.mmd"),
  projectDiagram: join(diagramsFixtureRoot, "project", "flow.mmd"),
  nestedDiagram: join(diagramsFixtureRoot, "project", "nested", "sequence.mmd"),
};

export const renderedDiagramPaths = {
  key: join(diagramsFixtureRoot, "diagram-style-key.svg"),
  overview: join(diagramsFixtureRoot, "project", "project-overview.svg"),
  detail: join(diagramsFixtureRoot, "project", "flow.svg"),
};

export const commandFixture = {
  executable: process.execPath,
  successArgs: ["-e", "process.stdout.write('ok'); process.stderr.write('warn');"],
  failureArgs: [
    "-e",
    "process.stdout.write('bad'); process.stderr.write('fail'); process.exit(2);",
  ],
};
