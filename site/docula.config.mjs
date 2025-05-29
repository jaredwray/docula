import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export const options = {
	templatePath: './template',
	githubPath: 'jaredwray/docula',
	outputPath: './site/dist',
	siteTitle: 'docula',
	siteDescription: 'Beautiful Website for Your Projects',
	siteUrl: 'https://docula.org',
};

export const onPrepare = async config => {
	const readmePath = path.join(process.cwd(), './README.md');
	const readmeSitePath = path.join(config.sitePath, 'README.md');
	const readme = await fs.promises.readFile(readmePath, 'utf8');
	const updatedReadme = readme.replace('![Docula](site/logo.svg)', '');
	console.log('writing updated readme to', readmeSitePath);
	await fs.promises.writeFile(readmeSitePath, updatedReadme);
};
