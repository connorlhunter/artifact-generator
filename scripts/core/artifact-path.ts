import { isAbsolute, resolve, sep } from "node:path";

/** Resolves a logical artifact path without allowing it to leave its source or output root. */
export function artifactPath(root: string, value: unknown): string {
  if (typeof value !== "string" || !value)
    throw new Error("Artifact paths must be non-empty strings.");
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new Error(`Invalid artifact path: ${value}`);
  }
  if (
    isAbsolute(decoded) ||
    /^[a-z][a-z\d+.-]*:/iu.test(decoded) ||
    /[\\\u0000-\u001f\u007f?#]/u.test(decoded) ||
    decoded.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new Error(`Artifact path escapes its root: ${value}`);
  const base = resolve(root);
  const path = resolve(base, decoded);
  if (!path.startsWith(`${base}${sep}`))
    throw new Error(`Artifact path escapes its root: ${value}`);
  return path;
}
