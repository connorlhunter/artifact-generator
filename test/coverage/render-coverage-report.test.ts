import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import {
  parseLcov,
  renderCoverageHtml,
  renderCoverageReport,
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
    const html = renderCoverageHtml(files, "2026-08-18");

    expect(files).toEqual([
      {
        path: "scripts/example.ts",
        lines: { covered: 3, found: 4 },
        functions: { covered: 1, found: 2 },
        branches: { covered: 1, found: 2 },
      },
    ]);
    expect(html).toContain("Artifact Generator Coverage");
    expect(html).toContain('<time datetime="2026-08-18">August 18, 2026</time>');
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

  test("writes the html report beside bun coverage output", async () => {
    spyOn(console, "log").mockImplementation(() => undefined);
    tempDir = mkdtempSync(join(tmpdir(), "coverage-report-"));
    const lcovPath = join(tempDir, "lcov.info");
    const outputPath = join(tempDir, "index.html");
    const manifestPath = join(tempDir, "content-manifest.json");
    writeFileSync(lcovPath, passingLcov);
    writeFileSync(manifestPath, JSON.stringify({ lastUpdated: "2026-08-18" }));

    await expect(
      renderCoverageReport(lcovPath, outputPath, undefined, { manifestPath }),
    ).resolves.toBe(outputPath);

    expect(readFileSync(outputPath, "utf8")).toContain("Artifact Generator Coverage");
    expect(readFileSync(outputPath, "utf8")).toContain(
      '<time datetime="2026-08-18">August 18, 2026</time>',
    );
  });

  test("fails when global coverage is below configured thresholds", async () => {
    spyOn(console, "log").mockImplementation(() => undefined);
    tempDir = mkdtempSync(join(tmpdir(), "coverage-report-"));
    const lcovPath = join(tempDir, "lcov.info");
    const outputPath = join(tempDir, "index.html");
    const manifestPath = join(tempDir, "content-manifest.json");
    writeFileSync(lcovPath, sampleLcov);
    writeFileSync(manifestPath, JSON.stringify({ lastUpdated: "2026-08-18" }));

    await expect(
      renderCoverageReport(lcovPath, outputPath, undefined, { manifestPath }),
    ).rejects.toThrow("Coverage threshold failed");
    expect(readFileSync(outputPath, "utf8")).toContain("Artifact Generator Coverage");
  });

  test("requires a valid shared publication date", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "coverage-report-"));
    const lcovPath = join(tempDir, "lcov.info");
    const outputPath = join(tempDir, "index.html");
    const manifestPath = join(tempDir, "content-manifest.json");
    writeFileSync(lcovPath, passingLcov);
    writeFileSync(manifestPath, JSON.stringify({}));

    await expect(
      renderCoverageReport(lcovPath, outputPath, undefined, { manifestPath }),
    ).rejects.toThrow("missing lastUpdated");

    writeFileSync(manifestPath, JSON.stringify({ lastUpdated: "August 18" }));

    await expect(
      renderCoverageReport(lcovPath, outputPath, undefined, { manifestPath }),
    ).rejects.toThrow("invalid lastUpdated");
  });
});
