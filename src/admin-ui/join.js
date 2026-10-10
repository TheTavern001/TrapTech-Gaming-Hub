// staff invite page (/<ADMIN_PATH>/join/<token>): create an admin / moderator account from a one-time owner invite
const f = document.getElementById('jf');
if (f) f.addEventListener('submit', async (e) => {
  e.preventDefault(); const m = document.getElementById('jm'); const v = (id) => document.getElementById(id).value;
  if (v('jp') !== v('jp2')) { m.textContent = 'Passwords do not match.'; return; }
  m.textContent = 'Creating your account...';
  const token = location.pathname.split('/').pop();
  const r = await fetch('/admin/join-api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, username: v('ju').trim(), display_name: v('jd').trim(), password: v('jp') }) }).then(x => x.json()).catch(() => ({ ok: false, error: 'Network error.' }));
  if (!r.ok) { m.textContent = r.error || 'Could not create the account.'; return; }
  f.innerHTML = `<p>Account <b></b> created as ${r.role}. Next: sign in and set up your authenticator app.</p><p><a class="btn" href="${r.login}">Go to sign in</a></p>`;
  f.querySelector('b').textContent = r.username;
});
