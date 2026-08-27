import { dirname } from "node:path";
import { ensureDirectory, readText, writeText } from "../core/bun-native-fs.ts";
import { artifactPaths } from "../core/script-constants.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import { logCaughtError, logSuccess } from "../core/script-logger.ts";
import { validateUpdatedDate } from "../core/versioned-artifact-metadata.ts";

/** A coverage count used by the Portfolio coverage reader. */
export interface CoverageMetric {
  readonly covered: number;
  readonly found: number;
}

/** One source file reported by Bun's LCOV output. */
export interface CoverageFile {
  readonly branches: CoverageMetric;
  readonly functions: CoverageMetric;
  readonly lines: CoverageMetric;
  readonly path: string;
}

/** Public JSON contract for the Artifact Generator coverage surface. */
export interface CoverageArtifact {
  readonly minimumCoverage: { readonly functions: number; readonly lines: number };
  readonly schemaVersion: 2;
  readonly surfaces: ReadonlyArray<{
    readonly files: ReadonlyArray<CoverageFile>;
    readonly id: string;
    readonly label: string;
    readonly totals: CoverageFile;
  }>;
  readonly updatedAt: string;
}

export interface CoverageThresholds {
  readonly functions: number;
  readonly lines: number;
}

/** Optional project-owned coverage publication metadata. */
export interface RenderCoverageReportOptions {
  readonly updatedAt?: string;
}

const defaultCoverageThresholds: CoverageThresholds = { functions: 95, lines: 95 };

function emptyMetric(): CoverageMetric {
  return { covered: 0, found: 0 };
}

/** Parses Bun's LCOV output into per-file coverage records. */
export function parseLcov(lcov: string): CoverageFile[] {
  const files: CoverageFile[] = [];
  let current: CoverageFile | undefined;

  for (const line of lcov.split(/\r?\n/u)) {
    if (line.startsWith("SF:")) {
      current = {
        branches: emptyMetric(),
        functions: emptyMetric(),
        lines: emptyMetric(),
        path: line.slice(3),
      };
      continue;
    }

    if (!current) continue;

    if (line.startsWith("LF:")) current = { ...current, lines: { ...current.lines, found: value(line) } };
    if (line.startsWith("LH:")) current = { ...current, lines: { ...current.lines, covered: value(line) } };
    if (line.startsWith("FNF:")) current = { ...current, functions: { ...current.functions, found: value(line) } };
    if (line.startsWith("FNH:")) current = { ...current, functions: { ...current.functions, covered: value(line) } };
    if (line.startsWith("BRF:")) current = { ...current, branches: { ...current.branches, found: value(line) } };
    if (line.startsWith("BRH:")) current = { ...current, branches: { ...current.branches, covered: value(line) } };

    if (line === "end_of_record") {
      files.push(current);
      current = undefined;
    }
  }

  return files;
}

function value(line: string): number {
  return Number(line.split(":")[1] ?? 0);
}

function addMetric(left: CoverageMetric, right: CoverageMetric): CoverageMetric {
  return { covered: left.covered + right.covered, found: left.found + right.found };
}

/** Aggregates source records into one reader-friendly total. */
export function coverageTotals(files: ReadonlyArray<CoverageFile>): CoverageFile {
  return files.reduce<CoverageFile>(
    (total, file) => ({
      branches: addMetric(total.branches, file.branches),
      functions: addMetric(total.functions, file.functions),
      lines: addMetric(total.lines, file.lines),
      path: "All files",
    }),
    { branches: emptyMetric(), functions: emptyMetric(), lines: emptyMetric(), path: "All files" },
  );
}

function percent(metric: CoverageMetric): number {
  return metric.found === 0 ? 100 : (metric.covered / metric.found) * 100;
}

function assertCoverageThresholds(files: ReadonlyArray<CoverageFile>, thresholds: CoverageThresholds): void {
  const total = coverageTotals(files);
  const failures = [
    { actual: percent(total.lines), minimum: thresholds.lines, name: "lines" },
    { actual: percent(total.functions), minimum: thresholds.functions, name: "functions" },
  ]
    .filter((item) => item.actual < item.minimum)
    .map((item) => `${item.name} ${item.actual.toFixed(2)}% < ${item.minimum.toFixed(2)}%`);

  if (failures.length > 0) throw new Error(`Coverage threshold failed: ${failures.join(", ")}`);
}

/** Normalizes a coverage publication timestamp to canonical UTC. */
export function coverageUpdatedAt(value: string): string {
  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) throw new Error(`Invalid coverage publication date: ${value}`);

  try {
    validateUpdatedDate(timestamp.toISOString().slice(0, 10), "coverage publication date");
  } catch {
    throw new Error(`Invalid coverage publication date: ${value}`);
  }

  return timestamp.toISOString();
}

/** Builds the public JSON model from one LCOV report. */
export function coverageArtifact(
  files: ReadonlyArray<CoverageFile>,
  updatedAt: string,
  thresholds: CoverageThresholds = defaultCoverageThresholds,
): CoverageArtifact {
  assertCoverageThresholds(files, thresholds);

  return {
    minimumCoverage: { functions: thresholds.functions, lines: thresholds.lines },
    schemaVersion: 2,
    surfaces: [
      {
        files: [...files].sort((left, right) => left.path.localeCompare(right.path)),
        id: "typescript",
        label: "TypeScript",
        totals: coverageTotals(files),
      },
    ],
    updatedAt: coverageUpdatedAt(updatedAt),
  };
}

/** Writes Artifact Generator coverage as structured JSON. */
export async function renderCoverageReport(
  lcovPath = artifactPaths.coverageLcov,
  outputPath = artifactPaths.coverageReport,
  thresholds = defaultCoverageThresholds,
  options: RenderCoverageReportOptions = {},
): Promise<string> {
  const artifact = coverageArtifact(
    parseLcov(await readText(lcovPath)),
    options.updatedAt ?? new Date().toISOString(),
    thresholds,
  );

  ensureDirectory(dirname(outputPath));
  await writeText(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  logSuccess(`Rendered coverage artifact: ${outputPath}`);

  return outputPath;
}

/* istanbul ignore next */
if (isEntrypoint(import.meta.url)) {
  try {
    await renderCoverageReport();
  } catch (error) {
    logCaughtError(error);
    process.exit(1);
  }
}
