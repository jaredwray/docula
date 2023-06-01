import {fileURLToPath} from 'node:url';

export const getFileName = () => fileURLToPath(import.meta.url);
// eslint-disable-next-line n/prefer-global/process
export const getSitePath = () => `${process.cwd()}/site`;
export const getConfigPath = () => `${getSitePath()}/config.json`;

