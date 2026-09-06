# Test Overview

The test suite covers the repository-owned TypeScript scripts for structured docs artifacts, Mermaid diagram workflows, file opening, process execution, and script entrypoint detection. It does not contain tests for external application repositories.

## Structure

- `core/*.test.ts`: tests for shared filesystem, process, logging, constants, and opener helpers.
- `docs/*.test.ts`: tests for Markdown discovery and structured docs artifact compilation.
- `diagrams/*.test.ts`: tests for Mermaid discovery, validation, rendering, and openers.
- `coverage/*.test.ts`: tests for this repository's JSON and PDF coverage artifacts.
- `artifacts/*.test.ts`: tests for native resource contracts and compiled portfolio content.
- `content/*.test.ts`: JSON frontmatter parsing, including escaped quotes and trailing commas.
- `changelog/*.test.ts`: tests for changelog Markdown/PDF publication.
- `pdf/*.test.ts`: generated PDF structure, links, long tables and code blocks, and failed-write recovery.
- `local/*.test.ts`: tests for local artifact serving and sibling report overlays.
- `dependencies/*.test.ts`: tests for dependency policy syncing.
- `git-hooks/*.test.ts`: tests for committed hook path setup.
- `publish/*.test.ts`: tests for CloudFront-ready artifact bundle assembly and S3 publish configuration.
- `resume/*.test.ts`: tests for selected Tectonic source staging, command execution, and generated PDF validation.
- `resources/docs.constants.ts`: shared fixture paths and command fixtures.
- `resources/docs.mock.ts`: typed mock records used by multiple tests.
- `resources/repo-fixture/`: small repository tree for docs artifact tests.
- `resources/diagrams-fixture/`: small Mermaid tree for diagram discovery tests.

## Conventions

- Keep fixtures under `test/resources/`.
- Prefer shared fixtures over hardcoded paths inside tests.
- Mock process boundaries such as browser openers, Mermaid CLI calls, and child-process execution.
- Keep aggregate line and function coverage at or above 95%; the JSON report renderer enforces those thresholds.
- Keep application tests in the application repositories that own that source code.
- Use `bun run typecheck` for the default tsgo typecheck path.

## Bun Test Runner

All tests run on Bun's native isolated test runner:

```text
bun run test          -> build, then bun test --isolate
bun run test:coverage -> build, Bun coverage, and JSON/PDF artifact rendering
```

For a focused test, build once and invoke the test runner directly:

```bash
bun run build
bun test --isolate --timeout 30000 test/docs/document-artifact.test.ts
```

Tests import from `bun:test`:

```ts
import { describe, expect, mock, spyOn, test } from "bun:test";
```

Use `mock.module()` for module-boundary tests and keep those mocks at file scope before importing the module under test. The `--isolate` flag prevents module mocks from leaking into other test files.

`test/resources/bun-test.d.ts` is a type-only declaration for the subset of `bun:test` used here. It exists for `tsgo` typechecking; runtime behavior comes from Bun itself.
