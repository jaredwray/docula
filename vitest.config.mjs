import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			exclude: [
				'bin/**',
				'init/**',
				'template/**',
				'test/fixtures/**'
			],
		},
	},
});
