const express = require('express');
const router = express.Router();
const AQI = require('../models/AQI');

// GET /api/history?city=...
router.get('/history', async (req, res) => {
    const city = req.query.city;
    const query = city ? { city } : {};

    try {
        const history = await AQI.find(query).sort({ timestamp: -1 }).limit(15);
        res.json(history.reverse()); // Chronological order
    } catch (error) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
