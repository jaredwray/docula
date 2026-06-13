import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import fastifySwagger from "@fastify/swagger";
import { DoculaBuilder } from "docula";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import doculaFastify from "../src/index.js";

const FIXTURE = "test/fixtures/docs-site";

let counter = 0;
const openApps: FastifyInstance[] = [];
const tempPaths: string[] = [];

function cloneSite(): string {
	const dir = `test/temp/site-${counter++}`;
	fs.rmSync(dir, { recursive: true, force: true });
	fs.cpSync(FIXTURE, dir, { recursive: true });
	tempPaths.push(dir);
	return dir;
}

function tempOutput(): string {
	const dir = `test/temp/out-${counter++}`;
	tempPaths.push(dir);
	return dir;
}

function track(app: FastifyInstance): FastifyInstance {
	openApps.push(app);
	return app;
}

async function registerWithSwagger(app: FastifyInstance): Promise<void> {
	await app.register(fastifySwagger, {
		openapi: { info: { title: "Test API", version: "1.0.0" } },
	});
	app.get(
		"/widgets",
		{ schema: { summary: "List widgets", tags: ["widgets"] } },
		async () => [{ id: 1 }],
	);
}

type WatchListener = (event: string, filename: string | null) => void;

function spyWatch(): {
	getListener: () => WatchListener;
	close: ReturnType<typeof vi.fn>;
} {
	let listener: WatchListener | undefined;
	const close = vi.fn();
	const fakeWatcher = { close } as unknown as fs.FSWatcher;
	vi.spyOn(fs, "watch").mockImplementation(((...args: unknown[]) => {
		listener = args[args.length - 1] as WatchListener;
		return fakeWatcher;
	}) as unknown as typeof fs.watch);
	return {
		getListener: () => {
			if (!listener) {
				throw new Error("fs.watch was not called");
			}
			return listener;
		},
		close,
	};
}

afterEach(async () => {
	vi.useRealTimers();
	for (const app of openApps.splice(0)) {
		await app.close().catch(() => {});
	}
	vi.restoreAllMocks();
	for (const dir of tempPaths.splice(0)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

describe("@docula/fastify", () => {
	it("serves the built docs site under the prefix", async () => {
		const site = cloneSite();
		const app = track(Fastify());
		await app.register(doculaFastify, {
			output: tempOutput(),
			doculaOptions: {
				sitePath: site,
				siteTitle: "Fixture Docs",
				siteUrl: "https://example.com",
			},
		});
		await app.ready();

		const home = await app.inject({ url: "/docs/" });
		expect(home.statusCode).toBe(200);
		expect(home.headers["content-type"]).toContain("text/html");
		expect(home.body).toContain("Fixture Docs");

		const docs = await app.inject({ url: "/docs/docs/" });
		expect(docs.statusCode).toBe(200);

		// No swagger registered -> apiSpec defaults to "none".
		const api = await app.inject({ url: "/docs/api/" });
		expect(api.statusCode).toBe(404);
		const missing = await app.inject({ url: "/docs/missing" });
		expect(missing.statusCode).toBe(404);

		// baseUrl defaults to the prefix; no API spec configured.
		expect(app.docula.options.baseUrl).toBe("/docs");
		expect(app.docula.options.openApiUrl).toBeUndefined();
	});

	it("renders the API reference from the live @fastify/swagger spec", async () => {
		const site = cloneSite();
		const app = track(Fastify());
		await registerWithSwagger(app);
		await app.register(doculaFastify, {
			output: tempOutput(),
			doculaOptions: { sitePath: site, siteUrl: "https://example.com" },
		});
		await app.ready();

		// The live spec is written into the site so docula can render it.
		expect(fs.existsSync(path.join(site, "api", "swagger.json"))).toBe(true);
		expect(Array.isArray(app.docula.options.openApiUrl)).toBe(true);

		const api = await app.inject({ url: "/docs/api/" });
		expect(api.statusCode).toBe(200);
		expect(api.body).toContain("/widgets");

		const spec = await app.inject({ url: "/docs/api/swagger.json" });
		expect(spec.statusCode).toBe(200);
	});

	it("rejects when apiSpec is 'swagger' but @fastify/swagger is missing", async () => {
		const app = track(Fastify());
		// Not awaited: awaiting register would surface the throw here instead of at ready().
		void app.register(doculaFastify, {
			apiSpec: "swagger",
			output: tempOutput(),
			doculaOptions: { sitePath: cloneSite() },
		});
		await expect(app.ready()).rejects.toThrow(
			/@fastify\/swagger is not registered/,
		);
	});

	it("passes openApiUrl through in 'options' mode without injecting a spec", async () => {
		const site = cloneSite();
		const app = track(Fastify());
		await app.register(doculaFastify, {
			apiSpec: "options",
			buildOnStart: false,
			output: tempOutput(),
			doculaOptions: {
				sitePath: site,
				openApiUrl: "https://example.com/openapi.json",
			},
		});
		await app.ready();

		expect(app.docula.options.openApiUrl).toBe(
			"https://example.com/openapi.json",
		);
		expect(fs.existsSync(path.join(site, "api", "swagger.json"))).toBe(false);
	});

	it("suppresses a provided openApiUrl in 'none' mode", async () => {
		const app = track(Fastify());
		await app.register(doculaFastify, {
			apiSpec: "none",
			buildOnStart: false,
			output: tempOutput(),
			doculaOptions: {
				sitePath: cloneSite(),
				openApiUrl: "https://example.com/openapi.json",
			},
		});
		await app.ready();

		expect(app.docula.options.openApiUrl).toBeUndefined();
	});

	it("defers the build with buildOnStart:false and rebuilds via the route", async () => {
		const site = cloneSite();
		const app = track(Fastify());
		await app.register(doculaFastify, {
			buildOnStart: false,
			exposeRebuildRoute: true,
			output: tempOutput(),
			doculaOptions: { sitePath: site, siteUrl: "https://example.com" },
		});
		await app.ready();

		const before = await app.inject({ url: "/docs/" });
		expect(before.statusCode).toBe(404);

		const rebuilt = await app.inject({ method: "POST", url: "/docs/_rebuild" });
		expect(rebuilt.statusCode).toBe(200);
		expect(rebuilt.json()).toEqual({ ok: true });

		const after = await app.inject({ url: "/docs/" });
		expect(after.statusCode).toBe(200);
	});

	it("decorates fastify.docula with builder, options, output and rebuild", async () => {
		const buildSpy = vi
			.spyOn(DoculaBuilder.prototype, "build")
			.mockResolvedValue(undefined);
		const output = tempOutput();
		const app = track(Fastify());
		await app.register(doculaFastify, {
			buildOnStart: false,
			output,
			doculaOptions: { sitePath: cloneSite() },
		});
		await app.ready();

		expect(app.docula.builder).toBeInstanceOf(DoculaBuilder);
		expect(app.docula.output).toBe(path.resolve(output));
		expect(typeof app.docula.rebuild).toBe("function");
		expect(buildSpy).not.toHaveBeenCalled();

		await app.docula.rebuild();
		expect(buildSpy).toHaveBeenCalledTimes(1);
	});

	it("uses a temp output directory by default and removes it on close", async () => {
		const app = track(Fastify());
		await app.register(doculaFastify, {
			buildOnStart: false,
			doculaOptions: { sitePath: cloneSite() },
		});
		await app.ready();

		const { output } = app.docula;
		expect(output.startsWith(path.resolve(os.tmpdir()))).toBe(true);
		expect(output).toContain("docula-fastify-");
		expect(fs.existsSync(output)).toBe(true);

		await app.close();
		openApps.splice(0); // already closed
		expect(fs.existsSync(output)).toBe(false);
	});

	it("honors a custom prefix and defaults baseUrl to it", async () => {
		const app = track(Fastify());
		await app.register(doculaFastify, {
			prefix: "/manual",
			buildOnStart: false,
			output: tempOutput(),
			doculaOptions: { sitePath: cloneSite() },
		});
		await app.ready();

		expect(app.docula.options.baseUrl).toBe("/manual");
	});

	it("preserves an explicitly provided baseUrl", async () => {
		const app = track(Fastify());
		await app.register(doculaFastify, {
			prefix: "/docs",
			buildOnStart: false,
			output: tempOutput(),
			doculaOptions: { sitePath: cloneSite(), baseUrl: "/custom" },
		});
		await app.ready();

		expect(app.docula.options.baseUrl).toBe("/custom");
	});

	it("applies docula defaults when doculaOptions is omitted", async () => {
		const app = track(Fastify());
		await app.register(doculaFastify, {
			buildOnStart: false,
			output: tempOutput(),
		});
		await app.ready();

		expect(app.docula.options.siteTitle).toBe("docula");
		expect(app.docula.options.baseUrl).toBe("/docs");
	});

	it("rebuilds on file changes in watch mode and ignores generated files", async () => {
		const watch = spyWatch();
		const buildSpy = vi
			.spyOn(DoculaBuilder.prototype, "build")
			.mockResolvedValue(undefined);
		const app = track(Fastify());
		await app.register(doculaFastify, {
			watch: true,
			watchDebounce: 50,
			buildOnStart: false,
			output: tempOutput(),
			doculaOptions: { sitePath: cloneSite() },
		});
		await app.ready();
		expect(fs.watch).toHaveBeenCalledTimes(1);

		vi.useFakeTimers();
		const listener = watch.getListener();

		listener("change", "docs/index.md");
		expect(buildSpy).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(50);
		expect(buildSpy).toHaveBeenCalledTimes(1);

		// Generated / empty filenames are ignored (no extra rebuilds).
		listener("change", ".cache/manifest.json");
		listener("change", "api/swagger.json");
		listener("change", null);
		await vi.advanceTimersByTimeAsync(50);
		expect(buildSpy).toHaveBeenCalledTimes(1);

		// A debounce timer that is already pending is reset by a later change.
		listener("change", "a.md");
		listener("change", "b.md");
		await vi.advanceTimersByTimeAsync(50);
		expect(buildSpy).toHaveBeenCalledTimes(2);

		vi.useRealTimers();
		await app.close();
		openApps.splice(0);
		expect(watch.close).toHaveBeenCalledTimes(1);
	});

	it("coalesces overlapping rebuilds while a build is in flight", async () => {
		const watch = spyWatch();
		let resolveBuild: (() => void) | undefined;
		const buildSpy = vi
			.spyOn(DoculaBuilder.prototype, "build")
			.mockImplementation(
				() =>
					new Promise<void>((resolve) => {
						resolveBuild = resolve;
					}),
			);
		const app = track(Fastify());
		await app.register(doculaFastify, {
			watch: true,
			watchDebounce: 10,
			buildOnStart: false,
			output: tempOutput(),
			doculaOptions: { sitePath: cloneSite() },
		});
		await app.ready();

		vi.useFakeTimers();
		const listener = watch.getListener();

		listener("change", "a.md");
		await vi.advanceTimersByTimeAsync(10);
		expect(buildSpy).toHaveBeenCalledTimes(1);

		// A change while the first build is in flight is coalesced into one rebuild.
		listener("change", "b.md");
		await vi.advanceTimersByTimeAsync(10);
		expect(buildSpy).toHaveBeenCalledTimes(1);

		resolveBuild?.();
		await vi.advanceTimersByTimeAsync(0);
		expect(buildSpy).toHaveBeenCalledTimes(2);

		resolveBuild?.();
		await vi.advanceTimersByTimeAsync(0);
		vi.useRealTimers();
	});

	it("logs an error when a watch rebuild fails", async () => {
		const watch = spyWatch();
		const buildSpy = vi
			.spyOn(DoculaBuilder.prototype, "build")
			.mockRejectedValue(new Error("boom"));
		const app = track(Fastify());
		await app.register(doculaFastify, {
			watch: true,
			watchDebounce: 5,
			buildOnStart: false,
			output: tempOutput(),
			doculaOptions: { sitePath: cloneSite() },
		});
		const errorSpy = vi.spyOn(app.log, "error").mockImplementation(() => {});
		await app.ready();

		vi.useFakeTimers();
		watch.getListener()("change", "x.md");
		await vi.advanceTimersByTimeAsync(5);
		vi.useRealTimers();

		expect(buildSpy).toHaveBeenCalledTimes(1);
		expect(errorSpy).toHaveBeenCalled();
	});
});
