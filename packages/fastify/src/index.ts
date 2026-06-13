import fp from "fastify-plugin";
import { doculaFastifyPlugin } from "./plugin.js";

export type {
	DoculaApiSpecMode,
	DoculaFastifyController,
	DoculaFastifyOptions,
} from "./plugin.js";
export { doculaFastifyPlugin } from "./plugin.js";

export default fp(doculaFastifyPlugin, {
	fastify: "5.x",
	name: "@docula/fastify",
});
