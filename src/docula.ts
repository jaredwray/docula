import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import handler from "serve-handler";
import updateNotifier from "update-notifier";
import doculaPkg from "../package.json" with { type: "json" };
import { DoculaBuilder } from "./builder.js";
import { DoculaConsole } from "./console.js";
import {
	doculaconfigmjs,
	doculaconfigts,
	faviconico,
	logopng,
} from "./init.js";
import { DoculaOptions } from "./options.js";
import { isSEA, resolveTemplatePath } from "./template-resolver.js";

export default class Docula {
	private _options: DoculaOptions = new DoculaOptions();
	private readonly _console: DoculaConsole = new DoculaConsole();
	// biome-ignore lint/suspicious/noExplicitAny: need to fix
	private _configFileModule: any = {};
	private _server: http.Server | undefined;
	private _watcher: fs.FSWatcher | undefined;

	public get console(): DoculaConsole {
		return this._console;
	}

	/**
	 * Initialize the Docula class
	 * @param {DoculaOptions} options
	 * @returns {void}
	 * @constructor
	 */
	constructor(options?: DoculaOptions) {
		if (options) {
			this._options = options;
		}

		if (this._options.quiet) {
			this._console.quiet = true;
		}
	}

	/**
	 * Get the options
	 * @returns {DoculaOptions}
	 */
	public get options(): DoculaOptions {
		return this._options;
	}

	/**
	 * Set the options
	 * @param {DoculaOptions} value
	 */
	public set options(value: DoculaOptions) {
		this._options = value;
	}

	/**
	 * The http server used to serve the site
	 * @returns {http.Server | undefined}
	 */
	public get server(): http.Server | undefined {
		return this._server;
	}

	/**
	 * The file watcher used in watch mode
	 * @returns {fs.FSWatcher | undefined}
	 */
	public get watcher(): fs.FSWatcher | undefined {
		return this._watcher;
	}

	/**
	 * The config file module. This is the module that is loaded from the docula.config.ts or docula.config.mjs file
	 * @returns {any}
	 */
	// biome-ignore lint/suspicious/noExplicitAny: need to fix
	public get configFileModule(): any {
		return this._configFileModule;
	}

	/**
	 * Remove the .cache directory inside the site path.
	 * Resolves the path and verifies it stays within sitePath to prevent
	 * path-traversal attacks.
	 * @param {string} sitePath
	 */
	private cleanCache(sitePath: string): void {
		const resolvedSitePath = path.resolve(sitePath);
		const cachePath = path.resolve(resolvedSitePath, ".cache");
		/* v8 ignore next 3 -- @preserve */
		if (
			!cachePath.startsWith(resolvedSitePath + path.sep) &&
			cachePath !== resolvedSitePath
		) {
			return;
		}

		/* v8 ignore next 3 -- @preserve */
		if (fs.existsSync(cachePath)) {
			fs.rmSync(cachePath, { recursive: true, force: true });
		}
	}

	/**
	 * Check for updates
	 * @returns {void}
	 */
	public checkForUpdates(): void {
		/* v8 ignore next -- @preserve */
		updateNotifier({ pkg: doculaPkg }).notify();
	}

	/**
	 * Is the execution process that runs the docula command
	 * @param {NodeJS.Process} process
	 * @returns {Promise<void>}
	 */
	public async execute(process: NodeJS.Process): Promise<void> {
		// Check for updates
		this.checkForUpdates();

		const consoleProcess = this._console.parseProcessArgv(process.argv);

		// Short-circuit for help — no config needed
		if (consoleProcess.command === "help") {
			this._console.printHelp();
			return;
		}

		// Update options
		if (consoleProcess.args.sitePath) {
			this.options.sitePath = consoleProcess.args.sitePath;
		}

		// Load the Config File
		await this.loadConfigFile(this.options.sitePath);

		// Parse the config file
		if (this._configFileModule.options) {
			this.options.parseOptions(
				// biome-ignore lint/suspicious/noExplicitAny: need to fix
				this._configFileModule.options as Record<string, any>,
			);
		}

		// Propagate quiet setting to console
		if (this.options.quiet) {
			this._console.quiet = true;
		}

		// Short-circuit for version — after config but before onPrepare
		if (consoleProcess.command === "version") {
			this._console.log(this.getVersion());
			return;
		}

		// Run the onPrepare function
		if (this._configFileModule.onPrepare) {
			try {
				await this._configFileModule.onPrepare(this.options, this._console);
			} catch (error) {
				this._console.error((error as Error).message);
			}
		}

		/* v8 ignore next -- @preserve */
		if (consoleProcess.args.template) {
			this.options.template = consoleProcess.args.template;
		}

		if (consoleProcess.args.templatePath) {
			this.options.templatePath = consoleProcess.args.templatePath;
		}

		if (consoleProcess.args.output) {
			this.options.output = consoleProcess.args.output;
		} else {
			// Recompute default output from current sitePath if not set by config
			const configOptions = this._configFileModule.options as
				| Record<string, unknown>
				| undefined;
			if (!configOptions?.output) {
				this.options.output = path.join(this.options.sitePath, "dist");
			}
		}

		if (
			consoleProcess.args.port !== undefined &&
			!Number.isNaN(consoleProcess.args.port)
		) {
			this.options.port = consoleProcess.args.port;
		}

		switch (consoleProcess.command) {
			case "init": {
				if (consoleProcess.args.typescript && consoleProcess.args.javascript) {
					this._console.error(
						"Cannot use both --typescript and --javascript flags. Please choose one.",
					);
					break;
				}

				let useTypeScript: boolean;
				if (consoleProcess.args.typescript) {
					useTypeScript = true;
				} else if (consoleProcess.args.javascript) {
					useTypeScript = false;
				} else {
					useTypeScript = this.detectTypeScript();
				}

				this.generateInit(this.options.sitePath, useTypeScript);
				break;
			}

			case "help": {
				this._console.printHelp();
				break;
			}

			case "version": {
				this._console.log(this.getVersion());
				break;
			}

			case "dev": {
				const devBuilder = await this.runBuild(consoleProcess.args.clean);
				this.watch(this.options, devBuilder);
				await this.serve(this.options);
				break;
			}

			case "start": {
				const startBuilder = await this.runBuild(consoleProcess.args.clean);
				if (consoleProcess.args.watch) {
					this.watch(this.options, startBuilder);
				}

				await this.serve(this.options);
				break;
			}

			case "serve": {
				if (consoleProcess.args.build || consoleProcess.args.watch) {
					const builder = await this.runBuild(consoleProcess.args.clean);
					if (consoleProcess.args.watch) {
						this.watch(this.options, builder);
					}
				}

				await this.serve(this.options);
				break;
			}

			case "download": {
				switch (consoleProcess.args.downloadTarget) {
					case "variables": {
						this.downloadVariables(
							this.options.sitePath,
							this.options.templatePath,
							this.options.template,
							consoleProcess.args.overwrite,
						);
						break;
					}

					case "template": {
						this.downloadTemplate(
							this.options.sitePath,
							this.options.templatePath,
							this.options.template,
							consoleProcess.args.overwrite,
						);
						break;
					}

					default: {
						this._console.error(
							"Please specify a download target: 'variables' or 'template'",
						);
					}
				}

				break;
			}

			default: {
				await this.runBuild(consoleProcess.args.clean);
				break;
			}
		}
	}

	private async runBuild(clean: boolean): Promise<DoculaBuilder> {
		/* v8 ignore next 4 -- @preserve */
		if (clean && fs.existsSync(this.options.output)) {
			fs.rmSync(this.options.output, { recursive: true, force: true });
		}

		/* v8 ignore next 3 -- @preserve */
		if (clean) {
			this.cleanCache(this.options.sitePath);
		}

		const builder = new DoculaBuilder(
			Object.assign(this.options, { console: this._console }),
		);
		/* v8 ignore next 4 -- @preserve */
		if (this._configFileModule.onReleaseChangelog) {
			builder.onReleaseChangelog = this._configFileModule.onReleaseChangelog;
		}

		await builder.build();
		return builder;
	}

	/**
	 * Detect if the current project uses TypeScript by checking for tsconfig.json
	 * @returns {boolean}
	 */
	public detectTypeScript(): boolean {
		return fs.existsSync(path.join(process.cwd(), "tsconfig.json"));
	}

	/**
	 * Generate the init files
	 * @param {string} sitePath
	 * @param {boolean} typescript - If true, generates docula.config.ts instead of docula.config.mjs
	 * @returns {void}
	 */
	public generateInit(sitePath: string, typescript = false): void {
		// Check if the site path exists
		/* v8 ignore next -- @preserve */
		if (!fs.existsSync(sitePath)) {
			fs.mkdirSync(sitePath);
		}

		// Add the docula.config file based on js or ts
		const configExtension = typescript ? "ts" : "mjs";
		const doculaConfigFile = `${sitePath}/docula.config.${configExtension}`;
		const doculaConfigFileBuffer = Buffer.from(
			typescript ? doculaconfigts : doculaconfigmjs,
			"base64",
		);
		fs.writeFileSync(doculaConfigFile, doculaConfigFileBuffer);

		// Add in the image and favicon
		const logoBuffer = Buffer.from(logopng, "base64");
		fs.writeFileSync(`${sitePath}/logo.png`, logoBuffer);
		const faviconBuffer = Buffer.from(faviconico, "base64");
		fs.writeFileSync(`${sitePath}/favicon.ico`, faviconBuffer);

		// Output the instructions
		this._console.log(
			`docula initialized. Please update the ${doculaConfigFile} file with your site information. In addition, you can replace the image and favicon.`,
		);
	}

	/**
	 * Copy the template's variables.css to the site directory.
	 * If the file already exists and overwrite is false, prints an error.
	 * @param {string} sitePath
	 * @param {string} templatePath
	 * @param {string} templateName
	 * @param {boolean} overwrite
	 * @returns {void}
	 */
	public downloadVariables(
		sitePath: string,
		templatePath: string,
		templateName: string,
		overwrite = false,
	): void {
		const resolvedTemplatePath = resolveTemplatePath(
			templatePath,
			templateName,
		);
		const source = path.join(resolvedTemplatePath, "css", "variables.css");
		const dest = path.join(sitePath, "variables.css");

		if (fs.existsSync(dest) && !overwrite) {
			this._console.error(
				`variables.css already exists at ${dest}. Use --overwrite to replace it.`,
			);
			return;
		}

		fs.copyFileSync(source, dest);
		this._console.success(`variables.css copied to ${dest}`);
	}

	/**
	 * Copy the full template directory to {sitePath}/templates/{outputName}/.
	 * If the directory already exists and overwrite is false, prints an error.
	 * @param {string} sitePath
	 * @param {string} templatePath
	 * @param {string} templateName
	 * @param {boolean} overwrite
	 * @returns {void}
	 */
	public downloadTemplate(
		sitePath: string,
		templatePath: string,
		templateName: string,
		overwrite = false,
	): void {
		const resolvedTemplatePath = resolveTemplatePath(
			templatePath,
			templateName,
		);
		const outputName = templatePath
			? path.basename(resolvedTemplatePath)
			: templateName;
		const dest = path.join(sitePath, "templates", outputName);

		if (fs.existsSync(dest) && !overwrite) {
			this._console.error(
				`Template already exists at ${dest}. Use --overwrite to replace it.`,
			);
			return;
		}

		fs.cpSync(resolvedTemplatePath, dest, { recursive: true, force: true });
		this._console.success(`Template copied to ${dest}`);
	}

	/**
	 * Get the version of the package
	 * @returns {string}
	 */
	public getVersion(): string {
		return doculaPkg.version;
	}

	/**
	 * Load the config file. Supports both .mjs and .ts config files.
	 * Priority: docula.config.ts > docula.config.mjs
	 * @param {string} sitePath
	 * @returns {Promise<void>}
	 */
	public async loadConfigFile(sitePath: string): Promise<void> {
		if (!fs.existsSync(sitePath)) {
			return;
		}

		const tsConfigFile = `${sitePath}/docula.config.ts`;
		const mjsConfigFile = `${sitePath}/docula.config.mjs`;

		// Check for TypeScript config first
		/* v8 ignore next -- @preserve */
		if (fs.existsSync(tsConfigFile)) {
			const absolutePath = path.resolve(tsConfigFile);
			const fileUrl = pathToFileURL(absolutePath).href;
			// In SEA mode, use native import() which supports .ts on Node 22.6+
			// Outside SEA, use jiti for broader compatibility
			if (isSEA()) {
				try {
					const mod = await import(fileUrl);
					this._configFileModule = mod.default ?? mod;
				} catch {
					throw new Error(
						"TypeScript config files require Node.js 22.6.0 or later when using the standalone binary. "
						+ "Please upgrade Node.js or use docula.config.mjs instead.",
					);
				}
			} else {
				const { createJiti } = await import("jiti");
				const jiti = createJiti(import.meta.url, {
					interopDefault: true,
				});
				this._configFileModule = await jiti.import(absolutePath);
			}

			return;
		}

		// Fall back to .mjs config
		/* v8 ignore next -- @preserve */
		if (fs.existsSync(mjsConfigFile)) {
			const absolutePath = path.resolve(mjsConfigFile);
			this._configFileModule = await import(pathToFileURL(absolutePath).href);
		}
	}

	/**
	 * Watch the site path for file changes and rebuild on change
	 * @param {DoculaOptions} options
	 * @param {DoculaBuilder} builder
	 * @returns {fs.FSWatcher}
	 */
	public watch(options: DoculaOptions, builder: DoculaBuilder): fs.FSWatcher {
		if (this._watcher) {
			this._watcher.close();
		}

		let debounceTimer: NodeJS.Timeout | undefined;
		let isBuilding = false;
		let pendingRebuild = false;
		const outputRelative = path.relative(options.sitePath, options.output);

		const runBuild = async (filename: string) => {
			isBuilding = true;
			this._console.info(`File changed: ${filename}, rebuilding...`);
			try {
				await builder.build();
				this._console.success(`Rebuild complete`);
				this._console.banner(
					`\uD83E\uDD87 at http://localhost:${options.port}`,
				);
			} catch (error) {
				this._console.error(`Rebuild failed: ${(error as Error).message}`);
			} finally {
				isBuilding = false;
				/* v8 ignore next 4 -- @preserve */
				if (pendingRebuild) {
					pendingRebuild = false;
					await runBuild("queued changes");
				}
			}
		};

		this._watcher = fs.watch(
			options.sitePath,
			{ recursive: true },
			(_eventType, filename) => {
				// Ignore changes in the output directory
				/* v8 ignore next 8 -- @preserve */
				if (
					filename &&
					outputRelative &&
					!outputRelative.startsWith("..") &&
					(String(filename) === outputRelative ||
						String(filename).startsWith(`${outputRelative}${path.sep}`))
				) {
					return;
				}

				// Ignore changes in the .cache directory (build manifest, cached data)
				if (
					filename &&
					(String(filename) === ".cache" ||
						String(filename).startsWith(`.cache${path.sep}`))
				) {
					return;
				}

				/* v8 ignore next 3 -- @preserve */
				if (isBuilding) {
					pendingRebuild = true;
					return;
				}

				/* v8 ignore next -- @preserve */
				if (debounceTimer) {
					clearTimeout(debounceTimer);
				}

				debounceTimer = setTimeout(async () => {
					await runBuild(String(filename));
				}, 300);
			},
		);

		this._console.info("Watching for file changes...");
		return this._watcher;
	}

	/**
	 * Serve the site based on the options (port and output path)
	 * @param {DoculaOptions} options
	 * @returns {Promise<void>}
	 */
	public async serve(options: DoculaOptions): Promise<http.Server> {
		if (this._server) {
			this._server.close();
		}

		const { port } = options;
		const { output } = options;

		/* v8 ignore next 3 -- @preserve */
		if (!fs.existsSync(output)) {
			fs.mkdirSync(output, { recursive: true });
		}

		const config = {
			public: output,
		};

		this._server = http.createServer(async (request, response) => {
			/* v8 ignore start -- @preserve */
			const start = Date.now();
			response.on("finish", () => {
				const duration = Date.now() - start;
				this._console.serverLog(
					request.method ?? "GET",
					request.url ?? "/",
					response.statusCode,
					duration,
				);
			});

			handler(request, response, config);
			/* v8 ignore stop -- @preserve */
		});

		this._server.listen(port, () => {
			this._console.banner(
				`\n  Docula \uD83E\uDD87 at http://localhost:${port}\n`,
			);
		});

		return this._server;
	}
}

export { Writr } from "writr";
export type { DoculaChangelogEntry } from "./builder.js";
export { DoculaConsole } from "./console.js";
export type {
	DoculaAIOptions,
	DoculaCacheOptions,
	DoculaCookieAuth,
	DoculaHeaderLink,
	DoculaOpenApiSpec,
} from "./options.js";
export { DoculaOptions } from "./options.js";
