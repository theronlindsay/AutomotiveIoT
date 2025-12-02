const connection = require("./connection");

// Get all speed snapshots
async function selectAllSnapshots(params = {}) {
    let sql = `SELECT * FROM SpeedSnapshots`;
    const queryParams = [];
    const whereStatements = [];

    // Filter by date range
    if (params.start_date) {
        whereStatements.push('snapshot_timestamp >= ?');
        queryParams.push(params.start_date);
    }
    if (params.end_date) {
        whereStatements.push('snapshot_timestamp <= ?');
        queryParams.push(params.end_date);
    }

    // Filter by speeding only
    if (params.speeding_only === 'true') {
        whereStatements.push('is_speeding = 1');
    }

    if (whereStatements.length > 0) {
        sql += ' WHERE ' + whereStatements.join(' AND ');
    }

    sql += ' ORDER BY snapshot_timestamp DESC';

    // LIMIT must be embedded directly (not as parameter) for MySQL execute()
    const limit = parseInt(params.limit) || 100;
    sql += ` LIMIT ${limit}`;

    return await connection.query(sql, queryParams);
}

// Get snapshot by ID
async function selectSnapshotById(id) {
    const sql = `SELECT * FROM SpeedSnapshots WHERE snapshot_id = ?`;
    return await connection.query(sql, [id]);
}

// Add new speed snapshot (Arduino endpoint - called every few seconds)
async function addSnapshot(params) {
    const sql = `INSERT INTO SpeedSnapshots 
                 (snapshot_timestamp, latitude, longitude, speed_mph, 
                  speed_limit, is_speeding, acceleration, heading, light_condition) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const isSpeeding = params.speed_mph > (params.speed_limit || 65) ? 1 : 0;
    const queryParams = [
        params.snapshot_timestamp || new Date(),
        params.latitude,
        params.longitude,
        params.speed_mph,
        params.speed_limit || null,
        isSpeeding,
        params.acceleration || null,
        params.heading || null,
        params.light_condition || 'day'
    ];
    return await connection.query(sql, queryParams);
}

// Batch insert speed snapshots (more efficient for Arduino)
async function addSnapshotsBatch(snapshots) {
    if (!snapshots || snapshots.length === 0) return { affectedRows: 0 };
    
    const sql = `INSERT INTO SpeedSnapshots 
                 (snapshot_timestamp, latitude, longitude, speed_mph, 
                  speed_limit, is_speeding, acceleration, heading, light_condition) 
                 VALUES ?`;
    
    const values = snapshots.map(s => [
        s.snapshot_timestamp || new Date(),
        s.latitude,
        s.longitude,
        s.speed_mph,
        s.speed_limit || null,
        s.speed_mph > (s.speed_limit || 65) ? 1 : 0,
        s.acceleration || null,
        s.heading || null,
        s.light_condition || 'day'
    ]);
    
    return await connection.query(sql, [values]);
}

// Delete snapshot
async function deleteSnapshot(id) {
    const sql = "DELETE FROM SpeedSnapshots WHERE snapshot_id = ?";
    return await connection.query(sql, [id]);
}

module.exports = {
    selectAllSnapshots,
    selectSnapshotById,
    addSnapshot,
    addSnapshotsBatch,
    deleteSnapshot
};
