import fs from 'node:fs';
import {expect, it, describe} from 'vitest';
import {DoculaHelpers} from '../src/helpers.js';

describe('DoculaHelpers', () => {
	describe('createDoc', () => {
		it('should create a document from a previous readme', () => {
			const source = './test/fixtures/readme-example.md';
			const destination = './test/fixtures/readme-example-createdoc-new.md';
			if (fs.existsSync(destination)) {
				fs.unlinkSync(destination);
			}

			const helpers = new DoculaHelpers();
			helpers.createDoc(source, destination, {title: 'docula'});
			const frontMatter = helpers.getFrontMatterFromFile(destination);
			expect(frontMatter.title).toEqual('docula');
			if (fs.existsSync(destination)) {
				fs.unlinkSync(destination);
			}
		});
		it('should create a document from a previous readme with contentFn', () => {
			const source = './test/fixtures/readme-example.md';
			const destination = './test/fixtures/readme-example-createdoc-new-fn.md';
			if (fs.existsSync(destination)) {
				fs.unlinkSync(destination);
			}

			const function_ = (content: string) => content.replace('description: Beautiful Website for Your Projects', 'description: More Beautiful');

			const helpers = new DoculaHelpers();
			helpers.createDoc(source, destination, {title: 'docula', description: 'Beautiful Website for Your Projects'}, function_);
			const frontMatter = helpers.getFrontMatterFromFile(destination);
			expect(frontMatter.title).toEqual('docula');
			expect(frontMatter.description).toEqual('More Beautiful');

			if (fs.existsSync(destination)) {
				fs.unlinkSync(destination);
			}
		});
	});
	describe('getFrontMatter', () => {
		it('should return an empty object if no FrontMatter is found', () => {
			const helpers = new DoculaHelpers();
			const frontMatter = helpers.getFrontMatterFromFile('./test/fixtures/no-front-matter.md');
			expect(frontMatter).toEqual({});
		});
		it('should return valid FrontMatter', () => {
			const helpers = new DoculaHelpers();
			const frontMatter = helpers.getFrontMatterFromFile('./test/fixtures/front-matter.md');
			expect(frontMatter.title).toEqual('docula');
		});
	});
	describe('setFrontMatterInContent', () => {
		it('should get and append FrontMatter', () => {
			const helpers = new DoculaHelpers();
			const newContent = helpers.setFrontMatterInContent('---\ntitle: docula\n---\n# Hello World', {title: 'docula1'});
			expect(newContent).toEqual('---\ntitle: docula1\n---\n# Hello World');
		});
		it('should get and append with no FrontMatter', () => {
			const helpers = new DoculaHelpers();
			const newContent = helpers.setFrontMatterInContent('# Hello World', {title: 'docula1'});
			expect(newContent).toEqual('---\ntitle: docula1\n---\n# Hello World');
		});
		it('should do nothing with no frontmatter', () => {
			const helpers = new DoculaHelpers();
			const newContent = helpers.setFrontMatterInContent('# Hello World', undefined);
			expect(newContent).toEqual('# Hello World');
		});
	});
	describe('setFrontMatterToFile', () => {
		it('should get and append FrontMatter to new file', () => {
			const helpers = new DoculaHelpers();
			const file = './test/fixtures/front-matter-new-set.md';
			if (fs.existsSync(file)) {
				fs.unlinkSync(file);
			}

			fs.writeFileSync(file, '# Hello World', 'utf8');
			helpers.setFrontMatterToFile(file, {title: 'docula1'});
			const frontMatter = helpers.getFrontMatterFromFile(file);
			expect(frontMatter.title).toEqual('docula1');
			if (fs.existsSync(file)) {
				fs.unlinkSync(file);
			}
		});
	});
});
