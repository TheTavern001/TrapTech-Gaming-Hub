'use strict';
// Sponsor packages shown on /host. These are the DEFAULTS; the admin edits the live copy in
// Admin > Settings > Sponsor packages (stored as JSON in the settings table, key "packages").
// v5: every tier differs on the same 8 dimensions (exposure, reach, duration, branding, links, winners, analytics,
// winner handling); launch prices are shown with a "Launch pricing" label next to an admin-editable regular price.
const db = require('./db');
const VERSION = 5;

const DEFAULT_PACKAGES = {
  version: VERSION,
  launch_label: 'Launch pricing',
  launch_note: 'Launch prices are for the first sponsors on the hub and lock in for your first campaign. Regular prices apply after launch.',
  potato_handle: 'TrapTechSolutions',
  tiers: [
    { id: 'basic', name: 'Basic', tagline: 'Starter: launch your brand with a first giveaway', price: '$49', regular_price: '$79', price_note: '7-day giveaway', duration: '7 days', badge: 'Starter friendly',
      who: 'New and independent brands, streamers, shops and artists trying the hub for the first time. Lowest cost, zero setup work on your side.',
      dims: {
        exposure: 'Listed on the Giveaways page only',
        reach: 'Players who open the Giveaways tab + one line in the activity feed at launch',
        duration: '7 days',
        branding: 'Your brand name + prize photo on the giveaway card',
        links: 'No outbound link - brand name only (add a link for +$39)',
        winners: '1 winner',
        analytics: 'Entrant count + entrant CSV when it ends',
        winner_contact: 'Trap Tech contacts the winner on Potato and confirms delivery with you',
      },
      features: ['1 giveaway on 1 game of your choice', 'Listed on the Giveaways page for 7 days', 'Brand name + prize photo on the card', 'Your own brand channel page (name only)', '1 winner, picked by the published rules', 'Winner contacted on Potato by Trap Tech', 'Entrant CSV when it ends'] },
    { id: 'premium', name: 'Premium', tagline: 'Get featured: home page + your link', price: '$149', regular_price: '$229', price_note: '14-day campaign', duration: '14 days', badge: 'Most popular',
      who: 'Growing brands and channels that want to be seen on the home page and send players to their own website or Potato channel.',
      dims: {
        exposure: 'Giveaways page + Featured row on the Home page',
        reach: 'Every player who opens the hub sees the Featured row; Hub players affiliated with your brand get an in-app alert at launch',
        duration: '14 days',
        branding: 'Logo + brand colors on the card, giveaway page and your channel page',
        links: '1 outbound link (website or Potato channel) on the giveaway page',
        winners: 'Up to 3 winners / prize tiers',
        analytics: 'Live stats: plays, unique players, entrants, link clicks',
        winner_contact: 'Trap Tech contacts and verifies winners on Potato',
      },
      features: ['Up to 3 giveaways inside 14 days, any games (multi-game OK)', 'Featured row on the Home page', '1 outbound link on the giveaway page (website or Potato channel)', 'Logo + brand colors on card, giveaway and channel page', 'In-app alert to your channel followers at launch', 'Entry rules: minimum score / activity', 'Up to 3 winners or prize tiers', 'Live stats incl. link clicks', 'Everything in Basic'] },
    { id: 'elite', name: 'Elite', tagline: 'Brand takeover: hero banner, push alert, links everywhere', price: '$399', regular_price: '$599', price_note: '30-day takeover', duration: '30 days', badge: 'Maximum reach',
      who: 'Brands with a launch, a new product line or a month-long push that want the top of the hub and the most clicks to their channel.',
      dims: {
        exposure: 'Hero takeover at the top of Home + Featured row + Giveaways page (only one Elite hero runs at a time)',
        reach: 'Hero banner seen by every visitor, a push/in-app alert to all players who opted in at launch and a reminder in the final week',
        duration: '30 days (or 14 days at $249 launch / $369 regular)',
        branding: 'Branded game skin (logo on obstacles/background, branded coins) + channel page header',
        links: 'Links on the giveaway page, the game page and the launch announcement (3 placements)',
        winners: 'Up to 10 winners: 1st/2nd/3rd prize tiers + random draws + weekly leaderboard winners',
        analytics: 'Live stats + post-campaign report (reach, plays, entrants, link clicks by placement)',
        winner_contact: 'Trap Tech contacts, verifies and coordinates delivery for every winner on Potato',
      },
      features: ['30-day campaign across any games (14-day option available)', 'Hero banner takeover on Home (exclusive while it runs)', 'Push / in-app alert to all opted-in players at launch + final-week reminder', 'Links on giveaway page, game page and announcement', 'Branded game skin + custom brand badge', 'Up to 10 winners incl. prize tiers and weekly winners', 'Post-campaign report with link clicks by placement', 'Priority support from the Trap Tech team', 'Everything in Premium'] },
  ],
  compare: [
    ['Where you are shown', 'Giveaways page', 'Giveaways + Home Featured row', 'Home hero takeover + Featured + Giveaways'],
    ['How players find you', 'Giveaways tab + activity feed', '+ every Home visit, alert to players affiliated with your brand', '+ push/in-app alert to all opted-in players'],
    ['Duration', '7 days', '14 days', '30 days (14-day option)'],
    ['Branding', 'Name + prize photo', 'Logo + brand colors', 'Branded game skin + channel header'],
    ['Outbound links (website / Potato channel)', '- (add-on)', '1 link: giveaway page', '3 links: giveaway + game page + announcement'],
    ['Brand channel page', 'Name only', 'Logo, colors, link', 'Full header, pinned giveaway, links'],
    ['Winners / prize tiers', '1', 'Up to 3', 'Up to 10 + weekly winners'],
    ['Entry rules (anti-camping)', 'Default rules', 'Custom activity / min score', 'Custom + affiliated-only or invite-only audience'],
    ['Analytics', 'Entrant CSV', 'Live stats + link clicks', 'Live stats + full report'],
    ['Winner contact on Potato', 'yes', 'yes', 'yes + delivery coordination'],
    ['Price per day (launch)', '$7', '$10.64', '$13.30'],
  ],
  addons: [
    { id: 'extra-week', name: 'Extra week', price: '$25 / $59 / $99', desc: 'Add 7 days to any tier (Basic / Premium / Elite).' },
    { id: 'extra-link', name: 'Extra outbound link', price: '$39', desc: 'Basic: unlock 1 link on your giveaway page. Premium: add a link on the game page.' },
    { id: 'push', name: 'Push notification blast', price: '$79', desc: 'One push / in-app alert to every player who opted in. Max one blast per day across all brands.' },
    { id: 'extra-winners', name: 'Extra winners', price: '$15 per winner', desc: 'More winners or prize tiers beyond your tier\'s limit.' },
    { id: 'featured-week', name: 'Featured row week', price: '$49 / week', desc: 'Put a Basic giveaway in the Home Featured row.' },
    { id: 'game-skin', name: 'Branded game skin', price: '$249', desc: 'Your logo and colors inside a game (included in Elite).' },
  ],
  why_links: 'Outbound links are a paid feature because they send players off the hub to your website or Potato channel - that click is the most valuable thing we sell. Basic stays cheap by showing your name only; Premium adds one link; Elite puts links in three places.',
  multi_brand: [
    ['Every brand gets its own channel', 'Each sponsor has a channel page with its giveaways. Players follow the channels they like and can filter to them.'],
    ['Placements rotate fairly', 'Only one hero takeover runs at a time (booked by date). Featured-row sponsors share the Home Featured row in rotation, so no brand buries another.'],
    ['Players choose, not camp', 'Players can be entered in a limited number of giveaways at once and must pick which ones. Wins have cooldowns and a one-win-per-brand-per-month limit. Your entrants actually played and chose you.'],
    ['Alerts are capped', 'At most one push blast per day across all brands, so your alert isn\'t lost in a flood.'],
  ],
  faq: [
    ['Who can sponsor a giveaway?', 'Any legitimate business or creator, including streamers, gaming channels, apparel and accessory brands, smoke-shop retailers, artists, and licensed cannabis brands, dispensaries and delivery services. Cannabis sellers must confirm they hold a valid license and are permitted to advertise in their jurisdiction. Every sponsor is responsible for following the laws that apply to them.'],
    ['How do players enter?', 'Players sign in to a free account and complete a run of one of the giveaway\'s games while it is open. Entry is always free: no purchase is required and nothing in any game can be bought. Each giveaway page lists its eligibility rules and shows every player whether they qualify.'],
    ['How are winners selected and contacted?', 'Winners are selected exactly as the published rules state: either the highest verified score (with fixed, skill-based tiebreakers) or a verifiable random draw among eligible players. Results lock automatically when the giveaway ends. Trap Tech verifies each winner before the prize is released and contacts them through the Potato messaging app.'],
    ['How do you prevent cheating?', 'Every run is started and timed by our server and checked against what is physically possible in that game. Giveaways can also require recent activity, a minimum account age, a limit on simultaneous entries and a cooldown between wins. Our team reviews the top entrants before any prize is awarded.'],
    ['Is this gambling?', 'No. Every giveaway game is a game of skill, entry is free, and no money is ever wagered. Hub Credits and cosmetic items have no cash value and cannot be exchanged for money.'],
    ['What do I need to provide?', 'Your prize and a photo of it, the giveaway dates, any eligibility rules (such as age or region), and your brand name. If your package includes branding, we also use your logo, colors and links. You are responsible for delivering the prize and for following giveaway and advertising laws where the giveaway runs.'],
    ['When do I pay?', 'Not when you submit a request. Booking requests are free. We review your request, confirm the details and send you a quote through the Potato messaging app before anything goes live.'],
  ],
};

function getPackages() {
  const row = db.prepare("SELECT value FROM settings WHERE key='packages'").get();
  if (!row) return JSON.parse(JSON.stringify(DEFAULT_PACKAGES));
  try { const v = JSON.parse(row.value); if (v && v.version === VERSION && Array.isArray(v.tiers) && v.tiers.length) return v; } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_PACKAGES)); // pre-v5 saved copies are ignored (different structure)
}
const s = (v, n) => String(v ?? '').trim().slice(0, n);
const DIMS = ['exposure', 'reach', 'duration', 'branding', 'links', 'winners', 'analytics', 'winner_contact'];
function sanitize(input) {
  const base = getPackages();
  const tiers = (Array.isArray(input?.tiers) ? input.tiers : []).slice(0, 3).map((t, i) => {
    const b = base.tiers[i] || DEFAULT_PACKAGES.tiers[i];
    const dims = {}; for (const k of DIMS) dims[k] = s(t.dims?.[k] ?? b.dims[k], 240);
    return { id: b.id, name: s(t.name, 40) || b.name, tagline: s(t.tagline, 120), price: s(t.price, 30), regular_price: s(t.regular_price ?? b.regular_price, 30), price_note: s(t.price_note, 60),
      duration: s(t.duration ?? b.duration, 40), badge: s(t.badge, 30), who: s(t.who, 300), dims,
      features: (Array.isArray(t.features) ? t.features : String(t.features || '').split('\n')).map(f => s(f, 200)).filter(Boolean).slice(0, 20) };
  });
  if (tiers.length !== 3) return [null, 'Exactly 3 tiers are required.'];
  const compare = (Array.isArray(input.compare) ? input.compare : base.compare).map(r => [0, 1, 2, 3].map(k => s(r[k], 120))).filter(r => r[0]).slice(0, 30);
  const faq = (Array.isArray(input.faq) ? input.faq : base.faq).map(r => [s(r[0], 200), s(r[1], 1200)]).filter(r => r[0] && r[1]).slice(0, 20);
  const addons = (Array.isArray(input.addons) ? input.addons : base.addons).map((a, i) => ({ id: s(a.id, 40) || 'addon-' + (i + 1), name: s(a.name, 60), price: s(a.price, 40), desc: s(a.desc, 240) })).filter(a => a.name).slice(0, 12);
  const multi_brand = (Array.isArray(input.multi_brand) ? input.multi_brand : base.multi_brand).map(r => [s(r[0], 120), s(r[1], 600)]).filter(r => r[0] && r[1]).slice(0, 8);
  const handle = s(input.potato_handle ?? base.potato_handle, 40).replace(/^@/, '').replace(/[^A-Za-z0-9_]/g, '');
  return [{ version: VERSION, launch_label: s(input.launch_label ?? base.launch_label, 40), launch_note: s(input.launch_note ?? base.launch_note, 300), potato_handle: handle || DEFAULT_PACKAGES.potato_handle,
    why_links: s(input.why_links ?? base.why_links, 600), tiers, compare, addons, multi_brand, faq }, null];
}
function savePackages(v) {
  db.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('packages',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").run(JSON.stringify(v), Date.now());
}
function resetPackages() { db.prepare("DELETE FROM settings WHERE key='packages'").run(); }
const BUSINESS_TYPES = ['Cannabis products seller (dispensary/brand/delivery)', 'Streamer / content creator', 'Gaming channel / esports', 'Apparel / streetwear brand', 'Glass / smoke-gear shop', 'Artist / musician', 'Online shop / e-commerce', 'Local business', 'Other business'];
const CANNABIS_TYPE = BUSINESS_TYPES[0];
module.exports = { DEFAULT_PACKAGES, getPackages, sanitize, savePackages, resetPackages, DIMS, BUSINESS_TYPES, CANNABIS_TYPE };
