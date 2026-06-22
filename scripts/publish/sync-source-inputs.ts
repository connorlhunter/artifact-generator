import { existsSync, lstatSync, readdirSync, rmSync } from "node:fs";
import { repoDirs, sourceInputDirs } from "../core/script-constants.ts";
import { ensureDirectory } from "../core/bun-native-fs.ts";
import { runCommand } from "../core/process-utils.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import {
  logCaughtError,
  logError,
  logFailureDetails,
  logHeading,
  logItem,
  logSuccess,
} from "../core/script-logger.ts";

interface SourceSyncPlan {
  readonly bucket: string;
  readonly label: string;
  readonly prefix: string;
  readonly required: boolean;
  readonly sourceFolder: string;
  readonly target: string;
}

const sourceArtifactsBucketEnv = "SOURCE_ARTIFACTS_BUCKET";
const sourceArtifactsPrefixEnv = "SOURCE_ARTIFACTS_PREFIX";
const sourceAssetsBucketEnv = "SOURCE_ASSETS_BUCKET";
const sourceAssetsPrefixEnv = "SOURCE_ASSETS_PREFIX";

/**
 * @param value - Environment value to normalize.
 * @returns Trimmed environment value.
 */
function envValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

/**
 * @param name - Required environment variable name.
 * @returns Non-empty environment variable value.
 */
function requiredEnv(name: string): string {
  const value = envValue(process.env[name]);

  if (!value) {
    throw new Error(`Missing ${name}. Set it in your local shell, .env, or CI variables.`);
  }

  return value;
}

/**
 * @param bucket - S3 bucket name.
 * @param prefix - Optional key prefix.
 * @param folder - Folder below the prefix.
 * @returns S3 URI for one source folder.
 */
function s3Uri(bucket: string, prefix: string, folder: string): string {
  const key = [prefix.replace(/^\/+|\/+$/gu, ""), folder].filter(Boolean).join("/");

  return `s3://${bucket}/${key}`;
}

/**
 * @param target - Working input folder to replace before syncing.
 */
function resetTargetDirectory(target: string): void {
  if (existsSync(target) || isSymlink(target)) {
    rmSync(target, { force: true, recursive: true });
  }

  ensureDirectory(target);
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
 * @param directory - Directory to inspect.
 * @returns Whether the directory contains any file or child directory.
 */
function hasEntries(directory: string): boolean {
  return existsSync(directory) && readdirSync(directory).length > 0;
}

/**
 * @param value - Caught error value.
 * @returns Whether the value looks like captured command failure details.
 */
function isFailureDetails(value: unknown): value is Parameters<typeof logFailureDetails>[0] {
  return value !== null && typeof value === "object" && ("stderr" in value || "stdout" in value);
}

/**
 * @returns Source sync plans from environment variables.
 */
export function sourceSyncPlans(): SourceSyncPlan[] {
  const sourceArtifactsBucket = requiredEnv(sourceArtifactsBucketEnv);
  const sourceArtifactsPrefix = envValue(process.env[sourceArtifactsPrefixEnv]);
  const sourceAssetsBucket = requiredEnv(sourceAssetsBucketEnv);
  const sourceAssetsPrefix = envValue(process.env[sourceAssetsPrefixEnv]);

  return [
    {
      bucket: sourceArtifactsBucket,
      label: "Docs source",
      prefix: sourceArtifactsPrefix,
      required: true,
      sourceFolder: repoDirs.docs,
      target: sourceInputDirs.docs,
    },
    {
      bucket: sourceArtifactsBucket,
      label: "Diagram source",
      prefix: sourceArtifactsPrefix,
      required: true,
      sourceFolder: repoDirs.diagrams,
      target: sourceInputDirs.diagrams,
    },
    {
      bucket: sourceArtifactsBucket,
      label: "Manifest source",
      prefix: sourceArtifactsPrefix,
      required: true,
      sourceFolder: "manifests",
      target: sourceInputDirs.manifests,
    },
    {
      bucket: sourceArtifactsBucket,
      label: "Profile source",
      prefix: sourceArtifactsPrefix,
      required: true,
      sourceFolder: "profile",
      target: sourceInputDirs.profile,
    },
    {
      bucket: sourceArtifactsBucket,
      label: "Project source",
      prefix: sourceArtifactsPrefix,
      required: true,
      sourceFolder: "projects",
      target: sourceInputDirs.projects,
    },
    {
      bucket: sourceAssetsBucket,
      label: "Asset source",
      prefix: sourceAssetsPrefix,
      required: true,
      sourceFolder: "assets",
      target: sourceInputDirs.assets,
    },
    {
      bucket: sourceAssetsBucket,
      label: "Icon source",
      prefix: sourceAssetsPrefix,
      required: true,
      sourceFolder: repoDirs.icons,
      target: sourceInputDirs.icons,
    },
    {
      bucket: sourceAssetsBucket,
      label: "Resume source",
      prefix: sourceAssetsPrefix,
      required: true,
      sourceFolder: "resume",
      target: sourceInputDirs.resume,
    },
  ];
}

/**
 * Pulls raw artifact source folders from private S3 before local rendering.
 */
export async function syncSourceInputs(): Promise<void> {
  const plans = sourceSyncPlans();
  logHeading("Syncing artifact source inputs from S3", { count: plans.length });

  for (const plan of plans) {
    const source = s3Uri(plan.bucket, plan.prefix, plan.sourceFolder);
    resetTargetDirectory(plan.target);
    logItem(`${plan.label}: ${source} -> ${plan.target}`, 1);

    await runCommand("aws", ["s3", "sync", source, plan.target, "--delete"], {
      subject: plan.label,
    });

    if (plan.required && !hasEntries(plan.target)) {
      throw new Error(`No source files synced for ${plan.label}: ${source}`);
    }
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
