const test = require('node:test');
const assert = require('node:assert');
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');

let server, base;
const cookies = {};
const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
test.before(async () => {
  await new Promise((r) => { server = createApp(openDb(':memory:')).listen(0, () => { base = `http://localhost:${server.address().port}/api`; r(); }); });
  for (const [id, n] of [[1, 'alice'], [2, 'bob'], [3, 'carol']]) cookies[id] = (await post('/auth/login', { email: `${n}@ajaia.test`, password: 'demo1234' })).headers.get('set-cookie').split(';')[0];
});
test.after(() => server.close());

const call = (user, method, path, body) => fetch(base + path, {
  method, headers: { cookie: cookies[user], 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });

test('sharing enforces owner / view / edit permissions', async () => {
  const { id } = await (await call(1, 'POST', '/documents', { title: 'Plan' })).json();
  assert.equal((await call(2, 'GET', `/documents/${id}`)).status, 403, 'stranger blocked');
  assert.equal((await call(1, 'POST', `/documents/${id}/share`, { email: 'bob@ajaia.test', role: 'view' })).status, 200);
  assert.equal((await call(2, 'GET', `/documents/${id}`)).status, 200, 'viewer can read');
  assert.equal((await call(2, 'PATCH', `/documents/${id}`, { content: '<p>x</p>' })).status, 403, 'viewer cannot edit');
  assert.equal((await call(2, 'POST', `/documents/${id}/share`, { email: 'carol@ajaia.test' })).status, 403, 'viewer cannot re-share');
  await call(1, 'POST', `/documents/${id}/share`, { email: 'bob@ajaia.test', role: 'edit' });
  assert.equal((await call(2, 'PATCH', `/documents/${id}`, { content: '<p>hi</p>' })).status, 200, 'editor can edit');
  assert.equal((await (await call(2, 'GET', '/documents')).json()).shared.length, 1);
});

test('content is sanitized and titles validated', async () => {
  const { id } = await (await call(1, 'POST', '/documents', {})).json();
  await call(1, 'PATCH', `/documents/${id}`, { content: '<p>ok</p><script>alert(1)</script>' });
  assert.equal((await (await call(1, 'GET', `/documents/${id}`)).json()).content, '<p>ok</p>');
  assert.equal((await call(1, 'PATCH', `/documents/${id}`, { title: '  ' })).status, 400);
});

test('import rejects unsupported types and converts markdown', async () => {
  const send = (name, text) => { const f = new FormData(); f.append('file', new Blob([text]), name);
    return fetch(`${base}/documents/import`, { method: 'POST', headers: { cookie: cookies[1] }, body: f }); };
  assert.equal((await send('virus.exe', 'x')).status, 400);
  const res = await send('notes.md', '# Hello\n\n**bold**');
  assert.equal(res.status, 201);
  const doc = await (await call(1, 'GET', `/documents/${(await res.json()).id}`)).json();
  assert.match(doc.content, /<h1>Hello<\/h1>/);
});

test('stale saves are rejected and documents export to markdown', async () => {
  const { id } = await (await call(1, 'POST', '/documents', { title: 'Spec' })).json();
  const { updated_at } = await (await call(1, 'GET', `/documents/${id}`)).json();
  const ok = await call(1, 'PATCH', `/documents/${id}`, { content: '<h2>Hi</h2><p><strong>x</strong></p>', base: updated_at });
  assert.equal(ok.status, 200);
  assert.equal((await call(1, 'PATCH', `/documents/${id}`, { content: '<p>old</p>', base: updated_at })).status, 409);
  const md = await (await call(1, 'GET', `/documents/${id}/export.md`)).text();
  assert.match(md, /## Hi/); assert.match(md, /\*\*x\*\*/);
});

test('register, login and session rules', async () => {
  assert.equal((await post('/auth/register', { name: 'Dee', email: 'dee@x.test', password: 'short' })).status, 400, 'weak password');
  assert.equal((await post('/auth/register', { name: 'Dee', email: 'alice@ajaia.test', password: 'longenough1' })).status, 409, 'duplicate email');
  const reg = await post('/auth/register', { name: 'Dee', email: 'dee@x.test', password: 'longenough1' });
  assert.equal(reg.status, 201);
  const me = await fetch(base + '/auth/me', { headers: { cookie: reg.headers.get('set-cookie').split(';')[0] } });
  assert.equal((await me.json()).user.email, 'dee@x.test');
  assert.equal((await post('/auth/login', { email: 'dee@x.test', password: 'wrong-password' })).status, 401);
  assert.equal((await fetch(base + '/documents')).status, 401, 'no cookie, no access');
});
