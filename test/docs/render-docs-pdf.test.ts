import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { publicDocsUrl, renderDocsPdf } from "../../scripts/docs/render-docs-pdf.ts";

describe("renderDocsPdf", () => {
  let tempDir = "";

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  test("renders a standalone preview as a PDF", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "docs-pdf-"));
    const input = join(tempDir, "index.html");
    const output = join(tempDir, "index.pdf");

    writeFileSync(input, "<!doctype html><title>Docs</title><main><h1>Docs</h1></main>");

    await expect(renderDocsPdf(input, output)).resolves.toBe(output);
    expect(existsSync(output)).toBe(true);
    expect(readFileSync(output).subarray(0, 4).toString()).toBe("%PDF");
  });

  test("builds public docs URLs without a trailing origin slash", () => {
    expect(publicDocsUrl("connor-hunter", "https://artifacts.example.com/")).toBe(
      "https://artifacts.example.com/docs/connor-hunter/index.html",
    );
    expect(publicDocsUrl("connor-hunter", "")).toBeUndefined();
  });
});
