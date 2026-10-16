import { Editor } from 'https://esm.sh/@tiptap/core@2.6.6';
import StarterKit from 'https://esm.sh/@tiptap/starter-kit@2.6.6';
import Underline from 'https://esm.sh/@tiptap/extension-underline@2.6.6';
import { $, $$, api, app, avatar, clone, modal, shell, toast, view } from './lib.js';

const ACTIONS = {
  b: [(e) => e.chain().focus().toggleBold().run(), (e) => e.isActive('bold')],
  i: [(e) => e.chain().focus().toggleItalic().run(), (e) => e.isActive('italic')],
  u: [(e) => e.chain().focus().toggleUnderline().run(), (e) => e.isActive('underline')],
  h1: [(e) => e.chain().focus().toggleHeading({ level: 1 }).run(), (e) => e.isActive('heading', { level: 1 })],
  h2: [(e) => e.chain().focus().toggleHeading({ level: 2 }).run(), (e) => e.isActive('heading', { level: 2 })],
  ul: [(e) => e.chain().focus().toggleBulletList().run(), (e) => e.isActive('bulletList')],
  ol: [(e) => e.chain().focus().toggleOrderedList().run(), (e) => e.isActive('orderedList')] };

let editor = null;
export const destroyEditor = () => { editor?.destroy(); editor = null; };

export async function openDoc(id) {
  shell.className = 'shell editing';
  const [doc, frag] = await Promise.all([api(`/documents/${id}`), view('editor')]);
  const canEdit = doc.role !== 'view', isOwner = doc.role === 'owner';
  let version = doc.updated_at;
  app.replaceChildren(frag);

  const status = $('#status'), title = $('#title');
  title.value = doc.title; title.readOnly = !canEdit;
  status.textContent = canEdit ? 'Saved' : 'View only';
  $('#avs').append(avatar({ id: doc.owner_id, name: doc.owner_name }), ...doc.shares.map(avatar));
  $('#toolbar').hidden = !canEdit; $('#ronote').hidden = canEdit;
  $('#share').hidden = !isOwner;
  $('#sharedby').hidden = isOwner; $('#sharedby').textContent = `Shared by ${doc.owner_name}`;

  let timer, dirty = {}, chain = Promise.resolve(), locked = false;
  const save = async () => {
    if (locked || !Object.keys(dirty).length) return;
    const payload = dirty; dirty = {};
    try { version = (await api(`/documents/${id}`, { method: 'PATCH', body: { ...payload, base: version } })).updated_at; status.textContent = 'Saved'; }
    catch (err) {
      if (err.status === 409) {
        locked = true; editor.setEditable(false);
        $$('.toolbar button', app).forEach((b) => (b.disabled = true));
        title.readOnly = true; $('#banner').hidden = false;
        status.textContent = 'Out of date'; status.classList.add('warn'); return;
      }
      dirty = { ...payload, ...dirty }; status.textContent = 'Not saved'; status.classList.add('warn'); toast(err.message);
    }
  };
  const queue = (patch) => { Object.assign(dirty, patch); status.textContent = 'Saving…'; status.classList.remove('warn'); clearTimeout(timer); timer = setTimeout(() => (chain = chain.then(save)), 700); };

  editor?.destroy();
  editor = new Editor({ element: $('#ed'), extensions: [StarterKit.configure({ heading: { levels: [1, 2] } }), Underline], content: doc.content, editable: canEdit,
    editorProps: { attributes: { 'aria-label': 'Document body', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: e }) => queue({ content: e.getHTML() }),
    onTransaction: ({ editor: e }) => $$('[data-t]').forEach((b) => b.setAttribute('aria-pressed', ACTIONS[b.dataset.t][1](e))) });

  $$('[data-t]').forEach((b) => (b.onclick = () => ACTIONS[b.dataset.t][0](editor)));
  $('#reload').onclick = () => openDoc(id);
  title.onchange = (e) => { if (!e.target.value.trim()) { e.target.value = doc.title; return toast('Title can’t be empty.'); } doc.title = e.target.value; queue({ title: e.target.value }); };
  $('#export').onclick = async () => {
    const res = await fetch(`/api/documents/${id}/export.md`);
    if (!res.ok) return toast('Export failed.');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await res.blob()), download: `${doc.title.replace(/[^\w\- ]+/g, '') || 'document'}.md` });
    a.click(); URL.revokeObjectURL(a.href);
  };
  window.onbeforeunload = () => (Object.keys(dirty).length ? 'Unsaved changes' : null);
  if (isOwner) $('#share').onclick = () => shareDialog(doc);
}

/* ---------- Share dialog ---------- */

function personRow(u, { role, email, id, owner }) {
  const li = clone('person').firstElementChild;
  $('.slot', li).replaceWith(avatar(u));
  $('b', li).textContent = u.name;
  const small = $('small', li), sel = $('.role-sel', li), label = $('.role', li), rm = $('[data-rm]', li);
  small.textContent = email || ''; small.hidden = !email;
  if (owner) { label.textContent = 'Owner'; sel.remove(); rm.remove(); return li; }
  rm.dataset.rm = id;
  if (email) { sel.value = role; sel.dataset.e = email; label.remove(); }
  else { sel.remove(); label.textContent = role === 'edit' ? 'Can edit' : 'View only'; }
  return li;
}

async function shareDialog(doc) {
  const dlg = modal(clone('share-dlg')), q = (s) => $(s, dlg);
  q('h1').textContent = `Share “${doc.title}”`;
  const say = (type, text) => { const m = q('.msg'); m.className = `msg ${type}`; m.textContent = text; m.hidden = false; };
  const post = (email, role) => api(`/documents/${doc.id}/share`, { method: 'POST', body: { email, role } });

  const draw = async (note) => {
    let shares;
    try { ({ shares } = await api(`/documents/${doc.id}`)); } catch (err) { toast(err.message); return dlg.close(); }
    q('.people').replaceChildren(
      personRow({ id: doc.owner_id, name: doc.owner_name }, { owner: true }),
      ...shares.map((s) => personRow(s, s)));
    q('.none').hidden = shares.length > 0;
    if (note) say('ok', note);
    $$('.role-sel', dlg).forEach((sel) => (sel.onchange = async () => {
      try { await post(sel.dataset.e, sel.value); draw('Access updated.'); } catch (err) { say('err', err.message); }
    }));
    $$('[data-rm]', dlg).forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      try { await api(`/documents/${doc.id}/share/${b.dataset.rm}`, { method: 'DELETE' }); draw('Access removed.'); }
      catch (err) { say('err', err.message); b.disabled = false; }
    }));
  };

  q('form').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget, email = f.email.value.trim(), role = f.role.value, go = $('.btn', f);
    if (!/^\S+@\S+\.\S+$/.test(email)) return say('err', 'Enter a valid email address.');
    go.disabled = true; go.textContent = 'Sharing…';
    try { await post(email, role); f.email.value = ''; await draw(`Shared with ${email} (${role === 'edit' ? 'can edit' : 'can view'}).`); }
    catch (err) { say('err', err.message); }
    go.disabled = false; go.textContent = 'Share';
  };
  $$('[data-close]', dlg).forEach((b) => (b.onclick = () => dlg.close()));
  await draw();
  q('input').focus();
}
