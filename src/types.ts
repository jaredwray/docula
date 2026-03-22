import type { ApiSpecData } from "./api-parser.js";
import type { GithubData } from "./github.js";
import type { DoculaOpenGraph } from "./options.js";

export type DoculaChangelogEntry = {
	title: string;
	date: string;
	formattedDate: string;
	tag?: string;
	tagClass?: string;
	slug: string;
	content: string;
	generatedHtml: string;
	preview: string;
	previewImage?: string;
	urlPath: string;
	lastModified: string;
};

export type DoculaData = {
	siteUrl: string;
	siteTitle: string;
	siteDescription: string;
	sitePath: string;
	templatePath: string;
	output: string;
	githubPath?: string;
	github?: GithubData;
	templates?: DoculaTemplates;
	hasDocuments?: boolean;
	hasChangelog?: boolean;
	sections?: DoculaSection[];
	documents?: DoculaDocument[];
	sidebarItems?: DoculaSection[];
	announcement?: string;
	openApiUrl?: string;
	hasApi?: boolean;
	apiSpec?: ApiSpecData;
	changelogEntries?: DoculaChangelogEntry[];
	hasReadme?: boolean;
	themeMode?: string;
	cookieAuth?: {
		loginUrl: string;
		logoutUrl?: string;
		authCheckUrl?: string;
		authCheckMethod?: string;
		authCheckUserPath?: string;
	};
	headerLinks?: Array<{
		label: string;
		url: string;
		icon?: string;
	}>;
	enableLlmsTxt?: boolean;
	hasFeed?: boolean;
	lastModified?: string;
	baseUrl: string;
	docsPath: string;
	apiPath: string;
	changelogPath: string;
	docsUrl: string;
	apiUrl: string;
	changelogUrl: string;
	editPageUrl?: string;
	openGraph?: DoculaOpenGraph;
};

export type DoculaTemplates = {
	home: string;
	docPage?: string;
	api?: string;
	changelog?: string;
	changelogEntry?: string;
};

export type DoculaSection = {
	name: string;
	order?: number;
	path: string;
	children?: DoculaSection[];
};

export type DoculaDocument = {
	title: string;
	navTitle: string;
	description: string;
	order?: number;
	section?: string;
	keywords: string[];
	content: string;
	markdown: string;
	generatedHtml: string;
	documentPath: string;
	urlPath: string;
	isRoot: boolean;
	lastModified: string;
	ogTitle?: string;
	ogDescription?: string;
	ogImage?: string;
};

export type BuildManifest = {
	version: 1;
	configHash: string;
	templateHash: string;
	docs: Record<string, string>;
	changelog: Record<string, string>;
	assets: Record<string, string>;
};
