import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { CacheableNet } from "@cacheable/net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Docula from "../src/docula.js";
import { DoculaOptions } from "../src/options.js";

const githubMockContributors = JSON.parse(
	fs.readFileSync(
		"./test/fixtures/data-mocks/github-contributors.json",
		"utf8",
	),
);
const githubMockReleases = JSON.parse(
	fs.readFileSync("./test/fixtures/data-mocks/github-releases.json", "utf8"),
);

const defaultOptions: DoculaOptions = new DoculaOptions({
	templatePath: "./custom-template",
	output: "./custom-dist",
	sitePath: "./custom-site",
	githubPath: "custom/repo",
	siteTitle: "Custom Title",
	siteDescription: "Custom Description",
	siteUrl: "https://custom-url.com",
});

vi.mock("@cacheable/net");

describe("docula", () => {
	afterEach(() => {
		// Reset the mock after each test
		vi.resetAllMocks();
	});
	beforeEach(() => {
		// biome-ignore lint/suspicious/noExplicitAny: test file
		(CacheableNet.prototype.get as any) = vi.fn(async (url: string) => {
			if (url.endsWith("releases")) {
				return { data: githubMockReleases };
			}

			if (url.endsWith("contributors")) {
				return { data: githubMockContributors };
			}

			// Default response or throw an error if you prefer
			return { data: {} };
		});
	});

	it("should be able to initialize", () => {
		const docula = new Docula();
		expect(docula).toBeDefined();
	});
	it("should be able to initialize with options", () => {
		const docula = new Docula(defaultOptions);
		expect(docula).toBeDefined();
	});
	it("should be able to get and set options", () => {
		const docula = new Docula(defaultOptions);
		expect(docula.options).toEqual(defaultOptions);
		const newOptions: DoculaOptions = new DoculaOptions({
			templatePath: "./new-template",
			output: "./new-dist",
			sitePath: "./new-site",
			githubPath: "new/repo",
			siteTitle: "New Title",
			siteDescription: "New Description",
			siteUrl: "https://new-url.com",
		});
		docula.options = newOptions;
		expect(docula.options).toEqual(newOptions);
	});
	it("should generate the site init files and folders", () => {
		const docula = new Docula(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = "";
		const temporarySitePath = "./temp-site";
		console.log = (message) => {
			consoleMessage = message;
		};

		try {
			docula.generateInit(temporarySitePath);

			expect(consoleMessage).toContain("docula initialized.");
			console.log = consoleLog;

			expect(fs.existsSync(temporarySitePath)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/docula.config.mjs`)).toEqual(
				true,
			);
			expect(fs.existsSync(`${temporarySitePath}/logo.png`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/favicon.ico`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/variables.css`)).toEqual(true);
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
		}
	});
	it("should generate the site init files and folders for javascript", () => {
		const docula = new Docula(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = "";
		const temporarySitePath = "./temp-site-js";
		console.log = (message) => {
			consoleMessage = message;
		};

		try {
			docula.generateInit(temporarySitePath);

			expect(consoleMessage).toContain("docula initialized.");
			console.log = consoleLog;

			expect(fs.existsSync(temporarySitePath)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/docula.config.mjs`)).toEqual(
				true,
			);
			expect(fs.existsSync(`${temporarySitePath}/logo.png`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/favicon.ico`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/variables.css`)).toEqual(true);
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
		}
	});
	it("should generate the site init files and folders for typescript", () => {
		const docula = new Docula(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = "";
		const temporarySitePath = "./temp-site-ts";
		console.log = (message) => {
			consoleMessage = message;
		};

		try {
			docula.generateInit(temporarySitePath, true);

			expect(consoleMessage).toContain("docula initialized.");
			expect(consoleMessage).toContain("docula.config.ts");
			console.log = consoleLog;

			expect(fs.existsSync(temporarySitePath)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/docula.config.ts`)).toEqual(
				true,
			);
			expect(fs.existsSync(`${temporarySitePath}/docula.config.mjs`)).toEqual(
				false,
			);
			expect(fs.existsSync(`${temporarySitePath}/logo.png`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/favicon.ico`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/variables.css`)).toEqual(true);

			// Verify the TypeScript config file contains expected content
			const configContent = fs.readFileSync(
				`${temporarySitePath}/docula.config.ts`,
				"utf8",
			);
			expect(configContent).toContain("import type");
			expect(configContent).toContain("DoculaOptions");
		} finally {
			fs.rmSync(temporarySitePath, { recursive: true });
		}
	});
	it("should get the package version", () => {
		const docula = new Docula(defaultOptions);
		const packageJson = fs.readFileSync("./package.json", "utf8");
		const packageObject = JSON.parse(packageJson) as { version: string };
		const packageVersion = docula.getVersion();
		expect(packageVersion).toBeDefined();
		expect(packageVersion).toEqual(packageObject.version);
	});
});

describe("docula execute", () => {
	it("should be able to execute with no parameters", async () => {
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = "test/fixtures/single-page-site";
		buildOptions.output = "test/fixtures/single-page-site/dist";
		buildOptions.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(buildOptions);
		const consoleLog = console.log;
		console.log = (_message) => {};

		process.argv = ["node", "docula"];
		await docula.execute(process);

		expect(fs.existsSync(buildOptions.output)).toEqual(true);

		await fs.promises.rm(buildOptions.output, { recursive: true });
		console.log = consoleLog;
	});
	it("should be able to build with typescript config", async () => {
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = "test/fixtures/single-page-site-ts";
		buildOptions.output = "test/fixtures/single-page-site-ts/dist";
		buildOptions.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(buildOptions);
		const consoleLog = console.log;
		console.log = (_message) => {};

		process.argv = ["node", "docula"];
		await docula.execute(process);

		expect(fs.existsSync(buildOptions.output)).toEqual(true);
		// Verify the config was loaded from TypeScript file
		expect(docula.configFileModule.options.siteTitle).toEqual(
			"Docula TypeScript",
		);

		await fs.promises.rm(buildOptions.output, { recursive: true });
		console.log = consoleLog;
	});
	it("should be able to execute with output parameter", async () => {
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = "test/fixtures/single-page-site";
		buildOptions.output = "test/fixtures/single-page-site/dist-foo";
		buildOptions.templatePath = "test/fixtures/template-example/";
		const realOutputPath = "test/fixtures/single-page-site/dist1";
		const docula = new Docula(buildOptions);
		const consoleLog = console.log;
		console.log = (_message) => {};

		process.argv = ["node", "docula", "-o", realOutputPath];
		await docula.execute(process);

		expect(fs.existsSync(realOutputPath)).toEqual(true);

		await fs.promises.rm(realOutputPath, { recursive: true });
		console.log = consoleLog;
	});
	it("should clean the output directory when --clean flag is set", async () => {
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = "test/fixtures/single-page-site";
		buildOptions.output = "test/fixtures/single-page-site/dist-clean";
		buildOptions.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(buildOptions);
		const consoleLog = console.log;
		console.log = (_message) => {};

		try {
			// First build without clean
			process.argv = ["node", "docula"];
			await docula.execute(process);
			expect(fs.existsSync(buildOptions.output)).toEqual(true);

			// Add a stale file
			fs.writeFileSync(`${buildOptions.output}/stale.txt`, "stale");
			expect(fs.existsSync(`${buildOptions.output}/stale.txt`)).toEqual(true);

			// Build again with --clean
			process.argv = ["node", "docula", "--clean"];
			await docula.execute(process);

			// Output should exist (rebuilt) but stale file should be gone
			expect(fs.existsSync(buildOptions.output)).toEqual(true);
			expect(fs.existsSync(`${buildOptions.output}/stale.txt`)).toEqual(false);
		} finally {
			await fs.promises.rm(buildOptions.output, {
				recursive: true,
				force: true,
			});
			console.log = consoleLog;
		}
	});
	it("should generate llms files during build for docs/api/changelog sites", async () => {
		const sourcePath = "test/fixtures/mega-page-site-no-home-page";
		const sitePath = "test/temp-llms-integration-site";
		const output = `${sitePath}/dist`;
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = sitePath;
		buildOptions.output = output;
		buildOptions.template = "modern";
		const docula = new Docula(buildOptions);
		const consoleLog = console.log;
		console.log = (_message) => {};

		fs.rmSync(sitePath, { recursive: true, force: true });
		fs.cpSync(sourcePath, sitePath, { recursive: true });
		fs.rmSync(`${sitePath}/docula.config.mjs`, { force: true });
		fs.rmSync(output, { recursive: true, force: true });

		try {
			process.argv = ["node", "docula"];
			await docula.execute(process);

			expect(fs.existsSync(`${output}/llms.txt`)).toBe(true);
			expect(fs.existsSync(`${output}/llms-full.txt`)).toBe(true);

			const llms = await fs.promises.readFile(`${output}/llms.txt`, "utf8");
			const llmsFull = await fs.promises.readFile(
				`${output}/llms-full.txt`,
				"utf8",
			);

			expect(llms).toContain("## Documentation");
			expect(llms).toContain("## API Reference");
			expect(llms).toContain("## Changelog");
			expect(llmsFull).toContain("## API Reference");
			expect(llmsFull).toContain('"openapi": "3.0.3"');
		} finally {
			await fs.promises.rm(sitePath, { recursive: true, force: true });
			console.log = consoleLog;
		}
	});
	it("should init based on the init command", async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = "./custom-site";
		let consoleMessage = "";
		const consoleLog = console.log;
		console.log = (message) => {
			consoleMessage = message;
		};

		process.argv = ["node", "docula", "init", "-s", sitePath];
		try {
			await docula.execute(process);
			expect(fs.existsSync(sitePath)).toEqual(true);
			expect(fs.existsSync(`${sitePath}/docula.config.mjs`)).toEqual(true);
			expect(consoleMessage).toContain("docula initialized.");
		} finally {
			await fs.promises.rm(sitePath, { recursive: true });
			console.log = consoleLog;
		}
	});
	it("should init with typescript config using --typescript flag", async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = "./custom-site-ts";
		let consoleMessage = "";
		const consoleLog = console.log;
		console.log = (message) => {
			consoleMessage = message;
		};

		process.argv = ["node", "docula", "init", "-s", sitePath, "--typescript"];
		try {
			await docula.execute(process);
			expect(fs.existsSync(sitePath)).toEqual(true);
			expect(fs.existsSync(`${sitePath}/docula.config.ts`)).toEqual(true);
			expect(fs.existsSync(`${sitePath}/docula.config.mjs`)).toEqual(false);
			expect(consoleMessage).toContain("docula initialized.");
			expect(consoleMessage).toContain("docula.config.ts");
		} finally {
			await fs.promises.rm(sitePath, { recursive: true });
			console.log = consoleLog;
		}
	});
	it("should print help command", async () => {
		const docula = new Docula(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = "";
		process.argv = ["node", "docula", "help"];
		console.log = (message) => {
			if (typeof message === "string" && message.includes("Usage:")) {
				consoleMessage = message;
			}
		};

		await docula.execute(process);
		expect(consoleMessage).toContain("Usage:");
		console.log = consoleLog;
	});
	it("should show version by the version command", async () => {
		const docula = new Docula(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = "";
		process.argv = ["node", "docula", "version"];
		console.log = (message) => {
			if (typeof message === "string") {
				consoleMessage = message;
			}
		};

		await docula.execute(process);
		expect(consoleMessage).toContain(".");
		console.log = consoleLog;
	});
	it("should serve the site", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = "test/fixtures/single-page-site/dist3";
		options.templatePath = "test/fixtures/template-example/";
		await fs.promises.mkdir(options.output, { recursive: true });
		const docula = new Docula(options);
		process.argv = ["node", "docula", "serve", "-p", "8181"];
		const consoleLog = console.log;
		console.log = (_message) => {};

		try {
			await docula.execute(process);
		} finally {
			await fs.promises.rm(options.output, { recursive: true });
			if (docula.server) {
				docula.server.close();
			}
		}

		console.log = consoleLog;
	});
	it("should serve the site and reset the server if exists", async () => {
		const options = new DoculaOptions();
		options.sitePath = path.join(
			process.cwd(),
			"test/fixtures/single-page-site",
		);
		options.output = path.join(
			process.cwd(),
			"test/fixtures/single-page-site/dist3",
		);
		await fs.promises.mkdir(options.output, { recursive: true });
		const docula = new Docula(options);
		process.argv = ["node", "docula", "serve", "-p", "8182"];
		const consoleLog = console.log;
		console.log = (_message) => {};

		try {
			await docula.serve(options);
			await docula.execute(process);
		} finally {
			await fs.promises.rm(options.output, { recursive: true });
			if (docula.server) {
				docula.server.close();
			}
		}

		console.log = consoleLog;
	});
	it("should serve the site on a specified port", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = "test/fixtures/single-page-site/dist3";
		await fs.promises.mkdir(options.output, { recursive: true });
		const docula = new Docula(options);
		process.argv = ["node", "docula", "serve", "-p", "8183"];
		const consoleLog = console.log;
		console.log = (_message) => {};

		try {
			await docula.execute(process);

			expect(docula.server).toBeDefined();
			const address = docula.server?.address() as { port: number };
			expect(address.port).toEqual(8183);
		} finally {
			await fs.promises.rm(options.output, { recursive: true });
			if (docula.server) {
				docula.server.close();
			}
		}

		console.log = consoleLog;
	});
	it("should serve the site on a specified port with --port flag", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = "test/fixtures/single-page-site/dist4";
		await fs.promises.mkdir(options.output, { recursive: true });
		const docula = new Docula(options);
		process.argv = ["node", "docula", "serve", "--port", "8184"];
		const consoleLog = console.log;
		console.log = (_message) => {};

		try {
			await docula.execute(process);

			expect(docula.server).toBeDefined();
			const address = docula.server?.address() as { port: number };
			expect(address.port).toEqual(8184);
		} finally {
			await fs.promises.rm(options.output, { recursive: true });
			if (docula.server) {
				docula.server.close();
			}
		}

		console.log = consoleLog;
	});
	it("should run onPrepare method if exists", async () => {
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = "test/fixtures/single-page-site-onprepare";
		buildOptions.output = "test/fixtures/single-page-site-onprepare/dist";
		buildOptions.templatePath = "test/fixtures/template-example/";

		const consoleLog = console.log;
		let consoleMessage = "";
		console.info = (message) => {
			consoleMessage = message as string;
		};

		const docula = new Docula(buildOptions);

		process.argv = ["node", "docula"];
		await docula.execute(process);

		expect(consoleMessage).toContain("onPrepare");

		await fs.promises.rm(buildOptions.output, { recursive: true });
		console.info = consoleLog;
	});
});

describe("docula watch", () => {
	it("should start watching when serve is called with --watch flag", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = "test/fixtures/single-page-site/dist-watch1";
		options.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(options);
		process.argv = ["node", "docula", "serve", "-p", "8190", "--watch"];
		const consoleLog = console.log;
		const messages: string[] = [];
		console.log = (message) => {
			if (typeof message === "string") {
				messages.push(message);
			}
		};

		try {
			await docula.execute(process);
			expect(docula.server).toBeDefined();
			expect(docula.watcher).toBeDefined();
			expect(
				messages.some((m) => m.includes("Watching for file changes...")),
			).toBe(true);
		} finally {
			if (docula.watcher) {
				docula.watcher.close();
			}

			if (docula.server) {
				docula.server.close();
			}

			await fs.promises.rm(options.output, { recursive: true, force: true });
			console.log = consoleLog;
		}
	});
	it("should not start watching when serve is called without --watch flag", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = "test/fixtures/single-page-site/dist-watch2";
		options.templatePath = "test/fixtures/template-example/";
		await fs.promises.mkdir(options.output, { recursive: true });
		const docula = new Docula(options);
		process.argv = ["node", "docula", "serve", "-p", "8191"];
		const consoleLog = console.log;
		console.log = (_message) => {};

		try {
			await docula.execute(process);
			expect(docula.server).toBeDefined();
			expect(docula.watcher).toBeUndefined();
		} finally {
			if (docula.server) {
				docula.server.close();
			}

			await fs.promises.rm(options.output, { recursive: true, force: true });
			console.log = consoleLog;
		}
	});
	it("should rebuild when a file changes in the watched directory", async () => {
		const tempSitePath = "test/temp-watch-site";
		const tempOutput = "test/temp-watch-output";

		// Copy fixture to temp directory
		fs.cpSync("test/fixtures/single-page-site", tempSitePath, {
			recursive: true,
		});

		const options = new DoculaOptions();
		options.sitePath = tempSitePath;
		options.output = tempOutput;
		options.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(options);
		const consoleLog = console.log;
		const messages: string[] = [];
		console.log = (message) => {
			if (typeof message === "string") {
				messages.push(message);
			}
		};

		try {
			const { DoculaBuilder } = await import("../src/builder.js");
			const builder = new DoculaBuilder(options);
			await builder.build();
			const watcher = docula.watch(options, builder);
			expect(watcher).toBeDefined();

			// Write a file to trigger the watcher
			fs.writeFileSync(`${tempSitePath}/test-change.txt`, "test content");

			// Wait for debounce + build
			await new Promise((resolve) => {
				setTimeout(resolve, 2000);
			});

			expect(messages.some((m) => m.includes("rebuilding..."))).toBe(true);
		} finally {
			if (docula.watcher) {
				docula.watcher.close();
			}

			// Small delay to let any in-flight build finish
			await new Promise((resolve) => {
				setTimeout(resolve, 500);
			});

			await fs.promises.rm(tempSitePath, { recursive: true, force: true });
			await fs.promises.rm(tempOutput, { recursive: true, force: true });
			console.log = consoleLog;
		}
	});
	it("should close existing watcher when watch is called again", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = "test/fixtures/single-page-site/dist-watch3";
		options.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(options);
		const consoleLog = console.log;
		console.log = (_message) => {};

		try {
			const { DoculaBuilder } = await import("../src/builder.js");
			const builder = new DoculaBuilder(options);

			const watcher1 = docula.watch(options, builder);
			expect(watcher1).toBeDefined();

			const watcher2 = docula.watch(options, builder);
			expect(watcher2).toBeDefined();
			expect(watcher2).not.toBe(watcher1);
		} finally {
			if (docula.watcher) {
				docula.watcher.close();
			}

			console.log = consoleLog;
		}
	});
	it("should ignore changes in the output directory", async () => {
		const tempSitePath = "test/temp-watch-ignore-output";
		const tempOutput = `${tempSitePath}/dist`;

		fs.cpSync("test/fixtures/single-page-site", tempSitePath, {
			recursive: true,
		});

		const options = new DoculaOptions();
		options.sitePath = tempSitePath;
		options.output = tempOutput;
		options.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(options);
		const consoleLog = console.log;
		const messages: string[] = [];
		console.log = (message) => {
			if (typeof message === "string") {
				messages.push(message);
			}
		};

		try {
			const { DoculaBuilder } = await import("../src/builder.js");
			const builder = new DoculaBuilder(options);
			await builder.build();

			// Clear messages from the initial build
			messages.length = 0;

			docula.watch(options, builder);

			// Write a file inside the output directory
			fs.mkdirSync(tempOutput, { recursive: true });
			fs.writeFileSync(`${tempOutput}/test-output.html`, "<html></html>");

			// Wait for debounce period
			await new Promise((resolve) => {
				setTimeout(resolve, 1000);
			});

			// Should NOT have triggered a rebuild
			expect(messages.some((m) => m.includes("rebuilding..."))).toBe(false);
		} finally {
			if (docula.watcher) {
				docula.watcher.close();
			}

			await new Promise((resolve) => {
				setTimeout(resolve, 500);
			});

			await fs.promises.rm(tempSitePath, { recursive: true, force: true });
			console.log = consoleLog;
		}
	});
	it("should handle rebuild errors gracefully", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.output = "test/fixtures/single-page-site/dist-watch4";
		options.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(options);
		const consoleLog = console.log;
		const consoleError = console.error;
		const messages: string[] = [];
		const errors: string[] = [];
		console.log = (message) => {
			if (typeof message === "string") {
				messages.push(message);
			}
		};
		console.error = (message) => {
			if (typeof message === "string") {
				errors.push(message);
			}
		};

		const tempSitePath = "test/temp-watch-error-site";
		fs.cpSync("test/fixtures/single-page-site", tempSitePath, {
			recursive: true,
		});
		options.sitePath = tempSitePath;

		try {
			const { DoculaBuilder } = await import("../src/builder.js");
			const builder = new DoculaBuilder(options);
			// Mock build to throw an error
			builder.build = async () => {
				throw new Error("Build error test");
			};

			docula.watch(options, builder);

			// Write a file to trigger the watcher
			fs.writeFileSync(`${tempSitePath}/trigger-error.txt`, "test");

			// Wait for debounce + error handling
			await new Promise((resolve) => {
				setTimeout(resolve, 1500);
			});

			expect(errors.some((m) => m.includes("Rebuild failed:"))).toBe(true);
		} finally {
			if (docula.watcher) {
				docula.watcher.close();
			}

			await fs.promises.rm(tempSitePath, { recursive: true, force: true });
			console.log = consoleLog;
			console.error = consoleError;
		}
	});
});

describe("docula config file", () => {
	it("should be able to load the config file", async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = "test/fixtures/multi-page-site";
		await docula.loadConfigFile(sitePath);
		expect(docula.configFileModule).toBeDefined();
		expect(docula.configFileModule.options).toBeDefined();
	});
	it("should be able to load a typescript config file", async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = "test/fixtures/single-page-site-ts";
		await docula.loadConfigFile(sitePath);
		expect(docula.configFileModule).toBeDefined();
		expect(docula.configFileModule.options).toBeDefined();
		expect(docula.configFileModule.options.siteTitle).toEqual(
			"Docula TypeScript",
		);
	});
	it("should prefer typescript config over mjs config", async () => {
		// Create a temporary fixture with both config files
		const tempPath = "./temp-both-configs";
		fs.mkdirSync(tempPath, { recursive: true });
		fs.writeFileSync(
			`${tempPath}/docula.config.ts`,
			`export const options = { siteTitle: 'TypeScript Config' };`,
		);
		fs.writeFileSync(
			`${tempPath}/docula.config.mjs`,
			`export const options = { siteTitle: 'MJS Config' };`,
		);

		try {
			const docula = new Docula(defaultOptions);
			await docula.loadConfigFile(tempPath);
			expect(docula.configFileModule).toBeDefined();
			expect(docula.configFileModule.options.siteTitle).toEqual(
				"TypeScript Config",
			);
		} finally {
			fs.rmSync(tempPath, { recursive: true });
		}
	});
	it("should handle non-existent site path gracefully", async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = "test/fixtures/non-existent-path";
		await docula.loadConfigFile(sitePath);
		expect(docula.configFileModule).toEqual({});
	});
	it("should load the config and set the options", async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = "test/fixtures/multi-page-site";
		await docula.loadConfigFile(sitePath);
		expect(docula.configFileModule).toBeDefined();
		expect(docula.configFileModule.options).toBeDefined();
		const consoleLog = console.log;
		let _consoleMessage = "";
		console.log = (message) => {
			if (typeof message === "string") {
				_consoleMessage = message;
			}
		};

		process.argv = ["node", "docula", "version"];
		await docula.execute(process);
		expect(docula.options.output).toEqual(
			path.resolve(process.cwd(), docula.configFileModule.options.output),
		);
		console.log = consoleLog;
	});
	it("should build docs at root when config sets homePage to false", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/mega-page-site-no-home-page";
		options.homePage = true;
		const docula = new Docula(options);
		const output = "test/temp-build-mega-no-home-test";
		const consoleLog = console.log;
		console.log = (_message) => {};

		try {
			process.argv = ["node", "docula", "-o", output];
			await docula.execute(process);

			expect(docula.configFileModule.options.homePage).toEqual(false);
			expect(docula.options.homePage).toEqual(false);
			const indexHtml = await fs.promises.readFile(
				`${output}/index.html`,
				"utf8",
			);
			expect(indexHtml).toContain("<title>docula -");
		} finally {
			await fs.promises.rm(output, { recursive: true, force: true });
			console.log = consoleLog;
		}
	});
	it("should load the config and test the onPrepare", async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = "test/fixtures/single-page-site-onprepare";
		await docula.loadConfigFile(sitePath);
		expect(docula.configFileModule).toBeDefined();
		expect(docula.configFileModule.options).toBeDefined();
		expect(docula.configFileModule.onPrepare).toBeDefined();
		const consoleLog = console.log;
		let consoleMessage = "";
		console.info = (message) => {
			if (typeof message === "string") {
				consoleMessage = message;
			}
		};

		await docula.configFileModule.onPrepare();
		expect(consoleMessage).toContain("onPrepare");
		console.info = consoleLog;
	});
	it("should load typescript config and test the onPrepare", async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = "test/fixtures/single-page-site-ts-onprepare";
		await docula.loadConfigFile(sitePath);
		expect(docula.configFileModule).toBeDefined();
		expect(docula.configFileModule.options).toBeDefined();
		expect(docula.configFileModule.onPrepare).toBeDefined();
		const consoleLog = console.log;
		let consoleMessage = "";
		console.info = (message) => {
			if (typeof message === "string") {
				consoleMessage = message;
			}
		};

		await docula.configFileModule.onPrepare();
		expect(consoleMessage).toContain("onPrepare TypeScript");
		console.info = consoleLog;
	});
	it("should throw error onPrepare", async () => {
		const docula = new Docula(defaultOptions);
		docula.options.sitePath = "test/fixtures/single-page-site-error";
		const consoleLog = console.log;
		let _consoleMessage = "";
		console.log = (message) => {
			if (typeof message === "string") {
				_consoleMessage = message;
			}
		};

		const consoleError = console.error;
		let _consoleErrorMessage = "";
		console.error = (message) => {
			if (typeof message === "string") {
				_consoleErrorMessage = message;
			}
		};

		process.argv = ["node", "docula", "version"];
		try {
			await docula.execute(process);
			expect.fail("Should have thrown an error");
		} catch (error) {
			expect(error).toBeDefined();
		}

		console.log = consoleLog;
		console.error = consoleError;
	});
});
