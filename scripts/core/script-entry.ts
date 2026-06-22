import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Returns true when a module is being run directly by Bun.
 *
 * @param {string} moduleUrl - Current module URL.
 * @returns {boolean} Whether the module is the process entrypoint.
 */
export function isEntrypoint(moduleUrl: string): boolean {
  return process.argv[1] !== undefined && fileURLToPath(moduleUrl) === resolve(process.argv[1]);
}
