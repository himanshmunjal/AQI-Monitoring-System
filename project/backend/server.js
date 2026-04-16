const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const http = require('http');

const app = express();

// Connect Database
connectDB();

// Init Middleware
app.use(express.json());
app.use(cors());

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/aqi')); // -> /api/aqi
app.use('/api', require('./routes/alerts')); // -> /api/alerts
app.use('/api', require('./routes/history')); // -> /api/history
app.use('/api', require('./routes/settings')); // -> /api/settings
app.use('/api', require('./routes/report')); // -> /api/report
app.use('/api', require('./routes/ai')); // -> /api/ai

// Setup Socket.io Server
const server = http.createServer(app);
let io = null;
try {
    const { Server } = require("socket.io");
    io = new Server(server, { cors: { origin: "*" } });
    
    io.on("connection", (socket) => {
        console.log("Client connected to live AQI stream:", socket.id);
    });

    // Simulate Real-Time AQI Pushes every 5 seconds
    setInterval(() => {
        let liveAQI = 45 + Math.floor(Math.random() * 20); // fluctuate around 50
        io.emit('aqi_update', { aqi: liveAQI, temperature: 26, humidity: 62 });
    }, 5000);
    
} catch(e) {
    console.log("Socket.io not installed. Real-time push disabled (Fallback to HTTP).");
}

const PORT = 5001;
server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
