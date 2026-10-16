import { $, $$, api, app, avatar, clone, fmtDate, modal, toast, view } from './lib.js';

const TITLES = { '': 'All documents', owned: 'Owned by me', shared: 'Shared with me' };
const EMPTIES = {
  '': ['No documents yet', 'Create a document or import a .txt, .md or .docx file to get started.'],
  owned: ['You haven’t created any documents', 'Documents you create or import will appear here.'],
  shared: ['Nothing shared with you yet', 'When someone shares a document with you, it will appear here.'] };

export async function dashboard(filter) {
  app.replaceChildren(await view('dashboard'));
  $('#heading').textContent = TITLES[filter];
  $('#head').hidden = true;
  $('#rows').innerHTML = '<p class="muted" style="padding:16px">Loading documents…</p>';

  const { owned, shared } = await api('/documents');
  const all = [...owned.map((d) => ({ ...d, mine: true })), ...shared].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const refresh = () => dashboard(filter);

  const emptyState = (title, text, withActions) => {
    const el = clone('empty').firstElementChild;
    $('h2', el).textContent = title; $('p', el).textContent = text;
    if (!withActions) { $('.empty-ico', el).remove(); $('.row', el).remove(); }
    else {
      $('[data-act=new]', el).onclick = () => $('#new').click();
      $('[data-act=import]', el).onclick = () => $('#file').click();
    }
    return el;
  };

  const rowEl = (d) => {
    const r = clone('row').firstElementChild;
    $('.doc', r).href = `#/doc/${d.id}`;
    $('.doc b', r).textContent = d.title;
    $('.own-av', r).replaceWith(avatar({ id: d.owner_id, name: d.owner_name }));
    $('.own-name', r).textContent = d.mine ? 'You' : d.owner_name;
    const badge = $('.badge', r);
    badge.textContent = d.mine ? 'Owner' : d.role === 'edit' ? 'Can edit' : 'View only';
    badge.classList.toggle('shared', !d.mine);
    $('.col-e', r).textContent = fmtDate(d.updated_at);
    if (d.mine) {
      $('[data-act=rename]', r).onclick = () => renameDialog(d, refresh);
      $('[data-act=delete]', r).onclick = () => deleteDialog(d, refresh);
    } else $('.acts', r).replaceChildren();
    return r;
  };

  const draw = () => {
    const q = $('#q').value.trim().toLowerCase();
    const base = all.filter((d) => (filter === 'owned' ? d.mine : filter === 'shared' ? !d.mine : true));
    const rows = base.filter((d) => d.title.toLowerCase().includes(q));
    $('#head').hidden = !rows.length;
    $('#rows').replaceChildren(...(rows.length ? rows.map(rowEl)
      : [base.length ? emptyState('No matches', `No documents match “${q}”.`, false)
        : emptyState(...EMPTIES[filter], filter !== 'shared')]));
  };
  draw(); $('#q').oninput = draw;

  $('#file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append('file', f);
    toast('Importing…');
    try { location.hash = `#/doc/${(await api('/documents/import', { method: 'POST', body: fd })).id}`; } catch (err) { toast(err.message); }
    e.target.value = '';
  };
}

function renameDialog(d, done) {
  const dlg = modal(clone('rename-dlg')), input = $('input', dlg);
  input.value = d.title; input.select();
  $('.cancel', dlg).onclick = () => dlg.close();
  $('form', dlg).onsubmit = async (e) => {
    e.preventDefault();
    const ok = $('.ok', dlg); ok.disabled = true;
    try { await api(`/documents/${d.id}`, { method: 'PATCH', body: { title: input.value } }); dlg.close(); done(); }
    catch (err) { toast(err.message); ok.disabled = false; }
  };
}

function deleteDialog(d, done) {
  const dlg = modal(clone('delete-dlg'));
  $('h1', dlg).textContent = `Delete “${d.title}”?`;
  $('.cancel', dlg).onclick = () => dlg.close();
  $('.ok', dlg).onclick = async (e) => {
    e.currentTarget.disabled = true;
    try { await api(`/documents/${d.id}`, { method: 'DELETE' }); dlg.close(); toast('Document deleted.'); done(); }
    catch (err) { toast(err.message); e.currentTarget.disabled = false; }
  };
}
