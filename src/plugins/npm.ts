import axios from 'axios';
import fs from 'fs-extra';
import type {DoculaPlugin, Options, Schema, Runtime} from '../docula-plugin.js';
import type {Config} from '../config.js';

export type NpmConfig = {
	moduleName: string;
};

export class NpmPlugin implements DoculaPlugin {
	static schema: Schema = {
		type: 'object',
		required: ['moduleName'],
		properties: {
			moduleName: {type: 'string'},
		},
	};

	readonly options: Options = {
		dataPath: '_data',
		moduleName: '',
		outputFile: 'npm.json',
		sitePath: '',
	};

	runtime: Runtime = 'before';

	constructor(config: Config) {
		this.options.sitePath = config.originPath;
		const {moduleName} = config.pluginConfig.npm as NpmConfig;
		this.options.moduleName = moduleName;
	}

	async execute(): Promise<void> {
		const data = await this.getMonthlyDownloads();
		const path = `${this.options.sitePath}/${this.options.dataPath}`;
		const filePath = `${this.options.sitePath}/${this.options.dataPath}/${this.options.outputFile}`;
		await fs.ensureDir(path);
		await fs.writeFile(filePath, JSON.stringify(data, null, 2));
	}

	async getMonthlyDownloads(): Promise<any> {
		const url = `https://api.npmjs.org/downloads/point/last-month/${this.options.moduleName}`;
		const result = await axios.get(url);
		return result.data;
	}
}
