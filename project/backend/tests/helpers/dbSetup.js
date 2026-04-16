/**
 * dbSetup.js
 * Spins up an in-memory MongoDB instance (mongodb-memory-server)
 * so tests never touch the real production/development database.
 */
const path     = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

/** Call in beforeAll() */
async function connectTestDB() {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
}

/** Call in afterAll() */
async function disconnectTestDB() {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongod.stop();
}

/** Call in afterEach() to keep tests isolated */
async function clearCollections() {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
}

module.exports = { connectTestDB, disconnectTestDB, clearCollections };
