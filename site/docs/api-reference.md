---
title: API Reference
order: 8
---

# API Reference

Docula can generate an API Reference page from an OpenAPI (Swagger) specification. The spec is parsed at build time and rendered as a native, interactive API reference (inspired by [Scalar](https://github.com/scalar/scalar)) with grouped endpoints, method badges, schema tables, code examples, and search — all with no external dependencies. The page is available at `/api`.

## Auto-Detection

If your site directory contains an `api/swagger.json` file, Docula will automatically detect it and generate the API Reference page — no configuration needed:

```
site
├───api
│   └───swagger.json
├───docs
├───logo.svg
├───favicon.ico
└───docula.config.mjs
```

## Explicit Configuration

You can also set the `openApiUrl` option in your config to point to any OpenAPI spec, either a local path or a remote URL:

```js
export const options = {
  openApiUrl: '/api/swagger.json',
  // or a remote URL:
  // openApiUrl: 'https://petstore.swagger.io/v2/swagger.json',
};
```

When `openApiUrl` is set explicitly, it takes priority over auto-detection.

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
