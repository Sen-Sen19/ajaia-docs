import { $, $$, api, avatar, shell, state, toast, view } from './lib.js';

export async function sidebar(active, { onLogout }) {
  shell.className = 'shell';
  const side = $('#side');
  side.replaceChildren(await view('sidebar'));

  $$('nav a', side).forEach((a) => {
    const on = a.dataset.k === active;
    a.classList.toggle('on', on);
    on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current');
  });
  $('.me-av', side).replaceWith(avatar(state.me));
  $('#me-name').textContent = state.me.name;
  $('#me-email').textContent = state.me.email;

  $('#new').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { location.hash = `#/doc/${(await api('/documents', { method: 'POST', body: {} })).id}`; }
    catch (err) { toast(err.message); b.disabled = false; }
  };
  $('#out').onclick = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); onLogout(); };
}
