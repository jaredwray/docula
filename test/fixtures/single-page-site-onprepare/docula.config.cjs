module.exports.options = {
	templatePath: './template',
	outputPath: './dist',
	sitePath: './site',
	githubPath: 'jaredwray/docula',
	siteTitle: 'docula',
	siteDescription: 'Beautiful Website for Your Projects',
	siteUrl: 'https://docula.org',
};

module.exports.onPrepare = async options => {
	console.log('onPrepare ' + JSON.stringify(options));
};
