#!/usr/bin/env node
import {Executable} from '../dist/index.js';

const docula = new Executable();

// eslint-disable-next-line unicorn/prefer-top-level-await, n/prefer-global/process
docula.parseCLI(process).then();
