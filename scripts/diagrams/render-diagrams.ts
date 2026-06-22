import { runPhase } from "./diagram-runner.ts";
import { diagramsFromArgs, exitIfNoDiagrams, logWorkflowStep } from "./diagram-workflow.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import { logHeading, logSuccess } from "../core/script-logger.ts";

/**
 * Validates and renders diagrams for selected roots.
 *
 * @param {string[]} args - CLI args after the script name.
 */
export async function renderDiagrams(args: string[]): Promise<void> {
  const diagrams = diagramsFromArgs(args);

  exitIfNoDiagrams(diagrams);
  logHeading("Preparing diagram workflow", { count: diagrams.length });
  logWorkflowStep(1, 2, "Validating diagrams");
  await runPhase("validate", diagrams);
  logWorkflowStep(2, 2, "Rendering diagrams");
  await runPhase("render", diagrams);
  logSuccess("Rendered diagram(s)", diagrams.length);
}

if (isEntrypoint(import.meta.url)) {
  await renderDiagrams(process.argv.slice(2));
}
