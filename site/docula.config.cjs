const fs = require('fs-extra');
const path = require('path');
const process = require('node:process');

module.exports.options = {
	templatePath: './template',
	githubPath: 'jaredwray/docula',
	outputPath: './site-output',
	siteTitle: 'docula',
	siteDescription: 'Beautiful Website for Your Projects',
	siteUrl: 'https://docula.org',
};

module.exports.onPrepare = async (config) => {
	const readmePath = path.join(process.cwd(), './README.md');
	const readmeSitePath = path.join(config.sitePath, 'README.md');
	const readme = await fs.readFile(readmePath, 'utf8');
	const updatedReadme = readme.replace('![Docula](site/logo.svg)\n\n---\n\n', '');
	console.log('writing updated readme to ', readmeSitePath);
	await fs.writeFile(readmeSitePath, updatedReadme);
}