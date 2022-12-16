import axios from 'axios';
import fs from 'fs-extra';
import {type DoculaPlugin} from '../docula-plugin.js';
import {type DoculaOptions} from '../docula-options.js';

export class NpmPlugin implements DoculaPlugin {
	sitePath = 'site';
	dataPath = 'data';
	moduleName = 'docula';
	outputFile = 'npm.json';

	constructor(options: DoculaOptions) {
		if (options.sitePath) {
			this.sitePath = options.sitePath;
		}

		if (options.dataPath) {
			this.dataPath = options.dataPath;
		}

		if (options.npm) {
			if (options.npm.moduleName) {
				this.moduleName = options.npm.moduleName;
			} else {
				throw new Error('NPM module name must be defined in options.npm.moduleName');
			}

			if (options.npm.outputFile) {
				this.outputFile = options.npm.outputFile;
			}
		} else {
			throw new Error('NPM options must be defined in options.npm');
		}
	}

	async execute(): Promise<void> {
		const data = await this.getMonthlyDownloads();
		const path = `${this.sitePath}/${this.dataPath}`;
		const filePath = `${this.sitePath}/${this.dataPath}/${this.outputFile}`;
		await fs.ensureDir(path);
		await fs.writeFile(filePath, JSON.stringify(data, null, 2));
	}

	async getMonthlyDownloads(): Promise<any> {
		const url = `https://api.npmjs.org/downloads/point/last-month/${this.moduleName}`;
		const result = await axios.get(url);
		return result.data;
	}
}
