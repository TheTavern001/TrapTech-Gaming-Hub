'use strict';
// v7 economy engine tests (src/shop.js, src/shop-gen.js, src/seasons.js; docs/ECONOMY.md). Runs in-process on a fresh
// throwaway database, so nothing touches the dev server. Usage: node tools/e2e-economy.js
const fs = require('fs'); const path = require('path'); const os = require('os'); const { execFileSync } = require('child_process');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'econ-')); process.env.DB_PATH = path.join(dir, 'hub.db'); process.env.DATA_DIR = dir;
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 300) : '')); } };
const db = require(path.join(ROOT, 'src', 'db'));
const SH = require(path.join(ROOT, 'src', 'shop')); const G = require(path.join(ROOT, 'src', 'shop-gen')); const SE = require(path.join(ROOT, 'src', 'seasons')); const PR = require(path.join(ROOT, 'src', 'progress'));
const COS = require(path.join(ROOT, 'src', 'cosmetics')); const cfg = require(path.join(ROOT, 'src', 'config'));
const D = 864e5; const at = (iso) => Date.parse(iso);
const mkUser = (name) => db.prepare("INSERT INTO users (username, pass_hash, created_at, birth_date) VALUES (?, 'x', ?, '1990-01-01')").run(name, Date.now() - 90 * D).lastInsertRowid;

console.log('# rotations are deterministic (same shop in any process, any query order)');
const probe = `const S=require(${JSON.stringify(path.join(ROOT, 'src', 'shop'))});const ts=JSON.parse(process.argv[1]);const o={};for(const t of ts){const r=S.rotation(t);o[t]=[r.daily.map(i=>i.id),r.weekly.map(i=>i.id),r.season.items.map(i=>i.id)];}console.log(JSON.stringify(o));`;
const T = [at('2027-03-03T15:00:00Z'), at('2026-10-05T15:00:00Z'), at('2028-01-10T15:00:00Z'), at('2026-12-24T15:00:00Z')];
const run = (ts) => JSON.parse(execFileSync(process.execPath, ['-e', probe, JSON.stringify(ts)], { env: { ...process.env, DB_PATH: path.join(dir, 'probe.db') } }).toString());
const a = run(T), b = run([...T].reverse());
ok(T.every(t => JSON.stringify(a[t]) === JSON.stringify(b[t])), 'two processes, opposite query order: identical daily / weekly / season shops');
ok(T.every(t => JSON.stringify(a[t][0]) === JSON.stringify(SH.rotation(t).daily.map(i => i.id))), 'this process agrees with both');

console.log('# timers roll over at local midnight / Monday / season end');
const lateSun = at('2026-10-12T03:59:00Z'), monAm = at('2026-10-12T04:00:30Z'); // Sun Oct 11 23:59 ET -> Mon Oct 12 00:00:30 ET
const r1 = SH.rotation(lateSun), r2 = SH.rotation(monAm);
ok(r1.daily_ends === at('2026-10-12T04:00:00Z') && r1.weekly_ends === at('2026-10-12T04:00:00Z'), 'Sunday 11:59 PM ET: daily and weekly both end at Monday 12:00 AM ET');
ok(r1.daily.map(i => i.id).join() !== r2.daily.map(i => i.id).join() && r1.weekly.map(i => i.id).join() !== r2.weekly.map(i => i.id).join(), 'at midnight Monday both the daily and weekly sections change');
const tue = SH.rotation(at('2026-10-13T16:00:00Z')); ok(tue.weekly.map(i => i.id).join() === r2.weekly.map(i => i.id).join() && tue.daily.map(i => i.id).join() !== r2.daily.map(i => i.id).join(), 'Tuesday: new daily picks, same weekly featured');
const s1 = SE.seasonAt(at('2026-11-26T04:59:59Z')), s2 = SE.seasonAt(at('2026-11-26T05:00:01Z'));
ok(s1.number === 1 && s2.number === 2 && s1.end_at === at('2026-11-26T05:00:00Z') - 1 && s1.length_days === 56, 'Season 1 (8 weeks) ends Wed Nov 25 11:59:59 PM ET, Season 2 starts at midnight', [s1, s2]);
ok(SH.rotation(at('2026-11-25T20:00:00Z')).season.items[0].id !== SH.rotation(at('2026-11-26T15:00:00Z')).season.items[0].id, 'season shop items change with the season');
ok(SE.seasonAt(at('2031-06-01T12:00:00Z')).number > 30, `seasons keep rolling forever (June 2031 = Season ${SE.seasonAt(at('2031-06-01T12:00:00Z')).number})`);

console.log('# 2-year simulation: the generator never runs out and the v8 long-cooldown rotation holds (no Vault, no retirement)');
const t0 = Date.now(); const start = SH.EPOCH_DAY; const days = 730; let dupes = 0, overlap = 0, short = 0, newPerDay = 0, cooldownBreaks = 0, eventDays = 0; const seenLast = new Map(); const vaultGaps = []; const capBreaks = [];
const nonVault = new Map();
for (let d = start; d < start + days; d++) {
  const r = SH.rotation(PR.dayStart(d) + 12 * 3600e3); const ids = r.daily.map(i => i.id); const w = r.weekly.map(i => i.id);
  if (new Set(ids).size !== ids.length) dupes++; if (ids.some(i => w.includes(i))) overlap++; if (ids.length !== 6 || w.length !== 4) short++;
  newPerDay += ids.filter(i => r.tags[i] === 'new').length; if (r.events.length) eventDays++;
  for (const it of r.daily) { const last = seenLast.get(it.id); const tag = r.tags[it.id];
    if (tag === 'returning') { if (last !== undefined) vaultGaps.push(d - last); if (last !== undefined && d - last < SH.COOL[it.rarity]) cooldownBreaks++; } else { if (d >= SH.EPOCH_DAY + 17 && last !== undefined && d - last < SH.COOL[it.rarity] && tag !== 'new') cooldownBreaks++; nonVault.set(it.id, (nonVault.get(it.id) || 0) + 1); }
    seenLast.set(it.id, d); }
  for (const it of r.weekly) seenLast.set(it.id, d + 6 - ((d + 3) % 7));
  for (const it of r.season.items) seenLast.set(it.id, d);
}
const simMs = Date.now() - t0; const st = SH.stats();
ok(short === 0 && dupes === 0 && overlap === 0, `every day has 6 daily + 4 weekly items, no duplicates, daily never repeats a weekly item (${days} days)`);
ok(newPerDay >= days * 2, `at least 2 brand-new daily items every day (${newPerDay} over ${days} days; more are minted whenever nothing has finished its cooldown)`);
ok(SH._sim.intro.filter(([d]) => d < start + days).length >= days * 2 + 200, `${SH._sim.intro.filter(([d]) => d < start + days).length} generated items introduced in 2 years (never runs out)`);
ok(cooldownBreaks === 0, `after the 2026-10-18 cutover no daily item reappears inside its rarity cooldown (${cooldownBreaks} breaks)`);
ok(!vaultGaps.some(g => g < 60), 'nothing is ever retired: items just rest 60 / 120 / 180 / 270 days by rarity, then return');
ok(vaultGaps.length > 50 && vaultGaps.every(g => g >= 60), `returning items happen (${vaultGaps.length}) and always after their cooldown (min ${Math.min(...vaultGaps)} days)`);
ok(eventDays >= 2 * 60 && SH.rotation(at('2026-10-31T16:00:00Z')).events.some(e => e.name === 'Spooky Haze') && SH.rotation(at('2027-04-20T16:00:00Z')).events.some(e => e.name === '4/20 Week') && SH.rotation(at('2027-10-03T16:00:00Z')).events.some(e => e.name === 'Hub Birthday Week'), `calendar events run on their dates (${eventDays} event days in 2 years)`);
const ev27 = SH.rotation(at('2027-10-31T16:00:00Z')).events.find(e => e.name === 'Spooky Haze'); ok(ev27 && ev27.items.length === 6 && ev27.items.some(i => /^(fx-)?v7e2026/.test(i.id)), 'year-two events bring 4 new items + 2 returning from last year');
ok(simMs < 20000, `2-year simulation in ${simMs} ms`);
// generated items are well-formed
const sample = SH._sim.intro.slice(0, 400).map(([, id]) => SH.BY_ID[id]);
const badGen = sample.filter(i => !i || !i.name || /undefined|NaN/.test(i.name + G.itemCss(i)) || (i.type === 'banner' && (s => !s.startsWith('<svg') || !s.trim().endsWith('</svg>') || /undefined|NaN/.test(s) || s.length >= 16000)(G.bannerSvg(i.art.seed, i.palette, i.art.motif, i.rarity))));
ok(badGen.length === 0, 'generated names, CSS and banner SVGs are well-formed (no undefined / NaN, < 16 KB each)', badGen.slice(0, 3).map(i => i && [i.id, i.type, i.name]));
ok(new Set(sample.map(i => i.name)).size > sample.length * 0.6 && new Set(sample.filter(i => i.type === 'banner').map(i => i.art.motif)).size >= 10, `variety: ${new Set(sample.map(i => i.name)).size} distinct names in 400 items, ${new Set(sample.filter(i => i.type === 'banner').map(i => i.art.motif)).size} banner motifs`);
ok(G.parse(sample[5].id) === G.parse(sample[5].id) && SH.BY_ID[sample[5].id].name === G.make(sample[5].src, sample[5].num, sample[5].slot).name && !SH.BY_ID['v7d1s99x'], 'an id always rebuilds the same item; junk ids resolve to nothing');
ok(COS.BY.banner[sample.find(i => i.type === 'banner').id] && COS.BY.title[sample.find(i => i.type === 'title').id], 'generated items resolve in the cosmetics lookup (equip + leaderboards)');

console.log('# prices: rarity x type x demand x scarcity x appearances (no fixed tiers)');
const now = SH.rotation(); const onSale = SH.allOnSale(now);
const prices = onSale.map(i => i.price); ok(new Set(prices).size >= onSale.length - 3, `${new Set(prices).size} different prices across ${onSale.length} items on sale`, prices);
ok(onSale.every(i => { const b = SH.RARITY[i.rarity].price * SH.TYPE_MULT[i.type]; return i.price >= Math.max(50, b * 0.6 - 5) && i.price <= b * 2.2 + 5 && i.price % 5 === 0; }), 'every price is within 0.6x-2.2x of its base and rounded to 5');
const target = now.daily.find(i => i.generated && now.tags[i.id] !== 'new') || now.daily[2]; const before = SH.priceParts(target);
const buyers = []; for (let k = 0; k < 30; k++) buyers.push(mkUser('buyer' + k));
for (const u of buyers.slice(0, 12)) db.prepare('INSERT INTO user_items (user_id, item_id, price, acquired_at) VALUES (?,?,?,?)').run(u, target.id, 100, Date.now() - 3 * D);
const tomorrow = PR.dayStart(PR.dayNum(Date.now()) + 1) + 3600e3; const after = SH.priceParts(target, tomorrow);
ok(after.demand > before.demand && after.recent_buys === 12, `demand: 12 recent buys raise the demand factor ${before.demand} -> ${after.demand}`);
const t2 = now.daily.find(i => i.id !== target.id); const p2 = SH.priceParts(t2).price;
for (const u of buyers.slice(12, 30)) db.prepare('INSERT INTO user_items (user_id, item_id, price, acquired_at) VALUES (?,?,?,?)').run(u, t2.id, 100, Date.now());
ok(SH.priceParts(t2).price === p2 && SH.priceParts(t2, tomorrow).recent_buys === 18, "today's price holds all day: 18 buys today only count from tomorrow");

console.log('# earned (score / leaderboard gated) items');
const pro = SH.GATES.find(g => g.kind === 'score' && g.slot === 0); const elite = SH.GATES.find(g => g.game === pro.game && g.slot === 1);
const R = require(path.join(ROOT, 'docs', 'score-ranges.json')).games[pro.game];
ok(pro.need > 0 && Math.abs(pro.need - R.good.median_pb) / R.good.median_pb < 0.06 && Math.abs(elite.need - R.top1.pb) / R.top1.pb < 0.06, `${pro.game}: Pro at ${pro.need} (strong player best ${R.good.median_pb}), Elite at ${elite.need} (top 1% ${R.top1.pb}) from docs/score-ranges.json`);
const gu = mkUser('gatecheck'); const insRun = db.prepare('INSERT INTO runs (user_id, game_id, score, started_at, created_at) VALUES (?,?,?,?,?)');
insRun.run(gu, pro.game, pro.need + 1, Date.now() - 60e3, Date.now() - 30e3); SH.sync(gu);
const own = SH.owned(gu); ok(own.has(SH.gateItem(pro).id) && !own.has(SH.gateItem(elite).id), 'a Pro-level score unlocks the Pro banner, not the Elite frame');
ok(!SH.buy({ id: gu }, SH.gateItem(elite).id).ok, 'earned items cannot be bought');
const wk = SH.GATES.filter(g => g.kind === 'weekly'); ok(wk.length === 2, 'weekly leaderboard rewards: Weekly Podium badge + Weekly Top 10 title');
const lastWeekRun = PR.dayStart(Math.floor((PR.dayNum(Date.now()) + 3) / 7) * 7 - 3 - 4) + 3600e3; insRun.run(gu, pro.game, 99, lastWeekRun - 60e3, lastWeekRun);
SH.grantWeekly(); ok(SH.owned(gu).has(SH.gateItem(wk[0]).id), "last week's #1 on a game board gets the Weekly Podium badge");
ok(SH.grantWeekly() === 0, 'weekly grants run once per week');
const RUNP = SH.EARN; const ru = mkUser('earncheck'); insRun.run(ru, pro.game, 1, Date.now() - 50e3, Date.now() - 40e3); insRun.run(ru, pro.game, elite.need + 10, Date.now() - 30e3, Date.now() - 20e3);
SH.sync(ru); const rl = db.prepare("SELECT amount FROM points_ledger WHERE user_id=? AND reason='run' ORDER BY id").all(ru).map(x => x.amount);
ok(rl[0] === RUNP.run && rl[1] === RUNP.run + RUNP.pb + RUNP.skill.top1, `EARN: a casual run pays ${rl[0]}, a top-1% personal best pays ${rl[1]}`, rl);

console.log('# buying');
const bu = mkUser('buycheck'); db.prepare("INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, 99999, 'test', 'g', ?)").run(bu, Date.now());
const pick = now.season.items[0]; let br = SH.buy({ id: bu }, pick.id); ok(br.ok && br.price === pick.price, `season shop item bought for ${br.price}`, br);
const evItem = (now.events[0] || { items: [] }).items[0]; if (evItem) { br = SH.buy({ id: bu }, evItem.id); ok(br.ok, `event item bought (${evItem.name})`); }
const offShelf = SH.BY_ID[SH._sim.intro.find(([d]) => d > PR.dayNum(Date.now()) + 30)[1]]; ok(!SH.buy({ id: bu }, offShelf.id).ok, 'items not on sale today cannot be bought');
ok(!SH.buy({ id: bu }, SE.trackItem(1, 0).id).ok, 'season track rewards cannot be bought');

console.log('# seasons: track, rewards, perks, end -> archive -> hall of fame -> head start');
ok(SE.CUM[60] === 30300 && SE.levelOf(0).level === 0 && SE.levelOf(30300).level === 60 && SE.levelOf(30300 + 4500).overdrive === 2, '60 levels / 30,300 XP, Overdrive stars every 2,000 XP after');
const sp = SE.seasonProgress(null); ok(sp.track.length === 60 && sp.track.filter(t => t.item).length === 13 && sp.perks.length === 6 && sp.track.filter(t => !t.item).every(t => t.points >= 40), 'track: 13 season-exclusive cosmetics, Hub Points on every other level, 6 perks');
const su = mkUser('seasoncheck'); const sNow = SE.seasonAt();
for (let k = 0; k < 400; k++) insRun.run(su, 'jetpack-dash', 5000, sNow.start_at + 60e3 + k * 1000, sNow.start_at + 61e3 + k * 1000);
const prog = SE.seasonProgress(su); const cl = SE.claimTrack(su); ok(prog.level >= 20 && cl.points > 0 && cl.items.length >= 4 && SE.claimTrack(su).points === 0, `level ${prog.level}: claimed ${cl.points} pts + ${cl.items.length} cosmetics once (idempotent)`);
ok(SE.perksOf(su).discount >= 5 && SH.priceFor(pick, { id: su }) < pick.price, `season perk discount applies (${SE.perksOf(su).discount}% off: ${pick.price} -> ${SH.priceFor(pick, { id: su })})`);
const b4 = SE.seasonAt(); const upd = SE.adminUpdate(b4.number, { name: 'Test Name', ends_at: b4.end_at + 7 * D }, { username: 'owner' });
ok(upd.ok && SE.seasonAt().name === 'Test Name' && SE.info(b4.number + 1).start_at === b4.end_at + 7 * D + 1, 'admin extends the live season by a week: the next season moves with it');
ok(!SE.adminUpdate(b4.number, { ends_at: Date.now() + 60e3 }).ok && !SE.adminEnd({}, 'wrong name').ok, 'guards: no end inside the next hour, end-now needs the season name');
const xpS = SE.seasonProgress(su).xp; const end = SE.adminEnd({ username: 'owner' }, 'Test Name');
ok(end.ok && end.archived >= 1 && SE.seasonAt().number === b4.number + 1, `end season now: ${end.archived} players archived, Season ${b4.number + 1} live`);
const hof = SE.hallOfFame(); ok(hof[0] && hof[0].number === b4.number && hof[0].top[0].username === 'seasoncheck', 'hall of fame lists the top players of the ended season');
ok(SH.owned(su).has(SE.trackItem(b4.number, 91).id) && SH.owned(su).has(SE.trackItem(b4.number, 90).id), '#1 gets the Champion and Top 10 titles');
const hs = SE.seasonProgress(su); ok(hs.head_start === Math.min(2000, Math.floor(xpS * 0.1)) && hs.season_xp === 0, `soft reset: season XP back to 0 with a head start of ${hs.head_start} (10% of ${xpS}, max 2,000)`);
ok(SE.bestSeasonTier(su) === Math.floor(prog.level / 3) || SE.bestSeasonTier(su) >= 6, 'bestSeasonTier keeps the 20-step achievement scale');
ok(PR.seasonAt().number === SE.seasonAt().number && typeof PR.seasonBoard(5) === 'object' && PR.seasonProgress(su).track.length === 60, 'progress.js seasonAt / seasonProgress / seasonBoard delegate to the engine');
const al = SE.adminList(); ok(al.engine === 'src/seasons.js' && al.seasons.length >= 4 && al.hall_of_fame.length >= 1 && al.current.number === b4.number + 1, 'admin hook adminList() (used by the admin panel)');

console.log('# generated CSS stays small');
const css = SH.css(); ok(css.length < 120 * 1024 && !/undefined|NaN/.test(css) && css.includes('.bn-v7') && css.includes('/shop/art/'), `cosmetics CSS for the live generated set: ${(css.length / 1024).toFixed(1)} KB (banner art is served as separate SVG files)`);
console.log(`\n${pass} passed, ${fail} failed`); fs.rmSync(dir, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
