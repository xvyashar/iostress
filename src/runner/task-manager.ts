import { ManagerOptions } from 'socket.io-client';
import {
  ClientStatus,
  RunnerReport,
  SerializableStressPhase,
  StressPhase,
  StressReport,
} from '../types';
import { SocketOptions } from 'dgram';
import { availableParallelism } from 'os';
import path from 'path';
import { Worker } from 'node:worker_threads';
import EventEmitter from 'node:events';
import { calculatePercentiles, Performance } from '../utils';
import { pathToFileURL } from 'node:url';

export class TaskManager extends EventEmitter {
  private performance = new Performance();
  private phaseTimer?: number;

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

    this.phaseTimer = this.performance.start();

    for (let i = 0; i < threadsCount; i++) {
      const starterInitializers = this.phase.initializers.slice(
        i * starterClientsPerThread,
        (i + 1) * starterClientsPerThread,
      );
      const starterGap = threadsCount * starterClientsPerThread;
      const finalInitializers = this.phase.initializers.slice(
        i * finalClientsPerThread + starterGap,
        (i + 1) * finalClientsPerThread + starterGap,
      );

      const resolved = path.resolve(this.phase.scenarioPath);
      const scenarioPath = pathToFileURL(resolved).href;

      const worker = new Worker(path.join(__dirname, 'test-runner.js'), {
        stdout: false,
        workerData: {
          target: this.target,
          phase: {
            name: this.phase.name,
            starterInitializers,
            finalInitializers,
            rampDelayRate: this.phase.rampDelayRate,
            scenarioPath,
            scenarioTimeout: this.phase.scenarioTimeout,
          } as SerializableStressPhase,
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
          this.workersStatus[worker.threadId].clientStatus = message.data;
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

    this.emit('gathering');

    const finalReport: StressReport = {
      phase: this.phase.name,
      testDuration: this.performance.measure(this.phaseTimer!) / 1000,
      connections: {
        attempted: 0,
        successful: 0,
        failed: 0,
        averageConnectionTime: 0,
        reconnectAttempts: 0,
      },
      events: {
        sent: 0,
        received: 0,
        successful: 0,
        failed: 0,
        throughput: 0,
      },
      latency: {
        average: 0,
        min: -1,
        max: -1,
        p50: 0,
        p85: 0,
        p95: 0,
        p99: 0,
      },
      errors: {
        total: 0,
        byType: {},
      },
    };

    const connectionsFramesData = {
      total: 0,
      sum: 0,
    };
    const latencyFrames: number[] = [];

    for (const { report } of Object.values(this.workersStatus)) {
      if (!report) continue;

      finalReport.connections.attempted += report.connections.attempted;
      finalReport.connections.successful += report.connections.successful;
      finalReport.connections.failed += report.connections.failed;
      finalReport.connections.reconnectAttempts +=
        report.connections.reconnectAttempts;

      finalReport.events.sent += report.events.sent;
      finalReport.events.received += report.events.received;
      finalReport.events.successful += report.events.successful;
      finalReport.events.failed += report.events.failed;

      finalReport.latency.min =
        finalReport.latency.min === -1
          ? Math.min(...report.events.latencyFrames)
          : Math.min(...report.events.latencyFrames, finalReport.latency.min);
      finalReport.latency.max = Math.max(
        ...report.events.latencyFrames,
        finalReport.latency.max,
      );

      finalReport.errors.total += report.errors.total;
      for (const errorType in report.errors.byType) {
        if (finalReport.errors.byType[errorType]) {
          finalReport.errors.byType[errorType] +=
            report.errors.byType[errorType];
        } else {
          finalReport.errors.byType[errorType] =
            report.errors.byType[errorType];
        }
      }

      connectionsFramesData.total += report.connections.latencyFrames.length;
      connectionsFramesData.sum += report.connections.latencyFrames.reduce(
        (acc, cur) => acc + cur,
        0,
      );
      latencyFrames.push(...report.events.latencyFrames);
    }

    finalReport.connections.averageConnectionTime =
      connectionsFramesData.sum / connectionsFramesData.total;

    finalReport.latency.average =
      latencyFrames.reduce((acc, cur) => acc + cur, 0) / latencyFrames.length;

    finalReport.events.throughput = Number(
      (1000 / finalReport.latency.average).toFixed(2),
    );

    const { p50, p85, p95, p99 } = calculatePercentiles(
      [50, 85, 95, 99],
      latencyFrames,
    );

    finalReport.latency.p50 = p50;
    finalReport.latency.p85 = p85;
    finalReport.latency.p95 = p95;
    finalReport.latency.p99 = p99;

    this.emit('finished', {
      report: finalReport,
      workerErrors: this.workerErrors,
    });
  }
}
