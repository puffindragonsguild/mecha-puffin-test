// database.js
const Database = require('better-sqlite3');
const fs = require('fs');

// Ensure the data folder exists for Railway's volume
if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data');
}

// Create or connect to the database file
const db = new Database('./data/puffin.db');

// Create our sign-up table if it doesn't already exist
db.prepare(`
    CREATE TABLE IF NOT EXISTS signups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_user_id TEXT,
        character_name TEXT,
        vocation TEXT,
        level INTEGER,
        boss_choice TEXT,
        status TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

console.log("💾 Mecha-Puffin Memory Banks: ONLINE");

module.exports = db;
