import { readFileSync } from 'fs';
import { join } from 'path';
import { defineConfig } from 'tsup';

const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

export default defineConfig([
  {
    format: ['cjs', 'esm'],
    entry: ['./src/index.ts'],
    dts: true,
    shims: true,
    skipNodeModulesBundle: true,
    clean: true,
    define: {
      __VERSION__: `"${pkg.version}"`,
    },
  },
  {
    format: ['cjs', 'esm'],
    entry: ['./src/runner/test-runner.ts'],
    dts: true,
    shims: true,
    skipNodeModulesBundle: true,
    clean: true,
  },
]);
