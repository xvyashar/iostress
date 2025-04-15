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

export class IOStress {
  private version: string;
  constructor(private readonly options: IOStressOptions) {
    this.version = JSON.parse(
      fs.readFileSync(`${__dirname}/../package.json`, 'utf8'),
    ).version;
  }

  async run() {
    console.log('🚀 ' + kleur.bold(`IO Stress v${this.version}`));

    for (const phase of this.options.phases) {
      await this.testPhase(phase);
    }
  }

  private testPhase(phase: StressPhase) {
    return new Promise<void>(async (resolve, reject) => {
      try {
        console.log(`---------------------------------------------`);
        console.log(`Testing phase: ${kleur.green(phase.name)}...`);

        const phaseBuildSpinner = createSpinner(
          'Building phase initializers...',
        ).start();
        const initializers = await this.buildPhaseInitializers(phase).catch(
          (error) => {
            phaseBuildSpinner.error('Failed to build phase initializers!');
            throw error;
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
        });

        const testingSpinner = createSpinner('Running test...').start();

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
            fs.writeFile(
              `${process.cwd()}/${phase.name.toLowerCase()}-phase.report.json`,
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
                    `Phase test report saved at: ${kleur.cyan(
                      `./${phase.name.toLowerCase()}-phase.report.json`,
                    )}`,
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
        initializers.push(scenarioInitializer(i));
      } else {
        initializers.push({});
      }
    }

    return initializers;
  }
}
