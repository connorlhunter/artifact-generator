import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  coverageArtifact,
  coverageUpdatedAt,
  coverageTotals,
  parseLcov,
  renderCoverageReport,
} from "../../scripts/coverage/render-coverage-report.ts";
import { renderCoveragePdf } from "../../scripts/coverage/render-coverage-pdf.ts";

const lcov = `SF:src/example.ts
LF:10
LH:10
FNF:2
FNH:2
BRF:0
BRH:0
end_of_record
`;

describe("coverage artifact", () => {
  let temporaryDirectory = "";

  afterEach(() => {
    if (temporaryDirectory) rmSync(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = "";
  });

  test("publishes structured totals instead of a browser report", () => {
    const files = parseLcov(lcov);
    const artifact = coverageArtifact(files, "2026-08-27T12:00:00Z");

    expect(artifact.schemaVersion).toBe(2);
    expect(artifact.surfaces[0]?.files[0]?.path).toBe("src/example.ts");
    expect(coverageTotals(files).lines).toEqual({ covered: 10, found: 10 });
  });

  test("rejects reports below the fixed release threshold and invalid dates", () => {
    const files = parseLcov(lcov.replace("LH:10", "LH:9").replace("FNH:2", "FNH:1"));

    expect(() => coverageArtifact(files, "2026-08-27T12:00:00Z")).toThrow(
      "Coverage threshold failed",
    );
    expect(() => coverageUpdatedAt("not-a-date")).toThrow("Invalid coverage publication date");
    expect(() => coverageUpdatedAt("+010000-01-01T00:00:00.000Z")).toThrow(
      "Invalid coverage publication date",
    );
  });

  test("writes structured coverage and a direct PDF download", async () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "artifact-coverage-"));
    const lcovPath = join(temporaryDirectory, "lcov.info");
    const reportPath = join(temporaryDirectory, "coverage", "index.json");
    const pdfPath = join(temporaryDirectory, "coverage", "coverage.pdf");
    writeFileSync(lcovPath, lcov);

    await expect(
      renderCoverageReport(lcovPath, reportPath, { functions: 100, lines: 100 }, {
        updatedAt: "2026-08-27T12:00:00.000Z",
      }),
    ).resolves.toBe(reportPath);
    await expect(renderCoveragePdf(reportPath, pdfPath)).resolves.toBe(pdfPath);

    expect(JSON.parse(readFileSync(reportPath, "utf8"))).toMatchObject({
      minimumCoverage: { functions: 100, lines: 100 },
      schemaVersion: 2,
      updatedAt: "2026-08-27T12:00:00.000Z",
    });
    expect(existsSync(pdfPath)).toBe(true);
    expect(readFileSync(pdfPath).subarray(0, 4).toString()).toBe("%PDF");
  });

  test("requires a generated coverage JSON before rendering its PDF", async () => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "artifact-coverage-"));

    await expect(
      renderCoveragePdf(join(temporaryDirectory, "missing.json"), join(temporaryDirectory, "report.pdf")),
    ).rejects.toThrow("Missing coverage artifact");
  });
});
