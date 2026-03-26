export type ApiSchemaProperty = {
	name: string;
	type: string;
	required: boolean;
	description: string;
	enumValues?: string[];
};

export type ApiOperationParameter = {
	name: string;
	in: string;
	required: boolean;
	type: string;
	description: string;
};

export type ApiRequestBody = {
	contentType: string;
	schemaProperties: ApiSchemaProperty[];
	example: string;
};

export type ApiResponse = {
	statusCode: string;
	statusClass: string;
	description: string;
	contentType: string;
	schemaProperties: ApiSchemaProperty[];
	example: string;
};

export type ApiCodeExamples = {
	curl: string;
	javascript: string;
	python: string;
};

export type ApiOperation = {
	id: string;
	method: string;
	methodUpper: string;
	path: string;
	summary: string;
	description: string;
	parameters: ApiOperationParameter[];
	requestBody?: ApiRequestBody;
	responses: ApiResponse[];
	codeExamples: ApiCodeExamples;
};

export type ApiGroup = {
	name: string;
	description: string;
	id: string;
	operations: ApiOperation[];
};

export type ApiOAuth2Flow = {
	authorizationUrl?: string;
	tokenUrl?: string;
	refreshUrl?: string;
	scopes: Record<string, string>;
};

export type ApiSecurityScheme = {
	key: string;
	type: string;
	scheme?: string;
	bearerFormat?: string;
	name?: string;
	in?: string;
	description: string;
	flows?: {
		authorizationCode?: ApiOAuth2Flow;
		implicit?: ApiOAuth2Flow;
		clientCredentials?: ApiOAuth2Flow;
		password?: ApiOAuth2Flow;
	};
};

export type ApiSpecData = {
	info: {
		title: string;
		description: string;
		version: string;
	};
	servers: Array<{ url: string; description: string }>;
	groups: ApiGroup[];
	securitySchemes: ApiSecurityScheme[];
};

// biome-ignore lint/suspicious/noExplicitAny: OpenAPI specs have dynamic structure
type SpecObject = Record<string, any>;

export function parseOpenApiSpec(specJson: string): ApiSpecData {
	const spec: SpecObject = JSON.parse(specJson);

	const info = {
		title: spec.info?.title ?? "",
		description: spec.info?.description ?? "",
		version: spec.info?.version ?? "",
	};

	const servers: Array<{ url: string; description: string }> = [];
	if (Array.isArray(spec.servers)) {
		for (const server of spec.servers) {
			/* v8 ignore start */
			servers.push({
				url: server.url ?? "",
				description: server.description ?? "",
			});
			/* v8 ignore stop */
		}
	}

	const tagDescriptions = new Map<string, string>();
	if (Array.isArray(spec.tags)) {
		for (const tag of spec.tags) {
			/* v8 ignore start */
			if (tag.name) {
				tagDescriptions.set(tag.name, tag.description ?? "");
			}
			/* v8 ignore stop */
		}
	}

	const groupedOperations = new Map<string, ApiOperation[]>();

	/* v8 ignore start */
	const paths: SpecObject = spec.paths ?? {};
	/* v8 ignore stop */
	for (const [pathStr, pathItem] of Object.entries(paths)) {
		if (!pathItem || typeof pathItem !== "object") {
			continue;
		}

		const methods = [
			"get",
			"post",
			"put",
			"delete",
			"patch",
			"head",
			"options",
		];
		for (const method of methods) {
			const operation = (pathItem as SpecObject)[method];
			if (!operation) {
				continue;
			}

			const tags: string[] =
				Array.isArray(operation.tags) && operation.tags.length > 0
					? operation.tags
					: [""];

			const parameters = extractParameters(operation, pathItem, spec);
			const requestBody = extractRequestBody(operation, spec);
			const responses = extractResponses(operation, spec);

			const baseUrl = servers.length > 0 ? servers[0].url : "";
			const codeExamples = generateCodeExamples(
				method,
				pathStr,
				baseUrl,
				parameters,
				requestBody,
			);

			const operationId =
				operation.operationId ??
				`${method}-${pathStr.replaceAll(/[^a-zA-Z0-9]/g, "-")}`;

			const apiOperation: ApiOperation = {
				id: slugify(operationId),
				method,
				methodUpper: method.toUpperCase(),
				path: pathStr,
				summary: operation.summary ?? "",
				description: operation.description ?? "",
				parameters,
				requestBody,
				responses,
				codeExamples,
			};

			for (const tag of tags) {
				const existing = groupedOperations.get(tag) ?? [];
				existing.push(apiOperation);
				groupedOperations.set(tag, existing);
			}
		}
	}

	const groups: ApiGroup[] = [];
	for (const [name, operations] of groupedOperations) {
		groups.push({
			name,
			description: tagDescriptions.get(name) ?? "",
			id: slugify(name),
			operations,
		});
	}

	const securitySchemes: ApiSecurityScheme[] = [];
	const schemesObj = spec.components?.securitySchemes as SpecObject | undefined;
	if (schemesObj && typeof schemesObj === "object") {
		for (const [key, value] of Object.entries(schemesObj)) {
			const scheme = value as SpecObject;
			const entry: ApiSecurityScheme = {
				key,
				type: scheme.type ?? "",
				scheme: scheme.scheme,
				bearerFormat: scheme.bearerFormat,
				name: scheme.name,
				in: scheme.in,
				description: scheme.description ?? "",
			};
			if (scheme.type === "oauth2" && scheme.flows) {
				entry.flows = {};
				for (const flowType of [
					"authorizationCode",
					"implicit",
					"clientCredentials",
					"password",
				] as const) {
					const flow = (scheme.flows as SpecObject)[flowType] as
						| SpecObject
						| undefined;
					if (flow) {
						entry.flows[flowType] = {
							authorizationUrl: flow.authorizationUrl,
							tokenUrl: flow.tokenUrl,
							refreshUrl: flow.refreshUrl,
							scopes: (flow.scopes as Record<string, string>) ?? {},
						};
					}
				}
			}
			securitySchemes.push(entry);
		}
	}

	return { info, servers, groups, securitySchemes };
}

function getStatusClass(statusCode: string): string {
	if (statusCode.startsWith("2")) {
		return "2xx";
	}

	if (statusCode.startsWith("3")) {
		return "3xx";
	}

	if (statusCode.startsWith("4")) {
		return "4xx";
	}

	if (statusCode.startsWith("5")) {
		return "5xx";
	}

	return "default";
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function resolveRef(ref: string, spec: SpecObject): SpecObject | undefined {
	if (!ref.startsWith("#/")) {
		return undefined;
	}

	const parts = ref.slice(2).split("/");
	let current: SpecObject = spec;
	for (const part of parts) {
		if (current && typeof current === "object" && part in current) {
			current = current[part] as SpecObject;
		} else {
			return undefined;
		}
	}

	return current;
}

function resolveSchema(
	schema: SpecObject | undefined,
	spec: SpecObject,
	visited: Set<string> = new Set(),
): SpecObject | undefined {
	if (!schema) {
		return undefined;
	}

	if (schema.$ref) {
		if (visited.has(schema.$ref)) {
			return { type: "object", description: "(circular reference)" };
		}

		visited.add(schema.$ref);
		const resolved = resolveRef(schema.$ref, spec);
		return resolved ? resolveSchema(resolved, spec, visited) : undefined;
	}

	return schema;
}

function extractSchemaProperties(
	schema: SpecObject | undefined,
	spec: SpecObject,
	visited: Set<string> = new Set(),
): ApiSchemaProperty[] {
	const resolved = resolveSchema(schema, spec, new Set(visited));
	if (!resolved) {
		return [];
	}

	const properties: ApiSchemaProperty[] = [];
	const requiredFields: string[] = Array.isArray(resolved.required)
		? resolved.required
		: [];

	if (resolved.properties && typeof resolved.properties === "object") {
		for (const [name, propSchema] of Object.entries(resolved.properties)) {
			const prop = resolveSchema(
				propSchema as SpecObject,
				spec,
				new Set(visited),
			);
			properties.push({
				name,
				type: getSchemaType(prop),
				required: requiredFields.includes(name),
				description: prop?.description ?? "",
				enumValues: Array.isArray(prop?.enum) ? prop.enum : undefined,
			});
		}
	} else if (resolved.type === "array" && resolved.items) {
		const itemSchema = resolveSchema(
			resolved.items as SpecObject,
			spec,
			new Set(visited),
		);
		properties.push({
			name: "(items)",
			type: getSchemaType(itemSchema),
			required: false,
			description: itemSchema?.description ?? "",
		});
	} else if (resolved.type && resolved.type !== "object") {
		properties.push({
			name: "(value)",
			type: resolved.type,
			required: false,
			description: resolved.description ?? "",
		});
	}

	return properties;
}

function getSchemaType(schema: SpecObject | undefined): string {
	/* v8 ignore next -- @preserve */
	if (!schema) {
		return "unknown";
	}

	if (schema.type === "array") {
		const items = schema.items as SpecObject | undefined;
		const itemType = items?.type ?? "any";
		return `array(${itemType})`;
	}

	if (schema.type) {
		if (schema.format) {
			return `${schema.type} (${schema.format})`;
		}

		return schema.type;
	}

	if (schema.oneOf || schema.anyOf) {
		return "oneOf";
	}

	if (schema.allOf) {
		return "allOf";
	}

	return "object";
}

function extractParameters(
	operation: SpecObject,
	pathItem: SpecObject,
	spec: SpecObject,
): ApiOperationParameter[] {
	const parameters: ApiOperationParameter[] = [];
	const allParams = [
		...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
		...(Array.isArray(operation.parameters) ? operation.parameters : []),
	];

	for (const param of allParams) {
		const resolved = param.$ref ? resolveRef(param.$ref, spec) : param;
		if (!resolved) {
			continue;
		}

		const paramSchema = resolveSchema(
			resolved.schema as SpecObject | undefined,
			spec,
		);

		/* v8 ignore start */
		parameters.push({
			name: resolved.name ?? "",
			in: resolved.in ?? "",
			required: Boolean(resolved.required),
			type: getSchemaType(paramSchema),
			description: resolved.description ?? "",
		});
		/* v8 ignore stop */
	}

	return parameters;
}

function extractRequestBody(
	operation: SpecObject,
	spec: SpecObject,
): ApiRequestBody | undefined {
	let requestBody = operation.requestBody;
	if (!requestBody) {
		return undefined;
	}

	if (requestBody.$ref) {
		requestBody = resolveRef(requestBody.$ref, spec);
		if (!requestBody) {
			return undefined;
		}
	}

	const content = requestBody.content as SpecObject | undefined;
	if (!content) {
		return undefined;
	}

	/* v8 ignore start */
	const contentType = Object.keys(content)[0] ?? "application/json";
	const mediaType = content[contentType] as SpecObject | undefined;
	/* v8 ignore stop */
	if (!mediaType) {
		return undefined;
	}

	const schema = mediaType.schema as SpecObject | undefined;
	const schemaProperties = extractSchemaProperties(schema, spec);

	let example = "";
	if (mediaType.example) {
		example = JSON.stringify(mediaType.example, null, 2);
	} else if (schema) {
		const generated = generateExampleFromSchema(schema, spec);
		/* v8 ignore start */
		if (generated !== undefined) {
			example = JSON.stringify(generated, null, 2);
		}
		/* v8 ignore stop */
	}

	return { contentType, schemaProperties, example };
}

function extractResponses(
	operation: SpecObject,
	spec: SpecObject,
): ApiResponse[] {
	const responses: ApiResponse[] = [];
	const responsesObj = operation.responses as SpecObject | undefined;
	if (!responsesObj) {
		return responses;
	}

	for (const [statusCode, responseObj] of Object.entries(responsesObj)) {
		let response = responseObj as SpecObject;
		if (response.$ref) {
			const resolved = resolveRef(response.$ref, spec);
			if (!resolved) {
				continue;
			}

			response = resolved;
		}

		const content = response.content as SpecObject | undefined;
		let contentType = "";
		let schemaProperties: ApiSchemaProperty[] = [];
		let example = "";

		if (content) {
			/* v8 ignore start */
			contentType = Object.keys(content)[0] ?? "";
			const mediaType = content[contentType] as SpecObject | undefined;
			if (mediaType?.schema) {
				/* v8 ignore stop */
				schemaProperties = extractSchemaProperties(
					mediaType.schema as SpecObject,
					spec,
				);

				if (mediaType.example) {
					example = JSON.stringify(mediaType.example, null, 2);
				} else {
					const generated = generateExampleFromSchema(
						mediaType.schema as SpecObject,
						spec,
					);
					if (generated !== undefined) {
						example = JSON.stringify(generated, null, 2);
					}
				}
			}
		}

		responses.push({
			statusCode,
			statusClass: getStatusClass(statusCode),
			/* v8 ignore next */
			description: response.description ?? "",
			contentType,
			schemaProperties,
			example,
		});
	}

	return responses;
}

function generateExampleFromSchema(
	schema: SpecObject | undefined,
	spec: SpecObject,
	visited: Set<string> = new Set(),
): unknown {
	if (!schema) {
		return undefined;
	}

	if (schema.$ref) {
		if (visited.has(schema.$ref)) {
			return {};
		}

		visited.add(schema.$ref);
		const resolved = resolveRef(schema.$ref, spec);
		return resolved
			? generateExampleFromSchema(resolved, spec, visited)
			: undefined;
	}

	if (schema.example !== undefined) {
		return schema.example;
	}

	if (schema.type === "object" || schema.properties) {
		const result: Record<string, unknown> = {};
		if (schema.properties) {
			for (const [name, propSchema] of Object.entries(schema.properties)) {
				result[name] = generateExampleFromSchema(
					propSchema as SpecObject,
					spec,
					new Set(visited),
				);
			}
		}

		if (schema.additionalProperties === true) {
			result.key = "value";
		}

		return result;
	}

	if (schema.type === "array") {
		const itemExample = generateExampleFromSchema(
			schema.items as SpecObject | undefined,
			spec,
			new Set(visited),
		);
		return itemExample !== undefined ? [itemExample] : [];
	}

	if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
		return schema.enum[0];
	}

	const defaults: Record<string, unknown> = {
		string: "string",
		number: 0,
		integer: 0,
		boolean: true,
	};

	return defaults[schema.type as string] ?? null;
}

function generateCodeExamples(
	method: string,
	pathStr: string,
	baseUrl: string,
	parameters: ApiOperationParameter[],
	requestBody?: ApiRequestBody,
): ApiCodeExamples {
	const url = `${baseUrl}${pathStr}`;
	const queryParams = parameters.filter((p) => p.in === "query");
	const headerParams = parameters.filter((p) => p.in === "header");

	const queryString =
		queryParams.length > 0
			? `?${queryParams.map((p) => `${p.name}={${p.name}}`).join("&")}`
			: "";

	const fullUrl = `${url}${queryString}`;

	// Curl
	const curlParts = [`curl -X ${method.toUpperCase()} "${fullUrl}"`];
	for (const header of headerParams) {
		curlParts.push(`  -H "${header.name}: {${header.name}}"`);
	}

	if (requestBody) {
		curlParts.push(`  -H "Content-Type: ${requestBody.contentType}"`);
		if (requestBody.example) {
			curlParts.push(`  -d '${requestBody.example.replaceAll("\n", "")}'`);
		}
	}

	const curl = curlParts.join(" \\\n");

	// JavaScript
	const jsParts: string[] = [];
	const fetchOptions: string[] = [];
	fetchOptions.push(`  method: '${method.toUpperCase()}'`);

	const jsHeaders: string[] = [];
	for (const header of headerParams) {
		jsHeaders.push(`    '${header.name}': '{${header.name}}'`);
	}

	if (requestBody) {
		jsHeaders.push(`    'Content-Type': '${requestBody.contentType}'`);
	}

	if (jsHeaders.length > 0) {
		fetchOptions.push(`  headers: {\n${jsHeaders.join(",\n")}\n  }`);
	}

	if (requestBody?.example) {
		fetchOptions.push(
			`  body: JSON.stringify(${requestBody.example.replaceAll("\n", "")})`,
		);
	}

	jsParts.push(`const response = await fetch('${fullUrl}', {`);
	jsParts.push(fetchOptions.join(",\n"));
	jsParts.push("});");
	jsParts.push("const data = await response.json();");

	const javascript = jsParts.join("\n");

	// Python
	const pyParts: string[] = [];
	pyParts.push("import requests");
	pyParts.push("");

	const pyArgs: string[] = [];
	if (queryParams.length > 0) {
		const paramsObj = queryParams
			.map((p) => `    '${p.name}': '{${p.name}}'`)
			.join(",\n");
		pyArgs.push(`    params={\n${paramsObj}\n    }`);
	}

	const pyHeaders: string[] = [];
	for (const header of headerParams) {
		pyHeaders.push(`        '${header.name}': '{${header.name}}'`);
	}

	if (requestBody) {
		pyHeaders.push(`        'Content-Type': '${requestBody.contentType}'`);
	}

	if (pyHeaders.length > 0) {
		pyArgs.push(`    headers={\n${pyHeaders.join(",\n")}\n    }`);
	}

	if (requestBody?.example) {
		pyArgs.push(`    json=${requestBody.example.replaceAll("\n", "")}`);
	}

	const pyUrl = queryParams.length > 0 ? url : fullUrl;

	if (pyArgs.length > 0) {
		pyParts.push(`response = requests.${method}(`);
		pyParts.push(`    '${pyUrl}',`);
		pyParts.push(`${pyArgs.join(",\n")}`);
		pyParts.push(")");
	} else {
		pyParts.push(`response = requests.${method}('${pyUrl}')`);
	}

	pyParts.push("data = response.json()");

	const python = pyParts.join("\n");

	return { curl, javascript, python };
}
