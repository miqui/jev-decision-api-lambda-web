import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  // CJS deps inside the ESM bundle need require()
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
  sourcemap: false,
  minify: false,
  legalComments: 'none',
});
console.log('built dist/index.js');
