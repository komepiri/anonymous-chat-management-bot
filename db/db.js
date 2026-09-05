const sqlite3 = require('better-sqlite3');
const path = require('path');

function createDatabase(dbFile = path.join(__dirname, 'database.db')) {
  const db = new sqlite3(dbFile);

  db.prepare(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    guild_number INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    content TEXT,
    UNIQUE(guild_id, guild_number)
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS message_counts (
    guild_id TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0,
    bot_message_id TEXT
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS webhooks (
    guild_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    webhook_id TEXT NOT NULL,
    webhook_token TEXT NOT NULL
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS suspensions (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    expires_at INTEGER,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
  )`).run();

  return db;
}

function reserveGuildNumber(db, guildId) {
  const existing = db.prepare('SELECT count FROM message_counts WHERE guild_id = ?').get(guildId);
  if (existing) {
    const next = existing.count + 1;
    db.prepare('UPDATE message_counts SET count = ? WHERE guild_id = ?').run(next, guildId);
    return next;
  }

  db.prepare('INSERT INTO message_counts (guild_id, count) VALUES (?, ?)').run(guildId, 1);
  return 1;
}

function rollbackGuildNumber(db, guildId) {
  const existing = db.prepare('SELECT count FROM message_counts WHERE guild_id = ?').get(guildId);
  if (!existing) {
    return 0;
  }

  const next = Math.max(0, existing.count - 1);
  db.prepare('UPDATE message_counts SET count = ? WHERE guild_id = ?').run(next, guildId);
  return next;
}

function createMessageRecord(db, { senderId, guildId, channelId, messageId, guildNumber, content }) {
  db.prepare(`
    INSERT INTO messages (sender_id, guild_id, channel_id, message_id, guild_number, content)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(senderId, guildId, channelId, messageId, guildNumber, content);
}

function getMessageByGuildNumber(db, guildId, guildNumber) {
  return db.prepare('SELECT * FROM messages WHERE guild_id = ? AND guild_number = ?').get(guildId, guildNumber);
}

function getMessageByDiscordMessageId(db, guildId, messageId) {
  return db.prepare('SELECT * FROM messages WHERE guild_id = ? AND message_id = ?').get(guildId, messageId);
}

function updateMessageContent(db, { guildId, messageId, content }) {
  return db.prepare('UPDATE messages SET content = ? WHERE guild_id = ? AND message_id = ?').run(content, guildId, messageId);
}

function deleteMessageRecord(db, { guildId, messageId }) {
  return db.prepare('DELETE FROM messages WHERE guild_id = ? AND message_id = ?').run(guildId, messageId);
}

function deleteMessagesForChannel(db, { guildId, channelId }) {
  return db.prepare('DELETE FROM messages WHERE guild_id = ? AND channel_id = ?').run(guildId, channelId);
}

function setBotMessageId(db, guildId, botMessageId) {
  const existing = db.prepare('SELECT 1 FROM message_counts WHERE guild_id = ?').get(guildId);
  if (existing) {
    db.prepare('UPDATE message_counts SET bot_message_id = ? WHERE guild_id = ?').run(botMessageId, guildId);
    return;
  }

  db.prepare('INSERT INTO message_counts (guild_id, bot_message_id) VALUES (?, ?)').run(guildId, botMessageId);
}

function getBotMessageId(db, guildId) {
  const row = db.prepare('SELECT bot_message_id FROM message_counts WHERE guild_id = ?').get(guildId);
  return row ? row.bot_message_id : null;
}

function upsertWebhook(db, { guildId, channelId, webhookId, webhookToken }) {
  db.prepare(`
    INSERT INTO webhooks (guild_id, channel_id, webhook_id, webhook_token)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      channel_id = excluded.channel_id,
      webhook_id = excluded.webhook_id,
      webhook_token = excluded.webhook_token
  `).run(guildId, channelId, webhookId, webhookToken);
}

function getWebhook(db, guildId) {
  return db.prepare('SELECT * FROM webhooks WHERE guild_id = ?').get(guildId);
}

function setSuspension(db, { guildId, userId, expiresAt, reason }) {
  db.prepare(`
    INSERT INTO suspensions (guild_id, user_id, expires_at, reason)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET
      expires_at = excluded.expires_at,
      reason = excluded.reason,
      created_at = CURRENT_TIMESTAMP
  `).run(guildId, userId, expiresAt, reason);
}

function getActiveSuspension(db, guildId, userId) {
  const row = db.prepare('SELECT * FROM suspensions WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
  if (!row) {
    return null;
  }

  if (row.expires_at !== null && row.expires_at <= Date.now()) {
    db.prepare('DELETE FROM suspensions WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
    return null;
  }

  return row;
}

function removeSuspension(db, guildId, userId) {
  db.prepare('DELETE FROM suspensions WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
}

const db = createDatabase();

module.exports = {
  createDatabase,
  reserveGuildNumber,
  rollbackGuildNumber,
  createMessageRecord,
  getMessageByGuildNumber,
  getMessageByDiscordMessageId,
  updateMessageContent,
  deleteMessageRecord,
  deleteMessagesForChannel,
  setBotMessageId,
  getBotMessageId,
  upsertWebhook,
  getWebhook,
  setSuspension,
  getActiveSuspension,
  removeSuspension,
  db,
};