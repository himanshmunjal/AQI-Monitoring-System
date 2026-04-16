const express = require('express');
const router = express.Router();
const AQI = require('../models/AQI');

// --- Hardcoded coordinates for major Indian cities (used when geocoding API is down) ---
const CITY_COORDS = {
    'delhi': { lat: 28.6139, lon: 77.2090, name: 'New Delhi' },
    'new delhi': { lat: 28.6139, lon: 77.2090, name: 'New Delhi' },
    'mumbai': { lat: 19.0760, lon: 72.8777, name: 'Mumbai' },
    'bangalore': { lat: 12.9716, lon: 77.5946, name: 'Bangalore' },
    'bengaluru': { lat: 12.9716, lon: 77.5946, name: 'Bangalore' },
    'hyderabad': { lat: 17.3850, lon: 78.4867, name: 'Hyderabad' },
    'chennai': { lat: 13.0827, lon: 80.2707, name: 'Chennai' },
    'kolkata': { lat: 22.5726, lon: 88.3639, name: 'Kolkata' },
    'pune': { lat: 18.5204, lon: 73.8567, name: 'Pune' },
    'ahmedabad': { lat: 23.0225, lon: 72.5714, name: 'Ahmedabad' },
    'jaipur': { lat: 26.9124, lon: 75.7873, name: 'Jaipur' },
    'lucknow': { lat: 26.8467, lon: 80.9462, name: 'Lucknow' },
    'kanpur': { lat: 26.4499, lon: 80.3319, name: 'Kanpur' },
    'nagpur': { lat: 21.1458, lon: 79.0882, name: 'Nagpur' },
    'surat': { lat: 21.1702, lon: 72.8311, name: 'Surat' },
    'patna': { lat: 25.5941, lon: 85.1376, name: 'Patna' },
    'bhopal': { lat: 23.2599, lon: 77.4126, name: 'Bhopal' },
    'indore': { lat: 22.7196, lon: 75.8577, name: 'Indore' },
    'chandigarh': { lat: 30.7333, lon: 76.7794, name: 'Chandigarh' },
    'noida': { lat: 28.5355, lon: 77.3910, name: 'Noida' },
    'gurugram': { lat: 28.4595, lon: 77.0266, name: 'Gurugram' },
    'gurgaon': { lat: 28.4595, lon: 77.0266, name: 'Gurugram' },
};

// --- Realistic mock AQI ranges for Indian cities (used when AQI API is down) ---
function getMockAQIData(city) {
    const highPollutionCities = ['delhi', 'new delhi', 'kanpur', 'patna', 'lucknow', 'agra', 'allahabad'];
    const moderateCities = ['mumbai', 'kolkata', 'ahmedabad', 'pune', 'hyderabad'];
    const lowerKey = city.toLowerCase();

    let baseAQI, baseTemp, baseHumidity;

    if (highPollutionCities.some(c => lowerKey.includes(c))) {
        baseAQI = 120 + Math.floor(Math.random() * 80);   // 120–200
        baseTemp = 28 + Math.floor(Math.random() * 8);
        baseHumidity = 40 + Math.floor(Math.random() * 20);
    } else if (moderateCities.some(c => lowerKey.includes(c))) {
        baseAQI = 60 + Math.floor(Math.random() * 60);    // 60–120
        baseTemp = 27 + Math.floor(Math.random() * 10);
        baseHumidity = 50 + Math.floor(Math.random() * 25);
    } else {
        baseAQI = 40 + Math.floor(Math.random() * 50);    // 40–90
        baseTemp = 24 + Math.floor(Math.random() * 10);
        baseHumidity = 45 + Math.floor(Math.random() * 30);
    }

    return { aqi: baseAQI, temperature: baseTemp, humidity: baseHumidity };
}

// --- Helper: fetch with a timeout so one dead API doesn't hang the whole request ---
async function fetchWithTimeout(url, timeoutMs = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        return res;
    } catch (err) {
        clearTimeout(timer);
        throw err;
    }
}

// GET /api/aqi?city=...
router.get('/aqi', async (req, res) => {
    let city = req.query.city || 'Delhi';

    // Filter out unhelpful frontend placeholders
    if (city === 'Dashboard' || city === 'Current' || city === 'Analytics') city = 'New Delhi';

    try {
        let lat = req.query.lat ? parseFloat(req.query.lat) : null;
        let lon = req.query.lon ? parseFloat(req.query.lon) : null;
        let resolvedCity = city;

        // 1. Convert City Name to Coordinates
        if (!lat || !lon) {
            // Try offline lookup first
            const offlineMatch = CITY_COORDS[city.toLowerCase()];
            if (offlineMatch) {
                lat = offlineMatch.lat;
                lon = offlineMatch.lon;
                resolvedCity = offlineMatch.name;
            } else {
                // Try geocoding API with a 5s timeout
                try {
                    let geoRes = await fetchWithTimeout(
                        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&format=json`,
                        5000
                    );
                    if (!geoRes.ok) throw new Error('Geocoding API non-OK');
                    let geoData = await geoRes.json();

                    let exactMatch = null;
                    if (geoData && geoData.results) {
                        exactMatch = geoData.results.find(loc => loc.country_code === 'IN') || geoData.results[0];
                    }
                    if (exactMatch) {
                        lat = parseFloat(exactMatch.latitude);
                        lon = parseFloat(exactMatch.longitude);
                        resolvedCity = exactMatch.name || city;
                    }
                } catch (geoErr) {
                    console.warn(`Geocoding API unreachable for "${city}", using Delhi fallback.`);
                }

                // Hard fallback: New Delhi
                if (!lat || !lon) {
                    lat = 28.6139;
                    lon = 77.2090;
                    resolvedCity = 'New Delhi';
                }
            }
        }

        let currentAqi, temp, humidity;
        const mock = getMockAQIData(resolvedCity);

        // 2. Fetch Real AQI (with 5s timeout, fallback to mock)
        try {
            let aqiRes = await fetchWithTimeout(
                `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi`,
                5000
            );
            let aqiData = await aqiRes.json();
            currentAqi = aqiData.current ? aqiData.current.us_aqi : mock.aqi;
        } catch (aqiErr) {
            console.warn('AQI API unreachable, using mock data.');
            currentAqi = mock.aqi;
        }

        // 3. Fetch Real Temp & Humidity (with 5s timeout, fallback to mock)
        try {
            let weatherRes = await fetchWithTimeout(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m`,
                5000
            );
            let weatherData = await weatherRes.json();
            temp     = weatherData.current ? weatherData.current.temperature_2m       : mock.temperature;
            humidity = weatherData.current ? weatherData.current.relative_humidity_2m : mock.humidity;
        } catch (weatherErr) {
            console.warn('Weather API unreachable, using mock data.');
            temp     = mock.temperature;
            humidity = mock.humidity;
        }

        // 4. Persist to DB
        const newAqi = new AQI({
            city: resolvedCity,
            aqi: currentAqi,
            temperature: parseFloat(temp),
            humidity: humidity
        });
        await newAqi.save();

        res.json(newAqi);
    } catch (error) {
        console.error('AQI Route Error:', error);
        res.status(500).json({ msg: 'Server error while fetching real-time data' });
    }
});

module.exports = router;
