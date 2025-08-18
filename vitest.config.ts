import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			reporter: ['text', 'json', 'lcov'],
			exclude: [
				'bin/**',
				'init/**',
				'template/**',
				'src/helpers/markdown.ts',
				'src/init.ts',
				'scripts/**',
				'site/dist/**',
				'site/**',
				'vitest.config.ts',
				'dist/**',
				'test/**',
				'.git/**',
			],
		},
	},
});
