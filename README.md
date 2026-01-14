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
- [TypeScript Configuration](#typescript-configuration)
- [Using Your own Template](#using-your-own-template)
- [Building Multiple Pages](#building-multiple-pages)
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
  outputPath: './dist',
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
| `outputPath` | `string` | `'./dist'` | Output directory for built site |
| `sitePath` | `string` | `'./site'` | Directory containing site content |
| `githubPath` | `string` | - | GitHub repository path (e.g., `'user/repo'`) |
| `siteTitle` | `string` | `'docula'` | Website title |
| `siteDescription` | `string` | - | Website description |
| `siteUrl` | `string` | - | Website URL |
| `port` | `number` | `3000` | Port for local development server |
| `singlePage` | `boolean` | `true` | Single page or multi-page site |
| `sections` | `DoculaSection[]` | - | Documentation sections |

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
