---
title: String Date Entry
date: "Q1 2025"
tag: Added
previewImage: /logo.svg
---

![Logo](/logo.svg)

## Overview

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

## New Features

- **Template Engine Overhaul** — Refactored the Handlebars template resolver to support nested partials and dynamic layout inheritance. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
- **Markdown Extensions** — Added support for custom directives, including callouts, tabs, and collapsible sections. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
- **Changelog Pagination** — Introduced paginated changelog views with configurable entries per page, improving load times for projects with extensive release histories.
- **Search Integration** — Built-in full-text search powered by a pre-built index generated at build time. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.

## Bug Fixes

- Fixed an issue where relative image paths in nested documentation directories resolved incorrectly during builds.
- Resolved a race condition in the file watcher that caused duplicate rebuilds when multiple files changed simultaneously.
- Corrected date parsing for changelog entries using non-standard date formats such as `"Q1 2025"` or `"Summer 2024"`.

## Breaking Changes

- The `outputDir` option has been renamed to `output` for consistency with other configuration fields. Update your `docula.config.ts` accordingly.
- Minimum Node.js version is now 20. Support for Node.js 18 has been dropped.

## Migration Guide

To upgrade from the previous version, update your configuration file:

```typescript
// Before
const options = { outputDir: './dist' };

// After
const options = { output: './dist' };
```

Run `pnpm install` to update dependencies, then `pnpm build` to verify your site builds correctly.

## Performance

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Build times improved by approximately 40% for sites with over 100 documentation pages.

## Contributors

Thanks to all contributors who made this release possible. At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.
