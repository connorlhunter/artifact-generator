import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fileReadStream, pathExists } from "../core/bun-native-fs.ts";
import { openDefaultUrl } from "../core/file-opener.ts";
import { artifactPaths, coverageServer, repoDirs } from "../core/script-constants.ts";
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

const coverageRoot = repoDirs.coverage;
const coverageReportOutput = artifactPaths.coverageReport;
const coverageHost = coverageServer.host;
const coveragePort = coverageServer.port;
const coverageServerArg = coverageServer.arg;
const waitTimeoutMs = coverageServer.waitTimeoutMs;
const waitStepMs = coverageServer.waitStepMs;

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".info", "text/plain; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".xml", "application/xml; charset=utf-8"],
]);

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
 * Returns the local coverage report URL for the configured server.
 *
 * @returns {string} Coverage report URL.
 */
function coverageReportUrl(): string {
  return `http://${coverageHost}:${coveragePort}/index.html`;
}

/**
 * Returns true when the local coverage server responds successfully.
 *
 * @returns {Promise<boolean>} Whether the server is ready.
 */
/* istanbul ignore next */
async function isCoverageServerReady(): Promise<boolean> {
  try {
    const response = await fetch(coverageReportUrl());
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Waits until the local coverage server is ready or times out.
 *
 * @returns {Promise<void>} Resolves when the server responds successfully.
 */
/* istanbul ignore next */
async function waitForCoverageServer(): Promise<void> {
  const deadline = Date.now() + waitTimeoutMs;

  while (Date.now() < deadline) {
    if (await isCoverageServerReady()) return;
    await sleep(waitStepMs);
  }

  throw new Error("Coverage report server did not start in time.");
}

/**
 * Starts a detached coverage server process.
 */
/* istanbul ignore next */
function spawnCoverageServer(): void {
  const entry = resolve(process.argv[1] ?? fileURLToPath(import.meta.url));

  const child = spawn(process.execPath, [entry, coverageServerArg], {
    detached: true,
    stdio: "ignore",
  });

  child.unref();
}

/**
 * Ensures the local coverage server is available before opening the report.
 *
 * @returns {Promise<void>} Resolves when the server is ready.
 */
/* istanbul ignore next */
async function ensureCoverageServer(): Promise<void> {
  if (await isCoverageServerReady()) return;

  spawnCoverageServer();
  await waitForCoverageServer();
}

/**
 * Normalizes a request path to a file path inside the coverage directory.
 *
 * @param {string} pathname - Request pathname.
 * @returns {string | null} Absolute file path or null for invalid traversal.
 */
/* istanbul ignore next */
function coverageFilePath(pathname: string): string | null {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const absoluteRoot = resolve(coverageRoot);
  const absolutePath = resolve(coverageRoot, `.${requestedPath}`);

  if (absolutePath !== absoluteRoot && !absolutePath.startsWith(`${absoluteRoot}/`)) {
    return null;
  }

  return absolutePath;
}

/**
 * Responds with one coverage asset file.
 *
 * @param {request} request - Incoming HTTP request.
 * @param {response} response - HTTP response writer.
 */
/* istanbul ignore next */
async function serveCoverageFile(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const pathname = new URL(request.url ?? "/", `http://${coverageHost}:${coveragePort}`).pathname;
  const filePath = coverageFilePath(pathname);

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
 * Starts the local coverage HTTP server and keeps the process alive.
 */
/* istanbul ignore next */
function startCoverageServer(): void {
  const server = createServer((request, response) => {
    void serveCoverageFile(request, response).catch((error: unknown) => {
      logCaughtError(error);
      response.writeHead(500).end("Internal server error");
    });
  });
  server.listen(coveragePort, coverageHost);
}

/**
 * Logs a missing coverage report and exits.
 *
 * @param {string} output - Expected coverage report path.
 */
function exitForMissingReport(output: string): never {
  logError("Missing HTML coverage report.");
  logErrorItem(output);
  logCommandHint("bun run test:coverage");
  process.exit(1);
}

/**
 * Opens the generated HTML coverage report in the default browser.
 *
 * @param {string} output - HTML coverage report path.
 */
export async function openCoverageReport(output: string = coverageReportOutput): Promise<void> {
  if (!(await pathExists(output))) exitForMissingReport(output);

  await ensureCoverageServer();
  const url = coverageReportUrl();
  logHeading("Opening HTML coverage report");
  logItem(url);
  await openDefaultUrl(url);
  logSuccess("Opened HTML coverage report.");
}

/* istanbul ignore next */
if (isEntrypoint(import.meta.url)) {
  if (process.argv.includes(coverageServerArg)) {
    startCoverageServer();
  } else {
    await openCoverageReport();
  }
}
