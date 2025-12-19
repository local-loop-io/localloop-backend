const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function ensureDirectory(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createDatabase(databasePath) {
  ensureDirectory(databasePath);
  const db = new Database(databasePath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS interests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      organization TEXT,
      role TEXT,
      country TEXT,
      city TEXT,
      website TEXT,
      email TEXT,
      message TEXT,
      share_email INTEGER NOT NULL DEFAULT 0,
      public_listing INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS interests_created_at ON interests(created_at);
  `);

  const insertStmt = db.prepare(`
    INSERT INTO interests (
      name,
      organization,
      role,
      country,
      city,
      website,
      email,
      message,
      share_email,
      public_listing,
      created_at
    ) VALUES (
      @name,
      @organization,
      @role,
      @country,
      @city,
      @website,
      @email,
      @message,
      @share_email,
      1,
      @created_at
    )
  `);

  const listStmt = db.prepare(`
    SELECT
      id,
      name,
      organization,
      role,
      country,
      city,
      website,
      CASE WHEN share_email = 1 THEN email ELSE NULL END AS email,
      message,
      created_at
    FROM interests
    WHERE public_listing = 1
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const countStmt = db.prepare('SELECT COUNT(*) as total FROM interests WHERE public_listing = 1');

  function insertInterest(data) {
    const createdAt = new Date().toISOString();
    const payload = {
      ...data,
      organization: data.organization || null,
      role: data.role || null,
      country: data.country || null,
      city: data.city || null,
      website: data.website || null,
      email: data.email || null,
      message: data.message || null,
      share_email: data.shareEmail ? 1 : 0,
      created_at: createdAt,
    };

    const info = insertStmt.run(payload);
    return { id: info.lastInsertRowid, created_at: createdAt };
  }

  function listInterests(limit) {
    return listStmt.all(limit);
  }

  function countInterests() {
    const row = countStmt.get();
    return row ? row.total : 0;
  }

  return { db, insertInterest, listInterests, countInterests };
}

module.exports = { createDatabase };
