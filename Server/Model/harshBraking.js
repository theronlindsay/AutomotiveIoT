const connection = require("./connection");

// Get all harsh braking events
async function selectAllEvents(params = {}) {
    let sql = `SELECT * FROM HarshBrakingEvents`;
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

    // Filter by severity
    if (params.severity) {
        whereStatements.push('severity = ?');
        queryParams.push(params.severity);
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

// Get event by ID
async function selectEventById(id) {
    const sql = `SELECT * FROM HarshBrakingEvents WHERE event_id = ?`;
    return await connection.query(sql, [id]);
}

// Add new harsh braking event (Arduino endpoint)
async function addEvent(params) {
    const sql = `INSERT INTO HarshBrakingEvents 
                 (event_timestamp, deceleration_rate, 
                  speed_before, speed_after, severity, light_condition) 
                 VALUES (?, ?, ?, ?, ?, ?)`;
    const queryParams = [
        params.event_timestamp || new Date(),
        params.deceleration_rate,
        params.speed_before,
        params.speed_after,
        params.severity || 'medium',
        params.light_condition || 'day'
    ];
    return await connection.query(sql, queryParams);
}

// Delete event
async function deleteEvent(id) {
    const sql = "DELETE FROM HarshBrakingEvents WHERE event_id = ?";
    return await connection.query(sql, [id]);
}

module.exports = {
    selectAllEvents,
    selectEventById,
    addEvent,
    deleteEvent
};
