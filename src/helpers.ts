import fs from "node:fs";
import { Writr } from "writr";

export class DoculaHelpers {
	createDoc(
		path: string,
		destination: string,
		frontMatter?: Record<string, string>,
		contentFunction?: (content: string) => string,
	): void {
		const content = fs.readFileSync(path, "utf8");

		let newContent = this.setFrontMatterInContent(content, frontMatter);

		if (contentFunction) {
			newContent = contentFunction(newContent);
		}

		fs.writeFileSync(destination, newContent, "utf8");
	}

	getFrontMatterFromFile(path: string): Record<string, string> {
		const writr = new Writr();
		writr.loadFromFileSync(path);
		return writr.frontMatter;
	}

	getFrontMatter(content: string): Record<string, string> {
		const writr = new Writr(content);
		return writr.frontMatter;
	}

	setFrontMatterToFile(
		path: string,
		frontMatter: Record<string, string>,
	): void {
		const writr = new Writr();
		writr.loadFromFileSync(path);
		writr.frontMatter = frontMatter;
		fs.writeFileSync(path, writr.content, "utf8");
	}

	setFrontMatterInContent(
		content: string,
		frontMatter?: Record<string, string>,
	): string {
		if (!frontMatter) {
			return content;
		}

		const writr = new Writr(content);
		writr.frontMatter = frontMatter;
		return writr.content;
	}
}
