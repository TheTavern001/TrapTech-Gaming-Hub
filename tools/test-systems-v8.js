#!/usr/bin/env node
'use strict';
// v8 systems regression (disposable DB, no server needed): cosmetic universe, shop rotation, skill achievements + quests, reward-existence fallback.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-v8-'));
process.env.DB_PATH = path.join(tmp, 'hub.db'); process.env.DATA_DIR = tmp; process.env.NODE_ENV = 'test';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'TestOnlyNoLive-1234567'; process.env.SECRET = process.env.SECRET || 'TestOnlySecret-TestOnlySecret-0123456789';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log('  FAIL', m, x === undefined ? '' : JSON.stringify(x).slice(0, 300)); } };
const db = require('../src/db'), U = require('../src/cosmetic-universe'), G = require('../src/shop-gen'), SHOP = require('../src/shop'), SK = require('../src/skill-engine'), COS = require('../src/cosmetics');
const t = Date.now(), D = 864e5;
console.log('# cosmetic universe');
const st = U.stats(U.UNIVERSE_SIZE); ok(st.unique_names === U.UNIVERSE_SIZE && st.duplicates === 0, '12,000 designs, every (type, name) unique', st);
ok(U.UNIVERSE_SIZE >= 10000, 'universe has 10,000+ designs');
const all = new Set(); for (let i = 0; i < 60000; i++) all.add(U.nameOf(i)); ok(all.size === 60000, 'names stay globally unique across 60,000 indices (edition numerals)');
for (const i of [0, 1, 5, 2, 2999, 11999, 25000]) { const id = U.idOf(i); const it = G.parse(id); ok(it && it.id === id && it.name === U.nameOf(i) && it.src === (U.isEarn(i) ? 'a' : 'u'), 'parse round trip ' + id, it && it.name); ok(!!G.itemThumbSvg(it, {}), 'card art renders ' + id); }
const seen = new Set(); let dupIdx = false; for (let n = 0; n < 24000; n++) { const i = U.shopIndex(n); if (n < 16000 && seen.has(i)) dupIdx = true; seen.add(i); if (U.isEarn(i)) dupIdx = true; } ok(!dupIdx, 'shop walks 16,000 shop designs without repeating and never mints an earn-only one');
const before = process.memoryUsage().heapUsed; for (let i = 0; i < 12000; i += 1) G.parse(U.idOf(i)); const grew = (process.memoryUsage().heapUsed - before) / 1e6; ok(grew < 40, 'parsing all 12,000 designs keeps heap growth bounded (LRU cache)', grew + ' MB');
console.log('# shop rotation');
const rot = SHOP.rotation(t + 3 * D); const ids = SHOP.allOnSale(rot).map(i => i.id); ok(ids.length >= 10 && new Set(ids).size === ids.length, 'rotation has distinct items', ids.length);
const names = []; for (let d = 1; d <= 60; d++) { const r = SHOP.rotation(t + d * D); for (const i of r.daily) if (/^(fx-)?v7u/.test(i.id)) names.push(i.name); }
ok(names.length > 0, 'post-cutover rotation is built from universe designs', names.length);
const first = new Map(); let early = 0; for (let d = 20; d <= 60; d++) { const r = SHOP.rotation(t + d * D); for (const i of r.daily) { if (!/^(fx-)?v7u/.test(i.id)) continue; const day = r.day; if (first.has(i.id) && day - first.get(i.id) < 60 && day !== first.get(i.id)) early++; if (!first.has(i.id)) first.set(i.id, day); } } ok(early === 0, 'no universe item reappears inside its 60-day minimum cooldown', early);
const cat = SHOP.catalogUniverse({ limit: 100, type: 'banner' }); ok(cat.total === 3000 && cat.items.length === 100, 'catalog pagination by type', cat.total); const srch = SHOP.catalogUniverse({ q: 'frosted', limit: 5 }); ok(srch.total > 20, 'catalog search', srch.total);
const earnOnly = SHOP.catalogUniverse({ sold: 'earn', limit: 3 }); ok(earnOnly.total === 4000 && earnOnly.items.every(i => i.earn_only), 'earn-only share is 4,000 designs', earnOnly.total);
console.log('# rewards never crash startup');
const prox = COS.BY.banner['totally-missing-design-xyz']; ok(prox && prox.name, 'unknown reward id falls back to a generated design instead of throwing'); ok(COS.generated().includes('banner:totally-missing-design-xyz'), 'fallback is recorded so test:cosmetics can flag it');
ok(COS.BY.banner[U.idOf(0)] && COS.BY.effect[U.idOf(5)], 'universe ids resolve through the cosmetics lookup maps');
console.log('# skill achievements + quests');
ok(SK.achievementTotal() >= 10000, '10,000+ achievements', SK.achievementTotal()); ok(SK.questSpace().definitions >= 1000, 'quest definition space', SK.questSpace());
const uid = db.prepare("INSERT INTO users(username,pass_hash,created_at,birth_date) VALUES('SkillQA','x',?,'1990-01-01')").run(t - 30 * D).lastInsertRowid;
const game = SK.games()[0]; const ins = db.prepare('INSERT INTO runs(user_id,game_id,score,duration_ms,started_at,created_at,held,is_demo) VALUES (?,?,?,?,?,?,?,?)');
ins.run(uid, game.id, Math.round(game.good), 60000, t - 70000, t - 10000, 0, 0); ins.run(uid, game.id, 999999999, 60000, t - 70000, t - 9000, 1, 0); ins.run(uid, game.id, 999999999, 60000, t - 70000, t - 8000, 0, 1);
const ev = SK.evaluate(uid, [game.id]); ok(ev.newCount > 5, 'first good run unlocks several ladders', ev.newCount); const best = db.prepare("SELECT MAX(CAST(substr(aid, length('a2:'||?||':best:')+1) AS INT)) n FROM ach2_unlocks WHERE user_id=? AND aid LIKE ?").get(game.id, uid, `a2:${game.id}:best:%`).n;
ok(best >= 12 && best <= 24, 'held and demo runs do not count toward score ladders', best);
ok(SK.evaluate(uid, [game.id]).newCount === 0, 'evaluating again unlocks nothing new (idempotent)');
const credits = db.prepare("SELECT COALESCE(SUM(amount),0) c FROM points_ledger WHERE user_id=? AND reason='ach2'").get(uid).c; ok(credits > 0, 'ladder credits granted once', credits);
const items = db.prepare("SELECT item_id FROM user_items WHERE user_id=?").all(uid); ok(items.every(r => /^(fx-)?v7a\d+s0$/.test(r.item_id)), 'achievement item rewards are earn-only universe designs', items);
const board = SK.board(uid); for (const p of ['daily', 'weekly', 'seasonal']) { ok(board[p].quests.length >= 4, p + ' board has quests', board[p].quests.length); ok(board[p].quests.every(q => q.target > 0 && q.title && q.desc), p + ' quests are well-formed'); }
ok(JSON.stringify(SK.board(uid).daily.quests.map(q => q.id)) === JSON.stringify(board.daily.quests.map(q => q.id)), 'assignments are stable within the period');
const b2 = db.prepare("SELECT 1").get(); const q0 = board.daily.quests[0]; ok(!SK.claim(uid, q0.id).ok || q0.done, 'unfinished quest cannot be claimed');
const target = q0.kind === 'variety' ? null : q0; if (target) { const gm = SK.gameOf(target.game); ins.run(uid, gm.id, Math.round(Math.max(target.target, target.thr || 0, gm.top * 3)) + 1, Math.max(60000, (target.target || 0) * 1200), t - 1e5, t - 5000, 0, 0); }
for (const q of SK.board(uid).daily.quests) { if (q.done) { const r = SK.claim(uid, q.id); ok(r.ok, 'finished quest can be claimed', r); ok(!SK.claim(uid, q.id).ok, 'a quest cannot be claimed twice'); } }
ok(!SK.claim(uid, 'q2.daily.D1.0.score.' + game.id + '.0').ok, 'expired/foreign quest ids are rejected'); ok(!SK.claim(uid, "q2.daily.D1';DROP TABLE users;--").ok, 'malformed quest id rejected');
ok(!!db.prepare('SELECT 1 FROM users WHERE id=?').get(uid), 'users table intact');
const other = db.prepare("INSERT INTO users(username,pass_hash,created_at,birth_date) VALUES('SkillQB','x',?,'1990-01-01')").run(t - D).lastInsertRowid; const ob = SK.board(other); ok(ob.daily.quests.length >= 4, 'brand-new player still gets a full board'); ok(!SK.claim(other, board.daily.quests[0].id).ok, "players cannot claim someone else's quest");
console.log('# css growth');
{ const heavy = db.prepare("INSERT INTO users(username,pass_hash,created_at,birth_date) VALUES('CssHoarder','x',?,'1990-01-01')").run(t - D).lastInsertRowid;
  const ins = db.prepare('INSERT OR IGNORE INTO user_items(user_id,item_id,price,acquired_at) VALUES(?,?,0,?)'); let n = 0;
  for (let i = 0; i < 6000; i++) { const r = ins.run(heavy, U.idOf(i), t - i); n += r.changes; }
  const before = SHOP.css().length; const mine = SHOP.cssMine(heavy);
  ok(n > 5000 && SHOP.css().length === before, 'owning thousands of designs does not grow the global /cosmetics.css', { n, before });
  ok(mine.split('\n').length <= 420, 'per-player CSS is capped at 400 designs', mine.split('\n').length); }
console.log(`\nsystems v8: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
