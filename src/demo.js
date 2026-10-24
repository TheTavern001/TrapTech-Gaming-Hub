'use strict';
// Demo data for screenshots / showing the UI. Everything here is flagged is_demo=1
// and can be removed with wipe() (Admin > Settings > Wipe demo data, or `npm run demo:wipe`).
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');
const cfg = require('./config');

const NAMES = ['BlazedKing', 'TerpQueen', 'HighVibes', 'SmokeSignals', 'GreenLegend', 'FlavorChaser', 'TerpTrekker', 'CloudCollector', 'DankDreams', '420Rider', 'NeonNugget', 'PixelPuff'];

function seed() {
  const t = Date.now(); const H = 3600e3; const D = 24 * H;
  if (db.prepare('SELECT COUNT(*) c FROM users WHERE is_demo=1').get().c) return { seeded: false, note: 'Demo data already present' };
  const unusable = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 8); // demo accounts cannot be logged into
  const insU = db.prepare('INSERT INTO users (username, pass_hash, created_at, last_seen, is_demo) VALUES (?,?,?,?,1)');
  const insR = db.prepare('INSERT INTO runs (user_id, game_id, score, coins, duration_ms, started_at, created_at, is_demo) VALUES (?,?,?,?,?,?,?,1)');
  const insA = db.prepare('INSERT INTO activity (type, message, user_id, created_at, is_demo) VALUES (?,?,?,?,1)');
  let rng = 42; const rand = () => (rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648;
  const ids = [];
  db.transaction(() => {
    NAMES.forEach((name, i) => {
      if (db.prepare('SELECT 1 FROM users WHERE username=?').get(name)) return;
      const created = t - (60 - i * 3) * D;
      const id = insU.run(name, unusable, created, t - i * H).lastInsertRowid; ids.push([id, name]);
      insA.run('player', `New player registered: ${name}`, id, created);
      const skill = 4200 - i * 300;
      const nRuns = 4 + Math.floor(rand() * 8);
      for (let k = 0; k < nRuns; k++) {
        const ago = (i < 4 && k === 0) ? (2 + i * 3) * H : Math.floor(rand() * 40 * D);
        const meters = Math.max(80, Math.floor(skill * (0.35 + rand() * 0.65))); // Bud Escape: meters (10 m steps) + 200 per daily mission
        const score = Math.floor(meters / 10) * 10 + 200 * Math.min(3, Math.floor(meters / 1500)); const dur = Math.round((meters / 14) * 1000);
        insR.run(id, 'jetpack-dash', score, Math.floor(meters / 18), dur, t - ago - dur, t - ago);
      }
      // a few runs in the other games, scaled to each game's Bronze/Silver/Gold thresholds
      for (const g of cfg.GAMES.filter(x => x.id !== 'jetpack-dash')) {
        if (rand() < 0.25) continue;
        const n = 1 + Math.floor(rand() * 4);
        for (let k = 0; k < n; k++) {
          const ago = Math.floor(rand() * 20 * D) + 30 * 60e3;
          const lvl = (1 - i / NAMES.length) * (0.5 + rand() * 0.8);
          const score = Math.max(0, Math.floor(g.tiers[1] * lvl));
          const dur = 45e3 + Math.floor(rand() * 120e3);
          insR.run(id, g.id, Math.min(score, g.ac.max), 0, dur, t - ago - dur, t - ago);
        }
      }
    });
    const insG = db.prepare(`INSERT INTO giveaways (title,host,prize,image,start_at,end_at,entry_method,game_id,rules,active,created_at,updated_at,is_demo)
      VALUES (?,?,?,?,?,?,'play','jetpack-dash',?,1,?,?,1)`);
    const rules = 'Must be 21+ and a legal US resident where not void. No purchase necessary. One account per person. Winner will be drawn from players who play the linked game during the giveaway window and contacted via their Potato username.';
    insG.run('$250 Store Credit', 'Canopy Club', '$250 store credit', '/assets/giveaways/store-credit-art.webp', t - 3 * D, t + 2 * D + 14 * H + 32 * 60e3, rules, t, t);
    insG.run('PS5 + Games Bundle', 'Terp Tavern', 'PlayStation 5 console + 3 games', '/assets/giveaways/ps5-bundle-art.webp', t - 1 * D, t + 5 * D + 18 * H + 42 * 60e3, rules, t, t);
    insG.run('Neon Merch Drop', 'Trap Tech Solutions', 'Hoodie + hat + sticker pack', '/assets/brand/hero-banner.webp', t + 2 * D, t + 9 * D, rules, t, t);
    const past = insG.run('Launch Week Cash Prize', 'The Gaming Hub', '$100 cash', '/assets/giveaways/store-credit-art.webp', t - 20 * D, t - 13 * D, rules, t, t).lastInsertRowid;
    db.prepare("UPDATE giveaways SET win_method='random' WHERE id=?").run(past); // v4: verifiable random draw (finalized + confirmed below)
    // v2 fields: tiers, brand colors, multi-game links
    const demoG = db.prepare('SELECT id, title FROM giveaways WHERE is_demo=1').all();
    const setG = (title, games, extra) => { const g = demoG.find(x => x.title === title); if (!g) return;
      db.prepare('DELETE FROM giveaway_games WHERE giveaway_id=?').run(g.id);
      for (const gid of games) db.prepare('INSERT OR IGNORE INTO giveaway_games (giveaway_id, game_id) VALUES (?,?)').run(g.id, gid);
      db.prepare(`UPDATE giveaways SET game_id=?, tier=@tier, brand_color=@brand_color, featured=@featured, min_score=@min_score, prize_tiers=@prize_tiers WHERE id=${g.id}`)
        .run(games[0], { tier: '', brand_color: '', featured: 0, min_score: 0, prize_tiers: '', ...extra }); };
    setG('$250 Store Credit', ['jetpack-dash', 'stack', 'terp-tapper'], { tier: 'premium', brand_color: '#e11d2a', featured: 1 });
    setG('PS5 + Games Bundle', ['jetpack-dash', 'drift-rush', 'high-score', 'stack'], { tier: 'elite', brand_color: '#10b981', featured: 1, prize_tiers: '1st: PlayStation 5 + 3 games\n2nd: $100 store credit\n3rd: Controller + headset\nRandom: 2x Gaming Hub merch packs' });
    setG('Neon Merch Drop', ['void-swarm', 'munchies-snake'], { tier: 'basic' });
    setG('Launch Week Cash Prize', ['jetpack-dash'], { tier: 'basic' });
    const insB = db.prepare(`INSERT INTO bookings (brand,contact_name,contact,event_type,package,start_date,end_date,details,status,created_at,is_demo) VALUES (?,?,?,?,?,?,?,?,?,?,1)`);
    insB.run('Canopy Club', 'Promo Team', 'promo@example.com', 'Giveaway', 'premium', '2026-10-12', '2026-10-26', 'Two-week giveaway with branded game skin.', 'pending', t - 12 * 60e3);
    insB.run('Terp Tavern', 'Sam', 'discord: terptavern', 'Custom Game', 'elite', '2026-11-01', '2026-11-30', 'Full campaign, custom game + leaderboard.', 'approved', t - 2 * D);
    db.prepare('INSERT INTO announcements (title, body, created_at, is_demo) VALUES (?,?,?,1)').run('Big things coming!', 'New games, bigger giveaways, and more ways to win. Stay tuned and keep flying in Bud Escape!', t - 3 * H);
    insA.run('entry', 'TerpQueen entered "$250 Store Credit"', null, t - 3 * 60e3);
    insA.run('booking', 'Booking request submitted: Canopy Club (premium)', null, t - 12 * 60e3);
    insA.run('highscore', 'New high score (Bud Escape): BlazedKing - 4,120 m', null, t - 15 * 60e3);

    // ---------- v3 demo: tournaments, follows, check-in streaks, broadcast notifications ----------
    const insT = db.prepare(`INSERT INTO tournaments (title, game_id, format, description, prize, start_at, qual_end_at, round_ms, end_at, active, created_at, is_demo) VALUES (?,?,?,?,?,?,?,?,?,1,?,1)`);
    insT.run('Weekend Drift Cup', 'drift-rush', 'timed', 'Best single Drift Rush run between the start and the end wins. Play as many runs as you like - only your best counts.', 'Tournament Champ title + Tournament Gold frame (cosmetic)', t - 1 * D, null, null, t + 2 * D, t);
    const bq = t - 18 * H, br = 12 * H;
    insT.run('Stack Bracket Battle', 'stack', 'bracket', 'Qualify with your best Stack run, then the top 8 go head-to-head in async knockout rounds. Higher best score in each round advances.', 'Finalist title + Bracket Lines banner (cosmetic)', t - 2 * D, bq, br, bq + 3 * br, t);
    insT.run('Terp Tapper Rhythm Open', 'terp-tapper', 'timed', 'Two days of rhythm. Top score takes the crown.', 'Tournament Champ title (cosmetic)', t + 3 * D, null, null, t + 5 * D, t);
    ids.forEach(([id], i) => {
      // drift cup runs (inside the window)
      if (i < 9) { const sc = Math.floor(9000 - i * 700 + rand() * 500); const at = t - (2 + i) * H; insR.run(id, 'drift-rush', sc, 0, 60e3, at - 60e3, at); }
      // stack qualifiers (v7: Plinko retired) (top 8 seeded) + quarterfinal runs + some semifinal runs
      if (i < 10) { const at = t - 30 * H - i * H; insR.run(id, 'stack', 900 - i * 40, 0, 90e3, at - 90e3, at); }
      if (i < 8) { const at = t - 12 * H - i * 10 * 60e3; insR.run(id, 'stack', Math.floor(400 + rand() * 450), 0, 90e3, at - 90e3, at); }
      if (i < 8 && rand() < 0.6) { const at = t - 2 * H - i * 5 * 60e3; insR.run(id, 'stack', Math.floor(400 + rand() * 500), 0, 90e3, at - 90e3, at); }
      // follows + check-in streaks
      for (let k = 1; k <= 3; k++) { const other = ids[(i + k * 2) % ids.length]; if (other[0] !== id) db.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)').run(id, other[0], t - k * D); }
      const PR = require('./progress'); const today = PR.dayNum(t); const streak = Math.max(1, 12 - i);
      for (let d = 0; d < streak; d++) db.prepare('INSERT OR IGNORE INTO checkins (user_id, day, xp, created_at) VALUES (?,?,?,?)').run(id, today - d, PR.checkinXp(streak - d), PR.dayStart(today - d) + 9 * H);
    });
    const N = require('./notify');
    N.notify(null, 'season', 'Season 1: Neon Genesis is live', 'Earn XP from runs, quests and daily check-ins to unlock 20 free tiers of cosmetic rewards.', '/season', 'calendar-range', t - 5 * H, 1);
    N.notify(null, 'tournament', 'New tournament: Weekend Drift Cup', 'Drift Rush • timed • free entry, cosmetic prizes', '/tournaments', 'swords', t - 1 * D, 1);
    insA.run('tournament', 'New tournament: Weekend Drift Cup (Drift Rush)', null, t - 1 * D);
    insA.run('levelup', 'TerpQueen reached level 10', ids[1] ? ids[1][0] : null, t - 40 * 60e3);
    insA.run('streak', 'BlazedKing hit a 7-day streak', ids[0] ? ids[0][0] : null, t - 5 * H);
  })();
  // v4: lock the ended demo giveaway's final standings (verifiable draw) and confirm its winner, like an admin would
  try {
    const R = require('./results');
    for (const g of db.prepare('SELECT * FROM giveaways WHERE is_demo=1 AND end_at < ? AND finalized_at IS NULL').all(t)) {
      const fin = R.finalize(g, 'system', { quiet: true }); const res = R.results(fin);
      for (const w of res.winners) {
        db.prepare('INSERT OR IGNORE INTO giveaway_confirm (giveaway_id, user_id, place, note, created_at) VALUES (?,?,?,?,?)').run(g.id, w.user_id, w.place, 'demo', fin.end_at + D);
        db.prepare("INSERT OR IGNORE INTO winners (giveaway_id,user_id,method,score,drawn_at) VALUES (?,?,?,?,?)").run(g.id, w.user_id, g.win_method === 'random' ? 'random' : 'top', w.score, fin.end_at + D);
        R.audit(g.id, 'admin', 'confirmed', w.username, { place: w.place, note: 'demo data' });
      }
    }
  } catch (e) { console.error('demo finalize failed', e); }
  // achievements for the demo players (server-side evaluation, same as for real players)
  try {
    const ach = require('./achievements'); const COS = require('./cosmetics');
    const upd = db.prepare('UPDATE users SET eq_banner=?, eq_frame=?, eq_title=?, eq_badge=? WHERE id=?');
    for (const [id] of ids) {
      const ev = ach.evaluate(id, { quiet: true }); const own = ach.ownedFrom(ev.have);
      // demo players show off what they earned (rarest-looking pick = last unlocked of each type)
      const pick = (type, def) => { const l = [...own[type]].filter(x => x !== def); return l.length ? l[(id * 7) % l.length] : def; };
      const badges = [...ev.have.keys()]; const badge = badges.length ? badges[(id * 3) % badges.length] : '';
      upd.run(pick('banner', COS.DEFAULTS.banner), pick('frame', 'none'), pick('title', COS.DEFAULTS.title), badge, id);
    }
  } catch (e) { console.error('achievement eval failed', e); }
  v5();
  return { seeded: true, players: ids.length };
}

// v5 demo: brand channels, channel-scoped giveaways with anti-camping rules, joined entries and follows (idempotent)
function v5() {
  const t = Date.now(); const D = 864e5;
  if (!db.prepare('SELECT 1 FROM giveaways WHERE is_demo=1').get()) return;
  const E = require('./eligibility');
  db.transaction(() => {
    db.prepare("UPDATE giveaways SET host='Canopy Club' WHERE is_demo=1 AND host='HighTimes'").run();
    db.prepare("UPDATE bookings SET brand='Canopy Club' WHERE is_demo=1 AND brand='HighTimes'").run();
    db.prepare("UPDATE activity SET message=replace(message,'HighTimes','Canopy Club') WHERE is_demo=1").run();
    const CH = [
      ['canopy-club', 'Canopy Club', 'Licensed dispensary - weekly drops for the community (demo brand)', '#e11d2a', 'premium', 'https://example.com/canopy-club', 'Visit Canopy Club', 'Cannabis products seller (dispensary/brand/delivery)', '/assets/channels/canopy-club.svg'],
      ['terp-tavern', 'Terp Tavern', 'Independent terpene brand + gaming nights (demo brand)', '#10b981', 'elite', 'https://example.com/terp-tavern', 'Shop Terp Tavern', 'Cannabis products seller (dispensary/brand/delivery)', '/assets/channels/terp-tavern.svg'],
      ['trap-tech-drops', 'Trap Tech Drops', 'Merch and hub launch giveaways from the team behind the Gaming Hub', '#8b5cf6', 'basic', '', '', 'Other business', '/assets/brand/tt-mono-192.png'],
      ['neon-threads', 'Neon Threads', 'Independent streetwear label (demo brand)', '#22d3ee', 'basic', '', '', 'Apparel / streetwear brand', '/assets/channels/neon-threads.svg'],
    ];
    const insC = db.prepare('INSERT OR IGNORE INTO channels (slug,name,tagline,color,tier,link_url,link_label,business_type,logo,created_at,is_demo) VALUES (?,?,?,?,?,?,?,?,?,?,1)');
    for (const c of CH) insC.run(...c, t - 30 * D);
    const cid = (slug) => db.prepare('SELECT id FROM channels WHERE slug=?').get(slug).id;
    const assign = { '$250 Store Credit': 'canopy-club', 'PS5 + Games Bundle': 'terp-tavern', 'Neon Merch Drop': 'trap-tech-drops', 'Launch Week Cash Prize': 'trap-tech-drops' };
    for (const g of db.prepare('SELECT * FROM giveaways WHERE is_demo=1 AND channel_id IS NULL').all()) {
      const slug = assign[g.title]; if (!slug) continue;
      const c = db.prepare('SELECT * FROM channels WHERE slug=?').get(slug);
      db.prepare('UPDATE giveaways SET channel_id=?, link_url=?, link_label=? WHERE id=?').run(c.id, c.link_url, c.link_label, g.id);
      if (g.end_at > t && !g.finalized_at) {
        db.prepare(`UPDATE giveaways SET ${E.FIELDS.map(k => `${k}=@${k}`).join(',')} WHERE id=${g.id}`).run({ ...E.DEFAULTS, weight_mode: g.win_method === 'random' ? 'activity' : '' });
        // demo players who played a linked game inside the window joined it
        const games = db.prepare('SELECT game_id FROM giveaway_games WHERE giveaway_id=?').all(g.id).map(r => r.game_id);
        const ph = games.map(() => '?').join(',');
        const players = db.prepare(`SELECT DISTINCT r.user_id FROM runs r JOIN users u ON u.id=r.user_id WHERE u.is_demo=1 AND r.game_id IN (${ph}) AND r.created_at >= ?`).all(...games, g.start_at);
        for (const p of players) db.prepare('INSERT OR IGNORE INTO giveaway_entries (giveaway_id, user_id, joined_at) VALUES (?,?,?)').run(g.id, p.user_id, g.start_at + 3600e3);
      }
    }
    const users = db.prepare('SELECT id FROM users WHERE is_demo=1 ORDER BY id').all();
    users.forEach((u, i) => { for (const slug of ['canopy-club', 'terp-tavern', 'trap-tech-drops', 'neon-threads'].filter((_, k) => (i + k) % 3 !== 0)) db.prepare('INSERT OR IGNORE INTO channel_follows (user_id, channel_id, created_at) VALUES (?,?,?)').run(u.id, cid(slug), t - (i + 1) * D); });
  })();
}

function wipe() {
  const r = {};
  db.transaction(() => {
    r.players = db.prepare('DELETE FROM users WHERE is_demo=1').run().changes;
    r.giveaways = db.prepare('DELETE FROM giveaways WHERE is_demo=1').run().changes;
    r.bookings = db.prepare('DELETE FROM bookings WHERE is_demo=1').run().changes;
    r.announcements = db.prepare('DELETE FROM announcements WHERE is_demo=1').run().changes;
    r.activity = db.prepare('DELETE FROM activity WHERE is_demo=1').run().changes;
    db.prepare('DELETE FROM runs WHERE is_demo=1').run();
    r.tournaments = db.prepare('DELETE FROM tournaments WHERE is_demo=1').run().changes;
    db.prepare('DELETE FROM notifications WHERE is_demo=1').run();
    r.channels = db.prepare('DELETE FROM channels WHERE is_demo=1').run().changes;
  })();
  return r;
}
module.exports = { seed, wipe, v5 };
if (require.main === module) {
  const cmd = process.argv[2];
  console.log(cmd === 'wipe' ? wipe() : seed());
}
