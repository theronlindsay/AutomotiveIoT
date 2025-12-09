//Libraries
const express = require("express");
const https = require("https");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { check, validationResult } = require("express-validator");

// Models
const harshBraking = require("./Server/Model/harshBraking");
const followDistance = require("./Server/Model/followDistance");
const speedSnapshots = require("./Server/Model/speedSnapshots");
const db = require("./Server/Model/connection");

//Setup defaults for script
const app = express();
const upload = multer();
const port = 80;
const httpsPort = 443;

// SSL Certificate
const sslOptions = {
    key: fs.readFileSync('/etc/letsencrypt/live/auto.theronlindsay.dev/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/auto.theronlindsay.dev/fullchain.pem')
};

// Middleware for JSON parsing (for Arduino HTTP requests)
app.use(express.json());

// Middleware to log all incoming requests
app.use((request, response, next) => {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] ${request.method} ${request.path}`);
    
    // Log request body if present
    if (request.body && Object.keys(request.body).length > 0) {
        console.log('Request Body:', JSON.stringify(request.body, null, 2));
    }
    
    // Log query parameters if present
    if (request.query && Object.keys(request.query).length > 0) {
        console.log('Query Params:', JSON.stringify(request.query, null, 2));
    }
    
    next();
});

//Load the GUI
app.use(express.static(path.join(__dirname, "Server/public")));

// Serve index.html at root
app.get("/", (request, response) => {
    response.sendFile(path.join(__dirname, "Server/public/index.html"));
});

// ==================== DATABASE INITIALIZATION ====================

// Initialize database tables
app.post("/api/init-database", upload.none(), async (request, response) => {
    try {
        // Create HarshBrakingEvents table
        await db.query(`
            CREATE TABLE IF NOT EXISTS HarshBrakingEvents (
                event_id INT AUTO_INCREMENT PRIMARY KEY,
                event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deceleration_rate DECIMAL(6, 2) NOT NULL,
                speed_before DECIMAL(6, 2),
                speed_after DECIMAL(6, 2),
                severity ENUM('low', 'medium', 'high') DEFAULT 'medium',
                light_condition ENUM('day', 'night', 'dawn', 'dusk') DEFAULT 'day'
            )
        `, []);

        // Create FollowDistanceViolations table
        await db.query(`
            CREATE TABLE IF NOT EXISTS FollowDistanceViolations (
                violation_id INT AUTO_INCREMENT PRIMARY KEY,
                event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                distance_meters DECIMAL(6, 2) NOT NULL,
                current_speed DECIMAL(6, 2),
                required_distance DECIMAL(6, 2),
                duration_seconds INT,
                light_condition ENUM('day', 'night', 'dawn', 'dusk') DEFAULT 'day'
            )
        `, []);

        // Create SpeedSnapshots table
        await db.query(`
            CREATE TABLE IF NOT EXISTS SpeedSnapshots (
                snapshot_id INT AUTO_INCREMENT PRIMARY KEY,
                snapshot_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                speed_mph DECIMAL(6, 2) NOT NULL,
                speed_limit DECIMAL(6, 2),
                is_speeding TINYINT(1) DEFAULT 0,
                acceleration DECIMAL(6, 2),
                heading DECIMAL(5, 2),
                light_condition ENUM('day', 'night', 'dawn', 'dusk') DEFAULT 'day'
            )
        `, []);

        // Create MediaClips table
        await db.query(`
            CREATE TABLE IF NOT EXISTS MediaClips (
                clip_id INT AUTO_INCREMENT PRIMARY KEY,
                capture_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                latitude DECIMAL(10, 8) NOT NULL,
                longitude DECIMAL(11, 8) NOT NULL,
                media_type ENUM('screenshot', 'video_clip') NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                duration_seconds INT,
                event_type ENUM('harsh_braking', 'follow_distance', 'speeding', 'manual'),
                event_id INT,
                file_size_bytes INT
            )
        `, []);

        return response.status(201).json({ message: "Database tables created successfully" });
    } catch (error) {
        console.error('[ERROR] Database initialization failed:');
        console.error('Error details:', error);
        return response.status(500).json({ message: "Error creating tables", error: error.message });
    }
});

// ==================== HARSH BRAKING ENDPOINTS ====================

// GET all harsh braking events
app.get("/api/harsh-braking", upload.none(), async (request, response) => {
    try {
        const result = await harshBraking.selectAllEvents(request.query);
        return response.json(result);
    } catch (error) {
        console.error('[ERROR] Failed to fetch harsh braking events:');
        console.error('Error details:', error);
        return response.status(500).json({ message: "Server error" });
    }
});

// GET harsh braking event by ID
app.get("/api/harsh-braking/:id", upload.none(), async (request, response) => {
    try {
        const result = await harshBraking.selectEventById(request.params.id);
        return response.json(result);
    } catch (error) {
        console.error('[ERROR] Failed to fetch harsh braking event by ID:');
        console.error('Error details:', error);
        return response.status(500).json({ message: "Server error" });
    }
});

// POST new harsh braking event (ARDUINO ENDPOINT)
app.post("/api/harsh-braking", express.json(),
    check("deceleration_rate").isFloat(),
    check("speed_before").isFloat(),
    check("speed_after").isFloat(),
    async (request, response) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            console.error('[ERROR] Invalid harsh braking data:', errors.array());
            return response.status(400).json({ message: "Invalid sensor data", errors: errors.array() });
        }
        try {
            const result = await harshBraking.addEvent(request.body);
            return response.status(201).json({ data: result, message: "Harsh braking event recorded" });
        } catch (error) {
            console.error('[ERROR] Failed to add harsh braking event:');
            console.error('Error details:', error);
            return response.status(500).json({ message: "Server error" });
        }
    }
);

// DELETE harsh braking event
app.delete("/api/harsh-braking/:id", upload.none(), async (request, response) => {
    try {
        const result = await harshBraking.deleteEvent(request.params.id);
        return response.json(result);
    } catch (error) {
        console.error('[ERROR] Failed to delete harsh braking event:');
        console.error('Error details:', error);
        return response.status(500).json({ message: "Server error" });
    }
});

// ==================== FOLLOW DISTANCE ENDPOINTS ====================

// GET all follow distance violations
app.get("/api/follow-distance", upload.none(), async (request, response) => {
    try {
        const result = await followDistance.selectAllViolations(request.query);
        return response.json(result);
    } catch (error) {
        console.error('[ERROR] Failed to fetch follow distance violations:');
        console.error('Error details:', error);
        return response.status(500).json({ message: "Server error" });
    }
});

// GET follow distance violation by ID
app.get("/api/follow-distance/:id", upload.none(), async (request, response) => {
    try {
        const result = await followDistance.selectViolationById(request.params.id);
        return response.json(result);
    } catch (error) {
        console.error('[ERROR] Failed to fetch follow distance violation by ID:');
        console.error('Error details:', error);
        return response.status(500).json({ message: "Server error" });
    }
});

// POST new follow distance violation (ARDUINO ENDPOINT)
app.post("/api/follow-distance", express.json(),
    check("distance_meters").isFloat(),
    check("current_speed").isFloat(),
    async (request, response) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            console.error('[ERROR] Invalid follow distance data:', errors.array());
            return response.status(400).json({ message: "Invalid sensor data", errors: errors.array() });
        }
        try {
            const result = await followDistance.addViolation(request.body);
            return response.status(201).json({ data: result, message: "Follow distance violation recorded" });
        } catch (error) {
            console.error('[ERROR] Failed to add follow distance violation:');
            console.error('Error details:', error);
            return response.status(500).json({ message: "Server error" });
        }
    }
);

// DELETE follow distance violation
app.delete("/api/follow-distance/:id", upload.none(), async (request, response) => {
    try {
        const result = await followDistance.deleteViolation(request.params.id);
        return response.json(result);
    } catch (error) {
        console.error('[ERROR] Failed to delete follow distance violation:');
        console.error('Error details:', error);
        return response.status(500).json({ message: "Server error" });
    }
});

// ==================== SPEED SNAPSHOT ENDPOINTS ====================

// GET all speed snapshots
app.get("/api/speed-snapshots", upload.none(), async (request, response) => {
    try {
        const result = await speedSnapshots.selectAllSnapshots(request.query);
        return response.json(result);
    } catch (error) {
        console.error('[ERROR] Failed to fetch speed snapshots:');
        console.error('Error details:', error);
        return response.status(500).json({ message: "Server error" });
    }
});

// GET speed snapshot by ID
app.get("/api/speed-snapshots/:id", upload.none(), async (request, response) => {
    try {
        const result = await speedSnapshots.selectSnapshotById(request.params.id);
        return response.json(result);
    } catch (error) {
        console.error('[ERROR] Failed to fetch speed snapshot by ID:');
        console.error('Error details:', error);
        return response.status(500).json({ message: "Server error" });
    }
});

// POST new speed snapshot (ARDUINO ENDPOINT)
app.post("/api/speed-snapshots", express.json(),
    check("speed_mph").isFloat(),
    async (request, response) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            console.error('[ERROR] Invalid speed snapshot data:', errors.array());
            return response.status(400).json({ message: "Invalid sensor data", errors: errors.array() });
        }
        try {
            const result = await speedSnapshots.addSnapshot(request.body);
            return response.status(201).json({ data: result });
        } catch (error) {
            console.error('[ERROR] Failed to add speed snapshot:');
            console.error('Error details:', error);
            return response.status(500).json({ message: "Server error" });
        }
    }
);

// POST batch speed snapshots (ARDUINO ENDPOINT)
app.post("/api/speed-snapshots/batch", express.json(),
    check("snapshots").isArray(),
    async (request, response) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            console.error('[ERROR] Invalid batch snapshot data:', errors.array());
            return response.status(400).json({ message: "Invalid data", errors: errors.array() });
        }
        try {
            const result = await speedSnapshots.addSnapshotsBatch(request.body.snapshots);
            return response.status(201).json(result);
        } catch (error) {
            console.error('[ERROR] Failed to add batch speed snapshots:');
            console.error('Error details:', error);
            return response.status(500).json({ message: "Server error" });
        }
    }
);

// DELETE speed snapshot
app.delete("/api/speed-snapshots/:id", upload.none(), async (request, response) => {
    try {
        const result = await speedSnapshots.deleteSnapshot(request.params.id);
        return response.json(result);
    } catch (error) {
        console.error('[ERROR] Failed to delete speed snapshot:');
        console.error('Error details:', error);
        return response.status(500).json({ message: "Server error" });
    }
});

// ==================== ARDUINO COMBINED ENDPOINT ====================
app.post("/api/arduino/sensor-data", express.json(), async (request, response) => {
    try {
        const data = request.body;
        const results = {};

        // Log Arduino sensor data with clear identifier
        console.log('\n🤖 [ARDUINO] Sensor data received:');
        console.log(`   Distance: ${data.distance_cm} cm`);
        console.log(`   Light Level: ${data.light_level}%`);
        console.log(`   Acceleration: X=${data.accX}g, Y=${data.accY}g, Z=${data.accZ}g`);

        // Validate required fields
        if (!data.distance_cm || data.light_level === undefined || 
            data.accX === undefined || data.accY === undefined || data.accZ === undefined) {
            console.error('[ERROR] Missing required sensor data:', data);
            return response.status(400).json({ 
                message: "Missing required sensor data",
                required: ["distance_cm", "light_level", "accX", "accY", "accZ"]
            });
        }

        // Convert raw sensor data
        const distanceMeters = data.distance_cm / 100.0;  // Convert cm to meters
        const lightLevel = data.light_level;  // 0-100 scale
        const accX = parseFloat(data.accX);  // G forces
        const accY = parseFloat(data.accY);  // G forces
        const accZ = parseFloat(data.accZ);  // G forces
        
        // Calculate total acceleration magnitude
        const totalAcceleration = Math.sqrt(accX * accX + accY * accY + accZ * accZ);
        
        // Get current time to determine dawn vs dusk
        const currentTime = new Date();
        const hour = currentTime.getHours();
        
        // Determine light condition based on light level and time of day
        let lightCondition = 'day';
        if (lightLevel < 20) {
            lightCondition = 'night';
        } else if (lightLevel < 60) {
            // Dawn = morning (AM), Dusk = evening (PM)
            lightCondition = (hour < 12) ? 'dawn' : 'dusk';
        }

        // Store follow distance data (we track all distance readings)
        results.followDistance = await followDistance.addViolation({
            distance_meters: distanceMeters,
            light_condition: lightCondition
        });

        // Store speed snapshot with acceleration data
        results.speedSnapshot = await speedSnapshots.addSnapshot({
            acceleration: totalAcceleration.toFixed(3),
            light_condition: lightCondition,
            speed_mph: null,  // Not tracking speed yet
            speed_limit: null
        });

        return response.status(201).json({ 
            data: results, 
            message: "Sensor data processed",
            processed: {
                distance_meters: distanceMeters,
                light_condition: lightCondition,
                light_level: lightLevel,
                acceleration: {
                    x: accX,
                    y: accY,
                    z: accZ,
                    total: parseFloat(totalAcceleration.toFixed(3))
                }
            }
        });
    } catch (error) {
        console.error('[ERROR] Failed to process Arduino sensor data:');
        console.error('Error details:', error);
        return response.status(500).json({ message: "Server error", error: error.message });
    }
});

// Start HTTP server (for redirect to HTTPS)
app.listen(port, () => {
    console.log(`HTTP Server running on port ${port}`);
});

// Start HTTPS server
https.createServer(sslOptions, app).listen(httpsPort, () => {
    console.log(`Automotive IoT Database Server running at https://auto.theronlindsay.dev:${httpsPort}`);
});
