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
	outputPath: "./custom-dist",
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
			outputPath: "./new-dist",
			sitePath: "./new-site",
			githubPath: "new/repo",
			siteTitle: "New Title",
			siteDescription: "New Description",
			siteUrl: "https://new-url.com",
		});
		docula.options = newOptions;
		expect(docula.options).toEqual(newOptions);
	});
	it("is a single page site or not", () => {
		const docula = new Docula(defaultOptions);
		const singlePageSite = "test/fixtures/single-page-site";
		const multiPageSite = "test/fixtures/multi-page-site";
		expect(docula.isSinglePageWebsite(singlePageSite)).toEqual(true);
		expect(docula.isSinglePageWebsite(multiPageSite)).toEqual(false);
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
		buildOptions.outputPath = "test/fixtures/single-page-site/dist";
		buildOptions.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(buildOptions);
		const consoleLog = console.log;
		console.log = (_message) => {};

		process.argv = ["node", "docula"];
		await docula.execute(process);

		expect(fs.existsSync(buildOptions.outputPath)).toEqual(true);

		await fs.promises.rm(buildOptions.outputPath, { recursive: true });
		console.log = consoleLog;
	});
	it("should be able to build with typescript config", async () => {
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = "test/fixtures/single-page-site-ts";
		buildOptions.outputPath = "test/fixtures/single-page-site-ts/dist";
		buildOptions.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(buildOptions);
		const consoleLog = console.log;
		console.log = (_message) => {};

		process.argv = ["node", "docula"];
		await docula.execute(process);

		expect(fs.existsSync(buildOptions.outputPath)).toEqual(true);
		// Verify the config was loaded from TypeScript file
		expect(docula.configFileModule.options.siteTitle).toEqual(
			"Docula TypeScript",
		);

		await fs.promises.rm(buildOptions.outputPath, { recursive: true });
		console.log = consoleLog;
	});
	it("should be able to execute with output parameter", async () => {
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = "test/fixtures/single-page-site";
		buildOptions.outputPath = "test/fixtures/single-page-site/dist-foo";
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
		options.outputPath = "test/fixtures/single-page-site/dist3";
		options.templatePath = "test/fixtures/template-example/";
		const docula = new Docula(options);
		process.argv = ["node", "docula", "serve", "-p", "8181"];
		const consoleLog = console.log;
		console.log = (_message) => {};

		try {
			await docula.execute(process);
		} finally {
			await fs.promises.rm(options.outputPath, { recursive: true });
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
		options.outputPath = path.join(
			process.cwd(),
			"test/fixtures/single-page-site/dist3",
		);
		const docula = new Docula(options);
		process.argv = ["node", "docula", "serve", "-p", "8182"];
		const consoleLog = console.log;
		console.log = (_message) => {};

		try {
			await docula.serve(options);
			await docula.execute(process);
		} finally {
			await fs.promises.rm(options.outputPath, { recursive: true });
			if (docula.server) {
				docula.server.close();
			}
		}

		console.log = consoleLog;
	});
	it("should serve the site on a specified port", async () => {
		const options = new DoculaOptions();
		options.sitePath = "test/fixtures/single-page-site";
		options.outputPath = "test/fixtures/single-page-site/dist3";
		const docula = new Docula(options);
		process.argv = ["node", "docula", "serve", "-p", "8183"];
		const consoleLog = console.log;
		console.log = (_message) => {};

		try {
			await docula.execute(process);

			expect(docula.server).toBeDefined();
		} finally {
			await fs.promises.rm(options.outputPath, { recursive: true });
			if (docula.server) {
				docula.server.close();
			}
		}

		console.log = consoleLog;
	});
	it("should run onPrepare method if exists", async () => {
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = "test/fixtures/single-page-site-onprepare";
		buildOptions.outputPath = "test/fixtures/single-page-site-onprepare/dist";
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

		await fs.promises.rm(buildOptions.outputPath, { recursive: true });
		console.info = consoleLog;
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
		expect(docula.options.outputPath).toEqual(
			docula.configFileModule.options.outputPath,
		);
		console.log = consoleLog;
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
