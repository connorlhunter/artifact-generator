import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { stampDiagramSvg, stampRenderedDiagram } from "../../scripts/diagrams/stamp-diagram.ts";

describe("diagram stamps", () => {
  let tempDirectory = "";

  afterEach(() => {
    if (tempDirectory) rmSync(tempDirectory, { force: true, recursive: true });
    tempDirectory = "";
  });

  test("adds the shared publication date below the rendered diagram", () => {
    const stamped = stampDiagramSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><g id="diagram"/></svg>',
      "2026-08-18",
    );

    expect(stamped).toContain('viewBox="0 0 400 232"');
    expect(stamped).toContain('data-artifact-last-updated="2026-08-18"');
    expect(stamped).toContain('aria-label="Updated August 18, 2026"');
    expect(stamped).toContain(">Updated August 18, 2026</text>");
    expect(stamped).toContain('<g id="diagram"/>');
    expect(stamped).toContain('x="388" y="220"');
  });

  test("writes the date stamp to the rendered SVG file", () => {
    tempDirectory = mkdtempSync(join(tmpdir(), "diagram-stamp-"));
    const output = join(tempDirectory, "diagram.svg");
    writeFileSync(output, '<svg viewBox="4 8 300 120"></svg>');

    stampRenderedDiagram(output, "2026-08-18");

    expect(readFileSync(output, "utf8")).toContain("Updated August 18, 2026");
  });

  test("keeps the stamp inside narrow diagram viewBoxes", () => {
    const stamped = stampDiagramSvg('<svg viewBox="0 0 100 100"></svg>', "2026-08-18");
    const smallest = stampDiagramSvg('<svg viewBox="0 0 1 100"></svg>', "2026-08-18");

    expect(stamped).toContain('textLength="76" lengthAdjust="spacingAndGlyphs"');
    expect(smallest).toContain('x="0.75"');
    expect(smallest).toContain('textLength="0.5" lengthAdjust="spacingAndGlyphs"');
  });

  test("rejects SVGs without a usable viewBox", () => {
    expect(() => stampDiagramSvg("<g></g>", "2026-08-18")).toThrow("missing its root element");
    expect(() => stampDiagramSvg("<svg></svg>", "2026-08-18")).toThrow("missing a viewBox");
    expect(() => stampDiagramSvg('<svg viewBox="0 0 0 100"></svg>', "2026-08-18")).toThrow(
      "invalid viewBox",
    );
    expect(() => stampDiagramSvg('<svg viewBox="0 0 NaN 100"></svg>', "2026-08-18")).toThrow(
      "invalid viewBox",
    );
    expect(() => stampDiagramSvg('<svg viewBox="0 0 100"></svg>', "2026-08-18")).toThrow(
      "invalid viewBox",
    );
    expect(() => stampDiagramSvg('<svg viewBox="0 0 100 100">', "2026-08-18")).toThrow(
      "missing its closing element",
    );
  });
});
