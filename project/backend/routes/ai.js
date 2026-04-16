const express = require('express');
const router = express.Router();
require('dotenv').config();

// Initialize Gemini if Key is available
let aiClient = null;
if (process.env.GEMINI_API_KEY) {
    try {
        const { GoogleGenAI } = require('@google/genai');
        aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch(e) {
        console.log("Gemini SDK not installed or failed to init. Running in fallback mode.");
    }
} else {
    console.log("No GEMINI_API_KEY found in .env. AI Engine running in fallback mode.");
}

// POST /api/ai
router.post('/ai', async (req, res) => {
    try {
        const { query, aqi } = req.body;
        let response = '';

        if (aiClient) {
            // True AI Mode with automatic retry on 503 overload
            const prompt = `You are an advanced Smart Air Quality and routing AI assistant. The user's current local AQI is ${aqi || 'unknown'}. 
            A user asks: "${query}". 
            If they ask about routes (e.g. "safest route from X to Y"), provide a friendly, intelligent estimate or general advice, remind them they can check the "Map View" tab for exact spatial tracking, and warn them if the AQI is dangerous for travel.
            If they ask about health/safety, advise them directly.
            Keep your response to a single, highly-conversational paragraph (max 3-4 sentences).`;
            
            // Retry helper for 503 overload errors (up to 3 attempts)
            async function callGeminiWithRetry(retries = 3, delayMs = 1500) {
                for (let attempt = 1; attempt <= retries; attempt++) {
                    try {
                        const result = await aiClient.models.generateContent({
                            model: 'gemini-2.5-flash',
                            contents: prompt,
                        });
                        return result.text;
                    } catch (err) {
                        const is503 = err?.status === 503 || (err?.message && err.message.includes('503'));
                        if (is503 && attempt < retries) {
                            console.log(`Gemini 503 – retrying in ${delayMs}ms (attempt ${attempt}/${retries})`);
                            await new Promise(r => setTimeout(r, delayMs * attempt)); // exponential backoff
                        } else {
                            throw err; // final attempt or non-503 error
                        }
                    }
                }
            }

            response = await callGeminiWithRetry();
        } else {
            // Fallback Mode (Runs if no API key)
            const lowerQuery = query.toLowerCase();
            if (lowerQuery.includes('safe') || lowerQuery.includes('jog') || lowerQuery.includes('outside') || lowerQuery.includes('run')) {
                if (aqi && aqi > 150) {
                    response = 'The air quality is unfortunately poor right now. I advise against jogging or exercising outside until it clears up.';
                } else if (aqi && aqi > 100) {
                    response = 'Current air quality is moderate. It is acceptable for a quick run, but sensitive groups should probably stay indoors.';
                } else {
                    response = 'The air quality is excellent! It is perfectly safe to exercise outside today. Enjoy your run!';
                }
            } else if (lowerQuery.includes('mask') || lowerQuery.includes('protection')) {
                if (aqi && aqi > 100) {
                    response = 'Yes, wearing an N95 mask is highly recommended today due to the elevated pollution levels.';
                } else {
                    response = 'No, a mask is not strictly necessary today based on the current healthy air quality.';
                }
            } else {
                response = `I am your Smart AQI assistant (Fallback Mode). The current AQI is ${aqi || '--'}. Ask me whether it's safe to run outside or if you need a mask!`;
            }
        }

        res.json({ response });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).send('Server error processing AI request');
    }
});

module.exports = router;
