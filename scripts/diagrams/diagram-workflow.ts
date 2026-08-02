import { findDiagrams, getDiagramRoots } from "./diagram-utils.ts";
import { logError, logStep } from "../core/script-logger.ts";
import {
  sourceInputCommandArgs,
  validateSourceInputSelection,
} from "../core/source-input-selection.ts";
import type { DiagramJob } from "./diagram-types.ts";

/**
 * Logs a simple numbered workflow step for multi-phase commands.
 *
 * @param {number} step - Current step number.
 * @param {number} total - Total number of steps.
 * @param {string} label - Step label.
 */
export function logWorkflowStep(step: number, total: number, label: string): void {
  logStep(step, total, label);
}

/**
 * Finds diagrams for the current CLI invocation.
 *
 * @param {string[]} args - CLI args after the script name.
 * @returns {{ input: string; output: string }[]} Mermaid render jobs.
 */
export function diagramsFromArgs(args: string[]): DiagramJob[] {
  validateSourceInputSelection();
  return findDiagrams(getDiagramRoots(sourceInputCommandArgs(args)));
}

/**
 * Exits when no diagrams are available for the selected roots.
 *
 * @param {{ input: string; output: string }[]} diagrams - Mermaid render jobs.
 */
export function exitIfNoDiagrams(diagrams: DiagramJob[]): void {
  if (diagrams.length > 0) return;

  logError("No Mermaid diagrams found.");
  process.exit(1);
}

/**
 * Returns SVG outputs for a set of Mermaid render jobs.
 *
 * @param {{ output: string }[]} diagrams - Mermaid render jobs.
 * @returns {string[]} SVG output paths.
 */
export function diagramOutputs(diagrams: DiagramJob[]): string[] {
  return diagrams.map(({ output }) => output);
}
