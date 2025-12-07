/*
 * Automotive IoT - Arduino Sensor Data Collector
 * 
 * This sketch collects raw sensor data and sends it to the server.
 * All processing is done server-side.
 * 
 * Required Hardware:
 * - Arduino with WiFi capability (ESP32, ESP8266, or Arduino with WiFi shield)
 * - LiDAR sensor (TFMini or VL53L0X) - for distance measurement
 * - Light sensor (LDR or BH1750) - for ambient light detection
 * 
 * Server Endpoint:
 * - POST /api/arduino/sensor-data - Raw sensor data
 */

#include <WiFi.h>        // For ESP32 (use ESP8266WiFi.h for ESP8266)
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ==================== CONFIGURATION ====================
const char* ssid = "WIFI_SSID";
const char* password = "WIFI_PASSWORD";
const char* serverUrl = "http://SERVER_IP:3000";

const int SEND_INTERVAL = 1000;  // Send data every 1 second

// ==================== GLOBAL VARIABLES ====================
unsigned long lastSendTime = 0;

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
    // initLiDAR();
    // initLightSensor();
}

// ==================== MAIN LOOP ====================
void loop() {
    // Send sensor data at regular intervals
    if (millis() - lastSendTime >= SEND_INTERVAL) {
        sendSensorData();
        lastSendTime = millis();
    }
    
    delay(100);  // Small delay between reads
}

// ==================== SENSOR READING FUNCTIONS ====================

int readLiDARDistanceCM() {
    // Example with TFMini:
    // return tfmini.getDistance();  // Returns cm
    return 5000;  // Placeholder (50 meters in cm)
}

int readLightLevel() {
    // Read light sensor and convert to 0-100 scale
    // Example with LDR (assuming 0-4095 range for 12-bit ADC):
    // int rawValue = analogRead(LDR_PIN);
    // return map(rawValue, 0, 4095, 0, 100);
    
    // For 10-bit ADC (0-1023):
    // int rawValue = analogRead(LDR_PIN);
    // return map(rawValue, 0, 1023, 0, 100);
    
    return 75;  // Placeholder (75% brightness)
}

// ==================== DATA SENDING FUNCTION ====================

void sendSensorData() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi not connected!");
        return;
    }
    
    // Read raw sensor values
    int distanceCM = readLiDARDistanceCM();
    int lightLevel = readLightLevel();
    
    HTTPClient http;
    http.begin(String(serverUrl) + "/api/arduino/sensor-data");
    http.addHeader("Content-Type", "application/json");
    
    // Create simple JSON payload with only raw sensor data
    StaticJsonDocument<128> doc;
    doc["distance_cm"] = distanceCM;
    doc["light_level"] = lightLevel;
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    int httpResponseCode = http.POST(jsonString);
    
    if (httpResponseCode > 0) {
        Serial.printf("Sensor data sent: distance=%dcm, light=%d%%. Response: %d\n", 
                      distanceCM, lightLevel, httpResponseCode);
    } else {
        Serial.printf("Error sending data: %s\n", http.errorToString(httpResponseCode).c_str());
    }
    
    http.end();
}
