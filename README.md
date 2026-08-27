# Artifact Generator

Builds and publishes the docs, diagrams, metadata, icons, generated resume, and Artifact Generator coverage used by the portfolio.

Application repositories publish their own coverage. This repo publishes its own coverage and the shared artifact bundles. Artifact Generator requires at least 95% line and function coverage.

## Start Here

```bash
bun install
brew install tectonic
bun run artifacts:source:sync
bun run docs:build
bun run verify
```

`artifacts:source:sync` copies the private S3 source inputs into the ignored `tmp/s3-inputs/` folder. Renderers and publish commands use that local copy.

Local verification also requires CodeQL CLI 2.26.3 on `PATH`.

## Edit And Publish

1. Run `bun run artifacts:source:sync`.
2. Edit files below `tmp/s3-inputs/`.
3. Build the affected docs or render the affected diagrams locally.
4. Run `bun run artifacts:source:publish` to save source changes to S3.
5. Run `bun run verify`.
6. Run `bun run artifacts:ship` to rebuild and publish the generated bundles.

`artifacts:ship` does not publish editable source inputs. Run `artifacts:source:publish` first when docs, diagrams, metadata, resume source, or icons change. The selected resume source is staged under `dist/` and compiled during the artifact build.

## Source Inputs

```text
<source-root>/artifacts/docs/      Markdown docs
<source-root>/artifacts/diagrams/  Mermaid sources and rendered SVGs
<source-root>/artifacts/manifests/ Portfolio content and artifact manifests
<source-root>/artifacts/profile/   Profile page content
<source-root>/artifacts/projects/  Project content and artifact links
<source-root>/artifacts/resume/    Tectonic project and LaTeX resume source
<source-root>/assets/icons/        Project icon packs
```

The default source root is `tmp/s3-inputs/`. The source buckets and publish destinations are configured in `.env`; use `.env.example` as the reference.

### Versioned docs and diagrams

Each documentation collection owns one strict `major.minor.patch` version and real ISO calendar date in `docs/<project>/document-metadata.json`. Markdown pages inherit those values, show the shared update date on every rendered page, and do not repeat a version label. Mermaid diagrams continue to own their own metadata comments:

```json
{
  "lastUpdated": "2026-08-18",
  "version": "1.0.0"
}
```

```mermaid
%% artifact-generator:version=1.0.0 lastUpdated=2026-08-18
```

Rendered document headers show the inherited update date; diagram stamps show both values. Diagram outputs use `<name>-v<major>.<minor>.<patch>-<YYYY-MM-DD>.svg`; the build resolves those filenames into docs links and the public project manifest. Update the collection metadata whenever the document release changes, and update a diagram's own metadata when that diagram changes.

`content-manifest.json:lastUpdated` is reserved for the portfolio code footer. Artifact builds do not change or reuse it. Coverage has no artifact version; each project publisher creates one UTC publication timestamp and writes JSON and PDF from that same value.

### Local Bundle

Stage an alternate bundle beneath the ignored `tmp/local-source-bundles/` directory, then pass its lowercase bundle name. The generator reads only that controlled directory; it does not accept arbitrary filesystem paths.

```bash
mkdir -p tmp/local-source-bundles/review
rsync -a /absolute/path/to/source-inputs/ tmp/local-source-bundles/review/
```

Pass one explicit `local=<bundle>` argument to read the staged bundle without syncing S3 first:

```bash
bun run docs:build -- local=review
bun run diagrams:render -- connor-hunter local=review
bun run resume:build -- local=review
bun run artifacts:build -- local=review
bun run artifacts:ship -- local=review
```

Bundle names use lowercase letters, numbers, and hyphens. The selected tree must use the source shape above and cannot contain symlinks.

`artifacts:source:publish -- local=<bundle>` uploads that bundle to the configured source buckets. It validates every required folder before the first upload.

## Outputs

```text
dist/docs-artifacts/ Markdown docs, navigation indexes, and direct PDFs
coverage/            Artifact Generator coverage JSON/PDF
dist/resume/         Generated resume PDF
dist/site-artifacts/ CloudFront-ready docs, diagrams, content, and coverage
dist/site-assets/    CloudFront-ready icons and generated resume
```

Project coverage folders are excluded from the generator bundle. Each application repo publishes its report directly to its manifest path.

## Local Portfolio Preview

Run the local artifact server while previewing the portfolio:

```bash
bun run artifacts:serve
```

It serves the assembled docs and diagrams plus fresh coverage and changelog files from each
sibling project repository. It is local only and does not change the production publishing flow.

## Common Commands

| Task                       | Command                                     |
| -------------------------- | ------------------------------------------- |
| Sync source inputs         | `bun run artifacts:source:sync`             |
| Publish source inputs      | `bun run artifacts:source:publish`          |
| Build docs                 | `bun run docs:build -- <project>`           |
| Render diagrams            | `bun run diagrams:render -- <project>`      |
| Render and open diagrams   | `bun run diagrams:render:open -- <project>` |
| Generate coverage          | `bun run test:coverage`                     |
| Serve local portfolio data | `bun run artifacts:serve`                   |
| Format files               | `bun run format`                            |
| Check formatting and code  | `bun run check`                             |
| Generate resume PDF        | `bun run resume:build`                      |
| Run the local CodeQL scan  | `bun run codeql:scan`                       |
| Build publish bundles      | `bun run artifacts:build`                   |
| Publish generated bundles  | `bun run artifacts:publish`                 |
| Build and publish bundles  | `bun run artifacts:ship`                    |
| Build from a local bundle  | `bun run artifacts:build -- local=<bundle>` |
| Run the full quality check | `bun run verify`                            |

Docs and diagram commands require one project slug. Root pipeline docs are included with the `artifact-generator` collection.

```bash
bun run docs:build -- cipher
bun run diagrams:render -- connor-hunter
```

Each docs collection contains readable Markdown pages, a small `index.json` navigation file, and a direct PDF. Portfolio turns those Markdown pages into its native reader, including next and previous page links.

## Repository Shape

```text
scripts/core/         shared filesystem, process, environment, logging, and paths
scripts/docs/         Markdown discovery and docs artifact compilation
scripts/diagrams/     Mermaid validation, rendering, and openers
scripts/coverage/     LCOV parsing and JSON/PDF reports
scripts/dependencies/ dependency policy sync
scripts/git-hooks/    local Git hook setup
scripts/publish/      source sync and generated bundle publishing
scripts/resume/       selected LaTeX resume compilation
test/                 tests arranged to mirror the script folders
```

The project uses Bun for installs, scripts, and tests. TypeScript is compiled with `tsgo`. Docs, coverage, and changelog PDFs are written directly from their source data. Resume builds read `artifacts/resume/Tectonic.toml` from the selected local or S3-backed source bundle and compile a staged copy with Tectonic.

## Releases

`package.json` is the Artifact Generator release-version source. Keep the first `CHANGELOG.md` heading aligned with it; `bun run version:check` enforces the pair in the normal verification gate. `bun run release:publish` publishes the generated bundle, including the canonical changelog Markdown and PDF.

## Change Naming

- Branches use `<type>/<kebab-summary>`, where `type` is `feat`, `fix`, `chore`, `docs`, `test`, or `refactor`.
- Issue, pull request, and commit subjects use `<type>[(scope)][!]: <summary>`.
- Release branches use `release/<version>`, the release commit uses `chore(release): prepare <version>`, and the tag uses `v<version>`.
- Dependabot's generated `dependabot/*` branches are accepted automatically.
- Existing Git history stays unchanged; the convention applies to new changes.

## Quality Checks

`bun run verify` runs the dependency audit, Oxfmt formatting check, Oxlint check, TypeScript typecheck, test suite, and local CodeQL security scan. Oxlint limits production scripts to 15 classic complexity paths. The committed pre-commit and pre-push hooks run the same command. GitHub Actions defers this local scan to the repository's hosted CodeQL checks.

The local scan covers JavaScript, TypeScript, and GitHub Actions with the security-extended suites. Its checked-in baseline is empty; any finding fails verification.

Dependency pins and temporary release-age exceptions live in `dependency-policy.toml`. Keep the exception table empty unless a pinned urgent update cannot wait for the configured one-week release age.

## Documentation

- [Live Artifact Generator docs](https://connorhunter.me/projects/artifact-generator/docs)
- [Test layout](./test/README.md)
