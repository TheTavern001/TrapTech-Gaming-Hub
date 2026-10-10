// v7 Phase 6: every countdown the hub shows lands on the right instant in hub time (America/New_York), across DST.
// In-process, throwaway DB: node tools/e2e-timers.js
const os = require('os'); const path = require('path'); const fs = require('fs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmr-')); process.env.DB_PATH = path.join(dir, 'hub.db'); process.env.PAY_NO_SWEEP = '1';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x !== undefined ? JSON.stringify(x) : ''); } };
const et = (t) => new Date(t).toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const SH = require('../src/shop'); const SE = require('../src/seasons'); const PR = require('../src/progress');
const cases = ['2026-10-10T14:00:00-04:00', '2026-10-31T23:59:30-04:00', '2026-11-01T01:30:00-04:00', '2026-11-01T01:30:00-05:00', '2026-11-08T12:00:00-05:00', '2027-03-14T01:59:00-05:00', '2027-03-14T03:30:00-04:00', '2026-12-31T23:59:59-05:00'];
for (const iso of cases) { const t = Date.parse(iso); const r = SH.rotation(t);
  const d = et(r.daily_ends), w = et(r.weekly_ends);
  ok(/, 24:00:00$|, 00:00:00$/.test(d) && r.daily_ends > t && r.daily_ends - t <= 25 * 3600e3, `daily shop resets at midnight ET (${iso} -> ${d})`);
  ok(/^Mon/.test(w) && /, (24|00):00:00$/.test(w) && r.weekly_ends > t && r.weekly_ends - t <= 7 * 24 * 3600e3 + 3600e3, `weekly shop resets Monday midnight ET (${iso} -> ${w})`);
  const s = SE.seasonAt(t); ok(s.start_at <= t && t <= s.end_at && /, (24|00):00:00$/.test(et(s.end_at + 1)), `season window contains now and ends at midnight ET (${et(s.end_at + 1)})`); }
// 23- and 25-hour days around DST
ok(PR.dayStart(PR.dayNum(Date.parse('2026-11-01T12:00:00-05:00')) + 1) - PR.dayStart(PR.dayNum(Date.parse('2026-11-01T12:00:00-05:00'))) === 25 * 3600e3, 'fall-back day is 25 hours long');
ok(PR.dayStart(PR.dayNum(Date.parse('2027-03-14T12:00:00-04:00')) + 1) - PR.dayStart(PR.dayNum(Date.parse('2027-03-14T12:00:00-04:00'))) === 23 * 3600e3, 'spring-forward day is 23 hours long');
// store quote + playoff windows
const M = require('../src/monetize'); ok(M.ORDER_TTL_MS === 45 * 60e3, 'Bitcoin quotes expire after 45 minutes (inside the 30-60 min rule)');
console.log(`\n${pass} passed, ${fail} failed`); fs.rmSync(dir, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
