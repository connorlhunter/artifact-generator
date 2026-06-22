import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { diagramsFixtureRoot } from "../resources/docs.constants.ts";
import { diagramJobs } from "../resources/docs.mock.ts";

const runPhase = mock<(phase: "validate" | "render", items: typeof diagramJobs) => Promise<void>>();
const openRenderedDiagrams = mock<(files: string[]) => Promise<void>>();

mock.module("../../scripts/diagrams/diagram-runner.ts", () => ({
  runPhase,
}));

mock.module("../../scripts/diagrams/diagram-opener.ts", () => ({
  openRenderedDiagrams,
}));

const { validateDiagrams } = await import("../../scripts/diagrams/validate-diagrams.ts");
const { renderDiagrams } = await import("../../scripts/diagrams/render-diagrams.ts");
const { openDiagrams } = await import("../../scripts/diagrams/open-diagrams.ts");
const { renderOpenDiagrams } = await import("../../scripts/diagrams/render-open-diagrams.ts");

describe("diagram entrypoints", () => {
  beforeEach(() => {
    runPhase.mockResolvedValue(undefined);
    openRenderedDiagrams.mockResolvedValue(undefined);
    spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    runPhase.mockReset();
    openRenderedDiagrams.mockReset();
    mock.restore();
  });

  test("validates, renders, opens, and render-opens selected diagrams", async () => {
    await validateDiagrams([diagramsFixtureRoot]);
    await renderDiagrams([diagramsFixtureRoot]);
    await openDiagrams([diagramsFixtureRoot]);
    await renderOpenDiagrams([diagramsFixtureRoot]);

    expect(runPhase).toHaveBeenCalledWith("validate", expect.any(Array));
    expect(runPhase).toHaveBeenCalledWith("render", expect.any(Array));
    expect(openRenderedDiagrams).toHaveBeenCalledWith(expect.any(Array));
  });
});
