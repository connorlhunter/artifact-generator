import { statSync } from "node:fs";
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

function isFile(path: string): boolean {
  try {
    return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
  } catch {
    return false;
  }
}

/** Optional local roots used when serving a prepared artifact bundle. */
export interface ServeLocalArtifactsOptions {
  readonly bundleRoot?: string;
  readonly root?: string;
}

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
    Object.hasOwn(projectDirectories, projectSlug) &&
    (kind === "coverage" || kind === "changelog") &&
    typeof filename === "string" &&
    parts.length === 4
  ) {
    const projectPath = localProjectArtifactPath(projectSlug, kind, filename, root);
    if (projectPath && isFile(projectPath)) return projectPath;
  }

  const bundlePath = resolve(bundleRoot, relativePath);
  if (bundlePath === bundleRoot || !bundlePath.startsWith(`${bundleRoot}${sep}`)) return undefined;

  return isFile(bundlePath) ? bundlePath : undefined;
}

/** Returns a safe relative artifact path from a public request. */
export function artifactRequestPath(request: Request): string | undefined {
  let pathname: string;

  try {
    pathname = decodeURIComponent(new URL(request.url).pathname);
  } catch {
    return undefined;
  }

  const relativePath = pathname.replace(/^\/+/, "");
  if (
    !relativePath ||
    /[\\\u0000-\u001f\u007f]/u.test(relativePath) ||
    relativePath.split("/").some((part) => part === "." || part === "..")
  ) {
    return undefined;
  }

  return relativePath;
}

/** Returns the common non-cacheable, cross-origin response headers. */
export function artifactResponseHeaders(): HeadersInit {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, HEAD, OPTIONS",
    "cache-control": "no-store",
  };
}

/** Resolves and serves one local public-artifact request. */
export function localArtifactResponse(
  request: Request,
  root = workspaceRoot,
  bundleRoot = siteArtifactsRoot,
): Response {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: artifactResponseHeaders() });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...artifactResponseHeaders(), allow: "GET, HEAD, OPTIONS" },
    });
  }

  const relativePath = artifactRequestPath(request);
  const path = relativePath && localArtifactPath(relativePath, root, bundleRoot);

  if (!path) return new Response("Not found", { status: 404, headers: artifactResponseHeaders() });

  const file = Bun.file(path);
  const headers = new Headers(artifactResponseHeaders());
  headers.set("content-type", file.type);
  headers.set("content-length", String(file.size));
  return new Response(request.method === "HEAD" ? null : file, { headers });
}

/** Starts a local public-artifact server with project-owned report overlays. */
export function serveLocalArtifacts(
  port = defaultPort,
  options: ServeLocalArtifactsOptions = {},
): ReturnType<typeof Bun.serve> {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    fetch: (request) => localArtifactResponse(request, options.root, options.bundleRoot),
  });

  console.log(`Serving local artifacts at http://127.0.0.1:${port}`);
  return server;
}

if (isEntrypoint(import.meta.url)) {
  const port = Number(process.env.LOCAL_ARTIFACTS_PORT ?? defaultPort);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("LOCAL_ARTIFACTS_PORT must be a valid TCP port.");
  }

  serveLocalArtifacts(port);
}
