// Since we only copy over the es module node-entry.js, and the rollup cli uses the cjs version,
// we need to import and use the esm version of rollup to run the tests.

import {rollup} from 'rollup';
import config from './rollup.config.js';

import process from 'process';
if (process.send) {
  process.on('SIGINT', () => {
    // Do nothing, parent process will send sigterm if necessary.
  });
}

const bundle = await rollup(config);
await bundle.generate(config.output);
await bundle.write(config.output);
await bundle.close();
