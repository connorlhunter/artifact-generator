import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import path from "node:path";
import { repoDirs, sharedDiagramInputs, sourceInputDirs } from "../core/script-constants.ts";
import { diagramOutputPath, readDiagramMetadata } from "./diagram-metadata.ts";
import type { DiagramJob } from "./diagram-types.ts";

/**
 * Shared diagrams that should be rendered and opened before project diagrams.
 */
const globalDiagramInputs = [...sharedDiagramInputs];
const diagramRoot = sourceInputDirs.diagrams;
const logicalDiagramRoot = repoDirs.diagrams;

/**
 * Directory names that should never be searched for Mermaid diagrams.
 */
const ignoredDirs = new Set([".git", repoDirs.nodeModules]);

const overviewDiagramSuffix = "-overview.mmd";
const validationOutputDir = join(repoDirs.dist, ".diagram-validation");

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
 * Returns true when a path exists and is a Mermaid source file.
 *
 * @param {string} p - Path to inspect.
 * @returns {boolean} Whether the path is an existing Mermaid source file.
 */
/* istanbul ignore next */
function isMermaidFile(p: string): boolean {
  return existsSync(p) && statSync(p).isFile() && p.endsWith(".mmd");
}

/**
 * Recursively finds Mermaid source files below a directory.
 *
 * @param {string} dir - Directory to scan.
 * @param {string[]} files - Accumulator used by recursive calls.
 * @returns {string[]} Sorted later by `findDiagrams`.
 */
/* istanbul ignore next */
function walk(dir: string, files: string[] = []): string[] {
  if (statSync(dir).isFile()) {
    if (dir.endsWith(".mmd")) files.push(dir);
    return files;
  }

  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue;

    const path = join(dir, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      walk(path, files);
      continue;
    }

    if (stats.isFile() && path.endsWith(".mmd")) files.push(path);
  }

  return files;
}

/**
 * Normalizes a CLI diagram root argument.
 *
 * @param {string} arg - Raw CLI argument.
 * @returns {string} Root path without leading dashes.
 */
function normalizeRootArg(arg: string): string {
  return arg.replace(/^--/, "");
}

/**
 * Normalizes a path string for cross-platform comparisons.
 *
 * @param {string} value - Path to normalize.
 * @returns {string} Comparable slash-delimited path.
 */
function comparablePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/$/u, "");
}

/**
 * Resolves project shorthand to the root diagrams project folder.
 *
 * @param {string} root - Requested diagram root.
 * @returns {string} Existing diagram root or the original root.
 */
function resolveDiagramRoot(root: string): string {
  if (isAllDiagramRoot(root)) return root;

  const normalizedRoot = relative(".", root).replaceAll("\\", "/");
  const projectDiagramRoot = join(diagramRoot, root);
  if (!root.includes("/") && isDirectory(projectDiagramRoot)) return projectDiagramRoot;
  if (normalizedRoot === logicalDiagramRoot) return diagramRoot;
  if (normalizedRoot.startsWith(`${logicalDiagramRoot}/`)) {
    return join(diagramRoot, normalizedRoot.slice(logicalDiagramRoot.length + 1));
  }
  if (root.includes("/") && isDirectory(root)) return root;
  if (root.includes("/") && isMermaidFile(root)) return root;

  return isDirectory(root) || isMermaidFile(root) ? root : projectDiagramRoot;
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
 * Returns true when a root would scan every repository diagram.
 *
 * @param {string} root - Resolved root path.
 * @returns {boolean} Whether the root should be rejected.
 */
function isAllDiagramRoot(root: string): boolean {
  const normalized = comparablePath(root);
  const cwdRelative = comparablePath(relative(".", root));
  const absolute = comparablePath(path.resolve(root));
  const absoluteDiagramRoot = comparablePath(path.resolve(diagramRoot));

  return (
    normalized === "" ||
    normalized === "." ||
    normalized === logicalDiagramRoot ||
    cwdRelative === "" ||
    cwdRelative === "." ||
    cwdRelative === logicalDiagramRoot ||
    absolute === absoluteDiagramRoot
  );
}

/**
 * Reads required project paths from command-line args.
 *
 * Example:
 * `bun run diagrams:render -- cipher-trace`
 *
 * @param {string[]} args - CLI args after the script name.
 * @returns {string[]} Project paths to scan.
 */
export function getDiagramRoots(args: string[]): string[] {
  return uniqueStrings(
    args
      .map(normalizeRootArg)
      .filter(Boolean)
      .map(resolveDiagramRoot)
      .filter((root) => !isAllDiagramRoot(root)),
  );
}

/**
 * Builds one Mermaid render job from an input path.
 *
 * @param {string} input - Mermaid source path.
 * @returns Mermaid render job with source-owned version metadata.
 */
function diagramJob(input: string): DiagramJob {
  const metadata = readDiagramMetadata(input);

  return {
    input,
    output: diagramOutputPath(input, metadata),
    ...metadata,
  };
}

/**
 * Returns configured global diagram paths that exist in this checkout.
 *
 * @returns {string[]} Global Mermaid source paths.
 */
function existingGlobalDiagramInputs(): string[] {
  return globalDiagramInputs.filter(isMermaidFile);
}

/**
 * Returns true when a Mermaid source belongs to the configured artifact input.
 *
 * @param input - Mermaid source path.
 * @returns Whether the input is under the configured diagrams directory.
 */
function isConfiguredDiagramInput(input: string): boolean {
  const inputRelative = relative(diagramRoot, input);

  return (
    inputRelative !== "" && inputRelative !== ".." && !inputRelative.startsWith(`..${path.sep}`)
  );
}

/**
 * Adds global diagrams to a discovered diagram list and removes duplicates.
 *
 * @param {string[]} inputs - Discovered Mermaid source paths.
 * @returns {string[]} Source paths including global diagrams.
 */
function withGlobalDiagrams(inputs: string[]): string[] {
  if (inputs.length === 0) return [];
  if (!inputs.some(isConfiguredDiagramInput)) return inputs;

  return uniqueStrings([...existingGlobalDiagramInputs(), ...inputs]);
}

/**
 * Returns true when a diagram is the project overview diagram.
 *
 * Project overview diagrams use the `<project-name>-overview.mmd` naming
 * convention and should be shown before detail diagrams.
 *
 * @param {string} input - Mermaid source path.
 * @returns {boolean} Whether the input is an overview diagram.
 */
export function isOverviewDiagram(input: string): boolean {
  return input.replaceAll("\\", "/").endsWith(overviewDiagramSuffix);
}

/**
 * Sorts global diagrams first, project overview diagrams next, then details.
 *
 * @param {{ input: string, output: string }[]} jobs - Mermaid render jobs.
 * @returns {{ input: string, output: string }[]} Sorted Mermaid render jobs.
 */
/* istanbul ignore next */
function sortDiagramJobs(jobs: DiagramJob[]): DiagramJob[] {
  const globalOrder = new Map(existingGlobalDiagramInputs().map((input, index) => [input, index]));

  return [...jobs].sort((a, b) => {
    const aGlobal = globalOrder.get(a.input);
    const bGlobal = globalOrder.get(b.input);

    if (aGlobal !== undefined && bGlobal !== undefined) return aGlobal - bGlobal;
    if (aGlobal !== undefined) return -1;
    if (bGlobal !== undefined) return 1;

    const aOverview = isOverviewDiagram(a.input);
    const bOverview = isOverviewDiagram(b.input);

    if (aOverview && !bOverview) return -1;
    if (!aOverview && bOverview) return 1;

    return a.input.localeCompare(b.input);
  });
}

/**
 * Builds the input/output pairs for every Mermaid diagram under the roots.
 *
 * @param {string[]} roots - Directories to scan.
 * @returns {{ input: string, output: string }[]} Mermaid render jobs.
 */
export function findDiagrams(roots: string[] = []): DiagramJob[] {
  if (roots.length === 0) return [];

  const inputs = uniqueStrings(roots.flatMap((root) => walk(root))).sort();

  return sortDiagramJobs(withGlobalDiagrams(inputs).map(diagramJob));
}

/**
 * Maps a normal output path to a controlled build output used by validation.
 *
 * @param {string} output - Normal SVG output path.
 * @returns {string} Build path that avoids writing generated SVGs to the docs tree.
 */
export function validateOutputPath(output: string): string {
  const normalized = relative(".", output).replaceAll("/", "-").replaceAll("\\", "-");
  mkdirSync(validationOutputDir, { recursive: true });
  return join(validationOutputDir, normalized);
}

/**
 * Returns unique output directories for a set of diagrams.
 *
 * @param {{ output: string }[]} diagrams - Mermaid render jobs.
 * @returns {string[]} Unique output directories.
 */
export function outputDirs(diagrams: DiagramJob[]): string[] {
  return [...new Set(diagrams.map(({ output }) => dirname(output)))];
}

/**
 * Builds a compact display name for a diagram path.
 *
 * Produces a short identifier using the top-level project and filename
 * without extension.
 * Example:
 * - "diagrams/cipher-trace/foo.mmd" -> "foo"
 *
 * @param {string} p - File system path.
 * @returns {string} Compact name for logging.
 */
export function compactName(p: string): string {
  const parts = p.split(path.sep);
  /* istanbul ignore next */
  const file = (parts.at(-1) ?? p).replace(/\.[^/.]+$/, "");
  return file;
}

/**
 * Extracts the top-level project name from a path.
 *
 * Uses the second segment for root diagram project folders.
 * Example:
 * - "diagrams/cipher-trace/..." -> "cipher-trace"
 *
 * @param {string} p - File system path.
 * @returns {string} Project name.
 */
function getProject(p: string): string {
  const cacheRelative = comparablePath(relative(diagramRoot, p));

  if (
    cacheRelative &&
    cacheRelative !== "." &&
    cacheRelative !== ".." &&
    !cacheRelative.startsWith("../")
  ) {
    return cacheRelative.split("/")[0] ?? ".";
  }

  const normalized = comparablePath(relative(".", p));
  const parts = normalized.split("/");
  if (parts[0] === logicalDiagramRoot && parts.length > 2) return parts[1] as string;

  /* istanbul ignore next */
  return parts[0] ?? ".";
}

/**
 * Groups Mermaid jobs by their top-level project name.
 *
 * @param {{ input: string; output: string }[]} items - Mermaid jobs.
 * @returns {Map<string, { input: string; output: string }[]>} Jobs grouped by project.
 */
export function groupByProject(items: DiagramJob[]): Map<string, DiagramJob[]> {
  const groups = new Map<string, DiagramJob[]>();

  for (const item of items) {
    const project = getProject(item.input);
    const group = groups.get(project);

    if (group) {
      group.push(item);
      continue;
    }

    groups.set(project, [item]);
  }

  return groups;
}
