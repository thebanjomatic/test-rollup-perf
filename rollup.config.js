import {nodeResolve} from '@rollup/plugin-node-resolve';

export default {
  input: './src/index.js',
  output: {
    dir: 'dist',
    format: 'es',
    sourcemap: true,
  },
  plugins: [nodeResolve({browser: true, mainFields: ['module', 'main']})]
}