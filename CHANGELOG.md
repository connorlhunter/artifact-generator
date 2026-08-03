# Changelog

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
