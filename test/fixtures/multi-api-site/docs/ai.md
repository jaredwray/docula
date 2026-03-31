---
title: Using AI
order: 2
description: Automatically fill missing OpenGraph and HTML meta tags using AI
keywords:
  - ai
  - metadata
  - opengraph
  - seo
---

# Using AI

Docula can automatically generate missing metadata for your documentation pages using AI. When configured, it fills gaps in OpenGraph tags, descriptions, and keywords so your pages are optimized for search engines and social sharing without manual effort.

## How It Works

During the build, Docula checks each document and changelog entry for missing metadata fields. If any are missing and AI is configured, it uses [Writr's AI features](https://writr.org) to generate the missing values. Results are cached so unchanged content never triggers redundant API calls.

Fields that are enriched (only when missing):

- `description` - page meta description
- `keywords` - search keywords
- `ogTitle` - OpenGraph title
- `ogDescription` - OpenGraph description
- `title` - changelog entry titles (if missing)
- `preview` - changelog entry previews (if missing)

Existing frontmatter values are never overwritten.

## Configuration

Add the `ai` option to your `docula.config.mjs` or `docula.config.ts`:

```js
export const options = {
  ai: {
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
};
```

### Options

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `provider` | `string` | Yes | AI provider: `"anthropic"`, `"openai"`, or `"google"` |
| `apiKey` | `string` | Yes | Your API key for the provider |
| `model` | `string` | No | Override the default model |

### Supported Providers

| Provider | Default Model |
|----------|--------------|
| `anthropic` | `claude-haiku-4-5` |
| `openai` | `gpt-4o-mini-latest` |
| `google` | `gemini-2.5-flash-lite` |

### Custom Model

To use a specific model, set the `model` property:

```js
export const options = {
  ai: {
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-6-20250217',
  },
};
```

## Disabling AI

To disable AI enrichment, simply omit the `ai` property from your config (it is not set by default).

## Caching

AI results are cached in `.cache/ai/metadata.json` inside your site directory, keyed by a hash of each document's body content. This means:

- Unchanged content reuses cached metadata (no API call)
- Editing the body content triggers re-enrichment on the next build
- Deleting `.cache/ai/metadata.json` forces re-enrichment of all documents

The `.cache` directory is automatically added to `.gitignore`.

## Example

Given a document with minimal frontmatter:

```md
---
title: Getting Started
order: 1
---

# Getting Started

Follow these steps to install and configure Docula for your project...
```

After an AI-enriched build, the built page will include auto-generated meta tags:

```html
<meta name="description" content="Learn how to install and configure Docula for your project documentation">
<meta name="keywords" content="docula, documentation, setup, installation, getting-started">
<meta property="og:title" content="Getting Started">
<meta property="og:description" content="Learn how to install and configure Docula for your project documentation">
```

The source file is not modified - enrichment is applied in-memory during the build.
