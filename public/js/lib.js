export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const app = $('#app'), shell = $('#shell');
export const state = { me: null };

const COLORS = ['#2d5bd1', '#0f766e', '#7c3aed', '#be5b19', '#475569'];
export function avatar(u) {
  const s = document.createElement('span');
  s.className = 'av'; s.style.setProperty('--c', COLORS[u.id % 5]); s.title = u.name;
  s.textContent = u.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
  return s;
}

export const fmtDate = (d) => new Date(d.replace(' ', 'T') + 'Z').toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

// Load views/<name>.html once and return a fresh DocumentFragment each call.
const cache = {};
export async function view(name) {
 cache[name] ??= fetch(`/views/${name}.html`, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`Missing view: ${name}`); return r.text(); });
  const t = document.createElement('template');
  t.innerHTML = await cache[name];
  return t.content;
}
// Clone a <template id="..."> that is currently in the page.
export const clone = (id) => $(`#${id}`).content.cloneNode(true);

export async function api(path, { method = 'GET', body } = {}) {
  const isForm = body instanceof FormData;
  const res = await fetch('/api' + path, {
    method, headers: isForm || !body ? {} : { 'Content-Type': 'application/json' },
    body: isForm ? body : body && JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed.'), { status: res.status });
  return data;
}

let toastTimer;
export function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// Takes a DocumentFragment; clicking the bare <dialog> (backdrop) closes it.
export function modal(frag) {
  const d = document.createElement('dialog'), box = document.createElement('div');
  box.className = 'dlg'; box.append(frag); d.append(box);
  document.body.append(d);
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.showModal();
  return d;
}
