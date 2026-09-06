import { readFileSync } from "node:fs";

export function jsonObject(value: unknown, subject: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${subject} must contain an object.`);
  }
  return value as Record<string, unknown>;
}

export function readJsonObject(path: string): Record<string, unknown> {
  return jsonObject(JSON.parse(readFileSync(path, "utf8")), path);
}

/** Reads the shared project order and validates slugs before they become file paths. */
export function readProjectManifest(path: string): Record<string, Record<string, unknown>> {
  const source = jsonObject(readJsonObject(path).projects, `${path} projects`);
  return Object.fromEntries(
    Object.entries(source).map(([slug, entry]) => {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug))
        throw new Error(`Invalid project slug: ${slug}`);
      return [slug, jsonObject(entry, `${path} project ${slug}`)];
    }),
  );
}
