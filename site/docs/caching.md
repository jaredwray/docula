---
title: Caching
order: 6
---

# Caching

Docula uses a `.cache` directory inside your site folder to store intermediate build artifacts. This improves rebuild performance by avoiding redundant work when nothing has changed.

## What is cached

### Template overrides

When you use [partial template overrides](/docs/partial-templates), Docula merges your override files with the built-in template into `.cache/templates/{templateName}/`. On subsequent builds, Docula compares file modification times and skips the merge if your overrides haven't changed.

```
site/
  .cache/
    templates/
      modern/          # merged template (built-in + your overrides)
        home.hbs
        docs.hbs
        includes/
          footer.hbs   # your custom override
          sidebar.hbs  # from the built-in template
          ...
```

### GitHub API data

When your site is configured with a [GitHub integration](/docs/github-integration), Docula caches the API responses for releases and contributors to `.cache/github/github-data.json`. On subsequent builds, Docula checks the file's age against the configured TTL and skips the API call if the cache is still fresh.

```
site/
  .cache/
    github/
      github-data.json   # cached releases and contributors
```

By default the cache TTL is **3600 seconds (1 hour)**. You can change this in your config:

```typescript
import type { DoculaOptions } from 'docula';

export const options: Partial<DoculaOptions> = {
  cache: {
    github: {
      ttl: 7200, // 2 hours
    },
  },
};
```

Set `ttl` to `0` to disable GitHub caching entirely and always fetch fresh data from the API.

## Clearing the cache

Use the `--clean` flag to remove **all** caching along with the output directory:

```bash
npx docula build --clean
```

This deletes both the output directory (e.g., `dist/`) and the entire `.cache/` directory (including template and GitHub caches), forcing a full rebuild on the next run.

You can also manually delete the `.cache` directory at any time. Docula will recreate it as needed.

## Git and the cache

The `.cache` directory contains only generated files and should not be committed to version control. By default, Docula automatically adds `.cache` to your site folder's `.gitignore` the first time the cache is created. If the `.gitignore` file does not exist, Docula creates it.

If you prefer to manage your `.gitignore` manually, you can disable this behavior in your config:

```typescript
import type { DoculaOptions } from 'docula';

export const options: Partial<DoculaOptions> = {
  autoUpdateIgnores: false,
};
```

When disabled, you should add `.cache` to your `.gitignore` yourself:

```
# .gitignore
.cache
```

## Configuration reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoUpdateIgnores` | `boolean` | `true` | Automatically add `.cache` to the site folder's `.gitignore` on first cache creation |
| `cache.github.ttl` | `number` | `3600` | Time-to-live in seconds for cached GitHub API data. Set to `0` to disable. |
