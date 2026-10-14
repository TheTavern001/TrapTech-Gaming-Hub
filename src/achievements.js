'use strict';
// Achievement system. Everything is evaluated on the SERVER from data the server already validated
// (accepted runs, giveaway entries/winners, reactions, equipped cosmetics). The client never says
// "I unlocked X". Rewards are cosmetic only and have no cash value.
const db = require('./db');
const cfg = require('./config');
const boards = require('./boards');
const COS = require('./cosmetics');

const fmt = (n) => Number(n).toLocaleString('en-US');
const A = [];
const add = (a) => A.push({ hidden: false, ...a });
const R = (type, id) => ({ type, id });

// ---------- per-game milestones (5 per game) ----------
const PER_GAME = {
  'jetpack-dash': { names: ['Lift Off', 'Sky Cruiser', 'Stratosphere'], reg: 'Frequent Flyer', streak: 'Afterburner', icon: 'rocket',
    rw: [R('banner', 'rocket-trail'), R('frame', 'thruster'), R('title', 'sky-ace'), R('banner', 'lab'), R('title', 'afterburner')] },
  'drift-rush': { names: ['Burnout', 'Corner Carver', 'Drift King'], reg: 'Track Day', streak: 'Slide Streak', icon: 'car',
    rw: [R('banner', 'drift-smoke'), R('frame', 'tire-smoke'), R('title', 'drift-king'), R('banner', 'night-track'), R('title', 'slide-master')] },
  plinko: { names: ['First Bounce', 'Peg Hunter', 'Plinko Pro'], reg: 'Chip Dropper', streak: 'Lucky Bounces', icon: 'circle-dot',
    rw: [R('banner', 'peg-board'), R('frame', 'peg-ring'), R('title', 'plinko-pro'), R('banner', 'pachinko'), R('title', 'peg-whisperer')] },
  'spin-to-win': { names: ['Warm Spin', 'Big Spinner', 'Wheel Wizard'], reg: 'Wheel Regular', streak: 'Hot Hands', icon: 'disc-3',
    rw: [R('banner', 'prize-wheel'), R('frame', 'wheel'), R('title', 'wheel-wizard'), R('banner', 'spotlight'), R('title', 'spin-doctor')] },
  'memory-match': { names: ['Sharp Mind', 'Card Counter', 'Memory Master'], reg: 'Brain Gym', streak: 'Total Recall', icon: 'brain',
    rw: [R('banner', 'card-back'), R('frame', 'card-shark'), R('title', 'memory-master'), R('banner', 'mind-maze'), R('title', 'total-recall')] },
  'high-score': { names: ['On Target', 'Dead Eye', 'Reflex Legend'], reg: 'Quick Draw', streak: 'In the Zone', icon: 'target',
    rw: [R('banner', 'bullseye'), R('frame', 'crosshair'), R('title', 'reflex-legend'), R('banner', 'scanlines'), R('title', 'sharpshooter')] },
  'blazed-roulette': { names: ['In the Black', 'Chip Stacker', 'High Roller'], reg: 'Table Regular', streak: 'Hot Table', icon: 'dices',
    rw: [R('banner', 'wedges'), R('frame', 'croupier'), R('title', 'high-roller'), R('banner', 'felt'), R('title', 'hot-table')] },
  'terp-tapper': { names: ['Finding the Beat', 'Beat Breaker', 'Rhythm Royalty'], reg: 'Groove Regular', streak: 'Encore', icon: 'music',
    rw: [R('banner', 'rhythm-bars'), R('frame', 'equalizer'), R('title', 'rhythm-royalty'), R('banner', 'bass-drop'), R('title', 'encore')] },
  // v7 endless games
  stack: { names: ['First Floors', 'High Rise', 'Skyscraper'], reg: 'Site Foreman', streak: 'Perfect Drop', icon: 'layers',
    rw: [R('banner', 'glass-tower'), R('frame', 'slab'), R('title', 'sky-builder'), R('banner', 'glass-tower'), R('title', 'perfect-drop')] },
  'grow-guard': { names: ['Pest Patrol', 'Garden Keeper', 'Head Grower'], reg: 'Night Shift Grower', streak: 'Clean Room', icon: 'leaf',
    rw: [R('banner', 'grow-room'), R('frame', 'ladybug'), R('title', 'head-grower'), R('banner', 'grow-room'), R('title', 'pest-patrol')] },
  'sling-smash': { names: ['First Topple', 'Demolition Crew', 'Tower Toppler'], reg: 'Wrecking Regular', streak: 'Bot Buster', icon: 'crosshair',
    rw: [R('banner', 'sling-arc'), R('frame', 'steel-ball'), R('title', 'tower-toppler'), R('banner', 'sling-arc'), R('title', 'bot-buster')] },
  'haze-defense': { names: ['Clear Air', 'Orb Popper', 'Haze Buster'], reg: 'Track Warden', streak: 'Smoke Screen', icon: 'shield',
    rw: [R('banner', 'haze-track'), R('frame', 'prism-laser'), R('title', 'haze-buster'), R('banner', 'haze-track'), R('title', 'orb-popper')] },
  'munchies-snake': { names: ['First Bite', 'Snack Circuit', 'Neon Serpent'], reg: 'Midnight Muncher', streak: 'Infinite Appetite', icon: 'spline',
    rw: [R('banner', 'neon-bites'), R('frame', 'arcade-orbit'), R('title', 'serpent-master'), R('banner', 'midnight-munchies'), R('title', 'endless-coil')] },
  'brick-breaker': { names: ['First Shatter', 'Ricochet Artist', 'Brick Breaker Supreme'], reg: 'Paddle Regular', streak: 'Perfect Angles', icon: 'brick-wall',
    rw: [R('banner', 'prism-bricks'), R('frame', 'paddle-pulse'), R('title', 'brick-architect'), R('banner', 'shard-storm'), R('title', 'perfect-ricochet')] },
  'sky-hopper': { names: ['First Leap', 'Cloud Runner', 'Sky Hopper Legend'], reg: 'Frequent Jumper', streak: 'Above the Clouds', icon: 'cloud-sun',
    rw: [R('banner', 'cloud-runway'), R('frame', 'skyline-ring'), R('title', 'cloud-strider'), R('banner', 'sunrise-launch'), R('title', 'airwalker')] },
  'void-swarm': { names: ['First Wave', 'Survival Instinct', 'Swarm Survivor'], reg: 'Void Veteran', streak: 'Last One Standing', icon: 'orbit',
    rw: [R('banner', 'void-plasma'), R('frame', 'swarm-core'), R('title', 'swarm-survivor'), R('banner', 'rift-shock'), R('title', 'void-commander')] },
};
for (const g of cfg.GAMES) {
  const P = PER_GAME[g.id]; if (!P) continue;
  const u = g.unit === 'm' ? 'm' : g.unit === 'chips' ? ' chips' : ' pts';
  ['bronze', 'silver', 'gold'].forEach((tier, i) => add({ id: `${g.id}-${tier}`, cat: 'games', game: g.id, tier, icon: P.icon, name: P.names[i],
    desc: `${g.title}: score ${fmt(g.tiers[i])}${u} in one run`, target: g.tiers[i], value: (s) => s.game[g.id]?.best || 0, rewards: [P.rw[i]] }));
  add({ id: `${g.id}-regular`, cat: 'games', game: g.id, tier: 'silver', icon: 'repeat', name: P.reg, desc: `Finish 10 runs of ${g.title}`, target: 10, value: (s) => s.game[g.id]?.runs || 0, rewards: [P.rw[3]] });
  add({ id: `${g.id}-streak`, cat: 'games', game: g.id, tier: 'gold', icon: 'flame', name: P.streak, desc: `${g.title}: 3 runs in a row each scoring ${fmt(g.tiers[0])}${u}+`, target: 3, value: (s) => s.game[g.id]?.streak || 0, rewards: [P.rw[4]] });
}

// ---------- overall ----------
const O = (id, tier, icon, name, desc, target, value, rewards) => add({ id, cat: 'overall', tier, icon, name, desc, target, value, rewards });
O('first-run', 'bronze', 'play', 'First Steps', 'Finish your first scored run', 1, s => s.runs, [R('banner', 'neon-grid')]);
O('runs-10', 'bronze', 'thermometer', 'Getting Warm', 'Finish 10 runs (any games)', 10, s => s.runs, [R('frame', 'violet')]);
O('runs-50', 'silver', 'armchair', 'Hub Regular', 'Your 50th finished run - you basically live here now', 50, s => s.runs, [R('title', 'hub-regular')]);
O('runs-100', 'silver', 'cog', 'Grinder', 'Finish 100 runs - the grind is real', 100, s => s.runs, [R('banner', 'carbon')]);
O('runs-250', 'gold', 'anchor', 'Dedicated', 'Finish 250 runs without giving up', 250, s => s.runs, [R('frame', 'plasma'), R('banner', 'plasma')]);
O('runs-500', 'epic', 'crown', 'Legend of the Hub', 'Finish 500 runs', 500, s => s.runs, [R('title', 'hub-legend')]);
O('points-10k', 'bronze', 'coins', 'Point Collector', 'Earn 10,000 lifetime points (all runs, all games)', 10000, s => s.points, [R('banner', 'laser')]);
O('points-100k', 'silver', 'piggy-bank', 'Point Hoarder', 'Earn 100,000 lifetime points', 100000, s => s.points, [R('frame', 'gold')]);
O('points-1m', 'epic', 'gem', 'Points Millionaire', 'Earn 1,000,000 lifetime points (no cash value!)', 1000000, s => s.points, [R('banner', 'gold-rush')]);
O('variety-3', 'bronze', 'layers', 'Explorer', 'Play 3 different games', 3, s => s.games, [R('title', 'explorer')]);
O('variety-all', 'gold', 'grid-3x3', 'Polymath', `Play every game in the hub (${cfg.GAMES.length})`, cfg.GAMES.length, s => s.games, [R('banner', 'prism')]);
O('days-2', 'bronze', 'rotate-ccw', 'Back Again', 'Play on 2 days in a row', 2, s => s.dayStreak, [R('frame', 'cyan-pulse')]);
O('days-3', 'silver', 'car-front', 'Daily Driver', 'Play on 3 days in a row', 3, s => s.dayStreak, [R('title', 'daily-driver')]);
O('days-7', 'gold', 'flame', 'On Fire', 'Play 7 days in a row', 7, s => s.dayStreak, [R('frame', 'fire'), R('banner', 'ember')]);
O('days-14', 'epic', 'zap', 'Unstoppable', 'Play 14 days in a row', 14, s => s.dayStreak, [R('title', 'unstoppable'), R('banner', 'synthwave')]);
O('days-10', 'silver', 'calendar', 'Ten-Day Tour', 'Show up on 10 different days', 10, s => s.days, [R('banner', 'deep-ocean')]);
O('days-30', 'gold', 'calendar-heart', 'Monthly Regular', 'Show up on 30 different days', 30, s => s.days, [R('banner', 'aurora')]);

// ---------- giveaways ----------
const G = (id, tier, icon, name, desc, target, value, rewards) => add({ id, cat: 'giveaways', tier, icon, name, desc, target, value, rewards });
G('gw-enter-1', 'bronze', 'ticket', 'In the Draw', 'Enter a giveaway (finish a run of a linked game while it is open)', 1, s => s.gwEntered, [R('title', 'contender')]);
G('gw-enter-5', 'silver', 'tickets', 'Regular Entrant', 'Enter 5 different giveaways', 5, s => s.gwEntered, [R('banner', 'confetti')]);
G('gw-enter-25', 'gold', 'gift', 'Prize Pursuer', 'Enter 25 different giveaways', 25, s => s.gwEntered, [R('title', 'giveaway-hunter')]);
G('gw-podium', 'silver', 'medal', 'Podium Finish', 'Finish top 3 on the entrant board of a giveaway that has ended', 1, s => s.gwPodium, [R('banner', 'victory')]);
G('gw-win-1', 'gold', 'crown', 'Winner Winner', 'Win a giveaway', 1, s => s.gwWon, [R('frame', 'champion')]);
G('gw-win-3', 'epic', 'party-popper', 'Lucky Charm', 'Win 3 giveaways', 3, s => s.gwWon, [R('title', 'lucky-charm')]);

// ---------- community ----------
const C = (id, tier, icon, name, desc, target, value, rewards) => add({ id, cat: 'community', tier, icon, name, desc, target, value, rewards });
C('welcome', 'bronze', 'user-plus', 'Welcome Aboard', 'Create your Gaming Hub account', 1, () => 1, [R('banner', 'ultraviolet')]);
C('react-1', 'bronze', 'thumbs-up', 'First Hype', 'Hype an announcement or highlight in the Community feed', 1, s => s.reactions, [R('frame', 'holo')]);
C('react-25', 'silver', 'heart-handshake', 'Hype Machine', 'Hype 25 Community highlights', 25, s => s.reactions, [R('title', 'hype-machine'), R('banner', 'toxic')]);
C('equip-banner', 'bronze', 'palette', 'Fresh Look', 'Equip a profile banner', 1, s => s.eqBanner, [R('banner', 'vaporwave')]);
C('full-fit', 'silver', 'wand-sparkles', 'Drip Check', 'Equip a banner, a frame and a title at the same time', 1, s => s.fullFit, [R('title', 'trendsetter')]);
C('collector-25', 'gold', 'sparkles', 'Collector', 'Own 25 cosmetics (banners, frames and titles)', 25, s => s.owned, [R('frame', 'rainbow')]);

// ---------- leaderboards ----------
const L = (id, tier, icon, name, desc, target, value, rewards) => add({ id, cat: 'leaderboards', tier, icon, name, desc, target, value, rewards });
L('lb-weekly-top10', 'silver', 'trending-up', 'Weekly Contender', 'Reach the top 10 of a weekly game board (11+ players)', 1, s => s.lb.weeklyTop10, [R('banner', 'champion')]);
L('lb-weekly-top3', 'gold', 'medal', 'Weekly Podium', 'Reach the top 3 of a weekly game board (5+ players)', 1, s => s.lb.weeklyTop3, [R('title', 'weekly-warrior')]);
L('lb-weekly-1', 'epic', 'trophy', 'Weekly Champion', 'Take #1 on a weekly game board (5+ players)', 1, s => s.lb.weekly1, [R('frame', 'royal')]);
L('lb-monthly-1', 'epic', 'calendar-check-2', 'Monthly Champion', 'Take #1 on a monthly (30-day) game board (5+ players)', 1, s => s.lb.monthly1, [R('title', 'champion')]);
L('lb-global-top10', 'gold', 'crown', 'Global Elite', 'Reach the all-time global top 10 (11+ players)', 1, s => s.lb.globalTop10, [R('banner', 'hyperspace')]);
L('lb-triple', 'legendary', 'crown', 'Triple Crown', 'Hold #1 on 3 different all-time game boards at once (3+ players each)', 3, s => s.lb.allTime1, [R('title', 'triple-crown')]);

// ---------- secret ----------
const X = (id, tier, icon, name, desc, target, value, rewards) => add({ id, cat: 'secret', hidden: true, tier, icon, name, desc, target, value, rewards });
X('s-420', 'gold', 'flame-kindling', 'Blaze It', 'Finish a run with a score ending in 420', 1, s => s.f420, [R('title', 'blaze-legend'), R('banner', 'purple-haze')]);
X('s-zero', 'bronze', 'circle-x', 'Zero Hero', 'Finish a run with a score of exactly 0', 1, s => s.fZero, [R('title', 'zero-hero'), R('banner', 'ice')]);
X('s-777', 'gold', 'gem', 'Lucky Sevens', 'Finish a run with 777 in the score', 1, s => s.f777, [R('banner', 'jackpot')]);
X('s-double', 'silver', 'trending-up', 'Double Up', 'Beat your personal best in a game by 2x (old best 100+)', 1, s => s.fDouble, [R('frame', 'double')]);
X('s-pb10', 'gold', 'award', 'Record Breaker', 'Beat your own personal best 10 times', 10, s => s.pbBreaks, [R('title', 'record-breaker')]);
X('s-marathon', 'silver', 'hourglass', 'Marathoner', 'Play a single run for 8+ minutes', 1, s => s.fMarathon, [R('title', 'marathoner')]);
X('s-twins', 'silver', 'copy', 'Deja Vu', 'Score the exact same (non-zero) score twice in a row in a game', 1, s => s.fTwins, [R('banner', 'glitch')]);
X('s-og', 'gold', 'badge-check', 'OG', 'Be one of the first 100 players to join the hub', 1, s => s.og, [R('title', 'og-member')]);
X('s-complete', 'legendary', 'star', 'Completionist', 'Unlock 50 achievements', 50, s => s.achCount, [R('banner', 'holo')]);

// ---------- v3: streaks, quests, levels, seasons ----------
const P = (id, tier, icon, name, desc, target, value, rewards) => add({ id, cat: 'progress', tier, icon, name, desc, target, value, rewards });
P('streak-3', 'bronze', 'calendar-check', 'Early Bird', 'Check in 3 days in a row', 3, s => s.streakBest, [R('title', 'early-bird')]);
P('streak-7', 'silver', 'sunrise', 'Habit Former', 'Check in 7 days in a row', 7, s => s.streakBest, [R('title', 'habit-former'), R('banner', 'sunrise')]);
P('streak-30', 'epic', 'flame-kindling', 'Eternal Flame', 'Check in 30 days in a row', 30, s => s.streakBest, [R('frame', 'streak'), R('banner', 'streak-fire')]);
P('quest-1', 'bronze', 'scroll-text', 'Questor', 'Claim your first daily quest', 1, s => s.questsDone, [R('title', 'questor')]);
P('quest-25', 'gold', 'map', 'Quest Legend', 'Claim 25 daily quests', 25, s => s.questsDone, [R('title', 'quest-legend'), R('banner', 'quest-map')]);
P('level-5', 'bronze', 'chevrons-up', 'Leveled Up', 'Reach player level 5', 5, s => s.level, [R('title', 'level-grinder')]);
P('level-10', 'silver', 'signal', 'Double Digits', 'Reach player level 10', 10, s => s.level, [R('frame', 'level')]);
P('level-25', 'epic', 'shield-check', 'Veteran', 'Reach player level 25', 25, s => s.level, [R('title', 'veteran'), R('banner', 'level-up')]);
P('season-3', 'bronze', 'calendar-range', 'Season Starter', 'Reach tier 3 of a season track', 3, s => s.seasonTier, [R('title', 'season-starter')]);
P('season-5', 'silver', 'ticket-check', 'Pass Holder', 'Reach tier 5 of a season track', 5, s => s.seasonTier, [R('banner', 'season-one')]);
P('season-10', 'gold', 'award', 'Laurels', 'Reach tier 10 of a season track', 10, s => s.seasonTier, [R('frame', 'season')]);
P('season-20', 'legendary', 'crown', 'Season Legend', 'Complete all 20 tiers of a season track', 20, s => s.seasonTier, [R('title', 'season-legend')]);
// ---------- v3: tournaments ----------
L('tourney-enter', 'bronze', 'swords', 'Competitor', 'Play a run in a tournament', 1, s => s.tourney.entered, [R('title', 'competitor')]);
L('tourney-podium', 'gold', 'medal', 'Finalist', 'Finish top 3 in a timed tournament or reach a bracket final', 1, s => s.tourney.podium, [R('title', 'finalist'), R('banner', 'tourney-bracket')]);
L('tourney-win', 'epic', 'swords', 'Tournament Champ', 'Win a tournament', 1, s => s.tourney.wins, [R('title', 'tournament-champ'), R('frame', 'tourney')]);
// ---------- v3: friends, referrals, sharing ----------
const F = (id, tier, icon, name, desc, target, value, rewards) => add({ id, cat: 'social', tier, icon, name, desc, target, value, rewards });
F('follow-1', 'bronze', 'user-plus', 'Social Butterfly', 'Follow another player', 1, s => s.following, [R('title', 'social-butterfly')]);
F('followers-5', 'silver', 'users', 'Influencer', 'Get 5 followers', 5, s => s.followers, [R('title', 'influencer'), R('frame', 'friend')]);
F('ref-1', 'silver', 'gift', 'Crew Builder', 'Invite a friend who signs up with your code and finishes a run', 1, s => s.referrals, [R('title', 'crew-builder'), R('banner', 'crew-beacon')]);
F('ref-5', 'gold', 'users-round', 'Squad Goals', 'Invite 5 friends who sign up and finish a run', 5, s => s.referrals, [R('title', 'squad-goals'), R('banner', 'crew')]);
F('ref-15', 'epic', 'party-popper', 'Party Starter', 'Invite 15 friends who sign up and finish a run', 15, s => s.referrals, [R('title', 'party-starter')]);
F('referred', 'bronze', 'handshake', 'Newcomer', "Join with a friend's invite code", 1, s => s.referred, [R('title', 'newcomer')]);
F('share-1', 'bronze', 'share-2', 'Hype Sharer', 'Share a score card or giveaway link', 1, s => s.shares, [R('title', 'hype-sharer')]);
F('chal-win-1', 'silver', 'swords', 'Called It', 'Win a friend challenge', 1, s => s.chalWins, [R('frame', 'friend')]);
F('chal-win-10', 'gold', 'shield-half', 'Rivalry Royalty', 'Win 10 friend challenges', 10, s => s.chalWins, [R('banner', 'tourney-bracket')]);

// ---------- v5: Legendary tier (very hard; rarity shown on every badge) ----------
const LG = (id, icon, name, desc, target, value, rewards) => add({ id, cat: 'legendary', tier: 'legendary', icon, name, desc, target, value, rewards });
LG('leg-top1', 'gem', 'One Percenter', 'Hold a best score in the top 1% of an all-time game board (board must have 100+ players)', 1, s => s.top1pct, [R('title', 'one-percenter'), R('frame', 'legend-crest')]);
LG('leg-streak-100', 'flame', 'Centurion', 'Check in 100 days in a row', 100, s => s.streakBest, [R('title', 'centurion'), R('banner', 'centurion-flame')]);
LG('leg-mastery', 'graduation-cap', 'Grandmaster', 'Reach the Gold score tier in every game on the hub', cfg.GAMES.length, s => s.goldGames, [R('title', 'grandmaster'), R('banner', 'legend-aurora')]);
LG('leg-runs-2000', 'hand-metal', 'Iron Thumbs', 'Finish 2,000 runs', 2000, s => s.runs, [R('title', 'iron-thumbs')]);
LG('leg-weekly-hold', 'castle', 'Dynasty', 'Be #1 on the weekly board of 4 different games at the same time (5+ players each)', 4, s => s.lb.weekly1Count, [R('title', 'dynasty')]);

const BY_ID = Object.fromEntries(A.map(a => [a.id, a]));
// ---------- v5: admin-granted badges (can never be unlocked by playing) ----------
const ADMIN_BADGES = [
  { id: 'staff', name: 'Staff', icon: 'shield-check', desc: 'Hub staff member', color: '#a78bfa' },
  { id: 'traptech-team', name: 'Trap Tech Team', icon: 'code-xml', desc: 'Part of the Trap Tech Solutions team that builds the hub', color: '#22d3ee' },
  { id: 'verified-host', name: 'Verified Host', icon: 'badge-check', desc: 'Verified giveaway host', color: '#4ade80' },
  { id: 'verified-sponsor', name: 'Verified Sponsor', icon: 'store', desc: 'Verified sponsor brand or creator', color: '#34d399' },
  { id: 'giveaway-winner', name: 'Giveaway Winner', icon: 'trophy', desc: 'Confirmed winner of a hub giveaway (granted automatically on confirmation)', color: '#fbbf24' },
  { id: 'beta-tester', name: 'Beta Tester', icon: 'flask-conical', desc: 'Helped test the hub before launch', color: '#f472b6' },
  { id: 'founder', name: 'Founder', icon: 'gem', desc: 'Founding member of The Gaming Hub', color: '#fde047' },
  { id: 'community-mvp', name: 'Community MVP', icon: 'star', desc: 'Recognised by the team for making the community better', color: '#fb923c' },
];
const ADMIN_BY = Object.fromEntries(ADMIN_BADGES.map(b => [b.id, b]));
const grantsOf = (userId) => db.prepare('SELECT badge_id, created_at, note FROM badge_grants WHERE user_id=? ORDER BY created_at').all(userId).filter(g => ADMIN_BY[g.badge_id]);
const CATS = [['legendary', 'Legendary'], ['games', 'Game milestones'], ['overall', 'Overall'], ['progress', 'Streaks & seasons'], ['giveaways', 'Giveaways'], ['community', 'Community'], ['social', 'Friends & referrals'], ['leaderboards', 'Leaderboards & tournaments'], ['secret', 'Secret']];

// sanity: every reward must exist
for (const a of A) for (const r of a.rewards) if (!COS.BY[r.type][r.id]) throw new Error(`achievement ${a.id}: unknown ${r.type} ${r.id}`);

// ---------- stats ----------
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: cfg.TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayNum = (ms) => { const [y, m, d] = dayFmt.format(new Date(ms)).split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };

function unlockedMap(userId) {
  return new Map(db.prepare('SELECT ach_id, unlocked_at FROM user_achievements WHERE user_id=?').all(userId).map(r => [r.ach_id, r.unlocked_at]));
}
function ownedFrom(unlocked) {
  const own = { banner: new Set([COS.DEFAULTS.banner]), frame: new Set([COS.DEFAULTS.frame]), title: new Set([COS.DEFAULTS.title]), badge: new Set() };
  for (const id of unlocked.keys()) { const a = BY_ID[id]; if (!a) continue; own.badge.add(id); for (const r of a.rewards) own[r.type].add(r.id); }
  return own;
}
// v5: everything a user owns = achievement rewards + Points Shop purchases + admin-granted badges
function ownedAll(userId, unl) {
  const own = ownedFrom(unl || unlockedMap(userId)); own.color = new Set(); own.effect = new Set();
  const SH = require('./shop');
  for (const r of db.prepare('SELECT item_id FROM user_items WHERE user_id=?').all(userId)) { const it = SH.BY_ID[r.item_id]; if (!it) continue; if (it.type === 'badge') own.badge.add('shop:' + it.id); else own[it.type].add(it.id); }
  for (const g of grantsOf(userId)) { own.badge.add('adm:' + g.badge_id); if (g.badge_id === 'staff' || g.badge_id === 'traptech-team') own.frame.add('staff-glow'); }
  return own;
}
const ownedCount = (own) => own.banner.size + own.frame.size + own.title.size - 3; // excluding the 3 defaults

function computeStats(userId, opts = {}) {
  const u = db.prepare('SELECT id, is_demo, eq_banner, eq_frame, eq_title FROM users WHERE id=?').get(userId);
  const runs = db.prepare('SELECT game_id, score, started_at, created_at FROM runs WHERE user_id=? AND held=0 ORDER BY created_at, id').all(userId);
  const st = { runs: runs.length, points: 0, game: {}, pbBreaks: 0, f420: 0, fZero: 0, f777: 0, fDouble: 0, fMarathon: 0, fTwins: 0 };
  const days = new Set();
  for (const r of runs) {
    const g = st.game[r.game_id] || (st.game[r.game_id] = { runs: 0, best: null, streak: 0, cur: 0, last: null });
    const tiers = cfg.GAME_MAP[r.game_id]?.tiers || [Infinity];
    st.points += r.score; g.runs++;
    if (g.best !== null && r.score > g.best) { st.pbBreaks++; if (g.best >= 100 && r.score >= 2 * g.best) st.fDouble = 1; }
    g.best = g.best === null ? r.score : Math.max(g.best, r.score);
    g.cur = r.score >= tiers[0] ? g.cur + 1 : 0; g.streak = Math.max(g.streak, g.cur);
    if (g.last !== null && r.score > 0 && r.score === g.last) st.fTwins = 1;
    g.last = r.score;
    if (r.score >= 420 && String(r.score).endsWith('420')) st.f420 = 1;
    if (r.score === 0) st.fZero = 1;
    if (String(r.score).includes('777')) st.f777 = 1;
    if (r.created_at - r.started_at >= 8 * 60e3) st.fMarathon = 1;
    days.add(dayNum(r.created_at));
  }
  st.games = Object.keys(st.game).length; st.days = days.size;
  const ds = [...days].sort((a, b) => a - b); let best = 0, cur = 0;
  for (let i = 0; i < ds.length; i++) { cur = i && ds[i] === ds[i - 1] + 1 ? cur + 1 : 1; best = Math.max(best, cur); }
  st.dayStreak = best;
  // giveaways
  const entered = db.prepare(`SELECT DISTINCT g.* FROM giveaways g JOIN giveaway_games gg ON gg.giveaway_id = g.id
    JOIN runs r ON r.game_id = gg.game_id AND r.held=0 AND r.user_id = ? AND r.started_at >= g.start_at AND r.created_at >= g.start_at AND r.created_at <= g.end_at AND r.score >= g.min_score`).all(userId);
  st.gwEntered = entered.length;
  st.gwWon = db.prepare('SELECT COUNT(*) AS c FROM winners WHERE user_id=?').get(userId).c;
  st.gwPodium = 0; const t = Date.now();
  for (const g of entered) if (g.end_at < t) { const e = boards.giveawayEntrants(g); const me = e.find(x => x.user_id === userId); if (me && me.rank <= 3) { st.gwPodium = 1; break; } }
  // community
  st.reactions = db.prepare('SELECT COUNT(*) AS c FROM reactions WHERE user_id=?').get(userId).c;
  const eqB = u.eq_banner && u.eq_banner !== COS.DEFAULTS.banner, eqF = u.eq_frame && u.eq_frame !== 'none', eqT = u.eq_title && u.eq_title !== COS.DEFAULTS.title;
  st.eqBanner = eqB ? 1 : 0; st.fullFit = eqB && eqF && eqT ? 1 : 0;
  st.og = !u.is_demo && db.prepare('SELECT COUNT(*) AS c FROM users WHERE id <= ? AND is_demo = 0').get(userId).c <= 100 ? 1 : 0;
  // leaderboards (only the games we were asked about, to keep per-run evaluation cheap)
  const games = opts.games || cfg.GAMES.map(g => g.id);
  st.lb = { weeklyTop10: 0, weeklyTop3: 0, weekly1: 0, monthly1: 0, globalTop10: 0, allTime1: 0 };
  const rankIn = (rows) => { const i = rows.findIndex(r => r.user_id === userId); return [i + 1, rows.length]; };
  // the same boards are needed several times below (same t => same rows): query each one once per evaluation
  const memo = new Map(); const gb = (gid, since = 0) => { const k = gid + ':' + since; let r = memo.get(k); if (!r) memo.set(k, r = boards.gameBoard(gid, since)); return r; };
  for (const gid of games) {
    const [wr, wn] = rankIn(gb(gid, t - 7 * 864e5));
    if (wr) { if (wn >= 11 && wr <= 10) st.lb.weeklyTop10 = 1; if (wn >= 5 && wr <= 3) st.lb.weeklyTop3 = 1; if (wn >= 5 && wr === 1) st.lb.weekly1 = 1; }
    const [mr, mn] = rankIn(gb(gid, t - 30 * 864e5)); if (mr === 1 && mn >= 5) st.lb.monthly1 = 1;
  }
  for (const g of cfg.GAMES) { if (!st.game[g.id]) continue; const [ar, an] = rankIn(gb(g.id)); if (ar === 1 && an >= 3) st.lb.allTime1++; }
  const [gr, gn] = rankIn(boards.globalBoard(0)); if (gr && gr <= 10 && gn >= 11) st.lb.globalTop10 = 1;
  // v3
  const PR = require('./progress');
  st.streakBest = PR.streakInfo(userId).best; st.questsDone = PR.questsDone(userId);
  st.level = PR.levelFor(PR.xpFor(userId)).level; st.seasonTier = PR.bestSeasonTier(userId);
  st.tourney = require('./tournaments').placements(userId);
  st.following = db.prepare('SELECT COUNT(*) AS c FROM follows WHERE follower_id=?').get(userId).c;
  st.followers = db.prepare('SELECT COUNT(*) AS c FROM follows WHERE followee_id=?').get(userId).c;
  st.referrals = db.prepare('SELECT COUNT(*) AS c FROM users r WHERE r.referred_by=? AND r.banned=0 AND EXISTS (SELECT 1 FROM runs WHERE user_id=r.id AND held=0)').get(userId).c;
  st.referred = db.prepare('SELECT referred_by FROM users WHERE id=?').get(userId).referred_by ? 1 : 0;
  st.shares = db.prepare('SELECT COUNT(*) AS c FROM shares WHERE user_id=?').get(userId).c;
  // v5
  st.chalWins = db.prepare("SELECT COUNT(*) AS c FROM challenges WHERE winner_id=? AND status='completed'").get(userId).c;
  st.goldGames = cfg.GAMES.filter(g => (st.game[g.id]?.best || 0) >= g.tiers[2]).length;
  st.top1pct = 0;
  for (const g of cfg.GAMES) { if (!st.game[g.id]) continue; const rows = gb(g.id); if (rows.length < 100) continue; const i = rows.findIndex(r => r.user_id === userId); if (i >= 0 && i + 1 <= Math.ceil(rows.length * 0.01)) { st.top1pct = 1; break; } }
  st.lb.weekly1Count = 0;
  for (const g of cfg.GAMES) { const rows = gb(g.id, t - 7 * 864e5); if (rows.length >= 5 && rows[0].user_id === userId) st.lb.weekly1Count++; }
  memo.clear();
  return st;
}

const ins = db.prepare('INSERT OR IGNORE INTO user_achievements (user_id, ach_id, unlocked_at) VALUES (?,?,?)');
// Evaluate and persist newly unlocked achievements. Returns the new unlocks (for the toast).
function evaluate(userId, opts = {}) {
  const have = unlockedMap(userId);
  const st = computeStats(userId, opts);
  const fresh = []; const t = Date.now();
  for (let pass = 0; pass < 3; pass++) {
    st.achCount = have.size; st.owned = ownedCount(ownedFrom(have));
    let added = 0;
    for (const a of A) {
      if (have.has(a.id)) continue;
      if (a.value(st) >= a.target) { ins.run(userId, a.id, t); have.set(a.id, t); fresh.push(a); added++;
        if (!opts.quiet) require('./notify').notify(userId, 'achievement', `Achievement unlocked: ${a.name}`, a.desc, '/achievements', a.icon, t); }
    }
    if (!added) break;
  }
  return { fresh: fresh.map(a => publicAch(a, true)), stats: st, have };
}
function rewardInfo(r) { const it = COS.BY[r.type][r.id]; return { type: r.type, id: r.id, name: it.name }; }
function publicAch(a, unlocked) {
  const hide = a.hidden && !unlocked;
  return { id: a.id, cat: a.cat, tier: a.tier, icon: hide ? 'circle-help' : a.icon, game: a.game || null, hidden: a.hidden,
    name: hide ? 'Secret achievement' : a.name, desc: hide ? 'Hidden until you unlock it. Keep playing!' : a.desc, target: a.target,
    rewards: hide ? [] : a.rewards.map(rewardInfo) };
}
function rarity() {
  const total = db.prepare('SELECT COUNT(*) AS c FROM users WHERE banned=0').get().c || 1;
  const rows = db.prepare('SELECT ua.ach_id, COUNT(*) AS c FROM user_achievements ua JOIN users u ON u.id = ua.user_id WHERE u.banned = 0 GROUP BY ua.ach_id').all();
  const m = Object.fromEntries(rows.map(r => [r.ach_id, r.c]));
  return { total, pct: (id) => Math.round(((m[id] || 0) / total) * 1000) / 10 };
}
const rarityLabel = (p) => p >= 50 ? 'Common' : p >= 20 ? 'Uncommon' : p >= 5 ? 'Rare' : p >= 1 ? 'Epic' : 'Legendary';

// Equipped cosmetics as shown next to a player's name (leaderboards, community, profile)
function publicCos(u) {
  const banner = COS.BY.banner[u.eq_banner] ? u.eq_banner : COS.DEFAULTS.banner;
  const frame = COS.BY.frame[u.eq_frame] ? u.eq_frame : COS.DEFAULTS.frame;
  const title = (COS.BY.title[u.eq_title] || COS.BY.title[COS.DEFAULTS.title]).name;
  const eb = String(u.eq_badge || ''); let badge = null;
  if (eb.startsWith('adm:') && ADMIN_BY[eb.slice(4)]) { const x = ADMIN_BY[eb.slice(4)]; badge = { id: eb, name: x.name, icon: x.icon, tier: 'admin' }; }
  else if (eb.startsWith('shop:')) { const x = require('./shop').BY_ID[eb.slice(5)]; if (x && x.type === 'badge') badge = { id: eb, name: x.name, icon: x.extra, tier: x.rarity }; }
  else if (BY_ID[eb]) { const b = BY_ID[eb]; badge = { id: b.id, name: b.name, icon: b.icon, tier: b.tier }; }
  const color = COS.BY.color[u.eq_color] ? u.eq_color : ''; const effect = COS.BY.effect[u.eq_effect] ? u.eq_effect : '';
  return { banner, frame, title, badge, ...(color ? { color } : {}), ...(effect ? { effect } : {}) };
}
// ---------- v5: unique badge art (procedural SVG medallion per achievement: tier shape + id-derived hue/pattern + glyph) ----------
const SHAPES = {
  bronze: 'M50 6 A44 44 0 1 1 49.9 6 Z', silver: 'M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z', gold: 'M50 4 L90 16 L86 60 Q80 84 50 96 Q20 84 14 60 L10 16 Z',
  epic: 'M50 3 L61 34 L95 36 L68 56 L78 90 L50 70 L22 90 L32 56 L5 36 L39 34 Z', legendary: 'M50 2 L64 14 L84 10 L86 30 L98 44 L88 60 L92 80 L72 84 L60 98 L50 88 L40 98 L28 84 L8 80 L12 60 L2 44 L14 30 L16 10 L36 14 Z',
  admin: 'M50 4 L94 26 L94 74 L50 96 L6 74 L6 26 Z',
};
const TIER_RIM = { bronze: ['#f5c79b', '#9a5b2b'], silver: ['#f1f5f9', '#64748b'], gold: ['#fef08a', '#b45309'], epic: ['#f0abfc', '#7e22ce'], legendary: ['#fde047', '#db2777'], admin: ['#ffffff', '#22d3ee'] };
function hashStr(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function badgeSvg(id, iconPaths) {
  const a = BY_ID[id]; const adm = id.startsWith('adm:') ? ADMIN_BY[id.slice(4)] : null; if (!a && !adm) return null;
  const tier = adm ? 'admin' : a.tier; const h = hashStr(id); const hue = adm ? null : h % 360; const pat = (h >> 9) % 4;
  const c1 = adm ? adm.color : `hsl(${hue},80%,58%)`; const c2 = adm ? '#0b1030' : `hsl(${(hue + 40) % 360},70%,22%)`;
  const [r1, r2] = TIER_RIM[tier];
  const patterns = [`<circle cx="50" cy="50" r="30" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="6"/>`, `<path d="M0 30 L100 70 M0 50 L100 90 M0 10 L100 50" stroke="#fff" stroke-opacity=".1" stroke-width="5"/>`,
    `<g fill="#fff" fill-opacity=".12"><circle cx="28" cy="30" r="5"/><circle cx="72" cy="34" r="4"/><circle cx="64" cy="72" r="6"/><circle cx="32" cy="70" r="3"/></g>`, `<path d="M50 10 L50 90 M10 50 L90 50" stroke="#fff" stroke-opacity=".1" stroke-width="8"/>`];
  const glyph = iconPaths ? `<g transform="translate(30 30) scale(1.6667)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPaths}</g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><radialGradient id="f" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient><linearGradient id="r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${r1}"/><stop offset="1" stop-color="${r2}"/></linearGradient><clipPath id="c"><path d="${SHAPES[tier]}"/></clipPath></defs>
<path d="${SHAPES[tier]}" fill="url(#f)" stroke="url(#r)" stroke-width="5" stroke-linejoin="round"/><g clip-path="url(#c)">${patterns[pat]}<ellipse cx="38" cy="22" rx="30" ry="12" fill="#fff" fill-opacity=".18"/></g>${glyph}</svg>`;
}
module.exports = { ownedAll, ADMIN_BADGES, ADMIN_BY, grantsOf, badgeSvg, ACHIEVEMENTS: A, BY_ID, CATS, evaluate, computeStats, unlockedMap, ownedFrom, ownedCount, publicAch, rarity, rarityLabel, publicCos };
