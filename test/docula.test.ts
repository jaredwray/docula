import fs from 'fs-extra';
import express from 'express';
import {Docula} from '../src/docula.js';
import {Eleventy} from '../src/eleventy.js';
import logger from '../src/logger.js';

jest.mock('../src/eleventy.js');
jest.mock('../src/tools/path.js');
jest.mock('../src/tools/inquirer-prompt.js');

type ExpressAppMock = {
	use: jest.Mock;
	listen: jest.Mock;
};

jest.mock('express', () => {
	const expressStatic = jest.fn();
	const expressApp = jest.fn() as unknown as ExpressAppMock;
	expressApp.use = jest.fn();
	expressApp.listen = jest.fn((port, cb: () => void) => {
		cb();
	});
	return Object.assign(jest.fn(() => expressApp), {static: expressStatic});
});

describe('Docula', () => {
	const configJson: Record<string, any> = {
		originPath: 'test/data/site',
		outputPath: 'test/data/dist',
		siteUrl: 'https://example.com',
		plugins: ['npm', 'robots'],
		npm: {
			moduleName: 'keyv',
		},
	};

	beforeAll(() => {
		if (!fs.existsSync('test/data/site')) {
			fs.mkdirSync('test/data/site');
		}

		fs.writeFileSync('test/data/site/config.json', JSON.stringify(configJson, null, 2));
	});

	beforeEach(() => {
		jest.spyOn(Eleventy.prototype, 'build').mockImplementation();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	afterAll(() => {
		fs.rmSync('test/data/site', {force: true, recursive: true});
		fs.rmSync('test/data/site-copy', {force: true, recursive: true});
		fs.rmSync('test/data/dist', {force: true, recursive: true});
	});

	it('Docula - init', () => {
		const docula = new Docula();
		expect(docula).toBeDefined();
	});

	it('Docula - default originPath to site', () => {
		const docula = new Docula();
		expect(docula.config.originPath).toBe('test/data/site');
	});

	it('Docula - default outputPath to dist', () => {
		const docula = new Docula();
		expect(docula.config.outputPath).toBe('test/data/dist');
	});

	it('Docula - init with options config', () => {
		const options = {opts: () => ({config: './test/data/site/config.json'})};
		const docula = new Docula(options);
		expect(docula.config.originPath).toBe('test/data/site');
	});

	it('Docula - testing init function with folders', async () => {
		const options = {opts: () => ({config: './test/data/site/config.json'})};
		const docula = new Docula(options);
		await docula.init();
		expect(fs.existsSync('test/data/site')).toBe(true);
	});

	it('Docula init - create the directory if it does not exist', async () => {
		const json: Record<string, any> = {
			originPath: 'test/data/demo-site',
			outputPath: 'test/data/dist',
			siteUrl: 'https://example.com',
			plugins: ['robots'],
		};
		fs.writeFileSync('test/data/site/new-config.json', JSON.stringify(json, null, 2));
		const options = {opts: () => ({config: './test/data/site/new-config.json'})};
		const docula = new Docula(options);
		await docula.init();
		expect(fs.existsSync('test/data/demo-site')).toBe(true);
		fs.rmSync('test/data/site/new-config.json');
		fs.rmSync('test/data/demo-site', {force: true, recursive: true});
	});

	it('Docula - build should throw an error if the origin path does not exist', async () => {
		const invalidConfig = {
			originPath: 'test/data/site-invalid',
		};
		fs.writeFileSync('./test/data/site/invalid-config.json', JSON.stringify(invalidConfig));
		const options = {opts: () => ({config: './test/data/site/invalid-config.json'})};
		jest.spyOn(logger, 'error');
		const docula = new Docula(options);
		await expect(async () => docula.build()).rejects.toThrow();

		fs.rmSync('./test/data/site/invalid-config.json');
	});

	it('Docula - should build using Eleventy', async () => {
		const options = {opts: () => ({config: './test/data/site/config.json'})};
		const docula = new Docula(options);
		await docula.build();
		expect(Eleventy.prototype.build).toHaveBeenCalled();
	});

	it('Docula - should build using Eleventy fails', async () => {
		jest.spyOn(Eleventy.prototype, 'build').mockImplementation(() => {
			throw new Error('Error');
		});
		jest.spyOn(logger, 'error');

		const options = {opts: () => ({config: './test/data/site/config.json'})};
		const docula = new Docula(options);
		await expect(async () => docula.build()).rejects.toThrow('Error');
	});

	it('Docula - should copy a folder to a target location', () => {
		const docula = new Docula();
		docula.copyFolder('test/data/site', 'test/data/site-copy');
		expect(fs.existsSync('test/data/site-copy')).toBe(true);
		fs.rmSync('test/data/site-copy', {force: true, recursive: true});
	});

	it('Docula - should copy a folder to a default target location', () => {
		const docula = new Docula();
		docula.copyFolder('init', 'test/data/site');
		expect(fs.existsSync('test/data/site/_includes')).toBe(true);
	});

	it('Docula serve - should throw an error if outputPath does not exist', async () => {
		const invalidConfig = {
			outputPath: 'output',
		};
		fs.writeFileSync('./test/data/site/invalid-config.json', JSON.stringify(invalidConfig));
		const options = {opts: () => ({config: './test/data/site/invalid-config.json'})};
		const docula = new Docula(options);
		await expect(docula.serve()).rejects.toThrow(
			'The origin path "output" does not exist.',
		);

		fs.rmSync('./test/data/site/invalid-config.json');
	});

	it('should start a server and listen to a port', async () => {
		const docula = new Docula();
		const outputPath = 'outputPath';
		const port = 8080;
		docula.config.outputPath = outputPath;
		fs.existsSync = jest.fn(() => true);
		await docula.serve();
		expect(express).toHaveBeenCalled();
		expect(express().listen).toHaveBeenCalledWith(port, expect.any(Function));
	});
});

