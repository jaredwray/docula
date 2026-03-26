---
title: API Reference
order: 15
---

# API Reference

Docula can generate an API Reference page from an OpenAPI (Swagger) specification. The spec is parsed at build time and rendered as a native, interactive API reference (inspired by [Scalar](https://github.com/scalar/scalar)) with grouped endpoints, method badges, schema tables, code examples, and search — all with no external dependencies. The page is available at `/api`.

## Auto-Detection

Docula automatically detects OpenAPI specs in your site directory — no configuration needed.

**Single spec** — place a `swagger.json` at `api/swagger.json`:

```
site
├───api
│   └───swagger.json
├───docs
├───logo.svg
├───favicon.ico
└───docula.config.mjs
```

**Multiple specs** — place each spec in its own subdirectory under `api/`:

```
site
├───api
│   ├───petstore
│   │   └───swagger.json
│   └───users
│       └───swagger.json
├───docs
└───docula.config.mjs
```

When multiple subdirectories are detected, each spec becomes a section on the API Reference page. The directory name is used as the display name (e.g., `petstore` becomes "Petstore").

## Explicit Configuration

For a single spec, set the `openApiUrl` option to point to any OpenAPI spec (local path or remote URL):

```js
export const options = {
  openApiUrl: '/api/swagger.json',
  // or a remote URL:
  // openApiUrl: 'https://petstore.swagger.io/v2/swagger.json',
};
```

## Multiple API Specs

Use the `openApiSpecs` option to configure multiple OpenAPI specs. All specs render as sections on a single `/api/` page, each with its own title, endpoints, and sidebar grouping:

```typescript
import type { DoculaOptions } from 'docula';

export const options: Partial<DoculaOptions> = {
  openApiSpecs: [
    { name: 'Petstore API', url: 'petstore/swagger.json', order: 1 },
    { name: 'Users API', url: 'users/swagger.json', order: 2 },
  ],
};
```

Each entry has the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Display name shown as the section heading |
| `url` | `string` | Path to the spec file (local path or remote URL) |
| `order` | `number?` | Sort order — lower numbers appear first. Specs without `order` appear last. |

## Priority

When multiple configuration methods are used, Docula applies them in this order (first match wins):

1. `openApiSpecs` — explicit multi-spec configuration
2. `openApiUrl` — explicit single-spec configuration
3. Auto-detection — `api/swagger.json` or `api/*/swagger.json`

## Spec Requirements

The file must be a valid OpenAPI 3.x or Swagger 2.0 JSON specification. A minimal example:

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "My API",
    "version": "1.0.0"
  },
  "paths": {}
}
```

## Authentication

Docula automatically parses `securitySchemes` from the OpenAPI spec's `components` section and displays them in an authorization panel on the API Reference page. Supported scheme types:

- **API Key** — sent as a header, query parameter, or cookie
- **HTTP Bearer** — sent as an `Authorization: Bearer <token>` header
- **OAuth2** — displays flow details (authorization code, client credentials, implicit, password)

When you use the "Try It" panel to test an endpoint, Docula injects the credentials automatically based on the selected scheme — as a header, query parameter, or cookie.

### Example

Add a `securitySchemes` section to your OpenAPI spec:

```json
{
  "components": {
    "securitySchemes": {
      "ApiKeyAuth": {
        "type": "apiKey",
        "in": "header",
        "name": "x-api-key"
      },
      "BearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
    }
  }
}
```

The authorization dropdown will be populated with these schemes. If no `securitySchemes` are defined, the authorization panel is hidden.

### Cookie-Based Authentication

If your spec defines an API Key scheme with `"in": "cookie"` and you have [`cookieAuth`](/docs/cookie-auth) configured, the API Reference page shows whether you are currently logged in. Requests made via "Try It" automatically include the cookie — no manual token entry is needed.
