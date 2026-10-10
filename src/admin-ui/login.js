// Admin sign-in (password -> authenticator code; first time: scan a QR code and save backup codes). Served only at the secret path.
(function () {
  var root = document.getElementById('auth'); var BASE = root.getAttribute('data-base'); var mode = root.getAttribute('data-mode');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function post(p, body) {
    return fetch(BASE + p, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'HTTP ' + r.status }; }).then(function (d) { d.status = r.status; return d; }); });
  }
  var brand = '<div class="aa-brand"><img src="/assets/brand/hub-logo.svg" alt="The Gaming Hub" width="200" height="37"><picture><img src="/assets/brand/tt-horizontal.svg" alt="Trap Tech Solutions" width="142" height="40" decoding="async"></picture></div>';
  function card(inner) { root.innerHTML = '<div class="card aa-card">' + brand + inner + '</div>'; }
  function err(d) { var m = document.getElementById('m'); if (m) m.innerHTML = '<div class="err">' + esc(d.error || 'Something went wrong') + (d.retry_after ? ' (about ' + Math.ceil(d.retry_after / 60) + ' min)' : '') + '</div>'; }
  function busy(f, on) { var b = f.querySelector('button'); if (b) b.disabled = on; }
  function login() {
    card('<h1>Admin sign-in</h1><form id="f" autocomplete="on"><div id="m"></div><label class="lbl" for="un">Admin username</label><input class="input" id="un" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus><label class="lbl" for="pw">Password</label><input class="input" type="password" id="pw" autocomplete="current-password" required><button class="btn block">Continue</button></form>');
    document.getElementById('f').onsubmit = function (e) {
      e.preventDefault(); var f = e.target; busy(f, true);
      post('/api/login', { username: document.getElementById('un').value, password: document.getElementById('pw').value }).then(function (d) { busy(f, false); if (!d.ok) return err(d); if (d.next === 'enroll') enroll(d); else totp(); });
    };
  }
  function totp() {
    card('<h1>Authenticator code</h1><p class="small muted">Open your authenticator app and type the 6-digit code for "Gaming Hub Admin". Lost your phone? Use one of your backup codes.</p><form id="f"><div id="m"></div><input class="input aa-code" id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="9" placeholder="123456" required autofocus><button class="btn block">Sign in</button></form>');
    document.getElementById('f').onsubmit = function (e) {
      e.preventDefault(); var f = e.target; busy(f, true);
      post('/api/totp', { code: document.getElementById('code').value }).then(function (d) { busy(f, false); if (!d.ok) { if (d.restart) return login(); return err(d); } location.reload(); });
    };
  }
  function enroll(d) {
    card('<h1>Set up two-factor sign-in</h1><ol class="small aa-steps"><li>Install an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy...).</li><li>Scan this QR code, or type the key by hand.</li><li>Enter the 6-digit code it shows.</li></ol><div class="aa-qr">' + d.qr_svg + '</div><p class="tiny muted center">Key: <code class="aa-key">' + esc(d.secret.replace(/(.{4})/g, '$1 ').trim()) + '</code></p><form id="f"><div id="m"></div><input class="input aa-code" id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456" required><button class="btn block">Confirm and sign in</button></form>');
    document.getElementById('f').onsubmit = function (e) {
      e.preventDefault(); var f = e.target; busy(f, true);
      post('/api/totp', { code: document.getElementById('code').value }).then(function (r) { busy(f, false); if (!r.ok) { if (r.restart) return login(); return err(r); } codes(r.backup_codes); });
    };
  }
  function codes(list) {
    card('<h1>Save your backup codes</h1><p class="small muted">Each code works once if you lose your phone. Store them somewhere safe (a password manager or on paper). They will not be shown again.</p><pre class="aa-codes" id="bc">' + esc((list || []).join('\n')) + '</pre><button class="btn ghost block" id="cp">Copy codes</button><button class="btn block" id="go" style="margin-top:8px">I saved them, open the dashboard</button>');
    document.getElementById('cp').onclick = function () { try { navigator.clipboard.writeText(document.getElementById('bc').textContent); this.textContent = 'Copied'; } catch (e) {} };
    document.getElementById('go').onclick = function () { location.href = BASE + '/'; };
  }
  function reset() {
    card('<h1>One-time owner reset</h1><p class="small muted">Resets the OWNER account. Paste the ADMIN_RESET_TOKEN you set in the host settings and choose a new password. Two-factor sign-in is cleared, so you will set up your authenticator again. Afterwards remove ADMIN_RESET_TOKEN from the host settings.</p><form id="f"><div id="m"></div><label class="lbl" for="tok">Reset token</label><input class="input" id="tok" type="password" autocomplete="off" required><label class="lbl" for="np">New password (12+ characters)</label><input class="input" id="np" type="password" autocomplete="new-password" minlength="12" required><button class="btn block">Reset</button></form>');
    document.getElementById('f').onsubmit = function (e) {
      e.preventDefault(); var f = e.target; busy(f, true);
      post('/api/reset', { token: document.getElementById('tok').value, new_password: document.getElementById('np').value }).then(function (d) { busy(f, false); if (!d.ok) return err(d); card('<h1>Done</h1><p class="small">' + esc(d.note) + '</p><a class="btn block" href="' + BASE + '/">Sign in</a>'); });
    };
  }
  if (mode === 'reset') reset(); else login();
})();
