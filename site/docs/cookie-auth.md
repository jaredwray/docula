---
title: Cookie Auth
order: 14
---

# Cookie Auth

Docula supports cookie-based authentication that displays a **Log In** or **Log Out** button in the site header. When a JWT cookie is detected in the browser, the button switches to "Log Out"; otherwise it shows "Log In".

This is useful for documentation sites that are gated behind an OAuth provider, such as `docs.hyphen.ai`.

## Configuration

Add the `cookieAuth` option to your `docula.config.ts`:

```typescript
import type { DoculaOptions } from 'docula';

export const options: Partial<DoculaOptions> = {
  siteTitle: 'My Project',
  cookieAuth: {
    loginUrl: '/login',
    cookieName: 'auth_token',
  },
};
```

### Options

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `loginUrl` | `string` | Yes | - | URL to redirect to when "Log In" is clicked |
| `cookieName` | `string` | No | `'token'` | Name of the JWT cookie to check |
| `logoutUrl` | `string` | No | - | URL to redirect to on logout. If not set, the cookie is cleared and the page reloads |

## How It Works

1. When `cookieAuth` is configured, a **Log In** link and a hidden **Log Out** button are rendered in the site header (both desktop and mobile).
2. On page load, client-side JavaScript checks whether the configured cookie exists.
3. If the cookie is present, the "Log In" link is hidden and the "Log Out" button is shown.
4. If the cookie is not present, the "Log In" link is shown and the "Log Out" button is hidden.

### Logout Behavior

**With `logoutUrl`**: Clicking "Log Out" redirects to the specified URL. Use this when your auth provider has a dedicated logout endpoint.

```typescript
cookieAuth: {
  loginUrl: '/login',
  cookieName: 'session',
  logoutUrl: '/api/auth/logout',
},
```

**Without `logoutUrl`**: Clicking "Log Out" clears the cookie and reloads the page.

```typescript
cookieAuth: {
  loginUrl: '/login',
  cookieName: 'session',
},
```
