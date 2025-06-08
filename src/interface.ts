import {
  ClientStatus,
  IOStressOptions,
  StressPhase,
  StressReport,
} from './types';
import kleur from 'kleur';
import { createSpinner } from 'nanospinner';
import { ManagerOptions, SocketOptions } from 'socket.io-client';
import { TaskManager } from './runner/task-manager';
import fs from 'fs';
import { inspect } from 'util';
import * as v from 'valibot';
import path from 'path';
import { compileTsScenario, loadTsConfig, isValidExtension } from './utils';

export class IOStress {
  constructor(private readonly options: IOStressOptions) {
    this.validateOptions();
  }

  async run() {
    console.log('🚀 ' + kleur.bold(`IO Stress v${__VERSION__}`));

    for (const phase of this.options.phases) {
      await this.testPhase(phase);
    }
  }

  private validateOptions() {
    const schema = v.object({
      target: v.pipe(v.string(), v.url()),
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

                const stat = fs.statSync(value);
                if (!stat.isFile()) {
                  throw new Error(`Scenario path is not a file: ${value}`);
                }

                const ext = path.extname(value);
                if (!isValidExtension(ext)) {
                  throw new Error(
                    `Invalid file extension for scenario: ${ext}`,
                  );
                }

                return true;
              }),
            ),
            scenarioTimeout: v.optional(v.pipe(v.number(), v.minValue(1000))),
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

    v.parse(schema, this.options);
  }

  private testPhase(phase: StressPhase) {
    return new Promise<void>(async (resolve, reject) => {
      try {
        console.log(`---------------------------------------------`);
        console.log(`Testing phase: ${kleur.green(phase.name)}...`);

        const ext = path.extname(phase.scenarioPath);
        if (ext === '.ts') {
          const phaseScenarioSpinner = createSpinner(
            `Compiling phase scenario...\n${kleur.gray(
              '  - Looking for tsconfig.json...',
            )}`,
          ).start();

          try {
            const tsConfig = loadTsConfig(path.dirname(phase.scenarioPath));
            if (tsConfig) {
              phaseScenarioSpinner.update(
                `Compiling phase scenario...\n${kleur.gray(
                  `  - Found tsconfig.json`,
                )}`,
              );
            } else {
              phaseScenarioSpinner.update(
                `Compiling phase scenario...\n${kleur.gray(
                  '  - No tsconfig.json found, using default compiler options',
                )}`,
              );
            }

            const outDir = path.join(__dirname, 'temp_sc_compiled');
            await compileTsScenario(phase.scenarioPath, outDir, tsConfig ?? {});

            phase.scenarioPath = path.join(
              outDir,
              path.basename(phase.scenarioPath, ext) + '.js',
            );
            phaseScenarioSpinner.success(
              'Phase scenario compiled successfully',
            );
          } catch (error: any) {
            phaseScenarioSpinner.error('Failed to compile phase scenario!');
            console.error(error.message);
            process.exit(1);
          }
        }

        const phaseBuildSpinner = createSpinner(
          'Building phase initializers...',
        ).start();
        const initializers = await this.buildPhaseInitializers(phase).catch(
          (error: any) => {
            phaseBuildSpinner.error('Failed to build phase initializers!');
            console.error(error.message);
            process.exit(1);
          },
        );
        phaseBuildSpinner.success('Phase initializers built');

        const taskManager = new TaskManager(this.options.target, {
          name: phase.name,
          minClients: phase.minClients,
          maxClients: phase.maxClients,
          rampDelayRate: phase.rampDelayRate,
          initializers,
          scenarioPath: phase.scenarioPath,
          scenarioTimeout: phase.scenarioTimeout,
          logsPath: phase.logsPath,
        });

        const testingSpinner = createSpinner('Running test...').start();

        taskManager.validateScenario().catch((error: any) => {
          testingSpinner.error('Failed to run test!');
          console.error(error.message);
          process.exit(1);
        });

        taskManager.on(
          'status',
          ({ readyClients, runningClients, finishedClients }: ClientStatus) => {
            testingSpinner.update(
              `Running test...\n${kleur.gray(
                `  - [${readyClients}] ready clients\n  - [${runningClients}] running clients\n  - [${finishedClients}] finished clients`,
              )}`,
            );
          },
        );

        taskManager.on('gathering', () => {
          testingSpinner.update('Generating report...');
        });

        taskManager.on(
          'finished',
          ({
            report,
            workerErrors,
          }: {
            report: StressReport;
            workerErrors: Record<number, any[]>;
          }) => {
            const reportsDir =
              phase.reportsPath ?? path.join(process.cwd(), 'iostress-reports');

            if (!fs.existsSync(reportsDir)) {
              fs.mkdirSync(reportsDir, { recursive: true });
            }

            const reportsPath = path.join(
              reportsDir,
              `${phase.name
                .toLowerCase()
                .replaceAll(' ', '-')}-phase.report.json`,
            );

            fs.writeFile(
              reportsPath,
              JSON.stringify(report, null, 2),
              (error) => {
                if (error) {
                  testingSpinner.error('Failed to write report file!');
                  console.error(error);
                  resolve();
                  return;
                }

                testingSpinner.success('Finished!');

                console.log(
                  kleur.gray(
                    `Phase test report saved at: ${kleur.cyan(reportsPath)}`,
                  ),
                );

                if (Object.keys(workerErrors).length) {
                  console.log(kleur.red('Workers errors:'));
                  console.log(kleur.gray(inspect(workerErrors)));
                }

                resolve();
              },
            );
          },
        );

        taskManager.run();
      } catch (error) {
        reject(error);
      }
    });
  }

  private async buildPhaseInitializers(phase: StressPhase) {
    const initializers: Partial<ManagerOptions & SocketOptions>[] = [];
    const { scenarioInitializer, minClients, maxClients } = phase;

    for (let i = 0; i < (maxClients ?? minClients); i++) {
      if (scenarioInitializer) {
        initializers.push(await scenarioInitializer(i));
      } else {
        initializers.push({});
      }
    }

    return initializers;
  }
}
