import {
  allSettledWithFirstPriority,
  compactName,
  failedResults,
  groupByProject,
  validateOutputPath,
} from "./diagram-utils.ts";
import { stampRenderedDiagram } from "./stamp-diagram.ts";
import { runCommand } from "../core/process-utils.ts";
import { executables } from "../core/script-constants.ts";
import { readArtifactUpdatedDate } from "../publish/update-content-manifest.ts";
import {
  type FailureDetails,
  logErrorHeading,
  logFailureDetails,
  logGroup,
  logHeading,
  logItem,
  logSuccess,
} from "../core/script-logger.ts";
import type { CommandFailure } from "../core/command-types.ts";
import type { DiagramJob, DiagramPhase } from "./diagram-types.ts";

type DiagramFailure = CommandFailure & {
  input?: string;
};

/**
 * Runs Mermaid CLI asynchronously for one diagram.
 *
 * Spawns `mmdc` through Bun and captures stdout/stderr so failures can be
 * reported cleanly after all diagrams in the phase have finished.
 *
 * @param {string} input - Mermaid source path.
 * @param {string} output - SVG destination path.
 * @param lastUpdated - Source publication date added to rendered SVG output.
 * @returns {Promise<{ input: string; output: string }>} Resolves when Mermaid succeeds.
 */
async function runMermaid(
  input: string,
  output: string,
  lastUpdated?: string,
): Promise<DiagramJob> {
  await runCommand(executables.bun, ["x", "mmdc", "-i", input, "-o", output], {
    input,
    output,
  });
  if (lastUpdated !== undefined) stampRenderedDiagram(output, lastUpdated);
  return { input, output };
}

/**
 * Logs all Mermaid jobs for a phase before async execution starts.
 *
 * @param {"validate" | "render"} phase - Current processing phase.
 * @param {{ input: string; output: string }[]} items - Mermaid jobs.
 */
function logPhaseStart(phase: DiagramPhase, items: DiagramJob[]): void {
  const label = phase === "validate" ? "Validating" : "Rendering";
  const groups = groupByProject(items);

  for (const [project, groupItems] of groups.entries()) {
    logHeading(label, {
      color: phase === "validate" ? "cyan" : "blue",
    });
    logGroup(project, groupItems.length);

    for (const { input } of groupItems) {
      logItem(compactName(input), 2);
    }
  }
}

/**
 * Logs all collected failures for a Mermaid phase.
 *
 * @param {"validate" | "render"} phase - Current processing phase.
 * @param {PromiseRejectedResult[]} failures - Rejected Promise.allSettled results.
 */
function logPhaseFailures(phase: DiagramPhase, failures: PromiseRejectedResult[]): void {
  const label = phase === "validate" ? "Validation" : "Rendering";

  logErrorHeading(`${label} failed`, failures.length);

  for (const failure of failures) {
    const reason = failure.reason as DiagramFailure;
    const details: FailureDetails = {};
    if (reason.error) details.error = reason.error;
    if (reason.stderr) details.stderr = reason.stderr;
    if (reason.stdout) details.stdout = reason.stdout;
    if (reason.input) details.subject = compactName(reason.input);
    logFailureDetails(details, "unknown diagram");
  }
}

/**
 * Returns phase-specific render jobs.
 *
 * @param {"validate" | "render"} phase - Current processing phase.
 * @param {{ input: string; output: string }[]} items - Original Mermaid jobs.
 * @returns {{ input: string; output: string }[]} Jobs for the phase.
 */
function phaseItems(phase: DiagramPhase, items: DiagramJob[]): DiagramJob[] {
  return items.map(({ input, output }) => ({
    input,
    output: phase === "validate" ? validateOutputPath(output) : output,
  }));
}

/**
 * Runs Mermaid for every item in a phase.
 *
 * @param {{ input: string; output: string }[]} items - Phase-specific Mermaid jobs.
 * @param lastUpdated - Source publication date added to rendered SVG output.
 * @returns {Promise<PromiseSettledResult<{ input: string; output: string }>[]>} Phase results.
 */
function runPhaseItems(
  items: DiagramJob[],
  lastUpdated?: string,
): Promise<PromiseSettledResult<DiagramJob>[]> {
  return allSettledWithFirstPriority(items, ({ input, output }) =>
    runMermaid(input, output, lastUpdated),
  );
}

/**
 * Logs the success line for a finished phase.
 *
 * @param {"validate" | "render"} phase - Current processing phase.
 * @param {number} count - Number of processed diagrams.
 */
function logPhaseSuccess(phase: DiagramPhase, count: number): void {
  const label = phase === "validate" ? "Validation passed" : "Rendering passed";
  logSuccess(label, count);
}

/**
 * Runs one Mermaid processing phase for all diagrams concurrently.
 *
 * Validation writes output to a temp location using `validateOutputPath` so it
 * does not modify generated SVGs in the docs tree. Rendering writes to the real
 * SVG destination.
 *
 * Uses `Promise.allSettled` so every diagram in the phase gets a chance to run.
 * If any diagram fails, all collected failures are logged before the process exits.
 *
 * @param {"validate" | "render"} phase - Current processing phase.
 * @param {{ input: string; output: string }[]} items - Diagrams to process.
 * @returns {Promise<void>} Resolves when every diagram in the phase succeeds.
 */
export async function runPhase(phase: DiagramPhase, items: DiagramJob[]): Promise<void> {
  const itemsForPhase = phaseItems(phase, items);
  const lastUpdated = phase === "render" ? readArtifactUpdatedDate() : undefined;

  logPhaseStart(phase, itemsForPhase);

  const failures = failedResults(await runPhaseItems(itemsForPhase, lastUpdated));

  if (failures.length === 0) {
    logPhaseSuccess(phase, items.length);
    return;
  }

  logPhaseFailures(phase, failures);
  process.exit(1);
}
