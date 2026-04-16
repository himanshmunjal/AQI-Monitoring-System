const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');

// GET /api/alerts
router.get('/alerts', async (req, res) => {
    try {
        const alerts = await Alert.find().sort({ timestamp: -1 }).limit(10);
        res.json(alerts);
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// POST /api/alerts
router.post('/alerts', async (req, res) => {
    try {
        const { aqi, type, message } = req.body;
        const alert = new Alert({ aqi, type, message });
        await alert.save();
        res.status(201).json(alert);
    } catch (error) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
