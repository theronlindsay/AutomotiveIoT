/**
 * Alexa Skill Intent Handlers for Automotive IoT
 * 
 * This module exports intent handlers that can be used with the Alexa Skills Kit.
 * Each handler queries the server's API endpoints and returns speech responses.
 * 
 * Intents:
 * - GetTimeOfDayIntent: What time of day is it?
 * - GetAbruptStopsIntent: How many abrupt stops have been had?
 * - GetFollowDistanceViolationsIntent: How many instances of unsafe follow distance?
 * - IsCarMovingIntent: Is the car in motion?
 * - GetCarSpeedIntent: How fast is the car going?
 * - ClearAllDataIntent: Clear all data from the tables
 * - SetUsernameIntent: Set the user's name
 */
/**
 * Intent: Set the user's name
 * Sets the username in the database via API
 * @param {string} name - The new username to set
 */
async function handleSetUsernameIntent(name) {
    if (!name || typeof name !== 'string' || name.trim() === '') {
        return {
            speechText: "Please provide a valid name to set.",
            success: false
        };
    }
    try {
        const response = await fetch(`${BASE_URL}/api/username`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim() })
        });
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        return {
            speechText: `Your name has been set to ${name.trim()}.`,
            success: true,
            data: { name: name.trim() }
        };
    } catch (error) {
        console.error('Error in SetUsernameIntent:', error);
        return {
            speechText: "Sorry, I couldn't set your name. Please try again later.",
            success: false
        };
    }
}

const BASE_URL = 'https://auto.theronlindsay.dev';

// Helper function to fetch data from API
async function fetchAPI(endpoint) {
    const response = await fetch(`${BASE_URL}${endpoint}`);
    if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
    }
    return response.json();
}

// Helper function to mark records as reviewed
async function markAsReviewed(table, ids) {
    if (!ids || ids.length === 0) return;
    
    try {
        await fetch(`${BASE_URL}/api/mark-reviewed`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table, ids })
        });
    } catch (error) {
        console.error(`Error marking ${table} as reviewed:`, error);
    }
}

// Helper function to determine time of day from light condition
function getTimeOfDayDescription(lightCondition) {
    switch (lightCondition) {
        case 'day':
            return 'daytime';
        case 'night':
            return 'nighttime';
        case 'dawn':
            return 'dawn, early morning';
        case 'dusk':
            return 'dusk, early evening';
        default:
            return 'unknown';
    }
}

/**
 * Intent: What time of day is it?
 * Uses the most recent speed snapshot's light_condition field
 */
async function handleGetTimeOfDayIntent() {
    try {
        const snapshots = await fetchAPI('/api/speed-snapshots?limit=1');
        
        if (!snapshots || snapshots.length === 0) {
            return {
                speechText: "I don't have any sensor data to determine the time of day.",
                success: false
            };
        }
        
        const latestSnapshot = snapshots[0];
        const timeOfDay = getTimeOfDayDescription(latestSnapshot.light_condition);
        
        // Mark the accessed snapshot as reviewed
        await markAsReviewed('SpeedSnapshots', [latestSnapshot.snapshot_id]);
        
        return {
            speechText: `Based on the light sensor, it appears to be ${timeOfDay}.`,
            success: true,
            data: { lightCondition: latestSnapshot.light_condition }
        };
    } catch (error) {
        console.error('Error in GetTimeOfDayIntent:', error);
        return {
            speechText: "Sorry, I couldn't determine the time of day. Please try again later.",
            success: false
        };
    }
}

/**
 * Intent: How many abrupt stops have been had?
 * Counts all harsh braking events from the database
 */
async function handleGetAbruptStopsIntent() {
    try {
        const harshBrakingEvents = await fetchAPI('/api/harsh-braking');
        
        const count = harshBrakingEvents ? harshBrakingEvents.length : 0;
        
        if (count === 0) {
            return {
                speechText: "Great news! There have been no abrupt stops recorded.",
                success: true,
                data: { count: 0 }
            };
        }
        
        // Mark all accessed events as reviewed
        const eventIds = harshBrakingEvents.map(e => e.event_id);
        await markAsReviewed('HarshBrakingEvents', eventIds);
        
        const eventWord = count === 1 ? 'abrupt stop' : 'abrupt stops';
        return {
            speechText: `There have been ${count} ${eventWord} recorded.`,
            success: true,
            data: { count }
        };
    } catch (error) {
        console.error('Error in GetAbruptStopsIntent:', error);
        return {
            speechText: "Sorry, I couldn't retrieve the abrupt stop count. Please try again later.",
            success: false
        };
    }
}

/**
 * Intent: How many instances of unsafe follow distance have been recorded?
 * Counts all follow distance violations from the database
 */
async function handleGetFollowDistanceViolationsIntent() {
    try {
        const violations = await fetchAPI('/api/follow-distance');
        
        const count = violations ? violations.length : 0;
        
        if (count === 0) {
            return {
                speechText: "Great news! There have been no unsafe follow distance instances recorded.",
                success: true,
                data: { count: 0 }
            };
        }
        
        // Mark all accessed violations as reviewed
        const violationIds = violations.map(v => v.violation_id);
        await markAsReviewed('FollowDistanceViolations', violationIds);
        
        const instanceWord = count === 1 ? 'instance' : 'instances';
        return {
            speechText: `There have been ${count} ${instanceWord} of unsafe follow distance recorded.`,
            success: true,
            data: { count }
        };
    } catch (error) {
        console.error('Error in GetFollowDistanceViolationsIntent:', error);
        return {
            speechText: "Sorry, I couldn't retrieve the follow distance violations. Please try again later.",
            success: false
        };
    }
}

/**
 * Intent: Is the car in motion?
 * Checks the most recent speed snapshot to determine if car is moving
 */
async function handleIsCarMovingIntent() {
    try {
        const snapshots = await fetchAPI('/api/speed-snapshots?limit=1');
        
        if (!snapshots || snapshots.length === 0) {
            return {
                speechText: "I don't have any recent data to determine if the car is in motion.",
                success: false
            };
        }
        
        const latestSnapshot = snapshots[0];
        const speed = parseFloat(latestSnapshot.speed_mph) || 0;
        
        // Mark the accessed snapshot as reviewed
        await markAsReviewed('SpeedSnapshots', [latestSnapshot.snapshot_id]);
        
        // Consider car in motion if speed > 1 mph (to account for sensor noise)
        const isMoving = speed > 1;
        
        if (isMoving) {
            return {
                speechText: `Yes, the car is in motion at ${speed.toFixed(1)} miles per hour.`,
                success: true,
                data: { isMoving: true, speed }
            };
        } else {
            return {
                speechText: "No, the car appears to be stationary.",
                success: true,
                data: { isMoving: false, speed }
            };
        }
    } catch (error) {
        console.error('Error in IsCarMovingIntent:', error);
        return {
            speechText: "Sorry, I couldn't determine if the car is in motion. Please try again later.",
            success: false
        };
    }
}

/**
 * Intent: How fast is the car going?
 * Returns the current speed from the most recent speed snapshot
 */
async function handleGetCarSpeedIntent() {
    try {
        const snapshots = await fetchAPI('/api/speed-snapshots?limit=1');
        
        if (!snapshots || snapshots.length === 0) {
            return {
                speechText: "I don't have any recent speed data available.",
                success: false
            };
        }
        
        const latestSnapshot = snapshots[0];
        const speed = parseFloat(latestSnapshot.speed_mph) || 0;
        
        // Mark the accessed snapshot as reviewed
        await markAsReviewed('SpeedSnapshots', [latestSnapshot.snapshot_id]);
        
        if (speed < 1) {
            return {
                speechText: "The car is currently stationary.",
                success: true,
                data: { speed: 0 }
            };
        }
        
        return {
            speechText: `The car is currently traveling at ${speed.toFixed(1)} miles per hour.`,
            success: true,
            data: { speed }
        };
    } catch (error) {
        console.error('Error in GetCarSpeedIntent:', error);
        return {
            speechText: "Sorry, I couldn't retrieve the current speed. Please try again later.",
            success: false
        };
    }
}

/**
 * Intent: Clear all data from the tables
 * Deletes all records from HarshBrakingEvents, FollowDistanceViolations, and SpeedSnapshots
 */
async function handleClearAllDataIntent() {
    try {
        const response = await fetch(`${BASE_URL}/api/clear-data`);
        
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        
        const result = await response.json();
        
        return {
            speechText: "All driving data has been cleared successfully. The harsh braking events, follow distance violations, and speed snapshots have been deleted.",
            success: true,
            data: result
        };
    } catch (error) {
        console.error('Error in ClearAllDataIntent:', error);
        return {
            speechText: "Sorry, I couldn't clear the data. Please try again later.",
            success: false
        };
    }
}

/**
 * Main intent router - routes Alexa intents to appropriate handlers
 * @param {string} intentName - The name of the Alexa intent
 * @returns {object} Response object with speechText
 */
async function handleIntent(intentName) {
    switch (intentName) {
        case 'GetTimeOfDayIntent':
            return await handleGetTimeOfDayIntent();
        case 'GetAbruptStopsIntent':
            return await handleGetAbruptStopsIntent();
        case 'GetFollowDistanceViolationsIntent':
            return await handleGetFollowDistanceViolationsIntent();
        case 'IsCarMovingIntent':
            return await handleIsCarMovingIntent();
        case 'GetCarSpeedIntent':
            return await handleGetCarSpeedIntent();
        case 'ClearAllDataIntent':
            return await handleClearAllDataIntent();
        case 'SetUsernameIntent':
            // For Alexa, the name should be passed as a slot value, e.g., intent.slots.name.value
            // Here, you would extract the name from the intent request in your Alexa skill code
            // For demonstration, we'll use a placeholder
            return await handleSetUsernameIntent('Driver');
        default:
            return {
                speechText: "I'm not sure how to handle that request.",
                success: false
            };
    }
}

// Export all handlers
module.exports = {
    handleIntent,
    handleGetTimeOfDayIntent,
    handleGetAbruptStopsIntent,
    handleGetFollowDistanceViolationsIntent,
    handleIsCarMovingIntent,
    handleGetCarSpeedIntent,
    handleClearAllDataIntent,
    handleSetUsernameIntent
};
