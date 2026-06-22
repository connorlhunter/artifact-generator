import { describe, expect, test } from "bun:test";
import { runCommand } from "../../scripts/core/process-utils.ts";
import { commandFixture } from "../resources/docs.constants.ts";

describe("process utils", () => {
  test("captures stdout and stderr for successful commands", async () => {
    await expect(
      runCommand(commandFixture.executable, commandFixture.successArgs),
    ).resolves.toEqual({
      stdout: "ok",
      stderr: "warn",
    });
  });

  test("rejects with captured output for failed commands", async () => {
    await expect(
      runCommand(commandFixture.executable, commandFixture.failureArgs, {
        input: commandFixture.executable,
      }),
    ).rejects.toMatchObject({
      code: 2,
      input: commandFixture.executable,
      stdout: "bad",
      stderr: "fail",
    });
  });

  test("rejects when a command cannot be spawned", async () => {
    await expect(
      runCommand("missing-command-for-test", [], {
        input: commandFixture.executable,
      }),
    ).rejects.toMatchObject({
      input: commandFixture.executable,
    });
  });
});
