import { PinoLoggerOptions } from 'fastify/types/logger';

const isProduction = process.env.NODE_ENV === 'production';

export const loggerConfig: PinoLoggerOptions = isProduction
  ? {
      level: 'info',
      // Consider using a transport for file logging in production
      // for better performance and log rotation capabilities.
      // For now, we'll keep it simple.
    }
  : {
      level: 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    };
