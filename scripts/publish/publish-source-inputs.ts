import { existsSync, readdirSync } from "node:fs";
import { repoDirs, sourceInputDirs } from "../core/script-constants.ts";
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
import { hiddenSourcePathExcludeArgs } from "./source-input-exclusions.ts";

interface SourcePublishPlan {
  readonly bucket: string;
  readonly label: string;
  readonly prefix: string;
  readonly required: boolean;
  readonly source: string;
  readonly targetFolder: string;
}

export interface PublishSourceInputsOptions {
  readonly commandRunner?: typeof runCommand;
  readonly env?: NodeJS.ProcessEnv;
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
 * @param env - Environment values.
 * @param name - Required environment variable name.
 * @returns Non-empty environment variable value.
 */
function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = envValue(env[name]);

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
 * @param env - Environment values.
 * @returns Source publish plans from environment variables.
 */
export function sourcePublishPlans(env: NodeJS.ProcessEnv = process.env): SourcePublishPlan[] {
  const sourceArtifactsBucket = requiredEnv(env, sourceArtifactsBucketEnv);
  const sourceArtifactsPrefix = envValue(env[sourceArtifactsPrefixEnv]);
  const sourceAssetsBucket = requiredEnv(env, sourceAssetsBucketEnv);
  const sourceAssetsPrefix = envValue(env[sourceAssetsPrefixEnv]);

  return [
    {
      bucket: sourceArtifactsBucket,
      label: "Docs source",
      prefix: sourceArtifactsPrefix,
      required: true,
      source: sourceInputDirs.docs,
      targetFolder: repoDirs.docs,
    },
    {
      bucket: sourceArtifactsBucket,
      label: "Diagram source",
      prefix: sourceArtifactsPrefix,
      required: true,
      source: sourceInputDirs.diagrams,
      targetFolder: repoDirs.diagrams,
    },
    {
      bucket: sourceArtifactsBucket,
      label: "Manifest source",
      prefix: sourceArtifactsPrefix,
      required: true,
      source: sourceInputDirs.manifests,
      targetFolder: "manifests",
    },
    {
      bucket: sourceArtifactsBucket,
      label: "Profile source",
      prefix: sourceArtifactsPrefix,
      required: true,
      source: sourceInputDirs.profile,
      targetFolder: "profile",
    },
    {
      bucket: sourceArtifactsBucket,
      label: "Project source",
      prefix: sourceArtifactsPrefix,
      required: true,
      source: sourceInputDirs.projects,
      targetFolder: "projects",
    },
    {
      bucket: sourceAssetsBucket,
      label: "Asset source",
      prefix: sourceAssetsPrefix,
      required: true,
      source: sourceInputDirs.assets,
      targetFolder: "assets",
    },
    {
      bucket: sourceAssetsBucket,
      label: "Icon source",
      prefix: sourceAssetsPrefix,
      required: true,
      source: sourceInputDirs.icons,
      targetFolder: repoDirs.icons,
    },
    {
      bucket: sourceAssetsBucket,
      label: "Resume source",
      prefix: sourceAssetsPrefix,
      required: true,
      source: sourceInputDirs.resume,
      targetFolder: "resume",
    },
  ];
}

/**
 * Publishes the local editable source input copy back to private S3 source buckets.
 *
 * @param options - Publish options.
 */
export async function publishSourceInputs(options: PublishSourceInputsOptions = {}): Promise<void> {
  const commandRunner = options.commandRunner ?? runCommand;
  const plans = sourcePublishPlans(options.env ?? process.env);

  logHeading("Publishing artifact source inputs to S3", { count: plans.length });

  for (const plan of plans) {
    if (plan.required && !hasEntries(plan.source)) {
      throw new Error(`No source files found for ${plan.label}: ${plan.source}`);
    }

    const target = s3Uri(plan.bucket, plan.prefix, plan.targetFolder);
    logItem(`${plan.label}: ${plan.source} -> ${target}`, 1);
    await commandRunner(
      "aws",
      ["s3", "sync", plan.source, target, "--delete", ...hiddenSourcePathExcludeArgs()],
      {
        subject: plan.label,
      },
    );
  }

  logSuccess("Published artifact source inputs to S3");
}

/* istanbul ignore next */
if (isEntrypoint(import.meta.url)) {
  try {
    await publishSourceInputs();
  } catch (error) {
    if (isFailureDetails(error)) {
      logFailureDetails(error, "S3 source publish failed");
    } else {
      logCaughtError(error);
    }

    logError("Unable to publish artifact source inputs.");
    process.exit(1);
  }
}
