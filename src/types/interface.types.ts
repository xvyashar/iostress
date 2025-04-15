import { ManagerOptions, Socket, SocketOptions } from 'socket.io-client';
import { ILogger } from './runner.types';

/**
 * Configuration options for running IO stress tests
 * @interface IOStressOptions
 * @property {string} target - The target URL/endpoint to stress test
 * @property {StressPhase[]} phases - Array of test phases defining the stress test scenarios
 */
export interface IOStressOptions {
  target: string;
  phases: StressPhase[];
}

/**
 * Configuration for a single phase of stress testing
 * @interface StressPhase
 * @property {string} name - Name of the stress test phase
 * @property {number} minClients - Minimum number of concurrent clients to run
 * @property {number} [maxClients] - Optional maximum number of concurrent clients
 * @property {number} [rampDelayRate] - Default: 100
 * @property {StressScenarioInitializer} [scenarioInitializer] - Optional function to initialize the socket connection
 * @property {string} scenarioPath - The js file that exports stress test scenario function to execute
 * @property {number} [scenarioTimeout] - Optional timeout in milliseconds for the scenario
 */
export interface StressPhase {
  name: string;
  minClients: number;
  maxClients?: number;
  rampDelayRate?: number;
  scenarioInitializer?: StressScenarioInitializer;
  scenarioPath: string;
  scenarioTimeout?: number;
}

/**
 * A function that returns Socket.io client connection configuration options
 * @param {number} clientNumber - The client number (attempt) to initialize
 * @returns {Partial<ManagerOptions & SocketOptions>} Socket configuration options
 */
export type StressScenarioInitializer = (
  clientNumber: number,
) => Partial<ManagerOptions & SocketOptions>;

/**
 * A stress test scenario function that executes socket operations
 * @param {Socket} socket - The initialized Socket.io client connection
 */
export type StressScenario = (
  socket: Socket,
  logger: ILogger,
) => void | Promise<void>;

/**
 * A stress test report (array of phases report)
 */
export interface StressReport {
  phase: string;
  testDuration: number;
  connections: {
    attempted: number;
    successful: number;
    failed: number;
    averageConnectionTime: number;
    reconnectAttempts: number;
  };
  events: {
    sent: number;
    received: number;
    successful: number;
    failed: number;
    throughput: number;
  };
  latency: {
    average: number;
    min: number;
    max: number;
    p50: number;
    p85: number;
    p95: number;
    p99: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
  };
}
