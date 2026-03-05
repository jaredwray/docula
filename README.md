![Docula](site/logo.svg)

# Beautiful Website for Your Projects

[![tests](https://github.com/jaredwray/docula/actions/workflows/tests.yaml/badge.svg)](https://github.com/jaredwray/docula/actions/workflows/tests.yaml)
[![GitHub license](https://img.shields.io/github/license/jaredwray/docula)](https://github.com/jaredwray/docula/blob/master/LICENSE)
[![codecov](https://codecov.io/gh/jaredwray/docula/graph/badge.svg?token=RS0GPY4V4M)](https://codecov.io/gh/jaredwray/docula)
[![npm](https://img.shields.io/npm/dm/docula)](https://npmjs.com/package/docula)
[![npm](https://img.shields.io/npm/v/docula)](https://npmjs.com/package/docula)

# Table of Contents
- [Features](#features)
- [Open Source Examples](#open-source-examples)
- [Getting Started](#getting-started)
  - [Serve your site locally](#serve-your-site-locally)
- [TypeScript Configuration](#typescript-configuration)
- [Using Your own Template](#using-your-own-template)
- [Building Multiple Pages](#building-multiple-pages)
- [Including Assets in Markdown](#including-assets-in-markdown)
- [Public Folder](#public-folder)
- [API Reference](#api-reference)
- [LLM Files](#llm-files)
- [Announcements](#announcements)
- [Changelog](#changelog)
- [Alert, Info, Warn Styling](#alert-info-warn-styling)
- [Using a Github Token](#using-a-github-token)
- [Helpers](#helpers)
- [Working with Markdown using Writr](#working-with-markdown-using-writr)
- [Code of Conduct and Contributing](#code-of-conduct-and-contributing)
- [License - MIT](#license)

# Features
* No configuration required. Just setup the folder structure with a logo, favicon, and css file.
* Builds a static website that can be hosted anywhere.
* For more complex projects easily add a `docula.config.ts` (TypeScript) or `docula.config.mjs` (JavaScript) file to customize the build process with lifecycle hooks.
* Full TypeScript support with typed configuration and IDE autocompletion.
* Support for single page with readme or multiple markdown pages in a docs folder.
* Will generate a sitemap.xml and robots.txt for your site.
* Automatically generates `llms.txt` and `llms-full.txt` for LLM-friendly indexing of docs, API reference, and changelog content.
* Uses Github release notes to generate a changelog / releases page.
* Uses Github to show contributors and link to their profiles.
* Simple search is provided by default out of the box.

# Open Source Examples

See Docula in action with these open source projects that use it for their documentation:

* **[Cacheable.org](https://cacheable.org)** - High-performance caching library for Node.js with layered caching support ([Source](https://github.com/jaredwray/cacheable))
* **[Keyv.org](https://keyv.org)** - Simple key-value storage with support for multiple backends ([Source](https://github.com/jaredwray/keyv))
* **[Docula.org](https://docula.org)** - Docula's own documentation site, built with Docula ([Source](https://github.com/jaredwray/docula))

These examples showcase different approaches to using Docula, from simple single-page sites to more complex documentation with multiple pages and custom configurations.

# Getting Started 

## Install docula via init
> npx docula init

This will create a folder called site with the following structure:

```
site
├───site.css
├───logo.png
├───favicon.ico
├───README.md
├───docula.config.mjs
```
Note: for typescript do 'docula init --typescript'

## Add your content

Simply replace the logo, favicon, and css file with your own. The readme is your root project readme and you just need to at build time move it over to the site folder. If you have it at the root of the project and this is a folder inside just delete the  README.md file in the site folder and docula will copy it over for you automatically.

## Build your site

> npx docula

This will build your site and place it in the `dist` folder. You can then host it anywhere you like.

## Serve your site locally

> npx docula serve

This will build and serve your site locally at `http://localhost:3000`. You can specify a custom port with the `-p` or `--port` flag:

> npx docula serve -p 8080

### CLI Options for serve

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --port` | Set the port number | `3000` |
| `-s, --site` | Set the path where site files are located | `./site` |
| `-o, --output` | Set the output directory | `./site/dist` |
| `-w, --watch` | Watch for changes and rebuild | `false` |

# TypeScript Configuration

Docula supports TypeScript configuration files (`docula.config.ts`) in addition to JavaScript (`docula.config.mjs`). TypeScript configs provide type safety and better IDE support.

## Initializing with TypeScript

To create a new project with a TypeScript config file:

```bash
npx docula init --typescript
```

This creates a `docula.config.ts` file with full type support:

```typescript
import type { DoculaOptions } from 'docula';

export const options: Partial<DoculaOptions> = {
  templatePath: './template',
  output: './dist',
  sitePath: './site',
  githubPath: 'your-username/your-repo',
  siteTitle: 'My Project',
  siteDescription: 'Project description',
  siteUrl: 'https://your-site.com',
};
```

## Using Lifecycle Hooks with TypeScript

You can add typed lifecycle hooks to your config:

```typescript
import type { DoculaOptions } from 'docula';

export const options: Partial<DoculaOptions> = {
  siteTitle: 'My Project',
  // ... other options
};

export const onPrepare = async (config: DoculaOptions): Promise<void> => {
  // Runs before the build process
  console.log(`Building ${config.siteTitle}...`);
};
```

## Config File Priority

When both config files exist, Docula loads them in this order (first found wins):
1. `docula.config.ts` (TypeScript - takes priority)
2. `docula.config.mjs` (JavaScript)

## Available Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `templatePath` | `string` | `'./template'` | Path to custom template directory |
| `output` | `string` | `'./dist'` | Output directory for built site |
| `sitePath` | `string` | `'./site'` | Directory containing site content |
| `githubPath` | `string` | - | GitHub repository path (e.g., `'user/repo'`) |
| `siteTitle` | `string` | `'docula'` | Website title |
| `siteDescription` | `string` | - | Website description |
| `siteUrl` | `string` | - | Website URL |
| `port` | `number` | `3000` | Port for local development server |
| `singlePage` | `boolean` | `true` | Single page or multi-page site |
| `homePage` | `boolean` | `true` | When `false`, Docula uses the first docs page as `/index.html` instead of rendering `home.hbs` |
| `sections` | `DoculaSection[]` | - | Documentation sections |
| `openApiUrl` | `string` | - | OpenAPI spec URL for API documentation (auto-detected if `api/swagger.json` exists) |
| `enableReleaseChangelog` | `boolean` | `true` | Convert GitHub releases to changelog entries |
| `enableLlmsTxt` | `boolean` | `true` | Generate `llms.txt` and `llms-full.txt` in the build output |
| `assetExtensions` | `string[]` | *(see [Including Assets in Markdown](#including-images-and-assets-in-markdown))* | File extensions to copy from `docs/` and `changelog/` to output |

# Using Your own Template

If you want to use your own template you can do so by adding a `docula.config.ts` file to the root of your project. This file will be used to configure the build process.

or at the command line:

> npx docula --template path/to/template

# Building Multiple Pages

If you want to build multiple pages you can easily do that by adding in a `docs` folder to the root of the site folder. Inside of that folder you can add as many pages as you like. Each page will be a markdown file and it will generate a table of contents for you. Here is an example of what it looks like:

```
site
├───site.css
├───logo.png
├───favicon.ico
├───docula.config.mjs
├───docs
│   ├───getting-started.md
│   ├───contributing.md
│   ├───license.md
│   ├───code-of-conduct.md
```

The `readme.md` file will be the root page and the rest will be added to the table of contents. If you want to control the title or order of the pages you can do so by setting the `title` and `order` properties in the front matter of the markdown file. Here is an example:

```md
title: Getting Started
order: 2
```

If you want your docs to be the root home page (`/`) instead of rendering the template home page, set `homePage: false`:

```js
export const options = {
  homePage: false,
};
```

# Including Assets in Markdown

Non-markdown files placed inside the `docs/` or `changelog/` directories are automatically copied to the build output, preserving their relative paths. This lets you keep images and other assets alongside the markdown that references them.

For `docs/`, only assets that are actually referenced in a document's markdown content are copied. If a file exists in the `docs/` directory but is not referenced by any document, it will not be included in the build output. For `changelog/`, all assets are copied regardless of whether they are referenced.

```
site
├───docs
│   ├───getting-started.md
│   ├───images
│   │   ├───architecture.png
│   │   └───screenshot.jpg
│   └───assets
│       └───example.pdf
├───changelog
│   ├───2025-01-15-initial-release.md
│   └───images
│       └───release-banner.png
```

After building, these files appear at the same relative paths under `dist/`:

```
dist
├───docs
│   ├───getting-started
│   │   └───index.html
│   ├───images
│   │   ├───architecture.png
│   │   └───screenshot.jpg
│   └───assets
│       └───example.pdf
├───changelog
│   ├───initial-release
│   │   └───index.html
│   └───images
│       └───release-banner.png
```

Reference assets from your markdown with relative or absolute paths:

```md
![Architecture](/docs/images/architecture.png)
[Download PDF](/docs/assets/example.pdf)
```

## Supported Extensions

By default the following file extensions are copied:

**Images:** `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.avif`, `.ico`
**Documents:** `.pdf`, `.zip`, `.tar`, `.gz`
**Media:** `.mp4`, `.webm`, `.ogg`, `.mp3`, `.wav`
**Data:** `.json`, `.xml`, `.csv`, `.txt`

Files with extensions not in this list are ignored. To customize the list, set `assetExtensions` in your config:

```js
export const options = {
  assetExtensions: ['.png', '.jpg', '.gif', '.svg', '.pdf', '.custom'],
};
```

# Public Folder

If you have static assets like images, fonts, or other files that need to be copied directly to your built site, you can use a `public` folder. Any files placed in the `public` folder within your site directory will be automatically copied to the root of your `dist` output folder during the build process.

## Usage

Create a `public` folder inside your site directory:

```
site
├───public
│   ├───images
│   │   ├───screenshot.png
│   │   └───banner.jpg
│   ├───fonts
│   │   └───custom-font.woff2
│   └───downloads
│       └───example.pdf
├───docs
├───logo.svg
├───favicon.ico
└───docula.config.mjs
```

When you run the build command, all contents of the `public` folder will be copied to the `dist` folder:

```
dist
├───images
│   ├───screenshot.png
│   └───banner.jpg
├───fonts
│   └───custom-font.woff2
├───downloads
│   └───example.pdf
├───index.html
└───...
```

The build output will show each file being copied:

```
Public folder found, copying contents to dist...
  Copied: images/screenshot.png
  Copied: images/banner.jpg
  Copied: fonts/custom-font.woff2
  Copied: downloads/example.pdf
Build completed in 1234ms
```

This is useful for:
- Images referenced in your documentation
- Downloadable files (PDFs, zip archives, etc.)
- Custom fonts
- Any other static assets that need to be served from your site

# API Reference

Docula can generate an API Reference page from an OpenAPI (Swagger) specification. The spec is parsed at build time and rendered as a native, interactive API reference (inspired by [Scalar](https://github.com/scalar/scalar)) with grouped endpoints, method badges, schema tables, code examples, and search — all with no external dependencies. The page is available at `/api`.

## Auto-Detection

If your site directory contains an `api/swagger.json` file, Docula will automatically detect it and generate the API Reference page — no configuration needed:

```
site
├───api
│   └───swagger.json
├───docs
├───logo.svg
├───favicon.ico
└───docula.config.mjs
```

## Explicit Configuration

You can also set the `openApiUrl` option in your config to point to any OpenAPI spec, either a local path or a remote URL:

```js
export const options = {
  openApiUrl: '/api/swagger.json',
  // or a remote URL:
  // openApiUrl: 'https://petstore.swagger.io/v2/swagger.json',
};
```

When `openApiUrl` is set explicitly, it takes priority over auto-detection.

## Spec Requirements

The file must be a valid OpenAPI 3.x or Swagger 2.0 JSON specification. A minimal example:

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "My API",
    "version": "1.0.0"
  },
  "paths": {}
}
```

# LLM Files

Docula generates two LLM-focused files in the output directory by default:

- `/llms.txt` - a compact index of your docs, API reference, and changelog URLs.
- `/llms-full.txt` - expanded content including markdown bodies for docs/changelog and local OpenAPI spec text.

## What Gets Included

`/llms.txt` includes:
- Site title and description
- A link to `/llms-full.txt`
- Documentation links (absolute URLs)
- API Reference link when API docs are generated
- Changelog landing page and the latest 20 changelog entries

`/llms-full.txt` includes:
- Site title and description
- Full markdown body for each docs page
- Full markdown body for each changelog entry
- Full local OpenAPI spec text when available (for example `site/api/swagger.json`)

If `openApiUrl` points to a remote URL, `/llms-full.txt` includes only the URL reference instead of fetching content over the network.

## Configuration

To disable generation:

```js
export const options = {
  enableLlmsTxt: false,
};
```

## Custom Overrides

You can override generated output by providing custom files in your site directory:

- `site/llms.txt`
- `site/llms-full.txt`

If present, Docula copies these files to output as-is.

## Notes

- These files are generated in the output root (`dist/llms.txt` and `dist/llms-full.txt`).
- They are not added to `sitemap.xml`.

# Announcements

You can display an announcement banner on your home page by creating an `announcement.md` file in your site directory. This is useful for highlighting important updates, new releases, or any time-sensitive information.

## Usage

Create an `announcement.md` file in your site folder:

```
site
├───announcement.md
├───docs
├───logo.svg
├───favicon.ico
└───docula.config.mjs
```

Add your announcement content using markdown:

```md
**New Release:** Version 2.0 is now available! Check out the [release notes](/releases) for details.
```

The announcement will automatically appear on the home page above the "Documentation" button, styled as an alert box with a colored left border.

## Styling

The announcement uses your theme's CSS variables and displays with:
- A subtle background using `--sidebar-background`
- A prominent left border using `--color-secondary`
- Links styled with `--color-primary`

You can customize the appearance by overriding the `.announcement` class in your `variables.css`:

```css
.announcement {
  background-color: #fff3cd;
  border-left-color: #ffc107;
}
```

## Removing the Announcement

Simply delete the `announcement.md` file when you no longer need the announcement. The home page will automatically return to its normal layout.

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

# Alert, Info, Warn Styling

Docula uses Writr's GitHub-flavored Markdown plugins, including GitHub-style blockquote alerts. Use the alert syntax directly in Markdown:

```md
> [!NOTE]
> Info: Remember to configure your GitHub token for private repos.

> [!WARNING]
> Warn: This action cannot be undone.

> [!CAUTION]
> Alert: Rotate your secrets immediately.
```

These render with the `remark-github-blockquote-alert` classes (like `.markdown-alert` and `.markdown-alert-note`). If you want GitHub-like styling, copy the plugin's CSS into your `site/variables.css` or template stylesheet (for example, from `remark-github-blockquote-alert/alert.css`), or add your own overrides:

```css
.markdown-alert {
  border-left: 4px solid var(--border);
  border-radius: 8px;
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  background: var(--background);
}

.markdown-alert-note {
  border-left-color: #4c8ef7;
}

.markdown-alert-warning {
  border-left-color: #f2b90c;
}

.markdown-alert-caution {
  border-left-color: #e5534b;
}
```

# Using a Github Token

If you want to use the Github token to access the Github API you can do so by setting the `GITHUB_TOKEN` environment variable. This is useful if you want to access private repositories or if you want to access the Github API without hitting the rate limit. This is optional and you can still use docula without it but could hit rate limits and will not be able to access private repositories.

# Helpers

Docula provides powerful helper utilities through its integration with [Writr](https://writr.org). For all markdown operations including reading files, manipulating content, managing frontmatter, and rendering, you should use the `Writr` class that's exported from Docula.

**Instead of custom helper functions, use Writr for:**
- Loading and saving markdown files
- Getting and setting frontmatter (metadata)
- Rendering markdown to HTML
- Working with markdown content programmatically

See the [Working with Markdown using Writr](#working-with-markdown-using-writr) section below for comprehensive examples and usage patterns.

# Working with Markdown using Writr

Docula exports [Writr](https://writr.org) for powerful markdown operations including loading files, rendering, and managing frontmatter. Writr provides a simple API for working with markdown content.

## Creating and Loading Markdown

```js
import { Writr } from 'docula';

// Create a new instance with markdown content
const writr = new Writr('# Hello World\n\nThis is my content');

// Or load from a file
const writr = new Writr();
await writr.loadFromFile('./README.md');

// Synchronous version
writr.loadFromFileSync('./README.md');
```

## Getting and Setting Front Matter

Front matter is metadata at the top of markdown files in YAML format. Writr makes it easy to read and modify:

```js
import { Writr } from 'docula';

const writr = new Writr();
await writr.loadFromFile('./docs/guide.md');

// Get the entire front matter object
const frontMatter = writr.frontMatter;
console.log(frontMatter.title); // 'My Guide'

// Get a specific front matter value
const title = writr.getFrontMatterValue('title');
const order = writr.getFrontMatterValue('order');

// Set front matter
writr.frontMatter = {
  title: 'Updated Guide',
  order: 1,
  author: 'John Doe'
};

// Save the changes back to the file
await writr.saveToFile('./docs/guide.md');
```

## Accessing Markdown Content

```js
// Get the full content (front matter + markdown)
const fullContent = writr.content;

// Get just the markdown body (without front matter)
const markdown = writr.body;
// or use the alias
const markdown = writr.markdown;

// Get the raw front matter string (including delimiters)
const rawFrontMatter = writr.frontMatterRaw;

// Set new content
writr.content = '---\ntitle: New Title\n---\n# New Content';
```

## Rendering Markdown to HTML

```js
// Render to HTML
const html = await writr.render();

// Synchronous rendering
const html = writr.renderSync();

// Render with options
const html = await writr.render({
  emoji: true,        // Enable emoji support (default: true)
  toc: true,          // Generate table of contents (default: true)
  highlight: true,    // Code syntax highlighting (default: true)
  gfm: true,          // GitHub Flavored Markdown (default: true)
  math: true,         // Math support (default: true)
  mdx: true           // MDX support (default: true)
});

// Render directly to a file
await writr.renderToFile('./output.html');
```

# Code of Conduct and Contributing
[Code of Conduct](CODE_OF_CONDUCT.md) and [Contributing](CONTRIBUTING.md) guidelines.

# License

MIT © [Jared Wray](https://jaredwray.com)
