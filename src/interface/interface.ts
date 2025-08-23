import {
  ClientStatus,
  IOStressOptions,
  ResolvedStressPhase,
  StressReport,
  Task,
} from '../types';
import { ManagerOptions, SocketOptions } from 'socket.io-client';
import { TaskManager } from '../runner/task-manager';
import { resolvePhaseOptions, validateOptions } from './config';

export class IOStress {
  constructor(private readonly options: IOStressOptions) {
    validateOptions(options);
  }

  async run() {
    for (let i = 0; i < this.options.phases.length; i++) {
      const resolvedOptions = await resolvePhaseOptions(this.options, i);

      if (!i)
        resolvedOptions.interfaceOptions.eventsEmitter.emit('process-started');

      const aborted = await this.testPhase(resolvedOptions);

      resolvedOptions.interfaceOptions.eventsEmitter.removeAllListeners();

      if (aborted) break;
    }
  }

  private testPhase(phase: ResolvedStressPhase) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        phase.interfaceOptions.eventsEmitter.emit('phase-started', phase.name);

        phase.interfaceOptions.eventsEmitter.emit(
          'phase-task',
          Task.INITIALIZERS_BUILD,
          'Building phase initializers...',
        );
        let initializers: Partial<ManagerOptions & SocketOptions>[];
        try {
          initializers = await this.buildPhaseInitializers(phase);
        } catch (error: any) {
          phase.interfaceOptions.eventsEmitter.emit(
            'phase-task-result',
            Task.INITIALIZERS_BUILD,
            'Failed to build phase initializers!',
            false,
          );
          return reject(error.message);
        }

        phase.interfaceOptions.eventsEmitter.emit(
          'phase-task-result',
          Task.INITIALIZERS_BUILD,
          'Phase initializers built',
          true,
        );

        const taskManager = new TaskManager({ ...phase, initializers });

        phase.interfaceOptions.eventsEmitter.emit(
          'phase-task',
          Task.TEST_RUN,
          'Running test...',
          {
            readyClients: 0,
            runningClients: 0,
            finishedClients: 0,
          },
        );

        taskManager.on('status', (data: ClientStatus) => {
          phase.interfaceOptions.eventsEmitter.emit(
            'phase-task',
            Task.TEST_RUN,
            'Running test...',
            data,
          );
        });

        taskManager.on('hard-stopped', () => {
          phase.interfaceOptions.eventsEmitter.emit(
            'phase-task-result',
            Task.TEST_RUN,
            'Test has been aborted by user!',
            false,
          );

          resolve(true);
        });

        taskManager.on('gathering', () => {
          phase.interfaceOptions.eventsEmitter.emit(
            'phase-task-result',
            Task.TEST_RUN,
            'Finished',
            true,
          );
          phase.interfaceOptions.eventsEmitter.emit(
            'phase-task',
            Task.REPORT_GENERATE,
            'Generating report...',
          );
        });

        taskManager.on(
          'finished',
          (phaseResult: {
            report: StressReport;
            workerErrors: Record<number, any[]>;
          }) => {
            phase.interfaceOptions.eventsEmitter.emit(
              'phase-task-result',
              Task.REPORT_GENERATE,
              'Report generated',
              true,
            );

            phase.interfaceOptions.eventsEmitter.emit(
              'phase-result',
              phaseResult.report,
              phaseResult.workerErrors,
            );

            resolve(false);
          },
        );

        taskManager.run();
      } catch (error) {
        reject(error);
      }
    });
  }

  private async buildPhaseInitializers(phase: ResolvedStressPhase) {
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
