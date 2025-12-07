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
 * 
 * Server Endpoint:
 * - POST /api/arduino/sensor-data - Raw sensor data
 */

#include "Wire.h"
#include "TFLI2C.h"
#include "WiFiNINA.h"
#include <ArduinoJson.h>

TFLI2C sensor;

const int sensorPin = A0;
const int SEND_INTERVAL = 1000;  // Send data every 1 second

int status = WL_IDLE_STATUS;
WiFiClient client;
char ssid[] = "Pixel_1262";
char pass[] = "watermelone";
char server[] = "auto.theronlindsay.dev";
int port = 443;  // HTTPS port

unsigned long lastSendTime = 0;

void setup() {
    Serial.begin(9600);
    Wire.begin();
    pinMode(sensorPin, INPUT);

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

void sendSensorData() {
    int16_t dist;
    
    // Read light sensor (convert 0-1023 to 0-100 scale)
    int sensorValue = analogRead(sensorPin);
    int lightLevel = map(sensorValue, 0, 1023, 0, 100);
    
    Serial.print("Light Level: ");
    Serial.print(lightLevel);
    Serial.println("%");
    
    // Read LiDAR distance
    if (sensor.getData(dist, 0x10)) {
        Serial.print("Distance: ");
        Serial.print(dist);
        Serial.println(" cm");
        
        // Connect and send data
        if(client.connect(server, port)){
            // Create JSON with only raw sensor data
            StaticJsonDocument<128> doc;
            doc["distance_cm"] = dist;           // Distance in centimeters
            doc["light_level"] = lightLevel;     // Light level 0-100
            
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
