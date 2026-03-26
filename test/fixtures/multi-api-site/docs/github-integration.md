---
title: GitHub Integration
order: 13
---

# GitHub Integration

Docula can connect to a GitHub repository to display contributors and releases on your site. This integration is **optional** — if no `githubPath` is configured, the build skips all GitHub API calls and the GitHub-related UI elements are hidden.

## Enabling GitHub Integration

Set the `githubPath` option in your config file to your repository's `owner/repo` path:

```typescript
export const options = {
  githubPath: 'your-username/your-repo',
  // ...other options
};
```

When `githubPath` is set, Docula fetches:

- **Contributors** — displayed as an avatar facepile on the home page
- **Releases** — shown as recent release cards on the home page

A "View source on GitHub" corner link also appears on every page.

## Building Without GitHub

If you omit `githubPath` or leave it as an empty string, the build works normally without any GitHub features:

- No GitHub API requests are made
- The contributor and release sections are not rendered
- The GitHub corner link is hidden
- Changelog pages still work with file-based entries from `site/changelog/`

This is useful for projects not hosted on GitHub, internal documentation, or when you want faster builds without network calls.

## Release Changelog

When `githubPath` is configured, Docula can merge GitHub releases into your changelog. This is controlled by the `enableReleaseChangelog` option (enabled by default).

```typescript
export const options = {
  githubPath: 'your-username/your-repo',
  enableReleaseChangelog: true, // default
};
```

Release entries appear alongside any file-based changelog entries in `site/changelog/`. To disable this, set `enableReleaseChangelog: false`.

See [Changelog](/docs/changelog) for more details on changelog configuration.

## Rate Limits

GitHub's public API allows 60 requests per hour without authentication. For higher limits (5,000/hour), set a `GITHUB_TOKEN` environment variable.

See [GitHub Token](/docs/github-token) for setup instructions.
