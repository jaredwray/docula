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
| `homePage` | `boolean` | `true` | When `false`, Docula uses the first docs page as `/index.html` instead of rendering `home.hbs` |
| `sections` | `DoculaSection[]` | - | Documentation sections |
| `openApiUrl` | `string` | - | OpenAPI spec URL for API documentation (auto-detected if `api/swagger.json` exists) |
| `enableReleaseChangelog` | `boolean` | `true` | Convert GitHub releases to changelog entries |
| `enableLlmsTxt` | `boolean` | `true` | Generate `llms.txt` and `llms-full.txt` in the build output |
| `themeMode` | `'light'` \| `'dark'` | - | Override the default theme. By default the site follows the system preference. Set to `'light'` or `'dark'` to use that theme when no user preference is stored. |
| `allowedAssets` | `string[]` | *(see [Assets & Public Folder](/docs/assets))* | File extensions to copy from `docs/` and `changelog/` to output |
