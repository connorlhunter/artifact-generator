import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { sourceInputRoot } from "../../scripts/core/script-constants.ts";
import { sourceSyncPlans, syncSourceInputs } from "../../scripts/publish/sync-source-inputs.ts";

describe("sync source inputs", () => {
  afterEach(() => {
    rmSync(sourceInputRoot, { force: true, recursive: true });
  });

  test("builds source sync plans from the shared folder map", () => {
    const plans = sourceSyncPlans({
      SOURCE_ARTIFACTS_BUCKET: "artifact-source",
      SOURCE_ARTIFACTS_PREFIX: "raw",
      SOURCE_ASSETS_BUCKET: "asset-source",
      SOURCE_ASSETS_PREFIX: "static",
    });

    expect(plans.map((plan) => [plan.label, plan.bucket, plan.sourceFolder])).toEqual([
      ["Docs source", "artifact-source", "docs"],
      ["Diagram source", "artifact-source", "diagrams"],
      ["Manifest source", "artifact-source", "manifests"],
      ["Profile source", "artifact-source", "profile"],
      ["Project source", "artifact-source", "projects"],
      ["Icon source", "asset-source", "icons"],
    ]);
  });

  test("resets and syncs every configured source folder", async () => {
    const commands: Array<{ readonly args: ReadonlyArray<string>; readonly subject: unknown }> = [];
    spyOn(console, "log").mockImplementation(() => undefined);

    await syncSourceInputs({
      commandRunner: async (_command, args, context) => {
        const target = args[3];
        if (!target) throw new Error("Missing sync target.");

        mkdirSync(target, { recursive: true });
        writeFileSync(`${target}/fixture.txt`, "fixture");
        commands.push({ args, subject: context?.subject });
        return { stderr: "", stdout: "" };
      },
      env: {
        SOURCE_ARTIFACTS_BUCKET: "artifact-source",
        SOURCE_ASSETS_BUCKET: "asset-source",
      },
    });

    expect(commands).toHaveLength(6);
    expect(commands[0]).toEqual({
      args: [
        "s3",
        "sync",
        "s3://artifact-source/docs",
        `${sourceInputRoot}/artifacts/docs`,
        "--delete",
      ],
      subject: "Docs source",
    });
    expect(commands.at(-1)).toEqual({
      args: [
        "s3",
        "sync",
        "s3://asset-source/icons",
        `${sourceInputRoot}/assets/icons`,
        "--delete",
      ],
      subject: "Icon source",
    });
  });

  test("requires both source buckets", () => {
    expect(() => sourceSyncPlans({})).toThrow("Missing SOURCE_ARTIFACTS_BUCKET");
  });
});
