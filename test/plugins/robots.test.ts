import fs from 'fs-extra';
import {type DoculaOptions} from '../../src/docula-options.js';
import {RobotsPlugin} from '../../src/plugins/robots.js';
import {Config} from "../../src/config";

describe('Robots Plugin', () => {

	let config;
	beforeEach(() => {
	})

	afterEach(() =>{
		config = null;
		fs.rmSync('test/config.json');
	})

	it('init', () => {
		const jsonConfig = {
			plugins: ['robots'],
			robots: {
				allowedUrl: 'demo',
				disallowedUrl: 'admin',
			}
		}
		fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
		config = new Config('./test/config.json');
		const robots = new RobotsPlugin(config);
		expect(robots).toBeDefined();
	});


	it('execute and write out the robots file', async () => {
		const jsonConfig = {
			sitePath: 'test/site',
			plugins: ['robots'],
			robots: {
				allowedUrl: 'demo',
				disallowedUrl: 'admin',
			}

		}
		fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
		config = new Config('./test/config.json');
		const robots = new RobotsPlugin(config);
		await robots.execute();
		const filePath = 'test/site/robots.txt';
		expect(fs.existsSync(filePath)).toBe(true);
	});

	it('execute and write out the robots file 2', async () => {
		const jsonConfig = {
			sitePath: 'test/site',
			plugins: ['robots'],
			robots: {
				allowedUrl: 'demo',
				disallowedUrl: 'admin',
			}

		}
		fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
		config = new Config('./test/config.json');
		const robots = new RobotsPlugin(config);
		await robots.execute();
		const filePath = 'test/site/robots.txt';
		expect(fs.existsSync(filePath)).toBe(true);
	});
});
