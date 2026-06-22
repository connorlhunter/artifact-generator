import { resolve } from "node:path";
import { runCommand } from "./process-utils.ts";

type PlatformOpener = readonly [command: string, ...args: string[]];

const openers: Partial<Record<typeof process.platform, PlatformOpener>> = {
  darwin: ["open"],
  win32: ["cmd", "/c", "start", ""],
  linux: ["xdg-open"],
};

/**
 * Gets the default file opener command for the current operating system.
 *
 * @returns {string[] | null} Command and base args for opening a file.
 */
function platformOpener(): PlatformOpener | null {
  return openers[process.platform] ?? null;
}

/**
 * Opens one URL using the operating system default app.
 *
 * @param {string} target - URL to open.
 * @param {string} contextFile - File or URL to report in command context.
 * @returns {Promise<string>} Resolves with the URL after opening succeeds.
 */
async function openDefaultTarget(target: string, contextFile: string): Promise<string> {
  const opener = platformOpener();

  if (!opener) {
    throw {
      file: contextFile,
      error: new Error(`No default file opener configured for ${process.platform}.`),
    };
  }

  const [command, ...baseArgs] = opener;
  const args = [...baseArgs, target];
  await runCommand(command, args, { file: contextFile });
  return target;
}

/**
 * Opens one file using the operating system default app.
 *
 * @param {string} file - File path to open.
 * @returns {Promise<string>} Resolves with the file path after opening succeeds.
 */
export async function openDefaultFile(file: string): Promise<string> {
  await openDefaultTarget(resolve(file), file);
  return file;
}

/**
 * Opens one URL using the operating system default app.
 *
 * @param {string} url - URL to open.
 * @returns {Promise<string>} Resolves with the URL after opening succeeds.
 */
export async function openDefaultUrl(url: string): Promise<string> {
  return openDefaultTarget(url, url);
}
