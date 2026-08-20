import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  diagramOutputPath,
  diagramSourcePath,
  isVersionedDiagramOutput,
  parseDiagramMetadata,
  readDiagramMetadata,
} from "../../scripts/diagrams/diagram-metadata.ts";

describe("diagram metadata", () => {
  let tempDirectory = "";

  afterEach(() => {
    if (tempDirectory) rmSync(tempDirectory, { force: true, recursive: true });
    tempDirectory = "";
  });

  test("parses the canonical first-line declaration and derives a versioned SVG path", () => {
    const metadata = parseDiagramMetadata(
      "%% artifact-generator:version=2.4.1 lastUpdated=2026-08-18\nflowchart TD\n",
      "diagrams/example/overview.mmd",
    );

    expect(metadata).toEqual({ lastUpdated: "2026-08-18", version: "2.4.1" });
    expect(diagramOutputPath("diagrams/example/overview.mmd", metadata)).toBe(
      "diagrams/example/overview-v2.4.1-2026-08-18.svg",
    );
    expect(diagramSourcePath("diagrams/example/overview-v2.4.1-2026-08-18.svg")).toBe(
      "diagrams/example/overview.mmd",
    );
    expect(isVersionedDiagramOutput("diagrams/example/overview-v2.4.1-2026-08-18.svg")).toBe(true);
    expect(isVersionedDiagramOutput("diagrams/example/overview.svg")).toBe(false);
    expect(isVersionedDiagramOutput("diagrams/example/overview-v2.4.1-2026-02-30.svg")).toBe(false);
  });

  test("reads required metadata from Mermaid sources", () => {
    tempDirectory = mkdtempSync(join(tmpdir(), "diagram-metadata-"));
    const input = join(tempDirectory, "example.mmd");
    writeFileSync(
      input,
      "%% artifact-generator:version=1.0.0 lastUpdated=2024-02-29\nflowchart TD\n",
    );

    expect(readDiagramMetadata(input)).toEqual({ lastUpdated: "2024-02-29", version: "1.0.0" });
  });

  test("requires one exact first-line Mermaid declaration", () => {
    expect(() => parseDiagramMetadata("flowchart TD\n", "example.mmd")).toThrow("must begin");
    expect(() =>
      parseDiagramMetadata(
        "%% artifact-generator:version=1.0 lastUpdated=2026-08-18\nflowchart TD\n",
        "example.mmd",
      ),
    ).toThrow("major.minor.patch");
    expect(() =>
      parseDiagramMetadata(
        "%% artifact-generator:version=1.0.0 lastUpdated=2026-02-30\nflowchart TD\n",
        "example.mmd",
      ),
    ).toThrow("real calendar date");
    expect(() =>
      parseDiagramMetadata(
        "%% artifact-generator:version=1.0.0 lastUpdated=2026-08-18 \nflowchart TD\n",
        "example.mmd",
      ),
    ).toThrow("must begin");
    expect(() =>
      parseDiagramMetadata(
        "%% artifact-generator:version=1.0.0 lastUpdated=2026-08-18\n%% artifact-generator:version=1.0.1 lastUpdated=2026-08-19\nflowchart TD\n",
        "example.mmd",
      ),
    ).toThrow("duplicate");
  });
});
