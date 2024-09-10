import fs from 'node:fs';
import {load, dump} from 'js-yaml';

export class DoculaHelpers {
	createDoc(path: string, destination: string, frontMatter?: Record<string, string>, contentFunction?: (content: string) => string): void {
		const content = fs.readFileSync(path, 'utf8');

		let newContent = this.setFrontMatterInContent(content, frontMatter);

		if (contentFunction) {
			newContent = contentFunction(newContent);
		}

		fs.writeFileSync(destination, newContent, 'utf8');
	}

	getFrontMatterFromFile(path: string): Record<string, string> {
		const content = fs.readFileSync(path, 'utf8');
		return this.getFrontMatter(content);
	}

	getFrontMatter(content: string): Record<string, string> {
		// Use regular expressions to extract the FrontMatter
		const match = /^---\r?\n([\s\S]+?)\r?\n---/.exec(content);
		if (match) {
			// Parse the YAML string to an object
			const frontMatter = load(match[1]);
			return frontMatter as Record<string, string>;
		}

		// Return null or some default value if no FrontMatter is found
		return {};
	}

	setFrontMatterToFile(path: string, frontMatter: Record<string, string>): void {
		const content = fs.readFileSync(path, 'utf8');
		const newContent = this.setFrontMatterInContent(content, frontMatter);
		fs.writeFileSync(path, newContent, 'utf8');
	}

	setFrontMatterInContent(content: string, frontMatter?: Record<string, string>): string {
		if (!frontMatter) {
			return content;
		}

		const match = /^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)/.exec(content);

		if (match) {
			// Parse the existing FrontMatter
			let oldFrontMatter = load(match[1]);

			// Set or replace values
			oldFrontMatter = {
				...oldFrontMatter as Record<string, unknown>,
				...frontMatter,
			};

			// Serialize the FrontMatter back to a YAML string
			const newYaml = dump(oldFrontMatter);

			// Replace the old FrontMatter with the new string
			const newContent = `---\n${newYaml}---\n${match[2]}`;

			// Write the result back to the file
			return newContent;
		}

		// No FrontMatter found, add it
		const newYaml = dump(frontMatter);
		const newContent = `---\n${newYaml}---\n${content}`;
		return newContent;
	}
}

