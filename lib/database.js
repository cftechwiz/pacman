'use strict';

const { MongoClient } = require('mongodb');
const config = require('./config');
const baseLogger = require('./logger');

const logger = baseLogger.child({ module: 'database' });

let client;
let dbInstance;
let connectionPromise;

class Database {
    async connect(app) {
        if (dbInstance) {
            this.attachToApp(app, dbInstance);
            return dbInstance;
        }

        if (!connectionPromise) {
            client = new MongoClient(config.database.url, config.database.options);
            connectionPromise = client.connect()
                .then(function(connectedClient) {
                    dbInstance = connectedClient.db();
                    return dbInstance;
                })
                .catch(function(err) {
                    logger.error({ err, url: config.database.url, options: config.database.options }, 'Failed to connect to MongoDB');
                    connectionPromise = null;
                    throw err;
                });
        }

        const database = await connectionPromise;
        this.attachToApp(app, database);
        return database;
    }

    async getDb(app) {
        return this.connect(app);
    }

    attachToApp(app, database) {
        if (app && app.locals && !app.locals.db) {
            app.locals.db = database;
        }
    }

    async disconnect() {
        if (client) {
            try {
                await client.close();
            } catch (err) {
                logger.error({ err }, 'Error closing MongoDB client');
            }
        }
        client = null;
        dbInstance = null;
        connectionPromise = null;
    }
}

module.exports = new Database(); // Singleton
