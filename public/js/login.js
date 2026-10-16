import { $, api, app, shell, view } from './lib.js';

export async function login({ register = false, onDone }) {
  shell.className = 'shell login'; $('#side').replaceChildren();
  app.replaceChildren(await view('login'));
  const form = $('#auth'), err = $('#err'), go = $('#go'), pw = form.password, eye = $('#reveal');
  const label = register ? 'Create account' : 'Sign in';

  $('#heading').textContent = register ? 'Create your account' : 'Welcome back';
  $('#sub').textContent = register ? 'Start writing and sharing documents.' : 'Sign in to continue to your documents.';
  $('#pw-label').textContent = register ? 'Password (8+ characters)' : 'Password';
  pw.autocomplete = register ? 'new-password' : 'current-password';
  pw.placeholder = register ? 'Create a password' : 'Enter your password';
  $('#name-fld').hidden = !register; form.name.disabled = !register;
  go.textContent = label;
  $('#switch-text').textContent = register ? 'Already have an account?' : 'New here?';
  $('#sw').textContent = register ? 'Sign in' : 'Create an account';
  $('#sw').onclick = (e) => { e.preventDefault(); login({ register: !register, onDone }); };

  eye.onclick = () => {
    const show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    eye.setAttribute('aria-pressed', String(show));
    eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!email || !pw.value || (register && !form.name.value.trim())) { err.textContent = register ? 'Fill in your name, email and password.' : 'Enter your email and password.'; err.hidden = false; return; }
    err.hidden = true; go.disabled = true; go.textContent = register ? 'Creating account…' : 'Signing in…';
    const body = register ? { name: form.name.value.trim(), email, password: pw.value } : { email, password: pw.value };
    try { onDone((await api(register ? '/auth/register' : '/auth/login', { method: 'POST', body })).user); }
    catch (x) { err.textContent = x.message; err.hidden = false; go.disabled = false; go.textContent = label; }
  };
  form.querySelector('input:not(:disabled)').focus();
}
