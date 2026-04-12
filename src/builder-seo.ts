import fs from "node:fs";
import { Writr, type WritrOptions } from "writr";
import {
	buildAbsoluteSiteUrl,
	escapeXml,
	normalizePathForUrl,
	summarizeMarkdown,
} from "./builder-utils.js";
import type { DoculaOptions } from "./options.js";
import type { DoculaData, DoculaDocument } from "./types.js";

const writrOptions: WritrOptions = {
	throwOnEmitError: false,
	throwOnEmptyListeners: false,
};

export function resolveOpenGraphData(
	data: DoculaData,
	pageUrl: string,
	pageData?: Partial<DoculaDocument> & {
		previewImage?: string;
		preview?: string;
	},
): Record<string, string | undefined> {
	// When no global openGraph config and no per-page OG data, skip entirely
	if (!data.openGraph && !pageData?.ogTitle && !pageData?.ogDescription) {
		return {};
	}

	const og = data.openGraph ?? {};
	const ogSiteName = og.siteName ?? data.siteTitle;
	const rawTitle =
		pageData?.ogTitle ?? og.title ?? pageData?.title ?? data.siteTitle;
	const ogTitle =
		rawTitle !== data.siteTitle ? `${ogSiteName} - ${rawTitle}` : rawTitle;
	const ogDescription =
		pageData?.ogDescription ??
		og.description ??
		pageData?.description ??
		pageData?.preview ??
		data.siteDescription;
	const ogImage = pageData?.ogImage ?? og.image ?? pageData?.previewImage;
	const ogUrl = `${data.siteUrl}${data.baseUrl}${pageUrl}`;
	const ogType = og.type ?? "website";
	const ogTwitterCard =
		og.twitterCard ?? (ogImage ? "summary_large_image" : "summary");

	return {
		ogTitle,
		ogDescription,
		ogImage,
		ogUrl,
		ogType,
		ogSiteName,
		ogTwitterCard,
	};
}

export function resolveJsonLd(
	pageType: "home" | "docs" | "api" | "changelog" | "changelog-entry",
	data: DoculaData,
	pageUrl: string,
	pageData?: Partial<DoculaDocument> & {
		date?: string;
		preview?: string;
		previewImage?: string;
	},
): string {
	const url = `${data.siteUrl}${data.baseUrl}${pageUrl}`;

	// biome-ignore lint/suspicious/noExplicitAny: dynamic schema object
	let schema: any;

	switch (pageType) {
		case "home": {
			schema = {
				"@context": "https://schema.org",
				"@type": "WebSite",
				name: data.siteTitle,
				description: data.siteDescription,
				url,
			};
			break;
		}

		case "docs": {
			schema = {
				"@context": "https://schema.org",
				"@type": "TechArticle",
				headline: pageData?.title ?? data.siteTitle,
				description: pageData?.description ?? data.siteDescription,
				url,
				publisher: {
					"@type": "Organization",
					name: data.siteTitle,
				},
			};
			if (pageData?.lastModified) {
				schema.dateModified = pageData.lastModified;
			}

			if (pageData?.keywords) {
				schema.keywords = pageData.keywords;
			}

			break;
		}

		case "api": {
			schema = {
				"@context": "https://schema.org",
				"@type": "WebPage",
				name: `API Reference - ${data.siteTitle}`,
				description: `API Reference for ${data.siteTitle}`,
				url,
			};
			break;
		}

		case "changelog": {
			schema = {
				"@context": "https://schema.org",
				"@type": "CollectionPage",
				name: `${data.siteTitle} Changelog`,
				description: `Changelog for ${data.siteTitle}`,
				url,
			};
			break;
		}

		case "changelog-entry": {
			if (!pageData?.title) {
				return "";
			}

			schema = {
				"@context": "https://schema.org",
				"@type": "BlogPosting",
				headline: pageData.title,
				description: pageData?.description ?? pageData?.preview ?? "",
				url,
				publisher: {
					"@type": "Organization",
					name: data.siteTitle,
				},
			};
			if (pageData?.date) {
				schema.datePublished = pageData.date;
			}

			if (pageData?.previewImage) {
				schema.image = pageData.previewImage;
			}

			if (pageData?.keywords) {
				schema.keywords = pageData.keywords;
			}

			break;
		}

		// No default
	}

	/* v8 ignore next 3 -- @preserve */
	if (!schema) {
		return "";
	}

	return `<script type="application/ld+json">\n${JSON.stringify(schema)}\n</script>`;
}

export async function buildSiteMapPage(
	data: DoculaData,
	options: DoculaOptions,
): Promise<void> {
	const sitemapPath = `${data.output}/sitemap.xml`;
	const urls = [{ url: data.siteUrl }];

	if (data.documents?.length) {
		urls.push({ url: `${data.siteUrl}${data.baseUrl}/feed.xml` });
	}

	if (data.hasChangelog && data.templates?.changelogEntry) {
		urls.push({ url: `${data.siteUrl}${data.baseUrl}/changelog.json` });
		urls.push({
			url: `${data.siteUrl}${data.baseUrl}/changelog-latest.json`,
		});
	}

	if (data.hasApi || (data.openApiSpecs?.[0] && data.templates?.api)) {
		urls.push({
			url: `${data.siteUrl}${data.apiUrl}`,
		});
	}

	if (data.hasChangelog && data.templates?.changelog) {
		urls.push({
			url: `${data.siteUrl}${data.changelogUrl}`,
		});

		const perPage = options.changelogPerPage;
		const totalPages = Math.max(
			1,
			Math.ceil((data.changelogEntries ?? []).length / perPage),
		);
		for (let page = 2; page <= totalPages; page++) {
			urls.push({
				url: `${data.siteUrl}${data.changelogUrl}/page/${page}`,
			});
		}

		for (const entry of data.changelogEntries ?? []) {
			urls.push({
				url: `${data.siteUrl}${data.changelogUrl}/${entry.slug}`,
			});
		}
	}

	// Add all the document urls
	for (const document of data.documents ?? []) {
		let { urlPath } = document;
		/* v8 ignore next -- @preserve */
		if (urlPath.endsWith("index.html")) {
			urlPath = urlPath.slice(0, -10);
		}

		urls.push({ url: `${data.siteUrl}${data.baseUrl}${urlPath}` });
	}

	let xml = '<?xml version="1.0" encoding="UTF-8"?>';
	xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

	for (const { url } of urls) {
		xml += "<url>";
		xml += `<loc>${url}</loc>`;
		xml += "</url>";
	}

	xml += "</urlset>";

	await fs.promises.mkdir(data.output, { recursive: true });

	await fs.promises.writeFile(sitemapPath, xml, "utf8");
}

export async function buildFeedPage(data: DoculaData): Promise<void> {
	if (!data.documents?.length) {
		return;
	}

	const feedPath = `${data.output}/feed.xml`;
	const channelLink = buildAbsoluteSiteUrl(data.siteUrl, `${data.baseUrl}/`);
	const feedUrl = buildAbsoluteSiteUrl(
		data.siteUrl,
		`${data.baseUrl}/feed.xml`,
	);
	let xml = '<?xml version="1.0" encoding="UTF-8"?>';
	xml += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">';
	xml += "<channel>";
	xml += `<title>${escapeXml(data.siteTitle)}</title>`;
	xml += `<link>${escapeXml(channelLink)}</link>`;
	xml += `<description>${escapeXml(data.siteDescription)}</description>`;
	xml += `<lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>`;
	xml += `<atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`;

	for (const document of data.documents) {
		const itemTitle = document.navTitle || document.title || document.urlPath;
		const itemLink = buildAbsoluteSiteUrl(
			data.siteUrl,
			`${data.baseUrl}${normalizePathForUrl(document.urlPath)}`,
		);
		const summary =
			document.description ||
			summarizeMarkdown(new Writr(document.content, writrOptions).body);
		xml += "<item>";
		xml += `<title>${escapeXml(itemTitle)}</title>`;
		xml += `<link>${escapeXml(itemLink)}</link>`;
		xml += `<guid isPermaLink="true">${escapeXml(itemLink)}</guid>`;
		xml += `<description>${escapeXml(summary)}</description>`;
		xml += "</item>";
	}

	xml += "</channel>";
	xml += "</rss>";

	await fs.promises.mkdir(data.output, { recursive: true });
	await fs.promises.writeFile(feedPath, xml, "utf8");
}

export async function buildRobotsPage(options: DoculaOptions): Promise<void> {
	const { sitePath } = options;
	const { output } = options;
	const robotsPath = `${output}/robots.txt`;

	await fs.promises.mkdir(output, { recursive: true });

	await (fs.existsSync(`${sitePath}/robots.txt`)
		? fs.promises.copyFile(`${sitePath}/robots.txt`, robotsPath)
		: fs.promises.writeFile(robotsPath, "User-agent: *\nDisallow:"));
}
