import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "./config.js";

let db: Database.Database;

export function getDb(): Database.Database {
  if (db) return db;

  const dbDir = path.dirname(config.DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      group_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS group_state (
      group_id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cron TEXT NOT NULL,
      skill TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);
}

export function saveMessage(sessionId: string, role: "user" | "assistant" | "system", content: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)
  `).run(sessionId, role, content);
}

export function getMessageHistory(sessionId: string, limit = 20): Array<{ role: string; content: string }> {
  const db = getDb();
  return db.prepare(`
    SELECT role, content FROM messages
    WHERE session_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(sessionId, limit).reverse() as Array<{ role: string; content: string }>;
}

export function getOrCreateSession(groupId: string, channel: string): string {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM sessions WHERE group_id = ? AND channel = ?").get(groupId, channel) as { id: string } | undefined;
  if (existing) return existing.id;

  const id = `${channel}-${groupId}-${Date.now()}`;
  db.prepare("INSERT INTO sessions (id, channel, group_id) VALUES (?, ?, ?)").run(id, channel, groupId);
  return id;
}

export function updateGroupState(groupId: string, channel: string, metadata: Record<string, unknown>): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO group_state (group_id, channel, metadata, updated_at)
    VALUES (?, ?, ?, strftime('%s','now'))
    ON CONFLICT(group_id) DO UPDATE SET
      metadata = excluded.metadata,
      updated_at = excluded.updated_at
  `).run(groupId, channel, JSON.stringify(metadata));
}

export function getGroupState(groupId: string): Record<string, unknown> {
  const db = getDb();
  const row = db.prepare("SELECT metadata FROM group_state WHERE group_id = ?").get(groupId) as { metadata: string } | undefined;
  if (!row) return {};
  try {
    return JSON.parse(row.metadata) as Record<string, unknown>;
  } catch {
    return {};
  }
}
