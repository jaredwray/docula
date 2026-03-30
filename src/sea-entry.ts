import process from "node:process";
import Docula from "./docula.js";

const docula = new Docula();

docula.execute(process).catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
