# Admin auth layer (v7, item 20) - for anyone building admin screens

Code: `src/admin-sec.js` (server), `src/admin-ui/` (the admin app: `admin.js`, `admin.css`, sign-in page `login.js` / `login.css`).
The admin app is **no longer in `public/`**: `public/js/admin.js`, `public/css/admin.css` and `public/admin.html` were moved/removed
so nothing public reveals the admin. Edit `src/admin-ui/admin.js` instead.

## URLs
- Admin lives at `/<ADMIN_PATH>/` (env var, a long random slug, 16-128 chars of `A-Z a-z 0-9 _ -`). Without it the admin is disabled.
- API: `/<ADMIN_PATH>/api/...`. `/admin`, `/admin/*`, `/api/admin/*`, `/admin.html`, `/js/admin.js` are plain `404 Not found`.
- In `src/admin-ui/admin.js` keep writing `'/api/admin/...'` and `'/admin/...'` in string/template literals: the server rewrites
  them to the secret path when it serves the file (`sub()` in admin-sec.js), and `AP` holds the base path at runtime.
- Every non-GET request must send `X-CSRF-Token` (the `api()` helper in admin.js does it; the token is in `<meta name="csrf">`).

## Accounts and roles
Table `admin_users` (id, username, role, display_name, pass_hash (bcrypt), must_change, totp_enc (AES-GCM), backup_codes, disabled, ...).
Roles, lowest to highest: `moderator` < `admin` < `owner`.
- The **owner** account is seeded on first run: username `ADMIN_USERNAME` (default `owner`), password = `ADMIN_PASSWORD` env var until
  the owner sets one in Admin > Security (then the bcrypt hash in the DB wins and the env var is ignored).
- Every account has its own password and its own authenticator app (enrolled with a QR code at first sign-in) + 10 backup codes.
- New accounts get a temporary password from the owner and must change it at first sign-in (`must_change`).

## Server API for other modules
```js
const ADMSEC = require('./admin-sec');
ADMSEC.requireRole('moderator' | 'admin' | 'owner') // middleware: session + CSRF (non-GET) + minimum role; sets req.admin = { id, username, role }
ADMSEC.requireAdmin                                 // = requireRole('admin'); used by the main admin router A (A.use(requireAdmin) in server.js)
ADMSEC.M                                            // express.Router mounted at /<ADMIN_PATH>/api BEFORE A, gated at moderator level.
                                                    // Put moderator-allowed routes here, e.g. ADMSEC.M.get('/flags', ...); add requireRole('admin') per route for more.
ADMSEC.accounts.list() / get(id)                    // public account objects (no secrets)
await ADMSEC.accounts.create({ username, role: 'admin'|'moderator', password /*temp, 12+*/, display_name }, byAdmin)
ADMSEC.accounts.update(id, { role, disabled, display_name })   // signs the account out if role/disabled changed; owner can't be demoted
await ADMSEC.accounts.resetAuth(id, tempPassword)   // owner resets someone else: temp password + 2FA cleared + signed out
ADMSEC.accounts.remove(id)
ADMSEC.ROLES, ADMSEC.roleAtLeast(role, min), ADMSEC.BASE()
```
Owner-only HTTP routes already exist (UI not built yet): `GET/POST /api/accounts`, `PUT /api/accounts/:id`,
`POST /api/accounts/:id/reset` `{ temp_password }`, `DELETE /api/accounts/:id`. Every account route writes to the audit log.
Self-service for every role: `GET /api/me` (`{ admin, csrf, account }`), `POST /api/logout`, `GET /api/security`
(own sessions; audit log: all events for admin+owner, own events for moderators), `POST /api/security/password`
`{ current, new_password, code }`, `POST /api/security/backup-codes` `{ code }`, `POST /api/security/logout-all`.
In the browser, `<meta name="admin-user" content="username" data-role="owner" data-name="...">` gives the signed-in account (`ME` in admin.js).

## Protections (summary)
Per-IP (5 failures / 15 min, then 1, 2, 4 ... 60 min), per-account (8 failures) and global (40 failures / 15 min -> 15 min) lockouts;
request limits 20 / 10 min per IP and 200 / 10 min overall on the sign-in endpoints; constant-time comparisons and a dummy bcrypt for
unknown usernames; client IP = `CF-Connecting-IP` only when `TRUST_CF_IP=1` (default on when `NODE_ENV=production`), otherwise the
socket address. Sessions: server-side, HttpOnly + SameSite=Strict + Secure cookie scoped to the secret path, 30 min idle / 8 h absolute,
a password change signs that account out everywhere. Admin responses: `X-Robots-Tag: noindex`, `Cache-Control: no-store`,
CSP `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`. The service worker never caches `no-store` responses.

## Recovery
`ADMIN_RESET_TOKEN` (24+ chars) set on the host + restart enables `/<ADMIN_PATH>/reset` once: new owner password, owner 2FA cleared.
The token is remembered as used; remove the env var afterwards. Other admins are reset by the owner (`accounts.resetAuth`).

## Tests
`node tools/e2e-admin-sec.js` (own throwaway server on port 8797 + DB copy; 66 checks). Other suites sign in through
`tools/admin-auth.js` (`adminClient(BASE).login()`, `browserLogin(page, BASE)`), which reads the TOTP secret from the local DB.
