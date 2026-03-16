---
title: Robots & Sitemap
order: 18
---

Docula automatically generates a `robots.txt`, `sitemap.xml`, and `feed.xml` in your output directory during every build. No configuration is required.

## robots.txt

The `robots.txt` file tells search engine crawlers which pages they are allowed to access. Docula generates a permissive default at `dist/robots.txt`:

```
User-agent: *
Disallow:
```

This allows all crawlers to index every page on your site.

### Custom Override

To use your own `robots.txt`, place a file at `site/robots.txt`. Docula will copy it to the output directory as-is instead of generating the default.

## sitemap.xml

The `sitemap.xml` file provides search engines with a structured list of all pages on your site, making it easier for crawlers to discover and index your content. Docula generates it at `dist/sitemap.xml`.

### What Gets Included

The sitemap automatically includes URLs for:

- **Home page** — your site root URL
- **RSS feed** — the generated docs feed at `/feed.xml` when documentation pages exist
- **Documentation pages** — every page in `docs/`, using the full resolved URL path
- **API Reference** — included when `openApiUrl` is configured and the API template exists
- **Changelog** — the changelog landing page plus individual entries for each release

All URLs use the absolute `siteUrl` from your config (e.g., `https://your-site.com/docs/configuration`).

### Example Output

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://your-site.com</loc></url>
  <url><loc>https://your-site.com/feed.xml</loc></url>
  <url><loc>https://your-site.com/docs/</loc></url>
  <url><loc>https://your-site.com/docs/configuration</loc></url>
  <url><loc>https://your-site.com/api</loc></url>
  <url><loc>https://your-site.com/changelog</loc></url>
  <url><loc>https://your-site.com/changelog/v1.0.0</loc></url>
</urlset>
```

## feed.xml

When your site contains documentation pages, Docula also generates an RSS 2.0 feed at `dist/feed.xml`.

### What Gets Included

- One feed item per generated documentation page
- The document title as the item title
- The canonical documentation URL as the item link and GUID
- A lightweight summary using the document description, or a short markdown excerpt when no description is set

## Output Location

All three files are written to the root of your output directory:

```
dist/
  feed.xml
  robots.txt
  sitemap.xml
```
