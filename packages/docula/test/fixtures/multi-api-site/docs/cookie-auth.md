---
title: Cookie Auth
order: 16
---

# Cookie Auth

Docula supports cookie-based authentication that displays a **Log In** or **Log Out** button in the site header. Authentication state is determined by fetching a configurable URL with credentials included.

This is useful for documentation sites that sit on a different domain from their auth provider, such as cross-domain OAuth setups.

## Configuration

Add the `cookieAuth` option to your `docula.config.ts`:

```typescript
import type { DoculaOptions } from 'docula';

export const options: Partial<DoculaOptions> = {
  siteTitle: 'My Project',
  cookieAuth: {
    loginUrl: '/login',
    logoutUrl: '/api/auth/logout',
    authCheckUrl: 'https://api.example.com/me',
    authCheckUserPath: 'email',
  },
};
```

### Options

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `loginUrl` | `string` | Yes | - | URL to redirect to when "Log In" is clicked |
| `logoutUrl` | `string` | No | - | URL to redirect to on logout. If not set, the page reloads |
| `authCheckUrl` | `string` | No | - | URL to fetch (with `credentials: 'include'`) to determine if the user is logged in. A 2xx response means logged in |
| `authCheckMethod` | `string` | No | `'GET'` | HTTP method to use when fetching `authCheckUrl` |
| `authCheckUserPath` | `string` | No | - | Dot-notation path to extract a display name from the JSON response (e.g. `'email'`, `'user.name'`) |

## How It Works

1. When `cookieAuth` is configured, a **Log In** link and a hidden **Log Out** button are rendered in the site header (both desktop and mobile).
2. On page load, if `authCheckUrl` is set, client-side JavaScript fetches the URL with `credentials: 'include'` so that cookies are sent cross-domain.
3. If the response is 2xx, the user is considered logged in. The "Log In" link is hidden and the "Log Out" button is shown.
4. If the response is not 2xx or the fetch fails, the "Log In" link is shown and the "Log Out" button is hidden.

### Cached Auth State

To avoid a flash of incorrect UI on page load, Docula caches the auth state in `localStorage`. On subsequent page loads, the cached state is applied immediately (before the page body renders) and then refreshed in the background by fetching `authCheckUrl` again. This means:

- First visit: brief delay before auth UI appears (waiting for the fetch)
- Subsequent visits: auth UI appears instantly from cache, then silently updates if the state has changed

### User Display Name

If `authCheckUserPath` is set, Docula extracts a display name from the JSON response using dot-notation path traversal. For example, if the response is:

```json
{
  "email": "user@example.com"
}
```

Setting `authCheckUserPath` to `'email'` will display `user@example.com` in the header.

If the path doesn't resolve to a value, no name is displayed.

### Logout Behavior

**With `logoutUrl`**: Clicking "Log Out" redirects to the specified URL. Use this when your auth provider has a dedicated logout endpoint.

**Without `logoutUrl`**: Clicking "Log Out" reloads the page.

## API Reference Integration

When `cookieAuth` is configured and your OpenAPI spec defines an API Key security scheme with `"in": "cookie"`, the [API Reference](/docs/api-reference) page shows a login status indicator in the authorization panel. The selected authorization type and auth state are persisted in `localStorage` so they survive page refreshes. Requests made via the "Try It" panel automatically include cookies, so no manual token entry is needed.
