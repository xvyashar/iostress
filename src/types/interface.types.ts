import { ManagerOptions, Socket, SocketOptions } from 'socket.io-client';
import { ILogger } from './runner.types';
import { StressEventsEmitter } from '../utils';

/**
 * Configuration options for running IO stress tests
 * @interface IOStressOptions
 * @property {string} target - The target URL/endpoint to stress test
 * @property {StressInterfaceOptions} [interfaceOptions] - Optional stress test input and output configuration. Default: defaultTerminalInterface()
 * @property {StressPhase[]} phases - Array of test phases defining the stress test scenarios
 */
export interface IOStressOptions {
  target: string;
  interfaceOptions?: StressInterfaceOptions;
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
 * @property {StressInterfaceOptions} [interfaceOptions] - Optional interface options that overrides that top level options for this specific phase.
 */
export interface StressPhase {
  name: string;
  minClients: number;
  maxClients?: number;
  rampDelayRate?: number;
  scenarioInitializer?: StressScenarioInitializer;
  scenarioPath: string;
  scenarioTimeout?: number;
  interfaceOptions?: StressInterfaceOptions;
}

export interface ResolvedStressPhase {
  target: string;
  interfaceOptions: {
    terminator: AbortController;
    eventsEmitter: StressEventsEmitter;
    logsDir: string;
  };
  name: string;
  minClients: number;
  maxClients: number;
  rampDelayRate: number;
  scenarioInitializer: StressScenarioInitializer;
  scenarioPath: string;
  scenarioTimeout?: number;
}

/**
 * Configuration options for stress test input and output interface
 * @interface StressInterfaceOptions
 * @property {TerminatorFactory} [terminator] - Optional AbortController factory function for terminating the stress test gracefully/forcefully. Default: defaultTerminalTerminator()
 * @property {StressEventsHandler} [eventsHandler] - Optional events updates handler. Default: defaultTerminalEventsHandler()
 * @property {string} [logsDir] - Optional logs directory. Default: process.cwd()
 */
export interface StressInterfaceOptions {
  terminator?: TerminatorFactory;
  eventsHandler?: StressEventsHandler;
  logsDir?: string;
}

export type TerminatorFactory = () => AbortController;

export enum TerminationSignal {
  SIG_SOFT,
  SIG_HARD,
  SIG_CLEANUP,
}

/**
 * Stress test events
 * @interface StressEvents
 */
export interface StressEvents {
  /**
   * Emitted when the overall stress process has started.
   */
  'process-started': () => void | Promise<void>;

  /**
   * Emitted when a new phase begins.
   *
   * @param phaseName - The name of the phase (e.g. "Warmup", "Load").
   */
  'phase-started': (phaseName: string) => void | Promise<void>;

  /**
   * Emitted when a task within a phase is started or updated.
   *
   * @param description - Human-readable description of the task.
   * @param data - Optional task-related metadata.
   */
  'phase-task': (
    id: Task,
    description: string,
    data?: unknown,
  ) => void | Promise<void>;

  /**
   * Emitted when a task within a phase finishes.
   *
   * @param description - Updated description string.
   * @param success - Whether the task completed successfully.
   */
  'phase-task-result': (
    id: Task,
    description: string,
    success: boolean,
  ) => void | Promise<void>;

  /**
   * Emitted after a phase is completed with aggregated results.
   *
   * @param report - Aggregated stress test report for the phase.
   * @param workersErrors - Map of worker IDs to arrays of errors.
   */
  'phase-result': (
    report: StressReport,
    workersErrors: Record<number, any[]>,
  ) => void | Promise<void>;
}

export enum Task {
  INITIALIZERS_BUILD,
  TEST_RUN,
  REPORT_GENERATE,
}

/**
 * A function that handles stress test events updates
 * @param {StressEventsEmitter} eventEmitter - event emitter, that emits stress test events
 * @returns {void}
 */
export type StressEventsHandler = (eventEmitter: StressEventsEmitter) => void;

/**
 * A function that returns Socket.io client connection configuration options
 * @param {number} clientNumber - The client number (attempt) to initialize
 * @returns {Partial<ManagerOptions & SocketOptions> | Promise<Partial<ManagerOptions & SocketOptions>>} Socket configuration options
 */
export type StressScenarioInitializer = (
  clientNumber: number,
) =>
  | Partial<ManagerOptions & SocketOptions>
  | Promise<Partial<ManagerOptions & SocketOptions>>;

/**
 * A stress test scenario function that executes socket operations
 * @param {Socket} socket - The initialized Socket.io client connection
 * @param {ILogger} logger - console.log won't work while executing scenario, use logger instead
 * @returns {void | Promise<void>}
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
