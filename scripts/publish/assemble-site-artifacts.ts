import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { artifactPaths, repoDirs, sourceInputDirs } from "../core/script-constants.ts";
import { ensureDirectory } from "../core/file-system.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import {
  diagramOutputPath,
  diagramSourcePath,
  isVersionedDiagramOutput,
  readDiagramMetadata,
} from "../diagrams/diagram-metadata.ts";
import { formatDocLabel } from "../docs/docs-labels.ts";
import {
  sourceInputCommandArgs,
  validateSourceInputSelection,
} from "../core/source-input-selection.ts";
import { logError, logHeading, logItem, logSuccess } from "../core/script-logger.ts";

/**
 * Local bundle directories that map directly to CloudFront origins later.
 */
export const publishOutputs = {
  siteArtifacts: join(repoDirs.dist, "site-artifacts"),
  siteAssets: join(repoDirs.dist, "site-assets"),
} as const;

interface ProjectArtifactManifestSourceEntry {
  readonly coverageComingSoon?: boolean;
  readonly diagramPaths?: readonly string[];
  readonly iconPath: string;
  readonly overviewDiagramPath?: string;
}

interface ProjectArtifactManifestSource {
  readonly projects: Record<string, ProjectArtifactManifestSourceEntry>;
}

interface PublishedDiagram {
  readonly id: string;
  readonly lastUpdated: string;
  readonly overview?: boolean;
  readonly svgPath: string;
  readonly title: string;
  readonly version: string;
}

interface PublishedProjectArtifactManifest {
  readonly projects: Record<
    string,
    {
      readonly changelog: { readonly markdownPath: string; readonly pdfPath: string };
      readonly coverage: {
        readonly comingSoon?: boolean;
        readonly indexPath: string;
        readonly pdfPath: string;
      };
      readonly diagrams: readonly PublishedDiagram[];
      readonly docs: { readonly indexPath: string; readonly pdfPath: string };
      readonly iconPath: string;
    }
  >;
  readonly schemaVersion: 2;
}

const defaultDocsProject = "artifact-generator";

/**
 * Options for local publish bundle assembly.
 */
export interface AssembleSiteArtifactsOptions {
  /**
   * Project folder that receives the current docs artifact.
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
  const svgFiles = walkFiles(sourceInputDirs.diagrams).filter(isVersionedDiagramOutput);

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
 * Copies one generated docs collection into its project-specific publish path.
 *
 * @param project - Project slug for the docs artifact.
 */
export function copyDocsArtifact(project = defaultDocsProject): void {
  copyPath({
    label: "Docs artifact",
    required: true,
    source: join(artifactPaths.docsArtifactsDir, project),
    target: join(publishOutputs.siteArtifacts, repoDirs.docs, project),
  });
}

/**
 * Compiles the source project manifest into the small artifact contract consumed
 * by the Portfolio. Source-only HTML paths remain private to artifact generation.
 *
 * @param manifestPath - Published project artifact manifest to update.
 */
export function compileProjectArtifactManifest(
  manifestPath = join(publishOutputs.siteArtifacts, "manifests", "project-artifacts.json"),
): void {
  const source = JSON.parse(readFileSync(manifestPath, "utf8")) as ProjectArtifactManifestSource;
  const projects = Object.fromEntries(
    Object.entries(source.projects).map(([slug, project]) => [
      slug,
      publishedProjectArtifact(slug, project),
    ]),
  );
  const manifest: PublishedProjectArtifactManifest = { projects, schemaVersion: 2 };

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Removes source-only frontmatter paths from the public content manifest. */
export function sanitizeContentManifest(
  manifestPath = join(publishOutputs.siteArtifacts, "manifests", "content-manifest.json"),
): void {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  delete manifest.profile;
  manifest.schemaVersion = 2;
  manifest.siteContentPath = "content/site.json";
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * Resolves one public diagram path to the name produced from its Mermaid source.
 *
 * @param diagramPath - Public logical SVG path stored in the project manifest.
 * @returns Versioned public logical SVG path.
 */
function versionedPublishedDiagramPath(diagramPath: string): string {
  const prefix = `${repoDirs.diagrams}/`;

  if (!diagramPath.startsWith(prefix) || !diagramPath.endsWith(".svg")) {
    throw new Error(`Project manifest diagram path must be an SVG below ${prefix}: ${diagramPath}`);
  }

  const sourceRelativePath = diagramSourcePath(diagramPath.slice(prefix.length));
  const sourcePath = join(sourceInputDirs.diagrams, sourceRelativePath);
  const outputPath = diagramOutputPath(sourcePath, readDiagramMetadata(sourcePath));
  const outputRelativePath = relative(sourceInputDirs.diagrams, outputPath).replaceAll("\\", "/");

  return `${prefix}${outputRelativePath}`;
}

/** Compiles one source diagram path into stable Portfolio display metadata. */
function publishedDiagram(svgPath: string, overview: boolean): PublishedDiagram {
  const prefix = `${repoDirs.diagrams}/`;
  const sourceRelativePath = diagramSourcePath(svgPath.slice(prefix.length));
  const sourcePath = join(sourceInputDirs.diagrams, sourceRelativePath);
  const metadata = readDiagramMetadata(sourcePath);
  const sourceName = basename(sourceRelativePath, ".mmd");
  const projectFolder = sourceRelativePath.split("/")[0] ?? "";
  const compactName = sourceName.startsWith(`${projectFolder}-`)
    ? sourceName.slice(projectFolder.length + 1)
    : sourceName;

  return {
    id: compactName.replace(/[^a-z0-9]+/giu, "-").replace(/^-+|-+$/gu, ""),
    lastUpdated: metadata.lastUpdated,
    ...(overview ? { overview: true } : {}),
    svgPath: versionedPublishedDiagramPath(svgPath),
    title: formatDocLabel(compactName),
    version: metadata.version,
  };
}

/** Compiles one project entry without exposing retired browser-viewer paths. */
function publishedProjectArtifact(
  slug: string,
  source: ProjectArtifactManifestSourceEntry,
): PublishedProjectArtifactManifest["projects"][string] {
  const projectDiagramPrefix = `${repoDirs.diagrams}/${slug}/`;
  const diagrams = (source.diagramPaths ?? [])
    .filter((path) => path.startsWith(projectDiagramPrefix))
    .map((path) => publishedDiagram(path, path === source.overviewDiagramPath));

  if (diagrams.length === 0) {
    throw new Error(`Project manifest requires at least one diagram for ${slug}`);
  }

  return {
    changelog: {
      markdownPath: `projects/${slug}/changelog/CHANGELOG.md`,
      pdfPath: `projects/${slug}/changelog/changelog.pdf`,
    },
    coverage: {
      ...(source.coverageComingSoon === undefined ? {} : { comingSoon: source.coverageComingSoon }),
      indexPath: `projects/${slug}/coverage/index.json`,
      pdfPath: `projects/${slug}/coverage/coverage.pdf`,
    },
    diagrams,
    docs: {
      indexPath: `docs/${slug}/index.json`,
      pdfPath: `docs/${slug}/docs.pdf`,
    },
    iconPath: source.iconPath,
  };
}

/**
 * Copies generated Portfolio content without republishing project-owned coverage.
 *
 * @returns Number of copied project content files.
 */
export function copyGeneratedContent(): void {
  copyPath({
    label: "Compiled site content",
    required: true,
    source: join(repoDirs.dist, "site-content", "content"),
    target: join(publishOutputs.siteArtifacts, "content"),
  });
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
      label: "Artifact Generator coverage data",
      required: true,
      source: artifactPaths.coverageReport,
      target: join(
        publishOutputs.siteArtifacts,
        "projects",
        defaultDocsProject,
        repoDirs.coverage,
        "index.json",
      ),
    },
    {
      label: "Artifact Generator coverage PDF",
      required: true,
      source: artifactPaths.coverageReportPdf,
      target: join(
        publishOutputs.siteArtifacts,
        "projects",
        defaultDocsProject,
        repoDirs.coverage,
        "coverage.pdf",
      ),
    },
    {
      label: "Artifact Generator changelog",
      required: true,
      source: join(repoDirs.dist, "changelog", defaultDocsProject),
      target: join(publishOutputs.siteArtifacts, "projects", defaultDocsProject, "changelog"),
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

  copyGeneratedContent();

  for (const plan of plans) {
    copyPath(plan);
  }

  compileProjectArtifactManifest();
  sanitizeContentManifest();
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

  copyDocsArtifact(options.docsProject);
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
