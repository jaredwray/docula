/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs';
import {
	afterEach, beforeEach, expect, it, describe, vi,
} from 'vitest';
import axios from 'axios';
import Docula, {DoculaHelpers} from '../src/docula.js';
import {DoculaOptions} from '../src/options.js';
import githubMockContributors from './fixtures/data-mocks/github-contributors.json';
import githubMockReleases from './fixtures/data-mocks/github-releases.json';

const defaultOptions: DoculaOptions = new DoculaOptions({
	templatePath: './custom-template',
	outputPath: './custom-dist',
	sitePath: './custom-site',
	githubPath: 'custom/repo',
	siteTitle: 'Custom Title',
	siteDescription: 'Custom Description',
	siteUrl: 'https://custom-url.com',
});

vi.mock('axios');

describe('docula', () => {
	afterEach(() => {
		// Reset the mock after each test
		vi.resetAllMocks();
	});
	beforeEach(() => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		(axios.get as any).mockImplementation(async (url: string) => {
			if (url.endsWith('releases')) {
				return {data: githubMockReleases};
			}

			if (url.endsWith('contributors')) {
				return {data: githubMockContributors};
			}

			// Default response or throw an error if you prefer
			return {data: {}};
		});
	});

	it('should be able to initialize', () => {
		const docula = new Docula();
		expect(docula).toBeDefined();
	});
	it('should be able to initialize with options', () => {
		const docula = new Docula(defaultOptions);
		expect(docula).toBeDefined();
	});
	it('should be able to get and set options', () => {
		const docula = new Docula(defaultOptions);
		expect(docula.options).toEqual(defaultOptions);
		const newOptions: DoculaOptions = new DoculaOptions({
			templatePath: './new-template',
			outputPath: './new-dist',
			sitePath: './new-site',
			githubPath: 'new/repo',
			siteTitle: 'New Title',
			siteDescription: 'New Description',
			siteUrl: 'https://new-url.com',
		});
		docula.options = newOptions;
		expect(docula.options).toEqual(newOptions);
	});
	it('should be able to get the helpers', () => {
		const docula = new Docula(defaultOptions);
		const doculaHelpers = new DoculaHelpers();
		expect(doculaHelpers).toBeDefined();
	});
	it('should be able to get the helpers via static', () => {
		const docula = new Docula(defaultOptions);
		const doculaHelpers = new DoculaHelpers();
		expect(doculaHelpers.createDoc).toBeDefined();
	});
	it('is a single page site or not', () => {
		const docula = new Docula(defaultOptions);
		const singlePageSite = 'test/fixtures/single-page-site';
		const multiPageSite = 'test/fixtures/multi-page-site';
		expect(docula.isSinglePageWebsite(singlePageSite)).toEqual(true);
		expect(docula.isSinglePageWebsite(multiPageSite)).toEqual(false);
	});
	it('should generate the site init files and folders', () => {
		const docula = new Docula(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = '';
		const temporarySitePath = './temp-site';
		console.log = message => {
			consoleMessage = message;
		};

		try {
			docula.generateInit(temporarySitePath);

			expect(consoleMessage).toContain('docula initialized.');
			console.log = consoleLog;

			expect(fs.existsSync(temporarySitePath)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/docula.config.mjs`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/logo.png`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/favicon.ico`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/variables.css`)).toEqual(true);
		} finally {
			fs.rmSync(temporarySitePath, {recursive: true});
		}
	});
	it('should generate the site init files and folders for javascript', () => {
		const docula = new Docula(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = '';
		const temporarySitePath = './temp-site-js';
		console.log = message => {
			consoleMessage = message;
		};

		try {
			docula.generateInit(temporarySitePath);

			expect(consoleMessage).toContain('docula initialized.');
			console.log = consoleLog;

			expect(fs.existsSync(temporarySitePath)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/docula.config.mjs`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/logo.png`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/favicon.ico`)).toEqual(true);
			expect(fs.existsSync(`${temporarySitePath}/variables.css`)).toEqual(true);
		} finally {
			fs.rmSync(temporarySitePath, {recursive: true});
		}
	});
	it('should get the package version', () => {
		const docula = new Docula(defaultOptions);
		const packageJson = fs.readFileSync('./package.json', 'utf8');
		const packageObject = JSON.parse(packageJson) as {version: string};
		const packageVersion = docula.getVersion();
		expect(packageVersion).toBeDefined();
		expect(packageVersion).toEqual(packageObject.version);
	});
});

describe('docula execute', () => {
	it('should be able to execute with no parameters', async () => {
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = 'test/fixtures/single-page-site';
		buildOptions.outputPath = 'test/fixtures/single-page-site/dist';
		buildOptions.templatePath = 'test/fixtures/template-example/';
		const docula = new Docula(buildOptions);
		const consoleLog = console.log;
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		console.log = message => {};

		process.argv = ['node', 'docula'];
		await docula.execute(process);

		expect(fs.existsSync(buildOptions.outputPath)).toEqual(true);

		await fs.promises.rm(buildOptions.outputPath, {recursive: true});
		console.log = consoleLog;
	});
	it('should be able to execute with output parameter', async () => {
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = 'test/fixtures/single-page-site';
		buildOptions.outputPath = 'test/fixtures/single-page-site/dist-foo';
		buildOptions.templatePath = 'test/fixtures/template-example/';
		const realOutputPath = 'test/fixtures/single-page-site/dist1';
		const docula = new Docula(buildOptions);
		const consoleLog = console.log;
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		console.log = message => {};

		process.argv = ['node', 'docula', '-o', realOutputPath];
		await docula.execute(process);

		expect(fs.existsSync(realOutputPath)).toEqual(true);

		await fs.promises.rm(realOutputPath, {recursive: true});
		console.log = consoleLog;
	});
	it('should init based on the init command', async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = './custom-site';
		let consoleMessage = '';
		const consoleLog = console.log;
		console.log = message => {
			consoleMessage = message;
		};

		process.argv = ['node', 'docula', 'init', '-s', sitePath];
		try {
			await docula.execute(process);
			expect(fs.existsSync(sitePath)).toEqual(true);
			expect(fs.existsSync(`${sitePath}/docula.config.mjs`)).toEqual(true);
			expect(consoleMessage).toContain('docula initialized.');
		} finally {
			await fs.promises.rm(sitePath, {recursive: true});
			console.log = consoleLog;
		}
	});
	it('should print help command', async () => {
		const docula = new Docula(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = '';
		process.argv = ['node', 'docula', 'help'];
		console.log = message => {
			if (typeof message === 'string' && message.includes('Usage:')) {
				consoleMessage = message;
			}
		};

		await docula.execute(process);
		expect(consoleMessage).toContain('Usage:');
		console.log = consoleLog;
	});
	it('should show version by the version command', async () => {
		const docula = new Docula(defaultOptions);
		const consoleLog = console.log;
		let consoleMessage = '';
		process.argv = ['node', 'docula', 'version'];
		console.log = message => {
			if (typeof message === 'string') {
				consoleMessage = message;
			}
		};

		await docula.execute(process);
		expect(consoleMessage).toContain('.');
		console.log = consoleLog;
	});
	it('should serve the site', async () => {
		const options = new DoculaOptions();
		options.sitePath = 'test/fixtures/single-page-site';
		options.outputPath = 'test/fixtures/single-page-site/dist3';
		options.templatePath = 'test/fixtures/template-example/';
		const docula = new Docula(options);
		process.argv = ['node', 'docula', 'serve', '-p', '8181'];
		const consoleLog = console.log;
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		console.log = message => {};

		try {
			await docula.execute(process);
		} finally {
			await fs.promises.rm(options.outputPath, {recursive: true});
			if (docula.server) {
				docula.server.close();
			}
		}

		console.log = consoleLog;
	});
	it('should serve the site and reset the server if exists', async () => {
		const options = new DoculaOptions();
		options.sitePath = path.join(process.cwd(), 'test/fixtures/single-page-site');
		options.outputPath = path.join(process.cwd(), 'test/fixtures/single-page-site/dist3');
		const docula = new Docula(options);
		process.argv = ['node', 'docula', 'serve', '-p', '8182'];
		const consoleLog = console.log;
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		console.log = message => {};

		try {
			await docula.serve(options);
			await docula.execute(process);
		} finally {
			await fs.promises.rm(options.outputPath, {recursive: true});
			if (docula.server) {
				docula.server.close();
			}
		}

		console.log = consoleLog;
	});
	it('should serve the site on a specified port', async () => {
		const options = new DoculaOptions();
		options.sitePath = 'test/fixtures/single-page-site';
		options.outputPath = 'test/fixtures/single-page-site/dist3';
		const docula = new Docula(options);
		process.argv = ['node', 'docula', 'serve', '-p', '8183'];
		const consoleLog = console.log;
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		console.log = message => {};

		try {
			await docula.execute(process);

			expect(docula.server).toBeDefined();
		} finally {
			await fs.promises.rm(options.outputPath, {recursive: true});
			if (docula.server) {
				docula.server.close();
			}
		}

		console.log = consoleLog;
	});
	it('should run onPrepare method if exists', async () => {
		const buildOptions = new DoculaOptions();
		buildOptions.sitePath = 'test/fixtures/single-page-site-onprepare';
		buildOptions.outputPath = 'test/fixtures/single-page-site-onprepare/dist';
		buildOptions.templatePath = 'test/fixtures/template-example/';

		const consoleLog = console.log;
		let consoleMessage = '';
		console.info = message => {
			consoleMessage = message as string;
		};

		const docula = new Docula(buildOptions);

		process.argv = ['node', 'docula'];
		await docula.execute(process);

		expect(consoleMessage).toContain('onPrepare');

		await fs.promises.rm(buildOptions.outputPath, {recursive: true});
		console.info = consoleLog;
	});
});

describe('docula config file', () => {
	it('should be able to load the config file', async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = 'test/fixtures/multi-page-site';
		await docula.loadConfigFile(sitePath);
		expect(docula.configFileModule).toBeDefined();
		expect(docula.configFileModule.options).toBeDefined();
	});
	it('should load the config and set the options', async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = 'test/fixtures/multi-page-site';
		await docula.loadConfigFile(sitePath);
		expect(docula.configFileModule).toBeDefined();
		expect(docula.configFileModule.options).toBeDefined();
		const consoleLog = console.log;
		let consoleMessage = '';
		console.log = message => {
			if (typeof message === 'string') {
				consoleMessage = message;
			}
		};

		process.argv = ['node', 'docula', 'version'];
		await docula.execute(process);
		expect(docula.options.outputPath).toEqual(docula.configFileModule.options.outputPath);
		console.log = consoleLog;
	});
	it('should load the config and test the onPrepare', async () => {
		const docula = new Docula(defaultOptions);
		const sitePath = 'test/fixtures/single-page-site-onprepare';
		await docula.loadConfigFile(sitePath);
		expect(docula.configFileModule).toBeDefined();
		expect(docula.configFileModule.options).toBeDefined();
		expect(docula.configFileModule.onPrepare).toBeDefined();
		const consoleLog = console.log;
		let consoleMessage = '';
		console.info = message => {
			if (typeof message === 'string') {
				consoleMessage = message;
			}
		};

		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		await docula.configFileModule.onPrepare();
		expect(consoleMessage).toContain('onPrepare');
		console.info = consoleLog;
	});
	it('should throw error onPrepare', async () => {
		const docula = new Docula(defaultOptions);
		docula.options.sitePath = 'test/fixtures/single-page-site-error';
		const consoleLog = console.log;
		let consoleMessage = '';
		console.log = message => {
			if (typeof message === 'string') {
				consoleMessage = message;
			}
		};

		const consoleError = console.error;
		let consoleErrorMessage = '';
		console.error = message => {
			if (typeof message === 'string') {
				consoleErrorMessage = message;
			}
		};

		process.argv = ['node', 'docula', 'version'];
		try {
			await docula.execute(process);
			expect.fail('Should have thrown an error');
		} catch (error) {
			expect(error).toBeDefined();
		}

		console.log = consoleLog;
		console.error = consoleError;
	});
});
