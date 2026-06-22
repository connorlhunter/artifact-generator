import { pathExists } from "../core/bun-native-fs.ts";
import {
  allSettledWithPriorityPrefix,
  compactName,
  failedResults,
  isOverviewDiagram,
} from "./diagram-utils.ts";
import { openDefaultFile } from "../core/file-opener.ts";
import {
  type FailureDetails,
  logCommandHint,
  logError,
  logErrorItem,
  logFailureDetails,
  logHeading,
  logItem,
  logSuccess,
} from "../core/script-logger.ts";
import type { CommandFailure } from "../core/command-types.ts";

type OpenFailure = CommandFailure & {
  file?: string;
};

/**
 * Opens one rendered SVG using the operating system default app.
 *
 * @param {string} file - SVG path to open.
 * @returns {Promise<string>} Resolves with the file path after opening succeeds.
 */
async function openFile(file: string): Promise<string> {
  return openDefaultFile(file);
}

/**
 * Logs the files that will be opened.
 *
 * @param {string[]} files - SVG files to open.
 */
function logOpenStart(files: string[]): void {
  logHeading("Opening", { count: files.length });
  for (const file of files) logItem(compactName(file));
}

/**
 * Logs missing rendered SVGs and exits.
 *
 * @param {string[]} missing - Missing SVG files.
 */
function exitForMissingFiles(missing: string[]): never {
  logError("Missing rendered SVG(s)", missing.length);
  for (const file of missing) logErrorItem(file);
  logCommandHint("bun run diagrams:render -- cipher");
  process.exit(1);
}

/**
 * Logs failures from the open phase and exits.
 *
 * @param {PromiseRejectedResult[]} failures - Open failures.
 */
function exitForOpenFailures(failures: PromiseRejectedResult[]): never {
  logError("Opening failed", failures.length);

  for (const failure of failures) {
    const reason = failure.reason as OpenFailure;
    const details: FailureDetails = {};
    if (reason.error) details.error = reason.error;
    if (reason.stderr) details.stderr = reason.stderr;
    if (reason.stdout) details.stdout = reason.stdout;
    if (reason.file) details.subject = reason.file;
    logFailureDetails(details, "unknown file");
  }

  process.exit(1);
}

/**
 * Returns true when a rendered file should open before detail diagrams.
 *
 * @param {string} file - Rendered SVG path.
 * @returns {boolean} Whether the file is part of the priority open prefix.
 */
function isPriorityOpenFile(file: string): boolean {
  const sourcePath = file.replace(/\.svg$/, ".mmd");
  return sourcePath.endsWith("diagram-style-key.mmd") || isOverviewDiagram(sourcePath);
}

/**
 * Counts the sorted priority prefix that should open before detail diagrams.
 *
 * @param {string[]} files - Rendered SVG files.
 * @returns {number} Number of leading files to open sequentially.
 */
function priorityOpenCount(files: string[]): number {
  return files.findIndex((file) => !isPriorityOpenFile(file));
}

/**
 * Opens the shared key and project overview files before opening details.
 *
 * The discovery layer sorts the shared key first and project overview diagrams
 * next, so this keeps those files first in the default application while
 * preserving parallel opens for the remaining detail diagrams.
 *
 * @param {string[]} files - SVG files to open.
 * @returns {Promise<PromiseSettledResult<string>[]>} Open results.
 */
async function openFilesWithFirstFilePriority(
  files: string[],
): Promise<PromiseSettledResult<string>[]> {
  const priorityCount = priorityOpenCount(files);
  return allSettledWithPriorityPrefix(
    files,
    priorityCount === -1 ? files.length : priorityCount,
    openFile,
  );
}

/**
 * Opens all rendered diagram SVGs concurrently and reports all failures at the end.
 *
 * @param {string[]} files - SVG files to open.
 * @returns {Promise<void>} Resolves when every file opens successfully.
 */
export async function openRenderedDiagrams(files: string[]): Promise<void> {
  const missingChecks = await Promise.all(
    files.map(async (file): Promise<[string, boolean]> => [file, await pathExists(file)]),
  );
  const missing = missingChecks.filter(([, exists]) => !exists).map(([file]) => file);

  if (missing.length > 0) exitForMissingFiles(missing);

  logOpenStart(files);
  const failures = failedResults(await openFilesWithFirstFilePriority(files));

  if (failures.length === 0) {
    logSuccess("Opened diagram(s)", files.length);
    return;
  }

  exitForOpenFailures(failures);
}
