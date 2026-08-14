import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { artifactPaths, repoDirs, sourceInputDirs } from "../core/script-constants.ts";
import { ensureDirectory } from "../core/bun-native-fs.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import {
  sourceInputCommandArgs,
  validateSourceInputSelection,
} from "../core/source-input-selection.ts";
import { logError, logHeading, logItem, logSuccess } from "../core/script-logger.ts";
import { isHiddenSourcePath } from "./source-input-exclusions.ts";

/**
 * Local bundle directories that map directly to CloudFront origins later.
 */
export const publishOutputs = {
  siteArtifacts: join(repoDirs.dist, "site-artifacts"),
  siteAssets: join(repoDirs.dist, "site-assets"),
} as const;

interface ProjectArtifactManifestEntry {
  coveragePath?: string;
  coveragePdfPath?: string;
  docsPath: string;
  docsPdfPath?: string;
}

interface ProjectArtifactManifest {
  projects: Record<string, ProjectArtifactManifestEntry>;
}

const defaultDocsProject = "artifact-generator";

/**
 * Options for local publish bundle assembly.
 */
export interface AssembleSiteArtifactsOptions {
  /**
   * Project folder that receives the current docs preview.
   */
  readonly docsProject?: string;
}

/**
 * A source-to-target copy operation in the publish bundle.
 */
interface CopyPlan {
  /**
   * Display label for logging.
   */
  label: string;
  /**
   * Whether the source must exist for publishing.
   */
  required: boolean;
  /**
   * Source file or directory.
   */
  source: string;
  /**
   * Target file or directory in the publish bundle.
   */
  target: string;
}

/**
 * Returns true when a path exists and is a file.
 *
 * @param path - Path to inspect.
 * @returns Whether the path is a file.
 */
function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

/**
 * Recursively walks files below a directory.
 *
 * @param directory - Directory to inspect.
 * @returns Repo-relative file paths.
 */
function walkFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) {
      return walkFiles(path);
    }

    return [path];
  });
}

/**
 * Returns true when a project source file lives below a coverage directory.
 *
 * @param path - Path relative to the project source root.
 * @returns Whether the path belongs to project-owned coverage output.
 */
function isProjectCoveragePath(path: string): boolean {
  return path.split(/[\\/]+/).includes(repoDirs.coverage);
}

/**
 * Copies one required or optional path into the bundle.
 *
 * @param plan - Copy operation to execute.
 */
function copyPath(plan: CopyPlan): void {
  if (!existsSync(plan.source)) {
    if (plan.required) {
      throw new Error(`Missing publish input: ${plan.source}`);
    }

    return;
  }

  ensureDirectory(dirname(plan.target));
  rmSync(plan.target, { force: true, recursive: true });
  cpSync(plan.source, plan.target, { dereference: true, recursive: true });
  logItem(`${plan.label}: ${plan.target}`, 1);
}

/**
 * Copies rendered diagram SVG files while leaving Mermaid sources out of the
 * public bundle.
 *
 * @returns Number of copied SVG diagrams.
 */
export function copyRenderedDiagrams(): number {
  const svgFiles = walkFiles(sourceInputDirs.diagrams).filter((path) => path.endsWith(".svg"));

  for (const source of svgFiles) {
    const target = join(
      publishOutputs.siteArtifacts,
      repoDirs.diagrams,
      relative(sourceInputDirs.diagrams, source),
    );

    ensureDirectory(dirname(target));
    cpSync(source, target, { dereference: true });
  }

  return svgFiles.length;
}

/**
 * Deletes generated publish bundle directories.
 */
export function cleanPublishOutputs(): void {
  rmSync(publishOutputs.siteArtifacts, { force: true, recursive: true });
  rmSync(publishOutputs.siteAssets, { force: true, recursive: true });
}

/**
 * Copies the current docs preview into the project-specific publish path.
 *
 * @param project - Project slug for the docs preview.
 */
export function copyDocsPreview(project = defaultDocsProject): void {
  copyPath({
    label: "Docs preview",
    required: true,
    source: dirname(artifactPaths.docsPreview),
    target: join(publishOutputs.siteArtifacts, repoDirs.docs, project),
  });
}

/**
 * Adds generated PDF paths to the manifest copied into the public artifact bundle.
 *
 * @param manifestPath - Published project artifact manifest to update.
 */
export function addGeneratedPdfPaths(
  manifestPath = join(publishOutputs.siteArtifacts, "manifests", "project-artifacts.json"),
): void {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ProjectArtifactManifest;

  for (const project of Object.values(manifest.projects)) {
    project.docsPdfPath = project.docsPath.replace(/\.html$/u, ".pdf");
  }

  const artifactGenerator = manifest.projects[defaultDocsProject];

  if (artifactGenerator?.coveragePath && isFile(artifactPaths.coverageReportPdf)) {
    artifactGenerator.coveragePdfPath = artifactGenerator.coveragePath.replace(/\.html$/u, ".pdf");
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * Copies project markdown/content without republishing project-owned coverage.
 *
 * @returns Number of copied project content files.
 */
export function copyProjectContent(): number {
  if (!existsSync(sourceInputDirs.projects)) {
    throw new Error(`Missing publish input: ${sourceInputDirs.projects}`);
  }

  const targetRoot = join(publishOutputs.siteArtifacts, "projects");
  rmSync(targetRoot, { force: true, recursive: true });

  let copied = 0;

  for (const source of walkFiles(sourceInputDirs.projects)) {
    const relativePath = relative(sourceInputDirs.projects, source);

    if (isProjectCoveragePath(relativePath)) {
      continue;
    }

    if (isHiddenSourcePath(relativePath)) {
      continue;
    }

    const target = join(targetRoot, relativePath);
    ensureDirectory(dirname(target));
    cpSync(source, target, { dereference: true });
    copied += 1;
  }

  logItem(`Project content: ${targetRoot}`, 1);

  return copied;
}

/**
 * Copies shared content and generated assets into publish bundle directories.
 */
export function copySharedPublishInputs(): void {
  const plans: CopyPlan[] = [
    {
      label: "Manifests",
      required: true,
      source: sourceInputDirs.manifests,
      target: join(publishOutputs.siteArtifacts, "manifests"),
    },
    {
      label: "Profile content",
      required: true,
      source: sourceInputDirs.profile,
      target: join(publishOutputs.siteArtifacts, "profile"),
    },
    {
      label: "Artifact Generator project coverage report",
      required: isFile(artifactPaths.coverageReport),
      source: repoDirs.coverage,
      target: join(publishOutputs.siteArtifacts, "projects", defaultDocsProject, repoDirs.coverage),
    },
    {
      label: "Project icons",
      required: true,
      source: sourceInputDirs.icons,
      target: join(publishOutputs.siteAssets, repoDirs.icons),
    },
    {
      label: "Generated resume",
      required: true,
      source: artifactPaths.resumePdf,
      target: join(publishOutputs.siteAssets, repoDirs.resume, "connor-hunter-resume.pdf"),
    },
  ];

  copyProjectContent();

  for (const plan of plans) {
    copyPath(plan);
  }

  addGeneratedPdfPaths();
}

/**
 * Builds static artifact and asset bundles for S3/CloudFront publishing.
 *
 * @returns Publish output directories and copied diagram count.
 */
export function assembleSiteArtifacts(options: AssembleSiteArtifactsOptions = {}): {
  readonly diagramCount: number;
  readonly siteArtifacts: string;
  readonly siteAssets: string;
} {
  validateSourceInputSelection();
  cleanPublishOutputs();

  logHeading("Assembling site artifact bundle", { count: 8 });

  const diagramCount = copyRenderedDiagrams();
  logItem(`Rendered diagrams: ${diagramCount}`, 1);

  copyDocsPreview(options.docsProject);
  copySharedPublishInputs();

  logSuccess("Assembled site artifact bundle");

  return {
    diagramCount,
    siteArtifacts: publishOutputs.siteArtifacts,
    siteAssets: publishOutputs.siteAssets,
  };
}

/* istanbul ignore next */
if (isEntrypoint(import.meta.url)) {
  try {
    const [docsProject] = sourceInputCommandArgs(process.argv.slice(2)).filter(
      (arg) => !arg.startsWith("--"),
    );
    assembleSiteArtifacts(docsProject ? { docsProject } : {});
  } catch (error) {
    logError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
