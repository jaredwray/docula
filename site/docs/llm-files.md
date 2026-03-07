---
title: LLM Files
order: 9
---

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
