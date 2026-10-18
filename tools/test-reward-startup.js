'use strict';
// Achievement/quest/shop reward existence + server startup resilience. Run: npm run test:rewards-startup
// 1) every hand-made reward id has a design; 2) every reward-bearing skill achievement resolves to a real earn-only cosmetic;
// 3) the real server STARTS and serves /healthz and /api/shop even when the database holds rewards/orders that point at
//    cosmetic ids that do not exist (the reward-existence check must warn, never crash).
const fs = require('fs'), os = require('os'), path = require('path'), { spawn } = require('child_process');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rwst-'));
process.env.SECRET = process.env.SECRET || 'test-secret-test-secret-test-secret'; process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-admin-password-123456';
process.env.DATA_DIR = tmp; process.env.DB_PATH = path.join(tmp, 'hub.db');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x !== undefined ? JSON.stringify(x).slice(0, 300) : ''); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  console.log('# reward designs exist');
  const COS = require('../src/cosmetics'); require('../src/achievements'); const SH = require('../src/shop');
  ok(COS.generated().length === 0, 'no hand-made reward id is missing a design', COS.generated().slice(0, 5));
  const SK = require('../src/skill-engine'); let withItem = 0, bad = [];
  for (const g of SK.games()) for (const fam of SK.FAMILIES) { const lad = SK.ladderOf(fam, g); for (let n = 1; n <= lad.length; n++) { const d = SK.def(`a2:${g.id}:${fam.id}:${n}`); if (!d || !d.item) continue; withItem++;
    const UNI = require('../src/cosmetic-universe'); const it = SH.BY_ID[UNI.idOf(UNI.earnIndex(`a2:${g.id}:${fam.id}:${n}#0`))]; if (!it || !it.name || it.price == null && it.src == null) bad.push(`${g.id}:${fam.id}:${n}`); } }
  ok(withItem > 500 && bad.length === 0, `${withItem} reward-bearing achievements all resolve to a cosmetic`, bad.slice(0, 5));
  console.log('# startup with dangling rewards');
  const D = require('../src/db'); const t = Date.now();
  const uid = D.prepare("INSERT INTO users (username, pass_hash, created_at) VALUES ('dangler','x',?)").run(t).lastInsertRowid;
  D.prepare('INSERT OR IGNORE INTO user_items (user_id,item_id,price,acquired_at) VALUES (?,?,0,?)').run(uid, 'does-not-exist-1', t);
  D.prepare('INSERT OR IGNORE INTO user_items (user_id,item_id,price,acquired_at) VALUES (?,?,0,?)').run(uid, 'v7zzzzzz9', t);
  try { D.prepare("INSERT INTO quest2_claims (user_id,qid,at,credits,item_id) VALUES (?,?,?,?,?)").run(uid, 'q:gone', t, 10, 'does-not-exist-2'); } catch {}
  try { D.prepare("INSERT INTO store_orders (ref,user_id,product_id,usd_cents,provider,status,created_at,expires_at) VALUES ('ODANGLE',?,'cos:does-not-exist-3',99,'bitcoin','pending',?,?)").run(uid, t, t + 1e6); } catch {}
  D.close();
  const port = 8900 + Math.floor(Math.random() * 90);
  const srv = spawn(process.execPath, ['src/server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: String(port), NODE_ENV: 'production', PAY_NO_SWEEP: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d); let exited = null; srv.on('exit', c => exited = c);
  let up = false; for (let i = 0; i < 60 && exited === null; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/healthz`); if (r.ok) { up = true; break; } } catch {} await sleep(500); }
  ok(up && exited === null, 'server boots and answers /healthz with dangling rewards in the database', log.slice(-300));
  if (up) {
    let r = await fetch(`http://127.0.0.1:${port}/api/shop`); ok(r.status === 200, '/api/shop still serves', r.status);
    r = await fetch(`http://127.0.0.1:${port}/api/skill/achievements`); ok(r.status === 200, '/api/skill/achievements still serves', r.status);
    r = await fetch(`http://127.0.0.1:${port}/cosmetics.css`); const css = await r.text(); ok(r.status === 200 && css.length < 400e3, 'global stylesheet serves and is bounded', css.length);
    r = await fetch(`http://127.0.0.1:${port}/api/users/dangler`); ok(r.status < 500, 'profile of a player owning unknown ids does not 500', r.status);
  }
  ok(!/Unhandled|TypeError|ReferenceError/.test(log), 'no unhandled errors during boot', log.slice(-300));
  srv.kill(); await sleep(300); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nrewards/startup: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
