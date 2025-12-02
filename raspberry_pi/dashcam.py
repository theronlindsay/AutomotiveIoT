#!/usr/bin/env python3
"""
Automotive IoT - Raspberry Pi Dashcam Controller

This script handles:
1. Continuous video recording with circular buffer
2. Event-triggered clip saving (harsh braking, follow distance violations)
3. Communication with Arduino for sensor data
4. Uploading clips and data to the server

Hardware Requirements:
- Raspberry Pi 3/4/5 or Pi Zero 2 W
- Pi Camera Module (v2 or v3) or USB webcam
- MicroSD card (32GB+ recommended)
- Serial connection to Arduino (USB or GPIO UART)

Installation:
    pip install picamera2 opencv-python requests pyserial

For Pi Camera, enable it with: sudo raspi-config -> Interface Options -> Camera
"""

import os
import json
import time
import threading
import requests
import serial
from datetime import datetime
from collections import deque
from pathlib import Path

# Try to import Pi Camera library, fall back to OpenCV for USB cameras
try:
    from picamera2 import Picamera2
    from picamera2.encoders import H264Encoder
    USE_PICAMERA = True
except ImportError:
    import cv2
    USE_PICAMERA = False
    print("PiCamera2 not found, using OpenCV for USB camera")

# ==================== CONFIGURATION ====================
SERVER_URL = "http://YOUR_SERVER_IP:3000"
ARDUINO_PORT = "/dev/ttyUSB0"  # or /dev/ttyACM0, /dev/serial0 for GPIO UART
ARDUINO_BAUD = 115200

# Video settings
VIDEO_WIDTH = 1280
VIDEO_HEIGHT = 720
VIDEO_FPS = 30
CLIP_DURATION = 10  # seconds for event clips
BUFFER_DURATION = 30  # seconds of video to keep in circular buffer

# Storage settings
CLIPS_FOLDER = Path("/home/pi/dashcam_clips")
MAX_STORAGE_GB = 20  # Auto-delete old clips when exceeded

# ==================== GLOBAL STATE ====================
current_location = {"latitude": 0.0, "longitude": 0.0}
recording_buffer = deque(maxlen=BUFFER_DURATION * VIDEO_FPS)
is_recording = True
arduino_serial = None


class DashcamRecorder:
    """Handles video recording and clip extraction."""
    
    def __init__(self):
        self.buffer = deque(maxlen=BUFFER_DURATION * VIDEO_FPS)
        self.lock = threading.Lock()
        self.is_recording = False
        self.camera = None
        
    def start(self):
        """Initialize camera and start recording to circular buffer."""
        CLIPS_FOLDER.mkdir(parents=True, exist_ok=True)
        
        if USE_PICAMERA:
            self._start_picamera()
        else:
            self._start_opencv()
    
    def _start_picamera(self):
        """Start recording with Pi Camera."""
        self.camera = Picamera2()
        config = self.camera.create_video_configuration(
            main={"size": (VIDEO_WIDTH, VIDEO_HEIGHT), "format": "RGB888"},
            controls={"FrameRate": VIDEO_FPS}
        )
        self.camera.configure(config)
        self.camera.start()
        self.is_recording = True
        
        # Start frame capture thread
        self.capture_thread = threading.Thread(target=self._capture_frames_picamera, daemon=True)
        self.capture_thread.start()
        print(f"Pi Camera started: {VIDEO_WIDTH}x{VIDEO_HEIGHT} @ {VIDEO_FPS}fps")
    
    def _start_opencv(self):
        """Start recording with USB camera via OpenCV."""
        self.camera = cv2.VideoCapture(0)
        self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, VIDEO_WIDTH)
        self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, VIDEO_HEIGHT)
        self.camera.set(cv2.CAP_PROP_FPS, VIDEO_FPS)
        self.is_recording = True
        
        # Start frame capture thread
        self.capture_thread = threading.Thread(target=self._capture_frames_opencv, daemon=True)
        self.capture_thread.start()
        print(f"USB Camera started: {VIDEO_WIDTH}x{VIDEO_HEIGHT} @ {VIDEO_FPS}fps")
    
    def _capture_frames_picamera(self):
        """Continuously capture frames from Pi Camera into buffer."""
        while self.is_recording:
            frame = self.camera.capture_array()
            timestamp = time.time()
            with self.lock:
                self.buffer.append((timestamp, frame))
            time.sleep(1 / VIDEO_FPS)
    
    def _capture_frames_opencv(self):
        """Continuously capture frames from USB camera into buffer."""
        while self.is_recording:
            ret, frame = self.camera.read()
            if ret:
                timestamp = time.time()
                with self.lock:
                    self.buffer.append((timestamp, frame))
            time.sleep(1 / VIDEO_FPS)
    
    def save_clip(self, event_type: str, seconds_before: int = 5, seconds_after: int = 5) -> str:
        """
        Save a video clip around the current moment.
        
        Args:
            event_type: Type of event (harsh_braking, follow_distance, speeding, manual)
            seconds_before: Seconds of footage before the event
            seconds_after: Seconds of footage after the event
            
        Returns:
            Path to the saved clip file
        """
        # Wait for "after" footage
        time.sleep(seconds_after)
        
        # Generate filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{event_type}_{timestamp}.mp4"
        filepath = CLIPS_FOLDER / filename
        
        # Get frames from buffer
        with self.lock:
            frames = list(self.buffer)
        
        # Calculate which frames to include
        total_frames = (seconds_before + seconds_after) * VIDEO_FPS
        if len(frames) > total_frames:
            frames = frames[-total_frames:]
        
        # Write video file
        if USE_PICAMERA:
            import cv2  # Still need OpenCV for video writing
        
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(str(filepath), fourcc, VIDEO_FPS, (VIDEO_WIDTH, VIDEO_HEIGHT))
        
        for _, frame in frames:
            # Convert RGB to BGR for OpenCV
            if USE_PICAMERA:
                frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
            out.write(frame)
        
        out.release()
        print(f"Saved clip: {filepath}")
        
        # Manage storage
        self._cleanup_old_clips()
        
        return str(filepath)
    
    def capture_screenshot(self, event_type: str) -> str:
        """Capture a single frame as a screenshot."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{event_type}_{timestamp}.jpg"
        filepath = CLIPS_FOLDER / filename
        
        with self.lock:
            if self.buffer:
                _, frame = self.buffer[-1]
                if USE_PICAMERA:
                    import cv2
                    frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
                cv2.imwrite(str(filepath), frame)
                print(f"Saved screenshot: {filepath}")
                return str(filepath)
        
        return ""
    
    def _cleanup_old_clips(self):
        """Delete old clips if storage exceeds limit."""
        total_size = sum(f.stat().st_size for f in CLIPS_FOLDER.glob("*") if f.is_file())
        total_size_gb = total_size / (1024 ** 3)
        
        if total_size_gb > MAX_STORAGE_GB:
            # Get files sorted by modification time (oldest first)
            files = sorted(CLIPS_FOLDER.glob("*"), key=lambda f: f.stat().st_mtime)
            
            while total_size_gb > MAX_STORAGE_GB * 0.8 and files:  # Delete until 80% of limit
                oldest = files.pop(0)
                total_size_gb -= oldest.stat().st_size / (1024 ** 3)
                oldest.unlink()
                print(f"Deleted old clip: {oldest}")
    
    def stop(self):
        """Stop recording and release camera."""
        self.is_recording = False
        if self.camera:
            if USE_PICAMERA:
                self.camera.stop()
            else:
                self.camera.release()


class ArduinoInterface:
    """Handles communication with Arduino over serial."""
    
    def __init__(self, port: str, baud: int):
        self.port = port
        self.baud = baud
        self.serial = None
        self.is_connected = False
        
    def connect(self):
        """Establish serial connection to Arduino."""
        try:
            self.serial = serial.Serial(self.port, self.baud, timeout=1)
            time.sleep(2)  # Wait for Arduino to reset
            self.is_connected = True
            print(f"Connected to Arduino on {self.port}")
            return True
        except serial.SerialException as e:
            print(f"Failed to connect to Arduino: {e}")
            return False
    
    def read_sensor_data(self) -> dict:
        """Read sensor data from Arduino."""
        if not self.is_connected:
            return {}
        
        try:
            if self.serial.in_waiting:
                line = self.serial.readline().decode('utf-8').strip()
                if line.startswith('{'):
                    return json.loads(line)
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            print(f"Error parsing Arduino data: {e}")
        
        return {}
    
    def close(self):
        """Close serial connection."""
        if self.serial:
            self.serial.close()
            self.is_connected = False


class ServerInterface:
    """Handles communication with the Node.js server."""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
        
    def upload_clip(self, filepath: str, event_type: str, latitude: float, longitude: float) -> bool:
        """Upload a media clip to the server."""
        try:
            # First, register the clip metadata
            data = {
                "latitude": latitude,
                "longitude": longitude,
                "media_type": "video_clip" if filepath.endswith(".mp4") else "screenshot",
                "file_path": filepath,
                "duration_seconds": CLIP_DURATION if filepath.endswith(".mp4") else 0,
                "event_type": event_type,
                "file_size_bytes": os.path.getsize(filepath)
            }
            
            response = requests.post(
                f"{self.base_url}/api/media-clips",
                json=data,
                timeout=10
            )
            
            if response.status_code == 201:
                print(f"Clip registered with server: {filepath}")
                return True
            else:
                print(f"Failed to register clip: {response.status_code}")
                return False
                
        except requests.RequestException as e:
            print(f"Error uploading clip: {e}")
            return False
    
    def send_sensor_data(self, data: dict) -> bool:
        """Send sensor data to the server."""
        try:
            response = requests.post(
                f"{self.base_url}/api/arduino/sensor-data",
                json=data,
                timeout=5
            )
            return response.status_code == 200
        except requests.RequestException:
            return False
    
    def send_harsh_braking(self, data: dict) -> bool:
        """Send harsh braking event to the server."""
        try:
            response = requests.post(
                f"{self.base_url}/api/harsh-braking",
                json=data,
                timeout=5
            )
            return response.status_code == 201
        except requests.RequestException:
            return False
    
    def send_follow_distance(self, data: dict) -> bool:
        """Send follow distance violation to the server."""
        try:
            response = requests.post(
                f"{self.base_url}/api/follow-distance",
                json=data,
                timeout=5
            )
            return response.status_code == 201
        except requests.RequestException:
            return False


def main():
    """Main entry point."""
    global current_location
    
    print("=" * 50)
    print("Automotive IoT Dashcam - Raspberry Pi")
    print("=" * 50)
    
    # Initialize components
    recorder = DashcamRecorder()
    arduino = ArduinoInterface(ARDUINO_PORT, ARDUINO_BAUD)
    server = ServerInterface(SERVER_URL)
    
    # Start recording
    recorder.start()
    
    # Connect to Arduino
    arduino_connected = arduino.connect()
    
    print("\nDashcam running. Press Ctrl+C to stop.\n")
    
    try:
        while True:
            # Read sensor data from Arduino
            if arduino_connected:
                sensor_data = arduino.read_sensor_data()
                
                if sensor_data:
                    # Update current location
                    current_location["latitude"] = sensor_data.get("latitude", 0)
                    current_location["longitude"] = sensor_data.get("longitude", 0)
                    
                    # Check for events that need video clips
                    if sensor_data.get("harsh_braking_detected"):
                        print("🚨 HARSH BRAKING - Saving clip...")
                        
                        # Save clip in background thread
                        def save_and_upload():
                            clip_path = recorder.save_clip("harsh_braking", seconds_before=5, seconds_after=5)
                            server.upload_clip(
                                clip_path, 
                                "harsh_braking",
                                current_location["latitude"],
                                current_location["longitude"]
                            )
                            server.send_harsh_braking(sensor_data)
                        
                        threading.Thread(target=save_and_upload, daemon=True).start()
                    
                    if sensor_data.get("follow_distance_violation"):
                        print("⚠️ FOLLOW DISTANCE VIOLATION - Saving clip...")
                        
                        def save_and_upload():
                            clip_path = recorder.save_clip("follow_distance", seconds_before=3, seconds_after=3)
                            server.upload_clip(
                                clip_path,
                                "follow_distance", 
                                current_location["latitude"],
                                current_location["longitude"]
                            )
                            server.send_follow_distance(sensor_data)
                        
                        threading.Thread(target=save_and_upload, daemon=True).start()
                    
                    # Send periodic sensor data
                    server.send_sensor_data(sensor_data)
            
            time.sleep(0.1)  # 10Hz loop
            
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        recorder.stop()
        arduino.close()
        print("Dashcam stopped.")


if __name__ == "__main__":
    main()
