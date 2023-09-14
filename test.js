// Since we only copy over the es module node-entry.js, and the rollup cli uses the cjs version,
// we need to import and use the esm version of rollup to run the tests.

import {rollup} from 'rollup';
import config from './rollup.config.js';

const bundle = await rollup(config);
await bundle.generate(config.output);
await bundle.write(config.output);
await bundle.close();
