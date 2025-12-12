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

// SSL Certificate (commented out for local development)
// Uncomment these lines when deploying to production server with SSL certificates
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
                speed_mph DECIMAL(6, 2),
                speed_limit DECIMAL(6, 2),
                is_speeding TINYINT(1) DEFAULT 0,
                acceleration DECIMAL(6, 2),
                heading DECIMAL(5, 2),
                light_condition ENUM('day', 'night', 'dawn', 'dusk') DEFAULT 'day'
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

// ==================== ALEXA SKILL HANDLER ENDPOINT ====================
// This is the main endpoint you configure in the Alexa Developer Console
// Set your Alexa skill's endpoint to: https://auto.theronlindsay.dev/api/alexa/skill

app.post("/api/alexa/skill", express.json(), async (request, response) => {
    try {
        const alexaRequest = request.body;
        
        console.log('\n🔊 [ALEXA] Request received:');
        console.log('   Type:', alexaRequest.request?.type);
        console.log('   Intent:', alexaRequest.request?.intent?.name);
        
        // Handle different Alexa request types
        const requestType = alexaRequest.request?.type;
        const intentName = alexaRequest.request?.intent?.name;
        
        let speechText = "I'm not sure how to help with that.";
        let shouldEndSession = true;
        
        // LaunchRequest - when user opens the skill ("Alexa, open driving stats")
        if (requestType === 'LaunchRequest') {
            speechText = "Welcome to your Automotive IoT dashboard. You can ask for your driving summary, safety score, or latest stats. What would you like to know?";
            shouldEndSession = false;
        }
        
        // IntentRequest - when user asks something specific
        else if (requestType === 'IntentRequest') {
            
            // Get Driving Summary
            if (intentName === 'GetDrivingSummaryIntent') {
                const period = alexaRequest.request?.intent?.slots?.period?.value || 'today';
                const summary = await getDrivingSummaryData(period);
                speechText = summary.speechText;
            }
            
            // Get Safety Score
            else if (intentName === 'GetSafetyScoreIntent') {
                const period = alexaRequest.request?.intent?.slots?.period?.value || 'week';
                const score = await getSafetyScoreData(period);
                speechText = score.speechText;
            }
            
            // Get Latest Stats
            else if (intentName === 'GetLatestStatsIntent') {
                const stats = await getLatestStatsData();
                speechText = stats.speechText;
            }
            
            // Built-in intents
            else if (intentName === 'AMAZON.HelpIntent') {
                speechText = "You can ask me for your driving summary, your safety score, or your latest driving stats. For example, say: what's my safety score this week?";
                shouldEndSession = false;
            }
            else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
                speechText = "Goodbye! Drive safely!";
            }
            else if (intentName === 'AMAZON.FallbackIntent') {
                speechText = "I didn't understand that. You can ask for your driving summary, safety score, or latest stats.";
                shouldEndSession = false;
            }
        }
        
        // SessionEndedRequest - cleanup
        else if (requestType === 'SessionEndedRequest') {
            console.log('   Session ended:', alexaRequest.request?.reason);
            return response.json({ version: "1.0" });
        }
        
        // Build Alexa response
        const alexaResponse = {
            version: "1.0",
            response: {
                outputSpeech: {
                    type: "PlainText",
                    text: speechText
                },
                shouldEndSession: shouldEndSession
            }
        };
        
        console.log('   Response:', speechText.substring(0, 100) + '...');
        return response.json(alexaResponse);
        
    } catch (error) {
        console.error('[ERROR] Alexa skill handler failed:');
        console.error('Error details:', error);
        
        return response.json({
            version: "1.0",
            response: {
                outputSpeech: {
                    type: "PlainText",
                    text: "Sorry, there was an error getting your driving data. Please try again later."
                },
                shouldEndSession: true
            }
        });
    }
});

// Helper function to get driving summary data
async function getDrivingSummaryData(period) {
    let dateFilter = new Date();
    if (period === 'today') {
        dateFilter.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
        dateFilter.setDate(dateFilter.getDate() - 7);
    } else if (period === 'month') {
        dateFilter.setMonth(dateFilter.getMonth() - 1);
    }
    
    const dateString = dateFilter.toISOString().slice(0, 19).replace('T', ' ');
    
    const [harshBrakingEvents] = await db.query(
        `SELECT COUNT(*) as count FROM HarshBrakingEvents WHERE event_timestamp >= ?`, [dateString]
    );
    const [followDistanceViolations] = await db.query(
        `SELECT COUNT(*) as count FROM FollowDistanceViolations WHERE event_timestamp >= ?`, [dateString]
    );
    const [speedingEvents] = await db.query(
        `SELECT COUNT(*) as count FROM SpeedSnapshots WHERE snapshot_timestamp >= ? AND is_speeding = 1`, [dateString]
    );
    
    return {
        speechText: generateSpeechText(period, harshBrakingEvents, followDistanceViolations, speedingEvents)
    };
}

// Helper function to get safety score data
async function getSafetyScoreData(period) {
    let dateFilter = new Date();
    if (period === 'today') {
        dateFilter.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
        dateFilter.setDate(dateFilter.getDate() - 7);
    } else if (period === 'month') {
        dateFilter.setMonth(dateFilter.getMonth() - 1);
    }
    
    const dateString = dateFilter.toISOString().slice(0, 19).replace('T', ' ');
    
    const [harshCount] = await db.query(
        `SELECT COUNT(*) as count FROM HarshBrakingEvents WHERE event_timestamp >= ?`, [dateString]
    );
    const [followCount] = await db.query(
        `SELECT COUNT(*) as count FROM FollowDistanceViolations WHERE event_timestamp >= ?`, [dateString]
    );
    const [speedingCount] = await db.query(
        `SELECT COUNT(*) as count FROM SpeedSnapshots WHERE snapshot_timestamp >= ? AND is_speeding = 1`, [dateString]
    );
    
    let score = 100;
    score -= (harshCount?.count || 0) * 5;
    score -= (followCount?.count || 0) * 3;
    score -= (speedingCount?.count || 0) * 2;
    score = Math.max(0, Math.min(100, score));
    
    let rating = 'Excellent';
    if (score < 50) rating = 'Needs Improvement';
    else if (score < 70) rating = 'Fair';
    else if (score < 85) rating = 'Good';
    
    return {
        speechText: `Your driving safety score for the ${period} is ${score} out of 100, which is ${rating}. ` +
                   `You had ${harshCount?.count || 0} harsh braking events, ` +
                   `${followCount?.count || 0} follow distance violations, ` +
                   `and ${speedingCount?.count || 0} speeding incidents.`
    };
}

// Helper function to get latest stats data
async function getLatestStatsData() {
    const [latestBraking] = await db.query(
        `SELECT * FROM HarshBrakingEvents ORDER BY event_timestamp DESC LIMIT 1`, []
    );
    const [latestFollowDistance] = await db.query(
        `SELECT * FROM FollowDistanceViolations ORDER BY event_timestamp DESC LIMIT 1`, []
    );
    const [latestSpeed] = await db.query(
        `SELECT * FROM SpeedSnapshots ORDER BY snapshot_timestamp DESC LIMIT 1`, []
    );
    
    return {
        speechText: generateLatestStatsSpeech(latestBraking, latestFollowDistance, latestSpeed)
    };
}

// Helper function to generate speech text for summary
function generateSpeechText(period, harshBraking, followDistance, speeding) {
    const periodText = period === 'today' ? 'today' : 
                       period === 'week' ? 'this week' : 'this month';
    
    let speech = `Here's your driving summary for ${periodText}. `;
    
    const hbCount = harshBraking?.count || 0;
    const fdCount = followDistance?.count || 0;
    const spCount = speeding?.count || 0;
    
    if (hbCount === 0 && fdCount === 0 && spCount === 0) {
        speech += "Great news! You have no recorded incidents. Keep up the safe driving!";
    } else {
        if (hbCount > 0) {
            speech += `You had ${hbCount} harsh braking ${hbCount === 1 ? 'event' : 'events'}. `;
        }
        if (fdCount > 0) {
            speech += `You had ${fdCount} follow distance ${fdCount === 1 ? 'violation' : 'violations'}. `;
        }
        if (spCount > 0) {
            speech += `You were caught speeding ${spCount} ${spCount === 1 ? 'time' : 'times'}. `;
        }
    }
    
    return speech;
}

// Helper function to generate speech for latest stats
function generateLatestStatsSpeech(braking, followDistance, speed) {
    let speech = "Here are your latest driving statistics. ";
    
    if (speed) {
        speech += `Your last recorded speed was ${parseFloat(speed.speed_mph).toFixed(0)} miles per hour. `;
    }
    
    if (braking) {
        const timeAgo = getTimeAgo(new Date(braking.event_timestamp));
        speech += `Your last harsh braking event was ${timeAgo}. `;
    }
    
    if (followDistance) {
        const timeAgo = getTimeAgo(new Date(followDistance.event_timestamp));
        speech += `Your last follow distance violation was ${timeAgo}. `;
    }
    
    if (!braking && !followDistance && !speed) {
        speech = "I don't have any driving data recorded yet.";
    }
    
    return speech;
}

// Helper function to get human-readable time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return `${Math.floor(seconds / 604800)} weeks ago`;
}

// ==================== TEST DATA ENDPOINTS (for development without Arduino) ====================

// POST test data - generates sample data for testing
app.post("/api/test/generate-data", upload.none(), async (request, response) => {
    try {
        const count = parseInt(request.query.count) || 10;
        const results = { harshBraking: 0, followDistance: 0, speedSnapshots: 0 };
        
        // Generate test harsh braking events
        for (let i = 0; i < count; i++) {
            const randomDate = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
            await harshBraking.addEvent({
                event_timestamp: randomDate,
                deceleration_rate: (Math.random() * 10 + 5).toFixed(2),
                speed_before: (Math.random() * 40 + 30).toFixed(2),
                speed_after: (Math.random() * 20).toFixed(2),
                severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
                light_condition: ['day', 'night', 'dawn', 'dusk'][Math.floor(Math.random() * 4)]
            });
            results.harshBraking++;
        }
        
        // Generate test follow distance violations
        for (let i = 0; i < count; i++) {
            const randomDate = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
            await followDistance.addViolation({
                event_timestamp: randomDate,
                distance_meters: (Math.random() * 10 + 2).toFixed(2),
                current_speed: (Math.random() * 40 + 30).toFixed(2),
                required_distance: (Math.random() * 15 + 10).toFixed(2),
                duration_seconds: Math.floor(Math.random() * 30),
                light_condition: ['day', 'night', 'dawn', 'dusk'][Math.floor(Math.random() * 4)]
            });
            results.followDistance++;
        }
        
        // Generate test speed snapshots
        for (let i = 0; i < count * 5; i++) {
            const randomDate = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
            const speedLimit = [25, 35, 45, 55, 65, 70][Math.floor(Math.random() * 6)];
            const speed = speedLimit + (Math.random() * 20 - 5); // Sometimes over, sometimes under
            await speedSnapshots.addSnapshot({
                snapshot_timestamp: randomDate,
                speed_mph: speed.toFixed(2),
                speed_limit: speedLimit,
                acceleration: (Math.random() * 4 - 2).toFixed(2),
                heading: (Math.random() * 360).toFixed(2),
                light_condition: ['day', 'night', 'dawn', 'dusk'][Math.floor(Math.random() * 4)]
            });
            results.speedSnapshots++;
        }
        
        return response.status(201).json({ 
            message: "Test data generated successfully",
            generated: results
        });
    } catch (error) {
        console.error('[ERROR] Failed to generate test data:');
        console.error('Error details:', error);
        return response.status(500).json({ message: "Server error", error: error.message });
    }
});

// DELETE all test data
app.delete("/api/test/clear-data", upload.none(), async (request, response) => {
    try {
        await db.query('DELETE FROM HarshBrakingEvents', []);
        await db.query('DELETE FROM FollowDistanceViolations', []);
        await db.query('DELETE FROM SpeedSnapshots', []);
        
        return response.json({ message: "All data cleared successfully" });
    } catch (error) {
        console.error('[ERROR] Failed to clear test data:');
        console.error('Error details:', error);
        return response.status(500).json({ message: "Server error", error: error.message });
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
        console.log(`   Speed: ${data.speed_mph} mph`);
        console.log(`   Light Level: ${data.light_level}%`);
        console.log(`   Acceleration: X=${data.accX}g, Y=${data.accY}g, Z=${data.accZ}g`);

        // Validate required fields
        if (!data.distance_cm || data.light_level === undefined || 
            data.accX === undefined || data.accY === undefined || data.accZ === undefined ||
            data.speed_mph === undefined) {
            console.error('[ERROR] Missing required sensor data:', data);
            return response.status(400).json({ 
                message: "Missing required sensor data",
                required: ["distance_cm", "speed_mph", "light_level", "accX", "accY", "accZ"]
            });
        }

        // Convert raw sensor data
        const distanceMeters = data.distance_cm / 100.0;  // Convert cm to meters
        const speedMph = parseFloat(data.speed_mph);
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
            current_speed: speedMph,
            light_condition: lightCondition
        });

        // Store speed snapshot with acceleration and speed data
        results.speedSnapshot = await speedSnapshots.addSnapshot({
            speed_mph: speedMph,
            acceleration: totalAcceleration.toFixed(3),
            light_condition: lightCondition,
            speed_limit: null
        });

        return response.status(201).json({ 
            data: results, 
            message: "Sensor data processed",
            processed: {
                distance_meters: distanceMeters,
                speed_mph: speedMph,
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

// Start HTTP server
// Using '0.0.0.0' allows connections from other devices on your network
app.listen(port, () => {
    console.log(`HTTP Server running on port ${port}`);
});

// Start HTTPS server (commented out for local development)
// Uncomment when deploying to production with SSL certificates
https.createServer(sslOptions, app).listen(httpsPort, () => {
    console.log(`Automotive IoT Database Server running at https://auto.theronlindsay.dev:${httpsPort}`);
});
