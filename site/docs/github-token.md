---
title: GitHub Token
order: 13
---

Docula fetches contributor and release data from the GitHub API during builds. A token is optional but recommended to avoid rate limits and to support private repositories.

## Why Use a Token

Without a token, GitHub's API limits requests to **60 per hour** per IP address. With a token, the limit increases to **5,000 per hour**. If you build frequently or your site has many releases and contributors, you will likely hit the unauthenticated limit.

A token is also **required** to access private repositories.

## Setting the Token

Docula reads the `GITHUB_TOKEN` environment variable. You can set it in several ways:

### Inline with the CLI

```bash
GITHUB_TOKEN=ghp_yourtoken npx docula build
```

### Export in your shell

```bash
export GITHUB_TOKEN=ghp_yourtoken
npx docula build
```

### Using a `.env` file

Add the token to a `.env` file in your project root and load it with a tool like `dotenv`:

```
GITHUB_TOKEN=ghp_yourtoken
```

Make sure `.env` is listed in your `.gitignore` so the token is never committed.

### GitHub Actions

In CI, use the built-in `GITHUB_TOKEN` secret or a personal access token:

```yaml
- name: Build docs
  run: npx docula build
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Required Permissions

Docula only reads public repository data (contributors and releases). A **fine-grained personal access token** with read-only access to the target repository is sufficient. No write permissions are needed.

To create a token:

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Generate a new token with **read-only** repository access
3. Copy the token and set it as `GITHUB_TOKEN`

## What Happens Without a Token

Docula still works without a token. Contributors and releases are fetched from the public API. If the rate limit is exceeded, these sections will be empty in the build output but the rest of the site builds normally.
