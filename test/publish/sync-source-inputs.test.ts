import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { afterAll, afterEach, describe, expect, spyOn, test } from "bun:test";
import { createIsolatedSourceInputs } from "../resources/isolated-source-inputs.ts";

const originalCwd = process.cwd();
const isolatedSourceInputs = createIsolatedSourceInputs();
process.chdir(isolatedSourceInputs.workspace);
const { sourceInputRoot } = await import("../../scripts/core/script-constants.ts");
const { sourceSyncPlans, syncSourceInputs } =
  await import("../../scripts/publish/sync-source-inputs.ts");
process.chdir(originalCwd);

if (sourceInputRoot !== isolatedSourceInputs.sourceInputRoot) {
  throw new Error(`Source input test root was not isolated: ${sourceInputRoot}`);
}

describe("sync source inputs", () => {
  afterEach(() => {
    isolatedSourceInputs.reset(sourceInputRoot);
  });

  afterAll(() => isolatedSourceInputs.dispose());

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
      ["Resume source", "artifact-source", "resume"],
      ["Icon source", "asset-source", "icons"],
    ]);
  });

  test("stages every source folder before replacing the working bundle", async () => {
    const commands: Array<{ readonly args: ReadonlyArray<string>; readonly subject: unknown }> = [];
    spyOn(console, "log").mockImplementation(() => undefined);
    const staleFile = `${sourceInputRoot}/artifacts/docs/stale.txt`;
    mkdirSync(`${sourceInputRoot}/artifacts/docs`, { recursive: true });
    writeFileSync(staleFile, "stale");

    await syncSourceInputs({
      commandRunner: async (_command, args, context) => {
        const target = args[3];
        if (!target) throw new Error("Missing sync target.");

        expect(existsSync(staleFile)).toBe(true);
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

    expect(commands).toHaveLength(7);
    expect(existsSync(staleFile)).toBe(false);
    expect(readFileSync(`${sourceInputRoot}/artifacts/docs/fixture.txt`, "utf8")).toBe("fixture");
    expect(commands[0]).toEqual({
      args: [
        "s3",
        "sync",
        "s3://artifact-source/docs",
        expect.stringContaining("/artifacts/docs"),
        "--delete",
      ],
      subject: "Docs source",
    });
    expect(commands.at(-1)).toEqual({
      args: [
        "s3",
        "sync",
        "s3://asset-source/icons",
        expect.stringContaining("/assets/icons"),
        "--delete",
      ],
      subject: "Icon source",
    });
  });

  test("retains every working folder when a later download fails", async () => {
    const path = `${sourceInputRoot}/artifacts/docs/current.md`;
    mkdirSync(`${sourceInputRoot}/artifacts/docs`, { recursive: true });
    writeFileSync(path, "current docs");
    let requests = 0;
    await expect(
      syncSourceInputs({
        commandRunner: async (_command, args) => {
          requests += 1;
          if (requests === 2) throw new Error("Download interrupted");
          writeFileSync(`${args[3]}/replacement.md`, "replacement");
          return { stderr: "", stdout: "" };
        },
        env: { SOURCE_ARTIFACTS_BUCKET: "source", SOURCE_ASSETS_BUCKET: "assets" },
      }),
    ).rejects.toThrow("Download interrupted");
    expect(readFileSync(path, "utf8")).toBe("current docs");
    expect(existsSync(`${sourceInputRoot}/artifacts/docs/replacement.md`)).toBe(false);
  });

  test("requires both source buckets", () => {
    expect(() => sourceSyncPlans({})).toThrow("Missing SOURCE_ARTIFACTS_BUCKET");
  });

  test("rejects an empty required source folder after a sync", async () => {
    await expect(
      syncSourceInputs({
        commandRunner: async () => ({ stderr: "", stdout: "" }),
        env: {
          SOURCE_ARTIFACTS_BUCKET: "artifact-source",
          SOURCE_ASSETS_BUCKET: "asset-source",
        },
      }),
    ).rejects.toThrow("No source files synced for Docs source");
  });
});
