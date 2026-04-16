/**
 * API TESTS – ai.api.test.js
 *
 * Tests POST /api/ai using Jest module mocking to intercept the
 * Gemini SDK before it is loaded. This guarantees no live API calls.
 *
 * Strategy:
 *  - jest.mock('@google/genai') replaces the SDK with a controllable stub
 *  - We then isolate module loading so each test group gets a fresh app
 */

// ── 1. Mock the Gemini SDK BEFORE any require() of the app ───────────────────
jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: {
            generateContent: jest.fn().mockResolvedValue({
                text: 'Mocked Gemini: Based on the current AQI it is safe to go outside.'
            })
        }
    }))
}));

const request = require('supertest');
const { connectTestDB, disconnectTestDB, clearCollections } = require('../helpers/dbSetup');

// ── 2. Build the app AFTER the mock is in place ───────────────────────────────
const path      = require('path');
const express   = require('express');
const cors      = require('cors');

function buildApp() {
    const a = express();
    a.use(express.json());
    a.use(cors());
    const routesDir = path.resolve(__dirname, '../../routes');
    a.use('/api/auth', require(path.join(routesDir, 'auth')));
    a.use('/api',      require(path.join(routesDir, 'aqi')));
    a.use('/api',      require(path.join(routesDir, 'alerts')));
    a.use('/api',      require(path.join(routesDir, 'history')));
    a.use('/api',      require(path.join(routesDir, 'ai')));
    return a;
}

const app = buildApp();

// Mock fetch for AQI route (not relevant here but prevents open handles)
beforeAll(async () => {
    await connectTestDB();
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ current: { us_aqi: 80, temperature_2m: 28, relative_humidity_2m: 60 } })
    });
});

afterAll(async () => {
    await disconnectTestDB();
    delete global.fetch;
});

afterEach(() => {
    jest.clearAllMocks();
});

// ─── TC-A09 | Valid query with AQI ───────────────────────────────────────────

describe('TC-A09 | POST /api/ai – valid query with AQI', () => {
    test('should return 200 with a non-empty response string', async () => {
        const res = await request(app)
            .post('/api/ai')
            .send({ query: 'Is it safe to run outside?', aqi: 55 });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('response');
        expect(typeof res.body.response).toBe('string');
        expect(res.body.response.length).toBeGreaterThan(0);
    });
});

// ─── TC-A10 | Missing query field ────────────────────────────────────────────

describe('TC-A10 | POST /api/ai – missing query field', () => {
    test('should return 200 and not crash', async () => {
        const res = await request(app)
            .post('/api/ai')
            .send({ aqi: 80 });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('response');
    });
});

// ─── TC-A11 | Missing AQI field ──────────────────────────────────────────────

describe('TC-A11 | POST /api/ai – missing aqi field', () => {
    test('should return 200 with a valid response', async () => {
        const res = await request(app)
            .post('/api/ai')
            .send({ query: 'What should I do today?' });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('response');
    });
});

// ─── TC-A12 | Empty body ──────────────────────────────────────────────────────

describe('TC-A12 | POST /api/ai – completely empty body', () => {
    test('should return 200 and not crash the server', async () => {
        const res = await request(app)
            .post('/api/ai')
            .send({});

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('response');
    });
});
