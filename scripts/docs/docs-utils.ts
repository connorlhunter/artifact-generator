import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { artifactPaths, repoDirs, sourceInputDirs } from "../core/script-constants.ts";
import { formatDocLabel, formatDocSectionTitle } from "./docs-labels.ts";

/**
 * Markdown document discovered for the docs preview.
 */
export interface MarkdownDoc {
  /**
   * Stable HTML section id derived from the input path.
   */
  id: string;
  /**
   * Logical Markdown input path used in generated preview UI and source links.
   */
  input: string;
  /**
   * Logical project group used in preview navigation.
   */
  project: string;
  /**
   * Local cache path read after source inputs are synced from S3.
   */
  sourcePath?: string;
}

/**
 * Ordered project group and its Markdown documents.
 */
export type MarkdownDocGroup = [string, MarkdownDoc[]];

/**
 * Navigation section inside a Markdown project group.
 */
export interface MarkdownDocSection {
  /**
   * Section title.
   */
  title: string;
  /**
   * Markdown documents that belong to the section.
   */
  docs: MarkdownDoc[];
}

/**
 * Rendered SVG asset required by the generated docs preview.
 */
export interface MermaidPreviewAsset {
  /**
   * Href written into the docs preview HTML.
   */
  href: string;
  /**
   * Generated diagram viewer HTML path.
   */
  pageTarget: string;
  /**
   * Optional project icon used by the generated diagram viewer tab.
   */
  projectIcon: ProjectIconPreviewAsset | null;
  /**
   * Repo-relative rendered SVG source path.
   */
  source: string;
  /**
   * Href to the copied SVG from the docs preview index.
   */
  svgHref: string;
  /**
   * Preview-output SVG path.
   */
  target: string;
  /**
   * Diagram title.
   */
  title: string;
}

/**
 * Project icon asset required by the generated docs preview.
 */
export interface ProjectIconPreviewAsset {
  /**
   * Href written into the preview HTML.
   */
  href: string;
  /**
   * Project group this icon belongs to.
   */
  project: string;
  /**
   * Repo-relative project icon source path.
   */
  source: string;
  /**
   * Preview-output icon path.
   */
  target: string;
}

/**
 * Generated Markdown preview HTML path.
 */
export const docsPreviewOutput = artifactPaths.docsPreview;

const docsRoot = sourceInputDirs.docs;
const logicalDocsRoot = repoDirs.docs;
const artifactGeneratorProject = "artifact-generator";
const generalDocsProject = "general-docs";
const rootProject = "root";
const projectIconFile = "mark.svg";
const nonProjectIconGroups = new Set([rootProject, generalDocsProject, repoDirs.test]);
const priorityDocGroups = new Map([
  [rootProject, 9000],
  [generalDocsProject, 9001],
  [repoDirs.test, 9002],
]);
const ignoredDirs = new Set([".git", repoDirs.coverage, repoDirs.dist, repoDirs.nodeModules]);
const ignoredFiles = new Set(["temp.md"]);
const overviewDocSuffix = "-overview.md";
const projectManifestPath = join(sourceInputDirs.manifests, "project-artifacts.json");

/**
 * Returns true when a path exists and is a directory.
 *
 * @param {string} p - Path to inspect.
 * @returns {boolean} Whether the path is an existing directory.
 */
/* istanbul ignore next */
function isDirectory(p: string): boolean {
  return existsSync(p) && statSync(p).isDirectory();
}

/**
 * Normalizes a CLI docs root argument.
 *
 * @param {string} arg - Raw CLI argument.
 * @returns {string} Root path without leading dashes.
 */
function normalizeRootArg(arg: string): string {
  return arg.replace(/^--/, "");
}

/**
 * Resolves project shorthand to the documentation project folder.
 *
 * @param {string} root - Requested docs root.
 * @returns {string} Existing docs root or the original root.
 */
function resolveDocRoot(root: string): string {
  const normalizedRoot = normalizeRepoPath(root);
  const projectDocsRoot = join(docsRoot, root);
  if (!root.includes("/") && isDirectory(projectDocsRoot)) return projectDocsRoot;
  if (root === ".") return root;
  if (normalizedRoot === logicalDocsRoot) return docsRoot;
  if (normalizedRoot.startsWith(`${logicalDocsRoot}/`)) {
    return join(docsRoot, normalizedRoot.slice(logicalDocsRoot.length + 1));
  }
  if (root.includes("/") && isDirectory(root)) return root;
  if (root.includes("/") && isMarkdownFile(root)) return root;

  return isDirectory(root) || isMarkdownFile(root) ? root : projectDocsRoot;
}

/**
 * Removes duplicate strings while preserving first-seen order.
 *
 * @param {string[]} values - Values to dedupe.
 * @returns {string[]} Unique values.
 */
function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Returns true when a root would scan every repository doc.
 *
 * @param {string} root - Resolved root path.
 * @returns {boolean} Whether the root should be rejected.
 */
function isAllDocsRoot(root: string): boolean {
  const normalized = normalizeRepoPath(root).replace(/\/$/, "");
  return (
    normalized === "" ||
    normalized === "." ||
    normalized === docsRoot ||
    normalized === logicalDocsRoot
  );
}

/**
 * Returns true when a document is an overview document.
 *
 * Overview docs use the `<project-name>-overview.md` naming convention and
 * should be shown before detail docs inside their project group.
 *
 * @param {string} input - Markdown source path.
 * @returns {boolean} Whether the input is an overview doc.
 */
export function isOverviewDoc(input: string): boolean {
  const normalized = input.replaceAll("\\", "/");
  const parts = normalized.split("/");
  const fileName = parts.at(-1);
  const parentFolder = parts.at(-2);

  return fileName === `${parentFolder}${overviewDocSuffix}`;
}

/**
 * Sorts overview docs before detail docs without hardcoding project names.
 *
 * @param {string[]} paths - Markdown paths to sort.
 * @returns {string[]} Sorted Markdown paths.
 */
function sortMarkdownPaths(paths: string[]): string[] {
  return [...paths].sort((left, right) => {
    const leftOverview = isOverviewDoc(left);
    const rightOverview = isOverviewDoc(right);

    if (leftOverview && !rightOverview) return -1;
    /* istanbul ignore next -- Sort comparator call direction is engine-dependent. */
    if (!leftOverview && rightOverview) return 1;

    return left.localeCompare(right);
  });
}

/**
 * Returns true when a path exists and is a Markdown file.
 *
 * @param {string} p - Path to inspect.
 * @returns {boolean} Whether the path is an existing Markdown file.
 */
/* istanbul ignore next */
function isMarkdownFile(p: string): boolean {
  return existsSync(p) && statSync(p).isFile() && p.endsWith(".md");
}

/**
 * Finds direct Markdown children of one directory without scanning nested
 * project folders.
 *
 * @param {string} dir - Directory to inspect.
 * @returns {string[]} Repo-relative Markdown files in that directory.
 */
/* istanbul ignore next */
function directMarkdownFiles(dir: string): string[] {
  if (!isDirectory(dir)) return [];

  return readdirSync(dir)
    .map((entry) => join(dir, entry))
    .filter(isMarkdownFile)
    .map(normalizeRepoPath);
}

/**
 * Returns root-level pipeline docs for the Artifact Generator preview.
 *
 * @param {string[]} roots - Resolved docs roots selected for this preview.
 * @returns {string[]} Shared Markdown paths that exist in this checkout.
 */
function sharedPreviewDocs(roots: string[]): string[] {
  const artifactGeneratorRoot = normalizeAbsolutePath(join(docsRoot, artifactGeneratorProject));
  const includesArtifactGenerator = roots.some(
    (root) => normalizeAbsolutePath(root) === artifactGeneratorRoot,
  );

  return includesArtifactGenerator ? directMarkdownFiles(docsRoot) : [];
}

/**
 * Reads required documentation project paths from command-line args.
 *
 * @param {string[]} args - CLI args after the script name.
 * @returns {string[]} Project paths to scan.
 */
export function getDocRoots(args: string[]): string[] {
  return uniqueStrings(
    args
      .map(normalizeRootArg)
      .filter(Boolean)
      .map(resolveDocRoot)
      .filter((root) => !isAllDocsRoot(root)),
  );
}

/**
 * Recursively finds Markdown files below a directory.
 *
 * @param {string} dir - Directory to scan.
 * @param {string[]} files - Accumulator used by recursive calls.
 * @returns {string[]} Markdown file paths.
 */
/* istanbul ignore next */
function walkMarkdown(dir: string, files: string[] = []): string[] {
  const rootStats = statSync(dir);

  if (rootStats.isFile()) {
    if (dir.endsWith(".md")) files.push(normalizeRepoPath(dir));
    return files;
  }

  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue;

    const p = join(dir, entry);
    const stats = statSync(p);

    if (stats.isDirectory()) {
      walkMarkdown(p, files);
      continue;
    }

    if (stats.isFile() && p.endsWith(".md")) files.push(normalizeRepoPath(p));
  }

  return files;
}

/**
 * Normalizes a path to a repo-relative path with forward slashes.
 *
 * @param {string} p - Path to normalize.
 * @returns {string} Repo-relative path.
 */
export function normalizeRepoPath(p: string): string {
  return relative(".", p).replaceAll("\\", "/");
}

/**
 * Normalizes a path to an absolute forward-slash path for robust cache-root comparisons.
 *
 * @param p - Absolute or current-working-directory-relative path.
 * @returns Absolute normalized path.
 */
function normalizeAbsolutePath(p: string): string {
  return resolve(p).replaceAll("\\", "/");
}

/**
 * Returns the path below a source cache root.
 *
 * @param p - Candidate source path.
 * @param root - Source cache root.
 * @returns Root-relative path, or null when the path is outside the root.
 */
function sourceRootRelativePath(p: string, root: string): string | null {
  const absolutePath = normalizeAbsolutePath(p);
  const absoluteRoot = normalizeAbsolutePath(root);

  if (absolutePath === absoluteRoot) return "";
  if (!absolutePath.startsWith(`${absoluteRoot}/`)) return null;

  return absolutePath.slice(absoluteRoot.length + 1);
}

/**
 * Returns true when a Markdown file should be omitted from docs preview.
 *
 * @param {string} p - Repo-relative Markdown path.
 * @returns {boolean} Whether the file should be omitted.
 */
function isIgnoredMarkdownFile(p: string): boolean {
  return ignoredFiles.has(logicalArtifactPath(p));
}

/**
 * Converts a Markdown path to a stable HTML anchor id.
 *
 * @param {string} p - Repo-relative Markdown path.
 * @returns {string} Stable document id.
 */
export function docId(p: string): string {
  return `doc-${p
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()}`;
}

/**
 * Returns the sidebar group title.
 *
 * @param {string} group - Internal docs group name.
 * @returns {string} Display group title.
 */
export function docGroupTitle(group: string): string {
  return formatDocLabel(group);
}

/**
 * Returns the sidebar section title for a document.
 *
 * Section titles are based on folder nesting. Project docs include the project
 * name, then nested folder names such as "Auth" or "Services Gateway".
 *
 * @param {MarkdownDoc} doc - Markdown document metadata.
 * @returns {string} Display section title.
 */
export function docSectionTitle(doc: MarkdownDoc): string {
  if (!doc.input.includes("/")) return docGroupTitle(rootProject);

  const parts = doc.input.split("/");

  if (parts[0] === logicalDocsRoot) {
    const docsSegments = parts.slice(1, -1);
    return docsSegments.length > 0
      ? formatDocSectionTitle(docsSegments)
      : docGroupTitle(generalDocsProject);
  }

  return formatDocSectionTitle(parts.slice(0, -1));
}

/**
 * Returns the sidebar link label for a document.
 *
 * @param {MarkdownDoc} doc - Markdown document metadata.
 * @returns {string} Display link label.
 */
export function docLinkLabel(doc: MarkdownDoc): string {
  const name = basename(doc.input, ".md");
  return isOverviewDoc(doc.input) ? "Overview" : formatDocLabel(name);
}

/**
 * Extracts the top-level project/root name from a Markdown path.
 *
 * @param {string} p - Repo-relative Markdown path.
 * @returns {string} Project or root group name.
 */
/* istanbul ignore next */
function getProject(p: string): string {
  if (!p.includes("/")) return rootProject;

  const docsProject = docsProjectName(p);
  if (docsProject) return docsProject;
  if (p.split("/")[0] === logicalDocsRoot) return generalDocsProject;

  return p.split("/")[0] ?? "root";
}

/**
 * Extracts a project name from docs/<project>/ paths.
 *
 * @param {string} p - Repo-relative Markdown path.
 * @returns {string | null} Project name when the path is inside project docs.
 */
function docsProjectName(p: string): string | null {
  const parts = p.split("/");
  if (parts[0] !== logicalDocsRoot || parts.length < 3) return null;

  return parts[1] as string;
}

/**
 * Builds one Markdown doc record from an input path.
 *
 * @param {string} input - Repo-relative Markdown path.
 * @returns {MarkdownDoc} Markdown doc metadata.
 */
function markdownDoc(sourcePath: string): MarkdownDoc {
  const normalizedSourcePath = normalizeRepoPath(sourcePath);
  const input = logicalArtifactPath(sourcePath);
  const doc: MarkdownDoc = {
    id: docId(input),
    input,
    project: getProject(input),
  };

  if (normalizedSourcePath !== input) doc.sourcePath = normalizedSourcePath;

  return doc;
}

/**
 * Finds Markdown docs under selected roots.
 *
 * @param {string[]} roots - Directories to scan.
 * @returns {MarkdownDoc[]} Markdown docs for preview rendering.
 */
export function findMarkdownDocs(roots: string[] = []): MarkdownDoc[] {
  if (roots.length === 0) return [];

  const scannedDocs = roots
    .flatMap((root) => walkMarkdown(root))
    .filter((p) => !isIgnoredMarkdownFile(p));

  const docsByInput = new Map<string, MarkdownDoc>();

  for (const path of uniqueStrings([...sharedPreviewDocs(roots), ...scannedDocs])) {
    const doc = markdownDoc(path);
    if (!docsByInput.has(doc.input)) docsByInput.set(doc.input, doc);
  }

  return sortMarkdownPaths([...docsByInput.keys()]).map((input) => docsByInput.get(input)!);
}

/**
 * Groups Markdown docs by their top-level project/root name.
 *
 * @param {MarkdownDoc[]} docs - Markdown docs to group.
 * @returns {Map<string, MarkdownDoc[]>} Docs grouped by project.
 */
export function groupDocsByProject(docs: MarkdownDoc[]): Map<string, MarkdownDoc[]> {
  const groups = new Map<string, MarkdownDoc[]>();

  for (const doc of docs) {
    const group = groups.get(doc.project);

    if (group) {
      group.push(doc);
      continue;
    }

    groups.set(doc.project, [doc]);
  }

  return groups;
}

/**
 * Returns true when a docs group is backed by `docs/<project>/` files.
 *
 * @param {string} group - Docs group name.
 * @param {MarkdownDoc[]} docs - Markdown docs inside the group.
 * @returns {boolean} Whether the group is a project docs group.
 */
function isProjectGroup(group: string, docs: MarkdownDoc[]): boolean {
  return docs.some((doc) => doc.input.startsWith(`${logicalDocsRoot}/${group}/`));
}

/**
 * Returns a stable priority for docs sidebar groups.
 *
 * @param {string} group - Docs group name.
 * @param {MarkdownDoc[]} docs - Markdown docs inside the group.
 * @returns {number} Group priority.
 */
function projectManifestOrder(): Map<string, number> {
  if (!existsSync(projectManifestPath)) return new Map();

  try {
    const manifest = JSON.parse(readFileSync(projectManifestPath, "utf8")) as {
      readonly projects?: Record<string, unknown>;
    };
    return new Map(Object.keys(manifest.projects ?? {}).map((project, index) => [project, index]));
  } catch {
    return new Map();
  }
}

function docGroupPriority(
  group: string,
  docs: MarkdownDoc[],
  manifestOrder: ReadonlyMap<string, number>,
): number {
  if (!isProjectGroup(group, docs)) return priorityDocGroups.get(group) ?? 8000;

  const projectPriority = manifestOrder.get(group);
  return projectPriority === undefined ? 1000 : projectPriority;
}

/**
 * Orders Markdown docs groups for the preview sidebar.
 *
 * @param {MarkdownDoc[]} docs - Markdown docs to group and order.
 * @returns {MarkdownDocGroup[]} Ordered docs groups.
 */
export function orderedDocGroups(docs: MarkdownDoc[]): MarkdownDocGroup[] {
  const manifestOrder = projectManifestOrder();

  return [...groupDocsByProject(docs).entries()].sort(([left, leftDocs], [right, rightDocs]) => {
    const priorityDifference =
      docGroupPriority(left, leftDocs, manifestOrder) -
      docGroupPriority(right, rightDocs, manifestOrder);
    if (priorityDifference !== 0) return priorityDifference;

    return left.localeCompare(right);
  });
}

/**
 * Groups documents by display section title while preserving document order.
 *
 * @param {MarkdownDoc[]} docs - Markdown docs from one sidebar group.
 * @returns {MarkdownDocSection[]} Ordered sections for a sidebar group.
 */
export function orderedDocSections(docs: MarkdownDoc[]): MarkdownDocSection[] {
  const sections = new Map<string, MarkdownDoc[]>();

  for (const doc of docs) {
    const title = docSectionTitle(doc);
    const sectionDocs = sections.get(title);

    if (sectionDocs) {
      sectionDocs.push(doc);
      continue;
    }

    sections.set(title, [doc]);
  }

  return [...sections.entries()].map(([title, sectionDocs]) => ({
    title,
    docs: sectionDocs,
  }));
}

/**
 * Flattens docs into the exact order used by the preview sidebar.
 *
 * The rendered document body should use this same order so scrolling through
 * the page matches the left navigation from top to bottom.
 *
 * @param {MarkdownDoc[]} docs - Markdown docs included in the preview.
 * @returns {MarkdownDoc[]} Docs ordered by sidebar group, section, and link order.
 */
export function orderedDocsForPreview(docs: MarkdownDoc[]): MarkdownDoc[] {
  return orderedDocGroups(docs).flatMap(([, projectDocs]) =>
    orderedDocSections(projectDocs).flatMap((section) => section.docs),
  );
}

/**
 * Builds the page title for a scoped docs preview.
 *
 * Shared root/general/test docs are included in every preview, so the title is
 * based on the selected project group when exactly one project is present.
 *
 * @param {MarkdownDoc[]} docs - Markdown docs included in the preview.
 * @returns {string} Human-readable preview title.
 */
export function docsPreviewTitle(docs: MarkdownDoc[]): string {
  const projectGroups = orderedDocGroups(docs).filter(
    ([group]) => !nonProjectIconGroups.has(group),
  );

  if (projectGroups.length === 1) {
    const [project] = projectGroups[0]!;
    return docGroupTitle(project);
  }

  return projectGroups.length > 1 ? "Project Documentation" : "Documentation Preview";
}

/**
 * Resolves a project icon into the generated preview bundle.
 *
 * Project icons are optional. When the S3 source cache contains
 * `icons/<project>/mark.svg`, the preview references the copied asset at the
 * same relative path under `dist/docs-preview`.
 *
 * @param {string} project - Documentation project group name.
 * @returns {ProjectIconPreviewAsset | null} Icon asset when one exists.
 */
export function projectIconAsset(project: string): ProjectIconPreviewAsset | null {
  if (nonProjectIconGroups.has(project)) return null;

  const source = normalizeRepoPath(join(sourceInputDirs.icons, project, projectIconFile));
  if (!existsSync(source)) return null;

  const iconHref = normalizeRepoPath(join(repoDirs.icons, project, projectIconFile));
  const target = normalizeRepoPath(join(dirname(docsPreviewOutput), iconHref));

  return {
    href: normalizeRepoPath(relative(dirname(docsPreviewOutput), target)),
    project,
    source,
    target,
  };
}

/**
 * Returns unique project icon assets referenced by selected preview docs.
 *
 * @param {MarkdownDoc[]} docs - Markdown docs included in the preview.
 * @returns {ProjectIconPreviewAsset[]} Unique project icon assets.
 */
export function projectIconAssetsForDocs(docs: MarkdownDoc[]): ProjectIconPreviewAsset[] {
  const assets = docs
    .map((doc) => projectIconAsset(doc.project))
    .filter((asset): asset is ProjectIconPreviewAsset => asset !== null);

  return [...new Map(assets.map((asset) => [asset.target, asset])).values()];
}

/**
 * Returns the first project icon in preview order for page-level chrome.
 *
 * @param {MarkdownDoc[]} docs - Markdown docs included in the preview.
 * @returns {ProjectIconPreviewAsset | null} Primary project icon when one exists.
 */
export function primaryProjectIconAsset(docs: MarkdownDoc[]): ProjectIconPreviewAsset | null {
  return projectIconAssetsForDocs(docs).at(0) ?? null;
}

/**
 * Resolves a local Markdown href to a selected preview document id.
 *
 * @param {MarkdownDoc} source - Source document containing the link.
 * @param {string} href - Link target.
 * @param {Map<string, string>} idsByPath - Preview document ids keyed by path.
 * @returns {string | null} Target document id when the href points to a selected doc.
 */
export function localMarkdownTargetId(
  source: MarkdownDoc,
  href: string,
  idsByPath: Map<string, string>,
): string | null {
  if (/^[a-z]+:/i.test(href) || href.startsWith("#")) return null;

  const [targetPath] = href.split("#");
  if (!targetPath?.endsWith(".md")) return null;

  const normalized = normalizeRepoPath(join(dirname(source.input), targetPath));
  return idsByPath.get(normalized) ?? null;
}

/**
 * Resolves a local Mermaid source link to its rendered SVG preview asset.
 *
 * @param {MarkdownDoc} source - Source document containing the link.
 * @param {string} href - Link target.
 * @returns {MermaidPreviewAsset | null} Rendered SVG asset metadata.
 */
export function localMermaidTarget(source: MarkdownDoc, href: string): MermaidPreviewAsset | null {
  if (/^[a-z]+:/i.test(href) || href.startsWith("#")) return null;

  const [targetPath] = href.split("#");
  if (!targetPath?.endsWith(".mmd")) return null;

  const mermaidPath = normalizeRepoPath(join(dirname(source.input), targetPath));
  const svgPath = mermaidPath.replace(/\.mmd$/, ".svg");
  const mermaidSourcePath = source.sourcePath ? physicalArtifactPath(mermaidPath) : mermaidPath;
  const svgSourcePath = source.sourcePath ? physicalArtifactPath(svgPath) : svgPath;
  const previewSvgPath = normalizeRepoPath(join(dirname(docsPreviewOutput), svgPath));
  const previewPagePath = previewSvgPath.replace(/\.svg$/, ".html");
  const svgHref = normalizeRepoPath(relative(dirname(docsPreviewOutput), previewSvgPath));

  return existsSync(mermaidSourcePath) || existsSync(svgSourcePath)
    ? {
        href: normalizeRepoPath(relative(dirname(docsPreviewOutput), previewPagePath)),
        pageTarget: previewPagePath,
        projectIcon: projectIconAsset(source.project),
        source: svgSourcePath,
        svgHref,
        target: previewSvgPath,
        title: formatDocLabel(basename(svgPath, ".svg")),
      }
    : null;
}

/**
 * Resolves a local Mermaid source link to its rendered SVG preview href.
 *
 * @param {MarkdownDoc} source - Source document containing the link.
 * @param {string} href - Link target.
 * @returns {string | null} Rendered SVG href when the href points to a local Mermaid source.
 */
export function localMermaidTargetHref(source: MarkdownDoc, href: string): string | null {
  return localMermaidTarget(source, href)?.href ?? null;
}

/**
 * Returns the cached local path for a discovered document.
 *
 * @param doc - Markdown document metadata.
 * @returns Local cached source path.
 */
export function markdownSourcePath(doc: MarkdownDoc): string {
  return doc.sourcePath ?? doc.input;
}

/**
 * Converts a logical artifact path into its S3-synced source cache path.
 *
 * @param p - Logical docs, diagrams, or icon path.
 * @returns Cached local source path when the path belongs to synced inputs.
 */
function physicalArtifactPath(p: string): string {
  const normalized = normalizeRepoPath(p);

  if (normalized.startsWith(`${logicalDocsRoot}/`)) {
    return normalizeRepoPath(join(docsRoot, normalized.slice(logicalDocsRoot.length + 1)));
  }

  if (normalized.startsWith(`${repoDirs.diagrams}/`)) {
    return normalizeRepoPath(
      join(sourceInputDirs.diagrams, normalized.slice(repoDirs.diagrams.length + 1)),
    );
  }

  if (normalized.startsWith(`${repoDirs.icons}/`)) {
    return normalizeRepoPath(
      join(sourceInputDirs.icons, normalized.slice(repoDirs.icons.length + 1)),
    );
  }

  return normalized;
}

/**
 * Converts a cached local source path into its public logical artifact path.
 *
 * @param p - Local source path.
 * @returns Logical path used in generated artifact HTML.
 */
function logicalArtifactPath(p: string): string {
  const normalized = normalizeRepoPath(p);
  const docsRelativePath = sourceRootRelativePath(p, docsRoot);
  const diagramsRelativePath = sourceRootRelativePath(p, sourceInputDirs.diagrams);
  const iconsRelativePath = sourceRootRelativePath(p, sourceInputDirs.icons);

  if (docsRelativePath !== null) {
    return normalizeRepoPath(join(logicalDocsRoot, docsRelativePath));
  }

  if (diagramsRelativePath !== null) {
    return normalizeRepoPath(join(repoDirs.diagrams, diagramsRelativePath));
  }

  if (iconsRelativePath !== null) {
    return normalizeRepoPath(join(repoDirs.icons, iconsRelativePath));
  }

  return normalized;
}
