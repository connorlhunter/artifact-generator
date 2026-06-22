import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Repository directory names used by scripts.
 */
export const repoDirs = {
  coverage: "coverage",
  diagrams: "diagrams",
  dist: "dist",
  docs: "docs",
  icons: "icons",
  nodeModules: "node_modules",
  test: "test",
} as const;

/**
 * Private cache root for source inputs pulled from S3.
 *
 * This is an implementation cache only. S3 remains the source of truth, and
 * callers can override the path when they need to inspect synced inputs.
 */
export const sourceInputRoot =
  process.env.SOURCE_INPUT_CACHE_DIR?.trim() || join(tmpdir(), "artifact-generator-source-cache");

/**
 * S3-backed source input directories used before artifacts are rendered.
 */
export const sourceInputDirs = {
  artifacts: join(sourceInputRoot, "artifacts"),
  assetsRoot: join(sourceInputRoot, "assets"),
  docs: join(sourceInputRoot, "artifacts", repoDirs.docs),
  diagrams: join(sourceInputRoot, "artifacts", repoDirs.diagrams),
  manifests: join(sourceInputRoot, "artifacts", "manifests"),
  profile: join(sourceInputRoot, "artifacts", "profile"),
  projects: join(sourceInputRoot, "artifacts", "projects"),
  assets: join(sourceInputRoot, "assets", "assets"),
  icons: join(sourceInputRoot, "assets", repoDirs.icons),
  resume: join(sourceInputRoot, "assets", "resume"),
} as const;

/**
 * Root-level repository file names used by scripts.
 */
export const repoFiles = {
  bunfig: "bunfig.toml",
  dependencyPins: "dependency-pins.json",
  dependencyReleaseAgeExcludes: "dependency-release-age-excludes.json",
  diagramDirections: "diagram-directions.md",
  diagramStyleKeyDoc: "diagram-style-key.md",
  packageJson: "package.json",
  readme: "README.md",
} as const;

/**
 * Generated artifact paths used by render/open scripts.
 */
export const artifactPaths = {
  coverageDir: repoDirs.coverage,
  coverageLcov: join(repoDirs.coverage, "lcov.info"),
  coverageReport: join(repoDirs.coverage, "index.html"),
  docsPreview: join(repoDirs.dist, "docs-preview", "index.html"),
} as const;

/**
 * Shared Mermaid diagram inputs that should be processed before project diagrams.
 */
export const sharedDiagramInputs = [
  join(sourceInputDirs.diagrams, "diagram-style-key.mmd"),
] as const;

/**
 * Git hook configuration managed by the prepare script.
 */
export const gitHooksPath = ".githooks";

/**
 * Local HTTP server settings for opening generated coverage reports.
 */
export const coverageServer = {
  arg: "--serve-coverage-report",
  host: "127.0.0.1",
  port: 41737,
  waitStepMs: 100,
  waitTimeoutMs: 3000,
} as const;

/**
 * Local HTTP server settings for opening generated docs previews.
 */
export const docsPreviewServer = {
  arg: "--serve-docs-preview",
  defaultHost: "127.0.0.1",
  defaultPort: 41738,
  defaultWaitStepMs: 100,
  defaultWaitTimeoutMs: 3000,
  hostEnv: "DOCS_PREVIEW_HOST",
  portEnv: "DOCS_PREVIEW_PORT",
  waitStepMsEnv: "DOCS_PREVIEW_WAIT_STEP_MS",
  waitTimeoutMsEnv: "DOCS_PREVIEW_WAIT_TIMEOUT_MS",
} as const;

/**
 * Executable names that differ by platform.
 */
let bunExecutable = "bun";
/* istanbul ignore if -- Windows executable selection needs a Windows runtime. */
if (process.platform === "win32") bunExecutable = "bun.cmd";

export const executables = {
  bun: bunExecutable,
} as const;
