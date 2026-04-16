const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    theme: { type: String, default: 'dark' },
    defaultCity: { type: String, default: 'New York' },
    alertThreshold: { type: Number, default: 150 },
    voice: { type: Boolean, default: false },
    routePreference: { type: String, default: 'safest' }
});

module.exports = mongoose.model('Settings', SettingsSchema);
