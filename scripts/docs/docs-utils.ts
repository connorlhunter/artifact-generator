import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { readProjectManifest } from "../content/project-manifest.ts";
import { repoDirs, sourceInputDirs } from "../core/script-constants.ts";
import { formatDocLabel, formatDocSectionTitle } from "./docs-labels.ts";
import { documentMetadataFile } from "./doc-metadata.ts";

/**
 * Markdown document discovered for a structured docs artifact.
 */
export interface MarkdownDoc {
  /**
   * Stable document id derived from the input path.
   */
  id: string;
  /**
   * Logical Markdown input path used in generated navigation and source links.
   */
  input: string;
  /**
   * Logical project group used in artifact navigation.
   */
  project: string;
  /** Central metadata file used by this documentation collection. */
  metadataPath?: string;
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

const docsRoot = sourceInputDirs.docs;
const logicalDocsRoot = repoDirs.docs;
const artifactGeneratorProject = "artifact-generator";
const generalDocsProject = "general-docs";
const rootProject = "root";
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
 * Returns root-level pipeline docs for the Artifact Generator artifact.
 *
 * @param {string[]} roots - Resolved docs roots selected for this artifact.
 * @returns {string[]} Shared Markdown paths that exist in this checkout.
 */
function sharedArtifactDocs(roots: string[]): string[] {
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
 * Resolves a requested docs project to a slug owned by the source manifest.
 *
 * Returning the manifest key, rather than the raw request, keeps command-line
 * input from becoming a filesystem path.
 *
 * @param requestedProject - Project argument supplied to the docs build command.
 * @param manifestPath - Shared project manifest that owns valid project slugs.
 * @returns Trusted project slug from the shared manifest.
 */
export function artifactProjectSlug(
  requestedProject: string,
  manifestPath = projectManifestPath,
): string {
  const projects = readProjectManifest(manifestPath);
  const project = Object.keys(projects).find((slug) => slug === requestedProject);

  if (project === undefined) {
    throw new Error(`Unknown docs project: ${requestedProject}`);
  }

  return project;
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
 * Returns true when a Markdown file should be omitted from docs artifacts.
 *
 * @param {string} p - Repo-relative Markdown path.
 * @returns {boolean} Whether the file should be omitted.
 */
function isIgnoredMarkdownFile(p: string): boolean {
  return ignoredFiles.has(logicalArtifactPath(p));
}

/**
 * Converts a Markdown path to a stable document id.
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
  const project = getProject(input);
  const doc: MarkdownDoc = {
    id: docId(input),
    input,
    metadataPath: documentMetadataPath(normalizedSourcePath, input, project),
    project,
  };

  if (normalizedSourcePath !== input) doc.sourcePath = normalizedSourcePath;

  return doc;
}

/** Returns the metadata file shared by one documentation collection. */
function documentMetadataPath(sourcePath: string, input: string, project: string): string {
  if (input.startsWith(`${logicalDocsRoot}/${project}/`)) {
    return join(sourceInputDirs.docs, project, documentMetadataFile);
  }

  const segments = sourcePath.split("/");
  const projectIndex = segments.lastIndexOf(project);

  return join(
    projectIndex >= 0 ? segments.slice(0, projectIndex + 1).join("/") : dirname(sourcePath),
    documentMetadataFile,
  );
}

/**
 * Finds Markdown docs under selected roots.
 *
 * @param {string[]} roots - Directories to scan.
 * @returns {MarkdownDoc[]} Markdown docs for artifact compilation.
 */
export function findMarkdownDocs(roots: string[] = []): MarkdownDoc[] {
  if (roots.length === 0) return [];

  const scannedDocs = roots
    .flatMap((root) => walkMarkdown(root))
    .filter((p) => !isIgnoredMarkdownFile(p));

  const docsByInput = new Map<string, MarkdownDoc>();

  for (const path of uniqueStrings([...sharedArtifactDocs(roots), ...scannedDocs])) {
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
 * Orders Markdown docs groups for artifact navigation.
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
 * Flattens docs into the exact order used by artifact navigation.
 *
 * The rendered document body should use this same order so scrolling through
 * the collection keeps a predictable reading sequence.
 *
 * @param {MarkdownDoc[]} docs - Markdown docs included in the artifact.
 * @returns {MarkdownDoc[]} Docs ordered by sidebar group, section, and link order.
 */
export function orderedDocsForArtifact(docs: MarkdownDoc[]): MarkdownDoc[] {
  return orderedDocGroups(docs).flatMap(([, projectDocs]) =>
    orderedDocSections(projectDocs).flatMap((section) => section.docs),
  );
}

/**
 * Resolves a local Markdown href to a selected artifact document id.
 *
 * @param {MarkdownDoc} source - Source document containing the link.
 * @param {string} href - Link target.
 * @param {Map<string, string>} idsByPath - Artifact document ids keyed by path.
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
 * Returns the cached local path for a discovered document.
 *
 * @param doc - Markdown document metadata.
 * @returns Local cached source path.
 */
export function markdownSourcePath(doc: MarkdownDoc): string {
  return doc.sourcePath ?? doc.input;
}

/**
 * Converts a cached local source path into its public logical artifact path.
 *
 * @param p - Local source path.
 * @returns Logical path used in generated artifacts.
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
