import { existsSync, lstatSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { sourceInputRoot } from "../core/script-constants.ts";
import { validateSourceInputSelection } from "../core/source-input-selection.ts";
import { ensureDirectory } from "../core/file-system.ts";
import { runCommand } from "../core/process-utils.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import {
  logCaughtError,
  logError,
  logFailureDetails,
  logHeading,
  logItem,
  logSuccess,
  isFailureDetails,
} from "../core/script-logger.ts";
import { hasSourceEntries, sourceInputPlans, sourceInputS3Uri } from "./source-input-plans.ts";

interface SourceSyncPlan {
  readonly bucket: string;
  readonly label: string;
  readonly prefix: string;
  readonly required: boolean;
  readonly sourceFolder: string;
  readonly target: string;
}

export interface SyncSourceInputsOptions {
  readonly commandRunner?: typeof runCommand;
  readonly env?: NodeJS.ProcessEnv;
}

/** Replaces the working bundle only after all downloads have succeeded. */
function replaceSourceRoot(staged: string): void {
  const backup = `${staged}-previous`;
  const hadPrevious = existsSync(sourceInputRoot) || isSymlink(sourceInputRoot);
  if (hadPrevious) renameSync(sourceInputRoot, backup);
  try {
    renameSync(staged, sourceInputRoot);
  } catch (error) {
    if (hadPrevious) renameSync(backup, sourceInputRoot);
    throw error;
  }
  rmSync(backup, { force: true, recursive: true });
}

/**
 * @param path - Local path to inspect.
 * @returns Whether the path is a symlink that should be replaced by synced input.
 */
function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * @returns Source sync plans from environment variables.
 */
export function sourceSyncPlans(env: NodeJS.ProcessEnv = process.env): SourceSyncPlan[] {
  return sourceInputPlans(env).map((plan) => ({
    bucket: plan.bucket,
    label: plan.label,
    prefix: plan.prefix,
    required: plan.required,
    sourceFolder: plan.sourceFolder,
    target: plan.target,
  }));
}

/**
 * Pulls raw artifact source folders from private S3 before local rendering.
 */
export async function syncSourceInputs(options: SyncSourceInputsOptions = {}): Promise<void> {
  const commandRunner = options.commandRunner ?? runCommand;
  const plans = sourceSyncPlans(options.env ?? process.env);
  logHeading("Syncing artifact source inputs from S3", { count: plans.length });

  ensureDirectory(dirname(sourceInputRoot));
  const staged = mkdtempSync(`${sourceInputRoot}-sync-`);
  try {
    for (const plan of plans) {
      const source = sourceInputS3Uri(plan);
      const target = join(staged, relative(sourceInputRoot, plan.target));
      ensureDirectory(target);
      logItem(`${plan.label}: ${source} -> ${plan.target}`, 1);
      await commandRunner("aws", ["s3", "sync", source, target, "--delete"], {
        subject: plan.label,
      });
      if (plan.required && !hasSourceEntries(target)) {
        throw new Error(`No source files synced for ${plan.label}: ${source}`);
      }
    }
    validateSourceInputSelection({ args: [], mode: "cache", root: staged });
    replaceSourceRoot(staged);
  } finally {
    rmSync(staged, { force: true, recursive: true });
  }

  logSuccess("Synced artifact source inputs from S3");
}

/* istanbul ignore next */
if (isEntrypoint(import.meta.url)) {
  try {
    await syncSourceInputs();
  } catch (error) {
    if (isFailureDetails(error)) {
      logFailureDetails(error, "S3 source sync failed");
    } else {
      logCaughtError(error);
    }

    logError("Unable to sync artifact source inputs.");
    process.exit(1);
  }
}
