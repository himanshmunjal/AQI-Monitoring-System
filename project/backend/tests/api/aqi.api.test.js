/**
 * API TESTS – aqi.api.test.js
 *
 * Tests GET /api/aqi and GET /api/history via Supertest.
 * External APIs (Open-Meteo) are mocked with Jest so no real
 * network calls are made.
 */
const request = require('supertest');
const app     = require('../helpers/testApp');
const { connectTestDB, disconnectTestDB, clearCollections } = require('../helpers/dbSetup');

// ─── Mock global fetch so the AQI route never hits real Open-Meteo APIs ──────
beforeAll(async () => {
    await connectTestDB();

    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
            // geocoding response
            results: [{ latitude: 28.6139, longitude: 77.2090, name: 'New Delhi', country_code: 'IN' }],
            // AQI response
            current: { us_aqi: 142, temperature_2m: 32, relative_humidity_2m: 55 }
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

// ─── GET /api/aqi ────────────────────────────────────────────────────────────

describe('TC-A01 | GET /api/aqi – valid city name', () => {
    test('should return 200 with aqi, temperature, humidity fields', async () => {
        const res = await request(app).get('/api/aqi?city=Delhi');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('aqi');
        expect(res.body).toHaveProperty('temperature');
        expect(res.body).toHaveProperty('humidity');
    });
});

describe('TC-A02 | GET /api/aqi – known hardcoded city (offline lookup)', () => {
    test('should resolve Delhi coordinates offline, not call geocoding API', async () => {
        const res = await request(app).get('/api/aqi?city=mumbai');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('city');
        // geo fetch should NOT be called because Mumbai is in CITY_COORDS
        const fetchCalls = global.fetch.mock.calls.map(c => c[0]);
        const geoCalled  = fetchCalls.some(url => url.includes('geocoding-api'));
        expect(geoCalled).toBe(false);
    });
});

describe('TC-A03 | GET /api/aqi – default city when none supplied', () => {
    test('should default to Delhi and return valid data', async () => {
        const res = await request(app).get('/api/aqi');
        expect(res.statusCode).toBe(200);
        expect(res.body.aqi).toBeGreaterThanOrEqual(0);
    });
});

describe('TC-A04 | GET /api/aqi – AQI record persisted to DB', () => {
    test('should save the returned record to MongoDB', async () => {
        const AQI = require('../../models/AQI');
        await request(app).get('/api/aqi?city=Delhi');
        const saved = await AQI.findOne({ city: 'New Delhi' });
        expect(saved).not.toBeNull();
        expect(saved.aqi).toBeGreaterThanOrEqual(0);
    });
});

describe('TC-A05 | GET /api/aqi – falls back to mock when APIs fail', () => {
    test('should still return 200 when fetch rejects', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network Error'));
        const res = await request(app).get('/api/aqi?city=Delhi');
        // Delhi is in CITY_COORDS so geocoding never called; AQI + weather fail → mock data used
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('aqi');
        // restore
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ current: { us_aqi: 142, temperature_2m: 32, relative_humidity_2m: 55 } })
        });
    });
});

// ─── GET /api/history ────────────────────────────────────────────────────────

describe('TC-A06 | GET /api/history – returns array', () => {
    test('should return 200 with an array (empty when no data)', async () => {
        const res = await request(app).get('/api/history');
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

describe('TC-A07 | GET /api/history – returns seeded data', () => {
    test('should return records previously saved to DB', async () => {
        const AQI = require('../../models/AQI');
        await AQI.create({ city: 'Chennai', aqi: 88, temperature: 34, humidity: 70 });
        await AQI.create({ city: 'Chennai', aqi: 95, temperature: 35, humidity: 72 });

        const res = await request(app).get('/api/history?city=Chennai');
        expect(res.statusCode).toBe(200);
        expect(res.body.length).toBe(2);
        expect(res.body[0].city).toBe('Chennai');
    });
});

describe('TC-A08 | GET /api/history – city filter works', () => {
    test('should only return records for the requested city', async () => {
        const AQI = require('../../models/AQI');
        await AQI.create({ city: 'Pune', aqi: 65, temperature: 30, humidity: 60 });
        await AQI.create({ city: 'Kolkata', aqi: 110, temperature: 33, humidity: 75 });

        const res = await request(app).get('/api/history?city=Pune');
        expect(res.statusCode).toBe(200);
        expect(res.body.every(r => r.city === 'Pune')).toBe(true);
    });
});
