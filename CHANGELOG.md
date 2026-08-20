# Changelog

## 1.6.0 - 2026-08-20

### Added

- Stamp rendered diagram SVGs with the shared source-publication date.
- Generate a PDF alongside the Artifact Generator coverage report and publish it as the download target.

### Changed

- Show the shared source-publication date in coverage reports and regenerate them after artifact builds update it.

## 1.5.6 - 2026-08-18

### Added

- Stamp the source content manifest with the current UTC date during artifact builds.

### Changed

- Show the publication date beneath the document count in generated documentation previews.

## 1.5.5 - 2026-08-18

### Fixed

- Restrict local source input selection to staged bundles under the repository-controlled cache.
- Reject symlinks before source files are rendered, copied, or published.
- Remove the resolved path-injection findings from the local CodeQL baseline; the scan now requires zero findings.

## 1.5.4 - 2026-08-18

### Fixed

- Rebuild the selected documentation preview before rendering its PDF export.
- Read resume configuration and generated PDF contents from a single filesystem snapshot to resolve the tracked file-race findings.
- Remove the resolved resume file-race entries from the local CodeQL baseline; the reviewed local-path findings remain tracked separately.

## 1.5.3 - 2026-08-14

### Added

- Hosted verification, Dependabot updates, a release-version check, and a security policy.
- A CodeQL CLI 2.26.3 local gate for JavaScript, TypeScript, and GitHub Actions using the security-extended suites.

### Changed

- Pin third-party workflow actions and the tsgo preview snapshot to immutable revisions.
- Keep the standard TypeScript compiler on 6.x until the lint toolchain supports 7.
- Compare scans with the reviewed path and file-race baseline tracked in open issue #39; new or stale fingerprints fail verification.
- Document branch names and Conventional Commit types.
- Use the repository `tmp/s3-inputs` cache by default and test preview helpers without executing generated scripts.
- Refresh and publish the Cipher documentation, diagrams, source manifest, and resume content.

### Fixed

- Restrict documentation previews to loopback hosts, bound browser startup waits, and format IPv6 loopback URLs correctly.
- Verify the parent window and exact origin before exchanging embedded theme changes.

## 1.5.2 - 2026-08-02

### Added

- In-document heading links beneath the active document in the left navigation.

### Changed

- Keep the active left heading visible while the main document pane scrolls.
- Use the same heading depth, active state, and reduced-motion behavior in both navigation panels.

### Fixed

- Highlight the current document heading in the left sidebar instead of only tracking document boundaries.
- Share heading clicks and scroll state between the left navigation and the On This Page outline.
- Apply the correct heading depth classes so nested sections keep their intended indentation.

## 1.5.1 - 2026-08-02

### Added

- Scroll-linked active states for documentation sections, document links, and page headings.

### Changed

- Smoothly keep the active left navigation item and right page heading in view while reading.
- Respect reduced-motion preferences across the new navigation transitions.

### Fixed

- Calculate active content from the visible main reading area in desktop, embedded, and mobile layouts.
- Keep the final document and heading selected when the main pane reaches the end of its scroll range.
