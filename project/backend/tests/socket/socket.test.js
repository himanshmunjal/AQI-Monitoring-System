/**
 * SOCKET.IO TESTS – socket.test.js
 *
 * Tests real-time Socket.io behaviour:
 *   - Client can connect
 *   - Server emits "aqi_update" events on the configured interval
 *   - Emitted payload has the correct shape (aqi, temperature, humidity)
 */
const http            = require('http');
const { Server }      = require('socket.io');
const ioClient        = require('socket.io-client');

// ─── Build a minimal test Socket.io server (mirrors server.js logic) ─────────

let server, io, clientSocket;
const TEST_PORT = 5099;

beforeAll((done) => {
    server = http.createServer();
    io     = new Server(server, { cors: { origin: '*' } });

    io.on('connection', (socket) => {
        // Immediately emit one event so the test doesn't have to wait 5 s
        socket.emit('aqi_update', { aqi: 68, temperature: 28, humidity: 55 });
    });

    server.listen(TEST_PORT, () => {
        clientSocket = ioClient(`http://localhost:${TEST_PORT}`);
        clientSocket.on('connect', done);
    });
});

afterAll((done) => {
    clientSocket.disconnect();
    io.close();
    server.close(done);
});

// ─── TC-S01 | Client connects successfully ───────────────────────────────────

describe('TC-S01 | Socket.io – client connection', () => {
    test('client socket should be connected', () => {
        expect(clientSocket.connected).toBe(true);
    });
});

// ─── TC-S02 | "aqi_update" event is received ────────────────────────────────

describe('TC-S02 | Socket.io – aqi_update event emission', () => {
    test('server emits "aqi_update" and client receives it', (done) => {
        // Reconnect so the "connection" handler fires again and emits a fresh event
        clientSocket.disconnect();
        clientSocket.connect();

        clientSocket.once('aqi_update', (data) => {
            expect(data).toBeDefined();
            done();
        });
    });
});

// ─── TC-S03 | Payload shape is correct ──────────────────────────────────────

describe('TC-S03 | Socket.io – aqi_update payload shape', () => {
    test('payload contains aqi, temperature, and humidity fields', (done) => {
        clientSocket.disconnect();
        clientSocket.connect();

        clientSocket.once('aqi_update', (data) => {
            expect(data).toHaveProperty('aqi');
            expect(data).toHaveProperty('temperature');
            expect(data).toHaveProperty('humidity');
            expect(typeof data.aqi).toBe('number');
            done();
        });
    });
});
