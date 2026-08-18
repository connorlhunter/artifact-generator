import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { publicDocsUrl, renderDocsPdf } from "../../scripts/docs/render-docs-pdf.ts";
import { renderDocsPreviewPdf } from "../../scripts/docs/render-docs-preview-pdf.ts";

describe("renderDocsPdf", () => {
  const originalCwd = process.cwd();
  let tempDir = "";

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { force: true, recursive: true });
  });

  test("renders a standalone preview as a PDF", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "docs-pdf-"));
    const input = join(tempDir, "index.html");
    const output = join(tempDir, "index.pdf");

    writeFileSync(
      input,
      '<!doctype html><title>Docs</title><main><a href="diagrams/cipher/cipher-overview.html">Diagram</a></main>',
    );

    expect(
      await renderDocsPdf(
        input,
        output,
        "https://d1y1afhnwsku2p.cloudfront.net/docs/cipher/index.html",
      ),
    ).toBe(output);
    expect(existsSync(output)).toBe(true);
    const pdf = readFileSync(output);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.toString()).toContain(
      "https://d1y1afhnwsku2p.cloudfront.net/diagrams/cipher/cipher-overview.svg",
    );
  });

  test("builds public docs URLs without a trailing origin slash", () => {
    expect(publicDocsUrl("connor-hunter", "https://artifacts.example.com/")).toBe(
      "https://artifacts.example.com/docs/connor-hunter/index.html",
    );
    expect(publicDocsUrl("connor-hunter", "")).toBeUndefined();
  });

  test("renders the selected preview before printing its PDF", async () => {
    const calls: string[] = [];

    await expect(
      renderDocsPreviewPdf(["artifact-generator"], {
        renderPreview: async (args) => {
          calls.push(`preview:${args.join(",")}`);
          return "dist/docs-preview/index.html";
        },
        renderPdf: async (input, output) => {
          calls.push(`pdf:${input}:${output}`);
          return output ?? "";
        },
      }),
    ).resolves.toBe("dist/docs-preview/index.pdf");

    expect(calls).toEqual([
      "preview:artifact-generator",
      "pdf:dist/docs-preview/index.html:dist/docs-preview/index.pdf",
    ]);
  });

  test("rebuilds the selected preview when no preview exists", async () => {
    const fixture = resolve(originalCwd, "test/resources/repo-fixture");
    tempDir = mkdtempSync(join(tmpdir(), "docs-preview-pdf-"));
    cpSync(fixture, tempDir, { recursive: true });
    const icon = join(tempDir, "tmp/s3-inputs/assets/icons/docs-fixture/mark.svg");
    mkdirSync(dirname(icon), { recursive: true });
    cpSync(join(tempDir, "icons/docs-fixture/mark.svg"), icon);
    process.chdir(tempDir);

    expect(existsSync("dist/docs-preview/index.html")).toBe(false);
    await expect(renderDocsPreviewPdf(["docs-fixture"])).resolves.toBe(
      "dist/docs-preview/index.pdf",
    );
    expect(existsSync("dist/docs-preview/index.html")).toBe(true);
    expect(existsSync("dist/docs-preview/index.pdf")).toBe(true);
  });
});
