/*
 * Automotive IoT - Arduino Sensor Collector (Raspberry Pi Mode)
 * 
 * This version sends sensor data over Serial to a Raspberry Pi,
 * which handles video recording and server communication.
 * 
 * Connection: Arduino USB/Serial -> Raspberry Pi
 * 
 * Required Hardware:
 * - Arduino (Uno, Nano, Mega, or similar - no WiFi needed!)
 * - LiDAR sensor (TFMini or VL53L0X) - for follow distance
 * - GPS Module (NEO-6M or similar) - for location and speed
 * - Accelerometer (MPU6050 or ADXL345) - for detecting harsh braking
 * - Light sensor (LDR or BH1750) - for day/night detection
 * 
 * The Raspberry Pi runs dashcam.py which:
 * - Reads this serial data
 * - Records video with Pi Camera
 * - Saves clips on events
 * - Sends data to server
 */

#include <ArduinoJson.h>
#include <SoftwareSerial.h>  // For GPS on non-hardware serial

// ==================== PIN CONFIGURATION ====================
// Adjust these for your wiring
#define GPS_RX_PIN 4
#define GPS_TX_PIN 3
#define LDR_PIN A0
#define LIDAR_RX_PIN 6
#define LIDAR_TX_PIN 5

// ==================== CONFIGURATION ====================
const float HARSH_BRAKE_THRESHOLD = -3.0;     // m/s² (negative = deceleration)
const float MIN_FOLLOW_DISTANCE = 10.0;       // meters
const float LIGHT_THRESHOLD = 500;            // LDR reading threshold for day/night
const int DATA_SEND_INTERVAL = 100;           // Send data every 100ms (10Hz)

// ==================== SENSOR DATA STRUCTURE ====================
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
unsigned long lastSendTime = 0;
float previousSpeed = 0;
SensorData currentData;

// Software serial for GPS (if using hardware serial for Pi communication)
SoftwareSerial gpsSerial(GPS_RX_PIN, GPS_TX_PIN);

// ==================== SETUP ====================
void setup() {
    // Serial for Raspberry Pi communication (115200 baud)
    Serial.begin(115200);
    
    // GPS serial
    gpsSerial.begin(9600);
    
    // Initialize analog pins
    pinMode(LDR_PIN, INPUT);
    
    // Initialize I2C sensors (accelerometer, LiDAR)
    // Wire.begin();
    // initAccelerometer();
    // initLiDAR();
    
    // Wait for serial connection
    while (!Serial) {
        delay(10);
    }
    
    // Send startup message
    Serial.println("{\"status\":\"Arduino sensor module started\"}");
}

// ==================== MAIN LOOP ====================
void loop() {
    // Read all sensors
    readSensors();
    
    // Check for events
    checkHarshBraking();
    checkFollowDistance();
    
    // Send data to Raspberry Pi at fixed interval
    if (millis() - lastSendTime >= DATA_SEND_INTERVAL) {
        sendDataToRaspberryPi();
        lastSendTime = millis();
    }
    
    delay(10);  // Small delay for stability
}

// ==================== SENSOR READING FUNCTIONS ====================

void readSensors() {
    // Read GPS data
    currentData.latitude = readGPSLatitude();
    currentData.longitude = readGPSLongitude();
    currentData.speed_mph = readGPSSpeed();
    currentData.heading = readGPSHeading();
    
    // Read accelerometer
    currentData.acceleration = readAcceleration();
    
    // Read LiDAR distance
    currentData.distance_meters = readLiDARDistance();
    
    // Read light sensor
    currentData.lightLevel = analogRead(LDR_PIN);
}

// ==================== GPS FUNCTIONS ====================
// Replace these with actual TinyGPS++ library calls

float readGPSLatitude() {
    // With TinyGPS++:
    // while (gpsSerial.available() > 0) {
    //     if (gps.encode(gpsSerial.read())) {
    //         if (gps.location.isValid()) {
    //             return gps.location.lat();
    //         }
    //     }
    // }
    return 45.5231;  // Placeholder - replace with actual GPS reading
}

float readGPSLongitude() {
    // return gps.location.lng();
    return -122.6765;  // Placeholder
}

float readGPSSpeed() {
    // return gps.speed.mph();
    return 35.0;  // Placeholder
}

float readGPSHeading() {
    // return gps.course.deg();
    return 180.0;  // Placeholder
}

// ==================== ACCELEROMETER FUNCTIONS ====================
// Replace with actual MPU6050 library calls

float readAcceleration() {
    // With Adafruit MPU6050:
    // sensors_event_t a, g, temp;
    // mpu.getEvent(&a, &g, &temp);
    // return a.acceleration.x;  // Forward/backward acceleration
    return 0.0;  // Placeholder
}

// ==================== LIDAR FUNCTIONS ====================
// Replace with actual LiDAR library calls

float readLiDARDistance() {
    // With TFMini:
    // if (tfmini.getData(distance, strength)) {
    //     return distance / 100.0;  // Convert cm to meters
    // }
    // 
    // With VL53L0X:
    // VL53L0X_RangingMeasurementData_t measure;
    // lox.rangingTest(&measure, false);
    // if (measure.RangeStatus != 4) {
    //     return measure.RangeMilliMeter / 1000.0;  // Convert mm to meters
    // }
    return 50.0;  // Placeholder
}

// ==================== EVENT DETECTION ====================

void checkHarshBraking() {
    float deceleration = currentData.acceleration;
    
    // Detect harsh braking (negative acceleration below threshold)
    if (deceleration < HARSH_BRAKE_THRESHOLD) {
        currentData.harshBrakingDetected = true;
    } else {
        currentData.harshBrakingDetected = false;
    }
    
    previousSpeed = currentData.speed_mph;
}

void checkFollowDistance() {
    // Calculate safe following distance (2-second rule)
    float speedMetersPerSecond = currentData.speed_mph * 0.44704;
    float safeDistance = speedMetersPerSecond * 2;
    
    if (currentData.distance_meters < MIN_FOLLOW_DISTANCE && 
        currentData.distance_meters < safeDistance &&
        currentData.speed_mph > 5) {  // Only check when moving
        currentData.followDistanceViolation = true;
    } else {
        currentData.followDistanceViolation = false;
    }
}

// ==================== DATA TRANSMISSION ====================

String getLightCondition() {
    if (currentData.lightLevel > LIGHT_THRESHOLD) {
        return "day";
    } else if (currentData.lightLevel > LIGHT_THRESHOLD * 0.3) {
        return "dusk";
    } else {
        return "night";
    }
}

void sendDataToRaspberryPi() {
    // Create JSON document
    StaticJsonDocument<384> doc;
    
    // Location data
    doc["latitude"] = currentData.latitude;
    doc["longitude"] = currentData.longitude;
    doc["heading"] = currentData.heading;
    
    // Speed and acceleration
    doc["speed_mph"] = currentData.speed_mph;
    doc["acceleration"] = currentData.acceleration;
    
    // Distance (LiDAR)
    doc["distance_meters"] = currentData.distance_meters;
    
    // Light condition
    doc["light_level"] = currentData.lightLevel;
    doc["light_condition"] = getLightCondition();
    
    // Event flags - Raspberry Pi will trigger video capture on these
    doc["harsh_braking_detected"] = currentData.harshBrakingDetected;
    doc["follow_distance_violation"] = currentData.followDistanceViolation;
    
    // Timestamp (milliseconds since boot)
    doc["timestamp"] = millis();
    
    // Send as single line JSON (Raspberry Pi reads line by line)
    serializeJson(doc, Serial);
    Serial.println();  // End with newline
}
