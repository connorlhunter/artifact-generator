import { afterEach, describe, expect, test } from "bun:test";
import {
  publishDestinations,
  publishInvalidations,
} from "../../scripts/publish/publish-site-artifacts.ts";
import { publishOutputs } from "../../scripts/publish/assemble-site-artifacts.ts";

const envKeys = [
  "ARTIFACTS_BUCKET",
  "ARTIFACTS_CLOUDFRONT_DISTRIBUTION_ID",
  "ARTIFACTS_PREFIX",
  "ASSETS_BUCKET",
  "ASSETS_CLOUDFRONT_DISTRIBUTION_ID",
  "ASSETS_PREFIX",
] as const;

describe("publish site artifacts", () => {
  const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of envKeys) {
      const value = originalEnv.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  test("builds S3 publish destinations from local environment variables", () => {
    process.env.ARTIFACTS_BUCKET = "artifact-bucket";
    process.env.ARTIFACTS_CLOUDFRONT_DISTRIBUTION_ID = "artifact-distribution";
    process.env.ARTIFACTS_PREFIX = "portfolio/artifacts";
    process.env.ASSETS_BUCKET = "asset-bucket";
    process.env.ASSETS_CLOUDFRONT_DISTRIBUTION_ID = "asset-distribution";
    process.env.ASSETS_PREFIX = "portfolio/assets";

    expect(publishDestinations()).toEqual([
      {
        bucket: "artifact-bucket",
        cloudFrontDistributionId: "artifact-distribution",
        label: "Artifact bundle",
        prefix: "portfolio/artifacts",
        source: publishOutputs.siteArtifacts,
      },
      {
        bucket: "asset-bucket",
        cloudFrontDistributionId: "asset-distribution",
        label: "Asset bundle",
        prefix: "portfolio/assets",
        source: publishOutputs.siteAssets,
      },
    ]);
  });

  test("requires destination buckets before publishing", () => {
    delete process.env.ARTIFACTS_BUCKET;
    process.env.ASSETS_BUCKET = "asset-bucket";

    expect(() => publishDestinations()).toThrow("Missing ARTIFACTS_BUCKET");
  });

  test("builds one CloudFront invalidation per configured distribution", () => {
    expect(
      publishInvalidations([
        {
          bucket: "artifact-bucket",
          cloudFrontDistributionId: "artifact-distribution",
          label: "Artifact bundle",
          prefix: "portfolio/artifacts",
          source: publishOutputs.siteArtifacts,
        },
        {
          bucket: "asset-bucket",
          cloudFrontDistributionId: "asset-distribution",
          label: "Asset bundle",
          prefix: "",
          source: publishOutputs.siteAssets,
        },
        {
          bucket: "other-bucket",
          cloudFrontDistributionId: "",
          label: "Other bundle",
          prefix: "other",
          source: "dist/other",
        },
      ]),
    ).toEqual([
      {
        distributionId: "artifact-distribution",
        label: "Artifact bundle CloudFront invalidation",
        path: "/portfolio/artifacts/*",
      },
      {
        distributionId: "asset-distribution",
        label: "Asset bundle CloudFront invalidation",
        path: "/*",
      },
    ]);
  });
});
