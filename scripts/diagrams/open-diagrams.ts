import { openRenderedDiagrams } from "./diagram-opener.ts";
import {
  diagramOutputs,
  diagramsFromArgs,
  exitIfNoDiagrams,
  logWorkflowStep,
} from "./diagram-workflow.ts";
import { isEntrypoint } from "../core/script-entry.ts";

/**
 * Opens rendered diagrams for selected roots.
 *
 * @param {string[]} args - CLI args after the script name.
 */
export async function openDiagrams(args: string[]): Promise<void> {
  const diagrams = diagramsFromArgs(args);

  exitIfNoDiagrams(diagrams);
  logWorkflowStep(1, 1, "Opening diagrams");
  await openRenderedDiagrams(diagramOutputs(diagrams));
}

if (isEntrypoint(import.meta.url)) {
  await openDiagrams(process.argv.slice(2));
}
