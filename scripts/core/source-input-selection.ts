import { existsSync, lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const localSourceInputPrefix = "local=";
export const sourceInputCacheRoot = join("tmp", "s3-inputs");
export const localSourceInputBundlesRoot = join("tmp", "local-source-bundles");

export interface SourceInputSelection {
  readonly args: string[];
  readonly mode: "cache" | "local";
  readonly root: string;
}

/**
 * Selects the source input root without passing the local selector downstream.
 *
 * @param args - CLI args after the script name.
 * @param cwd - Repository directory containing controlled source bundles.
 * @returns Source input selection and remaining command args.
 */
export function selectSourceInputs(args: string[], cwd = process.cwd()): SourceInputSelection {
  const localArgs = args.filter((arg) => arg.startsWith(localSourceInputPrefix));

  if (localArgs.length > 1) {
    throw new Error("Pass local=<bundle> only once.");
  }

  const commandArgs = args.filter((arg) => !arg.startsWith(localSourceInputPrefix));
  const [localArg] = localArgs;

  if (localArg !== undefined) {
    const bundleName = localArg.slice(localSourceInputPrefix.length).trim();
    if (!bundleName) throw new Error("local=<bundle> requires a bundle name.");

    const root = localBundleRoot(bundleName, cwd);

    return {
      args: commandArgs,
      mode: "local",
      root,
    };
  }

  return {
    args: commandArgs,
    mode: "cache",
    root: join(cwd, sourceInputCacheRoot),
  };
}

export const sourceInputSelection = selectSourceInputs(process.argv.slice(2));

/**
 * @param args - CLI args that may contain a local source selector.
 * @returns Args intended for the underlying docs or diagram command.
 */
export function sourceInputCommandArgs(args: string[]): string[] {
  return args.filter((arg) => !arg.startsWith(localSourceInputPrefix));
}

/**
 * Fails early when a selected source bundle is not a real, symlink-free directory.
 *
 * @param selection - Source input selection to validate.
 */
export function validateSourceInputSelection(
  selection: SourceInputSelection = sourceInputSelection,
): void {
  if (!existsSync(selection.root)) {
    if (selection.mode === "cache") return;
    throw new Error(`Source input directory does not exist: ${selection.root}`);
  }

  if (!lstatSync(selection.root).isDirectory()) {
    throw new Error(`Source input path is not a directory: ${selection.root}`);
  }

  assertSymlinkFreeTree(selection.root);
}

/**
 * Resolves a selected local bundle from the controlled local bundle directory.
 *
 * @param requestedName - Name passed through the local selector.
 * @returns A trusted local bundle root.
 */
function localBundleRoot(requestedName: string, cwd: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(requestedName)) {
    throw new Error("local=<bundle> must use a lowercase bundle name.");
  }
  const bundlesRoot = join(cwd, localSourceInputBundlesRoot);
  if (!existsSync(bundlesRoot)) {
    throw new Error(`Local source bundle directory does not exist: ${bundlesRoot}`);
  }

  const bundle = readdirSync(bundlesRoot, { withFileTypes: true }).find(
    (entry) => entry.name === requestedName && entry.isDirectory() && !entry.isSymbolicLink(),
  );
  if (bundle === undefined) {
    throw new Error(`Local source bundle does not exist: ${requestedName}`);
  }

  return join(bundlesRoot, bundle.name);
}

/**
 * Rejects symlinks before source files are parsed, copied, or published.
 *
 * @param directory - Source directory to inspect.
 */
function assertSymlinkFreeTree(directory: string): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) {
      throw new Error(`Source input bundles cannot contain symlinks: ${path}`);
    }
    if (stat.isDirectory()) assertSymlinkFreeTree(path);
  }
}
