module.exports.options = {
	templatePath: './template',
	outputPath: './dist-js',
	sitePath: './site',
	githubPath: 'jaredwray/docula',
	siteTitle: 'docula',
	siteDescription: 'Beautiful Website for Your Projects',
	siteUrl: 'https://docula.org',
	sections: [
		{ name: 'Caching', path: 'caching', order: 1 },
		{ name: 'Compression', path: 'compression', order: 2 },
		{ name: 'Storage Adapters', path: 'storage-adapters', order: 3 },
	],
};
