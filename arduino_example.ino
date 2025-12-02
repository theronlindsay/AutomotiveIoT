/*
 * Automotive IoT - Arduino Sensor Data Collector
 * 
 * This sketch collects data from various sensors and sends it to the server.
 * 
 * Required Hardware:
 * - Arduino with WiFi capability (ESP32, ESP8266, or Arduino with WiFi shield)
 * - LiDAR sensor (TFMini or VL53L0X) - for follow distance
 * - GPS Module (NEO-6M or similar) - for location and speed
 * - Accelerometer (MPU6050 or ADXL345) - for detecting harsh braking/acceleration
 * - Light sensor (LDR or BH1750) - for day/night detection
 * 
 * Server Endpoints:
 * - POST /api/arduino/sensor-data - Combined endpoint for all sensor data
 * - POST /api/harsh-braking - Individual harsh braking events
 * - POST /api/follow-distance - Individual follow distance violations
 * - POST /api/speed-snapshots - Individual speed snapshots
 * - POST /api/media-clips - Media clip references
 */

#include <WiFi.h>        // For ESP32 (use ESP8266WiFi.h for ESP8266)
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ==================== CONFIGURATION ====================
const char* ssid = "WIFI_SSID";
const char* password = "WIFI_PASSWORD";
const char* serverUrl = "http://SERVER_IP:3000";

// Sensor thresholds
const float HARSH_BRAKE_THRESHOLD = -3.0;     // m/s² (negative = deceleration)
const float MIN_FOLLOW_DISTANCE = 10.0;       // meters
const float LIGHT_THRESHOLD = 500;            // LDR reading threshold for day/night
const int SNAPSHOT_INTERVAL = 5000;           // Speed snapshot every 5 seconds

// ==================== SENSOR DATA STRUCTURES ====================
struct SensorData {
    float latitude;
    float longitude;
    float speed_mph;
    float acceleration;       // m/s² from accelerometer
    float distance_meters;    // From LiDAR
    int lightLevel;           // From light sensor
    float heading;            // Direction from GPS
    bool harshBrakingDetected;
    bool followDistanceViolation;
};

// ==================== GLOBAL VARIABLES ====================
unsigned long lastSnapshotTime = 0;
float previousSpeed = 0;
SensorData currentData;

// ==================== SETUP ====================
void setup() {
    Serial.begin(115200);
    
    // Connect to WiFi
    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nConnected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    
    // Initialize sensors here
    // initGPS();
    // initAccelerometer();
    // initLiDAR();
    // initLightSensor();
}

// ==================== MAIN LOOP ====================
void loop() {
    // Read all sensors
    readSensors();
    
    // Check for events
    checkHarshBraking();
    checkFollowDistance();
    
    // Send periodic speed snapshots
    if (millis() - lastSnapshotTime >= SNAPSHOT_INTERVAL) {
        sendSensorData();
        lastSnapshotTime = millis();
    }
    
    delay(100);  // Small delay between sensor reads
}

// ==================== SENSOR READING FUNCTIONS ====================

void readSensors() {
    // Read GPS data
    // Replace with actual GPS library calls
    currentData.latitude = readGPSLatitude();
    currentData.longitude = readGPSLongitude();
    currentData.speed_mph = readGPSSpeed();
    currentData.heading = readGPSHeading();
    
    // Read accelerometer
    currentData.acceleration = readAcceleration();
    
    // Read LiDAR distance
    currentData.distance_meters = readLiDARDistance();
    
    // Read light sensor
    currentData.lightLevel = readLightSensor();
}

// Placeholder functions - replace with actual sensor library calls
float readGPSLatitude() {
    // Example: return gps.location.lat();
    return 45.5231;  // Placeholder
}

float readGPSLongitude() {
    // Example: return gps.location.lng();
    return -122.6765;  // Placeholder
}

float readGPSSpeed() {
    // Example: return gps.speed.mph();
    return 35.0;  // Placeholder
}

float readGPSHeading() {
    // Example: return gps.course.deg();
    return 180.0;  // Placeholder
}

float readAcceleration() {
    // Example with MPU6050:
    // sensors_event_t a, g, temp;
    // mpu.getEvent(&a, &g, &temp);
    // return a.acceleration.x;
    return 0.0;  // Placeholder
}

float readLiDARDistance() {
    // Example with TFMini:
    // return tfmini.getDistance() / 100.0;  // Convert cm to meters
    return 50.0;  // Placeholder
}

int readLightSensor() {
    // Example with LDR:
    // return analogRead(LDR_PIN);
    return 800;  // Placeholder
}

// ==================== EVENT DETECTION ====================

void checkHarshBraking() {
    // Calculate deceleration from speed change
    float speedChange = currentData.speed_mph - previousSpeed;
    float deceleration = currentData.acceleration;
    
    // Detect harsh braking (negative acceleration below threshold)
    if (deceleration < HARSH_BRAKE_THRESHOLD) {
        currentData.harshBrakingDetected = true;
        Serial.println("HARSH BRAKING DETECTED!");
        
        // Send immediate alert
        sendHarshBrakingEvent(deceleration, previousSpeed, currentData.speed_mph);
    } else {
        currentData.harshBrakingDetected = false;
    }
    
    previousSpeed = currentData.speed_mph;
}

void checkFollowDistance() {
    // Calculate safe following distance (2-second rule)
    // Safe distance = speed (m/s) * 2 seconds
    float speedMetersPerSecond = currentData.speed_mph * 0.44704;
    float safeDistance = speedMetersPerSecond * 2;
    
    if (currentData.distance_meters < MIN_FOLLOW_DISTANCE && 
        currentData.distance_meters < safeDistance &&
        currentData.speed_mph > 5) {  // Only check when moving
        
        currentData.followDistanceViolation = true;
        Serial.println("FOLLOW DISTANCE VIOLATION!");
        
        // Send violation
        sendFollowDistanceViolation(currentData.distance_meters, safeDistance);
    } else {
        currentData.followDistanceViolation = false;
    }
}

// ==================== DATA SENDING FUNCTIONS ====================

String getLightCondition() {
    if (currentData.lightLevel > LIGHT_THRESHOLD) {
        return "day";
    } else if (currentData.lightLevel > LIGHT_THRESHOLD * 0.3) {
        return "dusk";
    } else {
        return "night";
    }
}

void sendSensorData() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi not connected!");
        return;
    }
    
    HTTPClient http;
    http.begin(String(serverUrl) + "/api/arduino/sensor-data");
    http.addHeader("Content-Type", "application/json");
    
    // Create JSON payload
    StaticJsonDocument<512> doc;
    doc["latitude"] = currentData.latitude;
    doc["longitude"] = currentData.longitude;
    doc["speed_mph"] = currentData.speed_mph;
    doc["acceleration"] = currentData.acceleration;
    doc["heading"] = currentData.heading;
    doc["light_condition"] = getLightCondition();
    doc["harsh_braking_detected"] = currentData.harshBrakingDetected;
    doc["follow_distance_violation"] = currentData.followDistanceViolation;
    doc["distance_meters"] = currentData.distance_meters;
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    int httpResponseCode = http.POST(jsonString);
    
    if (httpResponseCode > 0) {
        Serial.printf("Sensor data sent. Response: %d\n", httpResponseCode);
    } else {
        Serial.printf("Error sending data: %s\n", http.errorToString(httpResponseCode).c_str());
    }
    
    http.end();
}

void sendHarshBrakingEvent(float deceleration, float speedBefore, float speedAfter) {
    if (WiFi.status() != WL_CONNECTED) return;
    
    HTTPClient http;
    http.begin(String(serverUrl) + "/api/harsh-braking");
    http.addHeader("Content-Type", "application/json");
    
    StaticJsonDocument<256> doc;
    doc["latitude"] = currentData.latitude;
    doc["longitude"] = currentData.longitude;
    doc["deceleration_rate"] = abs(deceleration);
    doc["speed_before"] = speedBefore;
    doc["speed_after"] = speedAfter;
    doc["severity"] = (deceleration < -6.0) ? "high" : (deceleration < -4.0) ? "medium" : "low";
    doc["light_condition"] = getLightCondition();
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    int httpResponseCode = http.POST(jsonString);
    Serial.printf("Harsh braking event sent. Response: %d\n", httpResponseCode);
    
    http.end();
    
    // Trigger camera to capture clip
    // triggerCameraCapture("harsh_braking");
}

void sendFollowDistanceViolation(float distance, float requiredDistance) {
    if (WiFi.status() != WL_CONNECTED) return;
    
    HTTPClient http;
    http.begin(String(serverUrl) + "/api/follow-distance");
    http.addHeader("Content-Type", "application/json");
    
    StaticJsonDocument<256> doc;
    doc["latitude"] = currentData.latitude;
    doc["longitude"] = currentData.longitude;
    doc["distance_meters"] = distance;
    doc["current_speed"] = currentData.speed_mph;
    doc["required_distance"] = requiredDistance;
    doc["light_condition"] = getLightCondition();
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    int httpResponseCode = http.POST(jsonString);
    Serial.printf("Follow distance violation sent. Response: %d\n", httpResponseCode);
    
    http.end();
}

void sendMediaClip(String filePath, String mediaType, String eventType) {
    if (WiFi.status() != WL_CONNECTED) return;
    
    HTTPClient http;
    http.begin(String(serverUrl) + "/api/media-clips");
    http.addHeader("Content-Type", "application/json");
    
    StaticJsonDocument<256> doc;
    doc["latitude"] = currentData.latitude;
    doc["longitude"] = currentData.longitude;
    doc["media_type"] = mediaType;  // "screenshot" or "video_clip"
    doc["file_path"] = filePath;
    doc["event_type"] = eventType;
    doc["duration_seconds"] = (mediaType == "video_clip") ? 10 : 0;
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    int httpResponseCode = http.POST(jsonString);
    Serial.printf("Media clip info sent. Response: %d\n", httpResponseCode);
    
    http.end();
}
