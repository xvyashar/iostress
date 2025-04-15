import { workerData, parentPort } from 'node:worker_threads';
import { ClientReport, RunnerReport, SerializableStressPhase } from '../types';
import { Client } from './client';
import { random, sleep } from '../utils';

const {
  target,
  phase: {
    starterInitializers,
    finalInitializers,
    scenarioPath,
    scenarioTimeout,
  },
} = workerData as {
  target: string;
  phase: SerializableStressPhase;
};

const runnerReport: RunnerReport = {
  connections: {
    attempted: 0,
    successful: 0,
    failed: 0,
    reconnectAttempts: 0,
    reconnectSuccess: 0,
    latencyFrames: [],
  },
  errors: {
    total: 0,
    byType: {},
  },
  events: {
    sent: 0,
    received: 0,
    successful: 0,
    failed: 0,
    latencyFrames: [],
  },
};

const clientsCount = starterInitializers.length + finalInitializers.length;

let readyClients = 0;
let runningClients = 0;
let finishedClients = 0;

const runPhaseSlice = async () => {
  let lazy = false;

  for (const initializer of [...starterInitializers, ...finalInitializers]) {
    if (lazy) await sleep(random(1, 10) * 100);

    readyClients++;

    if (!lazy && readyClients >= starterInitializers.length) {
      lazy = true;
    }

    const client = new Client(
      {
        target,
        scenarioPath,
        scenarioTimeout,
      },
      initializer,
    );

    client.on('running', () => {
      readyClients--;
      runningClients++;

      parentPort?.postMessage({
        event: 'status',
        data: {
          readyClients,
          runningClients,
          finishedClients,
        },
      });
    });

    client.on('finished', (report: ClientReport) => {
      runningClients--;
      finishedClients++;

      parentPort?.postMessage({
        event: 'status',
        data: {
          readyClients,
          runningClients,
          finishedClients,
        },
      });

      if (report.connection.attempted) runnerReport.connections.attempted++;
      if (report.connection.success) runnerReport.connections.successful++;
      else runnerReport.connections.failed++;

      runnerReport.connections.reconnectAttempts +=
        report.connection.reconnectAttempts;
      runnerReport.connections.reconnectSuccess +=
        report.connection.reconnectSuccess;

      runnerReport.connections.latencyFrames.push(report.connection.latency);

      runnerReport.errors.total += report.errors.total;
      for (const errorType in report.errors.byType) {
        if (runnerReport.errors.byType[errorType]) {
          runnerReport.errors.byType[errorType] +=
            report.errors.byType[errorType];
        } else {
          runnerReport.errors.byType[errorType] =
            report.errors.byType[errorType];
        }
      }

      runnerReport.events.sent += report.events.sent;
      runnerReport.events.received += report.events.received;
      runnerReport.events.successful += report.events.successful;
      runnerReport.events.failed += report.events.failed;
      runnerReport.events.latencyFrames.push(...report.events.latencyFrames);

      if (clientsCount === finishedClients) {
        parentPort?.postMessage({
          event: 'finished',
          report: runnerReport,
        });

        process.exit(0);
      }
    });

    client.runTest();
  }
};

runPhaseSlice();
