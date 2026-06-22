/**
 * Captured child-process output.
 */
export interface CommandOutput {
  /**
   * Trimmed standard output.
   */
  stdout: string;
  /**
   * Trimmed standard error.
   */
  stderr: string;
}

/**
 * Extra context attached to command failures for cleaner logs.
 */
export type CommandContext = Record<string, unknown>;

/**
 * Structured child-process failure used by script wrappers.
 */
export interface CommandFailure extends CommandContext {
  /**
   * Process exit code, or null when unavailable.
   */
  code?: number | null;
  /**
   * Spawn or runtime error.
   */
  error?: Error;
  /**
   * File path associated with the failed command.
   */
  file?: string;
  /**
   * Mermaid input path associated with the failed command.
   */
  input?: string;
  /**
   * Output path associated with the failed command.
   */
  output?: string;
  /**
   * Trimmed standard error.
   */
  stderr?: string;
  /**
   * Trimmed standard output.
   */
  stdout?: string;
}
