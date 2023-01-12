import child_process from 'node:child_process';
import fs from 'fs-extra';
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

	it('should execute the pagefind command', async () => {
		fs.writeFileSync('test/data/pagefind-config.json', JSON.stringify(defaultConfig, null, 2));
		const config = new Config('./test/data/pagefind-config.json');
		const pagefind = new PagefindPlugin(config);
		// @ts-expect-error - Mocking the exec function
		const execMock = jest.spyOn(child_process, 'exec').mockImplementation((command: string, callback: (error: any, stdout: any) => void) => {
			callback(null, 'Pagefind finished successfully');
		});

		await pagefind.execute();
		expect(execMock).toHaveBeenCalledWith('npx pagefind --source test/dist', expect.any(Function));
	});

	it('should reject the promise if there is an error', async () => {
		fs.writeFileSync('test/data/pagefind-config.json', JSON.stringify(defaultConfig, null, 2));
		const config = new Config('./test/data/pagefind-config.json');
		const pagefind = new PagefindPlugin(config);
		// @ts-expect-error - Mocking the exec function
		const execMock = jest.spyOn(child_process, 'exec').mockImplementation((command: string, callback: (error: any, stdout: any) => void) => {
			callback(new Error('Pagefind failed'), null);
		});

		await expect(pagefind.execute()).rejects.toThrowError('Pagefind failed');
	});
});
