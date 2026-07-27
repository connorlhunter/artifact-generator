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

const coverageThemeStorageKeys = ["connorhunter.theme.scheme", "portfolio.theme.scheme"] as const;
const coverageThemeSchemes = {
  atlas: {
    accent: "#0f6b7a",
    accentSoft: "#e4f3f5",
    bg: "#f4f6f8",
    border: "#d8dee8",
    colorScheme: "light",
    muted: "#667085",
    panel: "#ffffff",
    text: "#17202a",
  },
  paper: {
    accent: "#68737a",
    accentSoft: "#ecefed",
    bg: "#f6f6f3",
    border: "#dcdfdc",
    colorScheme: "light",
    muted: "#697176",
    panel: "#ffffff",
    text: "#1f2528",
  },
  citrine: {
    accent: "#766f18",
    accentSoft: "#eeebc7",
    bg: "#f7f6ea",
    border: "#dedbb8",
    colorScheme: "light",
    muted: "#70705c",
    panel: "#fffef8",
    text: "#20231a",
  },
  harbor: {
    accent: "#35b8cd",
    accentSoft: "#0e2f3a",
    bg: "#111a24",
    border: "#2a3a4c",
    colorScheme: "dark",
    muted: "#7d92a8",
    panel: "#1a2636",
    text: "#dde4ee",
  },
  midnight: {
    accent: "#5fc0ee",
    accentSoft: "#0d3040",
    bg: "#06111a",
    border: "#1f3547",
    colorScheme: "dark",
    muted: "#89a6b8",
    panel: "#0b1a24",
    text: "#eaf6ff",
  },
  onyx: {
    accent: "#8fb4ff",
    accentSoft: "#182234",
    bg: "#0b0d10",
    border: "#2a3139",
    colorScheme: "dark",
    muted: "#9aa4ad",
    panel: "#14181d",
    text: "#edf0f2",
  },
  rose: {
    accent: "#9e4c58",
    accentSoft: "#f1e6e8",
    bg: "#fbf6f7",
    border: "#e2d2d5",
    colorScheme: "light",
    muted: "#74676b",
    panel: "#ffffff",
    text: "#241b1e",
  },
  tide: {
    accent: "#3f82a8",
    accentSoft: "#e4f0f6",
    bg: "#f2f8fb",
    border: "#d2e2ea",
    colorScheme: "light",
    muted: "#627584",
    panel: "#ffffff",
    text: "#17242c",
  },
  ember: {
    accent: "#df6532",
    accentSoft: "#ffe8d8",
    bg: "#fff7e8",
    border: "#efd8bd",
    colorScheme: "light",
    muted: "#7a6658",
    panel: "#fffdf9",
    text: "#251a12",
  },
  quartz: {
    accent: "#7c6f9f",
    accentSoft: "#eeeaf8",
    bg: "#f7f5fb",
    border: "#ddd7ed",
    colorScheme: "light",
    muted: "#706b7a",
    panel: "#ffffff",
    text: "#211f29",
  },
} as const;

function coverageThemeCss(): string {
  const themeBlocks = Object.entries(coverageThemeSchemes)
    .map(
      ([scheme, tokens]) => `:root[data-scheme="${scheme}"] {
      color-scheme: ${tokens.colorScheme};
      --bg: ${tokens.bg};
      --panel: ${tokens.panel};
      --text: ${tokens.text};
      --muted: ${tokens.muted};
      --border: ${tokens.border};
      --accent: ${tokens.accent};
      --accent-soft: ${tokens.accentSoft};
    }`,
    )
    .join("\n\n    ");

  const atlas = coverageThemeSchemes.atlas;

  return `:root {
      color-scheme: ${atlas.colorScheme};
      --bg: ${atlas.bg};
      --panel: ${atlas.panel};
      --text: ${atlas.text};
      --muted: ${atlas.muted};
      --border: ${atlas.border};
      --accent: ${atlas.accent};
      --accent-soft: ${atlas.accentSoft};
    }

    ${themeBlocks}`;
}

function coverageThemeScript(): string {
  return `<script>
    (() => {
      const schemes = new Set(${JSON.stringify(Object.keys(coverageThemeSchemes))});
      const storageKeys = ${JSON.stringify([...coverageThemeStorageKeys])};
      const messageSuffix = ".theme.scheme";
      const fallback = window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "midnight"
        : "atlas";

      function savedScheme() {
        for (const key of storageKeys) {
          try {
            const value = window.localStorage.getItem(key);
            if (schemes.has(value)) return value;
          } catch {}
        }
        return null;
      }

      function applyScheme(scheme) {
        if (!schemes.has(scheme)) return;
        document.documentElement.dataset.scheme = scheme;
        try {
          window.localStorage.setItem(storageKeys[0], scheme);
        } catch {}
      }

      applyScheme(savedScheme() || fallback);

      window.addEventListener("message", (event) => {
        const message = event.data;
        if (!message || typeof message !== "object") return;
        if (!schemes.has(message.scheme)) return;
        if (typeof message.type === "string" && !message.type.endsWith(messageSuffix)) return;
        applyScheme(message.scheme);
      });
    })();
  </script>`;
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
<html data-scheme="atlas" lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Artifact Generator Coverage</title>
  <style>
    ${coverageThemeCss()}

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 0.9375rem/1.5 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    main {
      width: min(100%, 72rem);
      margin: 0 auto;
      padding: clamp(1.25rem, 4vw, 3rem);
    }

    header {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    h1 {
      margin: 0;
      font-size: clamp(1.75rem, 4vw, 2.75rem);
      line-height: 1.05;
    }

    p {
      margin: 0.5rem 0 0;
      color: var(--muted);
    }

    .table-wrap {
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      background: var(--panel);
    }

    table {
      width: 100%;
      min-width: 46rem;
      border-collapse: collapse;
    }

    th,
    td {
      border-bottom: 1px solid var(--border);
      padding: 0.85rem 1rem;
      text-align: left;
      vertical-align: top;
    }

    thead th {
      color: var(--muted);
      font-size: 0.75rem;
      letter-spacing: 0;
      text-transform: uppercase;
    }

    tbody tr:first-child {
      background: color-mix(in srgb, var(--accent) 10%, transparent);
      font-weight: 800;
    }

    tbody tr:last-child th,
    tbody tr:last-child td {
      border-bottom: 0;
    }

    td span {
      display: block;
      color: var(--muted);
      font-size: 0.8rem;
      font-weight: 600;
    }

    @media print {
      @page {
        size: letter landscape;
        margin: 0.45in;
      }

      html,
      body {
        background: #ffffff;
        color: #17202a;
      }

      main {
        width: 100%;
        padding: 0;
      }

      header {
        margin-bottom: 0.75rem;
      }

      .table-wrap {
        overflow: visible;
        border: 0;
      }

      table {
        min-width: 0;
      }

      th,
      td {
        padding: 0.45rem 0.55rem;
      }

      th:first-child {
        overflow-wrap: anywhere;
      }
    }
  </style>
  ${coverageThemeScript()}
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Artifact Generator Coverage</h1>
        <p>Bun test coverage generated from the Artifact Generator test suite.</p>
      </div>
    </header>
    <div class="table-wrap">
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
    </div>
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
