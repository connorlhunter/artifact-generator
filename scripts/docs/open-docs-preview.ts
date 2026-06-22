import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { basename, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fileReadStream, pathExists } from "../core/bun-native-fs.ts";
import { openDefaultUrl } from "../core/file-opener.ts";
import { docsPreviewServer } from "../core/script-constants.ts";
import { isEntrypoint } from "../core/script-entry.ts";
import {
  logCaughtError,
  logCommandHint,
  logError,
  logErrorItem,
  logHeading,
  logItem,
  logSuccess,
} from "../core/script-logger.ts";
import { docsPreviewOutput } from "./docs-utils.ts";

/**
 * Runtime docs preview server configuration.
 */
export interface DocsPreviewServerConfig {
  /**
   * CLI flag used by the detached server process.
   */
  arg: string;
  /**
   * Hostname used by the local static server.
   */
  host: string;
  /**
   * Port used by the local static server.
   */
  port: number;
  /**
   * Milliseconds between readiness checks.
   */
  waitStepMs: number;
  /**
   * Maximum milliseconds to wait for the detached server.
   */
  waitTimeoutMs: number;
}

type Environment = Record<string, string | undefined>;

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
]);

/**
 * Parses a positive integer environment setting.
 *
 * @param {Environment} env - Environment values to inspect.
 * @param {string} key - Environment variable name.
 * @param {number} defaultValue - Default value when unset.
 * @returns {number} Parsed value.
 */
function positiveIntegerEnv(env: Environment, key: string, defaultValue: number): number {
  const rawValue = env[key]?.trim();
  if (!rawValue) return defaultValue;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }

  return value;
}

/**
 * Parses a TCP port environment setting.
 *
 * @param {Environment} env - Environment values to inspect.
 * @param {string} key - Environment variable name.
 * @param {number} defaultValue - Default port when unset.
 * @returns {number} Parsed port.
 */
function portEnv(env: Environment, key: string, defaultValue: number): number {
  const port = positiveIntegerEnv(env, key, defaultValue);
  if (port > 65_535) throw new Error(`${key} must be between 1 and 65535.`);

  return port;
}

/**
 * Resolves docs preview server settings from environment variables.
 *
 * @param {Environment} env - Environment values to inspect.
 * @returns {DocsPreviewServerConfig} Local server config.
 */
export function resolveDocsPreviewServerConfig(
  env: Environment = process.env,
): DocsPreviewServerConfig {
  return {
    arg: docsPreviewServer.arg,
    host: env[docsPreviewServer.hostEnv]?.trim() || docsPreviewServer.defaultHost,
    port: portEnv(env, docsPreviewServer.portEnv, docsPreviewServer.defaultPort),
    waitStepMs: positiveIntegerEnv(
      env,
      docsPreviewServer.waitStepMsEnv,
      docsPreviewServer.defaultWaitStepMs,
    ),
    waitTimeoutMs: positiveIntegerEnv(
      env,
      docsPreviewServer.waitTimeoutMsEnv,
      docsPreviewServer.defaultWaitTimeoutMs,
    ),
  };
}

/**
 * Waits for a short amount of time.
 *
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>} Resolves after the delay.
 */
/* istanbul ignore next */
function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

/**
 * Returns the local docs preview URL for the configured server.
 *
 * @param {string} output - Rendered preview HTML path.
 * @param {DocsPreviewServerConfig} config - Server settings.
 * @returns {string} Docs preview URL.
 */
export function docsPreviewUrl(
  output: string = docsPreviewOutput,
  config: DocsPreviewServerConfig = resolveDocsPreviewServerConfig(),
): string {
  return `http://${config.host}:${config.port}/${encodeURIComponent(basename(output))}`;
}

/**
 * Returns true when the local docs preview server responds successfully.
 *
 * @param {string} output - Rendered preview HTML path.
 * @param {DocsPreviewServerConfig} config - Server settings.
 * @returns {Promise<boolean>} Whether the server is ready.
 */
/* istanbul ignore next */
async function isDocsPreviewServerReady(
  output: string,
  config: DocsPreviewServerConfig,
): Promise<boolean> {
  try {
    const response = await fetch(docsPreviewUrl(output, config));
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Waits until the local docs preview server is ready or times out.
 *
 * @param {string} output - Rendered preview HTML path.
 * @param {DocsPreviewServerConfig} config - Server settings.
 */
/* istanbul ignore next */
async function waitForDocsPreviewServer(
  output: string,
  config: DocsPreviewServerConfig,
): Promise<void> {
  const deadline = Date.now() + config.waitTimeoutMs;

  while (Date.now() < deadline) {
    if (await isDocsPreviewServerReady(output, config)) return;
    await sleep(config.waitStepMs);
  }

  throw new Error("Docs preview server did not start in time.");
}

/**
 * Starts a detached docs preview server process.
 *
 * @param {string} output - Rendered preview HTML path.
 * @param {DocsPreviewServerConfig} config - Server settings.
 */
/* istanbul ignore next */
function spawnDocsPreviewServer(output: string, config: DocsPreviewServerConfig): void {
  const entry = resolve(fileURLToPath(import.meta.url));

  const child = spawn(process.execPath, [entry, config.arg, output], {
    detached: true,
    stdio: "ignore",
  });

  child.unref();
}

/**
 * Ensures the local docs preview server is available before opening the preview.
 *
 * @param {string} output - Rendered preview HTML path.
 * @param {DocsPreviewServerConfig} config - Server settings.
 */
/* istanbul ignore next */
async function ensureDocsPreviewServer(
  output: string,
  config: DocsPreviewServerConfig,
): Promise<void> {
  if (await isDocsPreviewServerReady(output, config)) return;

  spawnDocsPreviewServer(output, config);
  await waitForDocsPreviewServer(output, config);
}

/**
 * Normalizes a request path to a file path inside the preview directory.
 *
 * @param {string} output - Rendered preview HTML path.
 * @param {string} pathname - Request pathname.
 * @returns {string | null} Absolute file path or null for invalid traversal.
 */
/* istanbul ignore next */
function docsPreviewFilePath(output: string, pathname: string): string | null {
  const requestedPath = pathname === "/" ? `/${basename(output)}` : pathname;
  const absoluteRoot = resolve(dirname(output));
  const absolutePath = resolve(absoluteRoot, `.${requestedPath}`);

  if (absolutePath !== absoluteRoot && !absolutePath.startsWith(`${absoluteRoot}/`)) {
    return null;
  }

  return absolutePath;
}

/**
 * Responds with one docs preview asset file.
 *
 * @param {string} output - Rendered preview HTML path.
 * @param {IncomingMessage} request - Incoming HTTP request.
 * @param {ServerResponse} response - HTTP response writer.
 * @param {DocsPreviewServerConfig} config - Server settings.
 */
/* istanbul ignore next */
async function serveDocsPreviewFile(
  output: string,
  request: IncomingMessage,
  response: ServerResponse,
  config: DocsPreviewServerConfig,
): Promise<void> {
  const pathname = new URL(request.url ?? "/", `http://${config.host}:${config.port}`).pathname;
  const filePath = docsPreviewFilePath(output, pathname);

  if (!filePath) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  if (!(await pathExists(filePath)) || !statSync(filePath).isFile()) {
    response.writeHead(404).end("Not found");
    return;
  }

  const contentType = contentTypes.get(extname(filePath)) ?? "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  const stream = fileReadStream(filePath);
  if ("pipe" in stream) {
    stream.pipe(response);
    return;
  }

  response.write(new Uint8Array(await new Response(stream).arrayBuffer()));
  response.end();
}

/**
 * Starts the local docs preview HTTP server and keeps the process alive.
 *
 * @param {string} output - Rendered preview HTML path.
 * @param {DocsPreviewServerConfig} config - Server settings.
 */
/* istanbul ignore next */
function startDocsPreviewServer(output: string, config: DocsPreviewServerConfig): void {
  const server = createServer((request, response) => {
    void serveDocsPreviewFile(output, request, response, config).catch((error: unknown) => {
      logCaughtError(error);
      response.writeHead(500).end("Internal server error");
    });
  });
  server.listen(config.port, config.host);
}

/**
 * Logs a missing Markdown preview and exits.
 *
 * @param {string} output - Expected preview HTML path.
 */
function exitForMissingPreview(output: string): never {
  logError("Missing Markdown preview.");
  logErrorItem(output);
  logCommandHint("bun run docs:render -- artifact-generator");
  process.exit(1);
}

/**
 * Opens the rendered Markdown docs preview in the default browser.
 *
 * @param {string} output - Rendered preview HTML path.
 */
export async function openDocsPreview(output: string = docsPreviewOutput): Promise<void> {
  if (!(await pathExists(output))) exitForMissingPreview(output);

  const config = resolveDocsPreviewServerConfig();
  await ensureDocsPreviewServer(output, config);
  const url = docsPreviewUrl(output, config);
  logHeading("Opening Markdown preview");
  logItem(url);
  await openDefaultUrl(url);
  logSuccess("Opened Markdown preview.");
}

/* istanbul ignore next */
if (isEntrypoint(import.meta.url)) {
  const config = resolveDocsPreviewServerConfig();

  if (process.argv.includes(config.arg)) {
    const output = process.argv[process.argv.indexOf(config.arg) + 1] ?? docsPreviewOutput;
    startDocsPreviewServer(output, config);
  } else {
    await openDocsPreview();
  }
}
