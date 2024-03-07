import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			exclude: [
				'bin/**',
				'init/**',
				'template/**',
				'test/fixtures/**',
				'src/helpers/markdown.ts',
				'site-output/**',
				'site/**',
			],
		},
	},
});
