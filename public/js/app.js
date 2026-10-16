import { api, state, toast } from './lib.js';
import { login } from './login.js';
import { sidebar } from './sidebar.js';
import { dashboard } from './dashboard.js';
import { openDoc, destroyEditor } from './editor.js';

const showLogin = () => {
  state.me = null;
  destroyEditor();
  location.hash = '#/';
  return login({ onDone: (user) => { state.me = user; location.hash = '#/'; route(); } });
};

async function route() {
  window.onbeforeunload = null;
  if (!state.me) {
    const { user } = await api('/auth/me').catch(() => ({ user: null }));
    if (!user) return showLogin();
    state.me = user;
  }
  const m = location.hash.match(/^#\/doc\/(\d+)/), f = location.hash.match(/^#\/(owned|shared)/);
  try {
    if (m) await openDoc(m[1]);
    else { const k = f ? f[1] : ''; await sidebar(k, { onLogout: showLogin }); await dashboard(k); }
  } catch (err) {
    if (err.status === 401) return showLogin();
    toast(err.message); if (m) location.hash = '#/';
  }
}
addEventListener('hashchange', route);
route();