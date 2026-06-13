import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import fastifyStatic from "@fastify/static";
import { DoculaBuilder, DoculaOptions } from "docula";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";

/**
 * How the API reference specification is sourced.
 * - `"swagger"`: read the live spec from `fastify.swagger()` (requires `@fastify/swagger`).
 * - `"options"`: use `doculaOptions.openApiUrl` as provided.
 * - `"none"`: do not render an API reference.
 */
export type DoculaApiSpecMode = "swagger" | "options" | "none";

/**
 * Options for the `@docula/fastify` plugin.
 */
export type DoculaFastifyOptions = {
	/**
	 * docula site options. `siteTitle`, `siteDescription`, and `siteUrl` fall back
	 * to docula's defaults when omitted.
	 */
	doculaOptions?: Partial<DoculaOptions>;
	/** URL prefix to mount the documentation site under. Default: `"/docs"`. */
	prefix?: string;
	/**
	 * Directory docula builds into and `@fastify/static` serves. Default: a unique
	 * directory inside the OS temp directory (removed on server close).
	 */
	output?: string;
	/** Build the site during plugin startup. Default: `true`. */
	buildOnStart?: boolean;
	/** Watch `doculaOptions.sitePath` and rebuild on change. Default: `false`. */
	watch?: boolean;
	/** Debounce window for watch rebuilds, in milliseconds. Default: `300`. */
	watchDebounce?: number;
	/**
	 * How to source the API reference. Default: `"swagger"` when `@fastify/swagger`
	 * is registered, otherwise `"none"`.
	 */
	apiSpec?: DoculaApiSpecMode;
	/** Register a `POST {prefix}/_rebuild` route that triggers a rebuild. Default: `false`. */
	exposeRebuildRoute?: boolean;
};

/** Controller decorated onto the Fastify instance as `fastify.docula`. */
export type DoculaFastifyController = {
	/** The underlying docula builder. */
	builder: DoculaBuilder;
	/** The fully-resolved docula options. */
	options: DoculaOptions;
	/** The resolved output directory served by `@fastify/static`. */
	output: string;
	/** Re-inject the API spec (when applicable) and rebuild the site. */
	rebuild: () => Promise<void>;
};

type FastifyWithSwagger = FastifyInstance & {
	swagger?: () => unknown;
};

declare module "fastify" {
	interface FastifyInstance {
		docula: DoculaFastifyController;
	}
}

const DEFAULT_PREFIX = "/docs";
const DEFAULT_DEBOUNCE = 300;

/**
 * The raw (unwrapped) docula Fastify plugin. Most consumers should import the
 * default export of `@docula/fastify`, which wraps this with `fastify-plugin`.
 */
export const doculaFastifyPlugin: FastifyPluginAsync<
	DoculaFastifyOptions
> = async (fastify, options) => {
	const prefix = options.prefix ?? DEFAULT_PREFIX;
	const buildOnStart = options.buildOnStart ?? true;
	const watch = options.watch ?? false;
	const watchDebounce = options.watchDebounce ?? DEFAULT_DEBOUNCE;
	const exposeRebuildRoute = options.exposeRebuildRoute ?? false;

	const hasSwagger =
		typeof (fastify as FastifyWithSwagger).swagger === "function";
	const apiSpecMode: DoculaApiSpecMode =
		options.apiSpec ?? (hasSwagger ? "swagger" : "none");

	if (apiSpecMode === "swagger" && !hasSwagger) {
		throw new Error(
			'@docula/fastify: apiSpec is "swagger" but @fastify/swagger is not registered. Register @fastify/swagger before this plugin, or set apiSpec to "options" or "none".',
		);
	}

	// Build the resolved docula options. `output` is assigned directly onto the
	// instance (not passed through the constructor) because parseOptions joins it
	// with process.cwd(), which would mangle an absolute path.
	const userDocula = options.doculaOptions ?? {};
	const doculaInput: Record<string, unknown> = {
		...userDocula,
		quiet: userDocula.quiet ?? true,
		// Default baseUrl to the mount prefix so generated links resolve correctly.
		baseUrl: userDocula.baseUrl ?? prefix,
	};
	if (apiSpecMode === "none") {
		doculaInput.openApiUrl = undefined;
	}
	const resolvedOptions = new DoculaOptions(doculaInput);
	const output = path.resolve(
		options.output ?? path.join(os.tmpdir(), `docula-fastify-${process.pid}`),
	);
	resolvedOptions.output = output;
	const ownsOutput = options.output === undefined;

	if (apiSpecMode === "swagger") {
		// Point docula at the injected spec via the array form. That branch resolves
		// the spec relative to apiPath (without the baseUrl prefix), so the local file
		// is found regardless of the baseUrl we set to match the mount prefix.
		resolvedOptions.openApiUrl = [
			{ name: "API Reference", url: "swagger.json" },
		];
	}

	const builder = new DoculaBuilder(resolvedOptions);

	const injectApiSpec = async (): Promise<void> => {
		if (apiSpecMode !== "swagger") {
			return;
		}
		const spec = (fastify as FastifyWithSwagger).swagger?.();
		const apiDir = path.join(resolvedOptions.sitePath, resolvedOptions.apiPath);
		await fs.promises.mkdir(apiDir, { recursive: true });
		await fs.promises.writeFile(
			path.join(apiDir, "swagger.json"),
			JSON.stringify(spec, null, 2),
		);
	};

	const rebuild = async (): Promise<void> => {
		await injectApiSpec();
		await builder.build();
	};

	// The served directory must exist before @fastify/static validates `root`.
	await fs.promises.mkdir(output, { recursive: true });

	await fastify.register(fastifyStatic, {
		root: output,
		prefix,
		index: ["index.html"],
		// Keep the default wildcard route so pages built after registration (and on
		// rebuild) are resolved dynamically per request rather than globbed up front.
		wildcard: true,
		// Avoid clashing with other @fastify/static registrations in the host app.
		decorateReply: false,
	});

	fastify.decorate("docula", {
		builder,
		options: resolvedOptions,
		output,
		rebuild,
	} satisfies DoculaFastifyController);

	if (exposeRebuildRoute) {
		fastify.post(`${prefix}/_rebuild`, async (_request, reply) => {
			await rebuild();
			return reply.send({ ok: true });
		});
	}

	// Debounced watch rebuilds (dev mode).
	let watcher: fs.FSWatcher | undefined;
	let debounceTimer: NodeJS.Timeout | undefined;
	let building = false;
	let pending = false;

	const triggerRebuild = (): void => {
		if (building) {
			pending = true;
			return;
		}
		building = true;
		rebuild()
			.catch((error: unknown) => {
				fastify.log.error(error);
			})
			.finally(() => {
				building = false;
				if (pending) {
					pending = false;
					triggerRebuild();
				}
			});
	};

	const scheduleRebuild = (): void => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		debounceTimer = setTimeout(triggerRebuild, watchDebounce);
	};

	if (watch) {
		watcher = fs.watch(
			resolvedOptions.sitePath,
			{ recursive: true },
			(_event, filename) => {
				if (!filename) {
					return;
				}
				const name = filename.toString();
				// Ignore generated artifacts to avoid rebuild loops.
				if (name.includes(".cache") || name.includes("swagger.json")) {
					return;
				}
				scheduleRebuild();
			},
		);
	}

	fastify.addHook("onReady", async () => {
		if (buildOnStart) {
			await rebuild();
		}
	});

	fastify.addHook("onClose", async () => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		watcher?.close();
		if (ownsOutput) {
			await fs.promises.rm(output, { recursive: true, force: true });
		}
	});
};
