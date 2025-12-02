const connection = require("./connection");

// Get all media clips
async function selectAllClips(params = {}) {
    let sql = `SELECT * FROM MediaClips`;
    const queryParams = [];
    const whereStatements = [];

    // Filter by media type
    if (params.media_type) {
        whereStatements.push('media_type = ?');
        queryParams.push(params.media_type);
    }

    // Filter by event type
    if (params.event_type) {
        whereStatements.push('event_type = ?');
        queryParams.push(params.event_type);
    }

    // Filter by date range
    if (params.start_date) {
        whereStatements.push('capture_timestamp >= ?');
        queryParams.push(params.start_date);
    }
    if (params.end_date) {
        whereStatements.push('capture_timestamp <= ?');
        queryParams.push(params.end_date);
    }

    if (whereStatements.length > 0) {
        sql += ' WHERE ' + whereStatements.join(' AND ');
    }

    sql += ' ORDER BY capture_timestamp DESC';

    // LIMIT must be embedded directly (not as parameter) for MySQL execute()
    const limit = parseInt(params.limit) || 100;
    sql += ` LIMIT ${limit}`;

    return await connection.query(sql, queryParams);
}

// Get clip by ID
async function selectClipById(id) {
    const sql = `SELECT * FROM MediaClips WHERE clip_id = ?`;
    return await connection.query(sql, [id]);
}

// Add new media clip reference (Arduino/Camera endpoint)
async function addClip(params) {
    const sql = `INSERT INTO MediaClips 
                 (capture_timestamp, latitude, longitude, media_type, 
                  file_path, duration_seconds, event_type, event_id, file_size_bytes) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const queryParams = [
        params.capture_timestamp || new Date(),
        params.latitude,
        params.longitude,
        params.media_type, // 'screenshot' or 'video_clip'
        params.file_path,
        params.duration_seconds || null,
        params.event_type || null, // 'harsh_braking', 'follow_distance', 'speeding', 'manual'
        params.event_id || null,
        params.file_size_bytes || null
    ];
    return await connection.query(sql, queryParams);
}

// Delete clip
async function deleteClip(id) {
    const sql = "DELETE FROM MediaClips WHERE clip_id = ?";
    return await connection.query(sql, [id]);
}

module.exports = {
    selectAllClips,
    selectClipById,
    addClip,
    deleteClip
};
