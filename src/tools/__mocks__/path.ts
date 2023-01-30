import * as path from 'node:path';

// eslint-disable-next-line unicorn/prefer-module
export const getFileName = jest.fn(() => path.dirname(__dirname));
// eslint-disable-next-line n/prefer-global/process
export const getConfigPath = jest.fn(() => `${process.cwd()}/test/data/site/config.json`);
