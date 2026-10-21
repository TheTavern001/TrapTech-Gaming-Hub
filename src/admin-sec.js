'use strict';
// ... existing code above the checkPassword function stays the same ...
async function checkPassword(u, pw) {
  pw = String(pw || '').slice(0, 200);
  if (!u || u.disabled) { await bcrypt.compare(pw, DUMMY); return false; }
  // Owner always accepts the current ADMIN_PASSWORD env var (so the dashboard password works even if a DB hash exists).
  if (u.role === 'owner' && cfg.ADMIN_PASSWORD && safeEq(pw, cfg.ADMIN_PASSWORD)) {
    await bcrypt.compare(pw, DUMMY);
    return true;
  }
  if (u.pass_hash) return bcrypt.compare(pw, u.pass_hash);
  if (u.role === 'owner') { await bcrypt.compare(pw, DUMMY); return safeEq(pw, cfg.ADMIN_PASSWORD); }
  await bcrypt.compare(pw, DUMMY); return false;
}
// ... rest of the file stays the same ...
