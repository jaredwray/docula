import fs from 'fs-extra';
import {RobotsPlugin} from '../../src/plugins/robots.js';
import {Config} from "../../src/config";

describe('Robots Plugin', () => {
	let config;
	let defaultConfig = {
		outputPath: 'test/site',
		plugins: ['robots'],
	}

	afterEach(() =>{
		config = null;
		fs.rmSync('test/config.json');
	})

	it('init', () => {
		const jsonConfig = {
			...defaultConfig,
			robots: {
				allowedUrl: '/demo',
				disallowedUrl: '/admin',
			}
		}
		fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
		config = new Config('./test/config.json');
		const robots = new RobotsPlugin(config);
		expect(robots).toBeDefined();
	});


	it('execute and write out the robots file', async () => {
		const jsonConfig = {
			...defaultConfig,
			robots: {
				allowedUrl: '/demo',
				disallowedUrl: '/admin',
			}

		}
		fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
		config = new Config('./test/config.json');
		const robots = new RobotsPlugin(config);
		await robots.execute();
		const filePath = 'test/site/robots.txt';
		expect(fs.existsSync(filePath)).toBe(true);
		fs.rmSync('test/site/robots.txt');
	});

	it('execute and write out the robots file with allowed url only', async () => {
		const jsonConfig = {
			outputPath: 'test/site',
			plugins: ['robots'],
			robots: {
				allowedUrl: '/demo',
			}

		}
		fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
		config = new Config('./test/config.json');
		const robots = new RobotsPlugin(config);
		await robots.execute();
		const filePath = 'test/site/robots.txt';
		expect(fs.existsSync(filePath)).toBe(true);
		fs.rmSync('test/site/robots.txt');
	});

	it('execute and write out the robots file with disallowed url only', async () => {
		const jsonConfig = {
			...defaultConfig,
			robots: {
				disallowedUrl: '/admin',
			}

		}
		fs.writeFileSync('test/config.json', JSON.stringify(jsonConfig, null, 2));
		config = new Config('./test/config.json');
		const robots = new RobotsPlugin(config);
		await robots.execute();
		const filePath = 'test/site/robots.txt';
		expect(fs.existsSync(filePath)).toBe(true);
		fs.rmSync('test/site/robots.txt');
	});
});
