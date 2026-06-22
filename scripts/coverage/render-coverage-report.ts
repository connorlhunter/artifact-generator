import { dirname } from "node:path";
import { ensureDirectory, readText, writeText } from "../core/bun-native-fs.ts";
import { artifactPaths } from "../core/script-constants.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import { logCaughtError, logSuccess } from "../core/script-logger.ts";

interface CoverageMetric {
  covered: number;
  found: number;
}

interface CoverageFile {
  path: string;
  lines: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
}

export interface CoverageThresholds {
  /**
   * Minimum global function coverage percentage.
   */
  functions: number;
  /**
   * Minimum global line coverage percentage.
   */
  lines: number;
}

const defaultCoverageThresholds: CoverageThresholds = {
  functions: 96,
  lines: 93,
};

const emptyMetric = (): CoverageMetric => ({ covered: 0, found: 0 });

/**
 * Parses Bun's LCOV output into per-file coverage records.
 *
 * @param {string} lcov - Raw LCOV contents.
 * @returns {CoverageFile[]} Coverage records.
 */
export function parseLcov(lcov: string): CoverageFile[] {
  const files: CoverageFile[] = [];
  let current: CoverageFile | null = null;

  for (const line of lcov.split(/\r?\n/)) {
    if (line.startsWith("SF:")) {
      current = {
        path: line.slice(3),
        lines: emptyMetric(),
        functions: emptyMetric(),
        branches: emptyMetric(),
      };
      continue;
    }

    if (!current) continue;

    applyMetricLine(current, line);

    if (line === "end_of_record") {
      files.push(current);
      current = null;
    }
  }

  return files;
}

function applyMetricLine(file: CoverageFile, line: string): void {
  if (line.startsWith("LF:")) file.lines.found = numberValue(line);
  else if (line.startsWith("LH:")) file.lines.covered = numberValue(line);
  else if (line.startsWith("FNF:")) file.functions.found = numberValue(line);
  else if (line.startsWith("FNH:")) file.functions.covered = numberValue(line);
  else if (line.startsWith("BRF:")) file.branches.found = numberValue(line);
  else if (line.startsWith("BRH:")) file.branches.covered = numberValue(line);
}

function numberValue(line: string): number {
  return Number(line.split(":")[1] ?? 0);
}

function totals(files: CoverageFile[]): CoverageFile {
  return files.reduce<CoverageFile>(
    (total, file) => ({
      path: "All files",
      lines: addMetric(total.lines, file.lines),
      functions: addMetric(total.functions, file.functions),
      branches: addMetric(total.branches, file.branches),
    }),
    {
      path: "All files",
      lines: emptyMetric(),
      functions: emptyMetric(),
      branches: emptyMetric(),
    },
  );
}

function addMetric(left: CoverageMetric, right: CoverageMetric): CoverageMetric {
  return {
    covered: left.covered + right.covered,
    found: left.found + right.found,
  };
}

function percent(metric: CoverageMetric): number {
  if (metric.found === 0) return 100;
  return (metric.covered / metric.found) * 100;
}

function percentLabel(metric: CoverageMetric): string {
  return `${percent(metric).toFixed(2)}%`;
}

function assertCoverageThresholds(
  files: CoverageFile[],
  thresholds: CoverageThresholds,
): void {
  const total = totals(files);
  const linePercent = percent(total.lines);
  const functionPercent = percent(total.functions);
  const failures: string[] = [];

  if (linePercent < thresholds.lines) {
    failures.push(`lines ${linePercent.toFixed(2)}% < ${thresholds.lines.toFixed(2)}%`);
  }

  if (functionPercent < thresholds.functions) {
    failures.push(
      `functions ${functionPercent.toFixed(2)}% < ${thresholds.functions.toFixed(2)}%`,
    );
  }

  if (failures.length > 0) {
    throw new Error(`Coverage threshold failed: ${failures.join(", ")}`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function metricCell(metric: CoverageMetric): string {
  return `<td>${percentLabel(metric)} <span>${metric.covered}/${metric.found}</span></td>`;
}

function fileRow(file: CoverageFile): string {
  return `<tr>
    <th scope="row">${escapeHtml(file.path)}</th>
    ${metricCell(file.lines)}
    ${metricCell(file.functions)}
    ${metricCell(file.branches)}
  </tr>`;
}

/**
 * Renders a compact HTML coverage report from parsed LCOV records.
 *
 * @param {CoverageFile[]} files - Coverage records.
 * @returns {string} Standalone HTML report.
 */
export function renderCoverageHtml(files: CoverageFile[]): string {
  const total = totals(files);
  const rows = [total, ...files].map(fileRow).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Artifact Generator Coverage</title>
  <style>
    body {
      margin: 0;
      background: #ffffff;
      color: #17202a;
      font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    main {
      width: min(100% - 32px, 1100px);
      margin: 0 auto;
      padding: 32px 0;
    }

    h1 {
      margin: 0 0 6px;
      font-size: 28px;
      line-height: 1.2;
    }

    p {
      margin: 0 0 22px;
      color: #667085;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      overflow: hidden;
      border: 1px solid #d8dee8;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 18px 50px rgb(23 32 42 / 8%);
    }

    th,
    td {
      border-bottom: 1px solid #d8dee8;
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
    }

    tr:last-child th,
    tr:last-child td {
      border-bottom: 0;
    }

    tbody tr:first-child {
      background: #eef3f6;
      font-weight: 700;
    }

    td span {
      display: block;
      color: #667085;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <main>
    <h1>Artifact Generator Coverage</h1>
    <p>This report is generated from Bun LCOV output for the Artifact Generator repository.</p>
    <table>
      <thead>
        <tr>
          <th scope="col">File</th>
          <th scope="col">Lines</th>
          <th scope="col">Functions</th>
          <th scope="col">Branches</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </main>
</body>
</html>`;
}

/**
 * Writes the HTML coverage report expected by `coverage:open`.
 *
 * @param {string} lcovPath - LCOV input path.
 * @param {string} outputPath - HTML output path.
 * @returns {Promise<string>} Written HTML path.
 */
export async function renderCoverageReport(
  lcovPath: string = artifactPaths.coverageLcov,
  outputPath: string = artifactPaths.coverageReport,
  thresholds: CoverageThresholds = defaultCoverageThresholds,
): Promise<string> {
  const files = parseLcov(await readText(lcovPath));
  ensureDirectory(dirname(outputPath));
  await writeText(outputPath, renderCoverageHtml(files));
  assertCoverageThresholds(files, thresholds);
  logSuccess(`Rendered HTML coverage report: ${outputPath}`);
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
