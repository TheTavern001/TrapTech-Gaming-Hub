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
        const score = Math.max(80, Math.floor(skill * (0.35 + rand() * 0.65)));
        const dur = Math.round((score / 17) * 1000);
        insR.run(id, 'jetpack-dash', score, Math.floor(score / 18), dur, t - ago - dur, t - ago);
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
    const rules = 'Must be 18+ (21+ where required). No purchase necessary. One account per person. Winner will be drawn from players who play the linked game during the giveaway window and contacted via their Potato username.';
    insG.run('$250 Store Credit', 'HighTimes', '$250 store credit', '/assets/giveaways/store-credit-art.webp', t - 3 * D, t + 2 * D + 14 * H + 32 * 60e3, rules, t, t);
    insG.run('PS5 + Games Bundle', 'Terp Tavern', 'PlayStation 5 console + 3 games', '/assets/giveaways/ps5-bundle-art.webp', t - 1 * D, t + 5 * D + 18 * H + 42 * 60e3, rules, t, t);
    insG.run('Neon Merch Drop', 'Trap Tech Solutions', 'Hoodie + hat + sticker pack', '/assets/brand/hero-banner.webp', t + 2 * D, t + 9 * D, rules, t, t);
    const past = insG.run('Launch Week Cash Prize', 'The Gaming Hub', '$100 cash', '/assets/giveaways/store-credit-art.webp', t - 20 * D, t - 13 * D, rules, t, t).lastInsertRowid;
    if (ids.length) db.prepare("INSERT INTO winners (giveaway_id,user_id,method,score,drawn_at) VALUES (?,?,'random',NULL,?)").run(past, ids[2][0], t - 12 * D);
    // v2 fields: tiers, brand colors, multi-game links
    const demoG = db.prepare('SELECT id, title FROM giveaways WHERE is_demo=1').all();
    const setG = (title, games, extra) => { const g = demoG.find(x => x.title === title); if (!g) return;
      db.prepare('DELETE FROM giveaway_games WHERE giveaway_id=?').run(g.id);
      for (const gid of games) db.prepare('INSERT OR IGNORE INTO giveaway_games (giveaway_id, game_id) VALUES (?,?)').run(g.id, gid);
      db.prepare(`UPDATE giveaways SET game_id=?, tier=@tier, brand_color=@brand_color, featured=@featured, min_score=@min_score, prize_tiers=@prize_tiers WHERE id=${g.id}`)
        .run(games[0], { tier: '', brand_color: '', featured: 0, min_score: 0, prize_tiers: '', ...extra }); };
    setG('$250 Store Credit', ['jetpack-dash', 'plinko', 'terp-tapper'], { tier: 'premium', brand_color: '#e11d2a', featured: 1 });
    setG('PS5 + Games Bundle', ['jetpack-dash', 'drift-rush', 'high-score', 'memory-match'], { tier: 'elite', brand_color: '#10b981', featured: 1, prize_tiers: '1st: PlayStation 5 + 3 games\n2nd: $100 store credit\n3rd: Controller + headset\nRandom: 2x Gaming Hub merch packs' });
    setG('Neon Merch Drop', ['spin-to-win', 'blazed-roulette'], { tier: 'basic' });
    setG('Launch Week Cash Prize', ['jetpack-dash'], { tier: 'basic' });
    const insB = db.prepare(`INSERT INTO bookings (brand,contact_name,contact,event_type,package,start_date,end_date,details,status,created_at,is_demo) VALUES (?,?,?,?,?,?,?,?,?,?,1)`);
    insB.run('HighTimes', 'Promo Team', 'promo@example.com', 'Giveaway', 'premium', '2026-10-12', '2026-10-26', 'Two-week giveaway with branded game skin.', 'pending', t - 12 * 60e3);
    insB.run('Terp Tavern', 'Sam', 'discord: terptavern', 'Custom Game', 'elite', '2026-11-01', '2026-11-30', 'Full campaign, custom game + leaderboard.', 'approved', t - 2 * D);
    db.prepare('INSERT INTO announcements (title, body, created_at, is_demo) VALUES (?,?,?,1)').run('Big things coming!', 'New games, bigger giveaways, and more ways to win. Stay tuned and keep flying in Jetpack Dash!', t - 3 * H);
    insA.run('entry', 'TerpQueen entered "$250 Store Credit"', null, t - 3 * 60e3);
    insA.run('booking', 'Booking request submitted: HighTimes (premium)', null, t - 12 * 60e3);
    insA.run('highscore', 'New high score (Jetpack Dash): BlazedKing - 4,120m', null, t - 15 * 60e3);
  })();
  // achievements for the demo players (server-side evaluation, same as for real players)
  try {
    const ach = require('./achievements'); const COS = require('./cosmetics');
    const upd = db.prepare('UPDATE users SET eq_banner=?, eq_frame=?, eq_title=?, eq_badge=? WHERE id=?');
    for (const [id] of ids) {
      const ev = ach.evaluate(id); const own = ach.ownedFrom(ev.have);
      // demo players show off what they earned (rarest-looking pick = last unlocked of each type)
      const pick = (type, def) => { const l = [...own[type]].filter(x => x !== def); return l.length ? l[(id * 7) % l.length] : def; };
      const badges = [...ev.have.keys()]; const badge = badges.length ? badges[(id * 3) % badges.length] : '';
      upd.run(pick('banner', COS.DEFAULTS.banner), pick('frame', 'none'), pick('title', COS.DEFAULTS.title), badge, id);
    }
  } catch (e) { console.error('achievement eval failed', e); }
  return { seeded: true, players: ids.length };
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
  })();
  return r;
}
module.exports = { seed, wipe };
if (require.main === module) {
  const cmd = process.argv[2];
  console.log(cmd === 'wipe' ? wipe() : seed());
}
