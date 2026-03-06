---
title: Changelog
order: 10
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

## File Naming

Files can optionally be prefixed with a date in `YYYY-MM-DD-` format. The date prefix is stripped to create the URL slug:

- `2025-01-15-initial-release.md` → `/changelog/initial-release/`
- `new-features.md` → `/changelog/new-features/`

## Generated Pages

When changelog entries are found, Docula generates:

- **Changelog listing page** at `/changelog/` — shows all entries sorted by date (newest first) with titles, dates, tags, and content
- **Individual entry pages** at `/changelog/{slug}/` — a dedicated page for each entry with a back link to the listing

Changelog URLs are also automatically added to the generated `sitemap.xml`.

## Styling

Tags receive a CSS class based on their value (e.g., a tag of `"Bug Fix"` gets the class `changelog-tag-bug-fix`). You can style tags and other changelog elements by overriding these classes in your `variables.css`:

```css
.changelog-entry {
  border-bottom: 1px solid var(--border);
  padding: 1.5rem 0;
}

.changelog-tag {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.changelog-tag-release {
  background-color: #d4edda;
  color: #155724;
}

.changelog-tag-bug-fix {
  background-color: #f8d7da;
  color: #721c24;
}
```
