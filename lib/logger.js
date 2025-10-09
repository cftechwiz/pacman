'use strict';

const pino = require('pino');

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info');

const logger = pino({
    level
});

module.exports = logger;
