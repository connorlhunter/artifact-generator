# Artifact Generator

Builds and publishes the docs, diagrams, metadata, static assets, resume, and Artifact Generator coverage used by the portfolio.

Application repositories publish their own coverage. This repo publishes its own coverage and the shared artifact bundles.

## Start Here

```bash
bun install
bun run artifacts:source:sync
bun run docs:render:open -- artifact-generator
bun run verify
```

`artifacts:source:sync` copies the private S3 source inputs into the ignored `tmp/s3-inputs/` folder. Renderers and publish commands use that local copy.

## Edit And Publish

1. Run `bun run artifacts:source:sync`.
2. Edit files below `tmp/s3-inputs/`.
3. Review docs or diagrams with the scoped render commands.
4. Run `bun run artifacts:source:publish` to save source changes to S3.
5. Run `bun run verify`.
6. Run `bun run artifacts:ship` to rebuild and publish the generated bundles.

`artifacts:ship` does not publish the editable source inputs. Run `artifacts:source:publish` first when docs, diagrams, metadata, icons, or resume files changed.

## Source Inputs

```text
tmp/s3-inputs/artifacts/docs/      Markdown docs
tmp/s3-inputs/artifacts/diagrams/  Mermaid sources and rendered SVGs
tmp/s3-inputs/artifacts/manifests/ Portfolio content and artifact manifests
tmp/s3-inputs/artifacts/profile/   Profile page content
tmp/s3-inputs/artifacts/projects/  Project content and artifact links
tmp/s3-inputs/assets/assets/       Shared static images
tmp/s3-inputs/assets/icons/        Project icon packs
tmp/s3-inputs/assets/resume/       Resume PDF
```

The source buckets and publish destinations are configured in `.env`. Use `.env.example` as the reference.

## Outputs

```text
dist/docs-preview/   Current docs HTML/PDF preview and copied viewer assets
coverage/            Artifact Generator coverage HTML/PDF
dist/site-artifacts/ CloudFront-ready docs, diagrams, content, and coverage
dist/site-assets/    CloudFront-ready icons, images, and resume assets
```

Project coverage folders are excluded from the generator bundle. Each application repo publishes its report directly to its manifest path.

## Common Commands

| Task                       | Command                                     |
| -------------------------- | ------------------------------------------- |
| Sync source inputs         | `bun run artifacts:source:sync`             |
| Publish source inputs      | `bun run artifacts:source:publish`          |
| Render and open docs       | `bun run docs:render:open -- <project>`     |
| Render docs                | `bun run docs:render -- <project>`          |
| Render diagrams            | `bun run diagrams:render -- <project>`      |
| Render and open diagrams   | `bun run diagrams:render:open -- <project>` |
| Generate coverage          | `bun run test:coverage`                     |
| Open coverage              | `bun run coverage:open`                     |
| Build publish bundles      | `bun run artifacts:build`                   |
| Publish generated bundles  | `bun run artifacts:publish`                 |
| Build and publish bundles  | `bun run artifacts:ship`                    |
| Run the full quality check | `bun run verify`                            |

Docs and diagram commands require one project slug. Root pipeline docs are included with the `artifact-generator` preview.

```bash
bun run docs:render:open -- cipher
bun run diagrams:render -- connor-hunter
```

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
test/                 tests arranged to mirror the script folders
```

The project uses Bun for installs, scripts, and tests. TypeScript is compiled with `tsgo`. Generated docs PDFs use Puppeteer and honor `PUPPETEER_EXECUTABLE_PATH` when it is set.

## Quality Checks

`bun run verify` runs the dependency audit, formatting check, lint, typecheck, and test suite. The committed pre-commit and pre-push hooks run the same command.

Dependency pins live in `dependency-pins.json`. Temporary release-age exceptions live in `dependency-release-age-excludes.json`; keep that file empty unless a pinned urgent update cannot wait for the configured one-week release age.

## Documentation

- [Live Artifact Generator docs](https://connorhunter.me/projects/artifact-generator?viewer=docs#project-viewer)
- [Test layout](./test/README.md)
