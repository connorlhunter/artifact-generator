import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { renderCoveragePdf } from "../../scripts/coverage/render-coverage-pdf.ts";

describe("renderCoveragePdf", () => {
  let tempDir = "";

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  test("renders a standalone coverage report as a PDF", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "coverage-pdf-"));
    const input = join(tempDir, "index.html");
    const output = join(tempDir, "index.pdf");
    writeFileSync(input, "<!doctype html><title>Coverage</title><main><h1>Coverage</h1></main>");

    expect(await renderCoveragePdf(input, output)).toBe(output);
    expect(existsSync(output)).toBe(true);
    expect(readFileSync(output).subarray(0, 4).toString()).toBe("%PDF");
  });
});
