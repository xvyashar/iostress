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
  constructor(private readonly options: IOStressOptions) {}

  async run() {
    console.log('🚀 ' + kleur.bold('Starting stress test...'));

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
          initializers,
          scenario: phase.scenario,
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
              `${process.cwd()}/${phase.name}-report.json`,
              JSON.stringify(report, null, 2),
              (error) => {
                if (error) {
                  testingSpinner.error('Failed to write report file!');
                  console.error(error);
                  resolve();
                  return;
                }

                testingSpinner.success('Phase finished!');

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
