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
char ssid[] = "Pixel_1262";
char pass[] = "watermelone";
char server[] = "auto.theronlindsay.dev";
int port = 80;  // HTTPS port

unsigned long lastSendTime = 0;

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
    
    // Calculate total acceleration magnitude (speed based on acceleration)
    float totalAcceleration = sqrt(accX * accX + accY * accY + accZ * accZ);
    
    // Convert acceleration magnitude to approximate speed in mph
    // Using: speed_mph = acceleration_g * 10 (empirical scaling factor)
    float speedMph = totalAcceleration * 10.0;
    
    // Read light sensor (convert 0-1023 to 0-100 scale)
    int sensorValue = analogRead(lightPin);
    int lightLevel = map(sensorValue, 0, 1023, 0, 100);
    
    Serial.print("Light Level: ");
    Serial.print(lightLevel);
    Serial.print("% | Acceleration (g): X=");
    Serial.print(accX);
    Serial.print(" Y=");
    Serial.print(accY);
    Serial.print(" Z=");
    Serial.print(accZ);
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
            doc["speed_mph"] = speedMph;         // Speed derived from acceleration magnitude
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
