const path = require('path');
const crypto = require('crypto');
const { hashPassword, verifyPassword } = require('./auth');
const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');
const TurndownService = require('turndown');
const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });

const ALLOWED_EXT = ['.txt', '.md', '.docx'];
const MAX_UPLOAD = 2 * 1024 * 1024;
const clean = (html) => sanitizeHtml(html, {
  allowedTags: ['p', 'h1', 'h2', 'h3', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'br', 'blockquote'],
  allowedAttributes: {},
});
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function httpError(status, message) { return Object.assign(new Error(message), { status }); }

async function fileToHtml(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) throw httpError(400, `Unsupported file type. Use ${ALLOWED_EXT.join(', ')}.`);
  if (ext === '.docx') return clean((await mammoth.convertToHtml({ buffer: file.buffer })).value);
  const text = file.buffer.toString('utf8');
  if (ext === '.md') return clean(marked.parse(text));
  return text.split(/\n{2,}/).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}

// Express 4 doesn't catch async rejections; wrap handlers so errors reach the error middleware.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function createApp(db) {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD } });
  app.use(express.json({ limit: '2mb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Auth: email + password, server-side sessions in an httpOnly cookie (only a hash of the token is stored).
  app.set('trust proxy', 1);
  const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
  const startSession = (req, res, userId) => {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+7 days'))").run(sha(token), userId);
    res.cookie('sid', token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 7 * 864e5 });
  };
 
  const sessionUser = (req) => {
    const sid = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    return (sid && db.prepare("SELECT u.id, u.name, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > datetime('now')").get(sha(sid))) || null;
  };
  const auth = (req, _res, next) => {
    const user = sessionUser(req);
    if (!user) return next(httpError(401, 'Sign in to continue.'));
    req.user = user; next();
  };
  app.post('/api/auth/register', (req, res) => {
    const name = String(req.body.name || '').trim(), email = String(req.body.email || '').trim().toLowerCase(), password = String(req.body.password || '');
    if (!name || name.length > 80) throw httpError(400, 'Enter your name (80 characters max).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Enter a valid email address.');
    if (password.length < 8) throw httpError(400, 'Password must be at least 8 characters.');
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw httpError(409, 'An account with that email already exists.');
    const { lastInsertRowid } = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, hashPassword(password));
    startSession(req, res, lastInsertRowid);
    res.status(201).json({ user: { id: Number(lastInsertRowid), name, email } });
  });  app.post('/api/auth/login', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(req.body.email || '').trim().toLowerCase());
    if (!user || !verifyPassword(String(req.body.password || ''), user.password_hash)) throw httpError(401, 'Incorrect email or password.');
    startSession(req, res, user.id);
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  });
  app.post('/api/auth/logout', (req, res) => {
    const sid = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    if (sid) db.prepare('DELETE FROM sessions WHERE token = ?').run(sha(sid));
    res.clearCookie('sid'); res.json({ ok: true });
  });
 app.get('/api/auth/me', (req, res) => res.json({ user: sessionUser(req) }));
  app.use('/api/documents', auth);

  // Single source of truth for access: role is 'owner' | 'edit' | 'view', otherwise 403.
  const load = (req, _res, next) => {
    const doc = db.prepare('SELECT d.*, u.name AS owner_name FROM documents d JOIN users u ON u.id = d.owner_id WHERE d.id = ?').get(Number(req.params.id));
    if (!doc) return next(httpError(404, 'Document not found.'));
    const share = db.prepare('SELECT role FROM shares WHERE doc_id = ? AND user_id = ?').get(doc.id, req.user.id);
    doc.role = doc.owner_id === req.user.id ? 'owner' : share?.role || null;
    if (!doc.role) return next(httpError(403, "You don't have access to this document."));
    req.doc = doc; next();
  };
  const canEdit = (req, _res, next) => (['owner', 'edit'].includes(req.doc.role) ? next() : next(httpError(403, 'You have view-only access.')));
  const ownerOnly = (req, _res, next) => (req.doc.role === 'owner' ? next() : next(httpError(403, 'Only the owner can do this.')));
  const validTitle = (t) => { t = String(t ?? '').trim(); if (!t || t.length > 120) throw httpError(400, 'Title must be 1–120 characters.'); return t; };

  app.get('/api/documents', (req, res) => {
    const cols = 'd.id, d.title, d.updated_at, d.owner_id, u.name AS owner_name';
    res.json({
      owned: db.prepare(`SELECT ${cols} FROM documents d JOIN users u ON u.id = d.owner_id WHERE d.owner_id = ? ORDER BY d.updated_at DESC`).all(req.user.id),
      shared: db.prepare(`SELECT ${cols}, s.role FROM shares s JOIN documents d ON d.id = s.doc_id JOIN users u ON u.id = d.owner_id WHERE s.user_id = ? ORDER BY d.updated_at DESC`).all(req.user.id),
    });
  });

  app.post('/api/documents', (req, res) => {
    const title = validTitle(req.body.title || 'Untitled document');
    const { lastInsertRowid } = db.prepare('INSERT INTO documents (owner_id, title) VALUES (?, ?)').run(req.user.id, title);
    res.status(201).json({ id: lastInsertRowid });
  });

  app.post('/api/documents/import', upload.single('file'), wrap(async (req, res) => {
    if (!req.file) throw httpError(400, 'Choose a file to import.');
    const content = await fileToHtml(req.file);
    const title = path.basename(req.file.originalname, path.extname(req.file.originalname)).slice(0, 120) || 'Imported document';
    const { lastInsertRowid } = db.prepare('INSERT INTO documents (owner_id, title, content) VALUES (?, ?, ?)').run(req.user.id, title, content);
    res.status(201).json({ id: lastInsertRowid });
  }));

  app.get('/api/documents/:id', load, (req, res) => {
    const shares = req.doc.role === 'owner'
      ? db.prepare('SELECT u.id, u.name, u.email, s.role FROM shares s JOIN users u ON u.id = s.user_id WHERE s.doc_id = ?').all(req.doc.id) : [];
    res.json({ ...req.doc, shares });
  });

  app.patch('/api/documents/:id', load, canEdit, (req, res) => {
    // Optimistic concurrency: reject saves made against a stale copy instead of silently overwriting.
    if (req.body.base !== undefined && req.body.base !== req.doc.updated_at) throw httpError(409, 'Someone else changed this document. Reload to get the latest version.');
    const title = req.body.title !== undefined ? validTitle(req.body.title) : req.doc.title;
    const content = req.body.content !== undefined ? clean(String(req.body.content)) : req.doc.content;
    const now = db.prepare("SELECT strftime('%Y-%m-%d %H:%M:%f', 'now') AS t").get().t;
    db.prepare('UPDATE documents SET title = ?, content = ?, updated_at = ? WHERE id = ?').run(title, content, now, req.doc.id);
    res.json({ ok: true, updated_at: now });
  });

  app.get('/api/documents/:id/export.md', load, (req, res) => {
    res.type('text/markdown').send(`# ${req.doc.title}\n\n${td.turndown(req.doc.content)}\n`);
  });

  app.delete('/api/documents/:id', load, ownerOnly, (req, res) => {
    db.prepare('DELETE FROM documents WHERE id = ?').run(req.doc.id);
    res.json({ ok: true });
  });

  app.post('/api/documents/:id/share', load, ownerOnly, (req, res) => {
    const role = req.body.role === 'edit' ? 'edit' : 'view';
    const target = db.prepare('SELECT id FROM users WHERE email = ?').get(String(req.body.email || '').trim().toLowerCase());
    if (!target) throw httpError(404, 'No user with that email.');
    if (target.id === req.user.id) throw httpError(400, 'You already own this document.');
    db.prepare('INSERT INTO shares (doc_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT(doc_id, user_id) DO UPDATE SET role = excluded.role').run(req.doc.id, target.id, role);
    res.json({ ok: true });
  });

  app.delete('/api/documents/:id/share/:userId', load, ownerOnly, (req, res) => {
    db.prepare('DELETE FROM shares WHERE doc_id = ? AND user_id = ?').run(req.doc.id, Number(req.params.userId));
    res.json({ ok: true });
  });

  app.use((err, _req, res, _next) => {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    const status = tooBig ? 413 : err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: tooBig ? 'File is too large (2 MB max).' : status === 500 ? 'Something went wrong.' : err.message });
  });
  return app;
}
module.exports = { createApp };


