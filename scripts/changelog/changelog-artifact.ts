import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writePdf } from "../pdf/write-pdf.ts";

/** One visible section in a release entry. */
export interface ChangelogSection {
  readonly entries: ReadonlyArray<string>;
  readonly title: string;
}

/** One parsed version from the canonical repository changelog. */
export interface ChangelogRelease {
  readonly date: string;
  readonly sections: ReadonlyArray<ChangelogSection>;
  readonly version: string;
}

const releaseHeading = /^##\s+\[?([^\]\s]+)\]?\s+-\s+(\d{4}-\d{2}-\d{2})\s*$/u;
const sectionHeading = /^###\s+(.+?)\s*$/u;
const entryLine = /^\s*[-*]\s+(.+?)\s*$/u;

/** Parses the supported Keep a Changelog heading forms without altering source text. */
export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: Array<{ date: string; sections: ChangelogSection[]; version: string }> = [];
  let release: { date: string; sections: ChangelogSection[]; version: string } | undefined;
  let section: { entries: string[]; title: string } | undefined;

  for (const line of markdown.split(/\r?\n/u)) {
    const releaseMatch = releaseHeading.exec(line);
    if (releaseMatch) {
      release = { date: releaseMatch[2] ?? "", sections: [], version: releaseMatch[1] ?? "" };
      releases.push(release);
      section = undefined;
      continue;
    }

    if (!release) continue;

    const sectionMatch = sectionHeading.exec(line);
    if (sectionMatch) {
      section = { entries: [], title: sectionMatch[1] ?? "Changes" };
      release.sections.push(section);
      continue;
    }

    const entryMatch = entryLine.exec(line);
    if (entryMatch) {
      const target = section ?? { entries: [], title: "Changes" };
      if (!section) {
        release.sections.push(target);
        section = target;
      }
      target.entries.push(entryMatch[1] ?? "");
    }
  }

  if (releases.length === 0) throw new Error("CHANGELOG.md does not contain a release heading.");

  return releases;
}

/** Verifies that the current package version is the first published release. */
export function assertCurrentRelease(
  packageVersion: string,
  releases: ReadonlyArray<ChangelogRelease>,
): void {
  if (releases[0]?.version !== packageVersion) {
    throw new Error(`CHANGELOG.md must begin with ${packageVersion}.`);
  }
}

/** Builds a readable Markdown copy and direct PDF from this repository's changelog. */
export async function buildChangelogArtifact(
  output = join("dist", "changelog", "artifact-generator"),
  publishedAt = new Date().toISOString(),
): Promise<string> {
  const packageVersion = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  const markdown = readFileSync("CHANGELOG.md", "utf8");
  const releases = parseChangelog(markdown);
  assertCurrentRelease(packageVersion.version, releases);
  const normalizedPublishedAt = new Date(publishedAt).toISOString();

  rmSync(output, { force: true, recursive: true });
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, "CHANGELOG.md"), markdown);
  await writePdf({
    output: join(output, "changelog.pdf"),
    sections: releases.flatMap((release) => [
      { body: [`Released ${release.date}`], heading: `v${release.version}` },
      ...release.sections.map((section) => ({ body: section.entries, heading: section.title })),
    ]),
    subtitle: `Published ${normalizedPublishedAt}`,
    title: "Artifact Generator Changelog",
  });

  return output;
}

if (import.meta.main) {
  try {
    await buildChangelogArtifact();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
