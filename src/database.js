require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'aliases.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alias TEXT UNIQUE NOT NULL,
    primary_email TEXT NOT NULL,
    description TEXT,
    usage_location TEXT,
    validity_datetime DATETIME,
    validity_days INTEGER,
    used INTEGER DEFAULT 0,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME,
    color TEXT
  );

  CREATE TABLE IF NOT EXISTS daily_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    date DATE DEFAULT (date('now')),
    count INTEGER DEFAULT 0,
    UNIQUE(user_email, date)
  );

  CREATE TABLE IF NOT EXISTS used_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

function generateAlias(project, domain = 'outlook.com') {
  const cleanProject = project.toLowerCase().replace(/[^a-z0-9]/g, '');
  const usedEmails = getAllUsedEmails();
  
  let alias = `${cleanProject}@${domain}`;
  let counter = 1;
  
  while (usedEmails.includes(alias)) {
    alias = `${cleanProject}${counter}@${domain}`;
    counter++;
    if (counter > 100) {
      const timestamp = Date.now().toString().slice(-4);
      alias = `${cleanProject}.${timestamp}@${domain}`;
      break;
    }
  }
  
  return alias;
}

function getDailyUsageCount(userEmail) {
  const row = db.prepare(`
    SELECT count FROM daily_usage 
    WHERE user_email = ? AND date = date('now')
  `).get(userEmail);
  return row ? row.count : 0;
}

function incrementDailyUsage(userEmail) {
  db.prepare(`
    INSERT INTO daily_usage (user_email, count) VALUES (?, 1)
    ON CONFLICT(user_email, date) DO UPDATE SET count = count + 1
  `).run(userEmail);
}

function getAllUsedEmails() {
  return db.prepare(`SELECT email FROM used_emails`).all().map(r => r.email);
}

function markEmailAsUsed(email) {
  try {
    db.prepare(`INSERT INTO used_emails (email) VALUES (?)`).run(email);
  } catch (e) {}
}

function logAlias(alias, primaryEmail, description, usageLocation, validityDays, createdBy) {
  let validityDatetime = null;
  
  if (validityDays) {
    const validityDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
    const year = validityDate.getFullYear();
    const month = String(validityDate.getMonth() + 1).padStart(2, '0');
    const day = String(validityDate.getDate()).padStart(2, '0');
    const hours = String(validityDate.getHours()).padStart(2, '0');
    const minutes = String(validityDate.getMinutes()).padStart(2, '0');
    const seconds = String(validityDate.getSeconds()).padStart(2, '0');
    validityDatetime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
  
  db.prepare(`
    INSERT INTO aliases (alias, primary_email, description, usage_location, validity_datetime, validity_days, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(alias, primaryEmail, description, usageLocation, validityDatetime, validityDays, createdBy);
}

function markAliasAsUsed(aliasId, usageLocation) {
  db.prepare(`
    UPDATE aliases SET used = 1, used_at = datetime('now'), usage_location = ?
    WHERE id = ?
  `).run(usageLocation, aliasId);
  
  const alias = db.prepare(`SELECT alias FROM aliases WHERE id = ?`).get(aliasId);
  if (alias) {
    markEmailAsUsed(alias.alias);
  }
}

function getTodayAliases(userEmail) {
  return db.prepare(`
    SELECT * FROM aliases 
    WHERE created_by = ? AND date(created_at) = date('now')
    ORDER BY created_at DESC
  `).all(userEmail);
}

function getAllAliases() {
  return db.prepare(`SELECT * FROM aliases ORDER BY created_at DESC`).all();
}

function getExpiredAliases() {
  return db.prepare(`
    SELECT * FROM aliases 
    WHERE validity_datetime IS NOT NULL 
    AND validity_datetime < datetime('now')
    AND used = 0
  `).all();
}

function getDailyUsageStats() {
  return db.prepare(`
    SELECT 
      COUNT(*) as total_aliases,
      COUNT(DISTINCT date(created_at)) as days_used,
      COUNT(DISTINCT created_by) as total_users,
      SUM(CASE WHEN used = 1 THEN 1 ELSE 0 END) as used_count
    FROM aliases
  `).get();
}

function getAliasById(id) {
  return db.prepare(`SELECT * FROM aliases WHERE id = ?`).get(id);
}

function deleteAlias(id) {
  const alias = getAliasById(id);
  if (alias) {
    db.prepare(`DELETE FROM aliases WHERE id = ?`).run(id);
    return true;
  }
  return false;
}

function updateAlias(id, description) {
  db.prepare(`UPDATE aliases SET description = ? WHERE id = ?`).run(description, id);
  return true;
}

function updateAliasColor(id, color) {
  db.prepare(`UPDATE aliases SET color = ? WHERE id = ?`).run(color, id);
  return true;
}

function clearUsedEmails() {
  db.prepare(`DELETE FROM used_emails`).run();
}

function resetDailyUsage() {
  db.prepare(`DELETE FROM daily_usage`).run();
}

module.exports = {
  generateAlias,
  getDailyUsageCount,
  incrementDailyUsage,
  getAllUsedEmails,
  logAlias,
  markAliasAsUsed,
  getTodayAliases,
  getAllAliases,
  getExpiredAliases,
  getDailyUsageStats,
  getAliasById,
  deleteAlias,
  clearUsedEmails,
  resetDailyUsage,
  updateAlias,
  updateAliasColor
};
