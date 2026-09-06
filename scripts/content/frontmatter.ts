const frontmatterPattern = /^---\s*\n(?<json>[\s\S]*?)\n---\s*\n?(?<body>[\s\S]*)$/u;

export function parseFrontmatter(raw: string): {
  readonly body: string;
  readonly metadata: unknown;
} {
  const match = frontmatterPattern.exec(raw);
  if (!match?.groups?.json || match.groups.body === undefined) {
    throw new Error("Expected JSON frontmatter delimited by ---.");
  }

  return {
    body: match.groups.body.trim(),
    metadata: JSON.parse(
      match.groups.json.replace(/"(?:\\.|[^"\\])*"|,\s*(?=[}\]])/gu, (value) =>
        value.startsWith('"') ? value : "",
      ),
    ),
  };
}
