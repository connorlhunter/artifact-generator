import { afterEach, describe, expect, spyOn, test } from "bun:test";
import {
  publishSiteArtifacts,
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
        syncFilters: [
          "--exclude",
          "projects/*/coverage/*",
          "--include",
          "projects/artifact-generator/coverage/*",
        ],
      },
      {
        bucket: "asset-bucket",
        cloudFrontDistributionId: "asset-distribution",
        label: "Asset bundle",
        prefix: "portfolio/assets",
        source: publishOutputs.siteAssets,
        syncFilters: [],
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
          syncFilters: [],
        },
        {
          bucket: "asset-bucket",
          cloudFrontDistributionId: "asset-distribution",
          label: "Asset bundle",
          prefix: "",
          source: publishOutputs.siteAssets,
          syncFilters: [],
        },
        {
          bucket: "other-bucket",
          cloudFrontDistributionId: "",
          label: "Other bundle",
          prefix: "other",
          source: "dist/other",
          syncFilters: [],
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

  test("syncs both bundles and invalidates configured origins", async () => {
    const commands: Array<{ args: readonly string[]; subject: unknown }> = [];
    const log = spyOn(console, "log").mockImplementation(() => undefined);

    await publishSiteArtifacts({
      commandRunner: async (_command, args, context) => {
        commands.push({ args, subject: context?.subject });
        return { stderr: "", stdout: "" };
      },
      destinations: [
        {
          bucket: "artifact-bucket",
          cloudFrontDistributionId: "artifact-distribution",
          label: "Artifact bundle",
          prefix: "",
          source: "dist/site-artifacts",
          syncFilters: ["--exclude", "projects/*/coverage/*"],
        },
        {
          bucket: "asset-bucket",
          cloudFrontDistributionId: "",
          label: "Asset bundle",
          prefix: "site-assets",
          source: "dist/site-assets",
          syncFilters: [],
        },
      ],
    });

    expect(commands).toEqual([
      {
        args: [
          "s3",
          "sync",
          "dist/site-artifacts",
          "s3://artifact-bucket/",
          "--delete",
          "--exclude",
          "projects/*/coverage/*",
        ],
        subject: "Artifact bundle",
      },
      {
        args: ["s3", "sync", "dist/site-assets", "s3://asset-bucket/site-assets/", "--delete"],
        subject: "Asset bundle",
      },
      {
        args: [
          "cloudfront",
          "create-invalidation",
          "--distribution-id",
          "artifact-distribution",
          "--paths",
          "/*",
        ],
        subject: "Artifact bundle CloudFront invalidation",
      },
    ]);
    expect(String(log.mock.calls.at(-1)?.[0])).toContain("Published generated artifacts to S3");
  });
});
