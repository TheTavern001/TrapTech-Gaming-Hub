'use strict';
// Hosting packages shown on /host. These are the DEFAULTS; the admin edits the live copy in
// Admin > Settings > Hosting packages (stored as JSON in the settings table, key "packages").
// Prices are placeholders - change them in the admin.
const db = require('./db');

const DEFAULT_PACKAGES = {
  tiers: [
    { id: 'basic', name: 'Basic', tagline: 'Launch your first giveaway', price: '$49', price_note: 'per giveaway', badge: '',
      who: 'Streamers, small shops and first-time hosts who want a simple, hands-off giveaway.',
      features: ['1 giveaway on 1 existing game of your choice', 'Runs for up to 7 days', 'Standard listing on the Giveaways page',
        'Your brand name + prize image on the giveaway card', 'Winner drawn at random from all entrants', 'Entrant CSV export when it ends'] },
    { id: 'premium', name: 'Premium', tagline: 'Featured campaign with real numbers', price: '$149', price_note: 'per campaign', badge: 'Most popular',
      who: 'Brands and growing channels that want home-page visibility, entry rules and live stats.',
      features: ['Up to 3 giveaways, or 1 giveaway running up to 14 days', 'Choose any games - one giveaway can count several games',
        'Your logo + brand colors themed into the giveaway card and game page', 'Featured slot on the home page', 'Pinned community announcement at launch',
        'Entry rules: set a minimum score to qualify', 'Live campaign stats: plays, unique players, entrants', 'Winners by top-N score + random draws', 'Everything in Basic'] },
    { id: 'elite', name: 'Elite', tagline: 'Full 30-day brand takeover', price: '$399', price_note: 'per 30-day campaign', badge: 'Maximum reach',
      who: 'Brands running a major launch or a month-long community push that want maximum exposure.',
      features: ['30-day campaign across any games', 'Custom branded game skin: your logo on obstacles and background, branded coins',
        'Home page hero banner takeover', 'Multiple prize tiers: 1st / 2nd / 3rd + random winners', 'Custom achievement + badge for your brand',
        'Recurring weekly leaderboards with weekly winners', 'Priority support from the Trap Tech team', 'Post-campaign report: plays, players, entrants, winners', 'Everything in Premium'] },
  ],
  compare: [
    ['Giveaways included', '1', 'Up to 3', 'Up to 5'],
    ['Campaign length', 'Up to 7 days', 'Up to 14 days', '30 days'],
    ['Games', '1 existing game', 'Any games, multi-game', 'Any games + branded skin'],
    ['Branding', 'Name + prize image', 'Logo + brand colors', 'Branded game skin + hero takeover'],
    ['Home page placement', '-', 'Featured slot', 'Hero banner takeover'],
    ['Community announcement', '-', 'Pinned at launch', 'Pinned + weekly updates'],
    ['Entry rules', 'Play to enter', 'Minimum score', 'Minimum score'],
    ['Live campaign stats', '-', 'yes', 'yes'],
    ['Winner selection', 'Random draw', 'Top-N + random', 'Prize tiers 1st/2nd/3rd + random'],
    ['Weekly leaderboards', '-', '-', 'yes'],
    ['Custom achievement / badge', '-', '-', 'yes'],
    ['Support', 'Standard', 'Standard', 'Priority'],
    ['Reporting', 'Entrant CSV', 'CSV + live stats', 'Full post-campaign report'],
  ],
  faq: [
    ['How do players enter a giveaway?', 'Players sign in and finish a run of any game linked to the giveaway while it is open. Every finished run inside the window counts as an entry. No purchase is necessary and nothing can be bought in any game.'],
    ['How are winners picked?', 'The admin draws winners on the giveaway\'s Manage page: a random draw (uniform among all entrants), the top N scores, or both for prize tiers. Winners appear on the giveaway page, in the Community feed and on their profile.'],
    ['Can one giveaway count several games?', 'Yes, on Premium and Elite. A player\'s giveaway score is the sum of their best score in each linked game during the window, so playing more of the linked games helps.'],
    ['How do you stop cheating?', 'Every scored run needs a signed, single-use run token from the server, scores are checked against per-game limits for the time actually played, and starts/submissions are rate-limited. Admins can review the top entrants, ban accounts and export every run before prizes go out.'],
    ['Are the casino-style games gambling?', 'No. Plinko, Spin to Win and Blazed Roulette use free points only. There is no real money, no purchase and no cash value; your points just rank you on the leaderboard.'],
    ['What do I need to provide?', 'The prize, your dates, the rules (age limits, regions) and your brand name and prize image. Premium and Elite also use your logo and brand colors. You are responsible for delivering the prize and following giveaway laws where you run it.'],
    ['When do I pay?', 'Not now. Sending a booking request is free. The Trap Tech team reviews it, confirms details and sends a quote before anything goes live. Prices shown are starting prices and can change for custom needs.'],
  ],
};

function getPackages() {
  const row = db.prepare("SELECT value FROM settings WHERE key='packages'").get();
  if (!row) return JSON.parse(JSON.stringify(DEFAULT_PACKAGES));
  try { const v = JSON.parse(row.value); if (v && Array.isArray(v.tiers) && v.tiers.length) return v; } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_PACKAGES));
}
const s = (v, n) => String(v ?? '').trim().slice(0, n);
function sanitize(input) {
  const base = getPackages();
  const tiers = (Array.isArray(input?.tiers) ? input.tiers : []).slice(0, 3).map((t, i) => ({
    id: base.tiers[i]?.id || ['basic', 'premium', 'elite'][i],
    name: s(t.name, 40) || base.tiers[i]?.name, tagline: s(t.tagline, 120), price: s(t.price, 30), price_note: s(t.price_note, 60), badge: s(t.badge, 30),
    who: s(t.who, 300), features: (Array.isArray(t.features) ? t.features : String(t.features || '').split('\n')).map(f => s(f, 200)).filter(Boolean).slice(0, 20),
  }));
  if (tiers.length !== 3) return [null, 'Exactly 3 tiers are required.'];
  const compare = (Array.isArray(input.compare) ? input.compare : []).map(r => [0, 1, 2, 3].map(k => s(r[k], 120))).filter(r => r[0]).slice(0, 30);
  const faq = (Array.isArray(input.faq) ? input.faq : []).map(r => [s(r[0], 200), s(r[1], 1200)]).filter(r => r[0] && r[1]).slice(0, 20);
  return [{ tiers, compare, faq }, null];
}
function savePackages(v) {
  db.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('packages',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").run(JSON.stringify(v), Date.now());
}
function resetPackages() { db.prepare("DELETE FROM settings WHERE key='packages'").run(); }
module.exports = { DEFAULT_PACKAGES, getPackages, sanitize, savePackages, resetPackages };
