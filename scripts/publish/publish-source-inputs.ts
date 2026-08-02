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
import { hiddenSourcePathExcludeArgs } from "./source-input-exclusions.ts";
import { hasSourceEntries, sourceInputPlans, sourceInputS3Uri } from "./source-input-plans.ts";

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

/**
 * @param env - Environment values.
 * @returns Source publish plans from environment variables.
 */
export function sourcePublishPlans(env: NodeJS.ProcessEnv = process.env): SourcePublishPlan[] {
  return sourceInputPlans(env).map((plan) => ({
    bucket: plan.bucket,
    label: plan.label,
    prefix: plan.prefix,
    required: plan.required,
    source: plan.target,
    targetFolder: plan.sourceFolder,
  }));
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
    if (plan.required && !hasSourceEntries(plan.source)) {
      throw new Error(`No source files found for ${plan.label}: ${plan.source}`);
    }

    const target = sourceInputS3Uri({ ...plan, sourceFolder: plan.targetFolder });
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
