import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { artifactPath } from "../core/artifact-path.ts";
import { jsonObject, readProjectManifest } from "./project-manifest.ts";
import { parseFrontmatter } from "./frontmatter.ts";
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
  const metadata = jsonObject(document.metadata, `Project ${slug}`);
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
  const social = jsonObject(sourceJson(manifest.profile.socialLinksPath), "Social links");
  const timeline = jsonObject(sourceJson(manifest.profile.experiencePath), "Experience");
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
