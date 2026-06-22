import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { missingPreviewPath, renderedDiagramPaths } from "../resources/docs.constants.ts";
import { diagramJobs } from "../resources/docs.mock.ts";

const openDefaultFile = mock<(file: string) => Promise<string>>();

mock.module("../../scripts/core/file-opener.ts", () => ({
  openDefaultFile,
}));

const { openRenderedDiagrams } = await import("../../scripts/diagrams/diagram-opener.ts");

describe("diagram opener", () => {
  beforeEach(() => {
    openDefaultFile.mockImplementation(async (file) => file);
  });

  afterEach(() => {
    openDefaultFile.mockReset();
    mock.restore();
  });

  test("opens rendered diagram files", async () => {
    spyOn(console, "log").mockImplementation(() => undefined);

    await openRenderedDiagrams(diagramJobs.map((job) => job.input));

    expect(openDefaultFile).toHaveBeenCalledTimes(diagramJobs.length);
  });

  test("opens overview files before detail files", async () => {
    spyOn(console, "log").mockImplementation(() => undefined);

    const files = [
      renderedDiagramPaths.key,
      renderedDiagramPaths.overview,
      renderedDiagramPaths.detail,
    ];

    await openRenderedDiagrams(files);

    expect(openDefaultFile).toHaveBeenNthCalledWith(1, renderedDiagramPaths.key);
    expect(openDefaultFile).toHaveBeenNthCalledWith(2, renderedDiagramPaths.overview);
  });

  test("exits when diagram files are missing", async () => {
    spyOn(console, "error").mockImplementation(() => undefined);
    spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);

    await expect(openRenderedDiagrams([missingPreviewPath])).rejects.toThrow("exit");
  });

  test("logs opener failures before exiting", async () => {
    spyOn(console, "log").mockImplementation(() => undefined);
    spyOn(console, "error").mockImplementation(() => undefined);
    spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);
    openDefaultFile.mockRejectedValueOnce({
      file: diagramJobs[0]!.input,
      error: new Error(diagramJobs[0]!.input),
      stdout: diagramJobs[0]!.input,
      stderr: diagramJobs[0]!.output,
    });

    await expect(openRenderedDiagrams([diagramJobs[0]!.input])).rejects.toThrow("exit");
  });

  test("logs opener failures without optional process output", async () => {
    spyOn(console, "log").mockImplementation(() => undefined);
    spyOn(console, "error").mockImplementation(() => undefined);
    spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);
    openDefaultFile.mockRejectedValueOnce({});

    await expect(openRenderedDiagrams([diagramJobs[0]!.input])).rejects.toThrow("exit");
  });
});
