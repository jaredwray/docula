---
title: Changelog
order: 8
---

# Changelog

Docula can generate a changelog section for your site from markdown files. This is useful for documenting release notes, updates, and changes to your project in a structured, browsable format.

## Setup

Create a `changelog` folder inside your site directory and add markdown (`.md` or `.mdx`) files for each entry:

```
site
├───changelog
│   ├───2025-01-15-initial-release.md
│   ├───2025-02-01-new-features.md
│   └───2025-03-10-bug-fixes.md
├───logo.svg
├───favicon.ico
└───docula.config.mjs
```

## Entry Format

Each changelog entry is a markdown file with front matter:

```md
---
title: "Initial Release"
date: 2025-01-15
tag: "Release"
---

We're excited to announce the initial release! Here's what's included:

- Feature A
- Feature B
- Bug fix C
```

### Front Matter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `title` | No | Display title for the entry. Defaults to the filename if not provided. |
| `date` | Yes | Date of the entry (`YYYY-MM-DD`). Used for sorting (newest first). |
| `tag` | No | A label displayed as a badge (e.g., `Release`, `Bug Fix`, `Feature`). Gets a CSS class based on its value for styling. |
| `draft` | No | When `true`, the entry is excluded from the build output. Useful for work-in-progress entries. |
| `previewImage` | No | Image URL displayed above the preview on the changelog listing page. |

## Draft Entries

To hide a changelog entry from the build output, add `draft: true` to the front matter:

```md
---
title: "Upcoming Feature"
date: 2025-04-01
tag: "Feature"
draft: true
---

This entry won't appear on the site until `draft` is removed or set to `false`.
```

Draft entries are still parsed but excluded from the changelog listing, individual entry pages, sitemaps, and feeds. This is useful for preparing entries ahead of a release.

## File Naming

Files can optionally be prefixed with a date in `YYYY-MM-DD-` format. The date prefix is stripped to create the URL slug:

- `2025-01-15-initial-release.md` → `/changelog/initial-release/`
- `new-features.md` → `/changelog/new-features/`

## Generated Pages

When changelog entries are found, Docula generates:

- **Changelog listing page** at `/changelog/` — shows all entries sorted by date (newest first) with titles, dates, tags, and content
- **Individual entry pages** at `/changelog/{slug}/` — a dedicated page for each entry with a back link to the listing

Changelog URLs are also automatically added to the generated `sitemap.xml`.

## JSON Feeds

When changelog entries exist, Docula automatically generates two JSON Feed files at the root of your output directory:

- **`changelog.json`** — contains all changelog entries
- **`changelog-latest.json`** — contains only the most recent entries, limited by the `changelogPerPage` setting (default 20)

Both files follow the [JSON Feed v1.1](https://www.jsonfeed.org/version/1.1/) specification and include full entry content in both HTML and markdown formats, making them useful for programmatic consumption, integrations, or building custom changelog UIs.

### Example Structure

```json
{
  "version": "https://jsonfeed.org/version/1.1",
  "title": "My Project",
  "description": "Project description",
  "home_page_url": "https://your-site.com/",
  "feed_url": "https://your-site.com/changelog.json",
  "items": [
    {
      "id": "initial-release",
      "title": "Initial Release",
      "url": "https://your-site.com/changelog/initial-release",
      "date_published": "2025-01-15",
      "date_modified": "2025-01-15",
      "summary": "We're excited to announce the initial release!",
      "content_html": "<p>We're excited to announce the initial release!</p>",
      "content_text": "We're excited to announce the initial release!",
      "tags": ["Release"]
    }
  ]
}
```

## Styling

Tags receive a CSS class based on their value (e.g., a tag of `"Bug Fix"` gets the class `changelog-tag-bug-fix`). Both the modern and classic themes include built-in colors for the following tags:

| Tag | CSS Class | Color |
|-----|-----------|-------|
| `Added` | `.changelog-tag-added` | Green |
| `Improved` | `.changelog-tag-improved` | Blue |
| `Fixed` | `.changelog-tag-fixed` | Amber |
| `Removed` | `.changelog-tag-removed` | Red |
| `Deprecated` | `.changelog-tag-deprecated` | Gray |
| `Security` | `.changelog-tag-security` | Purple |
| `Release` | `.changelog-tag-release` | Green |
| `Pre-release` | `.changelog-tag-pre-release` | Yellow |

Any custom tag value also works — it receives a CSS class derived from the tag name in kebab-case. You can style custom tags by adding classes in your `variables.css`:

```css
.changelog-tag-my-custom-tag {
  background-color: #e0f2fe;
  color: #0369a1;
}
```