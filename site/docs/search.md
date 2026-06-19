---
title: Search
order: 18
---

# Search

Docula ships with a fast, fully client-side search built into the **modern**
template — no third-party service, API key, or external dependency required.
At build time Docula generates a `search-index.json` file from your
documentation and changelog, and the template renders a keyboard-driven search
modal that queries it in the browser.

## How it works

1. During the build, every documentation page and changelog entry is split into
   sections — one record per heading — and written to `search-index.json` in the
   output root.
2. Each record keeps the page title, the heading breadcrumb, the section text,
   and a deep-link URL (including the `#anchor`) so results jump straight to the
   matching heading.
3. The modern template renders a search button in the header and a modal that
   loads the index on first open and ranks matches as you type.

## Using search

- Click the **Search** button in the header, press <kbd>⌘ K</kbd> /
  <kbd>Ctrl K</kbd>, or press <kbd>/</kbd> to open the modal.
- Type to filter — results are ranked by where the match occurs (titles rank
  above body text) and matched terms are highlighted.
- Use <kbd>↑</kbd> / <kbd>↓</kbd> to move between results, <kbd>↵</kbd> to open
  the highlighted result, and <kbd>esc</kbd> to close.

## Configuration

Search is enabled by default. Set `enableSearch` to `false` to skip generating
the index and hide the search UI:

```ts
import type { DoculaOptions } from 'docula';

export const options: Partial<DoculaOptions> = {
  enableSearch: false,
};
```

When `enableSearch` is `false`, no `search-index.json` is written and the search
button and modal are omitted from the rendered pages.

## What gets indexed

| Content | Indexed |
|---------|---------|
| Documentation pages (`docs/`) | Yes — one record per heading, plus a page-level record |
| Changelog entries | Yes — published entries (drafts are skipped) |
| API reference | No — the API page has its own built-in endpoint filter |

The injected "Table of Contents" section is automatically excluded from the
index so it never shows up as a result.
