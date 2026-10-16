const { DatabaseSync } = require('node:sqlite'); // built in (Node 22.13+), no native build step
const { hashPassword } = require('./auth');

function openDb(file = process.env.DB_PATH || 'data.db') {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT);
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS shares (
      doc_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      role TEXT NOT NULL CHECK (role IN ('view','edit')),
      PRIMARY KEY (doc_id, user_id));
  `);
  if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'password_hash')) db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
  const seed = db.prepare('INSERT OR IGNORE INTO users (id, name, email) VALUES (?, ?, ?)');
  [[1, 'Alice Rivera', 'alice@ajaia.test'], [2, 'Bob Chen', 'bob@ajaia.test'], [3, 'Carol Okafor', 'carol@ajaia.test']]
    .forEach((u) => seed.run(...u));
  // Demo accounts for reviewers (password: demo1234). Only set if no password exists yet.
  const setPw = db.prepare('UPDATE users SET password_hash = ? WHERE email = ? AND password_hash IS NULL');
  ['alice', 'bob', 'carol'].forEach((n) => setPw.run(hashPassword('demo1234'), `${n}@ajaia.test`));
  return db;
}
module.exports = { openDb };
