import { existsSync, readFileSync } from "node:fs";
import { artifactPaths } from "../core/script-constants.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import { logError, logSuccess } from "../core/script-logger.ts";
import { writePdf } from "../pdf/write-pdf.ts";
import type { CoverageArtifact, CoverageMetric } from "./render-coverage-report.ts";

function metricLabel(metric: CoverageMetric): string {
  const percentage = metric.found === 0 ? 100 : (metric.covered / metric.found) * 100;
  return `${percentage.toFixed(2)}% (${metric.covered}/${metric.found})`;
}

/** Renders the structured coverage artifact as a direct PDF download. */
export async function renderCoveragePdf(
  input = artifactPaths.coverageReport,
  output = artifactPaths.coverageReportPdf,
): Promise<string> {
  if (!existsSync(input)) throw new Error(`Missing coverage artifact: ${input}.`);

  const coverage = JSON.parse(readFileSync(input, "utf8")) as CoverageArtifact;
  await writePdf({
    output,
    sections: coverage.surfaces.map((surface) => ({
      blocks: [
        {
          type: "table",
          rows: [
            ["File", "Lines", "Functions", "Branches"],
            [
              "All files",
              metricLabel(surface.totals.lines),
              metricLabel(surface.totals.functions),
              metricLabel(surface.totals.branches),
            ],
            ...surface.files.map((file) => [
              file.path,
              metricLabel(file.lines),
              metricLabel(file.functions),
              metricLabel(file.branches),
            ]),
          ].map((row) => row.map((value) => [{ type: "text", value } as const])),
        },
      ],
      heading: surface.label,
    })),
    subtitle: `Updated ${coverage.updatedAt}. Required minimum: ${coverage.minimumCoverage.lines}% lines and ${coverage.minimumCoverage.functions}% functions.`,
    title: "Artifact Generator Coverage",
  });
  logSuccess(`Rendered coverage PDF: ${output}`);

  return output;
}

/* istanbul ignore next */
if (isEntrypoint(import.meta.url)) {
  try {
    await renderCoveragePdf();
  } catch (error) {
    logError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
