import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			exclude: [
				'bin/**',
				'init/**',
				'template/**',
				'src/helpers/markdown.ts',
				'site-output/**',
				'site/**',
				'vitest.config.mjs',
				'dist/**',
				'test/**',
			],
		},
	},
});
