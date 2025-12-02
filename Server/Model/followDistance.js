const connection = require("./connection");

// Get all follow distance violations
async function selectAllViolations(params = {}) {
    let sql = `SELECT * FROM FollowDistanceViolations`;
    const queryParams = [];
    const whereStatements = [];

    // Filter by date range
    if (params.start_date) {
        whereStatements.push('event_timestamp >= ?');
        queryParams.push(params.start_date);
    }
    if (params.end_date) {
        whereStatements.push('event_timestamp <= ?');
        queryParams.push(params.end_date);
    }

    if (whereStatements.length > 0) {
        sql += ' WHERE ' + whereStatements.join(' AND ');
    }

    sql += ' ORDER BY event_timestamp DESC';

    // LIMIT must be embedded directly (not as parameter) for MySQL execute()
    const limit = parseInt(params.limit) || 100;
    sql += ` LIMIT ${limit}`;

    return await connection.query(sql, queryParams);
}

// Get violation by ID
async function selectViolationById(id) {
    const sql = `SELECT * FROM FollowDistanceViolations WHERE violation_id = ?`;
    return await connection.query(sql, [id]);
}

// Add new follow distance violation (Arduino endpoint)
async function addViolation(params) {
    const sql = `INSERT INTO FollowDistanceViolations 
                 (event_timestamp, latitude, longitude, distance_meters, 
                  current_speed, required_distance, duration_seconds, light_condition) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    const queryParams = [
        params.event_timestamp || new Date(),
        params.latitude,
        params.longitude,
        params.distance_meters,
        params.current_speed,
        params.required_distance,
        params.duration_seconds,
        params.light_condition || 'day'
    ];
    return await connection.query(sql, queryParams);
}

// Delete violation
async function deleteViolation(id) {
    const sql = "DELETE FROM FollowDistanceViolations WHERE violation_id = ?";
    return await connection.query(sql, [id]);
}

module.exports = {
    selectAllViolations,
    selectViolationById,
    addViolation,
    deleteViolation
};
