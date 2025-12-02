# Automotive IoT Database

A real-time driving safety monitoring system that collects sensor data from Arduino-based hardware and stores it in a MySQL database. This single-user system tracks:

- **Harsh Braking Events** - Detected via accelerometer/LiDAR
- **Follow Distance Violations** - Measured via LiDAR
- **Speed Snapshots** - Recorded every few seconds via GPS
- **Media Clips** - Screenshots and 10-second video clips

## 🚗 System Architecture

```
┌─────────────────┐     HTTP/JSON      ┌─────────────────┐     MySQL      ┌─────────────────┐
│    Arduino      │ ──────────────────▶│   Node.js       │ ─────────────▶│    Database     │
│    + Sensors    │                    │   Server        │               │                 │
└─────────────────┘                    └─────────────────┘               └─────────────────┘
                                              │
                                              ▼
                                       ┌─────────────────┐
                                       │   Web Dashboard │
                                       └─────────────────┘
```

## 📡 Required Sensors

| Sensor | Purpose | Data Collected |
|--------|---------|----------------|
| **LiDAR** (TFMini/VL53L0X) | Follow distance measurement | Distance to vehicle ahead (meters) |
| **GPS** (NEO-6M) | Location & speed | Latitude, longitude, speed (mph), heading |
| **Accelerometer** (MPU6050) | Harsh braking detection | Deceleration rate (m/s²) |
| **Light Sensor** (LDR/BH1750) | Day/night cycle | Light condition (day/night/dusk/dawn) |
| **Camera** (optional) | Video/screenshots | File paths to media clips |

## 🛠️ Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Database Tables
Run the SQL script in your MySQL database:
```bash
mysql -u YOUR_USER -p YOUR_DATABASE < database_schema.sql
```

### 3. Configure Database Connection
Edit `Server/Model/connection.js` with your database credentials.

### 4. Start the Server
```bash
npm run start
```

The server will start at `http://localhost:3000`

## 📊 API Endpoints

### Arduino Endpoints (for sensor data)

#### Combined Sensor Data (Recommended)
```
POST /api/arduino/sensor-data
```
Send all sensor data in one request:
```json
{
  "latitude": 45.5231,
  "longitude": -122.6765,
  "speed_mph": 35.5,
  "acceleration": -0.5,
  "heading": 180,
  "light_condition": "day",
  "harsh_braking_detected": false,
  "follow_distance_violation": false,
  "distance_meters": 50
}
```

#### Harsh Braking Events
```
POST /api/harsh-braking
```
```json
{
  "latitude": 45.5231,
  "longitude": -122.6765,
  "deceleration_rate": 5.2,
  "speed_before": 45,
  "speed_after": 20,
  "severity": "high",
  "light_condition": "day"
}
```

#### Follow Distance Violations
```
POST /api/follow-distance
```
```json
{
  "latitude": 45.5231,
  "longitude": -122.6765,
  "distance_meters": 5.5,
  "current_speed": 40,
  "required_distance": 15,
  "duration_seconds": 3,
  "light_condition": "day"
}
```

#### Speed Snapshots
```
POST /api/speed-snapshots
```
```json
{
  "latitude": 45.5231,
  "longitude": -122.6765,
  "speed_mph": 65,
  "speed_limit": 55,
  "acceleration": 1.2,
  "heading": 270,
  "light_condition": "night"
}
```

#### Media Clips
```
POST /api/media-clips
```
```json
{
  "latitude": 45.5231,
  "longitude": -122.6765,
  "media_type": "video_clip",
  "file_path": "/clips/event_20241201_143022.mp4",
  "duration_seconds": 10,
  "event_type": "harsh_braking"
}
```

### Web Dashboard Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/harsh-braking` | List harsh braking events |
| GET | `/api/follow-distance` | List follow distance violations |
| GET | `/api/speed-snapshots` | List speed snapshots |
| GET | `/api/media-clips` | List media clips |

All GET endpoints support query parameters:
- `start_date` - Filter from date
- `end_date` - Filter to date
- `limit` - Limit results

## 🔧 Arduino Setup

See `arduino_example.ino` for a complete example of how to:
1. Connect to WiFi
2. Read sensor data
3. Detect harsh braking events
4. Detect follow distance violations
5. Send data to the server

### Required Arduino Libraries
- WiFi/ESP8266WiFi
- HTTPClient
- ArduinoJson
- TinyGPS++ (for GPS)
- Adafruit_MPU6050 (for accelerometer)
- TFMini (for LiDAR)

## 📁 Project Structure

```
AutomotiveIoTDatabase/
├── index.js                    # Main server file
├── package.json
├── database_schema.sql         # SQL to create tables
├── arduino_example.ino         # Arduino sample code
├── README.md
└── Server/
    ├── Model/
    │   ├── connection.js       # Database connection
    │   ├── harshBraking.js     # Harsh braking operations
    │   ├── followDistance.js   # Follow distance operations
    │   ├── speedSnapshots.js   # Speed snapshot operations
    │   └── mediaClips.js       # Media clip operations
    └── public/
        ├── index.html          # Dashboard HTML
        ├── dashboard.js        # Dashboard JavaScript
        └── styles.css          # Dashboard styles
```

## 📈 Database Schema

### Tables
- **HarshBrakingEvents** - Harsh braking incidents
- **FollowDistanceViolations** - Following too closely
- **SpeedSnapshots** - Periodic speed/location records
- **MediaClips** - Screenshot and video clip references

## 🚀 Future Enhancements

- [ ] Weather data integration via GPS location
- [ ] Real-time WebSocket updates
- [ ] Mobile app for driver alerts
- [ ] Machine learning for driving behavior analysis
- [ ] Cloud storage for media clips
- [ ] Geofencing alerts

## 🎥 Video Recording with Raspberry Pi

For video capability, use a Raspberry Pi with Pi Camera alongside the Arduino sensors.
See the `raspberry_pi/` folder for:
- `dashcam.py` - Python script for video recording and event capture
- `README.md` - Complete setup guide
- `requirements.txt` - Python dependencies

**Architecture with Raspberry Pi:**
```
Arduino (Sensors) --Serial--> Raspberry Pi (Camera + WiFi) --HTTP--> Server
```
