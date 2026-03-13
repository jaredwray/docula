---
title: Configuration
order: 3
---

# Configuration

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
  themeMode: 'light', // or 'dark' — defaults to system preference if omitted
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

## Manipulating Release Changelog Entries

The `onReleaseChangelog` hook lets you modify, filter, or transform GitHub release entries before they are merged with file-based changelog entries and rendered. This is useful for cleaning up release notes, filtering out unwanted releases, or customizing tags.

```typescript
import type { DoculaChangelogEntry, DoculaOptions } from 'docula';

export const options: Partial<DoculaOptions> = {
  githubPath: 'your-username/your-repo',
  enableReleaseChangelog: true,
};

export const onReleaseChangelog = (entries: DoculaChangelogEntry[]): DoculaChangelogEntry[] => {
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
| `githubPath` | `string` | `''` | GitHub repository path (e.g., `'user/repo'`). Optional — when empty, GitHub features are disabled. See [GitHub Integration](/docs/github-integration). |
| `siteTitle` | `string` | `'docula'` | Website title |
| `siteDescription` | `string` | - | Website description |
| `siteUrl` | `string` | - | Website URL |
| `port` | `number` | `3000` | Port for local development server |
| `homePage` | `boolean` | `true` | When `false`, Docula uses the first docs page as `/index.html` instead of rendering `home.hbs` |
| `sections` | `DoculaSection[]` | - | Documentation sections |
| `openApiUrl` | `string` | - | OpenAPI spec URL for API documentation (auto-detected if `api/swagger.json` exists) |
| `enableReleaseChangelog` | `boolean` | `true` | Convert GitHub releases to changelog entries |
| `changelogPerPage` | `number` | `20` | Number of changelog entries to display per page |
| `enableLlmsTxt` | `boolean` | `true` | Generate `llms.txt` and `llms-full.txt` in the build output |
| `themeMode` | `'light'` \| `'dark'` | - | Override the default theme. By default the site follows the system preference. Set to `'light'` or `'dark'` to use that theme when no user preference is stored. |
| `cookieAuth` | `{ loginUrl: string; cookieName?: string; logoutUrl?: string }` | - | Cookie-based auth. Shows a Login/Logout button in the header based on a JWT cookie. See [Cookie Auth](/docs/cookie-auth). |
| `headerLinks` | `Array<{ label: string; url: string; icon?: string }>` | - | Additional links to display in the site header navigation. See [Header Links](/docs/header-links). |
| `allowedAssets` | `string[]` | *(see [Assets & Public Folder](/docs/assets))* | File extensions to copy from `docs/` and `changelog/` to output |
