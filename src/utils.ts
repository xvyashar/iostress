import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import kleur from 'kleur';

export class Performance {
  private timers: Record<number, [number, number]> = {};
  private incrementorIdx = 0;

  measure(timerId: number, keepTimer = false) {
    if (!this.timers[timerId]) return -1;

    const [seconds, nanoseconds] = process.hrtime(this.timers[timerId]);
    const milliseconds = seconds * 1e3 + nanoseconds / 1e6; // convert to milliseconds

    if (!keepTimer) this.delete(timerId);

    return milliseconds;
  }

  delete(timerId: number) {
    if (this.timers[timerId]) delete this.timers[timerId];
  }

  start() {
    this.timers[this.incrementorIdx] = process.hrtime();
    return this.incrementorIdx++;
  }
}

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const random = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const calculatePercentiles = (
  percentiles: number[],
  latencies: number[],
) => {
  const sortedLatencies = [...latencies].sort((a, b) => a - b);

  const results: Record<string, number> = {};

  for (const percentile of percentiles) {
    const index = Math.ceil((percentile / 100) * sortedLatencies.length) - 1;
    results[`p${percentile}`] = sortedLatencies[index];
  }

  return results;
};

export const compileTsScenario = async (
  scenarioPath: string,
  outDir: string,
  compilerOptions: ts.CompilerOptions = {},
) => {
  const options: ts.CompilerOptions = {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    noEmitOnError: true,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,

    ...compilerOptions,

    noEmit: false,
    declaration: false,
    rootDir: undefined,
    outDir,
  };

  const program = ts.createProgram([scenarioPath], options);
  const emitResult = program.emit();

  const allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  if (allDiagnostics.length) {
    const formatted = ts.formatDiagnosticsWithColorAndContext(allDiagnostics, {
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getNewLine: () => `${ts.sys.newLine}  -> `,
    });
    throw new Error(`${kleur.red('[TS] Compilation error:')}\n${formatted}`);
  }
};

export const loadTsConfig = (
  startDir: string,
): ts.CompilerOptions | undefined => {
  let dir = path.resolve(startDir);
  let tsconfigPath: string | undefined;
  while (true) {
    const configPath = path.join(dir, 'tsconfig.json');
    if (fs.existsSync(configPath)) {
      tsconfigPath = configPath;
      break;
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  if (!tsconfigPath) return;

  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(
      `${kleur.red('[TS] Reading tsconfig.json error:')}\n  - at: ${kleur.gray(
        tsconfigPath,
      )}\n${ts.flattenDiagnosticMessageText(
        configFile.error.messageText,
        '\n  -> ',
      )}`,
    );
  }

  const configParseResult = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(tsconfigPath),
  );

  if (configParseResult.errors.length) {
    const errorsFormatted = ts.formatDiagnosticsWithColorAndContext(
      configParseResult.errors,
      {
        getCanonicalFileName: (f) => f,
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        getNewLine: () => `${ts.sys.newLine}  -> `,
      },
    );
    throw new Error(
      `${kleur.red('[TS] Parsing tsconfig error:')}\n${errorsFormatted}`,
    );
  }

  return configParseResult.options;
};

export const isValidExtension = (ext: string) =>
  ['.js', '.ts'].includes(ext.toLowerCase());
