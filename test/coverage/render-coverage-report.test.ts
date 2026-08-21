import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import {
  coverageUpdatedAt,
  parseLcov,
  renderCoverageHtml,
  renderCoverageReport,
  renderCoverageReportCli,
} from "../../scripts/coverage/render-coverage-report.ts";

const sampleLcov = `TN:
SF:scripts/example.ts
FNF:2
FNH:1
LF:4
LH:3
BRF:2
BRH:1
end_of_record
`;
const passingLcov = `TN:
SF:scripts/example.ts
FNF:2
FNH:2
LF:4
LH:4
end_of_record
`;

describe("render coverage report", () => {
  let tempDir = "";

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { force: true, recursive: true });
    tempDir = "";
    mock.restore();
  });

  test("parses lcov metrics and renders coverage html", () => {
    const files = parseLcov(sampleLcov);
    const html = renderCoverageHtml(files, "2026-08-18T14:42:31.123-04:00");

    expect(files).toEqual([
      {
        path: "scripts/example.ts",
        lines: { covered: 3, found: 4 },
        functions: { covered: 1, found: 2 },
        branches: { covered: 1, found: 2 },
      },
    ]);
    expect(html).toContain("Artifact Generator Coverage");
    expect(html).toContain(
      "Required minimum: 95% lines and functions. Generated from the Bun test suite for Artifact Generator.",
    );
    expect(html).toContain(
      '<time datetime="2026-08-18T18:42:31.123Z">Aug 18, 2026</time>',
    );
    expect(html).toContain('data-scheme="atlas"');
    expect(html).toContain("connorhunter.theme.scheme");
    expect(html).toContain('message.type.endsWith(messageSuffix)');
    expect(html).toContain("connorhunter.file-viewer.enter-fullscreen");
    expect(html).toContain('document.addEventListener("dblclick"');
    expect(html).toContain('document.addEventListener("pointerup"');
    expect(html).toContain("75.00%");
    expect(html).toContain("50.00%");
    expect(html).toContain("scripts/example.ts");
  });

  test("normalizes the project-owned publication timestamp", () => {
    expect(coverageUpdatedAt("2026-08-18T14:42:31.123-04:00")).toBe(
      "2026-08-18T18:42:31.123Z",
    );
    expect(() => coverageUpdatedAt("not-a-date")).toThrow(
      "Invalid coverage publication date",
    );
    expect(() => coverageUpdatedAt("August 18, 2026")).toThrow(
      "Invalid coverage publication date",
    );
    expect(() => coverageUpdatedAt("2026-08-18")).toThrow(
      "Invalid coverage publication date",
    );
    expect(() => coverageUpdatedAt("2026-02-30T12:00:00Z")).toThrow(
      "Invalid coverage publication date",
    );
  });

  test("writes the html report beside bun coverage output", async () => {
    spyOn(console, "log").mockImplementation(() => undefined);
    tempDir = mkdtempSync(join(tmpdir(), "coverage-report-"));
    const lcovPath = join(tempDir, "lcov.info");
    const outputPath = join(tempDir, "index.html");
    writeFileSync(lcovPath, passingLcov);

    await expect(
      renderCoverageReport(lcovPath, outputPath, undefined, {
        updatedAt: "2026-08-18T14:42:31.123-04:00",
      }),
    ).resolves.toBe(outputPath);

    expect(readFileSync(outputPath, "utf8")).toContain("Artifact Generator Coverage");
    expect(readFileSync(outputPath, "utf8")).toContain(
      '<time datetime="2026-08-18T18:42:31.123Z">Aug 18, 2026</time>',
    );
  });

  test("fails when global coverage is below configured thresholds", async () => {
    spyOn(console, "log").mockImplementation(() => undefined);
    tempDir = mkdtempSync(join(tmpdir(), "coverage-report-"));
    const lcovPath = join(tempDir, "lcov.info");
    const outputPath = join(tempDir, "index.html");
    writeFileSync(lcovPath, sampleLcov);

    await expect(
      renderCoverageReport(lcovPath, outputPath, undefined, {
        updatedAt: "2026-08-18T14:42:31.123-04:00",
      }),
    ).rejects.toThrow("Coverage threshold failed");
    expect(readFileSync(outputPath, "utf8")).toContain("Artifact Generator Coverage");
  });

  test("requires a valid project-owned publication date", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "coverage-report-"));
    const lcovPath = join(tempDir, "lcov.info");
    const outputPath = join(tempDir, "index.html");
    writeFileSync(lcovPath, passingLcov);

    await expect(
      renderCoverageReport(lcovPath, outputPath, undefined, { updatedAt: "not-a-date" }),
    ).rejects.toThrow("Invalid coverage publication date");
  });

  test("returns a command-line failure code when rendering fails", async () => {
    const errors: unknown[] = [];

    expect(await renderCoverageReportCli(async () => "coverage/index.html")).toBe(0);
    expect(
      await renderCoverageReportCli(
        async () => Promise.reject(new Error("coverage failed")),
        (error) => errors.push(error),
      ),
    ).toBe(1);
    expect(errors).toEqual([new Error("coverage failed")]);
  });
});
