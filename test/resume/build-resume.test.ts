import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { buildResume, validateResumePdf } from "../../scripts/resume/build-resume.ts";

describe("build resume", () => {
  let tempDirectory = "";

  beforeEach(() => {
    tempDirectory = mkdtempSync(join(tmpdir(), "artifact-resume-"));
  });

  afterEach(() => {
    rmSync(tempDirectory, { force: true, recursive: true });
  });

  test("compiles and copies the generated PDF", async () => {
    const projectDirectory = join(tempDirectory, "resume-source");
    const generatedPdf = join(projectDirectory, "build", "resume.pdf");
    const outputPdf = join(tempDirectory, "dist", "resume.pdf");

    const result = await buildResume({
      generatedPdf,
      outputPdf,
      projectDirectory,
      runner: async (command, args, context, options) => {
        expect(command).toBe("tectonic");
        expect(args).toEqual(["-X", "build", "--untrusted", "--keep-logs"]);
        expect(context).toMatchObject({ output: outputPdf });
        expect(options).toEqual({ cwd: projectDirectory });
        writeFixtureFile(generatedPdf, "%PDF-1.7\nfixture");
        return { stderr: "", stdout: "built" };
      },
    });

    expect(result).toBe(outputPdf);
    expect(readFileSync(outputPdf, "utf8")).toBe("%PDF-1.7\nfixture");
  });

  test("rejects a missing generated PDF", () => {
    expect(() => validateResumePdf(join(tempDirectory, "missing.pdf"))).toThrow(
      "Resume build did not produce",
    );
  });

  test("rejects an empty generated PDF", () => {
    const path = join(tempDirectory, "empty.pdf");
    writeFileSync(path, "");

    expect(() => validateResumePdf(path)).toThrow("Resume build produced an empty PDF");
  });

  test("rejects a file without a PDF signature", () => {
    const path = join(tempDirectory, "invalid.pdf");
    writeFileSync(path, "not a pdf");

    expect(() => validateResumePdf(path)).toThrow("Resume build produced an invalid PDF");
  });
});

function writeFixtureFile(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}
