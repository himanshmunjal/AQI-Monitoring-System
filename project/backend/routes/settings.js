const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');

// GET /api/settings
router.get('/settings', async (req, res) => {
    try {
        // Assuming global settings for simplicity
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings({});
            await settings.save();
        }
        res.json(settings);
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// POST /api/settings
router.post('/settings', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings({});
        }

        const keys = ['theme', 'defaultCity', 'alertThreshold', 'voice', 'routePreference'];
        keys.forEach(key => {
            if (req.body[key] !== undefined) {
                settings[key] = req.body[key];
            }
        });

        await settings.save();
        res.json(settings);
    } catch (error) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
