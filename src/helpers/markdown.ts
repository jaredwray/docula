/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import pkg from '@markdoc/markdoc';

// eslint-disable-next-line @typescript-eslint/naming-convention
const {Tag} = pkg;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const MarkdownHelper = {
	fence() {
		return {
			attributes: {
				language: {type: String},
			},
			transform(node: any, config: any) {
				const attributes = node.transformAttributes(config);

				const processedChildren = node.transformChildren(config);
				const languageClass = attributes.language ? `language-${attributes.language}` : '';
				const codeAttributes = languageClass ? {class: languageClass} : {};

				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				const codeTag = new Tag('code', codeAttributes, processedChildren.join(''));

				return new Tag('pre', {}, [codeTag]);
			},
		};
	},
};
