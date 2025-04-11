import { ManagerOptions } from 'socket.io-client';
import { ClientStatus, RunnerReport, StressPhase } from '../types';
import { SocketOptions } from 'dgram';
import { availableParallelism } from 'os';
import path from 'path';
import { Worker } from 'node:worker_threads';
import EventEmitter from 'node:events';

export class TaskManager extends EventEmitter {
  private workersStatus: Record<
    number,
    {
      workerStatus: 'running' | 'finished';
      clientStatus: ClientStatus;
      report?: RunnerReport;
    }
  > = {};

  private clientsStatus: ClientStatus = {
    readyClients: 0,
    runningClients: 0,
    finishedClients: 0,
  };

  private workerErrors: Record<number, any[]> = {};

  constructor(
    private readonly target: string,
    private readonly phase: Omit<StressPhase, 'scenarioInitializer'> & {
      initializers: Partial<ManagerOptions & SocketOptions>[];
    },
  ) {
    super();
  }

  async run() {
    const threadsCount = availableParallelism();
    const starterClientsPerThread = Math.ceil(
      this.phase.minClients / threadsCount,
    );
    const finalClientsPerThread = this.phase.maxClients
      ? Math.ceil(
          (this.phase.maxClients - this.phase.minClients) / threadsCount,
        )
      : 0;

    for (let i = 0; i < threadsCount; i++) {
      const starterInitializers = this.phase.initializers.slice(
        i * starterClientsPerThread,
        (i + 1) * starterClientsPerThread,
      );
      const finalInitializers = this.phase.initializers.slice(
        i * finalClientsPerThread,
        (i + 1) * finalClientsPerThread,
      );

      const scenarioStr = this.phase.scenario.toString();

      const worker = new Worker(path.join(__dirname, 'test-runner.js'), {
        stdout: false,
        workerData: {
          target: this.target,
          phase: {
            starterInitializers,
            finalInitializers,
            scenario: scenarioStr,
          },
        },
      });

      this.workersStatus[worker.threadId] = {
        workerStatus: 'running',
        clientStatus: {
          readyClients: 0,
          runningClients: 0,
          finishedClients: 0,
        },
      };

      worker.on('message', (message) => {
        if (message.event === 'status') {
          this.workersStatus[worker.threadId] = message.data;
          this.clientsStatus = this.reCalculateClientsStatus();

          this.emit('status', this.clientsStatus);
        } else if (message.event === 'finished') {
          this.workersStatus[worker.threadId].workerStatus = 'finished';
          this.workersStatus[worker.threadId].report = message.report;
        }
      });

      worker.on('error', (error) => {
        this.workerErrors[worker.threadId].push(error);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          this.workerErrors[worker.threadId].push(
            new Error(`Worker stopped with exit code ${code}`),
          );
        }

        this.handleReport();
      });
    }
  }

  private reCalculateClientsStatus() {
    const status: ClientStatus = {
      readyClients: 0,
      runningClients: 0,
      finishedClients: 0,
    };

    for (const { clientStatus } of Object.values(this.workersStatus)) {
      status.readyClients += clientStatus.readyClients;
      status.runningClients += clientStatus.runningClients;
      status.finishedClients += clientStatus.finishedClients;
    }

    return status;
  }

  private handleReport() {
    for (const { workerStatus } of Object.values(this.workersStatus)) {
      if (workerStatus === 'running') {
        return;
      }
    }

    // TODO: handle report
  }
}
