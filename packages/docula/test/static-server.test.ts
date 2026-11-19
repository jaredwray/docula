import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import http from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStaticHandler } from "../src/static-server.js";
import { makeTempDir } from "./test-helpers.js";

type ResponseResult = {
	status: number;
	headers: http.IncomingHttpHeaders;
	body: string;
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe("static server", () => {
	it("serves index.html for / and records dev-server headers", async () => {
		const root = makeTempDir("static-index");
		await fs.promises.writeFile(path.join(root, "index.html"), "<p>home</p>");

		await withServer(root, async (port) => {
			const response = await request(port, "/");
			expect(response.status).toBe(200);
			expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
			expect(response.headers["cache-control"]).toBe("no-cache");
			expect(response.headers["last-modified"]).toEqual(expect.any(String));
			expect(response.headers["content-length"]).toBe(
				String(Buffer.byteLength("<p>home</p>")),
			);
			expect(response.body).toBe("<p>home</p>");
		});
	});

	it("resolves a relative root against the current working directory", async () => {
		const root = makeTempDir("static-relative");
		await fs.promises.writeFile(path.join(root, "index.html"), "relative");
		const relative = path.relative(process.cwd(), root);

		await withServer(relative, async (port) => {
			const response = await request(port, "/index.html?fresh=1");
			expect(response.status).toBe(200);
			expect(response.body).toBe("relative");
		});
	});

	it("serves a file created after the server starts", async () => {
		const root = makeTempDir("static-fresh");

		await withServer(root, async (port) => {
			await fs.promises.writeFile(path.join(root, "new.txt"), "fresh");
			const response = await request(port, "/new.txt");
			expect(response.status).toBe(200);
			expect(response.body).toBe("fresh");
		});
	});

	it("serves directory indexes and extensionless html", async () => {
		const root = makeTempDir("static-clean");
		await fs.promises.mkdir(path.join(root, "docs"));
		await fs.promises.writeFile(path.join(root, "docs", "index.html"), "docs");
		await fs.promises.mkdir(path.join(root, "page"));
		await fs.promises.writeFile(
			path.join(root, "page", "index.html"),
			"from-index",
		);
		await fs.promises.writeFile(path.join(root, "page.html"), "from-html");
		await fs.promises.writeFile(path.join(root, "only.html"), "only");
		await fs.promises.mkdir(path.join(root, "ext.html"));
		await fs.promises.writeFile(
			path.join(root, "ext.html", "index.html"),
			"ext-dir",
		);

		await withServer(root, async (port) => {
			expect((await request(port, "/docs/")).body).toBe("docs");
			expect((await request(port, "/docs")).body).toBe("docs");
			expect((await request(port, "/page")).body).toBe("from-index");
			expect((await request(port, "/only")).body).toBe("only");
			expect((await request(port, "/ext.html")).body).toBe("ext-dir");
		});
	});

	it("serves an empty file and ignores range requests", async () => {
		const root = makeTempDir("static-empty");
		await fs.promises.writeFile(path.join(root, "empty.txt"), "");
		await fs.promises.writeFile(path.join(root, "full.txt"), "abcdef");

		await withServer(root, async (port) => {
			const empty = await request(port, "/empty.txt");
			expect(empty.status).toBe(200);
			expect(empty.body).toBe("");
			expect(empty.headers["content-length"]).toBe("0");

			const ranged = await request(port, "/full.txt", "GET", {
				Range: "bytes=0-1",
			});
			expect(ranged.status).toBe(200);
			expect(ranged.body).toBe("abcdef");
		});
	});

	it("sets content types from the file extension", async () => {
		const root = makeTempDir("static-types");
		const files: Record<string, string> = {
			"app.css": "text/css; charset=utf-8",
			"app.js": "text/javascript; charset=utf-8",
			"app.mjs": "text/javascript; charset=utf-8",
			"data.json": "application/json; charset=utf-8",
			"feed.xml": "application/xml; charset=utf-8",
			"notes.txt": "text/plain; charset=utf-8",
			"notes.md": "text/plain; charset=utf-8",
			"logo.svg": "image/svg+xml",
			"logo.png": "image/png",
			"logo.jpg": "image/jpeg",
			"logo.jpeg": "image/jpeg",
			"logo.gif": "image/gif",
			"logo.webp": "image/webp",
			"logo.avif": "image/avif",
			"favicon.ico": "image/x-icon",
			"font.woff": "font/woff",
			"font.woff2": "font/woff2",
			"font.ttf": "font/ttf",
			"font.otf": "font/otf",
			"app.js.map": "application/json; charset=utf-8",
			"doc.pdf": "application/pdf",
			"site.webmanifest": "application/manifest+json",
			"Page.HTML": "text/html; charset=utf-8",
			LICENSE: "application/octet-stream",
			"unknown.bin": "application/octet-stream",
		};

		await Promise.all(
			Object.keys(files).map((name) =>
				fs.promises.writeFile(path.join(root, name), "x"),
			),
		);

		await withServer(root, async (port) => {
			for (const [name, contentType] of Object.entries(files)) {
				const response = await request(port, `/${name}`);
				expect(response.status, name).toBe(200);
				expect(response.headers["content-type"], name).toBe(contentType);
			}
		});
	});

	it("serves encoded paths and answers HEAD without a body", async () => {
		const root = makeTempDir("static-head");
		await fs.promises.writeFile(path.join(root, "中.txt"), "unicode");
		await fs.promises.writeFile(path.join(root, "index.html"), "home");

		await withServer(root, async (port) => {
			const encoded = await request(port, "/%E4%B8%AD.txt");
			expect(encoded.status).toBe(200);
			expect(encoded.body).toBe("unicode");

			const head = await request(port, "/", "HEAD");
			expect(head.status).toBe(200);
			expect(head.body).toBe("");
			expect(head.headers["content-type"]).toBe("text/html; charset=utf-8");
			expect(Number(head.headers["content-length"])).toBeGreaterThan(0);

			const missingHead = await request(port, "/missing", "HEAD");
			expect(missingHead.status).toBe(404);
			expect(missingHead.body).toBe("");
			expect(Number(missingHead.headers["content-length"])).toBeGreaterThan(0);
		});
	});

	it("rejects missing files, listings, and unsupported methods", async () => {
		const root = makeTempDir("static-missing");
		await fs.promises.writeFile(path.join(root, "index.html"), "home");
		await fs.promises.mkdir(path.join(root, "empty"));
		await fs.promises.writeFile(
			path.join(root, "empty", "secret.txt"),
			"hidden",
		);
		await fs.promises.writeFile(path.join(root, "logo.png"), "png");

		await withServer(root, async (port) => {
			const missing = await request(port, "/missing");
			expect(missing.status).toBe(404);
			expect(missing.headers["content-type"]).toBe("text/html; charset=utf-8");
			expect(missing.body).toContain("Not Found");

			const listing = await request(port, "/empty/");
			expect(listing.status).toBe(404);
			expect(listing.body).not.toContain("secret.txt");

			const nested = await request(port, "/logo.png/nested");
			expect(nested.status).toBe(404);

			const posted = await request(port, "/", "POST");
			expect(posted.status).toBe(405);
			expect(posted.headers.allow).toBe("GET, HEAD");
			expect(posted.body).toBe("Method Not Allowed");

			const put = await request(port, "/index.html", "PUT");
			expect(put.status).toBe(405);
		});
	});

	it("rejects malformed paths and paths that escape the root", async () => {
		const root = makeTempDir("static-escape");
		const outside = makeTempDir("static-outside");
		await fs.promises.writeFile(path.join(root, "index.html"), "home");
		await fs.promises.writeFile(
			path.join(outside, "secret.txt"),
			"super-secret",
		);

		await withServer(root, async (port) => {
			const badEncoding = await request(port, "/%ZZ");
			expect(badEncoding.status).toBe(400);
			expect(badEncoding.body).toBe("Bad Request");

			const nullByte = await request(port, "/a%00b");
			expect(nullByte.status).toBe(400);

			const encodedDots = await request(port, "/%2e%2e%2f%2e%2e%2fetc/passwd");
			expect(encodedDots.status).toBe(400);
			expect(encodedDots.body).not.toContain("root:");

			const encodedSlash = await request(port, "/%2f..%2fetc/passwd");
			expect(encodedSlash.status).toBe(400);

			const backslash = await request(port, "/%5c..%5c..%5cetc%5cpasswd");
			expect(backslash.status).toBe(400);

			const collapsed = await request(port, "/%2e%2e/%2e%2e/etc/passwd");
			expect(collapsed.status).toBe(404);
			expect(collapsed.body).not.toContain("root:");
		});
	});

	it("does not follow symlinks, including links that point outside root", async () => {
		const root = makeTempDir("static-symlinks");
		const outside = makeTempDir("static-symlink-outside");
		await fs.promises.writeFile(
			path.join(outside, "secret.txt"),
			"super-secret",
		);
		await fs.promises.writeFile(path.join(root, "real.txt"), "real");
		await fs.promises.symlink(
			path.join(root, "real.txt"),
			path.join(root, "alias.txt"),
		);
		await fs.promises.symlink(
			path.join(outside, "secret.txt"),
			path.join(root, "secret.txt"),
		);
		await fs.promises.symlink(outside, path.join(root, "outside-dir"));
		await fs.promises.mkdir(path.join(root, "real-dir"));
		await fs.promises.writeFile(
			path.join(root, "real-dir", "note.txt"),
			"inside",
		);
		await fs.promises.symlink(
			path.join(root, "real-dir"),
			path.join(root, "linked-dir"),
		);
		await fs.promises.writeFile(path.join(root, "home.html"), "home");
		await fs.promises.symlink(
			path.join(root, "home.html"),
			path.join(root, "index.html"),
		);

		await withServer(root, async (port) => {
			const alias = await request(port, "/alias.txt");
			expect(alias.status).toBe(404);
			expect(alias.body).not.toContain("real");

			const secret = await request(port, "/secret.txt");
			expect(secret.status).toBe(404);
			expect(secret.body).not.toContain("super-secret");

			const escaped = await request(port, "/outside-dir/secret.txt");
			expect(escaped.status).toBe(404);
			expect(escaped.body).not.toContain("super-secret");

			const inside = await request(port, "/linked-dir/note.txt");
			expect(inside.status).toBe(200);
			expect(inside.body).toBe("inside");

			const indexLink = await request(port, "/");
			expect(indexLink.status).toBe(404);
		});
	});

	it("returns 404 for / when the output directory has no index", async () => {
		const root = makeTempDir("static-no-index");

		await withServer(root, async (port) => {
			const response = await request(port, "/");
			expect(response.status).toBe(404);
		});
	});

	it("returns 500 when reading the file fails before headers are sent", async () => {
		const root = makeTempDir("static-read-error");
		await fs.promises.writeFile(path.join(root, "index.html"), "home");
		vi.spyOn(fs, "createReadStream").mockImplementation(() => {
			const stream = new Readable({
				read() {
					// Hold the stream open until the injected error fires.
				},
			});
			process.nextTick(() => {
				stream.emit("error", new Error("denied"));
			});
			return stream as fs.ReadStream;
		});

		await withServer(root, async (port) => {
			const response = await request(port, "/");
			expect(response.status).toBe(500);
			expect(response.body).toBe("Internal Server Error");

			const head = await request(port, "/", "HEAD");
			expect(head.status).toBe(500);
			expect(head.body).toBe("");
		});
	});

	it("destroys the response when the file stream fails after headers", async () => {
		const root = makeTempDir("static-late-error");
		await fs.promises.writeFile(path.join(root, "index.html"), "home");
		vi.spyOn(fs, "createReadStream").mockImplementation(() => {
			const stream = new Readable({
				read() {
					process.nextTick(() => {
						this.emit("error", new Error("late"));
					});
				},
			});
			process.nextTick(() => {
				stream.emit("open");
			});
			return stream as fs.ReadStream;
		});

		await withServer(root, async (port) => {
			const outcome = await new Promise<{ failed: boolean }>((resolve) => {
				const req = http.get(
					{ hostname: "127.0.0.1", port, path: "/" },
					(response) => {
						response.resume();
						response.on("aborted", () => {
							resolve({ failed: true });
						});
						response.on("error", () => {
							resolve({ failed: true });
						});
						response.on("end", () => {
							resolve({ failed: false });
						});
					},
				);
				req.on("error", () => {
					resolve({ failed: true });
				});
			});
			expect(outcome.failed).toBe(true);
		});
	});

	it("returns 500 when the filesystem lookup fails", async () => {
		const root = makeTempDir("static-stat-error");
		await fs.promises.writeFile(path.join(root, "index.html"), "home");
		vi.spyOn(fs.promises, "lstat").mockRejectedValue(
			Object.assign(new Error("io"), { code: "EIO" }),
		);

		await withServer(root, async (port) => {
			const response = await request(port, "/index.html");
			expect(response.status).toBe(500);
			expect(response.body).toBe("Internal Server Error");
		});
	});

	it("returns 500 when realpath fails", async () => {
		const root = makeTempDir("static-realpath-error");
		await fs.promises.writeFile(path.join(root, "index.html"), "home");
		vi.spyOn(fs.promises, "realpath").mockRejectedValue(new Error("gone"));

		await withServer(root, async (port) => {
			const response = await request(port, "/index.html");
			expect(response.status).toBe(500);
		});
	});

	it("rejects a request whose method or url the HTTP parser did not set", async () => {
		const root = makeTempDir("static-direct");
		await fs.promises.writeFile(path.join(root, "index.html"), "home");
		const handle = createStaticHandler({ root });

		const missingMethod = await invoke(handle, undefined, "/");
		expect(missingMethod.statusCode).toBe(405);

		const missingUrl = await invoke(handle, "GET", undefined);
		expect(missingUrl.statusCode).toBe(400);

		const badUrl = await invoke(handle, "GET", "http://[");
		expect(badUrl.statusCode).toBe(400);
	});
});

async function withServer(
	root: string,
	run: (port: number) => Promise<void>,
): Promise<void> {
	const handle = createStaticHandler({ root });
	const server = http.createServer((request, response) => {
		void handle(request, response);
	});
	await new Promise<void>((resolve) => {
		server.listen(0, "127.0.0.1", () => {
			resolve();
		});
	});
	const address = server.address();
	const port = typeof address === "object" && address ? address.port : 0;

	try {
		await run(port);
	} finally {
		await new Promise<void>((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
	}
}

function request(
	port: number,
	urlPath: string,
	method = "GET",
	headers?: http.OutgoingHttpHeaders,
): Promise<ResponseResult> {
	return new Promise((resolve, reject) => {
		const req = http.request(
			{ hostname: "127.0.0.1", port, path: urlPath, method, headers },
			(response) => {
				const chunks: Buffer[] = [];
				response.on("data", (chunk: Buffer) => {
					chunks.push(chunk);
				});
				response.on("end", () => {
					resolve({
						status: response.statusCode ?? 0,
						headers: response.headers,
						body: Buffer.concat(chunks).toString("utf8"),
					});
				});
			},
		);
		req.on("error", reject);
		req.end();
	});
}

async function invoke(
	handle: ReturnType<typeof createStaticHandler>,
	method: string | undefined,
	url: string | undefined,
): Promise<{ statusCode: number; body?: string }> {
	const response = {
		headersSent: false,
		statusCode: 0,
		body: undefined as string | undefined,
		writeHead(status: number) {
			this.statusCode = status;
			this.headersSent = true;
			return this;
		},
		end(body?: string) {
			this.body = body;
		},
		destroy() {
			this.headersSent = true;
		},
	};

	await handle(
		{ method, url } as IncomingMessage,
		response as unknown as ServerResponse,
	);
	return response;
}
