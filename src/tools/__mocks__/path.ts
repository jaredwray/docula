// eslint-disable-next-line unicorn/prefer-module
export const getFileName = jest.fn(() => __dirname);
// eslint-disable-next-line n/prefer-global/process
export const getConfigPath = jest.fn(() => `${process.cwd()}/test/data/site/config.json`);
// eslint-disable-next-line n/prefer-global/process
export const getSitePath = jest.fn(() => `${process.cwd()}/test/data/site`);
