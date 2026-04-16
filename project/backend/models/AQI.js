const mongoose = require('mongoose');

const AQISchema = new mongoose.Schema({
    city: { type: String, required: true, default: 'Default City' },
    aqi: { type: Number, required: true },
    temperature: { type: Number },
    humidity: { type: Number },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AQI', AQISchema);
