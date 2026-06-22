import { runPhase } from "./diagram-runner.ts";
import { diagramsFromArgs, exitIfNoDiagrams, logWorkflowStep } from "./diagram-workflow.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import { logHeading } from "../core/script-logger.ts";

/**
 * Validates diagrams for selected roots.
 *
 * @param {string[]} args - CLI args after the script name.
 */
export async function validateDiagrams(args: string[]): Promise<void> {
  const diagrams = diagramsFromArgs(args);

  exitIfNoDiagrams(diagrams);
  logHeading("Validating diagram(s)", { count: diagrams.length, color: "cyan" });
  logWorkflowStep(1, 1, "Validating diagrams");
  await runPhase("validate", diagrams);
}

if (isEntrypoint(import.meta.url)) {
  await validateDiagrams(process.argv.slice(2));
}
