# Artifact Generator

Builds and publishes the docs, diagrams, metadata, icons, generated resume, and Artifact Generator coverage used by the portfolio.

Application repositories publish their own coverage. This repo publishes its own coverage and the shared artifact bundles.

## Start Here

```bash
bun install
brew install tectonic
bun run artifacts:source:sync
bun run docs:render:open -- artifact-generator
bun run verify
```

`artifacts:source:sync` copies the private S3 source inputs into the ignored `tmp/s3-inputs/` folder. Renderers and publish commands use that local copy.

Local verification also requires CodeQL CLI 2.26.3 on `PATH`.

## Edit And Publish

1. Run `bun run artifacts:source:sync`.
2. Edit files below `tmp/s3-inputs/`.
3. Review docs or diagrams with the scoped render commands.
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

### Local Bundle

Stage an alternate bundle beneath the ignored `tmp/local-source-bundles/` directory, then pass its lowercase bundle name. The generator reads only that controlled directory; it does not accept arbitrary filesystem paths.

```bash
mkdir -p tmp/local-source-bundles/review
rsync -a /absolute/path/to/source-inputs/ tmp/local-source-bundles/review/
```

Pass one explicit `local=<bundle>` argument to read the staged bundle without syncing S3 first:

```bash
bun run docs:render:open -- artifact-generator local=review
bun run diagrams:render -- connor-hunter local=review
bun run resume:build -- local=review
bun run artifacts:build -- local=review
bun run artifacts:ship -- local=review
```

Bundle names use lowercase letters, numbers, and hyphens. The selected tree must use the source shape above and cannot contain symlinks.

`artifacts:source:publish -- local=<bundle>` uploads that bundle to the configured source buckets. It validates every required folder before the first upload.

## Outputs

```text
dist/docs-preview/   Current docs HTML/PDF preview and copied viewer assets
coverage/            Artifact Generator coverage HTML/PDF
dist/resume/         Generated resume PDF
dist/site-artifacts/ CloudFront-ready docs, diagrams, content, and coverage
dist/site-assets/    CloudFront-ready icons and generated resume
```

Project coverage folders are excluded from the generator bundle. Each application repo publishes its report directly to its manifest path.

## Common Commands

| Task                       | Command                                     |
| -------------------------- | ------------------------------------------- |
| Sync source inputs         | `bun run artifacts:source:sync`             |
| Publish source inputs      | `bun run artifacts:source:publish`          |
| Render and open docs       | `bun run docs:render:open -- <project>`     |
| Render docs                | `bun run docs:render -- <project>`          |
| Render docs PDF            | `bun run docs:render:pdf -- <project>`      |
| Render diagrams            | `bun run diagrams:render -- <project>`      |
| Render and open diagrams   | `bun run diagrams:render:open -- <project>` |
| Generate coverage          | `bun run test:coverage`                     |
| Open coverage              | `bun run coverage:open`                     |
| Generate resume PDF        | `bun run resume:build`                      |
| Run the local CodeQL scan  | `bun run codeql:scan`                       |
| Build publish bundles      | `bun run artifacts:build`                   |
| Publish generated bundles  | `bun run artifacts:publish`                 |
| Build and publish bundles  | `bun run artifacts:ship`                    |
| Build from a local bundle  | `bun run artifacts:build -- local=<bundle>` |
| Run the full quality check | `bun run verify`                            |

Docs and diagram commands require one project slug. Root pipeline docs are included with the `artifact-generator` preview.

```bash
bun run docs:render:open -- cipher
bun run diagrams:render -- connor-hunter
```

`docs:render:pdf` rebuilds the selected preview before printing it, so it also works when `dist/docs-preview/` does not exist yet.

Pass `--github owner/repo` to add source links to a docs preview.

## Repository Shape

```text
scripts/core/         shared filesystem, process, environment, logging, and paths
scripts/docs/         Markdown discovery, HTML/PDF rendering, and preview behavior
scripts/diagrams/     Mermaid validation, rendering, and openers
scripts/coverage/     LCOV parsing and HTML/PDF reports
scripts/dependencies/ dependency policy sync
scripts/git-hooks/    local Git hook setup
scripts/publish/      source sync and generated bundle publishing
scripts/resume/       selected LaTeX resume compilation
test/                 tests arranged to mirror the script folders
```

The project uses Bun for installs, scripts, and tests. TypeScript is compiled with `tsgo`. Generated docs PDFs use Puppeteer and honor `PUPPETEER_EXECUTABLE_PATH` when it is set. Resume builds read `artifacts/resume/Tectonic.toml` from the selected local or S3-backed source bundle and compile a staged copy with Tectonic.

## Releases

`package.json` is the Artifact Generator release-version source. Keep the first `CHANGELOG.md` heading aligned with it; `bun run version:check` enforces the pair in the normal verification gate.

## Change Naming

- Branches use `<type>/<kebab-summary>`, where `type` is `feat`, `fix`, `chore`, `docs`, `test`, or `refactor`.
- Issue, pull request, and commit subjects use `<type>[(scope)][!]: <summary>`.
- Release branches use `release/<version>`, the release commit uses `chore(release): prepare <version>`, and the tag uses `v<version>`.
- Dependabot's generated `dependabot/*` branches are accepted automatically.
- Existing Git history stays unchanged; the convention applies to new changes.

## Quality Checks

`bun run verify` runs the dependency audit, formatting check, lint, typecheck, test suite, and local CodeQL security scan. The committed pre-commit and pre-push hooks run the same command. GitHub Actions defers this local scan to the repository's hosted CodeQL checks.

The local scan covers JavaScript, TypeScript, and GitHub Actions with the security-extended suites. Its checked-in baseline is empty; any finding fails verification.

Dependency pins and temporary release-age exceptions live in `dependency-policy.toml`. Keep the exception table empty unless a pinned urgent update cannot wait for the configured one-week release age.

## Documentation

- [Live Artifact Generator docs](https://connorhunter.me/projects/artifact-generator?viewer=docs#project-viewer)
- [Test layout](./test/README.md)
