import { readFileSync, writeFileSync } from "node:fs";
import { formatArtifactUpdatedDate } from "../publish/update-content-manifest.ts";

const footerHeight = 32;
const footerInset = 12;
const stampId = "artifact-last-updated";
const averageStampCharacterWidth = 6.5;

interface SvgViewBox {
  height: number;
  width: number;
  x: number;
  y: number;
}

/**
 * Adds the shared artifact publication date below a rendered Mermaid diagram.
 *
 * @param svg - Rendered SVG document.
 * @param lastUpdated - ISO calendar date from the source content manifest.
 * @returns SVG with a visible update stamp and room for its footer.
 */
export function stampDiagramSvg(svg: string, lastUpdated: string): string {
  const rootTagMatch = /<svg\b[^>]*>/u.exec(svg);
  if (rootTagMatch === null) throw new Error("Diagram SVG is missing its root element.");

  const rootTag = rootTagMatch[0];
  const viewBox = svgViewBox(rootTag);
  const viewBoxValue = [viewBox.x, viewBox.y, viewBox.width, viewBox.height + footerHeight].join(
    " ",
  );
  const label = "Updated " + formatArtifactUpdatedDate(lastUpdated);
  const stamp = diagramStamp(viewBox, label, lastUpdated);
  const updatedRootTag = rootTag
    .replace(/\bviewBox\s*=\s*(["'])([^"']+)\1/u, 'viewBox="' + viewBoxValue + '"')
    .replace(/>$/u, ' data-artifact-last-updated="' + escapeXml(lastUpdated) + '">');

  if (!/<\/svg>\s*$/u.test(svg)) throw new Error("Diagram SVG is missing its closing element.");

  return svg.replace(rootTag, updatedRootTag).replace(/<\/svg>\s*$/u, stamp + "</svg>");
}

/**
 * Stamps a rendered Mermaid SVG in place.
 *
 * @param output - Rendered SVG file to update.
 * @param lastUpdated - ISO calendar date from the source content manifest.
 */
export function stampRenderedDiagram(output: string, lastUpdated: string): void {
  writeFileSync(output, stampDiagramSvg(readFileSync(output, "utf8"), lastUpdated));
}

function svgViewBox(rootTag: string): SvgViewBox {
  const viewBoxMatch = /\bviewBox\s*=\s*(["'])([^"']+)\1/u.exec(rootTag);
  if (viewBoxMatch === null) throw new Error("Diagram SVG is missing a viewBox.");

  const viewBoxValue = viewBoxMatch[2] ?? "";

  const values = viewBoxValue
    .trim()
    .split(/[\s,]+/u)
    .map(Number);

  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    throw new Error("Diagram SVG has an invalid viewBox.");
  }

  const [x, y, width, height] = values as [number, number, number, number];
  if (width <= 0 || height <= 0) throw new Error("Diagram SVG has an invalid viewBox.");

  return { height, width, x, y };
}

function diagramStamp(viewBox: SvgViewBox, label: string, lastUpdated: string): string {
  const horizontalInset = Math.min(footerInset, viewBox.width / 4);
  const x = viewBox.x + viewBox.width - horizontalInset;
  const y = viewBox.y + viewBox.height + footerHeight - footerInset;
  const availableTextWidth = viewBox.width - horizontalInset * 2;
  const textLength =
    label.length * averageStampCharacterWidth > availableTextWidth
      ? ' textLength="' + availableTextWidth + '" lengthAdjust="spacingAndGlyphs"'
      : "";

  return (
    '<g id="' +
    stampId +
    '" data-artifact-last-updated="' +
    escapeXml(lastUpdated) +
    '" aria-label="' +
    escapeXml(label) +
    '" role="note"><text x="' +
    x +
    '" y="' +
    y +
    '" text-anchor="end" fill="#667085" font-family="Arial, sans-serif" font-size="12"' +
    textLength +
    ">" +
    escapeXml(label) +
    "</text></g>"
  );
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
