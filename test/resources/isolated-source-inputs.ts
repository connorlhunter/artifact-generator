import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";

/**
 * Test-owned working directory used to bind source-input constants away from
 * the repository's S3 cache.
 */
export interface IsolatedSourceInputs {
  /** Absolute test workspace used while importing source-dependent scripts. */
  readonly workspace: string;
  /** Expected source-input cache root inside the test workspace. */
  readonly sourceInputRoot: string;
  /** Removes only the test-owned source-input cache. */
  reset(actualSourceInputRoot: string): void;
  /** Removes the full test-owned workspace. */
  dispose(): void;
}

/**
 * Creates a temporary workspace for tests that import source-input constants.
 *
 * `script-constants.ts` resolves its cache root while it is imported, so tests
 * should temporarily change into `workspace` before importing source-dependent
 * scripts. Cleanup is guarded to reject any path outside this workspace.
 *
 * @returns Test-owned source input workspace.
 */
export function createIsolatedSourceInputs(): IsolatedSourceInputs {
  const workspace = realpathSync(mkdtempSync(join(tmpdir(), "artifact-source-input-test-")));
  const sourceInputRoot = join(workspace, "tmp", "s3-inputs");

  return {
    workspace,
    sourceInputRoot,
    reset(actualSourceInputRoot) {
      if (resolve(actualSourceInputRoot) !== sourceInputRoot) {
        throw new Error(
          `Refusing to remove a non-test source input root: ${actualSourceInputRoot}`,
        );
      }

      removeOwnedPath(workspace, sourceInputRoot);
    },
    dispose() {
      removeOwnedPath(workspace, workspace);
    },
  };
}

function removeOwnedPath(workspace: string, target: string): void {
  const relativeTarget = relative(workspace, target);

  if (relativeTarget !== "" && (relativeTarget === ".." || relativeTarget.startsWith(`..${sep}`))) {
    throw new Error(`Refusing to remove a path outside test workspace: ${target}`);
  }

  rmSync(target, { force: true, recursive: true });
}
