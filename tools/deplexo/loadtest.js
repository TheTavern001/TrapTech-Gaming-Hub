// Load test for the Deplexo memory budget: N concurrent "players" sign up, then loop over
// leaderboard / profile / run start + score submit / OG share images for DURATION seconds.
// Usage: BASE=http://127.0.0.1:8801 USERS=10000 ISOLATED_TEST_DB=1 PARALLEL=200 DURATION=6 node tools/deplexo/loadtest.js
// 10,000 test identities are exercised in bounded waves. PARALLEL is the actual concurrency, not USERS.
// Each virtual user sends its own CF-Connecting-IP so the per-IP rate limits behave like real traffic.
'use strict';
const BASE = process.env.BASE || 'http://127.0.0.1:8801';
// This tool creates actual accounts and writes scores. Never point at a production URL.
// 10k+ population testing must use an isolated disposable local database, NOT Deplexo live storage.
const url = new URL(BASE);
if (url.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname)) {
  throw new Error('Refusing load test against a non-local URL. Run on an isolated disposable localhost database.');
}
const USERS = Number(process.env.USERS || 50);
if (!Number.isSafeInteger(USERS) || USERS < 1 || USERS > 20000) throw new Error('USERS must be an integer between 1 and 20000.');
if (USERS > 250 && process.env.ISOLATED_TEST_DB !== '1') throw new Error('Set ISOLATED_TEST_DB=1 only after verifying a disposable test database; production data must remain untouched.');
const DURATION = Number(process.env.DURATION || 60) * 1000;
if (!Number.isFinite(DURATION) || DURATION < 1000 || DURATION > 3600000) throw new Error('DURATION must be 1 to 3600 seconds.');
const OG = process.env.OG !== '0'; // OG=0 skips share-image requests (to isolate API memory)
const GAMES = ['jetpack-dash', 'drift-rush', 'high-score', 'terp-tapper', 'stack', 'munchies-snake', 'brick-breaker', 'sky-hopper', 'void-swarm'];
const stats = { req: 0, err: 0, s429: 0, s5xx: 0, lat: [], byKind: {}, signupsAccepted: 0, signupsFailed: 0 };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function call(ip, jar, p, body, kind) {
  const t = performance.now();
  try {
    const res = await fetch(BASE + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, 'Accept-Encoding': 'gzip', ...(jar.c ? { Cookie: jar.c } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : []; for (const c of sc) if (c.startsWith('gh_sess=')) jar.c = c.split(';')[0];
    const buf = Buffer.from(await res.arrayBuffer());
    stats.req++; const k = stats.byKind[kind] = stats.byKind[kind] || { n: 0, ms: 0, bad: 0 }; k.n++; const ms = performance.now() - t; k.ms += ms; if (stats.lat.length < 200000) stats.lat.push(ms);
    else { const j = Math.floor(Math.random() * stats.req); if (j < 200000) stats.lat[j] = ms; }
    if (res.status === 429) stats.s429++; if (res.status >= 500) { stats.s5xx++; k.bad++; }
    if (res.headers.get('content-type')?.includes('json')) return { status: res.status, body: JSON.parse(buf.toString()) };
    return { status: res.status, size: buf.length };
  } catch (e) { stats.err++; const m = (e.cause && (e.cause.code || e.cause.message)) || e.message; stats.errs = stats.errs || {}; stats.errs[kind + ':' + m] = (stats.errs[kind + ':' + m] || 0) + 1; return { status: 0, error: e.message }; }
}
async function vu(i, end) {
  const ip = `10.77.${(i >> 8) & 255}.${i & 255}`; const jar = {};
  const name = 'lt_' + Math.random().toString(36).slice(2, 9);
  const signup = await call(ip, jar, '/api/auth/signup', { username: name, password: 'loadtest-pass-1', agree: true, dob: '1990-01-01' }, 'signup');
  if (!signup.body?.ok) { stats.signupsFailed++; return; }
  stats.signupsAccepted++;
  let lastRun = null;
  while (Date.now() < end) {
    const g = GAMES[(Math.random() * GAMES.length) | 0];
    await call(ip, jar, `/api/leaderboard?game=${g}&period=${['all', 'weekly', 'monthly'][(Math.random() * 3) | 0]}`, null, 'leaderboard');
    await call(ip, jar, '/api/leaderboard?game=global', null, 'leaderboard');
    const st = await call(ip, jar, '/api/run/start', { game_id: 'jetpack-dash' }, 'run_start');
    await call(ip, jar, '/api/me', null, 'me');
    await call(ip, jar, '/api/achievements', null, 'achievements');
    await sleep(2500 + Math.random() * 1500);
    if (st.body && st.body.token) {
      const sc = await call(ip, jar, '/api/score', { token: st.body.token, score: 20 + ((Math.random() * 50) | 0), coins: 1, duration_ms: 2500 }, 'score');
      if (sc.body && sc.body.run_id) lastRun = sc.body.run_id;
    }
    // OG share images: run card (new run id => cache miss), profile card, default
    if (OG && lastRun) await call(ip, jar, `/og/run/${lastRun}.png`, null, 'og_run');
    if (OG && Math.random() < 0.3) await call(ip, jar, `/og/u/${name}.png`, null, 'og_profile');
    if (OG && Math.random() < 0.2) await call(ip, jar, '/og/default.png', null, 'og_default');
    if (Math.random() < 0.3) await call(ip, jar, `/s/${lastRun || 1}`, null, 'share_page');
    if (Math.random() < 0.3) await call(ip, jar, `/api/profile/${name}`, null, 'profile');
    if (Math.random() < 0.2) await call(ip, jar, '/api/giveaways', null, 'giveaways');
    if (Math.random() < 0.2) await call(ip, jar, '/api/community', null, 'community');
  }
}
(async () => {
  // Bound active connections on inexpensive test hardware, but cycle through every virtual user.
  const PARALLEL = Math.min(1000, Math.max(1, Number(process.env.PARALLEL || Math.min(USERS, 100))));
  if (!Number.isSafeInteger(PARALLEL)) throw new Error('PARALLEL must be an integer');
  let cursor=0, attempted=0; const t0=Date.now();
  await Promise.all(Array.from({length:Math.min(PARALLEL, USERS)}, async () => {
    while (cursor < USERS) { const id = ++cursor; await vu(id, Date.now() + DURATION); attempted++; }
  }));
  stats.lat.sort((a,b)=>a-b);
  const q=p=>stats.lat[Math.min(stats.lat.length-1,Math.floor(stats.lat.length*p))]||0;
  const seconds=Math.max(1,(Date.now()-t0)/1000);
  const by=Object.fromEntries(Object.entries(stats.byKind).map(([k,v])=>[k,{n:v.n,avg_ms:Math.round(v.ms/v.n),err5xx:v.bad}]));
  console.log(JSON.stringify({
    virtualUsersTarget:USERS, virtualUsersAttempted:attempted, registeredUsers:stats.signupsAccepted,
    signupFailures:stats.signupsFailed, actualMaxConcurrentWorkers:Math.min(PARALLEL,USERS),
    perUserSeconds:DURATION/1000, elapsedSeconds:Math.round(seconds),
    requests:stats.req, rps:+(stats.req/seconds).toFixed(1), netErrors:stats.err,
    netErrorKinds:stats.errs||{}, s429:stats.s429, s5xx:stats.s5xx,
    p50_ms:Math.round(q(.5)), p95_ms:Math.round(q(.95)), p99_ms:Math.round(q(.99)), by,
    warning:'Local disposable database only. 10k virtual users is not 10k simultaneous connections; check actualMaxConcurrentWorkers. Browser/device testing and persistent-storage stress are separate launch gates.'
  },null,2));
  if(stats.signupsFailed||stats.err||stats.s5xx)process.exitCode=1;
})().catch(e=>{console.error('Load test failure',e);process.exitCode=1;});
