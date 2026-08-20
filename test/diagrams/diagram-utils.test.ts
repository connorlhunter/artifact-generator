import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  allSettledWithFirstPriority,
  allSettledWithPriorityPrefix,
  compactName,
  failedResults,
  findDiagrams,
  getDiagramRoots,
  groupByProject,
  isOverviewDiagram,
  outputDirs,
  validateOutputPath,
} from "../../scripts/diagrams/diagram-utils.ts";
import { diagramJobs } from "../resources/docs.mock.ts";
import {
  diagramMetadata,
  diagramOutputPaths,
  diagramPaths,
  diagramsFixtureRoot,
  repoFixtureProjectName,
  repoFixtureRoot,
} from "../resources/docs.constants.ts";
import { sourceInputDirs } from "../../scripts/core/script-constants.ts";

describe("diagram utils", () => {
  test("discovers diagrams and derives output metadata", () => {
    const diagrams = findDiagrams([diagramsFixtureRoot]);
    const inputs = diagrams.map((diagram) => diagram.input);

    expect(inputs).toEqual(
      expect.arrayContaining([
        diagramPaths.projectOverview,
        diagramPaths.projectDiagram,
        diagramPaths.nestedDiagram,
      ]),
    );
    expect(inputs.indexOf(diagramPaths.projectOverview)).toBeLessThan(
      inputs.indexOf(diagramPaths.projectDiagram),
    );
    expect(diagrams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input: diagramPaths.projectDiagram,
          output: diagramOutputPaths.projectDiagram,
          ...diagramMetadata.projectDiagram,
        }),
      ]),
    );
    expect(outputDirs(diagramJobs)).toContain(diagramsFixtureRoot + "/project");
    expect(compactName(diagramPaths.projectDiagram)).toBe("flow");
    expect(compactName("")).toBe("");
    expect(isOverviewDiagram(diagramPaths.projectOverview)).toBe(true);
    expect(isOverviewDiagram(diagramPaths.projectDiagram)).toBe(false);
    expect(validateOutputPath(diagramJobs[0]!.output)).toContain(
      "project-overview-v2.1.0-2026-08-17.svg",
    );
    expect([...groupByProject(diagramJobs).keys()]).toEqual(["test"]);
    expect([
      ...groupByProject([
        ...diagramJobs,
        { input: "", output: "empty.svg", lastUpdated: "2026-08-18", version: "1.0.0" },
      ]).keys(),
    ]).toEqual(["test", ""]);
    expect([
      ...groupByProject([
        {
          input: "diagrams/example/example-overview.mmd",
          output: "diagrams/example/example-overview-v1.0.0-2026-08-18.svg",
          lastUpdated: "2026-08-18",
          version: "1.0.0",
        },
      ]).keys(),
    ]).toEqual(["example"]);
    expect([
      ...groupByProject([
        {
          input: `${sourceInputDirs.diagrams}/source-project/source-project-overview.mmd`,
          output: `${sourceInputDirs.diagrams}/source-project/source-project-overview-v1.0.0-2026-08-18.svg`,
          lastUpdated: "2026-08-18",
          version: "1.0.0",
        },
      ]).keys(),
    ]).toEqual(["source-project"]);

    const originalCwd = process.cwd();
    process.chdir(resolve(originalCwd, repoFixtureRoot));
    try {
      expect(
        findDiagrams([`diagrams/${repoFixtureProjectName}`]).map((diagram) => diagram.input),
      ).toEqual(
        expect.arrayContaining([
          `diagrams/${repoFixtureProjectName}/${repoFixtureProjectName}-overview.mmd`,
        ]),
      );
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("normalizes roots and returns rejected allSettled results", async () => {
    const settled = await allSettledWithFirstPriority(diagramJobs, async (job) => {
      if (job.input === diagramPaths.nestedDiagram) throw new Error(job.input);
      return job.output;
    });

    expect(getDiagramRoots(["--" + diagramsFixtureRoot, "--missing-root"])).toEqual([
      diagramsFixtureRoot,
      `${sourceInputDirs.diagrams}/missing-root`,
    ]);
    expect(getDiagramRoots([])).toEqual([]);
    expect(getDiagramRoots(["."])).toEqual([]);
    expect(getDiagramRoots([sourceInputDirs.diagrams])).toEqual([]);
    expect(getDiagramRoots(["diagrams"])).toEqual([]);

    const originalCwd = process.cwd();
    process.chdir(resolve(originalCwd, repoFixtureRoot));
    try {
      expect(getDiagramRoots([`--${repoFixtureProjectName}`])).toEqual([
        `${sourceInputDirs.diagrams}/${repoFixtureProjectName}`,
      ]);
    } finally {
      process.chdir(originalCwd);
    }

    expect(getDiagramRoots([])).toEqual([]);
    expect(failedResults(settled)).toHaveLength(1);
    expect(
      failedResults(
        await allSettledWithFirstPriority(diagramJobs, async (job) => {
          if (job.input === diagramPaths.projectOverview) throw new Error(job.input);
          return job.output;
        }),
      ),
    ).toHaveLength(1);
    expect(await allSettledWithFirstPriority([], async () => "unused")).toEqual([]);
    expect(
      await allSettledWithPriorityPrefix(diagramJobs, 0, async (job) => job.output),
    ).toHaveLength(diagramJobs.length);
    expect(
      await allSettledWithPriorityPrefix(diagramJobs, 99, async (job) => job.output),
    ).toHaveLength(diagramJobs.length);
  });
});
