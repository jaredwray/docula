---
title: Configuration
order: 3
---

# Configuration

Docula supports TypeScript configuration files (`docula.config.ts`) in addition to JavaScript (`docula.config.mjs`). TypeScript configs provide type safety and better IDE support.

## Initializing with TypeScript

When you run `npx docula init`, docula automatically detects TypeScript projects by checking for a `tsconfig.json` in the current directory. If found, it generates a `docula.config.ts` file. Otherwise, it generates `docula.config.mjs`.

You can also explicitly choose:

```bash
npx docula init --typescript   # Force TypeScript config
npx docula init --javascript   # Force JavaScript config
```

The TypeScript config provides full type support:

```typescript
import type { DoculaOptions } from 'docula';

export const options: Partial<DoculaOptions> = {
  templatePath: './template',
  output: './site/dist',
  sitePath: './site',
  githubPath: 'your-username/your-repo',
  siteTitle: 'My Project',
  siteDescription: 'Project description',
  siteUrl: 'https://your-site.com',
  themeMode: 'light', // or 'dark' — defaults to system preference if omitted
  homeUrl: '/', // "Back to Home" link in nav
  baseUrl: '/docs', // host under a subpath
  docsPath: '', // place docs at the output root
  apiPath: 'api',
  changelogPath: 'changelog',
};
```

## Using Lifecycle Hooks with TypeScript

You can add typed lifecycle hooks to your config:

```typescript
import type { DoculaConsole, DoculaOptions } from 'docula';

export const options: Partial<DoculaOptions> = {
  siteTitle: 'My Project',
  // ... other options
};

export const onPrepare = async (config: DoculaOptions, console: DoculaConsole): Promise<void> => {
  // Runs before the build process
  console.info(`Building ${config.siteTitle}...`);
};
```

## Manipulating Release Changelog Entries

The `onReleaseChangelog` hook lets you modify, filter, or transform GitHub release entries before they are merged with file-based changelog entries and rendered. This is useful for cleaning up release notes, filtering out unwanted releases, or customizing tags.

```typescript
import type { DoculaChangelogEntry, DoculaConsole, DoculaOptions } from 'docula';

export const options: Partial<DoculaOptions> = {
  githubPath: 'your-username/your-repo',
  enableReleaseChangelog: true,
};

export const onReleaseChangelog = (entries: DoculaChangelogEntry[], console: DoculaConsole): DoculaChangelogEntry[] => {
  console.info(`Processing ${entries.length} release entries...`);
  return entries
    // Filter out pre-releases
    .filter(entry => entry.tag !== 'Pre-release')
    // Customize titles
    .map(entry => ({
      ...entry,
      title: entry.title.replace(/^v/, 'Version '),
    }));
};
```

Each `DoculaChangelogEntry` has these fields you can read or modify:

| Field | Type | Description |
|-------|------|-------------|
| `title` | `string` | Entry title (from release name or tag) |
| `date` | `string` | Date string (YYYY-MM-DD) |
| `formattedDate` | `string` | Localized display date |
| `tag` | `string?` | Badge label (e.g., "Release", "Pre-release") |
| `tagClass` | `string?` | CSS class derived from tag |
| `slug` | `string` | URL-friendly identifier |
| `content` | `string` | Raw markdown content |
| `generatedHtml` | `string` | Rendered HTML |
| `preview` | `string` | Auto-generated preview HTML for the changelog index (300-500 chars, paragraph-aware, headings and images stripped) |
| `previewImage` | `string?` | Image URL displayed above the preview on the changelog listing page (set via front matter) |
| `urlPath` | `string` | Output file path |

The hook can be synchronous or async. If the hook throws an error, it is logged and the unmodified entries are used.

## DoculaConsole Logger

Both `onPrepare` and `onReleaseChangelog` hooks receive a `DoculaConsole` instance as their second argument. This provides styled, consistent logging output:

| Method | Description |
|--------|-------------|
| `console.log(message)` | Plain text output |
| `console.info(message)` | Informational message with cyan prefix |
| `console.warn(message)` | Warning message with yellow prefix |
| `console.error(message)` | Error message with red prefix |
| `console.success(message)` | Success message with green prefix |
| `console.step(message)` | Step/progress message with blue prefix |

## Config File Priority

When both config files exist, Docula loads them in this order (first found wins):
1. `docula.config.ts` (TypeScript - takes priority)
2. `docula.config.mjs` (JavaScript)

## Available Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `templatePath` | `string` | `'./template'` | Path to custom template directory |
| `output` | `string` | `'{sitePath}/dist'` | Output directory for built site (defaults to `dist/` inside the site directory) |
| `sitePath` | `string` | `'./site'` | Directory containing site content |
| `githubPath` | `string` | `''` | GitHub repository path (e.g., `'user/repo'`). Optional — when empty, GitHub features are disabled. See [GitHub Integration](/docs/github-integration). |
| `siteTitle` | `string` | `'docula'` | Website title |
| `siteDescription` | `string` | - | Website description |
| `siteUrl` | `string` | - | Website URL |
| `port` | `number` | `3000` | Port for local development server |
| `sections` | `DoculaSection[]` | - | Documentation sections |
| `openApiUrl` | `string` | - | OpenAPI spec URL for API documentation (auto-detected if `api/swagger.json` exists) |
| `openApiSpecs` | `Array<{ name: string; url: string; path: string; order?: number }>` | - | Multiple OpenAPI specs rendered as sections on a single API page. Overrides `openApiUrl`. See [API Reference](/docs/api-reference). |
| `enableReleaseChangelog` | `boolean` | `true` | Convert GitHub releases to changelog entries |
| `changelogPerPage` | `number` | `20` | Number of changelog entries to display per page |
| `enableLlmsTxt` | `boolean` | `true` | Generate `llms.txt` and `llms-full.txt` in the build output |
| `themeMode` | `'light'` \| `'dark'` | - | Override the default theme. By default the site follows the system preference. Set to `'light'` or `'dark'` to use that theme when no user preference is stored. |
| `cookieAuth` | `{ loginUrl: string; logoutUrl?: string; authCheckUrl?: string; authCheckMethod?: string; authCheckUserPath?: string }` | - | Enables cookie-based authentication, which displays a Login/Logout button in the header. See [Cookie Auth](/docs/cookie-auth). |
| `headerLinks` | `Array<{ label: string; url: string; icon?: string }>` | - | Additional links to display in the site header navigation. See [Header Links](/docs/header-links). |
| `homeUrl` | `string` | - | URL for the "Back to Home" link in the header navigation. When set, a link is displayed before the other nav items. Useful when hosting docs under a subpath and the logo should stay within docs. |
| `baseUrl` | `string` | `''` | Base URL path prefix for all generated paths (e.g., `'/docs'`). When set, all asset and navigation URLs are prefixed with this path. Useful when hosting docs under a subpath of another site. |
| `docsPath` | `string` | `'docs'` | Output subdirectory and URL segment for documentation pages. Set to `''` to place docs at the output root — useful with `baseUrl` to avoid `/docs/docs/` nesting. |
| `apiPath` | `string` | `'api'` | Output subdirectory and URL segment for API reference pages. |
| `changelogPath` | `string` | `'changelog'` | Output subdirectory and URL segment for changelog pages. |
| `allowedAssets` | `string[]` | *(see [Assets & Public Folder](/docs/assets))* | File extensions to copy from `docs/` and `changelog/` to output |
