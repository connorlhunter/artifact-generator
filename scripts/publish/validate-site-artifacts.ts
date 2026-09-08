import { readFileSync, realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { artifactPath } from "../core/artifact-path.ts";
import {
  validateArtifactVersion,
  validateUpdatedDate,
} from "../core/versioned-artifact-metadata.ts";
import { jsonObject, readJsonObject, readProjectManifest } from "../content/project-manifest.ts";

function file(root: string, path: unknown): string {
  const resolved = artifactPath(root, path);
  const realRoot = realpathSync(root);
  const realFile = realpathSync(resolved);
  if (!realFile.startsWith(`${realRoot}${sep}`) || !statSync(realFile).isFile()) {
    throw new Error(`Invalid published file: ${resolved}`);
  }
  return resolved;
}

function pdf(root: string, path: unknown): void {
  const resolved = file(root, path);
  if (readFileSync(resolved).subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error(`Invalid published PDF: ${resolved}`);
  }
}

function array(value: unknown, subject: string): unknown[] {
  if (!Array.isArray(value) || !value.length)
    throw new Error(`${subject} must be a non-empty array.`);
  return value;
}

function text(value: unknown, subject: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${subject} must be a non-empty string.`);
  return value;
}

function metadata(value: Record<string, unknown>, subject: string): void {
  validateArtifactVersion(text(value.version, `${subject} version`), subject);
  validateUpdatedDate(text(value.lastUpdated, `${subject} lastUpdated`), subject);
}

function schemaVersion(value: Record<string, unknown>, subject: string): void {
  if (value.schemaVersion !== 2) throw new Error(`${subject} requires schemaVersion 2.`);
}

function docs(root: string, reference: unknown, slug: string): void {
  const resource = jsonObject(reference, `${slug} docs`);
  const indexPath = file(root, resource.indexPath);
  const index = readJsonObject(indexPath);
  schemaVersion(index, indexPath);
  text(index.title, `${slug} docs title`);
  const ids = new Set<string>();
  for (const value of array(index.pages, `${slug} docs pages`)) {
    const page = jsonObject(value, `${slug} docs page`);
    const id = text(page.id, `${slug} document ID`);
    if (ids.has(id)) throw new Error(`Duplicate document ID: ${slug}/${id}`);
    ids.add(id);
    metadata(page, `${slug}/${id}`);
    text(page.title, `${slug}/${id} title`);
    text(page.sourcePath, `${slug}/${id} source path`);
    const path = text(page.path, `${slug}/${id} path`);
    if (!path.endsWith(".md")) throw new Error(`Document path must be Markdown: ${path}`);
    const directory = resolve(indexPath, "..");
    const content = readFileSync(file(directory, path), "utf8");
    if (!content.trim()) throw new Error(`Empty published document: ${slug}/${id}`);
  }
  pdf(root, resource.pdfPath);
}

function diagrams(root: string, reference: unknown, slug: string): void {
  const ids = new Set<string>();
  for (const value of array(reference, `${slug} diagrams`)) {
    const diagram = jsonObject(value, `${slug} diagram`);
    const id = text(diagram.id, `${slug} diagram ID`);
    if (ids.has(id)) throw new Error(`Duplicate diagram ID: ${slug}/${id}`);
    ids.add(id);
    metadata(diagram, `${slug}/${id}`);
    text(diagram.title, `${slug}/${id} title`);
    const svg = readFileSync(file(root, diagram.svgPath), "utf8");
    if (
      !svg.includes("<svg") ||
      !svg.includes(`data-artifact-version="${diagram.version}"`) ||
      !svg.includes(`data-artifact-last-updated="${diagram.lastUpdated}"`)
    ) {
      throw new Error(`Diagram metadata differs from its SVG: ${slug}/${id}`);
    }
  }
}

function reports(root: string, project: Record<string, unknown>, slug: string): void {
  const coverage = jsonObject(project.coverage, `${slug} coverage`);
  const changelog = jsonObject(project.changelog, `${slug} changelog`);
  for (const [kind, value] of [
    ["coverage", coverage.indexPath],
    ["coverage", coverage.pdfPath],
    ["changelog", changelog.markdownPath],
    ["changelog", changelog.pdfPath],
  ]) {
    const path = text(value, `${slug} ${kind} path`);
    if (!path.startsWith(`projects/${slug}/${kind}/`))
      throw new Error(`Report path belongs to another project: ${path}`);
    artifactPath(root, path);
  }
  if (slug !== "artifact-generator") return;
  schemaVersion(readJsonObject(file(root, coverage.indexPath)), "coverage");
  pdf(root, coverage.pdfPath);
  file(root, changelog.markdownPath);
  pdf(root, changelog.pdfPath);
}

/** Verifies complete local bundles before a publish can delete objects from their S3 roots. */
export function validateSiteArtifacts(artifactsRoot: string, assetsRoot: string): void {
  const manifest = readJsonObject(file(artifactsRoot, "manifests/content-manifest.json"));
  schemaVersion(manifest, "Content manifest");
  const projectPath = file(artifactsRoot, manifest.projectsManifestPath);
  schemaVersion(readJsonObject(projectPath), "Project manifest");
  const projects = readProjectManifest(projectPath);
  const content = readJsonObject(file(artifactsRoot, manifest.siteContentPath));
  schemaVersion(content, "Site content");
  const contentSlugs = array(content.projects, "Site projects").map((project) =>
    text(jsonObject(project, "Site project").slug, "Project slug"),
  );
  if (JSON.stringify([...contentSlugs].sort()) !== JSON.stringify(Object.keys(projects).sort())) {
    throw new Error("Site content and project manifest contain different projects.");
  }
  for (const [slug, project] of Object.entries(projects)) {
    docs(artifactsRoot, project.docs, slug);
    diagrams(artifactsRoot, project.diagrams, slug);
    reports(artifactsRoot, project, slug);
    const icon = text(project.iconPath, `${slug} icon`);
    if (icon.startsWith("asset://")) file(assetsRoot, icon.slice("asset://".length));
    else if (!/^https?:$/u.test(new URL(icon).protocol))
      throw new Error(`Invalid project icon: ${slug}`);
  }
  pdf(assetsRoot, "resume/connor-hunter-resume.pdf");
}
