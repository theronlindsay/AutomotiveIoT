//Libraries
const express = require("express");
const multer = require("multer");
const { check, validationResult } = require("express-validator");

// Models
const harshBraking = require("./Server/Model/harshBraking");
const followDistance = require("./Server/Model/followDistance");
const speedSnapshots = require("./Server/Model/speedSnapshots");
const mediaClips = require("./Server/Model/mediaClips");
const db = require("./Server/Model/connection");

//Setup defaults for script
const app = express();
const upload = multer();
const port = 80;

// Middleware for JSON parsing (for Arduino HTTP requests)
app.use(express.json());

//Load the GUI
app.use(express.static("./Server/public"));

// Serve index.html at root
app.get("/", (request, response) => {
    response.sendFile(__dirname + "/Server/public/index.html");
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
                latitude DECIMAL(10, 8) NOT NULL,
                longitude DECIMAL(11, 8) NOT NULL,
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
                latitude DECIMAL(10, 8) NOT NULL,
                longitude DECIMAL(11, 8) NOT NULL,
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
                latitude DECIMAL(10, 8) NOT NULL,
                longitude DECIMAL(11, 8) NOT NULL,
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
        console.error(error);
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
        console.error(error);
        return response.status(500).json({ message: "Server error" });
    }
});

// GET harsh braking event by ID
app.get("/api/harsh-braking/:id", upload.none(), async (request, response) => {
    try {
        const result = await harshBraking.selectEventById(request.params.id);
        return response.json(result);
    } catch (error) {
        console.error(error);
        return response.status(500).json({ message: "Server error" });
    }
});

// POST new harsh braking event (ARDUINO ENDPOINT)
app.post("/api/harsh-braking", upload.none(),
    check("latitude").isFloat(),
    check("longitude").isFloat(),
    check("deceleration_rate").isFloat(),
    check("speed_before").isFloat(),
    check("speed_after").isFloat(),
    async (request, response) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            return response.status(400).json({ message: "Invalid sensor data", errors: errors.array() });
        }
        try {
            const result = await harshBraking.addEvent(request.body);
            return response.status(201).json({ data: result, message: "Harsh braking event recorded" });
        } catch (error) {
            console.error(error);
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
        console.error(error);
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
        console.error(error);
        return response.status(500).json({ message: "Server error" });
    }
});

// GET follow distance violation by ID
app.get("/api/follow-distance/:id", upload.none(), async (request, response) => {
    try {
        const result = await followDistance.selectViolationById(request.params.id);
        return response.json(result);
    } catch (error) {
        console.error(error);
        return response.status(500).json({ message: "Server error" });
    }
});

// POST new follow distance violation (ARDUINO ENDPOINT)
app.post("/api/follow-distance", upload.none(),
    check("latitude").isFloat(),
    check("longitude").isFloat(),
    check("distance_meters").isFloat(),
    check("current_speed").isFloat(),
    async (request, response) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            return response.status(400).json({ message: "Invalid sensor data", errors: errors.array() });
        }
        try {
            const result = await followDistance.addViolation(request.body);
            return response.status(201).json({ data: result, message: "Follow distance violation recorded" });
        } catch (error) {
            console.error(error);
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
        console.error(error);
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
        console.error(error);
        return response.status(500).json({ message: "Server error" });
    }
});

// GET speed snapshot by ID
app.get("/api/speed-snapshots/:id", upload.none(), async (request, response) => {
    try {
        const result = await speedSnapshots.selectSnapshotById(request.params.id);
        return response.json(result);
    } catch (error) {
        console.error(error);
        return response.status(500).json({ message: "Server error" });
    }
});

// POST new speed snapshot (ARDUINO ENDPOINT)
app.post("/api/speed-snapshots", upload.none(),
    check("latitude").isFloat(),
    check("longitude").isFloat(),
    check("speed_mph").isFloat(),
    async (request, response) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            return response.status(400).json({ message: "Invalid sensor data", errors: errors.array() });
        }
        try {
            const result = await speedSnapshots.addSnapshot(request.body);
            return response.status(201).json({ data: result });
        } catch (error) {
            console.error(error);
            return response.status(500).json({ message: "Server error" });
        }
    }
);

// POST batch speed snapshots (ARDUINO ENDPOINT)
app.post("/api/speed-snapshots/batch", upload.none(),
    check("snapshots").isArray(),
    async (request, response) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            return response.status(400).json({ message: "Invalid data", errors: errors.array() });
        }
        try {
            const result = await speedSnapshots.addSnapshotsBatch(request.body.snapshots);
            return response.status(201).json(result);
        } catch (error) {
            console.error(error);
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
        console.error(error);
        return response.status(500).json({ message: "Server error" });
    }
});

// ==================== MEDIA CLIPS ENDPOINTS ====================

// GET all media clips
app.get("/api/media-clips", upload.none(), async (request, response) => {
    try {
        const result = await mediaClips.selectAllClips(request.query);
        return response.json(result);
    } catch (error) {
        console.error(error);
        return response.status(500).json({ message: "Server error" });
    }
});

// GET media clip by ID
app.get("/api/media-clips/:id", upload.none(), async (request, response) => {
    try {
        const result = await mediaClips.selectClipById(request.params.id);
        return response.json(result);
    } catch (error) {
        console.error(error);
        return response.status(500).json({ message: "Server error" });
    }
});

// POST new media clip reference (ARDUINO/CAMERA ENDPOINT)
app.post("/api/media-clips", upload.none(),
    check("latitude").isFloat(),
    check("longitude").isFloat(),
    check("media_type").isIn(['screenshot', 'video_clip']),
    check("file_path").isString().isLength({ min: 1 }),
    async (request, response) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            return response.status(400).json({ message: "Invalid data", errors: errors.array() });
        }
        try {
            const result = await mediaClips.addClip(request.body);
            return response.status(201).json({ data: result, message: "Media clip recorded" });
        } catch (error) {
            console.error(error);
            return response.status(500).json({ message: "Server error" });
        }
    }
);

// DELETE media clip
app.delete("/api/media-clips/:id", upload.none(), async (request, response) => {
    try {
        const result = await mediaClips.deleteClip(request.params.id);
        return response.json(result);
    } catch (error) {
        console.error(error);
        return response.status(500).json({ message: "Server error" });
    }
});

// ==================== ARDUINO COMBINED ENDPOINT ====================
app.post("/api/arduino/sensor-data", upload.none(), async (request, response) => {
    try {
        const data = request.body;
        const results = {};

        // Always record speed snapshot
        if (data.latitude && data.longitude && data.speed_mph) {
            results.speedSnapshot = await speedSnapshots.addSnapshot({
                latitude: data.latitude,
                longitude: data.longitude,
                speed_mph: data.speed_mph,
                speed_limit: data.speed_limit,
                acceleration: data.acceleration,
                heading: data.heading,
                light_condition: data.light_condition
            });
        }

        // Record harsh braking if detected
        if (data.harsh_braking_detected && data.deceleration_rate) {
            results.harshBraking = await harshBraking.addEvent({
                latitude: data.latitude,
                longitude: data.longitude,
                deceleration_rate: data.deceleration_rate,
                speed_before: data.speed_before,
                speed_after: data.speed_after,
                severity: data.severity,
                light_condition: data.light_condition
            });
        }

        // Record follow distance violation if detected
        if (data.follow_distance_violation && data.distance_meters) {
            results.followDistance = await followDistance.addViolation({
                latitude: data.latitude,
                longitude: data.longitude,
                distance_meters: data.distance_meters,
                current_speed: data.speed_mph,
                required_distance: data.required_distance,
                duration_seconds: data.duration_seconds,
                light_condition: data.light_condition
            });
        }

        return response.status(201).json({ data: results, message: "Sensor data recorded" });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ message: "Server error" });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Automotive IoT Database Server running at http://localhost:${port}`);
});
