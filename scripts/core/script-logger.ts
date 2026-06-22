type ColorName = "blue" | "cyan" | "green" | "red" | "yellow";
type ColorFormatter = (value: string) => string;

/**
 * Structured details for a failed subprocess or async operation.
 */
export interface FailureDetails {
  /**
   * Primary error object captured from the failed operation.
   */
  error?: Error;
  /**
   * Optional label for the file or input that failed.
   */
  subject?: string;
  /**
   * Captured standard error from a child process.
   */
  stderr?: string;
  /**
   * Captured standard output from a child process.
   */
  stdout?: string;
}

/**
 * Options for headings and success/error lines that include counts.
 */
export interface CountedLogOptions {
  /**
   * Optional numeric count shown after the message.
   */
  count?: number;
  /**
   * Color used for the message label.
   */
  color?: ColorName;
}

/* istanbul ignore next */
const colorEnabled = !process.env.NO_COLOR && process.env.TERM !== "dumb";

/**
 * Terminal color helpers. They intentionally avoid dependencies so the docs
 * scripts stay portable across fresh checkouts.
 */
export const color: Record<ColorName, ColorFormatter> = {
  blue: (value: string): string => colorize(value, "\x1b[34m"),
  cyan: (value: string): string => colorize(value, "\x1b[36m"),
  green: (value: string): string => colorize(value, "\x1b[32m"),
  red: (value: string): string => colorize(value, "\x1b[31m"),
  yellow: (value: string): string => colorize(value, "\x1b[33m"),
};

/**
 * Logs a section heading, optionally with a count.
 *
 * @param {string} message - Heading label.
 * @param {CountedLogOptions} options - Count and color options.
 */
export function logHeading(message: string, options: CountedLogOptions = {}): void {
  const label = color[options.color ?? "blue"](message);
  console.log(`\n${withCount(label, options.count)}`);
}

/**
 * Logs an error section heading, optionally with a count.
 *
 * @param {string} message - Error heading label.
 * @param {number} count - Optional count to append.
 */
export function logErrorHeading(message: string, count?: number): void {
  console.error(`\n${color.red(withCount(message, count))}`);
}

/**
 * Logs a success line, optionally with a count.
 *
 * @param {string} message - Success label.
 * @param {number} count - Optional count to append.
 */
export function logSuccess(message: string, count?: number): void {
  console.log(color.green(withCount(message, count)));
}

/**
 * Logs an error line, optionally with a count.
 *
 * @param {string} message - Error label.
 * @param {number} count - Optional count to append.
 */
export function logError(message: string, count?: number): void {
  console.error(color.red(withCount(message, count)));
}

/**
 * Logs one indented item under the current heading.
 *
 * @param {string} value - Item text.
 * @param {number} indent - Number of two-space indentation levels.
 */
export function logItem(value: string, indent = 1): void {
  console.log(`${"  ".repeat(indent)}- ${value}`);
}

/**
 * Logs one indented error item under the current error heading.
 *
 * @param {string} value - Item text.
 * @param {number} indent - Number of two-space indentation levels.
 */
export function logErrorItem(value: string, indent = 1): void {
  console.error(`${"  ".repeat(indent)}- ${value}`);
}

/**
 * Logs a grouped label and count, used for project sections.
 *
 * @param {string} label - Group label.
 * @param {number} count - Number of items in the group.
 * @param {number} indent - Number of two-space indentation levels.
 */
export function logGroup(label: string, count: number, indent = 1): void {
  console.log(`${"  ".repeat(indent)}${color.yellow(`[${label}]`)} (${count})`);
}

/**
 * Logs a numbered workflow step in a consistent format.
 *
 * @param {number} step - Current step number.
 * @param {number} total - Total number of steps.
 * @param {string} label - Step label.
 */
export function logStep(step: number, total: number, label: string): void {
  console.log(color.cyan(`[${step}/${total}] ${label}`));
}

/**
 * Logs a command hint after an error.
 *
 * @param {string} command - Command the user should run next.
 */
export function logCommandHint(command: string): void {
  console.error(`Run \`${command}\` first.`);
}

/**
 * Logs captured failure details with a consistent layout.
 *
 * @param {FailureDetails} details - Failure details to render.
 * @param {string} fallbackSubject - Subject label when the failure has none.
 */
export function logFailureDetails(details: FailureDetails, fallbackSubject: string): void {
  logErrorItem(details.subject ?? fallbackSubject, 0);
  if (details.error) console.error(`  ${details.error.message}`);
  if (details.stdout) console.error(`  ${details.stdout}`);
  if (details.stderr) console.error(`  ${details.stderr}`);
}

/**
 * Logs an unknown caught error value.
 *
 * @param {unknown} error - Caught error value.
 */
export function logCaughtError(error: unknown): void {
  console.error(error instanceof Error ? error.message : error);
}

/**
 * Wraps text in an ANSI color code when terminal coloring is enabled.
 *
 * @param {string} value - Text to color.
 * @param {string} code - ANSI color code.
 * @returns {string} Colored or plain text.
 */
/* istanbul ignore next */
function colorize(value: string, code: string): string {
  if (!colorEnabled) return value;
  return `${code}${value}\x1b[0m`;
}

function withCount(message: string, count: number | undefined): string {
  return count === undefined ? message : `${message} (${count})`;
}
