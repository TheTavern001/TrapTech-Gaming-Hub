// Load generator (no browser): simulates distinct users end to end against a LOCAL server.
// Usage: BASE=http://127.0.0.1:8899 PID=<server pid> DB=<db path> USERS=20000 STAGES="50:1000,200:4000,500:8000,800:7000" node tools/loadtest.js
// STAGES = concurrency:users pairs, run one after the other. Every user gets a unique X-Forwarded-For (the production server trusts one proxy hop, as behind Cloudflare/Deplexo).
const fs = require('fs'); const { Agent, setGlobalDispatcher } = (() => { try { return require('undici'); } catch { return {}; } })();
const BASE = process.env.BASE || 'http://127.0.0.1:8899'; const PID = process.env.PID; const DB = process.env.DB;
const USERS = +(process.env.USERS || 20000); const STAGES = (process.env.STAGES || '50:1000,200:4000,500:8000,800:7000').split(',').map(s => s.split(':').map(Number));
const GAMES = ['jetpack-dash', 'drift-rush', 'memory-match', 'stack', 'high-score', 'terp-tapper'];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const lat = {}; const codes = {}; let errors = 0, reqs = 0, netErr = 0;
const rec = (name, ms, status) => { (lat[name] = lat[name] || []).push(ms); const k = name + ' ' + status; codes[k] = (codes[k] || 0) + 1; reqs++; if (status >= 500 || status === 0) errors++; };
function client(ip) {
  const jar = {};
  return async (name, p, body) => {
    const t = performance.now(); let status = 0, data = null;
    try {
      const res = await fetch(BASE + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: body ? JSON.stringify(body) : undefined });
      status = res.status; for (const c of res.headers.getSetCookie ? res.headers.getSetCookie() : []) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
      const ct = res.headers.get('content-type') || ''; data = ct.includes('json') ? await res.json() : (await res.arrayBuffer(), null);
    } catch (e) { status = 0; netErr++; }
    rec(name, performance.now() - t, status); return { status, data };
  };
}
const pct = (a, q) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };
const rss = () => { try { const s = fs.readFileSync(`/proc/${PID}/status`, 'utf8'); return { rss: +s.match(/VmRSS:\s+(\d+)/)[1] / 1024, hwm: +s.match(/VmHWM:\s+(\d+)/)[1] / 1024 }; } catch { return { rss: 0, hwm: 0 }; } };
const fsz = (f) => { try { return fs.statSync(f).size / 1048576; } catch { return 0; } };
let uid = 0, done = 0, active = 0;
async function journey(i) {
  const ip = `${10 + (i >> 16) % 200}.${(i >> 8) & 255}.${i & 255}.${1 + (i * 7) % 250}`; const c = client(ip); const u = `ld${i.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const s = await c('signup', '/api/auth/signup', { username: u, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' });
  if (s.status !== 200) return;
  await c('page:home', '/'); await c('api:me', '/api/me'); await c('api:games', '/api/games'); await c('api:quests', '/api/quests');
  await c('api:giveaways', '/api/giveaways'); await c('api:shop', '/api/shop'); await c('api:store', '/api/store');
  const g = GAMES[i % GAMES.length]; const st = await c('run:start', '/api/run/start', { game_id: g });
  if (st.status === 200) { await sleep(2500 + Math.random() * 2000); await c('run:score', '/api/score', { token: st.data.token, score: 5 + (i % 20), coins: 0, duration_ms: 3000 }); }
  await c('api:leaderboard', '/api/leaderboard?game=' + g); await c('api:leaderboard-global', '/api/leaderboard?period=all'); await c('api:achievements', '/api/skill/achievements');
  const gw = await c('api:giveaway-list', '/api/giveaways'); const first = gw.data && gw.data.giveaways && gw.data.giveaways[0];
  if (first) { await c('api:giveaway', '/api/giveaways/' + first.id); await c('giveaway:join', `/api/giveaways/${first.id}/join`, {}); }
  await c('page:shop', '/shop'); await c('api:notifications', '/api/notifications');
  if (i % 4 === 0) { await c('auth:signout', '/api/auth/signout', {}); await c('auth:signin', '/api/auth/signin', { username: u, password: 'hunter2hunter2' }); await c('api:me2', '/api/me'); }
}
(async () => {
  console.log(`load test: ${USERS} users, stages ${JSON.stringify(STAGES)}, base ${BASE}`); const t0 = Date.now(); const samples = []; let peakRss = 0;
  const sampler = setInterval(() => { const m = rss(); peakRss = Math.max(peakRss, m.hwm); samples.push([Math.round((Date.now() - t0) / 1000), done, active, +m.rss.toFixed(0), +m.hwm.toFixed(0), +fsz(DB).toFixed(1)]); }, 5000);
  let total = 0;
  for (const [conc, n] of STAGES) {
    const target = Math.min(n, USERS - total); if (target <= 0) break; const ts = Date.now(); const e0 = errors, r0 = reqs;
    let launched = 0; await new Promise((resolve) => { const pump = () => { while (active < conc && launched < target) { launched++; active++; const i = uid++; journey(i).catch(() => { errors++; }).finally(() => { active--; done++; if (launched >= target && active === 0) resolve(); else pump(); }); } }; pump(); });
    total += target; const m = rss(); console.log(`stage conc=${conc} users=${target}: ${((Date.now() - ts) / 1000).toFixed(0)}s, ${reqs - r0} req, 5xx/net errors ${errors - e0}, server RSS ${m.rss.toFixed(0)} MB (peak ${m.hwm.toFixed(0)}), db ${fsz(DB).toFixed(1)} MB (+wal ${fsz(DB + '-wal').toFixed(1)})`);
  }
  clearInterval(sampler);
  const out = { users: total, requests: reqs, errors5xx_or_net: errors, error_pct: +(errors / reqs * 100).toFixed(3), net_errors: netErr, seconds: Math.round((Date.now() - t0) / 1000), peak_rss_mb: peakRss, db_mb: fsz(DB), codes, latency_ms: {} };
  for (const k of Object.keys(lat)) out.latency_ms[k] = { n: lat[k].length, p50: +pct(lat[k], .5).toFixed(0), p95: +pct(lat[k], .95).toFixed(0), p99: +pct(lat[k], .99).toFixed(0), max: +Math.max(...lat[k]).toFixed(0) };
  out.samples = samples.filter((_, i) => i % 6 === 0); console.log(JSON.stringify(out, null, 1));
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
})();
