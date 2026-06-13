---
title: Partial Templates
order: 11
---

# Partial Template Overrides

Docula lets you override individual template files from a built-in template without replacing the entire template. This is useful when you want to customize specific parts of a template (such as the footer, sidebar, or header) while keeping the rest of the default template intact.

## How It Works

Place your override files in a `templates/{templateName}/` directory inside your site folder. The directory structure mirrors the built-in template. Any file you include will replace its corresponding file in the built-in template during the build.

For example, if you are using the `modern` template and want to customize the footer:

```
site/
  templates/
    modern/
      includes/
        footer.hbs    # overrides the built-in modern/includes/footer.hbs
  docs/
    index.md
  docula.config.ts
```

## Overridable Files

You can override any file in the built-in template, including:

**Top-level templates:**
- `home.hbs` — Landing page
- `docs.hbs` — Documentation page
- `api.hbs` — API reference page
- `changelog.hbs` — Changelog listing page
- `changelog-entry.hbs` — Individual changelog entry page

**Includes (partials):**
- `includes/header.hbs` — Page header/meta tags
- `includes/header-bar.hbs` — Sticky header navigation bar
- `includes/footer.hbs` — Page footer
- `includes/sidebar.hbs` — Navigation sidebar
- `includes/doc.hbs` — Document content wrapper
- `includes/hero.hbs` — Hero section
- `includes/home.hbs` — Home page content
- `includes/scripts.hbs` — Page scripts
- `includes/theme-toggle.hbs` — Light/dark theme toggle

**Assets:**
- `css/` — Stylesheet files
- `js/` — JavaScript files

The available includes vary by template. Check the `templates/` directory in the [Docula repository](https://github.com/jaredwray/docula) for the complete list of files in each template.

## Example: Custom Footer

1. Create the override directory structure:

```bash
mkdir -p site/templates/modern/includes
```

2. Create your custom footer at `site/templates/modern/includes/footer.hbs`:

```handlebars
<footer class="site-footer">
  <div class="footer-content">
    <p>&copy; 2024 My Project. Built with Docula.</p>
    <nav>
      <a href="/docs">Docs</a>
      <a href="/changelog">Changelog</a>
    </nav>
  </div>
</footer>
```

3. Build your site as usual:

```bash
npx docula build
```

During the build, Docula will log which files are being overridden:

```
▶ Applying template overrides...
ℹ Template override: includes/footer.hbs
```

## Notes

- **Built-in templates only** — Partial overrides work with the `template` option (e.g., `modern`, `classic`). If you use `templatePath` to provide a fully custom template, overrides are not applied since you already control the entire template.
- **Cache directory** — Docula merges overrides into a `.cache/templates/{templateName}/` directory inside your site folder. This directory is automatically managed and only rebuilt when override files change. Use `--clean` to remove it along with the output directory.
- **Automatic .gitignore** — When the `.cache` directory is first created, Docula automatically adds `.cache` to your site folder's `.gitignore` (creating the file if needed). Set `autoUpdateIgnores: false` in your config to disable this behavior.
- **Any file can be overridden** — The override directory structure mirrors the built-in template exactly. Any file you place in the override directory replaces the corresponding file from the built-in template.
