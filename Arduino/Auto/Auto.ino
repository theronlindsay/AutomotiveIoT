/*
 * Automotive IoT - Arduino Sensor Data Collector
 * 
 * This sketch collects raw sensor data and sends it to the server.
 * All processing is done server-side.
 * 
 * Required Hardware:
 * - Arduino with WiFi capability (WiFiNINA for Arduino Nano 33 IoT)
 * - LiDAR sensor (TFMini-I2C)
 * - Light sensor (LDR on analog pin A0)
 * - Accelerometer on analog pins A3 (X), A4 (Y), A5 (Z)
 * 
 * Server Endpoint:
 * - POST /api/arduino/sensor-data - Raw sensor data
 */

#include "Wire.h"
#include "TFLI2C.h"
#include "WiFiNINA.h"
#include <ArduinoJson.h>

TFLI2C sensor;

const int lightPin = A0;
const int accXPin = A3;
const int accYPin = A4;
const int accZPin = A5;
const int SEND_INTERVAL = 1000;  // Send data every 1 second

int status = WL_IDLE_STATUS;
WiFiClient client;
char ssid[] = "Tron";
char pass[] = "watermelone";
char server[] = "auto.theronlindsay.dev";
int port = 80;  // HTTPS port

unsigned long lastSendTime = 0;

// Calibration: baseline acceleration when stationary
// These values are measured during setup
float baselineAccX = 0.0;
float baselineAccY = 0.0;
float baselineAccZ = 0.0;

void setup() {
    Serial.begin(9600);
    Wire.begin();
    pinMode(lightPin, INPUT);
    pinMode(accXPin, INPUT);
    pinMode(accYPin, INPUT);
    pinMode(accZPin, INPUT);

    // Connect to WiFi
    while(status != WL_CONNECTED){
        Serial.print("Attempting connection to ");
        Serial.println(ssid);
        
        status = WiFi.begin(ssid, pass);
        delay(2000);
    }

    Serial.println("Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    
    // Calibrate accelerometer - average 10 readings while stationary
    Serial.println("Calibrating accelerometer...");
    delay(2000);  // Wait for vehicle to settle
    float sumX = 0, sumY = 0, sumZ = 0;
    for (int i = 0; i < 10; i++) {
        sumX += readAcceleration(accXPin);
        sumY += readAcceleration(accYPin);
        sumZ += readAcceleration(accZPin);
        delay(100);
    }
    baselineAccX = sumX / 10.0;
    baselineAccY = sumY / 10.0;
    baselineAccZ = sumZ / 10.0;
    
    Serial.print("Baseline: X=");
    Serial.print(baselineAccX, 2);
    Serial.print(" Y=");
    Serial.print(baselineAccY, 2);
    Serial.print(" Z=");
    Serial.println(baselineAccZ, 2);
}

void loop() {
    // Send sensor data at regular intervals
    if (millis() - lastSendTime >= SEND_INTERVAL) {
        sendSensorData();
        lastSendTime = millis();
    }
    
    delay(100);
}

float readAcceleration(int pin) {
    // Read analog pin (0-1023) and convert to g-force
    // Assuming 3.3V reference and typical 400mV per g accelerometer
    // Adjust these values based on your specific accelerometer specs
    int rawValue = analogRead(pin);
    float voltage = rawValue * (3.3 / 1023.0);  // Convert to voltage (0-3.3V)
    float acceleration = (voltage - 1.65) / 0.33;  // Convert to g-force (1.65V = 0g, 0.33V per g)
    return acceleration;
}

void sendSensorData() {
    int16_t dist;
    
    // Read accelerometer data (X, Y, Z)
    float accX = readAcceleration(accXPin);
    float accY = readAcceleration(accYPin);
    float accZ = readAcceleration(accZPin);
    
    // Subtract baseline (calibrated values when stationary)
    float diffX = accX - baselineAccX;
    float diffY = accY - baselineAccY;
    float diffZ = accZ - baselineAccZ;
    
    // Calculate dynamic acceleration magnitude
    float dynamicAcceleration = sqrt(diffX * diffX + diffY * diffY + diffZ * diffZ);
    
    // Add deadzone: ignore accelerations below 0.15g (noise/sensor drift)
    if (dynamicAcceleration < 0.15) {
        dynamicAcceleration = 0.0;
    }
    
    // Convert acceleration to speed
    // Much more conservative scaling: acceleration_g * 2.5
    // This assumes smaller acceleration samples
    float speedMph = dynamicAcceleration * 2.5;
    
    // Cap maximum speed at reasonable value (150 mph)
    if (speedMph > 150) {
        speedMph = 150;
    }
    
    // Read light sensor (convert 0-1023 to 0-100 scale)
    int sensorValue = analogRead(lightPin);
    int lightLevel = map(sensorValue, 0, 1023, 0, 100);
    
    Serial.print("Light Level: ");
    Serial.print(lightLevel);
    Serial.print("% | Raw Acc (g): X=");
    Serial.print(accX, 2);
    Serial.print(" Y=");
    Serial.print(accY, 2);
    Serial.print(" Z=");
    Serial.print(accZ, 2);
    Serial.print(" | Dynamic: ");
    Serial.print(dynamicAcceleration, 2);
    Serial.print(" | Speed: ");
    Serial.print(speedMph);
    Serial.println(" mph");
    
    // Read LiDAR distance
    if (sensor.getData(dist, 0x10)) {
        Serial.print("Distance: ");
        Serial.print(dist);
        Serial.println(" cm");
        
        // Connect and send data
        if(client.connect(server, port)){
            // Create JSON with all sensor data
            StaticJsonDocument<256> doc;
            doc["distance_cm"] = dist;           // Distance in centimeters
            doc["speed_mph"] = speedMph;         // Speed derived from dynamic acceleration
            doc["light_level"] = lightLevel;     // Light level 0-100
            doc["accX"] = accX;                  // Acceleration X in g
            doc["accY"] = accY;                  // Acceleration Y in g
            doc["accZ"] = accZ;                  // Acceleration Z in g
            
            String jsonOutput;
            serializeJson(doc, jsonOutput);
            
            // Send HTTPS request
            client.println("POST /api/arduino/sensor-data HTTP/1.1");
            client.print("Host: ");
            client.println(server);
            client.println("Content-Type: application/json");
            client.print("Content-Length: ");
            client.println(jsonOutput.length());
            client.println();  // Mandatory blank line
            client.println(jsonOutput);
            
            Serial.println("Sensor data sent!");
            
            // Wait for response (optional, for debugging)
            delay(100);
            while(client.available()){
                String line = client.readStringUntil('\n');
                Serial.println(line);
            }
            
            client.stop();
        } else {
            Serial.println("Connection to server failed.");
        }
    } else {
        Serial.println("Failed to read LiDAR sensor.");
    }
}
