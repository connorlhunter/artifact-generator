import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { missingPreviewPath } from "../resources/docs.constants.ts";

const realFs = await import("node:fs");

const existsSync = mock<(path: string) => boolean>();
const pathExists = mock<(path: string) => Promise<boolean>>();
const openDefaultUrl = mock<(url: string) => Promise<string>>();
const spawn = mock<() => { unref: () => void }>();

mock.module("node:fs", () => ({
  ...realFs,
  existsSync,
}));

mock.module("node:child_process", () => ({
  spawn,
}));

mock.module("../../scripts/core/bun-native-fs.ts", () => ({
  fileReadStream: realFs.createReadStream,
  pathExists,
}));

mock.module("../../scripts/core/file-opener.ts", () => ({
  openDefaultUrl,
}));

const { openCoverageReport } = await import("../../scripts/coverage/open-coverage-report.ts");

describe("open coverage report", () => {
  const output = "coverage/index.html";
  const url = "http://127.0.0.1:41737/index.html";
  const originalFetch = global.fetch;

  beforeEach(() => {
    existsSync.mockReturnValue(true);
    pathExists.mockResolvedValue(true);
    openDefaultUrl.mockImplementation(async (value) => value);
    spawn.mockReturnValue({ unref: mock(() => undefined) });
    spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    existsSync.mockReset();
    pathExists.mockReset();
    openDefaultUrl.mockReset();
    spawn.mockReset();
    mock.restore();
    global.fetch = originalFetch;
  });

  test("opens the default coverage report when the local server is already ready", async () => {
    const fetchMock = mock<typeof fetch>();
    fetchMock.mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    await openCoverageReport();

    expect(openDefaultUrl).toHaveBeenCalledWith(url);
    expect(spawn).not.toHaveBeenCalled();
  });

  test("spawns the local server when needed before opening the report", async () => {
    const fetchMock = mock<typeof fetch>();
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    fetchMock.mockResolvedValueOnce({ ok: true } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    await openCoverageReport(output);

    expect(spawn).toHaveBeenCalled();
    expect(openDefaultUrl).toHaveBeenCalledWith(url);
  });

  test("opens a custom coverage report path", async () => {
    const fetchMock = mock<typeof fetch>();
    fetchMock.mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    await openCoverageReport(missingPreviewPath);

    expect(openDefaultUrl).toHaveBeenCalledWith(url);
  });

  test("exits when the coverage report has not been rendered", async () => {
    existsSync.mockReturnValue(false);
    pathExists.mockResolvedValue(false);
    spyOn(console, "error").mockImplementation(() => undefined);
    spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);

    await expect(openCoverageReport(missingPreviewPath)).rejects.toThrow("exit");
  });
});
