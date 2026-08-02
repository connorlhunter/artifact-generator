import { existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const localSourceInputPrefix = "local=";

export interface SourceInputSelection {
  readonly args: string[];
  readonly mode: "cache" | "local";
  readonly root: string;
}

/**
 * Selects the source input root without passing the local selector downstream.
 *
 * @param args - CLI args after the script name.
 * @param env - Environment values containing the default cache path.
 * @param cwd - Directory used to resolve a relative local path.
 * @returns Source input selection and remaining command args.
 */
export function selectSourceInputs(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): SourceInputSelection {
  const localArgs = args.filter((arg) => arg.startsWith(localSourceInputPrefix));

  if (localArgs.length > 1) {
    throw new Error("Pass local=<path> only once.");
  }

  const commandArgs = args.filter((arg) => !arg.startsWith(localSourceInputPrefix));
  const [localArg] = localArgs;

  if (localArg !== undefined) {
    const localPath = localArg.slice(localSourceInputPrefix.length).trim();
    if (!localPath) throw new Error("local=<path> requires a directory path.");

    return {
      args: commandArgs,
      mode: "local",
      root: resolve(cwd, localPath),
    };
  }

  return {
    args: commandArgs,
    mode: "cache",
    root: env.SOURCE_INPUT_CACHE_DIR?.trim() || join(tmpdir(), "artifact-generator-source-cache"),
  };
}

export const sourceInputSelection = selectSourceInputs(process.argv.slice(2));

/**
 * @param args - CLI args that may contain a local source selector.
 * @returns Args intended for the underlying docs or diagram command.
 */
export function sourceInputCommandArgs(args: string[]): string[] {
  return selectSourceInputs(args).args;
}

/**
 * Fails early when an explicitly selected local bundle cannot be read.
 *
 * @param selection - Source input selection to validate.
 */
export function validateSourceInputSelection(
  selection: SourceInputSelection = sourceInputSelection,
): void {
  if (selection.mode !== "local") return;

  if (!existsSync(selection.root)) {
    throw new Error(`Local source input directory does not exist: ${selection.root}`);
  }

  if (!statSync(selection.root).isDirectory()) {
    throw new Error(`Local source input path is not a directory: ${selection.root}`);
  }
}
