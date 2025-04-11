import { workerData, parentPort } from 'node:worker_threads';
import { ClientReport, RunnerReport, SerializableStressPhase } from '../types';
import { Client } from './client';
import { random, sleep } from '../utils';

const {
  target,
  phase: { starterInitializers, finalInitializers, scenario, scenarioTimeout },
} = workerData as {
  target: string;
  phase: SerializableStressPhase;
};

const runnerReport: RunnerReport = {
  connection: {
    latencyFrames: [],
    successful: 0,
    failed: 0,
    reconnectAttempts: 0,
    reconnectSuccess: 0,
  },
  errors: [],
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
        scenario,
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

      runnerReport.connection.latencyFrames.push(report.connection.latency);
      if (report.connection.success) {
        runnerReport.connection.successful++;
      } else {
        runnerReport.connection.failed++;
      }
      runnerReport.connection.reconnectAttempts +=
        report.connection.reconnectAttempts;
      runnerReport.connection.reconnectSuccess +=
        report.connection.reconnectSuccess;

      runnerReport.errors.push(...report.errors);
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
