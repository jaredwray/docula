#!/usr/bin/env ts-node --esm --inspect --experimental-specifier-resolution=node --es-module-specifier-resolution=node

import {Executable} from "../dist/index.js";

const docula = new Executable();

docula.parseCLI(process).then();
