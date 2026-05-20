import { Agent } from "undici";
import { describe, expect, it, vi } from "vitest";
import {
	isPrivateIp,
	resolveAndValidate,
	SsrfBlockedError,
	safeFetch,
} from "../src/safe-fetch.js";

const publicLookup = vi.fn(async () => [
	{ address: "93.184.216.34", family: 4 },
]);

describe("safe-fetch — isPrivateIp (IPv4)", () => {
	it("blocks RFC1918, loopback, link-local, multicast, broadcast, CGNAT, TEST-NETs", () => {
		const blocked = [
			"0.0.0.0",
			"10.0.0.1",
			"10.255.255.255",
			"100.64.0.1",
			"100.127.255.255",
			"127.0.0.1",
			"127.1.2.3",
			"169.254.169.254",
			"172.16.0.1",
			"172.31.255.255",
			"192.0.0.1",
			"192.0.2.1",
			"192.168.1.1",
			"198.18.0.1",
			"198.19.255.255",
			"198.51.100.1",
			"203.0.113.1",
			"224.0.0.1",
			"239.255.255.255",
			"240.0.0.1",
			"255.255.255.255",
		];
		for (const ip of blocked) {
			expect(isPrivateIp(ip), `expected ${ip} to be blocked`).toBe(true);
		}
	});

	it("allows publicly routable IPv4 addresses", () => {
		const allowed = [
			"1.1.1.1",
			"8.8.8.8",
			"93.184.216.34",
			"100.63.255.255",
			"100.128.0.1",
			"172.15.255.255",
			"172.32.0.1",
			"169.253.255.255",
		];
		for (const ip of allowed) {
			expect(isPrivateIp(ip), `expected ${ip} to be allowed`).toBe(false);
		}
	});

	it("blocks malformed input (fail-closed)", () => {
		expect(isPrivateIp("not-an-ip")).toBe(true);
		expect(isPrivateIp("256.0.0.1")).toBe(true);
		expect(isPrivateIp("")).toBe(true);
	});
});

describe("safe-fetch — isPrivateIp (IPv6, including v4-wrapping forms)", () => {
	it("blocks IPv6 loopback, unspecified, ULA, link-local, multicast, NAT64, documentation", () => {
		const blocked = [
			"::",
			"::1",
			"fc00::1",
			"fd12:3456:789a::1",
			"fe80::1",
			"febf::1",
			"ff00::1",
			"ff02::1",
			"64:ff9b::1.2.3.4",
			"2001:db8::1",
		];
		for (const ip of blocked) {
			expect(isPrivateIp(ip), `expected ${ip} to be blocked`).toBe(true);
		}
	});

	it("blocks IPv4-mapped IPv6 in both dotted-quad and hex form", () => {
		expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
		expect(isPrivateIp("::ffff:169.254.169.254")).toBe(true);
		expect(isPrivateIp("::ffff:10.0.0.1")).toBe(true);
		expect(isPrivateIp("::ffff:7f00:1")).toBe(true);
		expect(isPrivateIp("::ffff:a9fe:a9fe")).toBe(true);
		expect(isPrivateIp("::ffff:c0a8:1")).toBe(true);
	});

	it("blocks IPv4-compatible IPv6 (`::a.b.c.d` / hex equivalents)", () => {
		expect(isPrivateIp("::7f00:1")).toBe(true);
		expect(isPrivateIp("::a9fe:a9fe")).toBe(true);
		expect(isPrivateIp("::a00:1")).toBe(true);
	});

	it("blocks 6to4 wrapping a private IPv4", () => {
		expect(isPrivateIp("2002:7f00:1::")).toBe(true);
		expect(isPrivateIp("2002:a9fe:a9fe::")).toBe(true);
		expect(isPrivateIp("2002:a00:1::")).toBe(true);
	});

	it("allows global-unicast IPv6 and v4-wrapping forms pointing at public v4", () => {
		expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
		expect(isPrivateIp("2001:4860:4860::8888")).toBe(false);
		expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
		expect(isPrivateIp("::ffff:808:808")).toBe(false);
		expect(isPrivateIp("2002:808:808::")).toBe(false);
		expect(isPrivateIp("::8.8.8.8")).toBe(false);
		expect(isPrivateIp("::808:808")).toBe(false);
	});
});

describe("safe-fetch — resolveAndValidate", () => {
	it("accepts a public https URL and returns the resolved addresses", async () => {
		const { urlObj, resolved } = await resolveAndValidate(
			"https://example.com/spec.json",
			{ lookup: publicLookup },
		);
		expect(urlObj.hostname).toBe("example.com");
		expect(resolved).toEqual([{ address: "93.184.216.34", family: 4 }]);
	});

	it("rejects unparseable URLs", async () => {
		await expect(
			resolveAndValidate("not a url", { lookup: publicLookup }),
		).rejects.toThrow(SsrfBlockedError);
	});

	it("rejects non-http(s) schemes", async () => {
		for (const url of [
			"file:///etc/passwd",
			"ftp://example.com/x",
			"gopher://example.com/",
			"data:text/plain,hello",
		]) {
			await expect(
				resolveAndValidate(url, { lookup: publicLookup }),
			).rejects.toThrow(SsrfBlockedError);
		}
	});

	it("rejects URLs with embedded credentials", async () => {
		await expect(
			resolveAndValidate("https://user:pass@example.com/", {
				lookup: publicLookup,
			}),
		).rejects.toThrow(/credentials/);
		await expect(
			resolveAndValidate("https://user@example.com/", {
				lookup: publicLookup,
			}),
		).rejects.toThrow(/credentials/);
	});

	it("rejects localhost, ip6-localhost, *.localhost without DNS", async () => {
		const lookup = vi.fn();
		for (const url of [
			"http://localhost/",
			"http://LOCALHOST/",
			"http://api.localhost/",
			"http://ip6-localhost/",
			"http://ip6-loopback/",
			"http://localhost.localdomain/",
		]) {
			await expect(resolveAndValidate(url, { lookup })).rejects.toThrow(
				SsrfBlockedError,
			);
		}
		expect(lookup).not.toHaveBeenCalled();
	});

	it("rejects literal private IPs (including v6 forms) without DNS", async () => {
		const lookup = vi.fn();
		for (const url of [
			"http://169.254.169.254/latest/meta-data/",
			"http://[::1]/",
			"http://[::ffff:7f00:1]/",
			"http://[::ffff:a9fe:a9fe]/",
			"http://[2002:a9fe:a9fe::]/",
		]) {
			await expect(resolveAndValidate(url, { lookup })).rejects.toThrow(
				/non-public IP/,
			);
		}
		expect(lookup).not.toHaveBeenCalled();
	});

	it("accepts a literal public IP without DNS", async () => {
		const lookup = vi.fn();
		const { resolved } = await resolveAndValidate("https://1.1.1.1/spec.json", {
			lookup,
		});
		expect(resolved).toEqual([{ address: "1.1.1.1", family: 4 }]);
		expect(lookup).not.toHaveBeenCalled();
	});

	it("blocks when any resolved address is private", async () => {
		const lookup = vi.fn(async () => [
			{ address: "8.8.8.8", family: 4 },
			{ address: "127.0.0.1", family: 4 },
		]);
		await expect(
			resolveAndValidate("https://attacker.example.com/", { lookup }),
		).rejects.toThrow(/non-public IP 127\.0\.0\.1/);
	});

	it("blocks when DNS lookup fails", async () => {
		const lookup = vi.fn(async () => {
			throw new Error("ENOTFOUND");
		});
		await expect(
			resolveAndValidate("https://does-not-exist.invalid/", { lookup }),
		).rejects.toThrow(/DNS lookup .* failed: ENOTFOUND/);
	});

	it("blocks when DNS lookup returns no addresses", async () => {
		const lookup = vi.fn(async () => []);
		await expect(
			resolveAndValidate("https://empty.example.com/", { lookup }),
		).rejects.toThrow(/returned no addresses/);
	});

	it("rejects URLs longer than the cap before parsing", async () => {
		const longUrl = `https://example.com/${"a".repeat(8200)}`;
		await expect(
			resolveAndValidate(longUrl, { lookup: publicLookup }),
		).rejects.toThrow(/exceeds 8192 characters/);
	});
});

describe("safe-fetch — safeFetch", () => {
	it("returns a 2xx response when the URL is public", async () => {
		const fetchImpl = vi.fn(
			async () => new Response("ok", { status: 200 }),
		) as unknown as typeof globalThis.fetch;
		const response = await safeFetch("https://example.com/spec.json", {
			lookup: publicLookup,
			fetchImpl: fetchImpl as never,
		});
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ok");
	});

	it("rejects before calling fetch when the URL is blocked", async () => {
		const fetchImpl = vi.fn() as unknown as typeof globalThis.fetch;
		await expect(
			safeFetch("http://169.254.169.254/", { fetchImpl: fetchImpl as never }),
		).rejects.toThrow(SsrfBlockedError);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("rejects the IPv6 IPv4-mapped hex bypass form", async () => {
		const fetchImpl = vi.fn() as unknown as typeof globalThis.fetch;
		await expect(
			safeFetch("http://[::ffff:a9fe:a9fe]/latest/meta-data/", {
				fetchImpl: fetchImpl as never,
			}),
		).rejects.toThrow(/non-public IP/);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("pins fetch to the validated IPs via an undici Agent (no TOCTOU)", async () => {
		const lookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);
		let observedDispatcher: unknown;
		const fetchImpl = vi.fn(async (_url, init?: RequestInit) => {
			observedDispatcher = (init as { dispatcher?: unknown })?.dispatcher;
			return new Response("ok", { status: 200 });
		}) as unknown as typeof globalThis.fetch;

		const response = await safeFetch("https://example.com/spec.json", {
			lookup,
			fetchImpl: fetchImpl as never,
		});
		expect(response.status).toBe(200);
		expect(lookup).toHaveBeenCalledTimes(1);
		expect(observedDispatcher).toBeInstanceOf(Agent);
	});

	it("redirect hop cancels the previous body so the connection is released", async () => {
		const bodyCancelled = vi.fn();
		const firstBody = new ReadableStream<Uint8Array>({
			start() {},
			cancel: bodyCancelled,
		});
		const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input.toString();
			if (url === "https://example.com/start") {
				return new Response(firstBody, {
					status: 302,
					headers: { location: "https://example.com/final" },
				});
			}
			return new Response("done", { status: 200 });
		}) as unknown as typeof globalThis.fetch;

		const response = await safeFetch("https://example.com/start", {
			lookup: publicLookup,
			fetchImpl: fetchImpl as never,
		});
		expect(response.status).toBe(200);
		expect(bodyCancelled).toHaveBeenCalledTimes(1);
	});

	it("rejects garbled redirect Location with SsrfBlockedError", async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response(null, {
					status: 302,
					headers: { location: "http://exa mple.com/" },
				}),
		) as unknown as typeof globalThis.fetch;

		await expect(
			safeFetch("https://example.com/start", {
				lookup: publicLookup,
				fetchImpl: fetchImpl as never,
			}),
		).rejects.toThrow(/Invalid redirect Location header/);
	});

	it("ignores non-decimal content-length and falls back to streaming cap", async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response("hi", {
					status: 200,
					headers: { "content-length": "99999999garbage" },
				}),
		) as unknown as typeof globalThis.fetch;

		const response = await safeFetch("https://example.com/ok", {
			lookup: publicLookup,
			fetchImpl: fetchImpl as never,
			maxBodyBytes: 1024,
		});
		expect(await response.text()).toBe("hi");
	});

	it("follows redirects to a public target and revalidates each hop", async () => {
		const calls: string[] = [];
		const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input.toString();
			calls.push(url);
			if (url === "https://example.com/start") {
				return new Response(null, {
					status: 302,
					headers: { location: "https://example.com/final" },
				});
			}
			return new Response("done", { status: 200 });
		}) as unknown as typeof globalThis.fetch;

		const response = await safeFetch("https://example.com/start", {
			lookup: publicLookup,
			fetchImpl: fetchImpl as never,
		});
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("done");
		expect(calls).toEqual([
			"https://example.com/start",
			"https://example.com/final",
		]);
	});

	it("rejects when a redirect points at a private host", async () => {
		const lookup = vi.fn(async (hostname: string) => {
			if (hostname === "example.com") {
				return [{ address: "93.184.216.34", family: 4 }];
			}
			return [{ address: "127.0.0.1", family: 4 }];
		});
		const fetchImpl = vi.fn(
			async () =>
				new Response(null, {
					status: 301,
					headers: { location: "http://internal.attacker.example/" },
				}),
		) as unknown as typeof globalThis.fetch;

		await expect(
			safeFetch("https://example.com/start", {
				lookup,
				fetchImpl: fetchImpl as never,
			}),
		).rejects.toThrow(SsrfBlockedError);
	});

	it("returns the redirect response untouched when location is missing", async () => {
		const fetchImpl = vi.fn(
			async () => new Response(null, { status: 302 }),
		) as unknown as typeof globalThis.fetch;
		const response = await safeFetch("https://example.com/", {
			lookup: publicLookup,
			fetchImpl: fetchImpl as never,
		});
		expect(response.status).toBe(302);
	});

	it("aborts when too many redirects are followed", async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response(null, {
					status: 302,
					headers: { location: "https://example.com/loop" },
				}),
		) as unknown as typeof globalThis.fetch;

		await expect(
			safeFetch("https://example.com/loop", {
				lookup: publicLookup,
				fetchImpl: fetchImpl as never,
				maxRedirects: 2,
			}),
		).rejects.toThrow(/Too many redirects/);
	});

	it("aborts the request when the total timeout elapses", async () => {
		const fetchImpl = vi.fn(async (_input, init?: RequestInit) => {
			return await new Promise<Response>((_, reject) => {
				init?.signal?.addEventListener("abort", () => {
					reject(new Error("aborted"));
				});
			});
		}) as unknown as typeof globalThis.fetch;

		await expect(
			safeFetch("https://example.com/slow", {
				lookup: publicLookup,
				fetchImpl: fetchImpl as never,
				timeoutMs: 5,
			}),
		).rejects.toThrow(/aborted/);
	});

	it("rejects up-front when content-length exceeds maxBodyBytes", async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response("x", {
					status: 200,
					headers: { "content-length": "10000000" },
				}),
		) as unknown as typeof globalThis.fetch;

		await expect(
			safeFetch("https://example.com/big", {
				lookup: publicLookup,
				fetchImpl: fetchImpl as never,
				maxBodyBytes: 1024,
			}),
		).rejects.toThrow(/exceeds 1024 bytes \(content-length/);
	});

	it("rejects mid-stream when the body exceeds maxBodyBytes without content-length", async () => {
		const chunk = new Uint8Array(2048);
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(chunk);
				controller.enqueue(chunk);
				controller.close();
			},
		});
		const fetchImpl = vi.fn(
			async () => new Response(stream, { status: 200 }),
		) as unknown as typeof globalThis.fetch;

		const response = await safeFetch("https://example.com/big", {
			lookup: publicLookup,
			fetchImpl: fetchImpl as never,
			maxBodyBytes: 3000,
		});
		await expect(response.text()).rejects.toThrow(
			/exceeds 3000 bytes \(streamed\)/,
		);
	});

	it("returns body unchanged when no Response.body is present", async () => {
		const fetchImpl = vi.fn(
			async () => new Response(null, { status: 204 }),
		) as unknown as typeof globalThis.fetch;
		const response = await safeFetch("https://example.com/", {
			lookup: publicLookup,
			fetchImpl: fetchImpl as never,
		});
		expect(response.status).toBe(204);
	});

	it("URL-length cap rejects oversized redirect targets too", async () => {
		const huge = `https://example.com/${"a".repeat(8200)}`;
		const fetchImpl = vi.fn(
			async () =>
				new Response(null, {
					status: 302,
					headers: { location: huge },
				}),
		) as unknown as typeof globalThis.fetch;

		await expect(
			safeFetch("https://example.com/start", {
				lookup: publicLookup,
				fetchImpl: fetchImpl as never,
			}),
		).rejects.toThrow(/exceeds 8192 characters/);
	});
});
