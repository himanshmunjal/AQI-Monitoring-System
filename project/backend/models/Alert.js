const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
    aqi: { type: Number, required: true },
    type: { type: String, required: true }, // good, moderate, hazard
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Alert', AlertSchema);
