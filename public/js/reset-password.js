// player password reset (one-time link or code handed out by an admin on Potato; there is no email)
(function () {
  const q = new URLSearchParams(location.search); const token = q.get('token');
  const $ = (id) => document.getElementById(id);
  if (token) { $('codeRow').style.display = 'none'; history.replaceState(null, '', '/reset-password'); }
  $('rp').addEventListener('submit', async (e) => {
    e.preventDefault(); const msg = $('msg'); msg.className = 'msg';
    if ($('pw').value !== $('pw2').value) { msg.className = 'msg err'; msg.textContent = 'The passwords do not match.'; return; }
    const body = token ? { token, password: $('pw').value } : { username: $('un').value.trim(), code: $('cd').value.trim(), password: $('pw').value };
    msg.textContent = 'Saving...';
    let r; try { r = await fetch('/api/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()); } catch { r = { ok: false, error: 'Network error. Try again.' }; }
    if (!r.ok) { msg.className = 'msg err'; msg.textContent = r.error || 'Could not reset the password.'; return; }
    $('rp').innerHTML = '<p class="msg ok">Password updated. You can sign in now.</p><p><a href="/?login=1">Sign in</a></p>';
  });
})();
