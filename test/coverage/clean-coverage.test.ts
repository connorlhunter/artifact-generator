import { afterEach, describe, expect, mock, test } from "bun:test";

const removePath = mock<(path: string) => Promise<void>>();
const logSuccess = mock<(message: string) => void>();

mock.module("../../scripts/core/bun-native-fs.ts", () => ({
  removePath,
}));

mock.module("../../scripts/core/script-logger.ts", () => ({
  logSuccess,
}));

const { cleanCoverage } = await import("../../scripts/coverage/clean-coverage.ts");

describe("clean coverage", () => {
  afterEach(() => {
    removePath.mockReset();
    logSuccess.mockReset();
    mock.restore();
  });

  test("removes stale coverage output", async () => {
    removePath.mockResolvedValue(undefined);

    await cleanCoverage();

    expect(removePath).toHaveBeenCalledWith("coverage");
    expect(logSuccess).toHaveBeenCalledWith("Cleaned coverage output: coverage");
  });
});
