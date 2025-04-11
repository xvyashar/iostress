import { ManagerOptions, SocketOptions } from 'socket.io-client';

/**
 * Configuration for a single phase of stress testing
 * @interface StressPhase
 * @property {string} name - Name of the stress test phase
 * @property {number} minClients - Minimum number of concurrent clients to run
 * @property {number} [maxClients] - Optional maximum number of concurrent clients
 * @property {Partial<ManagerOptions & SocketOptions>[]} starterInitializers - Socket connection initializers that should be fire up at the beginning of the phase
 * @property {Partial<ManagerOptions & SocketOptions>[]} finalInitializers - Socket connection initializers that should be fire up lazily at the end of the phase
 * @property {string} scenario - String representation of the stress test scenario function to execute
 * @property {number} [scenarioTimeout] - Optional timeout in milliseconds for the scenario
 */
export interface SerializableStressPhase {
  name: string;
  starterInitializers: Partial<ManagerOptions & SocketOptions>[];
  finalInitializers: Partial<ManagerOptions & SocketOptions>[];
  scenario: string;
  scenarioTimeout?: number;
}

export interface ClientOptions {
  target: string;
  scenarioTimeout?: number;
  scenario: string;
}

export interface ClientReport {
  connection: {
    latency: number;
    success: boolean;
    reconnectAttempts: number;
    reconnectSuccess: number;
  };
  errors: {
    type: string;
    error: any;
  }[];
  events: {
    sent: number;
    received: number;
    successful: number;
    failed: number;
    latencyFrames: number[];
  };
}

export interface RunnerReport {
  connection: {
    latencyFrames: number[];
    successful: number;
    failed: number;
    reconnectAttempts: number;
    reconnectSuccess: number;
  };
  errors: {
    type: string;
    error: any;
  }[];
  events: {
    sent: number;
    received: number;
    successful: number;
    failed: number;
    latencyFrames: number[];
  };
}

export type ClientStatus = {
  readyClients: number;
  runningClients: number;
  finishedClients: number;
};
