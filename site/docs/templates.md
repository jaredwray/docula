---
title: Templates
order: 4
---

# Templates

Docula ships with two built-in templates: **Modern** (default) and **Classic**. You can also provide your own custom template.

## Modern (default)

The Modern template is a contemporary, feature-rich design built for today's documentation sites. It is the default template when you create a new Docula project.

```js
export const options = {
  template: 'modern',
};
```

### Home Page

The home page features a clean hero section with your project logo and description, quick-action buttons for Documentation, API Reference, and Changelog, a contributors grid, and a releases timeline.

![Modern template home page](images/modern-home.png)

### Documentation Page

Documentation pages use a sticky header bar with icon-based navigation, a collapsible sidebar with section grouping, and an inline table of contents for the current page. On mobile, the sidebar collapses into a dropdown selector.

![Modern template docs page](images/modern-docs.png)

### Key Features

| Feature | Details |
|---------|---------|
| **Theme toggle** | Built-in light/dark/system toggle stored in localStorage |
| **Mobile navigation** | Hamburger menu with slide-out sidebar and backdrop overlay |
| **Sticky header** | Always-visible navigation bar with Documentation, API Reference, and Changelog links |
| **Collapsible sidebar** | Uses `<details>` elements for expandable section navigation |
| **System fonts** | No external font dependencies (`system-ui`, `-apple-system`, etc.) |
| **Syntax highlighting** | Docula code theme with light and dark variants |
| **CSS variables** | Full theming via `--bg`, `--fg`, `--border`, `--surface`, `--link`, and more |

---

## Classic

The Classic template provides a traditional documentation layout inspired by popular open-source project sites. It uses a grid-based design with a prominent sidebar.

```js
export const options = {
  template: 'classic',
};
```

### Home Page

The home page displays a hero section with your project logo, description, and quick links. When in multi-page mode it also shows documentation and API reference buttons, contributors, and releases.

![Classic template home page](images/classic-home.png)

### Documentation Page

Documentation pages use a sidebar-based navigation with a simple list layout. The table of contents is rendered as a fixed sidebar element on desktop.

![Classic template docs page](images/classic-docs.png)

### Key Features

| Feature | Details |
|---------|---------|
| **Grid layout** | Traditional two-column grid with sidebar and content area |
| **Google Fonts** | Uses Open Sans (weights 400, 600, 700) via Google Fonts |
| **Modular CSS** | Separate stylesheets for single-page, multi-page, and landing layouts |
| **Syntax highlighting** | Dracula code theme |
| **CSS variables** | Theming via `--color-primary`, `--color-secondary`, `--sidebar-background`, etc. |

---

## Comparison

| | Modern | Classic |
|---|--------|---------|
| **Theme toggle** | Built-in (light / dark / system) | Not included |
| **Mobile menu** | Hamburger with slide-out sidebar | Sidebar overlay |
| **Header navigation** | Sticky bar with SVG icons | Minimal |
| **Fonts** | System fonts (no external requests) | Google Fonts (Open Sans) |
| **Code theme** | Docula (light + dark) | Dracula |
| **Sidebar style** | Collapsible `<details>` sections | Flat list |
| **CSS architecture** | Single `styles.css` with variables | Modular per-layout files |

---

## Using a Custom Template

If neither built-in template fits your needs, you can point Docula at your own template directory. The directory should contain Handlebars (`.hbs`) files matching the structure of the built-in templates.

### Via config

```typescript
import type { DoculaOptions } from 'docula';

export const options: Partial<DoculaOptions> = {
  templatePath: './my-template',
};
```

### Via the CLI

```bash
npx docula build --templatePath ./my-template
```

When `templatePath` is set it takes priority over the `template` option. Your custom template directory should include at minimum:

- `home.hbs` — Landing page
- `docs.hbs` — Documentation page
- `includes/` — Partials (header, footer, sidebar, etc.)

Refer to the built-in templates in the `templates/` directory of the Docula repository for a complete example of the expected structure and available Handlebars variables.
