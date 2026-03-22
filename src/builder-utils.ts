import path from "node:path";

export function buildUrlPath(...segments: (string | undefined)[]): string {
	const cleaned = segments
		.filter((s): s is string => Boolean(s))
		.map((s) => {
			let start = 0;
			let end = s.length;
			while (start < end && s[start] === "/") start++;
			while (end > start && s[end - 1] === "/") end--;
			return s.slice(start, end);
		});
	return `/${cleaned.filter(Boolean).join("/")}`;
}

export function buildAbsoluteSiteUrl(siteUrl: string, urlPath: string): string {
	const normalizedSiteUrl = siteUrl.endsWith("/")
		? siteUrl.slice(0, -1)
		: siteUrl;
	/* v8 ignore next -- @preserve */
	const normalizedPath = urlPath.startsWith("/") ? urlPath : `/${urlPath}`;
	return `${normalizedSiteUrl}${normalizedPath}`;
}

export function normalizePathForUrl(urlPath: string): string {
	if (urlPath.endsWith("index.html")) {
		return urlPath.slice(0, -10);
	}

	return urlPath;
}

export function isPathWithinBasePath(
	candidatePath: string,
	basePath: string,
): boolean {
	const relativePath = path.relative(
		path.resolve(basePath),
		path.resolve(candidatePath),
	);

	return (
		relativePath === "" ||
		(!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
	);
}

export function toPosixPath(filePath: string): string {
	return filePath.replaceAll(path.sep, path.posix.sep);
}

export function escapeXml(value: string | undefined): string {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

export function summarizeMarkdown(markdown: string, maxLength = 240): string {
	const plainText = markdown
		.replace(/^#{1,6}\s+.*$/gm, " ")
		.replace(/^\s*[-*+]\s+/gm, " ")
		.replace(/^\s*---+\s*$/gm, " ")
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/[*_~>#]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	if (plainText.length <= maxLength) {
		return plainText;
	}

	return `${plainText.slice(0, maxLength).trimEnd()}...`;
}

export function isRemoteUrl(url: string): boolean {
	return /^https?:\/\//i.test(url);
}
