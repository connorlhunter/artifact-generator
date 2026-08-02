import { publishOutputs } from "./assemble-site-artifacts.ts";
import { envValue, requiredEnv } from "../core/environment.ts";
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

interface PublishDestination {
  readonly bucket: string;
  readonly cloudFrontDistributionId: string;
  readonly label: string;
  readonly prefix: string;
  readonly source: string;
  readonly syncFilters: string[];
}

interface PublishInvalidation {
  readonly distributionId: string;
  readonly label: string;
  readonly path: string;
}

const artifactsBucketEnv = "ARTIFACTS_BUCKET";
const artifactsCloudFrontDistributionEnv = "ARTIFACTS_CLOUDFRONT_DISTRIBUTION_ID";
const artifactsPrefixEnv = "ARTIFACTS_PREFIX";
const assetsBucketEnv = "ASSETS_BUCKET";
const assetsCloudFrontDistributionEnv = "ASSETS_CLOUDFRONT_DISTRIBUTION_ID";
const assetsPrefixEnv = "ASSETS_PREFIX";

/**
 * @param bucket - S3 bucket name.
 * @param prefix - Optional key prefix.
 * @returns S3 URI for one publish destination.
 */
function s3Uri(bucket: string, prefix: string): string {
  const key = prefix.replace(/^\/+|\/+$/gu, "");

  return key ? `s3://${bucket}/${key}/` : `s3://${bucket}/`;
}

/**
 * @param prefix - Optional CloudFront origin prefix.
 * @returns Invalidation path for a published bundle.
 */
function invalidationPath(prefix: string): string {
  const key = prefix.replace(/^\/+|\/+$/gu, "");

  return key ? `/${key}/*` : "/*";
}

/**
 * @returns Local publish destinations from environment variables.
 */
export function publishDestinations(): PublishDestination[] {
  return [
    {
      bucket: requiredEnv(process.env, artifactsBucketEnv),
      cloudFrontDistributionId: envValue(process.env[artifactsCloudFrontDistributionEnv]),
      label: "Artifact bundle",
      prefix: envValue(process.env[artifactsPrefixEnv]),
      source: publishOutputs.siteArtifacts,
      syncFilters: [
        "--exclude",
        "projects/*/coverage/*",
        "--include",
        "projects/artifact-generator/coverage/*",
      ],
    },
    {
      bucket: requiredEnv(process.env, assetsBucketEnv),
      cloudFrontDistributionId: envValue(process.env[assetsCloudFrontDistributionEnv]),
      label: "Asset bundle",
      prefix: envValue(process.env[assetsPrefixEnv]),
      source: publishOutputs.siteAssets,
      syncFilters: [],
    },
  ];
}

/**
 * @param destinations - Publish destinations with optional distribution IDs.
 * @returns CloudFront invalidations needed after S3 sync.
 */
export function publishInvalidations(
  destinations: PublishDestination[] = publishDestinations(),
): PublishInvalidation[] {
  return destinations.flatMap((destination) => {
    if (!destination.cloudFrontDistributionId) {
      return [];
    }

    return [
      {
        distributionId: destination.cloudFrontDistributionId,
        label: `${destination.label} CloudFront invalidation`,
        path: invalidationPath(destination.prefix),
      },
    ];
  });
}

/**
 * Publishes generated CloudFront-ready bundles to private S3 origins.
 */
export async function publishSiteArtifacts(): Promise<void> {
  const destinations = publishDestinations();
  logHeading("Publishing generated artifacts to S3", { count: destinations.length });

  for (const destination of destinations) {
    const target = s3Uri(destination.bucket, destination.prefix);
    logItem(`${destination.label}: ${destination.source} -> ${target}`, 1);
    await runCommand(
      "aws",
      ["s3", "sync", destination.source, target, "--delete", ...destination.syncFilters],
      {
        subject: destination.label,
      },
    );
  }

  for (const invalidation of publishInvalidations(destinations)) {
    logItem(`Invalidating CloudFront path: ${invalidation.path}`, 1);
    await runCommand(
      "aws",
      [
        "cloudfront",
        "create-invalidation",
        "--distribution-id",
        invalidation.distributionId,
        "--paths",
        invalidation.path,
      ],
      {
        subject: invalidation.label,
      },
    );
  }

  logSuccess("Published generated artifacts to S3");
}

/* istanbul ignore next */
if (isEntrypoint(import.meta.url)) {
  try {
    await publishSiteArtifacts();
  } catch (error) {
    if (isFailureDetails(error)) {
      logFailureDetails(error, "S3 publish failed");
    } else {
      logCaughtError(error);
    }

    logError("Unable to publish generated artifacts.");
    process.exit(1);
  }
}
