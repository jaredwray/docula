import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			exclude: [
				'bin/**',
				'init/**',
				'template/**',
				'src/helpers/markdown.ts',
				'site/dist/**',
				'site/**',
				'vitest.config.mjs',
				'dist/**',
				'test/**',
				".git/**",
			],
		},
	},
});
