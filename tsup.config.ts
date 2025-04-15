import { defineConfig } from 'tsup';

export default defineConfig([
  {
    format: ['cjs', 'esm'],
    entry: ['./src/index.ts'],
    dts: true,
    shims: true,
    skipNodeModulesBundle: true,
    clean: true,
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
