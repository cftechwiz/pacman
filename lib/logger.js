'use strict';

const pino = require('pino');

const level =
  process.env.LOG_LEVEL ||
  (process.env.NODE_ENV === 'test' ? 'silent' : 'info');

function createPrettyTransport() {
  if (process.env.PINO_PRETTY === 'false') {
    return null;
  }

  try {
    return pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        singleLine: true,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      'pino-pretty unavailable, falling back to JSON logs:',
      err.message || err
    );
    return null;
  }
}

const transport = createPrettyTransport();

const logger = transport ? pino({ level }, transport) : pino({ level });

module.exports = logger;
