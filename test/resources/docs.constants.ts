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
  key: join(diagramsFixtureRoot, "diagram-style-key.mmd"),
  projectOverview: join(diagramsFixtureRoot, "project", "project-overview.mmd"),
  projectDiagram: join(diagramsFixtureRoot, "project", "flow.mmd"),
  nestedDiagram: join(diagramsFixtureRoot, "project", "nested", "sequence.mmd"),
};

export const diagramMetadata = {
  key: { lastUpdated: "2026-08-18", version: "1.0.0" },
  projectOverview: { lastUpdated: "2026-08-17", version: "2.1.0" },
  projectDiagram: { lastUpdated: "2026-02-28", version: "1.4.2" },
  nestedDiagram: { lastUpdated: "2024-02-29", version: "0.3.0" },
} as const;

export const diagramOutputPaths = {
  key: join(diagramsFixtureRoot, "diagram-style-key-v1.0.0-2026-08-18.svg"),
  projectOverview: join(diagramsFixtureRoot, "project", "project-overview-v2.1.0-2026-08-17.svg"),
  projectDiagram: join(diagramsFixtureRoot, "project", "flow-v1.4.2-2026-02-28.svg"),
  nestedDiagram: join(diagramsFixtureRoot, "project", "nested", "sequence-v0.3.0-2024-02-29.svg"),
};

export const renderedDiagramPaths = {
  key: diagramOutputPaths.key,
  overview: diagramOutputPaths.projectOverview,
  detail: diagramOutputPaths.projectDiagram,
};

export const commandFixture = {
  executable: process.execPath,
  successArgs: ["-e", "process.stdout.write('ok'); process.stderr.write('warn');"],
  failureArgs: [
    "-e",
    "process.stdout.write('bad'); process.stderr.write('fail'); process.exit(2);",
  ],
};
