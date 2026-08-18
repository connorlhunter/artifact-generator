import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  buildResume,
  readResumeProjectConfig,
  validateResumePdf,
} from "../../scripts/resume/build-resume.ts";

describe("build resume", () => {
  let tempDirectory = "";

  beforeEach(() => {
    tempDirectory = mkdtempSync(join(tmpdir(), "artifact-resume-"));
  });

  afterEach(() => {
    rmSync(tempDirectory, { force: true, recursive: true });
  });

  test("compiles and copies the generated PDF", async () => {
    const sourceDirectory = join(tempDirectory, "resume-source");
    const buildDirectory = join(tempDirectory, "resume-build");
    const generatedPdf = join(buildDirectory, "build", "fixture-resume", "fixture-output.pdf");
    const outputPdf = join(tempDirectory, "dist", "resume.pdf");
    writeResumeSource(sourceDirectory);
    writeFixtureFile(join(sourceDirectory, "build", "stale.pdf"), "%PDF-stale");

    const result = await buildResume({
      buildDirectory,
      outputPdf,
      runner: async (command, args, context, options) => {
        expect(command).toBe("tectonic");
        expect(args).toEqual(["-X", "build", "--untrusted", "--keep-logs"]);
        expect(context).toEqual({
          input: join(buildDirectory, "Tectonic.toml"),
          output: outputPdf,
        });
        expect(options).toEqual({ cwd: buildDirectory });
        expect(existsSync(join(buildDirectory, "src", "index.tex"))).toBe(true);
        expect(existsSync(join(buildDirectory, "build", "stale.pdf"))).toBe(false);
        writeFixtureFile(generatedPdf, "%PDF-1.7\nfixture");
        return { stderr: "", stdout: "built" };
      },
      sourceDirectory,
    });

    expect(result).toBe(outputPdf);
    expect(readFileSync(outputPdf, "utf8")).toBe("%PDF-1.7\nfixture");
    expect(existsSync(buildDirectory)).toBe(false);
    expect(existsSync(join(sourceDirectory, "build", "stale.pdf"))).toBe(true);
  });

  test("reads document and PDF output names from Tectonic config", async () => {
    const sourceDirectory = join(tempDirectory, "resume-source");
    writeResumeSource(sourceDirectory);

    await expect(readResumeProjectConfig(sourceDirectory)).resolves.toEqual({
      documentName: "fixture-resume",
      outputName: "fixture-output",
    });
  });

  test("requires a selected resume source project", async () => {
    const sourceDirectory = join(tempDirectory, "missing");

    await expect(readResumeProjectConfig(sourceDirectory)).rejects.toThrow(
      "Missing resume source directory",
    );

    mkdirSync(sourceDirectory, { recursive: true });
    await expect(readResumeProjectConfig(sourceDirectory)).rejects.toThrow(
      "Missing resume source config",
    );
  });

  test("requires a named PDF output in Tectonic config", async () => {
    const sourceDirectory = join(tempDirectory, "resume-source");
    writeFixtureFile(join(sourceDirectory, "Tectonic.toml"), '[doc]\nname = "fixture-resume"\n');

    await expect(readResumeProjectConfig(sourceDirectory)).rejects.toThrow(
      "must define a named PDF output",
    );
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

function writeResumeSource(sourceDirectory: string): void {
  writeFixtureFile(
    join(sourceDirectory, "Tectonic.toml"),
    '[doc]\nname = "fixture-resume"\n\n[[output]]\nname = "fixture-output"\ntype = "pdf"\ninputs = ["index.tex"]\n',
  );
  writeFixtureFile(join(sourceDirectory, "src", "index.tex"), "\\documentclass{article}");
}
