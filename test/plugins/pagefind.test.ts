import fs from 'fs-extra';
import child_process from 'node:child_process';
import {Config} from '../../src/config.js';
import {PagefindPlugin} from '../../src/plugins/pagefind.js';

describe('Pagefind Plugin', () => {
	const defaultConfig = {
		outputPath: 'test/dist',
		plugins: ['pagefind'],
	};

	afterAll(() => {
		fs.rmSync('./test/data/pagefind-config.json', {force: true});
	});

	it('init', () => {
		fs.writeFileSync('test/data/pagefind-config.json', JSON.stringify(defaultConfig, null, 2));
		const config = new Config('./test/data/pagefind-config.json');
		const pagefind = new PagefindPlugin(config);
		expect(pagefind).toBeDefined();
	});
});
