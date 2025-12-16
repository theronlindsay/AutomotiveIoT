-- =====================================================
-- Automotive IoT Database Schema (Single User)
-- Run this SQL to create the required tables
-- =====================================================

-- Harsh Braking Events - detected by accelerometer/LiDAR
CREATE TABLE IF NOT EXISTS HarshBrakingEvents (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deceleration_rate DECIMAL(6, 2) NOT NULL,    -- m/s² from accelerometer
    speed_before DECIMAL(6, 2),                  -- mph before braking
    speed_after DECIMAL(6, 2),                   -- mph after braking
    severity ENUM('low', 'medium', 'high') DEFAULT 'medium',
    light_condition ENUM('day', 'night', 'dawn', 'dusk') DEFAULT 'day',
    reviewed TINYINT(1) DEFAULT 0                -- 1 if reviewed via Alexa
);

-- Follow Distance Violations - detected by LiDAR
CREATE TABLE IF NOT EXISTS FollowDistanceViolations (
    violation_id INT AUTO_INCREMENT PRIMARY KEY,
    event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    distance_meters DECIMAL(6, 2) NOT NULL,      -- Distance to vehicle ahead (LiDAR)
    current_speed DECIMAL(6, 2),                 -- Current speed in mph
    required_distance DECIMAL(6, 2),             -- Safe following distance based on speed
    duration_seconds INT,                        -- How long violation lasted
    light_condition ENUM('day', 'night', 'dawn', 'dusk') DEFAULT 'day',
    reviewed TINYINT(1) DEFAULT 0                -- 1 if reviewed via Alexa
);

-- Speed Snapshots - recorded every few seconds
CREATE TABLE IF NOT EXISTS SpeedSnapshots (
    snapshot_id INT AUTO_INCREMENT PRIMARY KEY,
    snapshot_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    speed_mph DECIMAL(6, 2) NOT NULL,            -- Current speed
    speed_limit DECIMAL(6, 2),                   -- Speed limit
    is_speeding TINYINT(1) DEFAULT 0,            -- 1 if over speed limit
    acceleration DECIMAL(6, 2),                  -- Current acceleration (m/s²)
    heading DECIMAL(5, 2),                       -- Direction in degrees (0-360)
    light_condition ENUM('day', 'night', 'dawn', 'dusk') DEFAULT 'day',
    reviewed TINYINT(1) DEFAULT 0                -- 1 if reviewed via Alexa
);

-- Create indexes for better query performance
CREATE INDEX idx_harsh_braking_timestamp ON HarshBrakingEvents(event_timestamp);
CREATE INDEX idx_follow_distance_timestamp ON FollowDistanceViolations(event_timestamp);
CREATE INDEX idx_speed_snapshots_timestamp ON SpeedSnapshots(snapshot_timestamp);

-- User Information (Single User)
CREATE TABLE IF NOT EXISTS Users (
    user_id INT PRIMARY KEY DEFAULT 1,
    username VARCHAR(255) NOT NULL,
    CONSTRAINT single_user_check CHECK (user_id = 1)
);
