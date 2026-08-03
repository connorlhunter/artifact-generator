import { spawn } from "node:child_process";
import type { CommandContext, CommandOptions, CommandOutput } from "./command-types.ts";

/**
 * Runs a child process and captures stdout/stderr for clean failure logs.
 *
 * @param {string} command - Command to run.
 * @param {string[]} args - Command arguments.
 * @param {Record<string, unknown>} context - Extra fields to include on failures.
 * @param {CommandOptions} options - Process working directory and environment.
 * @returns {Promise<{ stdout: string; stderr: string }>} Captured command output.
 */
export function runCommand(
  command: string,
  args: string[],
  context: CommandContext = {},
  options: CommandOptions = {},
): Promise<CommandOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error: Error) => {
      reject({
        ...context,
        error,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    child.on("close", (code: number | null) => {
      const output = {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };

      if (code === 0) {
        resolve(output);
        return;
      }

      reject({
        ...context,
        code,
        ...output,
      });
    });
  });
}
