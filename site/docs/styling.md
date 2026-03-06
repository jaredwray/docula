---
title: Styling
order: 11
---

# Alert, Info, Warn Styling

Docula uses Writr's GitHub-flavored Markdown plugins, including GitHub-style blockquote alerts. Use the alert syntax directly in Markdown:

```md
> [!NOTE]
> Info: Remember to configure your GitHub token for private repos.

> [!WARNING]
> Warn: This action cannot be undone.

> [!CAUTION]
> Alert: Rotate your secrets immediately.
```

These render with the `remark-github-blockquote-alert` classes (like `.markdown-alert` and `.markdown-alert-note`). If you want GitHub-like styling, copy the plugin's CSS into your `site/variables.css` or template stylesheet (for example, from `remark-github-blockquote-alert/alert.css`), or add your own overrides:

```css
.markdown-alert {
  border-left: 4px solid var(--border);
  border-radius: 8px;
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  background: var(--background);
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
