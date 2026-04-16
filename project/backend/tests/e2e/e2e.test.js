/**
 * END-TO-END FLOW TESTS – e2e.test.js
 *
 * Simulates complete user journeys using only HTTP calls (Supertest):
 *
 *   Flow 1: Fetch AQI → stored in DB → retrieved from history
 *   Flow 2: Register → Login → access a protected-style route (alerts)
 */
const request = require('supertest');
const app     = require('../helpers/testApp');
const AQI     = require('../../models/AQI');
const { connectTestDB, disconnectTestDB, clearCollections } = require('../helpers/dbSetup');

beforeAll(async () => {
    await connectTestDB();

    // Mock global fetch so AQI route doesn't call real Open-Meteo
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
            current: { us_aqi: 88, temperature_2m: 29, relative_humidity_2m: 65 }
        })
    });
});

afterAll(async () => {
    await disconnectTestDB();
    delete global.fetch;
});

afterEach(async () => {
    await clearCollections();
    jest.clearAllMocks();
});

// ─── Flow 1: Fetch AQI → Store → Retrieve History ───────────────────────────

describe('TC-E01 | E2E Flow – Fetch AQI then retrieve from history', () => {
    test('fetching AQI for a city should make it appear in /api/history', async () => {
        // Step 1: Fetch AQI (saves to DB internally)
        const aqiRes = await request(app).get('/api/aqi?city=Delhi');
        expect(aqiRes.statusCode).toBe(200);

        // Step 2: Retrieve history — the record just fetched should be there
        const histRes = await request(app).get('/api/history');
        expect(histRes.statusCode).toBe(200);
        expect(histRes.body.length).toBeGreaterThan(0);
    });

    test('multiple AQI fetches accumulate in history', async () => {
        await request(app).get('/api/aqi?city=Delhi');
        await request(app).get('/api/aqi?city=Mumbai');
        await request(app).get('/api/aqi?city=Pune');

        const count = await AQI.countDocuments();
        expect(count).toBe(3);

        const histRes = await request(app).get('/api/history');
        expect(histRes.body.length).toBe(3);
    });
});

// ─── Flow 2: Register → Login → Hit Application Endpoint ────────────────────

describe('TC-E02 | E2E Flow – Register → Login → access alerts endpoint', () => {
    test('user registers, logs in, and successfully calls GET /api/alerts', async () => {
        // Step 1: Register
        const regRes = await request(app)
            .post('/api/auth/register')
            .send({ username: 'e2eUser', password: 'E2E@Pass1', email: 'e2e@test.com' });
        expect(regRes.statusCode).toBe(201);

        // Step 2: Login
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ username: 'e2eUser', password: 'E2E@Pass1' });
        expect(loginRes.statusCode).toBe(200);
        expect(loginRes.body.username).toBe('e2eUser');

        // Step 3: Access the alerts endpoint (no auth middleware in this project,
        // so this confirms the full app stack is accessible after login)
        const alertsRes = await request(app).get('/api/alerts');
        expect(alertsRes.statusCode).toBe(200);
        expect(Array.isArray(alertsRes.body)).toBe(true);
    });

    test('user cannot login after wrong password during registration flow', async () => {
        await request(app)
            .post('/api/auth/register')
            .send({ username: 'flow2user', password: 'Correct@1', email: 'flow2@test.com' });

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ username: 'flow2user', password: 'Wrong@999' });

        expect(loginRes.statusCode).toBe(400);
        expect(loginRes.body.msg).toMatch(/invalid credentials/i);
    });
});
