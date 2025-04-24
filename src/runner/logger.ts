import EventEmitter from 'events';
import { ILogger } from '../types';
import { createLogger, format, transports, Logger as WinLogger } from 'winston';

export class Logger extends EventEmitter implements ILogger {
  private winston: WinLogger;

  constructor(logsPath?: string) {
    super();

    const { printf, combine, timestamp } = format;
    const fileFormat = printf(({ level, message, label, timestamp }) => {
      const spaces = ' '.repeat(7 - level.length);

      //? we do not need process id here
      return `${timestamp} ${spaces}${level.toUpperCase()} [${label}] ${message}`;
    });

    this.winston = createLogger({
      level: 'debug',
      format: combine(timestamp(), fileFormat),
      transports: [
        new transports.File({
          dirname: logsPath,
          filename: 'iostress.error.log',
          level: 'error',
        }),
        new transports.File({
          dirname: logsPath,
          filename: 'iostress.info.log',
          level: 'info',
        }),
        new transports.File({
          dirname: logsPath,
          filename: 'iostress.combined.log',
        }),
      ],
    });
  }

  log(message: string, type = 'Business') {
    this.winston.info(message, { label: type });
  }

  error(message: string | Error, type = 'Business') {
    this.winston.error(
      (typeof message === 'string'
        ? new Error(message).stack
        : message.stack) ?? 'Unknown error',
      { label: type },
    );

    this.emit('error', type);
  }

  warn(message: string, type = 'Business') {
    this.winston.warn(message, { label: type });
  }

  debug(message: string, type = 'Business') {
    this.winston.debug(message, { label: type });
  }
}
