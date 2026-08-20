import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { stampDiagramSvg, stampRenderedDiagram } from "../../scripts/diagrams/stamp-diagram.ts";

describe("diagram stamps", () => {
  let tempDirectory = "";
  const metadata = { lastUpdated: "2026-08-18", version: "1.0.0" };

  afterEach(() => {
    if (tempDirectory) rmSync(tempDirectory, { force: true, recursive: true });
    tempDirectory = "";
  });

  test("adds a high-contrast, source-owned version and date below the rendered diagram", () => {
    const stamped = stampDiagramSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><g id="diagram"/></svg>',
      metadata,
    );

    expect(stamped).toContain('viewBox="0 0 400 232"');
    expect(stamped).toContain('data-artifact-last-updated="2026-08-18"');
    expect(stamped).toContain('data-artifact-version="1.0.0"');
    expect(stamped).toContain('aria-label="v1.0.0 · Updated August 18, 2026"');
    expect(stamped).toContain(">v1.0.0 · Updated August 18, 2026</text>");
    expect(stamped).toContain('<rect x="0" y="200" width="400" height="32" fill="#111827"/>');
    expect(stamped).toContain('fill="#ffffff"');
    expect(stamped).toContain('<g id="diagram"/>');
    expect(stamped).toContain('x="388" y="216"');
  });

  test("writes the date stamp to the rendered SVG file", () => {
    tempDirectory = mkdtempSync(join(tmpdir(), "diagram-stamp-"));
    const output = join(tempDirectory, "diagram.svg");
    writeFileSync(output, '<svg viewBox="4 8 300 120"></svg>');

    stampRenderedDiagram(output, metadata);

    expect(readFileSync(output, "utf8")).toContain("v1.0.0 · Updated August 18, 2026");
  });

  test("keeps the stamp inside narrow diagram viewBoxes", () => {
    const stamped = stampDiagramSvg('<svg viewBox="0 0 100 100"></svg>', metadata);
    const smallest = stampDiagramSvg('<svg viewBox="0 0 1 100"></svg>', metadata);

    expect(stamped).toContain('viewBox="0 0 100 132"');
    expect(stamped).toContain('textLength="76" lengthAdjust="spacingAndGlyphs"');
    expect(smallest).toContain('viewBox="0 0 1 132"');
    expect(smallest).toContain('x="0.75"');
    expect(smallest).toContain('textLength="0.5" lengthAdjust="spacingAndGlyphs"');
  });

  test("scales stamp metrics from SVG width for wide, short diagrams", () => {
    const stamped = stampDiagramSvg('<svg viewBox="0 0 2000 100"></svg>', metadata);

    expect(stamped).toContain('viewBox="0 0 2000 260"');
    expect(stamped).toContain('<rect x="0" y="100" width="2000" height="160" fill="#111827"/>');
    expect(stamped).toContain('x="1940" y="180"');
    expect(stamped).toContain('font-size="60"');
  });

  test("rejects SVGs without a usable viewBox", () => {
    expect(() => stampDiagramSvg("<g></g>", metadata)).toThrow("missing its root element");
    expect(() => stampDiagramSvg("<svg></svg>", metadata)).toThrow("missing a viewBox");
    expect(() => stampDiagramSvg('<svg viewBox="0 0 0 100"></svg>', metadata)).toThrow(
      "invalid viewBox",
    );
    expect(() => stampDiagramSvg('<svg viewBox="0 0 NaN 100"></svg>', metadata)).toThrow(
      "invalid viewBox",
    );
    expect(() => stampDiagramSvg('<svg viewBox="0 0 100"></svg>', metadata)).toThrow(
      "invalid viewBox",
    );
    expect(() => stampDiagramSvg('<svg viewBox="0 0 100 100">', metadata)).toThrow(
      "missing its closing element",
    );
  });
});
