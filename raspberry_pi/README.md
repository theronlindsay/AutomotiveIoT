# Raspberry Pi Dashcam Setup Guide

This guide explains how to set up the Raspberry Pi as a dashcam controller that works with the Arduino sensor module.

## Architecture

```
┌─────────────────┐    USB/Serial    ┌─────────────────┐     WiFi/HTTP     ┌─────────────────┐
│    Arduino      │ ───────────────▶ │  Raspberry Pi   │ ────────────────▶ │   Node.js       │
│    Sensors:     │   JSON @ 10Hz    │                 │                   │   Server        │
│  - GPS          │                  │  - Pi Camera    │                   │                 │
│  - Accelerometer│                  │  - Video Buffer │                   │  - MySQL DB     │
│  - LiDAR        │                  │  - Clip Saving  │                   │  - Dashboard    │
│  - Light Sensor │                  │  - WiFi Upload  │                   │                 │
└─────────────────┘                  └─────────────────┘                   └─────────────────┘
```

## Hardware Requirements

### Raspberry Pi
- **Recommended**: Raspberry Pi 4 (2GB+ RAM) or Pi 5
- **Budget Option**: Raspberry Pi Zero 2 W
- MicroSD card (32GB+ recommended, Class 10 or better)
- Pi Camera Module v2 or v3 (or USB webcam)
- Power supply (5V 3A for Pi 4)

### Arduino
- Any Arduino (Uno, Nano, Mega) - WiFi NOT required!
- Sensors connected to Arduino:
  - GPS Module (NEO-6M)
  - Accelerometer (MPU6050)
  - LiDAR (VL53L0X or TFMini)
  - Light Sensor (LDR)

### Connection
- USB cable from Arduino to Raspberry Pi
- OR: GPIO UART (TX/RX pins)

## Software Setup

### 1. Raspberry Pi OS Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y python3-pip python3-opencv python3-picamera2

# Enable camera (if using Pi Camera)
sudo raspi-config
# Navigate to: Interface Options -> Camera -> Enable
```

### 2. Install Python Dependencies

```bash
cd raspberry_pi
pip3 install -r requirements.txt
```

### 3. Configure the Dashcam

Edit `dashcam.py` and update these settings:

```python
# Server URL - your Node.js server address
SERVER_URL = "http://192.168.1.100:3000"

# Arduino serial port
ARDUINO_PORT = "/dev/ttyUSB0"  # USB connection
# or
ARDUINO_PORT = "/dev/ttyACM0"  # Some Arduino boards
# or  
ARDUINO_PORT = "/dev/serial0"  # GPIO UART

# Video settings
VIDEO_WIDTH = 1280
VIDEO_HEIGHT = 720
VIDEO_FPS = 30
```

### 4. Find Arduino Serial Port

```bash
# List USB devices
ls /dev/tty*

# Or use dmesg after plugging in Arduino
dmesg | grep tty
```

### 5. Set Up Auto-Start (Optional)

Create a systemd service to start the dashcam on boot:

```bash
sudo nano /etc/systemd/system/dashcam.service
```

Add this content:

```ini
[Unit]
Description=Automotive IoT Dashcam
After=network.target

[Service]
ExecStart=/usr/bin/python3 /home/pi/AutomotiveIoTDatabase/raspberry_pi/dashcam.py
WorkingDirectory=/home/pi/AutomotiveIoTDatabase/raspberry_pi
User=pi
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable dashcam
sudo systemctl start dashcam

# Check status
sudo systemctl status dashcam

# View logs
journalctl -u dashcam -f
```

## Arduino Setup

### 1. Upload the Sketch

Upload `arduino_raspberry_pi.ino` to your Arduino.

### 2. Wire the Sensors

| Sensor | Arduino Pin |
|--------|-------------|
| GPS TX | Pin 4 (SoftwareSerial RX) |
| GPS RX | Pin 3 (SoftwareSerial TX) |
| LDR | A0 |
| MPU6050 SDA | A4 (or SDA) |
| MPU6050 SCL | A5 (or SCL) |
| VL53L0X SDA | A4 (shared I2C) |
| VL53L0X SCL | A5 (shared I2C) |

### 3. Install Arduino Libraries

In Arduino IDE, install:
- ArduinoJson
- TinyGPS++ (for GPS)
- Adafruit MPU6050 (for accelerometer)
- Adafruit VL53L0X (for LiDAR)

## Running the System

### Manual Start

```bash
# On Raspberry Pi
cd raspberry_pi
python3 dashcam.py
```

### What Happens

1. **Arduino** reads sensors at 10Hz and sends JSON over serial
2. **Raspberry Pi** receives sensor data and records video continuously
3. **On events** (harsh braking, follow distance violation):
   - Pi saves a 10-second clip (5s before + 5s after)
   - Pi uploads clip metadata to server
   - Pi sends event data to server
4. **Periodic** speed snapshots are sent to server

## Video Storage

- Clips are saved to `/home/pi/dashcam_clips/`
- Format: `{event_type}_{timestamp}.mp4`
- Auto-cleanup when storage exceeds 20GB (configurable)

## Troubleshooting

### Camera Not Working

```bash
# Test Pi Camera
libcamera-hello

# Check if camera is detected
vcgencmd get_camera
```

### Arduino Not Detected

```bash
# Check USB connection
lsusb

# Check serial ports
ls -la /dev/tty*

# Test serial communication
screen /dev/ttyUSB0 115200
```

### Permission Denied on Serial

```bash
# Add user to dialout group
sudo usermod -a -G dialout $USER
# Log out and back in
```

## Power Considerations

For car installation:
- Use a 12V to 5V buck converter (3A+ capacity)
- Consider a UPS HAT for graceful shutdown
- Add a "car off" detection to safely stop recording

## File Structure

```
raspberry_pi/
├── dashcam.py          # Main Python script
├── requirements.txt    # Python dependencies
└── README.md          # This file

Clips saved to:
/home/pi/dashcam_clips/
├── harsh_braking_20241202_143022.mp4
├── follow_distance_20241202_144515.mp4
└── ...
```
