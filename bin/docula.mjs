#!/usr/bin/env ts-node

import * as process from 'node:process';
import Docula from '../dist/docula.js';

const docula = new Docula();

await docula.execute(process);
