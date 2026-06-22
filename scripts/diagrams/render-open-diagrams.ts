import { runPhase } from "./diagram-runner.ts";
import { openRenderedDiagrams } from "./diagram-opener.ts";
import {
  diagramOutputs,
  diagramsFromArgs,
  exitIfNoDiagrams,
  logWorkflowStep,
} from "./diagram-workflow.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import { logHeading } from "../core/script-logger.ts";

/**
 * Validates, renders, and opens diagrams for selected roots.
 *
 * @param {string[]} args - CLI args after the script name.
 */
export async function renderOpenDiagrams(args: string[]): Promise<void> {
  const diagrams = diagramsFromArgs(args);

  exitIfNoDiagrams(diagrams);
  logHeading("Preparing diagram workflow", { count: diagrams.length });
  logWorkflowStep(1, 3, "Validating diagrams");
  await runPhase("validate", diagrams);
  logWorkflowStep(2, 3, "Rendering diagrams");
  await runPhase("render", diagrams);
  logWorkflowStep(3, 3, "Opening diagrams");
  await openRenderedDiagrams(diagramOutputs(diagrams));
}

if (isEntrypoint(import.meta.url)) {
  await renderOpenDiagrams(process.argv.slice(2));
}
