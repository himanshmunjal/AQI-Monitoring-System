/**
 * testApp.js
 * Creates a bare Express app wired with all routes, but does NOT:
 *   - call connectDB()
 *   - start a TCP server (server.listen)
 *   - spin up the AQI interval timer
 * This lets Supertest open its own ephemeral port for each test file.
 */
const path    = require('path');
const express = require('express');
const cors    = require('cors');

// Always resolve routes relative to the backend root, regardless of where
// Jest's CWD lands when running individual test files.
const routesDir = path.resolve(__dirname, '../../routes');

const app = express();
app.use(express.json());
app.use(cors());

app.use('/api/auth', require(path.join(routesDir, 'auth')));
app.use('/api',      require(path.join(routesDir, 'aqi')));
app.use('/api',      require(path.join(routesDir, 'alerts')));
app.use('/api',      require(path.join(routesDir, 'history')));
app.use('/api',      require(path.join(routesDir, 'ai')));

module.exports = app;
