import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, spyOn, test } from "bun:test";
import {
  publishSourceInputs,
  sourcePublishPlans,
} from "../../scripts/publish/publish-source-inputs.ts";
import { sourceInputDirs, sourceInputRoot } from "../../scripts/core/script-constants.ts";
import {
  hiddenSourcePathExcludeArgs,
  isHiddenSourcePath,
} from "../../scripts/publish/source-input-exclusions.ts";

describe("publish source inputs", () => {
  afterEach(() => {
    rmSync(sourceInputRoot, { force: true, recursive: true });
  });

  test("builds source publish plans from source buckets", () => {
    const plans = sourcePublishPlans({
      SOURCE_ARTIFACTS_BUCKET: "artifact-source",
      SOURCE_ARTIFACTS_PREFIX: "raw",
      SOURCE_ASSETS_BUCKET: "asset-source",
      SOURCE_ASSETS_PREFIX: "static",
    });

    expect(plans.map((plan) => [plan.label, plan.bucket, plan.targetFolder])).toEqual([
      ["Docs source", "artifact-source", "docs"],
      ["Diagram source", "artifact-source", "diagrams"],
      ["Manifest source", "artifact-source", "manifests"],
      ["Profile source", "artifact-source", "profile"],
      ["Project source", "artifact-source", "projects"],
      ["Asset source", "asset-source", "assets"],
      ["Icon source", "asset-source", "icons"],
      ["Resume source", "asset-source", "resume"],
    ]);
  });

  test("syncs each local source folder to its matching bucket path", async () => {
    const commands: Array<{ readonly args: ReadonlyArray<string>; readonly subject: unknown }> = [];
    spyOn(console, "log").mockImplementation(() => undefined);

    const sourceFolders = [
      sourceInputDirs.docs,
      sourceInputDirs.diagrams,
      sourceInputDirs.manifests,
      sourceInputDirs.profile,
      sourceInputDirs.projects,
      sourceInputDirs.assets,
      sourceInputDirs.icons,
      sourceInputDirs.resume,
    ];
    for (const folder of sourceFolders) {
      writeFixtureFile(join(folder, "fixture.txt"), "fixture");
    }

    await publishSourceInputs({
      commandRunner: async (_command, args, context) => {
        commands.push({ args, subject: context?.subject });
        return { stderr: "", stdout: "" };
      },
      env: {
        SOURCE_ARTIFACTS_BUCKET: "artifact-source",
        SOURCE_ASSETS_BUCKET: "asset-source",
      },
    });

    expect(commands).toHaveLength(8);
    expect(commands[0]).toEqual({
      args: [
        "s3",
        "sync",
        sourceInputDirs.docs,
        "s3://artifact-source/docs",
        "--delete",
        ...hiddenSourcePathExcludeArgs(),
      ],
      subject: "Docs source",
    });
    expect(commands.at(-1)).toEqual({
      args: [
        "s3",
        "sync",
        sourceInputDirs.resume,
        "s3://asset-source/resume",
        "--delete",
        ...hiddenSourcePathExcludeArgs(),
      ],
      subject: "Resume source",
    });
  });

  test("requires configured source buckets", () => {
    expect(() => sourcePublishPlans({})).toThrow("Missing SOURCE_ARTIFACTS_BUCKET");
  });

  test("validates every local folder before publishing any source", async () => {
    const commands: string[][] = [];
    writeFixtureFile(join(sourceInputDirs.docs, "fixture.md"), "fixture");

    await expect(
      publishSourceInputs({
        commandRunner: async (_command, args) => {
          commands.push(args);
          return { stderr: "", stdout: "" };
        },
        env: {
          SOURCE_ARTIFACTS_BUCKET: "artifact-source",
          SOURCE_ASSETS_BUCKET: "asset-source",
        },
      }),
    ).rejects.toThrow("No source files found for Diagram source");
    expect(commands).toEqual([]);
  });

  test("excludes hidden source paths without naming machine-specific files", () => {
    expect(hiddenSourcePathExcludeArgs()).toEqual(["--exclude", ".*", "--exclude", "*/.*"]);
    expect(isHiddenSourcePath("project/.local-metadata")).toBe(true);
    expect(isHiddenSourcePath("project/.cache/file.json")).toBe(true);
    expect(isHiddenSourcePath("project/content.md")).toBe(false);
  });
});

/**
 * @param path - Fixture file path.
 * @param content - Fixture file contents.
 */
function writeFixtureFile(path: string, content: string): void {
  const directory = path.split("/").slice(0, -1).join("/");

  if (directory) {
    mkdirSync(directory, { recursive: true });
  }

  writeFileSync(path, content);
}
