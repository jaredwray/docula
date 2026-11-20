import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const CONTENT_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".xml": "application/xml; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
	".md": "text/plain; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".avif": "image/avif",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".otf": "font/otf",
	".map": "application/json; charset=utf-8",
	".pdf": "application/pdf",
	".webmanifest": "application/manifest+json",
};

const NOT_FOUND_BODY =
	"<!doctype html><title>Not Found</title><p>Not Found</p>";

type FoundFile = {
	absolutePath: string;
	stats: fs.Stats;
};

type ResolveResult =
	| { status: "ok"; file: FoundFile }
	| { status: "bad" }
	| { status: "missing" };

/**
 * Serve files from `root` for Docula's local preview server.
 * GET and HEAD only. Directory URLs resolve to `index.html`, and
 * extensionless URLs also try a sibling `.html` file.
 */
export function createStaticHandler(options: {
	root: string;
}): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
	const root = path.resolve(options.root);

	return async (request, response) => {
		const method = request.method;
		try {
			await handleRequest(root, request, response);
		} catch {
			if (response.headersSent) {
				response.destroy();
				return;
			}

			sendText(
				response,
				500,
				"text/plain; charset=utf-8",
				"Internal Server Error",
				method === "HEAD" ? "HEAD" : "GET",
			);
		}
	};
}

async function handleRequest(
	root: string,
	request: IncomingMessage,
	response: ServerResponse,
): Promise<void> {
	const method = request.method;
	if (method !== "GET" && method !== "HEAD") {
		sendText(
			response,
			405,
			"text/plain; charset=utf-8",
			"Method Not Allowed",
			"GET",
			{ Allow: "GET, HEAD" },
		);
		return;
	}

	const decoded = decodeRequestPath(request.url);
	if (!decoded) {
		sendText(response, 400, "text/plain; charset=utf-8", "Bad Request", method);
		return;
	}

	const resolved = await resolveFile(root, decoded);
	if (resolved.status === "bad") {
		sendText(response, 400, "text/plain; charset=utf-8", "Bad Request", method);
		return;
	}

	if (resolved.status === "missing") {
		sendText(response, 404, "text/html; charset=utf-8", NOT_FOUND_BODY, method);
		return;
	}

	await sendFile(response, method, resolved.file);
}

function decodeRequestPath(rawUrl: string | undefined): string | undefined {
	if (!rawUrl) {
		return undefined;
	}

	let pathname: string;
	try {
		pathname = new URL(rawUrl, "http://127.0.0.1").pathname;
	} catch {
		return undefined;
	}

	let decoded: string;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return undefined;
	}

	if (decoded.includes("\0")) {
		return undefined;
	}

	// Treat backslash as a separator so a Windows client cannot escape `root`.
	return decoded.replace(/\\/g, "/");
}

async function resolveFile(
	root: string,
	decodedPath: string,
): Promise<ResolveResult> {
	const relative = decodedPath.replace(/^\/+/, "");
	const logical = path.resolve(root, relative);
	if (!isInsideRoot(root, logical)) {
		return { status: "bad" };
	}

	for (const candidate of candidatePaths(logical)) {
		if (!isInsideRoot(root, candidate)) {
			continue;
		}

		const stats = await statIfExists(candidate);
		if (!stats || stats.isSymbolicLink() || !stats.isFile()) {
			continue;
		}

		const real = await fs.promises.realpath(candidate);
		if (!isInsideRoot(root, real)) {
			return { status: "missing" };
		}

		return { status: "ok", file: { absolutePath: real, stats } };
	}

	return { status: "missing" };
}

function candidatePaths(logical: string): string[] {
	const candidates = [logical, path.join(logical, "index.html")];
	if (path.extname(logical) === "") {
		candidates.push(`${logical}.html`);
	}

	return candidates;
}

async function statIfExists(candidate: string): Promise<fs.Stats | undefined> {
	try {
		return await fs.promises.lstat(candidate);
	} catch (error) {
		const code = (error as { code?: string }).code;
		if (code === "ENOENT" || code === "ENOTDIR") {
			return undefined;
		}

		throw error;
	}
}

function isInsideRoot(root: string, candidate: string): boolean {
	const resolved = path.resolve(candidate);
	return resolved === root || resolved.startsWith(`${root}${path.sep}`);
}

async function sendFile(
	response: ServerResponse,
	method: "GET" | "HEAD",
	file: FoundFile,
): Promise<void> {
	const stream = fs.createReadStream(file.absolutePath);
	try {
		await waitForOpen(stream);
	} catch (error) {
		stream.destroy();
		throw error;
	}

	response.writeHead(200, {
		"Content-Type": contentTypeFor(file.absolutePath),
		"Content-Length": file.stats.size,
		"Last-Modified": file.stats.mtime.toUTCString(),
		"Cache-Control": "no-cache",
	});

	if (method === "HEAD") {
		stream.destroy();
		response.end();
		return;
	}

	await pipeline(stream, response);
}

function waitForOpen(stream: fs.ReadStream): Promise<void> {
	return new Promise((resolve, reject) => {
		const onError = (error: Error) => {
			stream.off("error", onError);
			stream.off("open", onOpen);
			reject(error);
		};
		const onOpen = () => {
			stream.off("error", onError);
			stream.off("open", onOpen);
			resolve();
		};
		stream.once("error", onError);
		stream.once("open", onOpen);
	});
}

function contentTypeFor(filePath: string): string {
	const extension = path.extname(filePath).toLowerCase();
	return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

function sendText(
	response: ServerResponse,
	status: number,
	contentType: string,
	body: string,
	method: string,
	extraHeaders: Record<string, string> = {},
): void {
	response.writeHead(status, {
		"Content-Type": contentType,
		"Content-Length": Buffer.byteLength(body),
		"Cache-Control": "no-cache",
		...extraHeaders,
	});
	if (method === "HEAD") {
		response.end();
		return;
	}

	response.end(body);
}
