import {fileURLToPath} from 'node:url';

export const getFileName = () => fileURLToPath(import.meta.url);
// eslint-disable-next-line n/prefer-global/process
export const getConfigPath = () => `${process.cwd()}/site/config.json`;
