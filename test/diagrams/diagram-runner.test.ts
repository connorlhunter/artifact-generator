import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { diagramJobs } from "../resources/docs.mock.ts";

type RunCommand = (
  command: string,
  args: string[],
  context: Record<string, unknown>,
) => Promise<{ stdout: string; stderr: string }>;

const runCommand = mock<RunCommand>();
const readArtifactUpdatedDate = mock<() => string>();
const stampRenderedDiagram = mock<(output: string, lastUpdated: string) => void>();

mock.module("../../scripts/core/process-utils.ts", () => ({
  runCommand,
}));

mock.module("../../scripts/publish/update-content-manifest.ts", () => ({
  readArtifactUpdatedDate,
}));

mock.module("../../scripts/diagrams/stamp-diagram.ts", () => ({
  stampRenderedDiagram,
}));

const { runPhase } = await import("../../scripts/diagrams/diagram-runner.ts");

describe("diagram runner", () => {
  beforeEach(() => {
    runCommand.mockResolvedValue({ stdout: "", stderr: "" });
    readArtifactUpdatedDate.mockReturnValue("2026-08-18");
  });

  afterEach(() => {
    runCommand.mockReset();
    readArtifactUpdatedDate.mockReset();
    stampRenderedDiagram.mockReset();
    mock.restore();
  });

  test("runs validation and render phases through Mermaid CLI", async () => {
    spyOn(console, "log").mockImplementation(() => undefined);

    await runPhase("validate", [diagramJobs[0]!]);
    await runPhase("render", [diagramJobs[0]!]);

    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(runCommand).toHaveBeenNthCalledWith(
      1,
      process.platform === "win32" ? "bun.cmd" : "bun",
      ["x", "mmdc", "-i", diagramJobs[0]!.input, "-o", expect.stringMatching(/\.svg$/)],
      expect.objectContaining({
        input: diagramJobs[0]!.input,
      }),
    );
    expect(runCommand).toHaveBeenNthCalledWith(
      2,
      process.platform === "win32" ? "bun.cmd" : "bun",
      ["x", "mmdc", "-i", diagramJobs[0]!.input, "-o", diagramJobs[0]!.output],
      expect.objectContaining({
        output: diagramJobs[0]!.output,
      }),
    );
    expect(readArtifactUpdatedDate).toHaveBeenCalledTimes(1);
    expect(stampRenderedDiagram).toHaveBeenCalledWith(diagramJobs[0]!.output, "2026-08-18");
  });

  test("does not read or stamp the temporary validation SVG", async () => {
    spyOn(console, "log").mockImplementation(() => undefined);

    await runPhase("validate", [diagramJobs[0]!]);

    expect(readArtifactUpdatedDate).not.toHaveBeenCalled();
    expect(stampRenderedDiagram).not.toHaveBeenCalled();
  });

  test("logs all phase failures before exiting", async () => {
    spyOn(console, "log").mockImplementation(() => undefined);
    spyOn(console, "error").mockImplementation(() => undefined);
    spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);
    runCommand.mockRejectedValueOnce({
      input: diagramJobs[0]!.input,
      error: new Error(diagramJobs[0]!.input),
      stdout: diagramJobs[0]!.input,
      stderr: diagramJobs[0]!.output,
    });

    await expect(runPhase("render", [diagramJobs[0]!])).rejects.toThrow("exit");
  });

  test("logs phase failures without optional process output", async () => {
    spyOn(console, "log").mockImplementation(() => undefined);
    spyOn(console, "error").mockImplementation(() => undefined);
    spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);
    runCommand.mockRejectedValueOnce({});

    await expect(runPhase("validate", [diagramJobs[0]!])).rejects.toThrow("exit");
  });
});
