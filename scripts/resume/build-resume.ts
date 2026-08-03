import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname } from "node:path";
import type { CommandContext, CommandOptions, CommandOutput } from "../core/command-types.ts";
import { copyFile, ensureDirectory, removePath } from "../core/bun-native-fs.ts";
import { artifactPaths, executables, repoDirs } from "../core/script-constants.ts";
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
  readonly generatedPdf?: string;
  readonly outputPdf?: string;
  readonly projectDirectory?: string;
  readonly runner?: CommandRunner;
}

/**
 * Confirms a generated file is a non-empty PDF.
 *
 * @param path - PDF path to validate.
 */
export function validateResumePdf(path: string): void {
  if (!existsSync(path)) {
    throw new Error(`Resume build did not produce ${path}`);
  }

  if (statSync(path).size < 5) {
    throw new Error(`Resume build produced an empty PDF: ${path}`);
  }

  if (readFileSync(path).subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error(`Resume build produced an invalid PDF: ${path}`);
  }
}

/**
 * Compiles the tracked LaTeX resume and copies the PDF into generated outputs.
 *
 * @param options - Optional paths and runner for tests.
 * @returns Generated resume PDF path.
 */
export async function buildResume(options: BuildResumeOptions = {}): Promise<string> {
  const generatedPdf = options.generatedPdf ?? artifactPaths.resumeBuildPdf;
  const outputPdf = options.outputPdf ?? artifactPaths.resumePdf;
  const projectDirectory = options.projectDirectory ?? repoDirs.resume;
  const runner = options.runner ?? runCommand;

  await removePath(dirname(generatedPdf));
  await removePath(outputPdf);

  logHeading("Building resume PDF");
  await runner(
    executables.tectonic,
    ["-X", "build", "--untrusted", "--keep-logs"],
    { input: artifactPaths.resumeConfig, output: outputPdf },
    { cwd: projectDirectory },
  );

  validateResumePdf(generatedPdf);
  ensureDirectory(dirname(outputPdf));
  await copyFile(generatedPdf, outputPdf);
  logSuccess(`Built resume: ${outputPdf}`);

  return outputPdf;
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
