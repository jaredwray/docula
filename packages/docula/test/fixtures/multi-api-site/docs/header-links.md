---
title: Header Links
order: 10
---

# Header Links

Docula supports adding custom links to the site header navigation. This is useful for linking to external resources like blogs, support pages, community forums, or any other URL you want easily accessible from every page.

## Configuration

Add the `headerLinks` option to your `docula.config.ts`:

```typescript
import type { DoculaOptions } from 'docula';

export const options: Partial<DoculaOptions> = {
  siteTitle: 'My Project',
  headerLinks: [
    { label: 'Blog', url: 'https://blog.example.com' },
    { label: 'Support', url: 'https://support.example.com' },
  ],
};
```

### Options

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `label` | `string` | Yes | - | Text displayed for the link |
| `url` | `string` | Yes | - | URL the link points to |
| `icon` | `string` | No | External link icon | Inline SVG string for a custom icon |

## How It Works

1. When `headerLinks` is configured, the links are rendered in the site header navigation after the built-in links (Documentation, API Reference, Changelog).
2. Links appear in both the desktop navigation bar and the mobile sidebar menu.
3. Each link opens in a new tab (`target="_blank"`) with `rel="noopener noreferrer"` for security.

### Custom Icons

By default each header link uses an external link icon. To override it, pass an inline SVG string as the `icon` property. For best results use 16x16 icons with `stroke="currentColor"` so they match the theme.

```typescript
headerLinks: [
  {
    label: 'Star',
    url: 'https://github.com/your-org/your-repo',
    icon: 'your svg code goes here',
  },
  { label: 'Blog', url: 'https://blog.example.com' },
],
```

Links without an `icon` property will use the default external link icon automatically.
