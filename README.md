# Automotive IoT Database

A real-time driving safety monitoring system that collects sensor data from Arduino-based hardware and stores it in a MySQL database. This single-user system tracks:

- **Follow Distance** - Measured via LiDAR distance sensor

## 🚗 System Architecture

```
┌─────────────────┐     HTTP/JSON      ┌─────────────────┐     MySQL      ┌─────────────────┐
│    Arduino      │ ──────────────────▶│   Node.js       │ ─────────────▶│    Database     │
│  (Raw Sensors)  │                    │   Server        │               │                 │
│  Distance + Light│                   │  (Processing)   │               │                 │
└─────────────────┘                    └─────────────────┘               └─────────────────┘
                                              │
                                              ▼
                                       ┌─────────────────┐
                                       │   Web Dashboard │
                                       └─────────────────┘
```

## 📡 Required Sensors

| Sensor | Purpose | Data Sent to Server |
|--------|---------|---------------------|
| **LiDAR** (TFMini/VL53L0X) | Distance measurement | Distance in centimeters (cm) |
| **Light Sensor** (LDR/BH1750) | Ambient light detection | Light level (0-100 scale) |

**Note:** Arduino only sends raw sensor data. All processing (speed calculations, event detection, etc.) is done server-side.

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
The server will start at `http://localhost:3000`

## 📊 API Endpoints

### Arduino Endpoint (for raw sensor data)

#### Sensor Data
```http
POST /api/arduino/sensor-data
```

Send raw sensor readings:
```json
{
  "distance_cm": 5000,
  "light_level": 75
}
```

**Response:**
```json
{
  "data": {
    "followDistance": { "affectedRows": 1 }
  },
  "message": "Sensor data processed",
  "processed": {
    "distance_meters": 50,
    "light_condition": "day",
    "light_level": 75
  }
}
```

### Web Dashboard Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/follow-distance` | List all distance readings |

All GET endpoints support query parameters:
- `start_date` - Filter from date
- `end_date` - Filter to date
- `limit` - Maximum records to return (default: 100)
- `end_date` - Filter to date
- `limit` - Limit results

## 🔧 Arduino Setup

See `arduino_example.ino` for a complete example of how to:

1. Connect to WiFi
2. Read LiDAR distance sensor (returns cm)
3. Read light sensor (converts to 0-100 scale)
4. Send raw sensor data to server every second

### Required Arduino Libraries

- WiFi/ESP8266WiFi
- HTTPClient
- ArduinoJson

## 📁 Project Structure

```text
AutomotiveIoT/
├── index.js                    # Main server file
├── package.json
├── database_schema.sql         # SQL to create tables
├── arduino_example.ino         # Arduino sample code
├── README.md
└── Server/
    ├── Model/
    │   ├── connection.js       # Database connection
    │   └── followDistance.js   # Distance tracking operations
    └── public/
        ├── index.html          # Dashboard HTML
        ├── dashboard.js        # Dashboard JavaScript
        └── styles.css          # Dashboard styles
```

## 📈 Database Schema

### Tables

- **FollowDistanceViolations** - Distance readings with timestamps

## 🚀 Future Enhancements

- [ ] Real-time WebSocket updates
- [ ] Mobile app for driver alerts
- [ ] Machine learning for pattern analysis
- [ ] Additional sensor integration (speed, acceleration)
- [ ] Alert thresholds and notifications
