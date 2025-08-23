import { ManagerOptions, SocketOptions } from 'socket.io-client';

export interface SerializableStressPhase {
  target: string;
  name: string;
  starterInitializers: Partial<ManagerOptions & SocketOptions>[];
  finalInitializers: Partial<ManagerOptions & SocketOptions>[];
  rampDelayRate: number;
  scenarioPath: string;
  scenarioTimeout?: number;
  logsDir: string;
}

export interface ClientOptions {
  target: string;
  scenarioTimeout?: number;
  scenarioPath: string;
  logsDir: string;
  initializer: Partial<ManagerOptions & SocketOptions>;
}

export interface ClientReport {
  connection: {
    attempted: boolean;
    latency: number;
    success: boolean;
    reconnectAttempts: number;
    reconnectSuccess: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
  };
  events: {
    sent: number;
    received: number;
    successful: number;
    failed: number;
    latencyFrames: number[];
  };
}

export interface RunnerReport {
  connections: {
    attempted: number;
    successful: number;
    failed: number;
    reconnectAttempts: number;
    reconnectSuccess: number;
    latencyFrames: number[];
  };
  errors: {
    total: number;
    byType: Record<string, number>;
  };
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

export interface ILogger {
  log: (message: string, type?: string) => void;
  error: (message: string | Error, type?: string) => void;
  warn: (message: string, type?: string) => void;
  debug: (message: string, type?: string) => void;
}
