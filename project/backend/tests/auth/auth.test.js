/**
 * AUTHENTICATION TESTS – auth.test.js
 *
 * Tests POST /api/auth/register and POST /api/auth/login.
 * Uses in-memory MongoDB — no production data is touched.
 */
const request = require('supertest');
const app     = require('../helpers/testApp');
const { connectTestDB, disconnectTestDB, clearCollections } = require('../helpers/dbSetup');

beforeAll(async () => { await connectTestDB(); });
afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearCollections(); });

// ─── REGISTER ────────────────────────────────────────────────────────────────

describe('TC-AU01 | POST /api/auth/register – successful registration', () => {
    test('should register a new user and return 201', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: 'saksham', password: 'Test@1234', email: 'saksham@test.com' });

        expect(res.statusCode).toBe(201);
        expect(res.body.msg).toMatch(/registered successfully/i);
    });
});

describe('TC-AU02 | POST /api/auth/register – duplicate email rejection', () => {
    test('should return 400 when email already exists', async () => {
        // Register once
        await request(app)
            .post('/api/auth/register')
            .send({ username: 'user1', password: 'Pass@123', email: 'dup@test.com' });

        // Try to register again with the same email
        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: 'user2', password: 'Pass@456', email: 'dup@test.com' });

        expect(res.statusCode).toBe(400);
        expect(res.body.msg).toMatch(/already exists/i);
    });
});

describe('TC-AU03 | POST /api/auth/register – missing required fields', () => {
    test('should return 500 when required fields are absent (Mongoose validation)', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: 'nopass' }); // no password, no email

        // Mongoose throws a ValidationError → route catches and returns 500
        expect(res.statusCode).toBe(500);
    });
});

// ─── LOGIN ───────────────────────────────────────────────────────────────────

describe('TC-AU04 | POST /api/auth/login – successful login', () => {
    test('should return 200 with msg and username after valid credentials', async () => {
        // Register first
        await request(app)
            .post('/api/auth/register')
            .send({ username: 'loginUser', password: 'Secure@99', email: 'login@test.com' });

        // Then login
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'loginUser', password: 'Secure@99' });

        expect(res.statusCode).toBe(200);
        expect(res.body.msg).toMatch(/login successful/i);
        expect(res.body.username).toBe('loginUser');
    });
});

describe('TC-AU05 | POST /api/auth/login – wrong password rejection', () => {
    test('should return 400 with Invalid credentials message', async () => {
        await request(app)
            .post('/api/auth/register')
            .send({ username: 'badpwdUser', password: 'Right@123', email: 'badpwd@test.com' });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'badpwdUser', password: 'Wrong@999' });

        expect(res.statusCode).toBe(400);
        expect(res.body.msg).toMatch(/invalid credentials/i);
    });
});

describe('TC-AU06 | POST /api/auth/login – non-existent user', () => {
    test('should return 400 when username does not exist', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ username: 'ghost_user', password: 'Any@Pass' });

        expect(res.statusCode).toBe(400);
        expect(res.body.msg).toMatch(/invalid credentials/i);
    });
});
