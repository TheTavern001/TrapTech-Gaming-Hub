// Official events vs free play (Phase 2). Usage: tools/fresh-api.sh tools/e2e-events.js  (or BASE=... node tools/e2e-events.js)
const BASE = process.env.BASE || 'http://localhost:8787';
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x !== undefined ? JSON.stringify(x).slice(0, 300) : ''); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function client() { const jar = {}; return async (p, o = {}) => {
  const res = await fetch(BASE + p, { method: o.method || (o.body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: o.body ? JSON.stringify(o.body) : undefined });
  for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
  const ct = res.headers.get('content-type') || ''; return { status: res.status, body: ct.includes('json') ? await res.json() : await res.text() }; }; }
(async () => {
  const ADM = require('./admin-auth').adminClient(BASE); let r = await ADM.login(); ok(r.body.ok, 'admin login');
  const A = client(), B = client(), anon = client(); const ua = 'ev_' + Math.random().toString(36).slice(2, 8), ub = 'ev_' + Math.random().toString(36).slice(2, 8);
  r = await A('/api/auth/signup', { body: { username: ua, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } }); ok(r.body.ok, 'signup A');
  r = await B('/api/auth/signup', { body: { username: ub, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } }); ok(r.body.ok, 'signup B');
  const t0 = Date.now(); const mk = async (extra) => (await ADM('/api/admin/giveaways', { body: { title: 'E2E Event', host: 'Acme', prize: 'Hoodie', start_at: t0 - 60e3, end_at: t0 + 3600e3, game_ids: ['jetpack-dash', 'sky-hopper'], active: true, ...extra } })).body;
  const ev = await mk({}); ok(ev.ok, 'admin creates an official event server-side', ev);
  r = await ADM(`/api/admin/events/${ev.id}/share`); const code = r.body.code;
  ok(/^TT-[0-9A-Z]{5}$/.test(code) && r.body.url.endsWith('/event/' + code) && /<svg/.test(r.body.qr_svg), 'vendor share kit: private /event/TT-XXXXX link + QR code', r.body);
  r = await ADM(`/api/admin/events/${ev.id}/meta`, { method: 'PUT', body: { vendor: 'Acme', booking_status: 'booked', payment_status: 'paid' } }); ok(r.body.ok, 'admin sets vendor / booking / payment status');
  const inactive = await mk({ active: false }); const future = await mk({ start_at: t0 + 3600e3, end_at: t0 + 7200e3 }); const short = await mk({ end_at: t0 + 4000 });
  const codeOf = async (id) => (await ADM(`/api/admin/events/${id}/share`)).body.code;
  const [cIn, cFut, cShort] = [await codeOf(inactive.id), await codeOf(future.id), await codeOf(short.id)];
  r = await anon('/api/event/' + code); ok(r.body.ok && r.body.event.label === `ACME x GAMING HUB, Official Giveaway #${code}` && r.body.notice.includes('Public game scores do not count'), 'public event page: label + official notice', r.body.event);
  r = await anon('/api/events'); ok(r.body.events.some(e => e.code === code) && !r.body.events.some(e => e.code === cIn), 'Official Giveaways lists active events, not inactive ones');
  r = await anon('/api/event/' + ev.id); ok(r.status === 404, 'event pages are reachable by code only (no numeric id guessing)');

  console.log('# rejections');
  r = await anon('/api/run/start', { body: { game_id: 'jetpack-dash', event: code } }); ok(r.status === 401, 'unauthenticated player rejected');
  r = await A('/api/run/start', { body: { game_id: 'jetpack-dash', event: 'TT-ZZZZZ' } }); ok(r.status === 404, 'forged event code rejected', r.body);
  r = await A('/api/run/start', { body: { game_id: 'jetpack-dash', event: 99999999 } }); ok(r.status === 404, 'forged numeric event id rejected');
  r = await A('/api/run/start', { body: { game_id: 'jetpack-dash', event: cIn } }); ok(r.status === 403, 'inactive event rejected', r.body);
  r = await A('/api/run/start', { body: { game_id: 'jetpack-dash', event: cFut } }); ok(r.status === 403 && /not started/.test(r.body.error), 'scheduled (not started) event rejected');
  await sleep(Math.max(0, t0 + 4500 - Date.now()));
  r = await A('/api/run/start', { body: { game_id: 'jetpack-dash', event: cShort } }); ok(r.status === 403 && /ended/.test(r.body.error), 'expired event rejected', r.body);
  r = await A('/api/run/start', { body: { game_id: 'drift-rush', event: code } }); ok(r.status === 400 && /not part/.test(r.body.error), 'game not assigned to the event rejected');
  r = await A('/api/run/start', { body: { game_id: 'plinko', event: code } }); ok(r.status === 400, 'just-for-fun chance game can never count');

  console.log('# free play never enters an event');
  r = await A('/api/run/start', { body: { game_id: 'jetpack-dash' } }); let tk = r.body.token; await sleep(2300);
  r = await A('/api/score', { body: { token: tk, score: 60, coins: 0, duration_ms: 2300, giveaway_id: ev.id } }); ok(r.body.ok && r.body.giveaway_status === 'not_event_run' && !(r.body.giveaways || []).length, 'public score with giveaway_id is NOT an entry (not_event_run)', r.body.giveaway_status);
  r = await anon('/api/event/' + code); ok(!r.body.board.some(x => x.username === ua), 'global score does not appear on the event board');
  r = await anon('/api/leaderboard?game=jetpack-dash&limit=500'); ok(r.body.rows.some(x => x.username === ua), 'it is on the global board');

  console.log('# event runs');
  r = await A('/api/run/start', { body: { game_id: 'jetpack-dash', event: code } }); ok(r.body.ok && r.body.event && r.body.event.code === code, 'active event issues an event-run token', r.body); tk = r.body.token;
  const [p, s] = tk.split('.'); const pl = JSON.parse(Buffer.from(p, 'base64url')); const forged = Buffer.from(JSON.stringify({ ...pl, e: future.id })).toString('base64url') + '.' + s;
  await sleep(2300);
  r = await A('/api/score', { body: { token: forged, score: 40, coins: 0 } }); ok(r.status === 400, 'token re-pointed at another event (bad signature) rejected');
  const A2 = client(); await A2('/api/auth/signin', { body: { username: ua, password: 'hunter2hunter2' } });
  r = await A2('/api/score', { body: { token: tk, score: 40, coins: 0, duration_ms: 2300 } }); ok(r.status === 403 && /session/.test(r.body.error), 'event token bound to the session that started it', r.body);
  r = await B('/api/score', { body: { token: tk, score: 40, coins: 0 } }); ok(r.status === 403, 'event token bound to the player');
  r = await A('/api/run/start', { body: { game_id: 'jetpack-dash', event: code } }); const tk2 = r.body.token; await sleep(2300);
  r = await A('/api/score', { body: { token: tk2, score: 999999, coins: 0, duration_ms: 2300 } }); ok(r.status === 422, 'implausible event run rejected by anti-cheat');
  r = await A('/api/run/start', { body: { game_id: 'jetpack-dash', event: code } }); const tk3 = r.body.token; await sleep(2300);
  r = await A('/api/score', { body: { token: tk3, score: 45, coins: 0, duration_ms: 2300 } }); ok(r.body.ok, 'plausible event run accepted', r.body);
  r = await A('/api/score', { body: { token: tk3, score: 45, coins: 0, duration_ms: 2300 } }); ok(r.status === 409, 'replayed event-run token rejected');
  r = await anon('/api/event/' + code); const row = r.body.board.find(x => x.username === ua);
  ok(row && row.score === 45, 'event board shows only the event run (45), never the global 60', r.body.board);
  r = await anon(`/api/leaderboard?giveaway=${ev.id}`); ok(r.body.rows.every(x => x.username !== ua || x.score === 45), 'giveaway leaderboard = event board');
  for (const id of [ev.id, inactive.id, future.id, short.id]) await ADM('/api/admin/giveaways/' + id, { method: 'DELETE' });
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
