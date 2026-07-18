// ESM + CJS-style bundle for the VSCode extension. The output is a
// single CommonJS file that VSCode loads via the `main` field in
// `package.json`. esbuild handles the rest: TypeScript, JSX-free
// imports, bundling `@turbowasm/gpu-kernel-parser` into the output.

import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(here, 'dist');
const watch = process.argv.includes('--watch');

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

const ctx = await (watch
  ? (await import('esbuild')).context({
      entryPoints: [path.join(here, 'src', 'extension.ts')],
      outfile: path.join(distDir, 'extension.js'),
      bundle: true,
      format: 'cjs',
      platform: 'node',
      target: 'es2022',
      sourcemap: true,
      external: ['vscode'],
      logLevel: 'info',
    })
  : build({
      entryPoints: [path.join(here, 'src', 'extension.ts')],
      outfile: path.join(distDir, 'extension.js'),
      bundle: true,
      format: 'cjs',
      platform: 'node',
      target: 'es2022',
      sourcemap: true,
      external: ['vscode'],
      logLevel: 'info',
    }));

if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild?.();
  await ctx.dispose?.();
}

cpSync(path.join(here, 'syntaxes'), path.join(distDir, 'syntaxes'), { recursive: true });
cpSync(path.join(here, 'snippets'), path.join(distDir, 'snippets'), { recursive: true });
cpSync(path.join(here, 'language-configuration.json'), path.join(distDir, 'language-configuration.json'));
cpSync(path.join(here, 'package.json'), path.join(distDir, 'package.json'));

console.log('[gpu-compute-dsl] bundle written to', distDir);
