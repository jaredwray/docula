import { promises as dns } from "node:dns";
import net from "node:net";
import ipaddr from "ipaddr.js";
import { Agent, type Dispatcher, fetch as undiciFetch } from "undici";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024;
const MAX_URL_LENGTH = 8192;

const BLOCKED_HOSTNAMES = new Set([
	"localhost",
	"ip6-localhost",
	"ip6-loopback",
	"localhost.localdomain",
]);

const BLOCKED_IPV4_RANGES = new Set<string>([
	"unspecified",
	"broadcast",
	"multicast",
	"linkLocal",
	"loopback",
	"carrierGradeNat",
	"private",
	"reserved",
	"as112",
	"amt",
]);

const BLOCKED_IPV6_RANGES = new Set<string>([
	"unspecified",
	"linkLocal",
	"multicast",
	"loopback",
	"uniqueLocal",
	"discard",
	"rfc6145",
	"rfc6052",
	"teredo",
	"benchmarking",
	"amt",
	"as112v6",
	"reserved",
]);

export class SsrfBlockedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SsrfBlockedError";
	}
}

/**
 * Returns true if `ip` is NOT publicly routable.
 *
 * IPv4-mapped (`::ffff:a.b.c.d`), 6to4 (`2002:hh:hh::/16`), and the deprecated
 * IPv4-compatible (`::a.b.c.d`) IPv6 forms all unwrap to an embedded IPv4
 * address and are re-validated against the IPv4 rules. Writing a private IPv4
 * in any of these IPv6 spellings — including the hex form `::ffff:7f00:1` —
 * therefore does not bypass the IPv4 deny-list.
 *
 * Failure-closed: malformed input is treated as private.
 */
export function isPrivateIp(ip: string): boolean {
	if (!ipaddr.isValid(ip)) return true;

	const parsed = ipaddr.parse(ip);

	if (parsed.kind() === "ipv4") {
		return BLOCKED_IPV4_RANGES.has(parsed.range());
	}

	const v6 = parsed as ipaddr.IPv6;
	const range = v6.range();

	if (range === "ipv4Mapped") {
		return isPrivateIp(v6.toIPv4Address().toString());
	}

	if (range === "6to4") {
		const parts = v6.parts;
		const a = (parts[1] ?? 0) >> 8;
		const b = (parts[1] ?? 0) & 0xff;
		const c = (parts[2] ?? 0) >> 8;
		const d = (parts[2] ?? 0) & 0xff;
		return isPrivateIp(`${a}.${b}.${c}.${d}`);
	}

	if (range !== "unicast") {
		return BLOCKED_IPV6_RANGES.has(range);
	}

	// IPv4-compatible (::a.b.c.d): first 96 bits zero, last 32 bits the v4.
	// ipaddr.js classifies these as "unicast" so we unwrap and re-validate.
	// ::1 lands under "loopback" above, so we never see it here.
	const parts = v6.parts;
	if (
		parts[0] === 0 &&
		parts[1] === 0 &&
		parts[2] === 0 &&
		parts[3] === 0 &&
		parts[4] === 0 &&
		parts[5] === 0 &&
		!(parts[6] === 0 && parts[7] === 0)
	) {
		const a = (parts[6] ?? 0) >> 8;
		const b = (parts[6] ?? 0) & 0xff;
		const c = (parts[7] ?? 0) >> 8;
		const d = (parts[7] ?? 0) & 0xff;
		return isPrivateIp(`${a}.${b}.${c}.${d}`);
	}

	return false;
}

export type ResolvedAddress = { address: string; family: 4 | 6 };

export type DnsLookupAllFn = (
	hostname: string,
	options: { all: true; verbatim?: boolean },
) => Promise<Array<{ address: string; family: number }>>;

export type AssertPublicOptions = {
	lookup?: DnsLookupAllFn;
};

/**
 * Validates `url` and, for hostname-based URLs, resolves and validates every
 * returned IP. Throws SsrfBlockedError if the URL is unparseable, uses a
 * non-http(s) scheme, embeds credentials, targets a blocked hostname like
 * `localhost`, or resolves to any non-publicly-routable IP. Returns the
 * parsed URL and the validated addresses so the caller can pin them at
 * connect time and close the DNS-rebinding TOCTOU window.
 */
export async function resolveAndValidate(
	url: string,
	options: AssertPublicOptions = {},
): Promise<{ urlObj: URL; resolved: ResolvedAddress[] }> {
	if (url.length > MAX_URL_LENGTH) {
		throw new SsrfBlockedError(
			`URL exceeds ${MAX_URL_LENGTH} characters (got ${url.length})`,
		);
	}

	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new SsrfBlockedError(`Invalid URL: ${url}`);
	}

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new SsrfBlockedError(
			`Only http(s) URLs are allowed (got ${parsed.protocol})`,
		);
	}

	if (parsed.username || parsed.password) {
		throw new SsrfBlockedError(
			"Refusing to fetch URL with embedded credentials",
		);
	}

	const rawHostname = parsed.hostname;
	/* v8 ignore next 3 -- @preserve */
	if (!rawHostname) {
		throw new SsrfBlockedError("URL has no hostname");
	}

	const hostname =
		rawHostname.startsWith("[") && rawHostname.endsWith("]")
			? rawHostname.slice(1, -1)
			: rawHostname;
	const lowerHost = hostname.toLowerCase();
	if (
		BLOCKED_HOSTNAMES.has(lowerHost) ||
		lowerHost.endsWith(".localhost") ||
		lowerHost.endsWith(".localhost.localdomain")
	) {
		throw new SsrfBlockedError(`Refusing to fetch from ${hostname}`);
	}

	if (net.isIP(hostname)) {
		if (isPrivateIp(hostname)) {
			throw new SsrfBlockedError(
				`Refusing to fetch from non-public IP ${hostname}`,
			);
		}
		return {
			urlObj: parsed,
			resolved: [
				{
					address: hostname,
					family: net.isIPv6(hostname) ? 6 : 4,
				},
			],
		};
	}

	const lookupFn = (options.lookup ?? dns.lookup) as DnsLookupAllFn;
	let addresses: Array<{ address: string; family: number }>;
	try {
		addresses = await lookupFn(hostname, { all: true, verbatim: true });
	} catch (error) {
		throw new SsrfBlockedError(
			`DNS lookup for ${hostname} failed: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}

	if (addresses.length === 0) {
		throw new SsrfBlockedError(
			`DNS lookup for ${hostname} returned no addresses`,
		);
	}

	for (const { address } of addresses) {
		if (isPrivateIp(address)) {
			throw new SsrfBlockedError(
				`Refusing to fetch from ${hostname} — resolves to non-public IP ${address}`,
			);
		}
	}

	return {
		urlObj: parsed,
		resolved: addresses.map((a) => ({
			address: a.address,
			family: (a.family === 6 ? 6 : 4) as 4 | 6,
		})),
	};
}

type LookupCallback = (
	err: NodeJS.ErrnoException | null,
	addressOrList?: string | ResolvedAddress[],
	family?: number,
) => void;

/**
 * Builds a `net.lookup`-shaped callback that always returns the pre-validated
 * `resolved` addresses, ignoring the hostname argument. Supports both call
 * signatures: when `opts.all` is truthy the callback receives the full array;
 * otherwise (the shape Node uses when `autoSelectFamily` is disabled) the
 * callback receives a single `address, family` pair.
 */
export function pinnedLookup(
	resolved: ResolvedAddress[],
): (
	hostname: string,
	opts: { all?: boolean },
	callback: LookupCallback,
) => void {
	return (_hostname, opts, callback) => {
		if (opts.all) {
			callback(null, resolved);
			return;
		}
		const first = resolved[0];
		/* v8 ignore next 4 -- resolved is non-empty by construction in safeFetch -- @preserve */
		if (!first) {
			callback(
				new Error("No pinned address available") as NodeJS.ErrnoException,
			);
			return;
		}
		callback(null, first.address, first.family);
	};
}

export type SafeFetchOptions = {
	timeoutMs?: number;
	maxRedirects?: number;
	maxBodyBytes?: number;
	lookup?: DnsLookupAllFn;
	fetchImpl?: typeof undiciFetch;
};

/**
 * fetch wrapper hardened against SSRF:
 *  - Scheme allow-list (http/https), no embedded credentials, no localhost.
 *  - The resolved IP is pinned to undici's TCP connect via a custom Agent
 *    `lookup`, so fetch does not re-resolve the hostname. This closes the
 *    DNS-rebinding TOCTOU window between validation and connect. TLS SNI
 *    and certificate validation still use the original hostname because
 *    undici's connector passes `host: hostname` to `tls.connect` regardless
 *    of what `lookup` returns; if that internal contract changes in a future
 *    undici release, this wrapper's TLS-hostname guarantee will need to be
 *    re-checked.
 *  - Redirects are followed manually; each target is re-validated and the
 *    new connect is re-pinned. The previous hop's body is cancelled before
 *    moving on so the connection is released instead of being held open.
 *  - `timeoutMs` bounds the total wall-clock budget — the AbortController
 *    survives until the returned body is fully consumed (or errors), so a
 *    slow-drip body cannot bypass the deadline.
 *  - `maxBodyBytes` caps the response body up-front via `content-length`
 *    (when it parses cleanly as a decimal integer) and during streaming.
 *  - URLs over `MAX_URL_LENGTH` are rejected before parsing.
 *  - Per-hop Agents are `destroy()`ed (not gracefully `close()`d) on error
 *    or after the body is consumed, so a malicious server cannot leak
 *    sockets by holding a redirected body open.
 */
export async function safeFetch(
	url: string,
	options: SafeFetchOptions = {},
): Promise<Response> {
	const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
	const fetchImpl = options.fetchImpl ?? undiciFetch;
	const lookup = options.lookup;

	const totalController = new AbortController();
	const totalTimer = setTimeout(() => totalController.abort(), timeoutMs);
	const dispatchers: Dispatcher[] = [];

	let cleaned = false;
	const cleanup = () => {
		if (cleaned) return;
		cleaned = true;
		clearTimeout(totalTimer);
		for (const d of dispatchers) {
			d.destroy().catch(() => {});
		}
	};

	let currentUrl = url;
	try {
		for (let hop = 0; hop <= maxRedirects; hop++) {
			const { resolved } = await resolveAndValidate(currentUrl, { lookup });

			const dispatcher = new Agent({
				connect: {
					lookup: pinnedLookup(resolved),
				},
			});
			dispatchers.push(dispatcher);

			const response = (await fetchImpl(currentUrl, {
				dispatcher,
				redirect: "manual",
				signal: totalController.signal,
			})) as unknown as Response;

			if (response.status >= 300 && response.status < 400) {
				const location = response.headers.get("location");
				if (location) {
					await response.body?.cancel().catch(() => {});
					dispatcher.destroy().catch(() => {});
					dispatchers.pop();
					let nextUrl: string;
					try {
						nextUrl = new URL(location, currentUrl).toString();
					} catch {
						throw new SsrfBlockedError(
							`Invalid redirect Location header (${location}) from ${currentUrl}`,
						);
					}
					currentUrl = nextUrl;
					continue;
				}
				return capResponseBody(response, maxBodyBytes, cleanup);
			}

			return capResponseBody(response, maxBodyBytes, cleanup);
		}

		throw new SsrfBlockedError(
			`Too many redirects (>${maxRedirects}) starting at ${url}`,
		);
	} catch (error) {
		cleanup();
		throw error;
	}
}

function capResponseBody(
	response: Response,
	maxBytes: number,
	onDone: () => void,
): Response {
	const contentLength = response.headers.get("content-length");
	if (contentLength && /^\d+$/.test(contentLength)) {
		const n = Number.parseInt(contentLength, 10);
		if (n > maxBytes) {
			onDone();
			throw new SsrfBlockedError(
				`Response body exceeds ${maxBytes} bytes (content-length: ${n})`,
			);
		}
	}

	if (!response.body) {
		onDone();
		return response;
	}

	const reader = response.body.getReader();
	let received = 0;
	let finalized = false;
	const finalize = () => {
		if (finalized) return;
		finalized = true;
		onDone();
	};

	const cappedStream = new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const { value, done } = await reader.read();
				if (done) {
					controller.close();
					finalize();
					return;
				}
				received += value.byteLength;
				if (received > maxBytes) {
					controller.error(
						new SsrfBlockedError(
							`Response body exceeds ${maxBytes} bytes (streamed)`,
						),
					);
					reader.cancel().catch(() => {});
					finalize();
					return;
				}
				controller.enqueue(value);
				/* v8 ignore start -- reader.read() errors propagate; defensive cleanup -- @preserve */
			} catch (error) {
				controller.error(error);
				finalize();
			}
			/* v8 ignore stop */
		},
		/* v8 ignore next 4 -- only invoked when the consumer cancels the body stream -- @preserve */
		cancel() {
			reader.cancel().catch(() => {});
			finalize();
		},
	});

	return new Response(cappedStream, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});
}
