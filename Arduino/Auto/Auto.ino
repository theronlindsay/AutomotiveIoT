#include "Wire.h"
#include "TFLI2C.h"
#include "WiFiNINA.h"
#include <ArduinoJson.h>

TFLI2C sensor;

const int sensorPin = A0;

int status = WL_IDLE_STATUS;
WiFiClient client;
char ssid[] = "Pixel_1262";
char pass[] = "watermelone";
char server[] = "auto.theronlindsay.dev";
int port = 443;

void setup() {
  Serial.begin(9600);
  Wire.begin();
  pinMode(sensorPin, INPUT);


  while(status != WL_CONNECTED){
    Serial.print("Attempting connection to ");
    Serial.println(ssid);

    status = WiFi.begin(ssid, pass);

    delay(2000);
  }

  Serial.println("Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  if (client.connect(server, port)) {
  Serial.println("Connected to server");
  }
}

void loop() {

  int16_t dist; 



  //Light
  int sensorValue = analogRead(sensorPin);
  Serial.print("Light Sensor Value: ");
  Serial.println(map(sensorValue, 0, 1028, 1, 100));
  
  //Lidar
  if (sensor.getData(dist, 0x10)) {
    Serial.print("dist:");
    Serial.println(dist);

    if(client.connect(server, 443)){
      StaticJsonDocument<200> doc;
      doc["distance_meters"] = dist;        // Your sensor variable (float/int)
      doc["current_speed"] = 45.5;          // Your speed variable
      // Optional fields (Node handles them if missing based on your SQL function)
      doc["light_condition"] = "day";  //Add light sensor data here     
      doc["required_distance"] = 900;

      // 2. Serialize to String
      String jsonOutput;
      serializeJson(doc, jsonOutput);

      client.println("POST /api/follow-distance HTTP/1.1");
      client.print("Host: ");
      client.println(server);
      
      // CRITICAL: This tells Node we are sending JSON
      client.println("Content-Type: application/json");
      
      client.print("Content-Length: ");
      client.println(jsonOutput.length());
      client.println(); // Mandatory blank line
      
      // 4. Send the Body
      client.println(jsonOutput);

      Serial.println("Violation sent!");
    } else {
      Serial.println("Connection failed.");
    }

  }

  delay(200);

}