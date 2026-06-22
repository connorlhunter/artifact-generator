import { gitHooksPath } from "../core/script-constants.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import { logSuccess } from "../core/script-logger.ts";

/**
 * Minimal synchronous process result used by Bun.spawnSync.
 */
export interface SpawnSyncResult {
  /**
   * Process exit code.
   */
  exitCode: number;
}

/**
 * Minimal Bun runtime shape used by the hook setup script.
 */
export interface GitHookRuntime {
  /**
   * Runs a command synchronously and returns its exit code.
   */
  spawnSync(
    command: string[],
    options: { stdout: "ignore" | "inherit"; stderr: "ignore" | "inherit" },
  ): SpawnSyncResult;
}

/**
 * Dependencies for Git hook setup.
 */
export interface SetupGitHooksDependencies {
  /**
   * Git hooks path to write into local Git config.
   */
  hooksPath?: string;
  /**
   * Success logger.
   */
  log?: (message: string) => void;
  /**
   * Runtime used to run Git commands. Pass `null` in tests to assert that a
   * runtime is required without depending on the current test runner.
   */
  runtime?: GitHookRuntime | null;
}

const runtime = (globalThis as typeof globalThis & { Bun?: GitHookRuntime }).Bun;

/**
 * Configures Git to use the committed `.githooks` directory.
 *
 * @param {SetupGitHooksDependencies} dependencies - Optional test overrides.
 * @returns {number} Exit code for the prepare command.
 */
export function setupGitHooks(dependencies: SetupGitHooksDependencies = {}): number {
  const hooksPath = dependencies.hooksPath ?? gitHooksPath;
  const log = dependencies.log ?? logSuccess;
  const gitRuntime = dependencies.runtime === undefined ? runtime : dependencies.runtime;

  if (!gitRuntime) {
    throw new Error("Bun runtime is required to configure Git hooks.");
  }

  const repo = gitRuntime.spawnSync(["git", "rev-parse", "--git-dir"], {
    stdout: "ignore",
    stderr: "ignore",
  });

  if (repo.exitCode !== 0) {
    log("Skipping Git hook setup: not inside a Git repository.");
    return 0;
  }

  const config = gitRuntime.spawnSync(["git", "config", "core.hooksPath", hooksPath], {
    stdout: "inherit",
    stderr: "inherit",
  });

  if (config.exitCode !== 0) return config.exitCode;

  log(`Configured Git hooks path: ${hooksPath}`);
  return 0;
}

/* istanbul ignore next */
if (isEntrypoint(import.meta.url)) {
  process.exit(setupGitHooks());
}
