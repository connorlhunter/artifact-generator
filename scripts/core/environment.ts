/**
 * @param value - Environment value to normalize.
 * @returns Trimmed environment value.
 */
export function envValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

/**
 * @param env - Environment values to read.
 * @param name - Required environment variable name.
 * @returns Non-empty environment variable value.
 */
export function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = envValue(env[name]);

  if (!value) {
    throw new Error(`Missing ${name}. Set it in your local shell, .env, or CI variables.`);
  }

  return value;
}
