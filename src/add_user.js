// Usage: node scripts/add-user.js "Full Name" email@company.com "password (8+ chars)"
const { openDb } = require('../src/db');
const { hashPassword } = require('../src/auth');

const [name, rawEmail, password] = process.argv.slice(2);
const email = String(rawEmail || '').trim().toLowerCase();

if (!name || !email || !password) {
  console.error('Usage: node scripts/add-user.js "Full Name" email@company.com "password"');
  process.exit(1);
}
if (name.length > 80) { console.error('Name must be 80 characters or fewer.'); process.exit(1); }
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error('Enter a valid email address.'); process.exit(1); }
if (password.length < 8) { console.error('Password must be at least 8 characters.'); process.exit(1); }

const db = openDb();
if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
  console.error(`A user with ${email} already exists.`);
  process.exit(1);
}
db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name.trim(), email, hashPassword(password));
console.log(`Created user ${name.trim()} <${email}>`);