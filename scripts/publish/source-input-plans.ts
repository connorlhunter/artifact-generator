import { existsSync, readdirSync } from "node:fs";
import { envValue, requiredEnv } from "../core/environment.ts";
import { repoDirs, sourceInputDirs } from "../core/script-constants.ts";

type SourceStorage = "artifacts" | "assets";

interface SourceInputDefinition {
  readonly label: string;
  readonly sourceFolder: string;
  readonly storage: SourceStorage;
  readonly target: string;
}

export interface SourceInputPlan extends SourceInputDefinition {
  readonly bucket: string;
  readonly prefix: string;
  readonly required: boolean;
}

const sourceInputDefinitions: ReadonlyArray<SourceInputDefinition> = [
  {
    label: "Docs source",
    sourceFolder: repoDirs.docs,
    storage: "artifacts",
    target: sourceInputDirs.docs,
  },
  {
    label: "Diagram source",
    sourceFolder: repoDirs.diagrams,
    storage: "artifacts",
    target: sourceInputDirs.diagrams,
  },
  {
    label: "Manifest source",
    sourceFolder: "manifests",
    storage: "artifacts",
    target: sourceInputDirs.manifests,
  },
  {
    label: "Profile source",
    sourceFolder: "profile",
    storage: "artifacts",
    target: sourceInputDirs.profile,
  },
  {
    label: "Project source",
    sourceFolder: "projects",
    storage: "artifacts",
    target: sourceInputDirs.projects,
  },
  {
    label: "Resume source",
    sourceFolder: repoDirs.resume,
    storage: "artifacts",
    target: sourceInputDirs.resume,
  },
  {
    label: "Icon source",
    sourceFolder: repoDirs.icons,
    storage: "assets",
    target: sourceInputDirs.icons,
  },
];

/**
 * @param env - Environment values containing source bucket configuration.
 * @returns Shared local and S3 mappings for every source input folder.
 */
export function sourceInputPlans(env: NodeJS.ProcessEnv = process.env): SourceInputPlan[] {
  const storage = {
    artifacts: {
      bucket: requiredEnv(env, "SOURCE_ARTIFACTS_BUCKET"),
      prefix: envValue(env.SOURCE_ARTIFACTS_PREFIX),
    },
    assets: {
      bucket: requiredEnv(env, "SOURCE_ASSETS_BUCKET"),
      prefix: envValue(env.SOURCE_ASSETS_PREFIX),
    },
  };

  return sourceInputDefinitions.map((definition) => ({
    ...definition,
    ...storage[definition.storage],
    required: true,
  }));
}

/**
 * @param plan - Source input plan to address in S3.
 * @returns S3 URI for the plan's source folder.
 */
export function sourceInputS3Uri(
  plan: Pick<SourceInputPlan, "bucket" | "prefix" | "sourceFolder">,
): string {
  const key = [plan.prefix.replace(/^\/+|\/+$/gu, ""), plan.sourceFolder].filter(Boolean).join("/");

  return `s3://${plan.bucket}/${key}`;
}

/**
 * @param directory - Source directory to inspect.
 * @returns Whether the directory contains any file or child directory.
 */
export function hasSourceEntries(directory: string): boolean {
  return existsSync(directory) && readdirSync(directory).length > 0;
}
