import fs from 'fs';
import winston from 'winston';
import { config } from '../config';

const isProduction = config.nodeEnv === 'production';

if (isProduction) {
  fs.mkdirSync('logs', { recursive: true });
}

/**
 * Development format: human-readable, colorized, single-line.
 * Errors include the full stack trace.
 */
const devFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    const stackStr = stack ? `\n${String(stack)}` : '';
    return `${String(timestamp)} [${level}]: ${String(message)}${metaStr}${stackStr}`;
  })
);

/**
 * Production format: structured JSON, one object per line.
 * Every entry includes the service name so multi-service log aggregators
 * (Datadog, CloudWatch, ELK) can filter by origin without configuration.
 * The `errors` format serialises Error.stack into the log entry.
 */
const prodFormat = winston.format.combine(
  winston.format.errors({ stack: true }),
  winston.format.timestamp(),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: isProduction ? prodFormat : devFormat,

  // Stamped on every log entry regardless of format or transport.
  // Enables log aggregators to group entries by origin without parsing the message.
  defaultMeta: { service: 'monday-access-service' },

  transports: [
    new winston.transports.Console(),
    ...(isProduction
      ? [
          new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
          new winston.transports.File({ filename: 'logs/combined.log' }),
        ]
      : []),
  ],
});
