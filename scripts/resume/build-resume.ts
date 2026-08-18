import { cpSync, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { TOML } from "bun";
import type { CommandContext, CommandOptions, CommandOutput } from "../core/command-types.ts";
import { copyFile, ensureDirectory, removePath } from "../core/bun-native-fs.ts";
import { artifactPaths, executables, sourceInputDirs } from "../core/script-constants.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import { logCaughtError, logHeading, logSuccess } from "../core/script-logger.ts";
import { runCommand } from "../core/process-utils.ts";

type CommandRunner = (
  command: string,
  args: string[],
  context?: CommandContext,
  options?: CommandOptions,
) => Promise<CommandOutput>;

/**
 * Configurable paths and process runner used by resume builds and tests.
 */
export interface BuildResumeOptions {
  readonly buildDirectory?: string;
  readonly generatedPdf?: string;
  readonly outputPdf?: string;
  readonly runner?: CommandRunner;
  readonly sourceDirectory?: string;
}

interface TectonicProjectConfig {
  readonly doc?: {
    readonly name?: unknown;
  };
  readonly output?: ReadonlyArray<{
    readonly name?: unknown;
    readonly type?: unknown;
  }>;
}

interface ResumeProjectConfig {
  readonly documentName: string;
  readonly outputName: string;
}

/**
 * Reads the document and PDF output names from a resume Tectonic project.
 *
 * @param sourceDirectory - Selected resume source directory.
 * @returns Names used by Tectonic's generated PDF path.
 */
export async function readResumeProjectConfig(
  sourceDirectory: string,
): Promise<ResumeProjectConfig> {
  if (!existsSync(sourceDirectory) || !statSync(sourceDirectory).isDirectory()) {
    throw new Error(`Missing resume source directory: ${sourceDirectory}`);
  }

  const configPath = join(sourceDirectory, "Tectonic.toml");
  let configContents: string;
  try {
    configContents = await Bun.file(configPath).text();
  } catch {
    throw new Error(`Missing resume source config: ${configPath}`);
  }

  const config = TOML.parse(configContents) as unknown as TectonicProjectConfig;
  const documentName = nonEmptyString(config.doc?.name);
  const pdfOutput = config.output?.find((output) => output.type === "pdf");
  const outputName = nonEmptyString(pdfOutput?.name);

  if (!documentName) {
    throw new Error(`Resume source config must define doc.name: ${configPath}`);
  }
  if (!outputName) {
    throw new Error(`Resume source config must define a named PDF output: ${configPath}`);
  }

  return { documentName, outputName };
}

/**
 * Confirms a generated file is a non-empty PDF.
 *
 * @param path - PDF path to validate.
 */
export function validateResumePdf(path: string): void {
  let pdf: Buffer;
  try {
    pdf = readFileSync(path);
  } catch {
    throw new Error(`Resume build did not produce ${path}`);
  }

  if (pdf.length < 5) {
    throw new Error(`Resume build produced an empty PDF: ${path}`);
  }

  if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error(`Resume build produced an invalid PDF: ${path}`);
  }
}

/**
 * Compiles the selected LaTeX resume and copies the PDF into generated outputs.
 *
 * @param options - Optional paths and runner for tests.
 * @returns Generated resume PDF path.
 */
export async function buildResume(options: BuildResumeOptions = {}): Promise<string> {
  const sourceDirectory = options.sourceDirectory ?? sourceInputDirs.resume;
  const buildDirectory = options.buildDirectory ?? artifactPaths.resumeBuildDir;
  const outputPdf = options.outputPdf ?? artifactPaths.resumePdf;
  const runner = options.runner ?? runCommand;
  const project = await readResumeProjectConfig(sourceDirectory);

  if (resolve(sourceDirectory) === resolve(buildDirectory)) {
    throw new Error("Resume build directory must be separate from the selected source directory.");
  }

  const generatedPdf =
    options.generatedPdf ??
    join(buildDirectory, "build", project.documentName, `${project.outputName}.pdf`);

  await removePath(buildDirectory);
  await removePath(outputPdf);
  cpSync(sourceDirectory, buildDirectory, {
    dereference: true,
    filter: (path) => {
      const sourceRelativePath = relative(sourceDirectory, path);
      return sourceRelativePath === "" || sourceRelativePath.split(sep)[0] !== "build";
    },
    recursive: true,
  });

  logHeading("Building resume PDF");
  try {
    await runner(
      executables.tectonic,
      ["-X", "build", "--untrusted", "--keep-logs"],
      { input: join(buildDirectory, "Tectonic.toml"), output: outputPdf },
      { cwd: buildDirectory },
    );

    validateResumePdf(generatedPdf);
    ensureDirectory(dirname(outputPdf));
    await copyFile(generatedPdf, outputPdf);
    logSuccess(`Built resume: ${outputPdf}`);
  } finally {
    await removePath(buildDirectory);
  }

  return outputPdf;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/* istanbul ignore next */
if (isEntrypoint(import.meta.url)) {
  try {
    await buildResume();
  } catch (error) {
    logCaughtError(error);
    process.exit(1);
  }
}
