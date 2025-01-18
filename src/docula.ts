import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import fs from 'node:fs';
import handler from 'serve-handler';
import updateNotifier from 'update-notifier';
import {DoculaOptions} from './options.js';
import {DoculaConsole} from './console.js';
import {DoculaBuilder} from './builder.js';

export default class Docula {
	private _options: DoculaOptions = new DoculaOptions();
	private readonly _console: DoculaConsole = new DoculaConsole();
	private _configFileModule: any = {};
	private _server: http.Server | undefined;

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
	 * The config file module. This is the module that is loaded from the docula.config.mjs file
	 * @returns {any}
	 */
	public get configFileModule(): any {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return this._configFileModule;
	}

	/**
	 * Check for updates
	 * @returns {void}
	 */
	public checkForUpdates(): void {
		const packageJsonPath = path.join(process.cwd(), 'package.json');
		if (fs.existsSync(packageJsonPath)) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			updateNotifier({pkg: packageJson}).notify();
		}
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

		// Automatic detect singlePage option
		this.options.singlePage = this.isSinglePageWebsite(this.options.sitePath);

		// Update options
		if (consoleProcess.args.sitePath) {
			this.options.sitePath = consoleProcess.args.sitePath;
		}

		// Load the Config File
		await this.loadConfigFile(this.options.sitePath);

		// Parse the config file
		if (this._configFileModule.options) {
			this.options.parseOptions(this._configFileModule.options as Record<string, any>);
		}

		// Run the onPrepare function
		if (this._configFileModule.onPrepare) {
			try {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call
				await this._configFileModule.onPrepare(this.options);
			} catch (error) {
				this._console.error((error as Error).message);
			}
		}

		if (consoleProcess.args.output) {
			this.options.outputPath = consoleProcess.args.output;
		}

		switch (consoleProcess.command) {
			case 'init': {
				this.generateInit(this.options.sitePath);
				break;
			}

			case 'help': {
				this._console.printHelp();
				break;
			}

			case 'version': {
				this._console.log(this.getVersion());
				break;
			}

			case 'serve': {
				const builder = new DoculaBuilder(this.options);
				await builder.build();
				await this.serve(this.options);
				break;
			}

			default: {
				const builder = new DoculaBuilder(this.options);
				await builder.build();
				break;
			}
		}
	}

	/**
	 * Checks if the site is a single page website
	 * @param {string} sitePath
	 * @returns {boolean}
	 */
	public isSinglePageWebsite(sitePath: string): boolean {
		const documentationPath = `${sitePath}/docs`;
		if (!fs.existsSync(documentationPath)) {
			return true;
		}

		const files = fs.readdirSync(documentationPath);
		return files.length === 0;
	}

	/**
	 * Generate the init files
	 * @param {string} sitePath
	 * @returns {void}
	 */
	public generateInit(sitePath: string): void {
		// Check if the site path exists
		if (!fs.existsSync(sitePath)) {
			fs.mkdirSync(sitePath);
		}

		// Add the docula.config file based on js or ts
		const doculaConfigFile = './init/docula.config.mjs';
		fs.copyFileSync(doculaConfigFile, `${sitePath}/docula.config.mjs`);

		// Add in the image and favicon
		fs.copyFileSync('./init/logo.png', `${sitePath}/logo.png`);
		fs.copyFileSync('./init/favicon.ico', `${sitePath}/favicon.ico`);

		// Add in the variables file
		fs.copyFileSync('./init/variables.css', `${sitePath}/variables.css`);

		// Output the instructions
		this._console.log(`docula initialized. Please update the ${doculaConfigFile} file with your site information. In addition, you can replace the image, favicon, and stype the site with site.css file.`);
	}

	/**
	 * Get the version of the package
	 * @returns {string}
	 */
	public getVersion(): string {
		const packageJson = fs.readFileSync('./package.json', 'utf8');
		const packageObject = JSON.parse(packageJson) as {version: string};
		return packageObject.version;
	}

	/**
	 * Load the config file
	 * @param {string} sitePath
	 * @returns {Promise<void>}
	 */
	public async loadConfigFile(sitePath: string): Promise<void> {
		if (fs.existsSync(sitePath)) {
			const configFile = `${sitePath}/docula.config.mjs`;
			if (fs.existsSync(configFile)) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				this._configFileModule = await import(configFile);
			}
		}
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

		const {port} = options;
		const {outputPath} = options;

		const config = {
			public: outputPath,
		};

		this._server = http.createServer(async (request, response) =>
			/* c8 ignore next */
			handler(request, response, config),
		);

		this._server.listen(port, () => {
			this._console.log(`Docula 🦇 at http://localhost:${port}`);
		});

		return this._server;
	}
}

export {DoculaHelpers} from './helpers.js';
