import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import type {DoculaOptions} from 'docula';

export const options: Partial<DoculaOptions> = {
	template: 'modern',
	githubPath: 'jaredwray/docula',
	output: './site/dist',
	siteTitle: 'docula',
	siteDescription: 'Beautiful Website for Your Projects',
	siteUrl: 'https://docula.org',
	themeMode: 'light',
	sections: [
		{name: 'Project Guidelines', path: 'project-guidelines', order: 15},
	],
};

async function copyWithFrontMatter(sourcePath: string, destPath: string, title: string, order: number) {
	const content = await fs.promises.readFile(sourcePath, 'utf8');
	const frontMatter = `---\ntitle: ${title}\norder: ${order}\n---\n\n`;
	await fs.promises.writeFile(destPath, frontMatter + content);
}

export const onPrepare = async (config: DoculaOptions) => {
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
};
