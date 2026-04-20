---
title: Styling
order: 7
---

# Styling Your Site

Docula gives you full control over the look and feel of your site through CSS variables and a custom stylesheet. The built-in templates define a set of CSS variables that you can override in your `site/variables.css` file.

## Custom Stylesheet

Each template ships with a default `variables.css` that defines its CSS variables. To customize your site's appearance, create a `variables.css` file in your site directory. This file replaces the template's defaults during the build, so any values you set here take priority.

The quickest way to get started is to run:

```bash
npx docula download variables
```

This copies the current template's `variables.css` into your site directory with all default values in place, ready for you to edit. If the file already exists, pass `--overwrite` to replace it.

```
site/
  variables.css   <-- your overrides go here
  logo.png
  favicon.ico
  docula.config.ts
```

## CSS Variables (Modern Template)

The Modern template uses the following CSS variables. Override any of these in `variables.css` to customize your site.

### Colors

| Variable | Dark Default | Light Default | Description |
|----------|-------------|---------------|-------------|
| `--bg` | `#121212` | `#ffffff` | Page background |
| `--fg` | `#ffffff` | `#1a1a1a` | Primary text color |
| `--border` | `rgba(255,255,255,0.1)` | `rgba(0,0,0,0.1)` | Border color |
| `--border-strong` | `rgba(255,255,255,0.2)` | `rgba(0,0,0,0.15)` | Stronger border for emphasis |
| `--border-hover` | `rgba(255,255,255,0.4)` | `rgba(0,0,0,0.3)` | Border color on hover |
| `--surface` | `#262626` | `#f0f0f0` | Card and surface backgrounds |
| `--surface-hover` | `rgba(255,255,255,0.1)` | `rgba(0,0,0,0.06)` | Surface hover state |
| `--muted` | `#c5cdd3` | `#6b7280` | Muted/secondary text |
| `--muted-fg` | `rgba(255,255,255,0.65)` | `rgba(0,0,0,0.5)` | Muted foreground |
| `--code-bg` | `rgba(255,255,255,0.075)` | `rgba(0,0,0,0.05)` | Inline code background |
| `--pre-bg` | `rgba(255,255,255,0.05)` | `rgba(0,0,0,0.03)` | Code block background |
| `--link` | `#6ea8fe` | `#0969da` | Link color |
| `--scrollbar` | `rgba(255,255,255,0.2)` | `rgba(0,0,0,0.2)` | Scrollbar thumb color |

### Example Override

```css
:root {
  --bg: #0d1117;
  --fg: #e6edf3;
  --link: #58a6ff;
  --surface: #161b22;
  --border: rgba(240, 246, 252, 0.1);
}

[data-theme="light"] {
  --bg: #f6f8fa;
  --fg: #24292f;
  --link: #0550ae;
  --surface: #ffffff;
  --border: rgba(0, 0, 0, 0.1);
}
```

## CSS Variables (Classic Template)

The Classic template uses a different set of variables focused on named semantic colors.

| Variable | Default | Description |
|----------|---------|-------------|
| `--font-family` | `'Open Sans', sans-serif` | Base font family |
| `--color-primary` | `#322d3c` | Primary brand color |
| `--color-secondary` | `#8cdc00` | Accent/highlight color |
| `--color-text` | `#322d3c` | Body text color |
| `--background` | `#ffffff` | Page background |
| `--home-background` | `#ffffff` | Home page background |
| `--header-background` | `#ffffff` | Header background |
| `--sidebar-background` | `#ffffff` | Sidebar background |
| `--sidebar-text` | `#322d3c` | Sidebar link color |
| `--sidebar-text-active` | `var(--color-secondary)` | Active sidebar link color |
| `--border` | `rgba(238,238,245,1)` | Border color |
| `--code` | `rgba(238,238,245,1)` | Code block background |

## Blockquote Alerts

Docula supports GitHub-style blockquote alerts via Writr's markdown plugins. Use the following syntax in any markdown file:

```md
> [!NOTE]
> Useful information that users should know.

> [!WARNING]
> Important information that could cause issues.

> [!CAUTION]
> Critical information about risks or destructive actions.
```

To style these alerts, add CSS rules targeting the `.markdown-alert` classes in your `variables.css`:

```css
.markdown-alert {
  border-left: 4px solid var(--border);
  border-radius: 8px;
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  background: var(--surface);
}

.markdown-alert-note {
  border-left-color: #4c8ef7;
}

.markdown-alert-warning {
  border-left-color: #f2b90c;
}

.markdown-alert-caution {
  border-left-color: #e5534b;
}
```

## Copy Code Button

The Modern template adds a copy-to-clipboard button to every code block. The button appears in the top-right corner on hover and shows a checkmark after copying. Because `variables.css` loads before the template stylesheet, these class overrides require a [partial template override](/docs/partial-templates) of `css/styles.css` to take effect:

| Class | Description |
|-------|-------------|
| `.copy-code-btn` | The button element (positioned absolute inside `pre`) |
| `pre:hover .copy-code-btn` | Controls visibility — the button fades in on hover |
| `.copy-code-btn:hover` | Hover state for the button itself |

```css
.copy-code-btn {
  background: var(--surface);
  color: var(--muted);
  border-radius: 6px;
  opacity: 0;
}

pre:hover .copy-code-btn {
  opacity: 1;
}

.copy-code-btn:hover {
  color: var(--fg);
}
```

## Image Lightbox

Clicking an image in docs or changelog opens a fullscreen lightbox overlay. Like the copy code button, these overrides require a [partial template override](/docs/partial-templates) of `css/styles.css`:

| Class | Description |
|-------|-------------|
| `.lightbox-overlay` | The fullscreen backdrop (default `rgba(0,0,0,0.8)`) |
| `.lightbox-overlay img` | The zoomed image (max 90vw × 90vh, rounded corners, shadow) |
| `.lightbox-close` | The close button in the top-right corner |

```css
.lightbox-overlay {
  background: rgba(0, 0, 0, 0.9);
}

.lightbox-overlay img {
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
}

.lightbox-close {
  color: rgba(255, 255, 255, 0.8);
}

.lightbox-close:hover {
  color: #fff;
}
```

## Logo and Favicon

Replace the default files in your site directory to use your own branding:

- `site/logo.png` (or `logo.svg`) -- displayed in the header and home page hero
- `site/favicon.ico` -- browser tab icon

If `site/favicon.ico` is not present, Docula automatically uses `site/logo.svg`
or `site/logo.png` (in that order) as the favicon.
