import { describe, expect, mock, test } from "bun:test";
import {
  setupGitHooks,
  type GitHookRuntime,
  type SpawnSyncResult,
} from "../../scripts/git-hooks/setup-git-hooks.ts";

describe("setup git hooks", () => {
  test("configures the committed hooks path inside a Git repo", () => {
    const runtime = runtimeWithExitCodes([{ exitCode: 0 }, { exitCode: 0 }]);
    const log = mock();

    expect(setupGitHooks({ hooksPath: ".custom-hooks", log, runtime })).toBe(0);
    expect(runtime.spawnSync).toHaveBeenNthCalledWith(1, ["git", "rev-parse", "--git-dir"], {
      stdout: "ignore",
      stderr: "ignore",
    });
    expect(runtime.spawnSync).toHaveBeenNthCalledWith(
      2,
      ["git", "config", "core.hooksPath", ".custom-hooks"],
      {
        stdout: "inherit",
        stderr: "inherit",
      },
    );
    expect(log).toHaveBeenCalledWith("Configured Git hooks path: .custom-hooks");
  });

  test("skips setup outside a Git repo", () => {
    const runtime = runtimeWithExitCodes([{ exitCode: 1 }]);
    const log = mock();

    expect(setupGitHooks({ log, runtime })).toBe(0);
    expect(runtime.spawnSync).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("Skipping Git hook setup: not inside a Git repository.");
  });

  test("returns the Git config failure code", () => {
    const runtime = runtimeWithExitCodes([{ exitCode: 0 }, { exitCode: 128 }]);

    expect(setupGitHooks({ runtime })).toBe(128);
  });

  test("requires Bun runtime when runtime is unavailable", () => {
    if (!("Bun" in globalThis)) {
      expect(() => setupGitHooks()).toThrow("Bun runtime is required");
      return;
    }

    expect(() => setupGitHooks({ runtime: null })).toThrow("Bun runtime is required");
  });
});

function runtimeWithExitCodes(results: SpawnSyncResult[]): GitHookRuntime {
  return {
    spawnSync: mock(() => results.shift() ?? { exitCode: 0 }) as GitHookRuntime["spawnSync"],
  };
}
