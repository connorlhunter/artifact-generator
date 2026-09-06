import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { artifactPath } from "../core/artifact-path.ts";
import { readProjectManifest } from "./project-manifest.ts";
import { sourceInputDirs } from "../core/script-constants.ts";
import { compileMarkdownBlocks } from "../docs/markdown-document.ts";
import type { DocumentBlock } from "./document-model.ts";
import type { MarkdownDoc } from "../docs/docs-utils.ts";

interface ContentManifestSource {
  readonly featuredWork?: unknown;
  readonly lastUpdated?: string;
  readonly profile: {
    readonly experiencePath: string;
    readonly navigationPath: string;
    readonly profilePath: string;
    readonly skillsPath: string;
    readonly socialLinksPath: string;
  };
}

interface ProjectContent {
  readonly architecture: string;
  readonly downloads: unknown;
  readonly kind: string;
  readonly links: unknown;
  readonly notes: ReadonlyArray<DocumentBlock>;
  readonly order: number;
  readonly problem: string;
  readonly slug: string;
  readonly stack: unknown;
  readonly status: string;
  readonly summary: string;
  readonly title: string;
}

/** Public, compiled source content loaded by the Portfolio. */
export interface SiteContentArtifact {
  readonly certifications: unknown;
  readonly contacts: unknown;
  readonly education: unknown;
  readonly experience: unknown;
  readonly featuredWork?: unknown;
  readonly lastUpdated?: string;
  readonly navigation: unknown;
  readonly profile: unknown;
  readonly projects: ReadonlyArray<ProjectContent>;
  readonly resume: unknown;
  readonly schemaVersion: 2;
  readonly skills: unknown;
}

const frontmatterPattern = /^---\s*\n(?<json>[\s\S]*?)\n---\s*\n?(?<body>[\s\S]*)$/u;

function parseFrontmatter(raw: string): { readonly body: string; readonly metadata: unknown } {
  const match = frontmatterPattern.exec(raw);
  if (!match?.groups?.json || match.groups.body === undefined) {
    throw new Error("Expected JSON frontmatter delimited by ---.");
  }

  return {
    body: match.groups.body.trim(),
    metadata: JSON.parse(match.groups.json.replace(/,\s*([}\]])/gu, "$1")),
  };
}

function sourcePath(path: string): string {
  return artifactPath(sourceInputDirs.artifacts, path);
}

function sourceJson(path: string): unknown {
  return parseFrontmatter(readFileSync(sourcePath(path), "utf8")).metadata;
}

function projectContent(slug: string): ProjectContent {
  const document = parseFrontmatter(
    readFileSync(join(sourceInputDirs.projects, `${slug}.md`), "utf8"),
  );
  const metadata = document.metadata as Record<string, unknown>;
  const doc: MarkdownDoc = {
    id: `project-${slug}`,
    input: `projects/${slug}.md`,
    project: slug,
  };

  return {
    architecture: String(metadata.architecture ?? ""),
    downloads: metadata.downloads ?? [],
    kind: String(metadata.kind ?? "web"),
    links: metadata.links ?? [],
    notes: compileMarkdownBlocks(document.body, doc),
    order: Number(metadata.order ?? 0),
    problem: String(metadata.problem ?? ""),
    slug,
    stack: metadata.stack ?? [],
    status: String(metadata.status ?? ""),
    summary: String(metadata.summary ?? ""),
    title: String(metadata.title ?? slug),
  };
}

/** Compiles source Markdown and frontmatter into one public site data payload. */
export function buildSiteContentArtifact(
  output = join("dist", "site-content", "content", "site.json"),
): string {
  const manifest = JSON.parse(
    readFileSync(join(sourceInputDirs.manifests, "content-manifest.json"), "utf8"),
  ) as ContentManifestSource;
  const projects = readProjectManifest(join(sourceInputDirs.manifests, "project-artifacts.json"));
  const social = sourceJson(manifest.profile.socialLinksPath) as Record<string, unknown>;
  const timeline = sourceJson(manifest.profile.experiencePath) as Record<string, unknown>;
  const content: SiteContentArtifact = {
    certifications: timeline.certifications ?? [],
    contacts: social.contacts ?? [],
    education: timeline.education ?? [],
    experience: timeline.experience ?? [],
    ...(manifest.featuredWork ? { featuredWork: manifest.featuredWork } : {}),
    ...(manifest.lastUpdated ? { lastUpdated: manifest.lastUpdated } : {}),
    navigation: sourceJson(manifest.profile.navigationPath),
    profile: sourceJson(manifest.profile.profilePath),
    projects: Object.keys(projects)
      .map(projectContent)
      .sort((left, right) => left.order - right.order),
    resume: social.resume ?? {},
    schemaVersion: 2,
    skills: sourceJson(manifest.profile.skillsPath),
  };

  rmSync(dirname(output), { force: true, recursive: true });
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(content, null, 2)}\n`);

  return output;
}

if (import.meta.main) {
  try {
    console.log(`Built site content: ${buildSiteContentArtifact()}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
