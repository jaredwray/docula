import { describe, expect, it } from "vitest";
import { parseOpenApiSpec } from "../src/api-parser.js";

describe("API Parser", () => {
	describe("parseOpenApiSpec", () => {
		it("should parse a minimal OpenAPI spec", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test API", description: "Test", version: "1.0.0" },
				paths: {},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.info.title).toBe("Test API");
			expect(result.info.description).toBe("Test");
			expect(result.info.version).toBe("1.0.0");
			expect(result.groups).toHaveLength(0);
			expect(result.servers).toHaveLength(0);
		});

		it("should parse servers", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				servers: [
					{ url: "https://api.example.com", description: "Production" },
					{ url: "https://staging.example.com" },
				],
				paths: {},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.servers).toHaveLength(2);
			expect(result.servers[0].url).toBe("https://api.example.com");
			expect(result.servers[0].description).toBe("Production");
			expect(result.servers[1].description).toBe("");
		});

		it("should parse tags with descriptions", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				tags: [{ name: "Users", description: "User operations" }],
				paths: {
					"/users": {
						get: {
							tags: ["Users"],
							summary: "List users",
							responses: { "200": { description: "OK" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.groups).toHaveLength(1);
			expect(result.groups[0].name).toBe("Users");
			expect(result.groups[0].description).toBe("User operations");
			expect(result.groups[0].operations).toHaveLength(1);
		});

		it("should group untagged operations under Default", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/health": {
						get: {
							summary: "Health check",
							responses: { "200": { description: "OK" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.groups).toHaveLength(1);
			expect(result.groups[0].name).toBe("Default");
		});

		it("should parse all HTTP methods", () => {
			const methods = [
				"get",
				"post",
				"put",
				"delete",
				"patch",
				"head",
				"options",
			];
			const paths: Record<string, Record<string, unknown>> = { "/test": {} };
			for (const method of methods) {
				paths["/test"][method] = {
					responses: { "200": { description: "OK" } },
				};
			}

			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths,
			});

			const result = parseOpenApiSpec(spec);
			expect(result.groups[0].operations).toHaveLength(7);
			const methodsFound = result.groups[0].operations.map((op) => op.method);
			expect(methodsFound).toEqual(methods);
		});

		it("should set methodUpper correctly", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						post: { responses: { "201": { description: "Created" } } },
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.groups[0].operations[0].methodUpper).toBe("POST");
		});

		it("should generate slugified IDs", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/users/{id}": {
						get: {
							operationId: "getUser",
							responses: { "200": { description: "OK" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.groups[0].operations[0].id).toBe("getuser");
		});

		it("should generate ID from path when operationId is missing", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/users/{id}": {
						get: { responses: { "200": { description: "OK" } } },
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.groups[0].operations[0].id).toBe("get-users-id");
		});

		it("should parse parameters including path-level params", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/users/{id}": {
						parameters: [
							{
								name: "id",
								in: "path",
								required: true,
								schema: { type: "string" },
								description: "User ID",
							},
						],
						get: {
							parameters: [
								{
									name: "fields",
									in: "query",
									required: false,
									schema: { type: "string" },
									description: "Fields to include",
								},
							],
							responses: { "200": { description: "OK" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const params = result.groups[0].operations[0].parameters;
			expect(params).toHaveLength(2);
			expect(params[0].name).toBe("id");
			expect(params[0].in).toBe("path");
			expect(params[0].required).toBe(true);
			expect(params[0].type).toBe("string");
			expect(params[0].description).toBe("User ID");
			expect(params[1].name).toBe("fields");
			expect(params[1].required).toBe(false);
		});

		it("should parse parameter with $ref", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				components: {
					parameters: {
						PageParam: {
							name: "page",
							in: "query",
							required: false,
							schema: { type: "integer" },
							description: "Page number",
						},
					},
				},
				paths: {
					"/items": {
						get: {
							parameters: [{ $ref: "#/components/parameters/PageParam" }],
							responses: { "200": { description: "OK" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const params = result.groups[0].operations[0].parameters;
			expect(params).toHaveLength(1);
			expect(params[0].name).toBe("page");
			expect(params[0].type).toBe("integer");
		});

		it("should parse request body with schema properties", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/users": {
						post: {
							requestBody: {
								content: {
									"application/json": {
										schema: {
											type: "object",
											required: ["name"],
											properties: {
												name: { type: "string", description: "User name" },
												email: { type: "string", format: "email" },
											},
										},
									},
								},
							},
							responses: { "201": { description: "Created" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const rb = result.groups[0].operations[0].requestBody;
			expect(rb).toBeDefined();
			expect(rb?.contentType).toBe("application/json");
			expect(rb?.schemaProperties).toHaveLength(2);
			expect(rb?.schemaProperties[0].name).toBe("name");
			expect(rb?.schemaProperties[0].required).toBe(true);
			expect(rb?.schemaProperties[1].name).toBe("email");
			expect(rb?.schemaProperties[1].type).toBe("string (email)");
			expect(rb?.example).toContain('"name"');
		});

		it("should parse requestBody with $ref", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				components: {
					requestBodies: {
						UserBody: {
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											name: { type: "string" },
										},
									},
								},
							},
						},
					},
				},
				paths: {
					"/users": {
						post: {
							requestBody: { $ref: "#/components/requestBodies/UserBody" },
							responses: { "201": { description: "Created" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const rb = result.groups[0].operations[0].requestBody;
			expect(rb).toBeDefined();
			expect(rb?.schemaProperties).toHaveLength(1);
			expect(rb?.schemaProperties[0].name).toBe("name");
		});

		it("should return undefined requestBody when no content", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/users": {
						post: {
							requestBody: {},
							responses: { "201": { description: "Created" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.groups[0].operations[0].requestBody).toBeUndefined();
		});

		it("should return undefined requestBody when $ref is invalid", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/users": {
						post: {
							requestBody: { $ref: "#/components/requestBodies/NonExistent" },
							responses: { "201": { description: "Created" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.groups[0].operations[0].requestBody).toBeUndefined();
		});

		it("should parse responses with status classes", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						get: {
							responses: {
								"200": {
									description: "Success",
									content: {
										"application/json": {
											schema: {
												type: "object",
												properties: {
													id: { type: "integer" },
													name: { type: "string" },
												},
											},
										},
									},
								},
								"301": { description: "Moved" },
								"400": { description: "Bad Request" },
								"500": { description: "Server Error" },
								default: { description: "Error" },
							},
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const responses = result.groups[0].operations[0].responses;
			expect(responses).toHaveLength(5);
			expect(responses[0].statusClass).toBe("2xx");
			expect(responses[0].schemaProperties).toHaveLength(2);
			expect(responses[1].statusClass).toBe("3xx");
			expect(responses[2].statusClass).toBe("4xx");
			expect(responses[3].statusClass).toBe("5xx");
			expect(responses[4].statusClass).toBe("default");
		});

		it("should parse response with $ref", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				components: {
					responses: {
						NotFound: { description: "Resource not found" },
					},
				},
				paths: {
					"/test": {
						get: {
							responses: {
								"404": { $ref: "#/components/responses/NotFound" },
							},
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.groups[0].operations[0].responses[0].description).toBe(
				"Resource not found",
			);
		});

		it("should resolve $ref in schema properties", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				components: {
					schemas: {
						User: {
							type: "object",
							properties: {
								id: { type: "integer" },
								name: { type: "string" },
							},
						},
					},
				},
				paths: {
					"/users": {
						get: {
							responses: {
								"200": {
									description: "OK",
									content: {
										"application/json": {
											schema: { $ref: "#/components/schemas/User" },
										},
									},
								},
							},
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const props =
				result.groups[0].operations[0].responses[0].schemaProperties;
			expect(props).toHaveLength(2);
			expect(props[0].name).toBe("id");
			expect(props[1].name).toBe("name");
		});

		it("should handle circular $ref references", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				components: {
					schemas: {
						Node: {
							type: "object",
							properties: {
								value: { type: "string" },
								children: {
									type: "array",
									items: { $ref: "#/components/schemas/Node" },
								},
							},
						},
					},
				},
				paths: {
					"/nodes": {
						get: {
							responses: {
								"200": {
									description: "OK",
									content: {
										"application/json": {
											schema: { $ref: "#/components/schemas/Node" },
										},
									},
								},
							},
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const props =
				result.groups[0].operations[0].responses[0].schemaProperties;
			expect(props.length).toBeGreaterThan(0);
			// Should not throw or loop infinitely
		});

		it("should handle array schema type", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/items": {
						get: {
							responses: {
								"200": {
									description: "OK",
									content: {
										"application/json": {
											schema: {
												type: "array",
												items: { type: "string" },
											},
										},
									},
								},
							},
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const props =
				result.groups[0].operations[0].responses[0].schemaProperties;
			expect(props).toHaveLength(1);
			expect(props[0].name).toBe("(items)");
			expect(props[0].type).toBe("string");
		});

		it("should format array property types with parentheses instead of angle brackets", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						get: {
							requestBody: {
								content: {
									"application/json": {
										schema: {
											type: "object",
											properties: {
												items: { type: "array", items: { type: "object" } },
												tags: { type: "array", items: { type: "string" } },
											},
										},
									},
								},
							},
							responses: { "200": { description: "OK" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const requestBody = result.groups[0].operations[0].requestBody;
			expect(requestBody).toBeDefined();
			const props = requestBody?.schemaProperties;
			expect(props?.[0].type).toBe("array(object)");
			expect(props?.[1].type).toBe("array(string)");
		});

		it("should handle oneOf/anyOf/allOf schema types", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						get: {
							responses: {
								"200": {
									description: "OK",
									content: {
										"application/json": {
											schema: {
												type: "object",
												properties: {
													field1: {
														oneOf: [{ type: "string" }, { type: "number" }],
													},
													field2: { anyOf: [{ type: "string" }] },
													field3: { allOf: [{ type: "object" }] },
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const props =
				result.groups[0].operations[0].responses[0].schemaProperties;
			expect(props[0].type).toBe("oneOf");
			expect(props[1].type).toBe("oneOf");
			expect(props[2].type).toBe("allOf");
		});

		it("should handle primitive schema types", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/count": {
						get: {
							responses: {
								"200": {
									description: "OK",
									content: {
										"application/json": {
											schema: { type: "integer" },
										},
									},
								},
							},
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const props =
				result.groups[0].operations[0].responses[0].schemaProperties;
			expect(props).toHaveLength(1);
			expect(props[0].name).toBe("(value)");
			expect(props[0].type).toBe("integer");
		});

		it("should generate example from schema with explicit example", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						get: {
							responses: {
								"200": {
									description: "OK",
									content: {
										"application/json": {
											example: { id: 1, name: "Test" },
											schema: {
												type: "object",
												properties: {
													id: { type: "integer" },
													name: { type: "string" },
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const example = result.groups[0].operations[0].responses[0].example;
			expect(example).toContain('"id": 1');
			expect(example).toContain('"name": "Test"');
		});

		it("should generate example from schema with enum", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						post: {
							requestBody: {
								content: {
									"application/json": {
										schema: {
											type: "object",
											properties: {
												status: {
													type: "string",
													enum: ["active", "inactive"],
													description: "User status",
												},
											},
										},
									},
								},
							},
							responses: { "200": { description: "OK" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const rb = result.groups[0].operations[0].requestBody;
			expect(rb).toBeDefined();
			expect(rb?.example).toContain("active");
			expect(rb?.schemaProperties[0].enumValues).toEqual([
				"active",
				"inactive",
			]);
		});

		it("should generate example with additionalProperties", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						get: {
							responses: {
								"200": {
									description: "OK",
									content: {
										"application/json": {
											schema: {
												type: "object",
												additionalProperties: true,
											},
										},
									},
								},
							},
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const example = result.groups[0].operations[0].responses[0].example;
			expect(example).toContain("key");
		});

		it("should generate example for boolean and number types", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						post: {
							requestBody: {
								content: {
									"application/json": {
										schema: {
											type: "object",
											properties: {
												active: { type: "boolean" },
												count: { type: "number" },
												total: { type: "integer" },
											},
										},
									},
								},
							},
							responses: { "200": { description: "OK" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const example = result.groups[0].operations[0].requestBody?.example;
			expect(example).toContain("true");
			expect(example).toContain("0");
		});

		it("should generate example for array schema", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						get: {
							responses: {
								"200": {
									description: "OK",
									content: {
										"application/json": {
											schema: {
												type: "array",
												items: { type: "string" },
											},
										},
									},
								},
							},
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const example = result.groups[0].operations[0].responses[0].example;
			expect(example).toContain("[");
		});

		it("should generate code examples with curl, javascript, and python", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				servers: [{ url: "https://api.example.com" }],
				paths: {
					"/users": {
						get: {
							parameters: [
								{ name: "page", in: "query", schema: { type: "integer" } },
								{ name: "X-API-Key", in: "header", schema: { type: "string" } },
							],
							responses: { "200": { description: "OK" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const code = result.groups[0].operations[0].codeExamples;

			expect(code.curl).toContain("curl -X GET");
			expect(code.curl).toContain("https://api.example.com/users?page={page}");
			expect(code.curl).toContain("X-API-Key");

			expect(code.javascript).toContain("fetch");
			expect(code.javascript).toContain("method: 'GET'");
			expect(code.javascript).toContain("X-API-Key");

			expect(code.python).toContain("requests.get");
			expect(code.python).toContain("params=");
			expect(code.python).toContain("X-API-Key");
		});

		it("should generate code examples with request body", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				servers: [{ url: "https://api.example.com" }],
				paths: {
					"/users": {
						post: {
							requestBody: {
								content: {
									"application/json": {
										schema: {
											type: "object",
											properties: { name: { type: "string" } },
										},
									},
								},
							},
							responses: { "201": { description: "Created" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const code = result.groups[0].operations[0].codeExamples;

			expect(code.curl).toContain("Content-Type: application/json");
			expect(code.curl).toContain("-d");

			expect(code.javascript).toContain("Content-Type");
			expect(code.javascript).toContain("JSON.stringify");

			expect(code.python).toContain("json=");
		});

		it("should handle missing info fields", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				paths: {},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.info.title).toBe("");
			expect(result.info.description).toBe("");
			expect(result.info.version).toBe("");
		});

		it("should handle empty tags array on operation", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						get: {
							tags: [],
							responses: { "200": { description: "OK" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.groups[0].name).toBe("Default");
		});

		it("should handle non-object path items", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": null,
				},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.groups).toHaveLength(0);
		});

		it("should handle invalid $ref gracefully", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						get: {
							parameters: [{ $ref: "#/components/parameters/NonExistent" }],
							responses: { "200": { description: "OK" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.groups[0].operations[0].parameters).toHaveLength(0);
		});

		it("should handle external $ref (non-local)", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						get: {
							responses: {
								"200": {
									description: "OK",
									content: {
										"application/json": {
											schema: { $ref: "external.json#/Schema" },
										},
									},
								},
							},
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			expect(
				result.groups[0].operations[0].responses[0].schemaProperties,
			).toHaveLength(0);
		});

		it("should handle response with invalid $ref", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						get: {
							responses: {
								"404": { $ref: "#/components/responses/NonExistent" },
							},
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			// Invalid $ref response should be skipped
			expect(result.groups[0].operations[0].responses).toHaveLength(0);
		});

		it("should handle operation with no responses object", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						get: {},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.groups[0].operations[0].responses).toHaveLength(0);
		});

		it("should generate code examples without servers (empty base URL)", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						get: { responses: { "200": { description: "OK" } } },
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const code = result.groups[0].operations[0].codeExamples;
			expect(code.curl).toContain("/test");
			expect(code.javascript).toContain("/test");
			expect(code.python).toContain("/test");
		});

		it("should handle schema with example at property level", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						get: {
							responses: {
								"200": {
									description: "OK",
									content: {
										"application/json": {
											schema: {
												type: "object",
												properties: {
													name: { type: "string", example: "John" },
												},
											},
										},
									},
								},
							},
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const example = result.groups[0].operations[0].responses[0].example;
			expect(example).toContain("John");
		});

		it("should handle multiple tags per operation", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/admin/users": {
						get: {
							tags: ["Admin", "Users"],
							responses: { "200": { description: "OK" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.groups).toHaveLength(2);
			expect(result.groups[0].name).toBe("Admin");
			expect(result.groups[1].name).toBe("Users");
			// Same operation appears in both groups
			expect(result.groups[0].operations[0].path).toBe("/admin/users");
			expect(result.groups[1].operations[0].path).toBe("/admin/users");
		});

		it("should handle tags without name property", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				tags: [{ description: "No name tag" }],
				paths: {},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.groups).toHaveLength(0);
		});

		it("should parse the mega-page-site swagger fixture", () => {
			const fs = require("node:fs");
			const specJson = fs.readFileSync(
				"test/fixtures/mega-page-site/api/swagger.json",
				"utf8",
			);
			const result = parseOpenApiSpec(specJson);

			expect(result.info.title).toBe("Mock HTTP API");
			expect(result.info.version).toBe("1.4.0");
			expect(result.groups.length).toBeGreaterThan(0);

			// Check that HTTP Methods group exists with GET, POST, DELETE, PUT, PATCH
			const httpMethods = result.groups.find((g) => g.name === "HTTP Methods");
			expect(httpMethods).toBeDefined();
			expect(httpMethods?.operations.length).toBeGreaterThanOrEqual(5);
		});

		it("should handle requestBody with content but empty media type", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						post: {
							requestBody: {
								content: {
									"application/json": {},
								},
							},
							responses: { "200": { description: "OK" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			// requestBody exists but has no schema
			const rb = result.groups[0].operations[0].requestBody;
			expect(rb).toBeDefined();
			expect(rb?.schemaProperties).toHaveLength(0);
		});

		it("should handle requestBody with explicit media example", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						post: {
							requestBody: {
								content: {
									"application/json": {
										example: { foo: "bar" },
										schema: {
											type: "object",
											properties: { foo: { type: "string" } },
										},
									},
								},
							},
							responses: { "200": { description: "OK" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const rb = result.groups[0].operations[0].requestBody;
			expect(rb).toBeDefined();
			expect(rb?.example).toContain('"foo": "bar"');
		});

		it("should handle requestBody content with null media type", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						post: {
							requestBody: {
								content: { "text/plain": null },
							},
							responses: { "200": { description: "OK" } },
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.groups[0].operations[0].requestBody).toBeUndefined();
		});

		it("should handle array type without items definition", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {
					"/test": {
						get: {
							responses: {
								"200": {
									description: "OK",
									content: {
										"application/json": {
											schema: { type: "array" },
										},
									},
								},
							},
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const example = result.groups[0].operations[0].responses[0].example;
			expect(example).toBe("[]");
		});

		it("should handle circular ref in resolveSchema", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				components: {
					schemas: {
						SelfRef: { $ref: "#/components/schemas/SelfRef" },
					},
				},
				paths: {
					"/test": {
						get: {
							responses: {
								"200": {
									description: "OK",
									content: {
										"application/json": {
											schema: { $ref: "#/components/schemas/SelfRef" },
										},
									},
								},
							},
						},
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			// Should not loop infinitely; should handle the circular reference
			const props =
				result.groups[0].operations[0].responses[0].schemaProperties;
			expect(props).toBeDefined();
		});

		it("should return empty securitySchemes when spec has none", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				paths: {},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.securitySchemes).toEqual([]);
		});

		it("should return empty securitySchemes when components exists but has no securitySchemes", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				components: { schemas: {} },
				paths: {},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.securitySchemes).toEqual([]);
		});

		it("should parse an apiKey security scheme", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				components: {
					securitySchemes: {
						api_key: {
							type: "apiKey",
							name: "X-API-Key",
							in: "header",
							description: "API key auth",
						},
					},
				},
				paths: {},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.securitySchemes).toHaveLength(1);
			expect(result.securitySchemes[0]).toEqual({
				key: "api_key",
				type: "apiKey",
				scheme: undefined,
				bearerFormat: undefined,
				name: "X-API-Key",
				in: "header",
				description: "API key auth",
			});
		});

		it("should parse an apiKey cookie security scheme", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				components: {
					securitySchemes: {
						cookie_auth: {
							type: "apiKey",
							name: "access_token",
							in: "cookie",
						},
					},
				},
				paths: {},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.securitySchemes).toHaveLength(1);
			expect(result.securitySchemes[0]).toEqual({
				key: "cookie_auth",
				type: "apiKey",
				scheme: undefined,
				bearerFormat: undefined,
				name: "access_token",
				in: "cookie",
				description: "",
			});
		});

		it("should parse an http bearer security scheme", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				components: {
					securitySchemes: {
						bearer_auth: {
							type: "http",
							scheme: "bearer",
							bearerFormat: "JWT",
							description: "Bearer token",
						},
					},
				},
				paths: {},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.securitySchemes).toHaveLength(1);
			expect(result.securitySchemes[0]).toEqual({
				key: "bearer_auth",
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
				name: undefined,
				in: undefined,
				description: "Bearer token",
			});
		});

		it("should parse an oauth2 security scheme with flows", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				components: {
					securitySchemes: {
						oauth2: {
							type: "oauth2",
							description: "OAuth2 auth",
							flows: {
								authorizationCode: {
									authorizationUrl: "https://auth.example.com/authorize",
									tokenUrl: "https://auth.example.com/token",
									refreshUrl: "https://auth.example.com/refresh",
									scopes: { "read:users": "Read users", "write:users": "Write users" },
								},
								clientCredentials: {
									tokenUrl: "https://auth.example.com/token",
									scopes: { admin: "Admin access" },
								},
							},
						},
					},
				},
				paths: {},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.securitySchemes).toHaveLength(1);
			const scheme = result.securitySchemes[0];
			expect(scheme.key).toBe("oauth2");
			expect(scheme.type).toBe("oauth2");
			expect(scheme.description).toBe("OAuth2 auth");
			expect(scheme.flows).toBeDefined();
			expect(scheme.flows!.authorizationCode).toEqual({
				authorizationUrl: "https://auth.example.com/authorize",
				tokenUrl: "https://auth.example.com/token",
				refreshUrl: "https://auth.example.com/refresh",
				scopes: { "read:users": "Read users", "write:users": "Write users" },
			});
			expect(scheme.flows!.clientCredentials).toEqual({
				tokenUrl: "https://auth.example.com/token",
				scopes: { admin: "Admin access" },
			});
			expect(scheme.flows!.implicit).toBeUndefined();
			expect(scheme.flows!.password).toBeUndefined();
		});

		it("should parse multiple security schemes", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				components: {
					securitySchemes: {
						api_key: { type: "apiKey", name: "X-API-Key", in: "header" },
						bearer: { type: "http", scheme: "bearer" },
					},
				},
				paths: {},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.securitySchemes).toHaveLength(2);
			expect(result.securitySchemes[0].key).toBe("api_key");
			expect(result.securitySchemes[0].type).toBe("apiKey");
			expect(result.securitySchemes[1].key).toBe("bearer");
			expect(result.securitySchemes[1].type).toBe("http");
		});

		it("should default missing description to empty string in security schemes", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				components: {
					securitySchemes: {
						minimal: { type: "apiKey", name: "key", in: "query" },
					},
				},
				paths: {},
			});

			const result = parseOpenApiSpec(spec);
			expect(result.securitySchemes[0].description).toBe("");
		});

		it("should generate python code without query params using full URL", () => {
			const spec = JSON.stringify({
				openapi: "3.0.3",
				info: { title: "Test", version: "1.0" },
				servers: [{ url: "https://api.example.com" }],
				paths: {
					"/simple": {
						get: { responses: { "200": { description: "OK" } } },
					},
				},
			});

			const result = parseOpenApiSpec(spec);
			const python = result.groups[0].operations[0].codeExamples.python;
			expect(python).toContain(
				"requests.get('https://api.example.com/simple')",
			);
		});
	});
});
