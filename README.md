# Automotive IoT Database

Commercial Link: https://youtu.be/sUbZu9EIe_Y

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

| Sensor                              | Purpose                 | Data Sent to Server          |
| ----------------------------------- | ----------------------- | ---------------------------- |
| **LiDAR** (TFMini/VL53L0X)    | Distance measurement    | Distance in centimeters (cm) |
| **Light Sensor** (LDR/BH1750) | Ambient light detection | Light level (0-100 scale)    |

**Note:** Arduino only sends raw sensor data. All processing (speed calculations, event detection, etc.) is done server-side.

## 🛠️ Setup

```bash
npm install

node index.js
```
