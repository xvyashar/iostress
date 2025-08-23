import {
  ClientStatus,
  IOStressOptions,
  ResolvedStressPhase,
  StressEventsHandler,
  StressInterfaceOptions,
  Task,
  TerminationSignal,
} from '../types';
import * as v from 'valibot';
import {
  compileTsScenario,
  isValidExtension,
  loadTsConfig,
  StressEventsEmitter,
} from '../utils';
import path from 'node:path';
import fs from 'node:fs';
import kleur from 'kleur';
import { createSpinner, Spinner } from 'nanospinner';
import { inspect } from 'node:util';
import { pathToFileURL } from 'node:url';

export function validateOptions(options: IOStressOptions) {
  const interfaceOptions = v.optional(
    v.object({
      terminator: v.optional(v.function()),
      eventsHandler: v.optional(v.function()),
      logsDir: v.optional(v.string()),
    }),
  );

  const schema = v.object({
    target: v.pipe(v.string(), v.url()),
    interfaceOptions,
    phases: v.array(
      v.pipe(
        v.object({
          name: v.string(),
          minClients: v.pipe(v.number(), v.minValue(1)),
          maxClients: v.optional(v.pipe(v.number(), v.minValue(1))),
          rampDelayRate: v.optional(v.pipe(v.number(), v.minValue(100))),
          scenarioInitializer: v.optional(v.function()),
          scenarioPath: v.pipe(
            v.string(),
            v.transform((value) => path.resolve(value)),
            v.custom((value: any) => {
              if (!fs.existsSync(value)) {
                throw new Error('Scenario path not exists!');
              }

              if (!fs.statSync(value).isFile()) {
                throw new Error(`Scenario path is not a file: ${value}`);
              }

              const ext = path.extname(value);
              if (!isValidExtension(ext)) {
                throw new Error(`Invalid file extension for scenario: ${ext}`);
              }

              return true;
            }),
          ),
          scenarioTimeout: v.optional(v.pipe(v.number(), v.minValue(1000))),
          interfaceOptions,
          reportsPath: v.optional(v.string()),
          logsPath: v.optional(v.string()),
        }),
        v.custom((value: any) => {
          if (
            value.maxClients !== undefined &&
            value.maxClients <= value.minClients
          ) {
            throw new Error('Max clients must be greater than min clients!');
          }

          return true;
        }),
      ),
    ),
  });

  v.parse(schema, options);
}

export async function resolvePhaseOptions(
  options: IOStressOptions,
  phaseIndex: number,
): Promise<ResolvedStressPhase> {
  const phase = options.phases[phaseIndex];

  options.interfaceOptions =
    options.interfaceOptions || defaultTerminalInterface();

  if (!options.interfaceOptions.terminator)
    options.interfaceOptions.terminator = defaultTerminalTerminator();
  if (!options.interfaceOptions.eventsHandler)
    options.interfaceOptions.eventsHandler = defaultTerminalEventsHandler();
  if (!options.interfaceOptions.logsDir)
    options.interfaceOptions.logsDir = process.cwd();

  phase.scenarioPath = await resolveScenario(phase.scenarioPath);

  const interfaceOptions = (
    phase.interfaceOptions
      ? {
          ...options.interfaceOptions,
          ...phase.interfaceOptions,
        }
      : options.interfaceOptions
  ) as Required<StressInterfaceOptions>;

  const eventsEmitter = new StressEventsEmitter();
  interfaceOptions.eventsHandler(eventsEmitter); //? register handlers

  return {
    target: options.target,
    interfaceOptions: {
      terminator: interfaceOptions.terminator(),
      eventsEmitter,
      logsDir: interfaceOptions.logsDir,
    },
    name: phase.name,
    minClients: phase.minClients,
    maxClients: phase.maxClients ?? phase.minClients,
    rampDelayRate: phase.rampDelayRate ?? 100,
    scenarioInitializer: () => ({}),
    scenarioPath: phase.scenarioPath,
    scenarioTimeout: phase.scenarioTimeout,
  };
}

export function defaultTerminalInterface({
  softTerminatorSignal,
  hardTerminatorSignal,
  reportsDir,
  logsDir,
}: {
  softTerminatorSignal?: string;
  hardTerminatorSignal?: string;
  reportsDir?: string;
  logsDir?: string;
} = {}): Required<StressInterfaceOptions> {
  return {
    terminator: defaultTerminalTerminator(
      softTerminatorSignal,
      hardTerminatorSignal,
    ),
    eventsHandler: defaultTerminalEventsHandler(reportsDir),
    logsDir: logsDir ?? process.cwd(),
  };
}

export function defaultTerminalTerminator(
  softTerminatorSignal = 't',
  hardTerminatorSignal = '\u0003',
) {
  return function terminalTerminator() {
    const abortController = new AbortController();

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (key) => {
      if (key.toString() === softTerminatorSignal)
        abortController.abort(TerminationSignal.SIG_SOFT);
      else if (key.toString() === hardTerminatorSignal)
        abortController.abort(TerminationSignal.SIG_HARD);
    });

    abortController.signal.addEventListener(
      'abort',
      () => {
        process.stdin.setRawMode(false);
        process.stdin.removeAllListeners('data');
        process.stdin.pause();
      },
      { once: true },
    );

    return abortController;
  };
}

export function defaultTerminalEventsHandler(
  reportsDir?: string,
): StressEventsHandler {
  let activeSpinner: Spinner | null = null;

  return function terminalEventsHandler(eventEmitter: StressEventsEmitter) {
    eventEmitter
      .on('process-started', () => {
        console.log('🚀 ' + kleur.bold(`IO Stress v${__VERSION__}`));
      })
      .on('phase-started', (phaseName) => {
        console.log(`---------------------------------------------`);
        console.log(`Testing phase: ${kleur.green(phaseName)}...`);
      })
      .on('phase-task', (id, description, data) => {
        //? clients status data
        let details = '';
        if (id === Task.TEST_RUN) {
          const { readyClients, runningClients, finishedClients } =
            data as ClientStatus;

          details = `\n${kleur.gray(
            `  - [${readyClients}] ready clients\n  - [${runningClients}] running clients\n  - [${finishedClients}] finished clients`,
          )}`;
        }

        if (activeSpinner) activeSpinner.update(description + details);
        else {
          activeSpinner = createSpinner(description + details).start();
        }
      })
      .on('phase-task-result', (_, description, success) => {
        if (activeSpinner) {
          if (success) activeSpinner.success(description);
          else activeSpinner.error(description);

          activeSpinner = null;
        }
      })
      .on('phase-result', (report, workersErrors) => {
        reportsDir = reportsDir ?? path.join(process.cwd(), 'iostress-reports');

        if (!fs.existsSync(reportsDir)) {
          fs.mkdirSync(reportsDir, { recursive: true });
        }

        const reportsPath = path.join(
          reportsDir,
          `${report.phase
            .toLowerCase()
            .replaceAll(' ', '-')}-phase.report.json`,
        );

        try {
          fs.writeFileSync(reportsPath, JSON.stringify(report, null, 2));
          console.log(
            kleur.gray(
              `Phase test report saved at: ${kleur.cyan(reportsPath)}`,
            ),
          );

          if (Object.keys(workersErrors).length) {
            console.log(kleur.red('Workers errors:'));
            console.log(kleur.gray(inspect(workersErrors)));
          }
        } catch (error) {
          console.error('Failed to write report file!\n' + error);
        }
      });
  };
}

async function resolveScenario(scenarioPath: string) {
  const ext = path.extname(scenarioPath);
  if (ext === '.ts') {
    const tsConfig = loadTsConfig(path.dirname(scenarioPath));

    const outDir = path.join(__dirname, 'temp_sc_compiled');
    await compileTsScenario(scenarioPath, outDir, tsConfig ?? {});

    scenarioPath = path.join(outDir, path.basename(scenarioPath, ext) + '.js');
  }

  await validateScenario(scenarioPath);

  return scenarioPath;
}

async function validateScenario(scenarioPath: string) {
  scenarioPath = pathToFileURL(scenarioPath).href;
  let fn = (await import(scenarioPath)).default;

  if (typeof fn !== 'function' && typeof fn.default !== 'function')
    throw new Error(
      `Scenario file must export a default function!\n  - esm: export default ...\n  - cjs: module.exports = ...;`,
    );

  return;
}
