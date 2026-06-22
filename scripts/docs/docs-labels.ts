const docsLabelOverrides = new Map([
  ["api", "API"],
  ["aws", "AWS"],
  ["bun", "Bun"],
  ["cloudfront", "CloudFront"],
  ["cognito", "Cognito"],
  ["dynamodb", "DynamoDB"],
  ["e2ee", "E2EE"],
  ["html", "HTML"],
  ["javascript", "JavaScript"],
  ["jwt", "JWT"],
  ["kms", "KMS"],
  ["lambda", "Lambda"],
  ["lambdas", "Lambdas"],
  ["litecoin", "Litecoin"],
  ["markdown", "Markdown"],
  ["mermaid", "Mermaid"],
  ["mvp", "MVP"],
  ["oac", "OAC"],
  ["oidc", "OIDC"],
  ["pdf", "PDF"],
  ["prettier", "Prettier"],
  ["readme", "README"],
  ["rust", "Rust"],
  ["s3", "S3"],
  ["sse", "SSE"],
  ["svg", "SVG"],
  ["tanstack", "TanStack"],
  ["ttl", "TTL"],
  ["typescript", "TypeScript"],
  ["ui", "UI"],
  ["url", "URL"],
  ["urls", "URLs"],
  ["websocket", "WebSocket"],
  ["websockets", "WebSockets"],
  ["zod", "Zod"],
  ["zustand", "Zustand"],
]);

/**
 * Formats a path segment or slug for display in the docs preview.
 *
 * @param {string} value - Slug, filename stem, or path segment.
 * @returns {string} Label.
 */
export function formatDocLabel(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map(
      (word) =>
        docsLabelOverrides.get(word.toLowerCase()) ??
        `${word.charAt(0).toUpperCase()}${word.slice(1)}`,
    )
    .join(" ");
}

/**
 * Formats path segments into one section title.
 *
 * @param {string[]} segments - Path segments to display.
 * @returns {string} Section title.
 */
export function formatDocSectionTitle(segments: string[]): string {
  return segments.map(formatDocLabel).join(" ");
}
