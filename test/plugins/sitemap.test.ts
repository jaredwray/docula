import fs from 'fs-extra';
import {SitemapPlugin} from '../../src/plugins/sitemap.js';
import {Config} from '../../src/config.js';
import {Eleventy} from '../../src/eleventy.js';

describe('Sitemap Plugin', () => {
	let config;
	const defaultConfig = {
		outputPath: 'test/site',
		plugins: ['sitemap'],
	};

	beforeEach(() => {
		jest.spyOn(Eleventy.prototype, 'toJSON').mockImplementation(async () => [
			{
				url: '/demo',
				inputPath: 'test/site/demo/index.html',
				outputPath: 'test/site',
				content: 'test',
			},
		]);
	});

	afterEach(() => {
		config = null;
		fs.rmSync('test/data/sitemap-config.json');
		jest.clearAllMocks();
	});

	it('init', () => {
		const jsonConfig = {
			...defaultConfig,
			sitemap: {
				baseUrl: 'https://example.com',
			},
		};
		fs.writeFileSync('test/data/sitemap-config.json', JSON.stringify(jsonConfig, null, 2));
		config = new Config('./test/data/sitemap-config.json');
		const sitemap = new SitemapPlugin(config);
		expect(sitemap).toBeDefined();
	});

	it('throw an error if baseurl is not defined', () => {
		const jsonConfig = {
			...defaultConfig,
			sitemap: {},
		};
		expect(() => {
			fs.writeFileSync('test/data/sitemap-config.json', JSON.stringify(jsonConfig, null, 2));
			config = new Config('./test/data/sitemap-config.json');
			const sitemap = new SitemapPlugin(config);
		}).toThrow();
	});

	it('should call Eleventy toJSON method', async () => {
		const jsonConfig = {
			...defaultConfig,
			sitemap: {
				baseUrl: 'https://example.com',
			},
		};
		fs.writeFileSync('test/data/sitemap-config.json', JSON.stringify(jsonConfig, null, 2));
		config = new Config('./test/data/sitemap-config.json');
		const sitemap = new SitemapPlugin(config);
		await sitemap.execute();
		expect(Eleventy.prototype.toJSON).toHaveBeenCalled();
	});

	it('execute and write out the sitemap.xml file', async () => {
		const jsonConfig = {
			...defaultConfig,
			sitemap: {
				baseUrl: 'https://example.com',
			},
		};
		fs.writeFileSync('test/data/sitemap-config.json', JSON.stringify(jsonConfig, null, 2));
		config = new Config('./test/data/sitemap-config.json');
		const sitemap = new SitemapPlugin(config);
		await sitemap.execute();
		expect(fs.existsSync('test/site/sitemap.xml')).toBe(true);
		fs.rmSync('test/site/sitemap.xml');
	});
});
