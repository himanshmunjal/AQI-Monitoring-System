/**
 * UNIT TESTS – aqi.unit.test.js
 *
 * Tests pure functions: AQI classification, alert thresholds,
 * AI fallback response logic, and data formatting utilities.
 * No database or network calls.
 */

// ─── Functions extracted / replicated from source ───────────────────────────

/**
 * Returns a human-readable AQI category label.
 * Mirrors the classification logic used in the frontend + backend.
 */
function classifyAQI(aqi) {
    if (aqi === null || aqi === undefined || isNaN(aqi)) return 'Unknown';
    if (aqi <= 50)  return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
}

/**
 * Decides whether an AQI value should trigger an alert.
 */
function shouldTriggerAlert(aqi, threshold = 100) {
    return typeof aqi === 'number' && aqi > threshold;
}

/**
 * Selects an appropriate alert type string based on AQI level.
 */
function getAlertType(aqi) {
    if (aqi <= 50)  return 'good';
    if (aqi <= 100) return 'moderate';
    return 'hazard';
}

/**
 * Replicates the AI fallback response logic from routes/ai.js.
 */
function getFallbackResponse(query, aqi) {
    const lowerQuery = query.toLowerCase();
    if (
        lowerQuery.includes('safe') ||
        lowerQuery.includes('jog')  ||
        lowerQuery.includes('outside') ||
        lowerQuery.includes('run')
    ) {
        if (aqi > 150) return 'The air quality is unfortunately poor right now. I advise against jogging or exercising outside until it clears up.';
        if (aqi > 100) return 'Current air quality is moderate. It is acceptable for a quick run, but sensitive groups should probably stay indoors.';
        return 'The air quality is excellent! It is perfectly safe to exercise outside today. Enjoy your run!';
    }
    if (lowerQuery.includes('mask') || lowerQuery.includes('protection')) {
        if (aqi > 100) return 'Yes, wearing an N95 mask is highly recommended today due to the elevated pollution levels.';
        return 'No, a mask is not strictly necessary today based on the current healthy air quality.';
    }
    return `I am your Smart AQI assistant (Fallback Mode). The current AQI is ${aqi || '--'}. Ask me whether it's safe to run outside or if you need a mask!`;
}

/**
 * Formats a raw AQI data object for API response.
 */
function formatAQIRecord(raw) {
    return {
        city:        raw.city        || 'Unknown',
        aqi:         Number(raw.aqi),
        temperature: raw.temperature !== undefined ? Number(raw.temperature) : null,
        humidity:    raw.humidity    !== undefined ? Number(raw.humidity)    : null,
        timestamp:   raw.timestamp instanceof Date ? raw.timestamp.toISOString() : raw.timestamp,
    };
}

// ─── Test Suites ─────────────────────────────────────────────────────────────

describe('TC-U01 | AQI Classification – boundary values', () => {
    test('AQI 0 should be classified as Good', () => {
        expect(classifyAQI(0)).toBe('Good');
    });

    test('AQI 50 should be classified as Good (upper boundary)', () => {
        expect(classifyAQI(50)).toBe('Good');
    });

    test('AQI 100 should be classified as Moderate', () => {
        expect(classifyAQI(100)).toBe('Moderate');
    });

    test('AQI 200 should be classified as Unhealthy', () => {
        expect(classifyAQI(200)).toBe('Unhealthy');
    });

    test('AQI 301 should be classified as Hazardous', () => {
        expect(classifyAQI(301)).toBe('Hazardous');
    });

    test('null / undefined AQI should return Unknown', () => {
        expect(classifyAQI(null)).toBe('Unknown');
        expect(classifyAQI(undefined)).toBe('Unknown');
    });
});

describe('TC-U02 | Alert Threshold Logic', () => {
    test('AQI below threshold should NOT trigger alert', () => {
        expect(shouldTriggerAlert(85)).toBe(false);
    });

    test('AQI equal to threshold should NOT trigger alert', () => {
        expect(shouldTriggerAlert(100)).toBe(false);
    });

    test('AQI above threshold should trigger alert', () => {
        expect(shouldTriggerAlert(150)).toBe(true);
    });

    test('Custom threshold is respected', () => {
        expect(shouldTriggerAlert(60, 50)).toBe(true);
        expect(shouldTriggerAlert(49, 50)).toBe(false);
    });

    test('Non-numeric AQI should NOT trigger alert', () => {
        expect(shouldTriggerAlert('bad')).toBe(false);
    });
});

describe('TC-U03 | Alert Type Categorisation', () => {
    test('AQI 40 should map to good', () => {
        expect(getAlertType(40)).toBe('good');
    });

    test('AQI 80 should map to moderate', () => {
        expect(getAlertType(80)).toBe('moderate');
    });

    test('AQI 200 should map to hazard', () => {
        expect(getAlertType(200)).toBe('hazard');
    });
});

describe('TC-U04 | AI Fallback Response Logic', () => {
    test('High AQI + "run" query returns outdoor discouragement', () => {
        const res = getFallbackResponse('Is it safe to run outside?', 160);
        expect(res).toMatch(/poor/i);
    });

    test('Moderate AQI + "jog" query returns cautionary response', () => {
        const res = getFallbackResponse('Can I jog?', 120);
        expect(res).toMatch(/moderate/i);
    });

    test('Low AQI + "safe" query returns positive response', () => {
        const res = getFallbackResponse('Is it safe outside?', 45);
        expect(res).toMatch(/excellent/i);
    });

    test('High AQI + "mask" query recommends N95', () => {
        const res = getFallbackResponse('Do I need a mask?', 110);
        expect(res).toMatch(/N95/i);
    });

    test('Low AQI + "protection" query says mask not needed', () => {
        const res = getFallbackResponse('Do I need protection?', 40);
        expect(res).toMatch(/not strictly necessary/i);
    });

    test('Unrecognised query returns generic fallback with AQI value', () => {
        const res = getFallbackResponse('What is the weather like?', 75);
        expect(res).toMatch(/75/);
    });
});

describe('TC-U05 | Data Formatting Utility', () => {
    test('AQI record is formatted with all fields', () => {
        const raw = { city: 'Delhi', aqi: '135', temperature: '31', humidity: '60', timestamp: new Date('2024-01-01T10:00:00Z') };
        const formatted = formatAQIRecord(raw);
        expect(formatted.city).toBe('Delhi');
        expect(formatted.aqi).toBe(135);
        expect(formatted.temperature).toBe(31);
        expect(formatted.humidity).toBe(60);
        expect(formatted.timestamp).toBe('2024-01-01T10:00:00.000Z');
    });

    test('Missing city defaults to Unknown', () => {
        const formatted = formatAQIRecord({ aqi: 90, timestamp: new Date() });
        expect(formatted.city).toBe('Unknown');
    });

    test('Missing temperature and humidity produce null', () => {
        const formatted = formatAQIRecord({ city: 'Mumbai', aqi: 80, timestamp: new Date() });
        expect(formatted.temperature).toBeNull();
        expect(formatted.humidity).toBeNull();
    });
});
