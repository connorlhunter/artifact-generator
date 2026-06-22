import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existingPreviewPath } from "../resources/docs.constants.ts";

type RunCommand = (
  command: string,
  args: string[],
  context: Record<string, unknown>,
) => Promise<{ stdout: string; stderr: string }>;

const runCommand = mock<RunCommand>();

mock.module("../../scripts/core/process-utils.ts", () => ({
  runCommand,
}));

const { openDefaultFile, openDefaultUrl } = await import("../../scripts/core/file-opener.ts");

describe("file opener", () => {
  beforeEach(() => {
    runCommand.mockResolvedValue({ stdout: "", stderr: "" });
  });

  afterEach(() => {
    runCommand.mockReset();
    mock.restore();
  });

  test("opens files with the platform default command", async () => {
    await expect(openDefaultFile(existingPreviewPath)).resolves.toBe(existingPreviewPath);

    expect(runCommand).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([resolve(existingPreviewPath)]),
      { file: existingPreviewPath },
    );
  });

  test("opens URLs with the platform default command", async () => {
    await expect(openDefaultUrl("http://127.0.0.1:41737/index.html")).resolves.toBe(
      "http://127.0.0.1:41737/index.html",
    );

    expect(runCommand).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["http://127.0.0.1:41737/index.html"]),
      { file: "http://127.0.0.1:41737/index.html" },
    );
  });

  test("rejects when no default opener exists for the platform", async () => {
    const platform = Object.getOwnPropertyDescriptor(process, "platform");

    if (!platform) {
      throw new Error("process.platform descriptor missing.");
    }

    try {
      Object.defineProperty(process, "platform", {
        value: "unsupported",
      });

      await expect(openDefaultFile(existingPreviewPath)).rejects.toMatchObject({
        file: existingPreviewPath,
      });
    } finally {
      Object.defineProperty(process, "platform", platform);
    }
  });
});
