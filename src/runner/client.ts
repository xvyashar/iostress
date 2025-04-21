import { io, ManagerOptions, Socket, SocketOptions } from 'socket.io-client';
import { ClientOptions, ClientReport, StressScenario } from '../types';
import { Performance } from '../utils';
import { isPromise } from 'node:util/types';
import EventEmitter from 'node:events';
import { Logger } from './logger';

export class Client extends EventEmitter {
  private socket: Socket;
  private report: ClientReport = {
    connection: {
      attempted: false,
      latency: -1,
      success: false,
      reconnectAttempts: 0,
      reconnectSuccess: 0,
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
  private performance: Performance = new Performance();
  private logger = new Logger();

  constructor(
    private readonly options: ClientOptions,
    initializer: Partial<ManagerOptions & SocketOptions>,
  ) {
    super();

    this.logger.on('error', (type) => {
      this.report.errors.total++;
      this.report.errors.byType[type] =
        (this.report.errors.byType[type] ?? 0) + 1;
    });

    const connTimer = this.performance.start();
    this.socket = io(this.options.target, initializer);

    //* Connection events
    this.socket.on('connect', () => {
      if (this.report.connection.latency === -1) {
        this.report.connection.latency = this.performance.measure(
          connTimer,
          true,
        );

        this.report.connection.success = true;
      }

      this.report.connection.attempted = true;
    });

    this.socket.on('connect_error', (error) => {
      this.logger.error(error, 'Connection');

      if (!this.socket.active) {
        this.emit('finished', this.report);
      }
    });

    this.socket.on('reconnect_attempt', () => {
      this.report.connection.reconnectAttempts++;
    });

    this.socket.on('reconnect', () => {
      this.report.connection.reconnectSuccess++;
    });

    this.socket.on('reconnect_error', (error) => {
      this.logger.error(error, 'Connection');
    });

    //* Event tracking
    const originalEmit = this.socket.emit.bind(this.socket);
    this.socket.emit = (ev: any, ...args: any[]) => {
      const emitTimer = this.performance.start(); //? start timer

      const lastArg = args[args.length - 1]; //? check if last arg is a ack function
      if (typeof lastArg === 'function') {
        const originalAck: Function = lastArg;
        args[args.length - 1] = async (...ackArgs: any[]) => {
          try {
            const latency = this.performance.measure(emitTimer); //? measure latency
            this.report.events.latencyFrames.push(latency);

            //? execute original ack
            let result: any;
            if (isPromise(originalAck)) result = await originalAck(...ackArgs);
            else result = originalAck(...ackArgs);

            this.report.events.successful++; //? successful ack

            return result;
          } catch (error) {
            this.report.events.failed++; //? failed ack
            this.logger.error(error as Error, 'Business');
          }
        };
      }

      try {
        const result = originalEmit(ev, ...args);

        if (typeof lastArg !== 'function') {
          const latency = this.performance.measure(emitTimer); //? measure latency
          this.report.events.latencyFrames.push(latency);
          this.report.events.successful++; //? successful ack
        }

        return result;
      } catch (error) {
        this.report.events.failed++; //? failed ack
        this.logger.error(error as Error, 'Business');
        throw error;
      }
    };

    this.socket.emitWithAck = (ev: any, ...args: any[]) => {
      return new Promise((resolve, reject) => {
        try {
          this.socket.emit(ev, ...args, (result: any) => {
            resolve(result);
          });
        } catch (error) {
          reject(error);
        }
      });
    };

    this.socket.onAnyOutgoing(() => {
      this.report.events.sent++;
    });

    this.socket.onAny(() => {
      this.report.events.received++;
    });

    this.socket.on('disconnect', (reason) => {
      if (
        reason === 'io server disconnect' ||
        reason === 'io client disconnect'
      ) {
        this.emit('finished', this.report);
      }
    });

    this.on('SIGTERM', () => {
      if (this.socket.connected) {
        this.socket.disconnect();
      } else {
        this.socket.off();
        this.socket.offAny();
        this.socket.offAnyOutgoing();
        this.socket.disconnect();
        this.socket.close();

        this.emit('finished', this.report);
      }
    });
  }

  async runTest() {
    let timeout: NodeJS.Timeout | undefined;

    try {
      const fn = (await import(this.options.scenarioPath))
        .default as StressScenario;

      if (this.options.scenarioTimeout) {
        timeout = setTimeout(() => {
          this.socket.disconnect();
        }, this.options.scenarioTimeout);
      }

      fn(this.socket, this.logger);

      this.emit('running');
    } catch (error) {
      if (timeout) clearTimeout(timeout);

      this.logger.error(error as Error, 'Business');

      this.socket.disconnect();
    }
  }
}
