module.exports.options = {
	templatePath: './template',
	outputPath: './dist-js',
	sitePath: './site',
	githubPath: 'jaredwray/docula',
	siteTitle: 'docula',
	siteDescription: 'Beautiful Website for Your Projects',
	siteUrl: 'https://docula.org',
};

module.exports.onPrepare = async options => {
	throw new Error('onPrepare' + JSON.stringify(options));
};
