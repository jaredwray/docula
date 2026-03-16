import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import type {DoculaConsole, DoculaOptions} from 'docula';

export const options: Partial<DoculaOptions> = {
	template: 'modern',
	githubPath: 'jaredwray/docula',
	output: './site/dist',
	siteTitle: 'Docula',
	siteDescription: 'Beautiful Website for Your Projects',
	siteUrl: 'https://docula.org',
	themeMode: 'light',
	sections: [
		{name: 'Project Guidelines', path: 'project-guidelines', order: 21},
	],
	headerLinks: [
		{
			label: 'GitHub',
			url: 'https://github.com/jaredwray/docula',
			icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>',
		},
		{
			label: 'npm',
			url: 'https://www.npmjs.com/package/docula',
		},
	],
};

async function copyWithFrontMatter(sourcePath: string, destPath: string, title: string, order: number) {
	const content = await fs.promises.readFile(sourcePath, 'utf8');
	const frontMatter = `---\ntitle: ${title}\norder: ${order}\n---\n\n`;
	await fs.promises.writeFile(destPath, frontMatter + content);
}

export const onPrepare = async (config: DoculaOptions, console: DoculaConsole) => {
	console.step('Preparing project guidelines...');
	const guidelinesDir = path.join(config.sitePath, 'docs', 'project-guidelines');
	await fs.promises.mkdir(guidelinesDir, {recursive: true});

	const rootDir = process.cwd();

	await Promise.all([
		copyWithFrontMatter(
			path.join(rootDir, 'CONTRIBUTING.md'),
			path.join(guidelinesDir, 'contributing.md'),
			'Contributing',
			1,
		),
		copyWithFrontMatter(
			path.join(rootDir, 'CODE_OF_CONDUCT.md'),
			path.join(guidelinesDir, 'code-of-conduct.md'),
			'Code of Conduct',
			2,
		),
		copyWithFrontMatter(
			path.join(rootDir, 'SECURITY.md'),
			path.join(guidelinesDir, 'security.md'),
			'Security',
			3,
		),
	]);

	console.success('Project guidelines prepared');
};
