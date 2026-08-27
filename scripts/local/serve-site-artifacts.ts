import { existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { isEntrypoint } from "../core/script-entry.ts";

const defaultPort = 4174;
const siteArtifactsRoot = resolve("dist", "site-artifacts");
const workspaceRoot = resolve(process.cwd(), "..");

const projectDirectories = {
  "artifact-generator": "artifact-generator",
  cipher: "cipher",
  "cipher-trace": "cipher-trace",
  "cipher-wallet": "cipher-wallet",
  "connor-hunter": "connorhunter",
} as const;

type LocalProjectSlug = keyof typeof projectDirectories;
type ProjectArtifactKind = "changelog" | "coverage";

/** Returns the owning repository output for a locally generated project report. */
export function localProjectArtifactPath(
  slug: LocalProjectSlug,
  kind: ProjectArtifactKind,
  filename: string,
  root = workspaceRoot,
): string | undefined {
  if (kind === "coverage" && (filename === "index.json" || filename === "coverage.pdf")) {
    return join(root, projectDirectories[slug], "coverage", filename);
  }

  if (kind === "changelog" && (filename === "CHANGELOG.md" || filename === "changelog.pdf")) {
    const directory =
      slug === "artifact-generator"
        ? join(root, projectDirectories[slug], "dist", "changelog", slug)
        : join(root, projectDirectories[slug], "changelog");

    return join(directory, filename);
  }

  return undefined;
}

/** Resolves a public artifact request to a local project report or assembled bundle file. */
export function localArtifactPath(
  relativePath: string,
  root = workspaceRoot,
  bundleRoot = siteArtifactsRoot,
): string | undefined {
  const parts = relativePath.split("/");
  const [projects, slug, kind, filename] = parts;
  const projectSlug = slug as LocalProjectSlug;

  if (
    projects === "projects" &&
    projectSlug in projectDirectories &&
    (kind === "coverage" || kind === "changelog") &&
    typeof filename === "string" &&
    parts.length === 4
  ) {
    const projectPath = localProjectArtifactPath(projectSlug, kind, filename, root);
    if (projectPath && existsSync(projectPath)) return projectPath;
  }

  const bundlePath = resolve(bundleRoot, relativePath);
  if (bundlePath === bundleRoot || !bundlePath.startsWith(`${bundleRoot}${sep}`)) return undefined;

  return existsSync(bundlePath) ? bundlePath : undefined;
}

function requestPath(request: Request): string | undefined {
  let pathname: string;

  try {
    pathname = decodeURIComponent(new URL(request.url).pathname);
  } catch {
    return undefined;
  }

  const relativePath = pathname.replace(/^\/+/, "");
  if (
    !relativePath ||
    relativePath.includes("\\") ||
    relativePath.split("/").some((part) => part === "." || part === "..")
  ) {
    return undefined;
  }

  return relativePath;
}

function responseHeaders(): HeadersInit {
  return {
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  };
}

/** Starts a local public-artifact server with project-owned report overlays. */
export function serveLocalArtifacts(port = defaultPort): void {
  Bun.serve({
    hostname: "127.0.0.1",
    port,
    fetch(request) {
      if (request.method === "OPTIONS") return new Response(null, { headers: responseHeaders() });

      const relativePath = requestPath(request);
      const path = relativePath && localArtifactPath(relativePath);
      if (!path) return new Response("Not found", { status: 404, headers: responseHeaders() });

      return new Response(Bun.file(path), { headers: responseHeaders() });
    },
  });

  console.log(`Serving local artifacts at http://127.0.0.1:${port}`);
}

if (isEntrypoint(import.meta.url)) {
  const port = Number.parseInt(process.env.LOCAL_ARTIFACTS_PORT ?? `${defaultPort}`, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("LOCAL_ARTIFACTS_PORT must be a valid TCP port.");
  }

  serveLocalArtifacts(port);
}
