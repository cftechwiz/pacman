#!/usr/bin/env node

/**
 * Module dependencies.
 */

var app = require('../app');
var http = require('http');
var baseLogger = require('../lib/logger');

var logger = baseLogger.child({ module: 'server' });

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '8080');
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);

var dbReady = app.locals && app.locals.dbReady ? app.locals.dbReady : Promise.resolve();

/**
 * Listen on provided port, on all network interfaces.
 */

dbReady.then(function() {
    server.listen(port);
    server.on('error', onError);
    server.on('listening', onListening);
}).catch(function(err) {
    logger.error({ err: err && err.message ? err.message : err }, 'Unable to start server because database connection failed');
    process.exit(1);
});

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }

    var bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            logger.error({ bind: bind, code: error.code }, bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            logger.error({ bind: bind, code: error.code }, bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    logger.info({ bind: bind }, 'Listening');
}
