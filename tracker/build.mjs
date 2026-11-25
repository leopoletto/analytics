import * as esbuild from 'esbuild';
import fs from 'node:fs';

await esbuild.build({
  entryPoints: ['src/script.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2018',
  outfile: 'dist/script.js',
});

const size = fs.statSync('dist/script.js').size;
console.log(`Built tracker/dist/script.js (${size} bytes)`);
