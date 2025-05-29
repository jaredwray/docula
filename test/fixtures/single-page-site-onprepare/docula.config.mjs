export const options = {
	templatePath: './template',
	githubPath: 'jaredwray/docula',
	sitePath: '../single-page-site-onprepare',
	outputPath: '../single-page-site-onprepare/dist',
	siteTitle: 'docula',
	siteDescription: 'Beautiful Website for Your Projects',
	siteUrl: 'https://docula.org',
};

export const onPrepare = async () => {
	console.info('onPrepare');
};
