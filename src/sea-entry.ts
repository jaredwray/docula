import process from "node:process";
import Docula from "./docula.js";
import { embeddedTemplates } from "./embedded-templates.js";
import { setEmbeddedTemplates } from "./template-resolver.js";

async function main() {
	setEmbeddedTemplates(embeddedTemplates);
	const docula = new Docula();
	await docula.execute(process);
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
