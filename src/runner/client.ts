import { io, ManagerOptions, Socket, SocketOptions } from 'socket.io-client';
import { ClientOptions, ClientReport } from '../types';
import { Performance } from '../utils';
import { isPromise } from 'node:util/types';
import EventEmitter from 'node:events';

export class Client extends EventEmitter {
  private socket: Socket;
  private report: ClientReport = {
    connection: {
      latency: -1,
      success: false,
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
  private performance: Performance = new Performance();

  constructor(
    private readonly options: ClientOptions,
    initializer: Partial<ManagerOptions & SocketOptions>,
  ) {
    super();

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
    });

    this.socket.on('connect_error', (error) => {
      this.report.errors.push({ type: 'connection', error });

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
      this.report.errors.push({ type: 'connection', error });
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
            this.report.errors.push({ type: 'business', error });
          }
        };
      }

      return originalEmit(ev, ...args);
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
  }

  runTest() {
    let timeout: NodeJS.Timeout | undefined;

    try {
      const fn = eval(this.options.scenario);

      if (this.options.scenarioTimeout) {
        timeout = setTimeout(() => {
          this.socket.off();
          this.socket.offAny();
          this.socket.offAnyOutgoing();
          this.socket.disconnect();
        }, this.options.scenarioTimeout);
      }

      fn(this.socket);

      this.emit('running');
    } catch (error) {
      if (timeout) clearTimeout(timeout);

      this.report.errors.push({ type: 'business', error });

      this.socket.off();
      this.socket.offAny();
      this.socket.offAnyOutgoing();
      this.socket.disconnect();
    }
  }
}
