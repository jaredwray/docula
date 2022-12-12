#!/usr/bin/env ts-node --esm --inspect --experimental-specifier-resolution=node --es-module-specifier-resolution=node


const {Executable} =  require('../dist/index.js');

const docula = new Executable();

// eslint-disable-next-line unicorn/prefer-top-level-await
docula.parseCLI(process).then();
