import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  localSourceInputBundlesRoot,
  selectSourceInputs,
  sourceInputCacheRoot,
  validateSourceInputSelection,
} from "../../scripts/core/source-input-selection.ts";

describe("source input selection", () => {
  const tempDirectories: string[] = [];

  afterEach(() => {
    for (const directory of tempDirectories) {
      rmSync(directory, { force: true, recursive: true });
    }
    tempDirectories.length = 0;
  });

  test("uses an explicit controlled local bundle before the source cache", () => {
    const workspace = mkdtempSync(join(tmpdir(), "artifact-source-workspace-"));
    tempDirectories.push(workspace);
    mkdirSync(join(workspace, localSourceInputBundlesRoot, "source-bundle"), { recursive: true });

    const selection = selectSourceInputs(
      ["artifact-generator", "local=source-bundle", "--github=example/docs"],
      workspace,
    );

    expect(selection).toEqual({
      args: ["artifact-generator", "--github=example/docs"],
      mode: "local",
      root: join(workspace, localSourceInputBundlesRoot, "source-bundle"),
    });
  });

  test("uses the repository S3 input cache when no local bundle is selected", () => {
    expect(selectSourceInputs([], "/workspace")).toEqual({
      args: [],
      mode: "cache",
      root: join("/workspace", sourceInputCacheRoot),
    });
  });

  test("rejects ambiguous, unsafe, or missing local selectors", () => {
    expect(() => selectSourceInputs(["local="])).toThrow("local=<bundle> requires a bundle name.");
    expect(() => selectSourceInputs(["local=one", "local=two"])).toThrow(
      "Pass local=<bundle> only once.",
    );
    expect(() => selectSourceInputs(["local=../source-bundle"])).toThrow(
      "local=<bundle> must use a lowercase bundle name.",
    );
    expect(() => selectSourceInputs(["local=missing"], "/workspace")).toThrow(
      "Local source bundle directory does not exist",
    );
  });

  test("validates a selected source tree and rejects symlinks", () => {
    const directory = mkdtempSync(join(tmpdir(), "artifact-local-source-"));
    tempDirectories.push(directory);

    expect(() =>
      validateSourceInputSelection({ args: [], mode: "local", root: directory }),
    ).not.toThrow();
    expect(() =>
      validateSourceInputSelection({
        args: [],
        mode: "local",
        root: join(directory, "missing"),
      }),
    ).toThrow("Source input directory does not exist");

    const file = join(directory, "source.txt");
    writeFileSync(file, "source");
    expect(() => validateSourceInputSelection({ args: [], mode: "local", root: file })).toThrow(
      "Source input path is not a directory",
    );

    const linked = join(directory, "linked.txt");
    symlinkSync(file, linked);
    expect(() =>
      validateSourceInputSelection({ args: [], mode: "local", root: directory }),
    ).toThrow("Source input bundles cannot contain symlinks");
  });
});
