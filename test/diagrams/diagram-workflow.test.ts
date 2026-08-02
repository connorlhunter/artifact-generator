import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import {
  diagramOutputs,
  diagramsFromArgs,
  exitIfNoDiagrams,
  logWorkflowStep,
} from "../../scripts/diagrams/diagram-workflow.ts";
import { diagramsFixtureRoot } from "../resources/docs.constants.ts";
import { diagramJobs } from "../resources/docs.mock.ts";

describe("diagram workflow", () => {
  afterEach(() => {
    mock.restore();
  });

  test("maps cli args to diagrams and outputs", () => {
    const diagrams = diagramsFromArgs([diagramsFixtureRoot, "local=/workspace/source"]);

    expect(diagrams.map((diagram) => diagram.input)).toEqual(
      expect.arrayContaining(diagramJobs.map((job) => job.input)),
    );
    expect(diagramOutputs(diagramJobs)).toEqual(diagramJobs.map((job) => job.output));
  });

  test("logs workflow steps and exits on empty diagram sets", () => {
    const log = spyOn(console, "log").mockImplementation(() => undefined);
    const error = spyOn(console, "error").mockImplementation(() => undefined);
    spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);

    logWorkflowStep(1, 2, "Testing");

    expect(log).toHaveBeenCalledWith(expect.stringContaining("[1/2] Testing"));
    expect(() => exitIfNoDiagrams([])).toThrow("exit");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("No Mermaid diagrams found."));
  });
});
