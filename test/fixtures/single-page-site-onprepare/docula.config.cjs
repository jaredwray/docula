const fs = require('node:fs');
const path = require('path');
const process = require('node:process');

module.exports.options = {
	templatePath: './template',
	githubPath: 'jaredwray/docula',
	sitePath: '../single-page-site-onprepare',
	outputPath: './site-output',
	siteTitle: 'docula',
	siteDescription: 'Beautiful Website for Your Projects',
	siteUrl: 'https://docula.org',
};

module.exports.onPrepare = async (config) => {
	console.info('onPrepare');
}