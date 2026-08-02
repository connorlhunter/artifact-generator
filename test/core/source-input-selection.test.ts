import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  selectSourceInputs,
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

  test("uses an explicit local bundle before the configured cache", () => {
    const selection = selectSourceInputs(
      ["artifact-generator", "local=../source-bundle", "--github=example/docs"],
      { SOURCE_INPUT_CACHE_DIR: "tmp/s3-inputs" },
      "/workspace/artifact-generator",
    );

    expect(selection).toEqual({
      args: ["artifact-generator", "--github=example/docs"],
      mode: "local",
      root: resolve("/workspace/artifact-generator", "../source-bundle"),
    });
  });

  test("falls back to the configured source cache", () => {
    expect(
      selectSourceInputs([], { SOURCE_INPUT_CACHE_DIR: "tmp/s3-inputs" }, "/workspace"),
    ).toEqual({
      args: [],
      mode: "cache",
      root: "tmp/s3-inputs",
    });
  });

  test("rejects ambiguous or empty local selectors", () => {
    expect(() => selectSourceInputs(["local="])).toThrow("local=<path> requires a directory path.");
    expect(() => selectSourceInputs(["local=one", "local=two"])).toThrow(
      "Pass local=<path> only once.",
    );
  });

  test("validates an explicitly selected local directory", () => {
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
    ).toThrow("Local source input directory does not exist");

    const file = join(directory, "source.txt");
    writeFileSync(file, "source");
    expect(() => validateSourceInputSelection({ args: [], mode: "local", root: file })).toThrow(
      "Local source input path is not a directory",
    );
  });
});
