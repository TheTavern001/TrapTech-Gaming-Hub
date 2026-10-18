'use strict';
// v8 cosmetic universe: an unbounded, deterministic catalog of uniquely named cosmetics.
// Nothing is stored or preloaded: item(i) is a pure function of its index i, so 12,000 designs (and every index beyond)
// cost no RAM until somebody asks for one. Names are a bijection of the index (no serials, no repeats);
// once a theme/type name space (1,200 combos) is used up, an edition numeral is appended ("... II"), so names stay unique forever.
//   index i % 3 === 2  -> earn-only item (achievements / quests / season rewards, id letter 'a')
//   otherwise          -> shop item (id letter 'u'); the shop walks a never-repeating permutation of the shop indices.
const UNIVERSE_SIZE = 12000; // designs shown in the browsable catalog (the generator itself is unbounded)
const THEMES = ['culture', 'gaming', 'money'];
const L = (s) => s.trim().split(/\s*,\s*/);
const ADJ = {
  culture: L(`Frosted, Sticky, Golden, Purple, Hazy, Cured, Emerald, Velvet, Midnight, Amber, Mellow, Sun-Grown, Resin, Lush, Verdant, Smoky, Dewy, Wild, Tropic, Alpine, Citrus, Piney, Earthy, Fruity, Skunky, Creamy, Lemon, Berry, Cosmic, Slow-Burn, Hand-Rolled, Small-Batch, Organic, Heirloom, Greenhouse, Moonlit, Dawn-Lit, Candlelit, Lazy, Roasted`),
  gaming: L(`Neon, Pixel, Turbo, Glitch, Retro, Hyper, Laser, Arcade, Quantum, Chrome, Cyber, Combo, Overclocked, Warp, Synth, Vector, Binary, Holo, Plasma, Voltage, Rapid, Lag-Free, Frame-Perfect, Respawned, Boss-Tier, Crit, Speedrun, Co-Op, Ranked, Flawless, Ultra, Bit-Crushed, Phantom, Strobing, Magnetic, Orbital, Ion, Prototype, Max-Level, Sudden-Death`),
  money: L(`Gold, Diamond, Platinum, Iced-Out, Royal, Mint, Stacked, Marble, Penthouse, Bullion, Gilded, Crystal, Opulent, Lavish, Regal, Sterling, Obsidian, Ivory, Satin, Brass, Silver, Onyx, Pearl, Ruby, Sapphire, Jade, Cobalt, Crimson, Polished, Tailored, Imperial, Prime, First-Class, Blue-Chip, Executive, Charter, Vaulted, Monogram, Rolling, High-Roller`),
};
const NOUN = {
  banner: {
    culture: L(`Canopy, Garden, Haze, Grove, Bloom, Greenhouse, Fields, Harvest, Vapor, Glasshouse, Terrace, Meadow, Orchard, Nursery, Trellis, Lagoon, Valley, Ridge, Cloudbank, Lantern Row, Courtyard, Rooftop, Sunroom, Cellar, Porch, Marsh, Dunes, Foothills, Boardwalk, Cove`),
    gaming: L(`Grid, Circuit, Skyline, Warp Zone, Cabinet Row, Mainframe, Hyperlane, Lobby, Arena, Server Farm, Datastream, Overworld, Dungeon, Raceway, Pit Stop, Control Room, Starport, Boss Room, Spawn Point, Checkpoint, Leaderboard, Neon Alley, Rift, Orbit, Sandbox, Hangar, Pixel Plains, Terminal, Skybridge, Loading Screen`),
    money: L(`Vault, Penthouse, Skyrise, Treasury, Atrium, Boardroom, Marble Hall, Yacht Deck, Casino Floor, Auction House, Rooftop Bar, Gala, Ballroom, Mint Hall, Exchange Floor, Gold Coast, Boulevard, Villa, Lounge, Terrace Club, Harbor, Grand Staircase, Skybox, Summit, Cashmere Suite, Jet Cabin, Ledger Room, Estate, Chateau, Promenade`),
  },
  frame: {
    culture: L(`Laurel, Leafwreath, Vine Ring, Terp Halo, Bud Crest, Kief Rim, Sprout Band, Fern Crown, Petal Ring, Canopy Arch, Moss Bezel, Root Circle, Clover Seal, Herb Wreath, Thorn Band, Blossom Orbit, Trellis Loop, Seed Chain, Mist Ring, Resin Ring, Grove Gate, Dew Halo, Ivy Border, Reed Circlet, Sage Seal, Hemp Braid, Glass Loop, Bloom Medal, Sunburst Leaf, Cloud Rim`),
    gaming: L(`Hex Ring, Pixel Border, Power Ring, Joystick Halo, Cartridge Edge, Circuit Band, Laser Rim, Shield Orbit, Combo Ring, Bit Bezel, Neon Loop, Turbo Halo, Health Bar Ring, Gamepad Crest, Crosshair Ring, Warp Gate, Plasma Band, Core Ring, Level Ring, Vector Halo, Overclock Rim, Sync Ring, Scanline Border, Respawn Halo, Voltage Ring, Radar Ring, Quest Seal, Boss Medal, Glitch Edge, Star Gate`),
    money: L(`Signet, Coin Ring, Laurel Crown, Bezel, Cufflink Halo, Crest, Vault Door, Medallion Ring, Gilt Edge, Emblem Ring, Ingot Border, Diamond Setting, Pinstripe Ring, Crown Circlet, Seal of Trust, Gold Band, Banknote Border, Pearl Strand, Royal Oval, Monarch Ring, Tiara Rim, Estate Seal, Chain Link Ring, Platinum Halo, Brooch, Karat Ring, Gem Bezel, Founders Ring, Cashmere Edge, Insignia`),
  },
  title: {
    culture: L(`Grower, Connoisseur, Cultivator, Roller, Sommelier, Herbalist, Botanist, Cloud Surfer, Terp Hunter, Curator, Keeper, Alchemist, Gardener, Harvester, Sage, Trimmer, Taster, Nomad, Pioneer, Ambassador, Caretaker, Forager, Breeder, Brewer, Elder, Vanguard, Storyteller, Lorekeeper, Wayfinder, Regular`),
    gaming: L(`Speedrunner, Combo King, Glitch Hunter, Final Boss, Respawner, Pixel Prophet, Clutch Master, Button Masher, Score Chaser, Underdog, Veteran, Sharpshooter, Strategist, Tactician, Grinder, Challenger, Contender, Pathfinder, Gatekeeper, Rookie Slayer, Tryhard, Overlord, Specialist, Marksman, Streaker, Wildcard, Flawless Runner, Frame Trapper, Champion, Legend`),
    money: L(`Magnate, Tycoon, Big Spender, Vault Keeper, Mogul, Dealmaker, Financier, Collector, Patron, Baron, Hustler, Investor, Maverick, Trailblazer, Founder, Boss, Mastermind, Heir, Sovereign, Banker, Appraiser, Broker, Philanthropist, Connoisseur of Gold, Gambler, Closer, Architect, Director, Chairman, Titan`),
  },
  badge: {
    culture: L(`Sprout, Leaf, Bud, Pipe, Jar, Lantern, Moon Phase, Sun Dial, Mushroom, Beehive, Dragonfly, Orchid, Cactus, Fern, Acorn, Feather, Kettle, Mortar, Trowel, Snail Shell, Compass, Teapot, Wind Chime, Hourglass, Raindrop, Pinecone, Lotus, Firefly Jar, Crescent, Seedling`),
    gaming: L(`Controller, Joystick, Cartridge, Pixel Heart, Power Core, Trophy, Boss Skull, Shield, Sword, Crosshair, Dice, Chip, Rocket, Cursor, Console, Headset, Pixel Star, Battery, Gear, Warp Orb, Potion, Key, Crown, Joypad, Medal, Flag, Atom, Bolt, Mask, Joker Card`),
    money: L(`Coin, Ingot, Gem, Key, Safe, Watch, Cufflink, Briefcase, Crown, Scales, Ledger, Diamond, Pearl, Ruby, Emerald, Chalice, Ring, Pocket Watch, Wax Seal, Money Clip, Chess Knight, Skyscraper, Compass Rose, Vault Wheel, Fountain Pen, Top Hat, Yacht, Globe, Horseshoe, Star`),
  },
  color: {
    culture: L(`Glow, Smog, Ink, Gleam, Tone, Blaze, Fume, Wash, Blush, Drift, Shade, Sheen, Dew, Ember, Aura, Tint, Smolder, Dusk, Pollen, Steam, Silk, Spark, Tide, Glimmer Dust, Flush, Veil, Echo, Beat, Whisper, Halo`),
    gaming: L(`Glitch, Signal, Beat, Flux, Beam, Scan, Surge, Spark, Noise Floor, Boost, Charge, Trace, Strobe, Overlay, Render, Stream, Burst, Sync, Phase, Shock, Amp, Blur, Fade, Chroma, Vector, Wave, Flare, Lock-On, Ping, Echo`),
    money: L(`Foil, Gilt Leaf, Plate, Gleam, Luster, Gild, Polish, Mirror, Shine, Veneer, Lacquer, Sheen, Patina, Burnish, Satin, Glaze, Finish, Wash, Tint, Brilliance, Flash, Glint, Radiance, Dazzle, Enamel, Fume, Inlay, Glimmer Dust, Spark, Gloss`),
  },
  effect: { // order matters: index % 10 selects the animation kind (embers, aurora, shimmer, snow, pulse, confetti, fog, starfall, static, fireflies)
    culture: L(`Embers, Aurora, Shimmer, Snowfall, Pulse, Confetti, Fog, Starfall, Static, Fireflies, Ashfall, Skyglow, Glitter, Flurry, Heartbeat, Petals, Mist, Meteors, Crackle, Glowbugs, Sparks, Northern Lights, Dewdrops, Frostfall, Throb, Blossoms, Haze Cloud, Comets, Hiss, Sparklers`),
    gaming: L(`Overheat, Boost Aura, Pixel Glint, Data Snow, Power Pulse, Victory Confetti, Smoke Screen, Star Rush, CRT Static, Spark Swarm, Reactor Embers, Plasma Aurora, Chrome Flash, Cryo Flakes, Charge Pulse, Loot Confetti, Steam Vent, Warp Streaks, Signal Noise, Pixie Drones, Forge Sparks, Ion Aurora, Holo Glimmer, Blizzard Bits, Lock-On Pulse, Combo Burst, Dry Ice, Comet Run, Scanline Hum, Sprite Swarm`),
    money: L(`Gold Embers, Champagne Aurora, Diamond Glint, Platinum Snow, Ticker Pulse, Cash Confetti, Cigar Smoke, Gilded Stars, Ticker Static, Gold Fireflies, Brass Sparks, Jade Aurora, Crystal Sparkle, Silver Snowfall, Boardroom Pulse, Ticker Tape, Penthouse Haze, Falling Gems, Vault Static, Lux Fireflies, Copper Embers, Sapphire Aurora, Pearl Shimmer, Velvet Snow, Dividend Pulse, Gala Confetti, Velvet Fog, Star Ledger, Market Static, Candle Glow`),
  },
};
const CYCLE = ['banner', 'frame', 'banner', 'title', 'badge', 'effect', 'frame', 'banner', 'color', 'badge', 'title', 'effect']; // 12-slot cycle
const CNT = {}; const RANK = [];
CYCLE.forEach((t, j) => { CNT[t] = (CNT[t] || 0) + 1; RANK[j] = CNT[t] - 1; });
const ROMAN = ['', '', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const edition = (e) => (e < 1 ? '' : ' ' + (ROMAN[e + 1] || 'Mk ' + (e + 1)));
const SPACE = 1200, STRIDE = 997; // 40 adjectives x 30 nouns per (type, theme); 997 is prime and coprime to 1200
const PAL = { culture: ['kush', 'haze', 'terp', 'sunset', 'mint', 'toxic', 'dab', 'lucky', 'ocean', 'summer'], gaming: ['neon', 'arcade', 'galaxy', 'toxic', 'chrome', 'ocean', 'frost', 'lava', 'ember', 'spooky'], money: ['gold', 'chrome', 'ice', 'royal', 'mint', 'rose', 'terp', 'love', 'holly', 'dab'] };
const MOTIFS_BY_THEME = { culture: ['canopy', 'smoke', 'bokeh', 'waves', 'contours', 'aurora', 'ridges', 'petals', 'dunes'], gaming: ['synthwave', 'circuit', 'hexes', 'skyline', 'shards', 'galaxy', 'stripes', 'rain', 'orbits'], money: ['skyline', 'shards', 'stripes', 'bokeh', 'contours', 'hexes', 'waves', 'lanterns', 'orbits'] };
function h32(...parts) { let h = 2166136261; for (const c of parts.join('|')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return h >>> 0; }
const isEarn = (i) => i % 3 === 2;
function rarityOf(i, earn) { const x = h32('rar', i) % 1000; const t = earn ? [0, 380, 780, 940] : [520, 820, 960, 1000]; return x < t[0] ? 'common' : x < t[1] ? 'rare' : x < t[2] ? 'epic' : 'legendary'; }
function nameParts(i) {
  const q = Math.floor(i / 12), j = i % 12, type = CYCLE[j];
  const occ = q * CNT[type] + RANK[j];
  const theme = THEMES[occ % 3], k = Math.floor(occ / 3);
  const e = Math.floor(k / SPACE), kk = ((k % SPACE) * STRIDE) % SPACE;
  const a = kk % 40, b = (Math.floor(kk / 40) + a * 11) % 30;
  return { type, theme, adj: ADJ[theme][a], noun: NOUN[type][theme][b], b, e };
}
function nameOf(i) {
  const n = nameParts(i);
  return `${n.adj} ${n.noun}${edition(n.e)}`;
}
// ctx accepted by shop-gen make(): everything about item i
function ctx(i) {
  i = Math.max(0, Math.floor(Number(i) || 0));
  const n = nameParts(i), earn = isEarn(i), r = h32('uni', i);
  const pals = PAL[n.theme];
  const out = { type: n.type, theme: n.theme, rarity: rarityOf(i, earn), name: nameOf(i), palette: pals[r % pals.length], universe: i, earn };
  if (n.type === 'effect') out.fxKind = n.b % 10;
  if (n.type === 'banner') out.motif = MOTIFS_BY_THEME[n.theme][(r >>> 7) % MOTIFS_BY_THEME[n.theme].length];
  return out;
}
// the shop mints universe items in a never-repeating order: a full-period permutation of the shop (non-earn) indices,
// block by block (8,000 shop designs per 12,000 indices), so a given design cannot reappear before the whole block has been shown.
const BLOCK = 8000, PSTRIDE = 3001; // gcd(3001, 8000) = 1
function shopIndex(n) {
  n = Math.max(0, Math.floor(n)); const blk = Math.floor(n / BLOCK), p = ((n % BLOCK) * PSTRIDE + blk * 1237) % BLOCK;
  const e = blk * BLOCK + p; return Math.floor(e / 2) * 3 + (e % 2);
}
const earnIndex = (seed) => (h32('earn', seed) % (UNIVERSE_SIZE / 3)) * 3 + 2; // earn-only design for a given achievement/quest key
const idOf = (i) => { const c = ctx(i); return (c.type === 'effect' ? 'fx-' : '') + 'v7' + (isEarn(i) ? 'a' : 'u') + i + 's0'; };
function stats(sample = UNIVERSE_SIZE) { const by = {}, names = new Set(); let dup = 0; for (let i = 0; i < sample; i++) { const c = ctx(i); by[c.type] = (by[c.type] || 0) + 1; if (names.has(c.type + '|' + c.name)) dup++; names.add(c.type + '|' + c.name); } return { sample, unique_names: names.size, duplicates: dup, by_type: by }; }
module.exports = { UNIVERSE_SIZE, THEMES, ctx, nameOf, shopIndex, earnIndex, isEarn, idOf, stats, h32, ADJ, NOUN };
