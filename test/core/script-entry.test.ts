import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, test } from "bun:test";
import { isEntrypoint } from "../../scripts/core/script-entry.ts";
import { existingArtifactPath } from "../resources/docs.constants.ts";

describe("script entry", () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  test("detects the active Bun entrypoint", () => {
    process.argv = [originalArgv[0]!, existingArtifactPath];

    expect(isEntrypoint(pathToFileURL(existingArtifactPath).href)).toBe(true);
    expect(isEntrypoint(pathToFileURL("not-the-entrypoint.ts").href)).toBe(false);
  });
});
