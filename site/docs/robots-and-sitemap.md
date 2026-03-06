---
title: Robots & Sitemap
order: 14
---

Docula automatically generates a `robots.txt` and `sitemap.xml` in your output directory during every build. No configuration is required.

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
- **Documentation pages** — every page in `docs/`, using the full resolved URL path
- **API Reference** — included when `openApiUrl` is configured and the API template exists
- **Changelog** — the changelog landing page plus individual entries for each release

All URLs use the absolute `siteUrl` from your config (e.g., `https://your-site.com/docs/configuration`).

### Example Output

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://your-site.com</loc></url>
  <url><loc>https://your-site.com/docs/</loc></url>
  <url><loc>https://your-site.com/docs/configuration</loc></url>
  <url><loc>https://your-site.com/api</loc></url>
  <url><loc>https://your-site.com/changelog</loc></url>
  <url><loc>https://your-site.com/changelog/v1.0.0</loc></url>
</urlset>
```

## Output Location

Both files are written to the root of your output directory:

```
dist/
  robots.txt
  sitemap.xml
```
