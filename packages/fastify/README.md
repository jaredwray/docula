# @docula/fastify

> Serve [docula](https://docula.org) docs, changelog, and API reference from a [Fastify](https://fastify.dev) app — on the fly.

`@docula/fastify` is a Fastify plugin that builds a docula site and serves it under
a prefix in your app. When `@fastify/swagger` is registered, it can generate the
**API reference directly from your live routes** — no separate build step, no spec
file to maintain.

## Install

```bash
npm install @docula/fastify fastify @fastify/static
# optional: live API reference from your running routes
npm install @fastify/swagger
```

`docula` is a dependency of the plugin; `fastify` and `@fastify/static` are required.
`@fastify/swagger` is an optional peer, only needed for `apiSpec: "swagger"`.

## Quick start

```ts
import Fastify from "fastify";
import fastifySwagger from "@fastify/swagger";
import doculaFastify from "@docula/fastify";

const app = Fastify();

// Register @fastify/swagger so the plugin can read your live routes.
await app.register(fastifySwagger, {
  openapi: { info: { title: "My API", version: "1.0.0" } },
});

app.get(
  "/users",
  { schema: { summary: "List users", tags: ["users"] } },
  async () => [{ id: 1 }],
);

await app.register(doculaFastify, {
  prefix: "/docs",
  doculaOptions: {
    sitePath: "./site",
    siteTitle: "My API Docs",
    siteUrl: "https://example.com",
  },
  apiSpec: "swagger", // build the API reference from the running routes
});

await app.listen({ port: 3000 });
// Docs:          http://localhost:3000/docs
// API reference: http://localhost:3000/docs/api   (rendered from your routes)
```

Your `sitePath` is a normal docula site directory (a `README.md`, a `docs/`
folder, a `changelog/` folder, etc.). See the
[docula documentation](https://docula.org) for how to author content.

## Options

| Option               | Type                              | Default                              | Description |
| -------------------- | --------------------------------- | ------------------------------------ | ----------- |
| `doculaOptions`      | `Partial<DoculaOptions>`          | `{}`                                 | docula site options (`sitePath`, `siteTitle`, `siteUrl`, `githubPath`, `template`, …). |
| `prefix`             | `string`                          | `"/docs"`                            | URL prefix the site is mounted under. |
| `output`             | `string`                          | OS temp dir (removed on close)        | Directory docula builds into and `@fastify/static` serves. |
| `buildOnStart`       | `boolean`                         | `true`                               | Build the site during server startup (`onReady`). |
| `watch`              | `boolean`                         | `false`                              | Watch `sitePath` and rebuild on change (dev mode). |
| `watchDebounce`      | `number`                          | `300`                                | Debounce window for watch rebuilds (ms). |
| `apiSpec`            | `"swagger" \| "options" \| "none"`| `"swagger"` if `@fastify/swagger` is present, else `"none"` | How to source the API reference. |
| `exposeRebuildRoute` | `boolean`                         | `false`                              | Register `POST {prefix}/_rebuild` to trigger a rebuild. |

`doculaOptions` accepts every [`DoculaOptions`](https://docula.org/docs/configuration)
field. By default the plugin sets `baseUrl` to `prefix` (so generated links resolve
under the mount) and `quiet` to `true`; both can be overridden via `doculaOptions`.

## API reference modes (`apiSpec`)

- **`"swagger"`** — read the live OpenAPI spec from `fastify.swagger()` and render
  it. Requires `@fastify/swagger`. The spec is written to
  `{sitePath}/{apiPath}/swagger.json` before each build.
- **`"options"`** — use `doculaOptions.openApiUrl` as-is (a remote URL or docula's
  multi-spec array). The plugin does not inject anything.
- **`"none"`** — no API reference is generated.

## How it works

The plugin uses a **build-then-serve** model. On startup (`onReady`) it runs the
docula build into `output`, then serves that directory with `@fastify/static`
under `prefix`. Because the build runs after all your routes are registered, the
`"swagger"` mode captures the complete API surface of the running app.

The output directory is served at `prefix`, mirroring docula's own `serve`
command, so `GET {prefix}/`, `{prefix}/docs/`, `{prefix}/api/`, and
`{prefix}/changelog/` resolve to the matching pages.

## `fastify.docula`

The plugin decorates the instance with a controller:

```ts
app.docula.builder;  // the underlying docula DoculaBuilder
app.docula.options;  // the fully-resolved DoculaOptions
app.docula.output;   // the resolved output directory being served
await app.docula.rebuild(); // re-inject the spec (swagger mode) and rebuild
```

With `exposeRebuildRoute: true`, `POST {prefix}/_rebuild` calls `rebuild()` and
returns `{ ok: true }`.

## Watch mode

In development, set `watch: true` to rebuild automatically when files in
`sitePath` change (debounced by `watchDebounce`). The watcher is closed when the
Fastify instance closes.

## Caveats

- The build runs at startup; the first request after boot waits for it to finish
  (unless `buildOnStart: false`, in which case call `rebuild()` first).
- In `"swagger"` mode the live spec is written into
  `{sitePath}/{apiPath}/swagger.json`.
- When `output` is not provided, a unique directory in the OS temp dir is used and
  removed when the server closes.

## License

MIT © [Jared Wray](https://github.com/jaredwray)
