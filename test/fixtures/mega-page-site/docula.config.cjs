module.exports.options = {
	templatePath: './template',
	outputPath: './test/fixtures/mega-page-site/site-output',
	sitePath: './test/fixtures/mega-page-site',
	githubPath: 'jaredwray/docula',
	siteTitle: 'docula',
	siteDescription: 'Beautiful Website for Your Projects',
	siteUrl: 'https://docula.org',
	sections: [
		{ name: 'Caching', path: 'caching', order: 5 },
		{ name: 'Compression', path: 'compression', order: 4 },
		{ name: 'Storage Adapters', path: 'storage-adapters', order: 3 },
	],
};
