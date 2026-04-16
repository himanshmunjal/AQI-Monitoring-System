/**
 * INTEGRATION TESTS – integration.test.js
 *
 * Tests the full API ↔ MongoDB round-trip:
 *   - AQI data is saved and can be retrieved
 *   - Alert data is saved and can be fetched
 *   - History endpoint returns data in chronological order
 */
const request = require('supertest');
const app     = require('../helpers/testApp');
const AQI     = require('../../models/AQI');
const Alert   = require('../../models/Alert');
const { connectTestDB, disconnectTestDB, clearCollections } = require('../helpers/dbSetup');

// Mock fetch so GET /api/aqi never calls real Open-Meteo
beforeAll(async () => {
    await connectTestDB();
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
            current: { us_aqi: 110, temperature_2m: 30, relative_humidity_2m: 60 }
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

// ─── TC-I01 | AQI fetch persists to DB ──────────────────────────────────────

describe('TC-I01 | AQI API ↔ MongoDB – fetch saves record', () => {
    test('GET /api/aqi should save one document to the AQI collection', async () => {
        await request(app).get('/api/aqi?city=Delhi');

        const count = await AQI.countDocuments();
        expect(count).toBe(1);
    });

    test('Saved record has required fields (city, aqi, timestamp)', async () => {
        await request(app).get('/api/aqi?city=Delhi');

        const doc = await AQI.findOne();
        expect(doc).not.toBeNull();
        expect(doc.city).toBeTruthy();
        expect(typeof doc.aqi).toBe('number');
        expect(doc.timestamp).toBeInstanceOf(Date);
    });
});

// ─── TC-I02 | History retrieval ─────────────────────────────────────────────

describe('TC-I02 | History – stored records returned via API', () => {
    test('GET /api/history returns previously seeded AQI documents', async () => {
        await AQI.insertMany([
            { city: 'Jaipur', aqi: 95,  temperature: 38, humidity: 28 },
            { city: 'Jaipur', aqi: 105, temperature: 39, humidity: 30 },
            { city: 'Jaipur', aqi: 115, temperature: 37, humidity: 32 },
        ]);

        const res = await request(app).get('/api/history?city=Jaipur');
        expect(res.statusCode).toBe(200);
        expect(res.body.length).toBe(3);
    });

    test('History is returned in chronological (oldest-first) order', async () => {
        const now = Date.now();
        await AQI.create({ city: 'Nagpur', aqi: 70,  temperature: 33, humidity: 50, timestamp: new Date(now - 20000) });
        await AQI.create({ city: 'Nagpur', aqi: 90,  temperature: 34, humidity: 52, timestamp: new Date(now - 10000) });
        await AQI.create({ city: 'Nagpur', aqi: 110, temperature: 35, humidity: 55, timestamp: new Date(now) });

        const res = await request(app).get('/api/history?city=Nagpur');
        const aqis = res.body.map(r => r.aqi);
        expect(aqis[0]).toBeLessThan(aqis[aqis.length - 1]); // ascending order
    });
});

// ─── TC-I03 | Alert save & retrieve ─────────────────────────────────────────

describe('TC-I03 | Alerts – stored and fetched correctly', () => {
    test('POST /api/alerts saves alert and GET /api/alerts retrieves it', async () => {
        const postRes = await request(app)
            .post('/api/alerts')
            .send({ aqi: 175, type: 'hazard', message: 'Air quality is hazardous in your area.' });

        expect(postRes.statusCode).toBe(201);
        expect(postRes.body).toHaveProperty('_id');

        const getRes = await request(app).get('/api/alerts');
        expect(getRes.statusCode).toBe(200);
        expect(getRes.body.length).toBe(1);
        expect(getRes.body[0].type).toBe('hazard');
    });

    test('POST /api/alerts with missing required fields returns 500', async () => {
        const res = await request(app)
            .post('/api/alerts')
            .send({ type: 'hazard' }); // missing aqi & message

        expect(res.statusCode).toBe(500);
    });
});

// ─── TC-I04 | History limit ──────────────────────────────────────────────────

describe('TC-I04 | History – respects 15-record limit', () => {
    test('GET /api/history returns at most 15 records', async () => {
        const docs = Array.from({ length: 20 }, (_, i) => ({
            city: 'Indore', aqi: 50 + i, temperature: 30, humidity: 55
        }));
        await AQI.insertMany(docs);

        const res = await request(app).get('/api/history?city=Indore');
        expect(res.statusCode).toBe(200);
        expect(res.body.length).toBeLessThanOrEqual(15);
    });
});
