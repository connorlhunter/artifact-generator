import { readFileSync, writeFileSync } from "node:fs";
import {
  formatUpdatedDate,
  validateArtifactVersion,
  validateUpdatedDate,
  type VersionedArtifactMetadata,
} from "../core/versioned-artifact-metadata.ts";

const stampId = "artifact-version";
const footerHeightRatio = 0.08;
const footerInsetRatio = 0.03;
const fontSizeRatio = 0.03;
const minimumFooterHeight = 32;
const minimumFooterInset = 12;
const minimumFontSize = 12;
const averageStampCharacterWidth = 0.55;

interface SvgViewBox {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface StampMetrics {
  footerHeight: number;
  footerInset: number;
  fontSize: number;
}

/**
 * Adds a source-owned version and publication date below a rendered Mermaid diagram.
 *
 * @param svg - Rendered SVG document.
 * @param metadata - Version and date declared by the Mermaid source.
 * @returns SVG with a visible metadata stamp and room for its footer.
 */
export function stampDiagramSvg(svg: string, metadata: VersionedArtifactMetadata): string {
  const rootTagMatch = /<svg\b[^>]*>/u.exec(svg);
  if (rootTagMatch === null) throw new Error("Diagram SVG is missing its root element.");

  const rootTag = rootTagMatch[0];
  const viewBox = svgViewBox(rootTag);
  const version = validateArtifactVersion(metadata.version, "diagram version");
  const lastUpdated = validateUpdatedDate(metadata.lastUpdated, "diagram lastUpdated");
  const metrics = stampMetrics(viewBox);
  const viewBoxValue = [
    viewBox.x,
    viewBox.y,
    viewBox.width,
    viewBox.height + metrics.footerHeight,
  ].join(" ");
  const label = `v${version} · Updated ${formatUpdatedDate(lastUpdated)}`;
  const stamp = diagramStamp(viewBox, metrics, label, version, lastUpdated);
  const updatedRootTag = rootTag
    .replace(/\bviewBox\s*=\s*(["'])([^"']+)\1/u, 'viewBox="' + viewBoxValue + '"')
    .replace(
      />$/u,
      ' data-artifact-last-updated="' +
        escapeXml(lastUpdated) +
        '" data-artifact-version="' +
        escapeXml(version) +
        '">',
    );

  if (!/<\/svg>\s*$/u.test(svg)) throw new Error("Diagram SVG is missing its closing element.");

  return svg.replace(rootTag, updatedRootTag).replace(/<\/svg>\s*$/u, stamp + "</svg>");
}

/**
 * Stamps a rendered Mermaid SVG in place.
 *
 * @param output - Rendered SVG file to update.
 * @param metadata - Version and date declared by the Mermaid source.
 */
export function stampRenderedDiagram(output: string, metadata: VersionedArtifactMetadata): void {
  writeFileSync(output, stampDiagramSvg(readFileSync(output, "utf8"), metadata));
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

function stampMetrics(viewBox: SvgViewBox): StampMetrics {
  const footerInset = Math.min(
    Math.max(viewBox.width * footerInsetRatio, minimumFooterInset),
    viewBox.width / 4,
  );

  return {
    fontSize: Math.max(viewBox.width * fontSizeRatio, minimumFontSize),
    footerHeight: Math.max(viewBox.width * footerHeightRatio, minimumFooterHeight),
    footerInset,
  };
}

function diagramStamp(
  viewBox: SvgViewBox,
  metrics: StampMetrics,
  label: string,
  version: string,
  lastUpdated: string,
): string {
  const footerY = viewBox.y + viewBox.height;
  const x = viewBox.x + viewBox.width - metrics.footerInset;
  const y = footerY + metrics.footerHeight / 2;
  const availableTextWidth = viewBox.width - metrics.footerInset * 2;
  const textLength =
    label.length * metrics.fontSize * averageStampCharacterWidth > availableTextWidth
      ? ' textLength="' + availableTextWidth + '" lengthAdjust="spacingAndGlyphs"'
      : "";

  return (
    '<g id="' +
    stampId +
    '" data-artifact-last-updated="' +
    escapeXml(lastUpdated) +
    '" data-artifact-version="' +
    escapeXml(version) +
    '" aria-label="' +
    escapeXml(label) +
    '" role="note"><rect x="' +
    viewBox.x +
    '" y="' +
    footerY +
    '" width="' +
    viewBox.width +
    '" height="' +
    metrics.footerHeight +
    '" fill="#111827"/><text x="' +
    x +
    '" y="' +
    y +
    '" text-anchor="end" dominant-baseline="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="' +
    metrics.fontSize +
    '" font-weight="700"' +
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
