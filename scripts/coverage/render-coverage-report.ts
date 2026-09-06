import { dirname } from "node:path";
import { ensureDirectory, readText, writeText } from "../core/file-system.ts";
import { artifactPaths } from "../core/script-constants.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import { logCaughtError, logSuccess } from "../core/script-logger.ts";
import { validateUpdatedDate } from "../core/versioned-artifact-metadata.ts";

import { parseLcov, coverageTotals, type CoverageFile, type CoverageMetric } from "./lcov.ts";
export { parseLcov, coverageTotals, type CoverageFile, type CoverageMetric } from "./lcov.ts";

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

function percent(metric: CoverageMetric): number {
  return metric.found === 0 ? 100 : (metric.covered / metric.found) * 100;
}

function assertCoverageThresholds(
  files: ReadonlyArray<CoverageFile>,
  thresholds: CoverageThresholds,
): void {
  const total = coverageTotals(files);
  if (files.length === 0 || total.lines.found === 0)
    throw new Error("Coverage report contains no measured lines.");
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

  if (Number.isNaN(timestamp.getTime()))
    throw new Error(`Invalid coverage publication date: ${value}`);

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
