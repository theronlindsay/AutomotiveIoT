const db = require("./connection");

/**
 * Gets the username from the database.
 * If no user is found, it creates a default user with the username 'user'.
 *
 * @returns {Promise<string>} The username.
 */
async function getUsername() {
    let [rows] = await db.query('SELECT username FROM UserSettings WHERE id = 1', []);
    
    if (rows.length === 0) {
        // No user found, create a default one
        await db.query('INSERT INTO UserSettings (id, username) VALUES (1, ?)', ['user']);
        return 'user';
    }
    
    return rows[0].username;
}

/**
 * Updates the username in the database.
 *
 * @param {string} newUsername The new username.
 * @returns {Promise<void>}
 */
async function updateUsername(newUsername) {
    await db.query('UPDATE UserSettings SET username = ? WHERE id = 1', [newUsername]);
}

module.exports = {
    getUsername,
    updateUsername
};