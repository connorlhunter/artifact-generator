import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export function createPublishFixture(root: string): { artifacts: string; assets: string } {
  const artifacts = join(root, "artifacts");
  const assets = join(root, "assets");
  function write(base: string, path: string, content: string | object) {
    const target = join(base, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, typeof content === "string" ? content : JSON.stringify(content));
  }
  const projects: Record<string, unknown> = {};
  for (const slug of ["artifact-generator", "external-project"]) {
    const metadata = { lastUpdated: "2026-09-05", version: "1.0.0" };
    const svgPath = `diagrams/${slug}/overview.svg`;
    projects[slug] = {
      docs: { indexPath: `docs/${slug}/index.json`, pdfPath: `docs/${slug}/docs.pdf` },
      diagrams: [{ id: "overview", title: "Overview", svgPath, ...metadata }],
      coverage: {
        indexPath: `projects/${slug}/coverage/index.json`,
        pdfPath: `projects/${slug}/coverage/coverage.pdf`,
      },
      changelog: {
        markdownPath: `projects/${slug}/changelog/CHANGELOG.md`,
        pdfPath: `projects/${slug}/changelog/changelog.pdf`,
      },
      iconPath: `asset://icons/${slug}.svg`,
    };
    write(artifacts, `docs/${slug}/index.json`, {
      schemaVersion: 2,
      title: slug,
      pages: [
        {
          id: "overview",
          path: "pages/overview.md",
          sourcePath: `docs/${slug}/overview.md`,
          section: slug,
          title: "Overview",
          ...metadata,
        },
      ],
    });
    write(artifacts, `docs/${slug}/pages/overview.md`, "# Overview\n\nProject documentation.");
    write(artifacts, `docs/${slug}/docs.pdf`, "%PDF-1.7 fixture");
    write(
      artifacts,
      svgPath,
      '<svg data-artifact-version="1.0.0" data-artifact-last-updated="2026-09-05"></svg>',
    );
    write(assets, `icons/${slug}.svg`, "<svg></svg>");
  }
  write(artifacts, "projects/artifact-generator/coverage/index.json", { schemaVersion: 2 });
  write(artifacts, "projects/artifact-generator/coverage/coverage.pdf", "%PDF-1.7 fixture");
  write(artifacts, "projects/artifact-generator/changelog/CHANGELOG.md", "# Changelog\n\n## 1.0.0");
  write(artifacts, "projects/artifact-generator/changelog/changelog.pdf", "%PDF-1.7 fixture");
  write(artifacts, "manifests/content-manifest.json", {
    schemaVersion: 2,
    projectsManifestPath: "manifests/project-artifacts.json",
    siteContentPath: "content/site.json",
  });
  write(artifacts, "manifests/project-artifacts.json", { schemaVersion: 2, projects });
  write(artifacts, "content/site.json", {
    schemaVersion: 2,
    projects: Object.keys(projects).map((slug) => ({ slug })),
  });
  write(assets, "resume/connor-hunter-resume.pdf", "%PDF-1.7 fixture");
  return { artifacts, assets };
}
