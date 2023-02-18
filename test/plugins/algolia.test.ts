import fs from 'fs-extra';
import algoliasearch from 'algoliasearch';
import {AlgoliaPlugin, type AlgoliaConfig} from '../../src/plugins/algolia.js';
import {Config} from '../../src/config.js';
import Mock = jest.Mock;

jest.mock('algoliasearch');

const defaultConfig = {
	outputPath: 'test/output',
	plugins: ['algolia'],
};

const mockAlgoliaIndex = 'my-index';
const mockAlgoliaConfig: AlgoliaConfig = {
	apiKey: 'my-api-key',
	appId: 'my-app-id',
	indexName: mockAlgoliaIndex,
};

describe('AlgoliaPlugin', () => {
	afterAll(() => {
		fs.rmSync('./test/data/github-config.json', {force: true});
	});

	const mockAlgoliaClient = {
		initIndex: jest.fn(() => ({
			clearObjects: jest.fn(),
			saveObjects: jest.fn(),
		})),
	};

	beforeEach(() => {
		mockAlgoliaClient.initIndex.mockClear();
	});

	it('initializes the Algolia client', () => {
		const jsonConfig = {
			...defaultConfig,
			algolia: mockAlgoliaConfig,
		};
		fs.writeFileSync('test/data/algolia-config.json', JSON.stringify(jsonConfig, null, 2));
		const mockConfig = new Config('./test/data/algolia-config.json');
		(algoliasearch as unknown as Mock).mockImplementationOnce(() => mockAlgoliaClient);

		const plugin = new AlgoliaPlugin(mockConfig);

		expect(algoliasearch).toHaveBeenCalledWith(mockAlgoliaConfig.appId, mockAlgoliaConfig.apiKey);
		expect(mockAlgoliaClient.initIndex).toHaveBeenCalledWith(mockAlgoliaIndex);
		expect(plugin.options.indexName).toBe(mockAlgoliaIndex);
	});

	it('throws an error when Algolia is down', async () => {
		const jsonConfig = {
			...defaultConfig,
			algolia: mockAlgoliaConfig,
		};

		fs.writeFileSync('test/data/algolia-config.json', JSON.stringify(jsonConfig, null, 2));
		const mockConfig = new Config('./test/data/algolia-config.json');

		(algoliasearch as unknown as Mock).mockImplementationOnce(() => mockAlgoliaClient);

		const plugin = new AlgoliaPlugin(mockConfig);

		console.log(plugin.client);
		// @ts-expect-error - throwing an error
		(plugin.options.index.clearObjects as Mock).mockRejectedValueOnce(new Error('Algolia is down!'));

		await expect(plugin.execute()).rejects.toThrow('Error while indexing to Algolia: Algolia is down!');
	});

	it('indexes objects to Algolia', async () => {
		const jsonConfig = {
			...defaultConfig,
			algolia: mockAlgoliaConfig,
		};
		fs.writeFileSync('test/data/algolia-config.json', JSON.stringify(jsonConfig, null, 2));
		const mockConfig = new Config('./test/data/algolia-config.json');
		const mockJsonData = [
			// eslint-disable-next-line @typescript-eslint/naming-convention
			{objectID: '1', title: 'First Record', description: 'This is the first record.'},
			// eslint-disable-next-line @typescript-eslint/naming-convention
			{objectID: '2', title: 'Second Record', description: 'This is the second record.'},
		];
		// @ts-expect-error - mocking fs methods
		fs.readFileSync = jest.fn(() => JSON.stringify(mockJsonData));
		fs.existsSync = jest.fn(() => true);

		(algoliasearch as unknown as Mock).mockImplementationOnce(() => mockAlgoliaClient);

		const plugin = new AlgoliaPlugin(mockConfig);

		(plugin.options.index!.clearObjects as Mock).mockResolvedValueOnce(true);
		//  eslint-disable-next-line @typescript-eslint/naming-convention
		(plugin.options.index!.saveObjects as Mock).mockResolvedValueOnce({taskID: 123});

		await plugin.execute();

		expect(plugin.options.index!.clearObjects).toHaveBeenCalled();
		expect(plugin.options.index!.saveObjects).toHaveBeenCalledWith(mockJsonData, {
			//  eslint-disable-next-line @typescript-eslint/naming-convention
			autoGenerateObjectIDIfNotExist: true,
		});
	});
});
