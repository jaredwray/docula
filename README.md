<p align="center">
  <a href="https://docula.org"><img src="https://docula.org/logo.svg" alt="docula" height="120" /></a>
</p>

<h1 align="center">Docula</h1>

<p align="center">Beautiful Website for Your Projects.</p>

---

Docula generates a beautiful documentation website from your project's markdown,
changelog, and OpenAPI specs — with zero configuration required. This repository
is a [pnpm](https://pnpm.io) monorepo containing docula and its official
integrations.

## Packages

| Package | Description |
| ------- | ----------- |
| [`docula`](./packages/docula) | The core static-site generator and CLI. |
| [`@docula/fastify`](./packages/fastify) | A [Fastify](https://fastify.dev) plugin that serves docula docs, changelog, and API reference on the fly — including an API reference generated from your live routes via `@fastify/swagger`. |

Full documentation lives at **[docula.org](https://docula.org)**.

## Development

This repo uses pnpm workspaces. **Use pnpm, not npm.**

```bash
pnpm install      # install all workspace dependencies
pnpm build        # build every package (topological order)
pnpm test         # lint + run every package's tests with coverage
```

To work on a single package, use a filter:

```bash
pnpm --filter docula build
pnpm --filter @docula/fastify test:unit
```

The docula documentation site (built with docula itself) lives in [`site/`](./site)
and can be built with `pnpm website:build`.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## License

MIT © [Jared Wray](https://github.com/jaredwray)
