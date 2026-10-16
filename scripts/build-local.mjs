// Build with the installed TypeScript and Rollup APIs, without compiler subprocesses.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { rollup } from 'rollup';
import { build } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function typescriptPlugin() {
  return {
    name: 'local-typescript',
    enforce: 'pre',
    transform(code, id) {
      // Inline the standard production flag before Vite's optional esbuild define pass.
      const original = code;
      if (id.includes('node_modules')) code = code.replaceAll('process.env.NODE_ENV', '"production"');
      if (!/\.tsx?$/.test(id) || id.includes('node_modules')) return code === original ? null : { code, map: null };
      const result = ts.transpileModule(code, {
        fileName: id,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, sourceMap: true }
      });
      return { code: result.outputText, map: result.sourceMapText };
    }
  };
}
const backend = await rollup({
  input: path.join(root, 'backend/src/index.ts'),
  external: id => !id.startsWith('.') && !path.isAbsolute(id),
  plugins: [{
    name: 'local-typescript-resolution',
    resolveId(id, importer) {
      if (!id.startsWith('.') || !importer) return null;
      const target = path.resolve(path.dirname(importer), id);
      return [target + '.ts', path.join(target, 'index.ts')].find(fs.existsSync) || null;
    }
  }, typescriptPlugin()]
});
await backend.write({ file: path.join(root, 'backend/dist/server.cjs'), format: 'cjs', inlineDynamicImports: true, sourcemap: true });
await backend.close();
await build({
  configFile: false,
  root: path.join(root, 'frontend'),
  plugins: [typescriptPlugin(), ...tailwindcss()],
  esbuild: false,
  build: { target: 'esnext', minify: false, cssMinify: false, sourcemap: true },
  resolve: { preserveSymlinks: true, alias: { '@': path.join(root, 'frontend') } }
});
console.log('Local frontend and backend builds are ready.');
