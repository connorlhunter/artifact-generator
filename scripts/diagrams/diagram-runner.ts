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
 * @param job - Mermaid source and output metadata.
 * @param output - SVG destination path.
 * @param stamp - Whether this real render output should receive a metadata stamp.
 * @returns {Promise<{ input: string; output: string }>} Resolves when Mermaid succeeds.
 */
async function runMermaid(job: DiagramJob, output: string, stamp: boolean): Promise<DiagramJob> {
  await runCommand(executables.bun, ["x", "mmdc", "-i", job.input, "-o", output], {
    input: job.input,
    output,
  });
  if (stamp) {
    stampRenderedDiagram(output, { lastUpdated: job.lastUpdated, version: job.version });
  }
  return { ...job, output };
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
  return items.map((item) => ({
    ...item,
    output: phase === "validate" ? validateOutputPath(item.output) : item.output,
  }));
}

/**
 * Runs Mermaid for every item in a phase.
 *
 * @param {{ input: string; output: string }[]} items - Phase-specific Mermaid jobs.
 * @param stamp - Whether this phase writes real rendered SVG output.
 * @returns {Promise<PromiseSettledResult<{ input: string; output: string }>[]>} Phase results.
 */
function runPhaseItems(
  items: DiagramJob[],
  stamp: boolean,
): Promise<PromiseSettledResult<DiagramJob>[]> {
  return allSettledWithFirstPriority(items, (item) => runMermaid(item, item.output, stamp));
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

  logPhaseStart(phase, itemsForPhase);

  const failures = failedResults(await runPhaseItems(itemsForPhase, phase === "render"));

  if (failures.length === 0) {
    logPhaseSuccess(phase, items.length);
    return;
  }

  logPhaseFailures(phase, failures);
  process.exit(1);
}
