const express = require('express');
const router = express.Router();
const AQI = require('../models/AQI');

// GET /api/report
router.get('/report', async (req, res) => {
    try {
        const history = await AQI.find().sort({ timestamp: -1 }).limit(20);
        
        let totalAqi = 0;
        history.forEach(h => totalAqi += h.aqi);
        const avgAqi = history.length ? (totalAqi / history.length).toFixed(1) : 0;
        
        let prediction = 'Stable';
        if (history.length >= 2) {
            if (history[0].aqi > history[1].aqi) prediction = 'Worsening';
            else if (history[0].aqi < history[1].aqi) prediction = 'Improving';
        }

        res.json({
            records: history.length,
            averageAqi: avgAqi,
            prediction,
            latest: history[0] || null
        });
    } catch (error) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
