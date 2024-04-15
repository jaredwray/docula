import fs from 'node:fs';
import {Ecto} from 'ecto';
import {DoculaOptions} from './options.js';
import {DoculaConsole} from './console.js';
import {Github, type GithubData, type GithubOptions} from './github.js';

export type DoculaData = {
	siteUrl: string;
	siteTitle: string;
	siteDescription: string;
	sitePath: string;
	templatePath: string;
	outputPath: string;
	githubPath?: string;
	github?: GithubData;
	templates?: DoculaTemplates;
};

export type DoculaTemplates = {
	index: string;
	releases: string;
};

export class DoculaBuilder {
	private readonly _options: DoculaOptions = new DoculaOptions();
	private readonly _ecto: Ecto;
	private readonly _console: DoculaConsole = new DoculaConsole();

	constructor(options?: DoculaOptions, engineOptions?: any) {
		if (options) {
			this._options = options;
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		this._ecto = new Ecto(engineOptions);
	}

	public get options(): DoculaOptions {
		return this._options;
	}

	public async build(): Promise<void> {
		const startTime = Date.now();

		// Validate the options
		this.validateOptions(this.options);
		// Set the site options
		const doculaData: DoculaData = {
			siteUrl: this.options.siteUrl,
			siteTitle: this.options.siteTitle,
			siteDescription: this.options.siteDescription,
			sitePath: this.options.sitePath,
			templatePath: this.options.templatePath,
			outputPath: this.options.outputPath,
			githubPath: this.options.githubPath,
		};

		// Get data from github
		const githubData = await this.getGithubData(this.options.githubPath);
		// Get data of the site
		doculaData.github = githubData;
		// Get the templates to use
		doculaData.templates = await this.getTemplates(this.options);

		// Build the home page (index.html)
		await this.buildIndexPage(doculaData);

		// Build the releases page (/releases/index.html)
		await this.buildReleasePage(doculaData);

		// Build the sitemap (/sitemap.xml)
		await this.buildSiteMapPage(doculaData);

		// Build the robots.txt (/robots.txt)
		await this.buildRobotsPage(this.options);

		const siteRelativePath = this.options.sitePath;

		// Copy over favicon
		if (fs.existsSync(`${siteRelativePath}/favicon.ico`)) {
			await fs.promises.copyFile(
				`${siteRelativePath}/favicon.ico`,
				`${this.options.outputPath}/favicon.ico`,
			);
		}

		// Copy over logo
		if (fs.existsSync(`${siteRelativePath}/logo.svg`)) {
			await fs.promises.copyFile(
				`${siteRelativePath}/logo.svg`,
				`${this.options.outputPath}/logo.svg`,
			);
		}

		if (fs.existsSync(`${siteRelativePath}/logo_horizontal.png`)) {
			await fs.promises.copyFile(
				`${siteRelativePath}/logo_horizontal.png`,
				`${this.options.outputPath}/logo_horizontal.png`,
			);
		}

		// Copy over css
		if (fs.existsSync(`${this.options.templatePath}/css`)) {
			this.copyDirectory(
				`${this.options.templatePath}/css`,
				`${this.options.outputPath}/css`,
			);
		}

		// Copy over variables
		if (fs.existsSync(`${siteRelativePath}/variables.css`)) {
			await fs.promises.copyFile(
				`${siteRelativePath}/variables.css`,
				`${this.options.outputPath}/css/variables.css`,
			);
		}

		const endTime = Date.now();

		const executionTime = endTime - startTime;

		this._console.log(`Build completed in ${executionTime}ms`);
	}

	public validateOptions(options: DoculaOptions): void {
		if (options.githubPath.length < 3) {
			throw new Error('No github options provided');
		}

		if (options.siteDescription.length < 3) {
			throw new Error('No site description options provided');
		}

		if (!options.siteTitle) {
			throw new Error('No site title options provided');
		}

		if (!options.siteUrl) {
			throw new Error('No site url options provided');
		}
	}

	public async getGithubData(githubPath: string): Promise<GithubData> {
		const paths = githubPath.split('/');
		const options: GithubOptions = {
			author: paths[0],
			repo: paths[1],
		};
		const github = new Github(options);
		return github.getData();
	}

	public async getTemplates(options: DoculaOptions): Promise<DoculaTemplates> {
		const templates: DoculaTemplates = {
			index: '',
			releases: '',
		};

		if (fs.existsSync(options.templatePath)) {
			const index = await this.getTemplateFile(options.templatePath, 'index');
			if (index) {
				templates.index = index;
			}

			const releases = await this.getTemplateFile(
				options.templatePath,
				'releases',
			);
			if (releases) {
				templates.releases = releases;
			}
		} else {
			throw new Error(`No template path found at ${options.templatePath}`);
		}

		return templates;
	}

	public async getTemplateFile(
		path: string,
		name: string,
	): Promise<string | undefined> {
		let result;
		const files = await fs.promises.readdir(path);
		for (const file of files) {
			const fileName = file.split('.');
			if (fileName[0].toString().toLowerCase() === name.toLowerCase()) {
				result = file.toString();
				break;
			}
		}

		return result;
	}

	public async buildRobotsPage(options: DoculaOptions): Promise<void> {
		const {sitePath} = options;
		const {outputPath} = options;
		const robotsPath = `${outputPath}/robots.txt`;

		await fs.promises.mkdir(outputPath, {recursive: true});

		await ((fs.existsSync(`${sitePath}/robots.txt`))
			? fs.promises.copyFile(`${sitePath}/robots.txt`, robotsPath)
			: fs.promises.writeFile(robotsPath, 'User-agent: *\nDisallow:'));
	}

	public async buildSiteMapPage(data: DoculaData): Promise<void> {
		const sitemapPath = `${data.outputPath}/sitemap.xml`;
		const urls = [{url: data.siteUrl}, {url: `${data.siteUrl}/releases`}];

		let xml = '<?xml version="1.0" encoding="UTF-8"?>';
		xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

		for (const {url} of urls) {
			xml += '<url>';
			xml += `<loc>${url}</loc>`;
			xml += '</url>';
		}

		xml += '</urlset>';

		await fs.promises.mkdir(data.outputPath, {recursive: true});

		await fs.promises.writeFile(sitemapPath, xml, 'utf8');
	}

	public async buildIndexPage(data: DoculaData): Promise<void> {
		if (data.templates) {
			const indexPath = `${data.outputPath}/index.html`;

			await fs.promises.mkdir(data.outputPath, {recursive: true});

			const indexTemplate = `${data.templatePath}/${data.templates.index}`;

			const htmlReadme = await this.buildReadmeSection(data);

			const indexContent = await this._ecto.renderFromFile(
				indexTemplate,
				{...data, content: htmlReadme},
				data.templatePath,
			);
			await fs.promises.writeFile(indexPath, indexContent, 'utf8');
		} else {
			throw new Error('No templates found');
		}
	}

	public async buildReleasePage(data: DoculaData): Promise<void> {
		if (data.github && data.templates) {
			const releasesPath = `${data.outputPath}/releases/index.html`;
			const releaseOutputPath = `${data.outputPath}/releases`;

			await fs.promises.mkdir(releaseOutputPath, {recursive: true});

			const releasesTemplate = `${data.templatePath}/${data.templates.releases}`;
			const releasesContent = await this._ecto.renderFromFile(
				releasesTemplate,
				data,
				data.templatePath,
			);
			await fs.promises.writeFile(releasesPath, releasesContent, 'utf8');
		} else {
			throw new Error('No github data found');
		}
	}

	public async buildReadmeSection(data: DoculaData): Promise<string> {
		let htmlReadme = '';
		if (fs.existsSync(`${data.sitePath}/README.md`)) {
			const readmeContent = fs.readFileSync(
				`${data.sitePath}/README.md`,
				'utf8',
			);
			htmlReadme = await this._ecto.markdown.render(readmeContent);
		}

		return htmlReadme;
	}

	private copyDirectory(source: string, target: string): void {
		const files = fs.readdirSync(source);

		for (const file of files) {
			/* c8 ignore next 3 */
			if (file.startsWith('.')) {
				continue;
			}

			const sourcePath = `${source}/${file}`;
			const targetPath = `${target}/${file}`;

			const stat = fs.lstatSync(sourcePath);

			if (stat.isDirectory()) {
				fs.mkdirSync(targetPath, {recursive: true});
				this.copyDirectory(sourcePath, targetPath);
			} else {
				fs.copyFileSync(sourcePath, targetPath);
			}
		}
	}
}
