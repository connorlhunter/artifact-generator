const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;
const semanticVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const metadataPattern =
  /^version=((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)) lastUpdated=(\d{4}-\d{2}-\d{2})$/u;

/** Version and date owned by one source artifact. */
export interface VersionedArtifactMetadata {
  /** ISO calendar date on which this artifact was last changed. */
  readonly lastUpdated: string;
  /** Strict major.minor.patch artifact version. */
  readonly version: string;
}

/**
 * Converts a time to its UTC ISO calendar date.
 *
 * @param date - Time to represent.
 * @returns UTC date in YYYY-MM-DD form.
 */
export function isoUpdatedDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Validates an ISO calendar date, including real month and day boundaries.
 *
 * @param value - Candidate YYYY-MM-DD value.
 * @param subject - Source described in validation errors.
 * @returns The validated value.
 */
export function validateUpdatedDate(value: string, subject = "updated date"): string {
  if (!isoDatePattern.test(value)) {
    throw new Error(`${subject} must use YYYY-MM-DD: ${value}`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.valueOf()) || isoUpdatedDate(parsed) !== value) {
    throw new Error(`${subject} is not a real calendar date: ${value}`);
  }

  return value;
}

/**
 * Validates a strict major.minor.patch version.
 *
 * @param value - Candidate semantic version.
 * @param subject - Source described in validation errors.
 * @returns The validated value.
 */
export function validateArtifactVersion(value: string, subject = "artifact version"): string {
  if (!semanticVersionPattern.test(value)) {
    throw new Error(`${subject} must use major.minor.patch: ${value}`);
  }

  return value;
}

/**
 * Parses the canonical metadata payload shared by docs and diagrams.
 *
 * @param value - Text between the source-specific comment delimiters.
 * @param subject - Source described in validation errors.
 * @returns Strict version and updated date metadata.
 */
export function parseVersionedArtifactMetadata(
  value: string,
  subject = "artifact",
): VersionedArtifactMetadata {
  const match = metadataPattern.exec(value.trim());

  if (match === null) {
    throw new Error(
      `${subject} metadata must use version=<major.minor.patch> lastUpdated=<YYYY-MM-DD>.`,
    );
  }

  const version = match[1] ?? "";
  const lastUpdated = match[2] ?? "";

  return {
    lastUpdated: validateUpdatedDate(lastUpdated, `${subject} lastUpdated`),
    version: validateArtifactVersion(version, `${subject} version`),
  };
}

/**
 * Formats a validated ISO date for visible artifact stamps.
 *
 * @param value - ISO calendar date.
 * @returns English long-form UTC date.
 */
export function formatUpdatedDate(value: string): string {
  validateUpdatedDate(value);

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}
