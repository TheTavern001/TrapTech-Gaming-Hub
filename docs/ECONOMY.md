# Hub economy (current v8 rules): shop rotations, endless items, prices, earned items, seasons

**Current rules verified against `src/shop.js` and `src/monetize.js` at `d7809e3` on October 18, 2026 (ET).** Historical API field names containing `vault` do not imply current retirement.

This is the reference for the engine in `src/shop.js`, `src/shop-gen.js` and `src/seasons.js`. The admin panel
(`src/admin-ops.js`, `src/admin-ui/`) is built on the hooks listed at the end. Tests: `node tools/e2e-economy.js`
(throwaway database, about 4 s).

All times are **hub time** (`America/New_York`, from `src/progress.js` `dayNum` / `dayStart`). A "day" starts at
midnight hub time. A week starts on Monday at midnight. The browser shows every countdown and date in the player's
own time zone.

## 1. How the shop rotates

| Section | Changes | What is in it |
|---|---|---|
| **Daily** | every midnight | 6 items: 2 brand-new generated items, 1 returning-item slot (an item whose cooldown has elapsed, or a catalog pick when none is due), and 3 catalog picks |
| **Weekly featured** | Monday midnight | 4 items: 2 brand-new epic or legendary items, plus 2 epic or legendary catalog picks |
| **Season shop** | when the season changes | 6 items made for the season's palette and theme, on sale all season |
| **Events** | on calendar dates | 6 themed items while the event runs (see below) |
| **Earned** | never sold | score-gated and leaderboard items (section 4) |

The shop is a **deterministic simulation**. It starts on `EPOCH_DAY` (20727, Thu 2026-10-01) and steps forward day by
day. Each day's picks come from hashes of the day number, so every server process, and every restart, shows the same
shop. It only depends on the date, never on who asked first. Nothing is stored. The sim runs to today plus 7 days,
which takes about 1 s for 2 years of history.

**Current cooldown and return rules (from October 18, 2026):**
- Minimum catalog return gaps are **60 / 120 / 180 / 270 days** for common / rare / epic / legendary (`COOL`). Eligibility after cooldown does not guarantee a listing on that date.
- There is **no automatic retirement or lifetime listing cap**. The cutover clears the old Vault; previously retired items rejoin the pool, subject to their last appearance and current cooldown.
- Season-shop items become return candidates 365 days after their season. Track rewards remain separate from the rotating shop.
- Historical simulation before the cutover retains the old 10 / 14 / 21 / 28 day cooldowns, listing caps and Vault rules solely to reproduce past shop days. Do not use those legacy values for current product copy or new features.
- Internal names such as `vault_radar`, old tags and admin moderation fields remain for compatibility. They do not authorize automatic retirement of current designs.

**Prestige:** unlimited copies of each design, at most one active entitlement per player per design. No numbered editions or global ownership cap. See [the current prestige specification](ONE-OF-ONE-PRESTIGE-COLLECTIBLES.md); its filename is retained for existing links.

**Events** (`EVENTS`, every year):

| Event | Dates |
|---|---|
| Launch Week (later years: Hub Birthday Week) | Oct 1-7 |
| Spooky Haze | Oct 24 - Nov 1 |
| Munchies Week | Nov 24-30 |
| Frosted Holidays | Dec 18-31 |
| New Year Glow | Jan 1-4 |
| Heart Eyes | Feb 10-15 |
| Lucky Green | Mar 14-18 |
| 4/20 Week | Apr 16-21 |
| Summer Arcade | Jun 20-28 |
| 7/10 Dab Days | Jul 8-11 |

From the second year, each event brings 4 new items plus 2 returning ones from the year before. Admin-created
`hub_events` of kind `themed_weekend` also show as events, with generated items. Use `eventsOn(t)` and
`upcomingEvents()`.

## 2. The endless item generator (`src/shop-gen.js`)

Every generated item is defined by its **id**: `[fx-]v7<src><num>s<slot>`.
- `src` is the source:
  - `d` daily
  - `w` weekly
  - `s` season shop
  - `k` season track
  - `e` event
  - `b` earned
- `num` is the day number, week, season number, event-year or gate number.
- `slot` is the slot within it.

`parse(id)` rebuilds the full item from the id alone, with the same output every time (cached). That means:
- generated items do not need a database table
- `user_items.item_id` and `users.eq_*` just store the id
- `cosmetics.js` resolves them through `shop.attach(BY)`
- junk ids resolve to `null`

Contexts are hooks in `parse.contexts[src]`, registered by shop.js and seasons.js. They supply forced
type, rarity, palette, theme, name or words for event, season, track and earned items.

**What it makes:**
- **Types:** banner 26%, frame 20%, name colour 16%, title 16%, badge 12%, effect 10%.
- **Rarity:** common, rare, epic, legendary. Weekly slots are only epic or legendary.
- **Palettes and themes:** 24 palettes (neon, haze, kush, terp, chrome, gold, galaxy, ...) × 3 themes (cannabis
  culture, gaming, money and grind). Each has its own word lists for names and titles.
- **Banners:** 14 SVG motifs: skyline, synthwave, ridges, waves, canopy, smoke, bokeh, circuit, shards, contours,
  aurora, galaxy, hexes, stripes. Each is seeded from the id, so no two look the same. They are served as cached
  files from `/shop/art/<id>.svg` (each under 16 KB).
- **Frames:** 4 ring styles, with spin, glow or pulse animation from epic up.
- **Name colours:** gradients, with an animated shimmer from epic up.
- **Badges:** a Lucide icon on a medallion (`badgeArt`).
- **Effects:** 10 animated profile auras (embers, aurora, shimmer, snow, pulse, confetti, fog, starfall, static,
  fireflies), using the shared `v7-*` keyframes.

**CSS.** `shop.css()` emits CSS only for the items that could be on screen: handmade items, the last 60 days of new
items, today ±2 days of rotations, the season items, and everything anyone owns. That is about 15-30 KB.
`/cosmetics.css` is rebuilt when `shop.cssKey()` changes (new day or new purchases) and is cached for 10 minutes.

**Previews.** The shop detail sheet has an **Item** tab, which shows the item rendered on its own, and an
**On my profile** tab, which shows the item applied to the viewer's real name card, avatar frame, title and badge.

## 3. Prices (no fixed tiers)

`priceParts(item, t)` explains every price. The `/api/shop/item/:id` "Why this price" table shows the same parts.

```
price = rarity base (150 / 400 / 900 / 2000)
      × type        (title 0.7, badge 0.8, colour 0.9, banner 1, frame 1.1, effect 1.25)
      × demand      (this item's buys in the last 14 days vs the average for its type; 0.85 - 1.35)
      × scarcity    (only after its debut AND with at least 500 active players: owned by <1% of active players 1.1, <5% 1.04, >12% 0.95, >25% 0.88)
      × appearances (debut 1.08, legacy Vault return 1.25, 1-2 earlier listings 1, 3-4 0.94, 5+ 0.88)
      × section     (season shop and event items 1.15)
      × jitter      (0.96 - 1.04, fixed per item)
clamped to 0.6× - 2.2× of rarity × type, rounded to 5, minimum 50
```

- **Small populations:** `MIN_ACTIVE_FOR_SCARCITY=500`; the scarcity multiplier is exactly 1 below that threshold.
- **Prices are set at midnight and hold all day.** Today's purchases only count from tomorrow, and the cache is
  per-day (`listPrice`).
- **What a player pays:** `priceFor(item, user)` is the list price minus the season perk discount (5 / 10 / 15%).
  The admin overlay's sales wrap `priceFor` too. **Always charge through `priceFor`.**
- **What a player earns** (`EARN`):

  | Source | Points |
  |---|---|
  | each run | 5, up to 40 a day |
  | personal best | +10 |
  | skill bonus on a PB | +5 at the "good player" level, +15 at the top-1% level, per game, from `docs/score-ranges.json` |
  | quests | 25 |
  | check-ins | 10 a day (max 70 a week) |
  | achievements | 20 to 400 |
  | referrals | 150 |
  | challenges | 30 |
  | season track | see section 5 |

## 4. Earned items (score and leaderboard gated)

`GATES` lists them. They are never sold (`buy` refuses them) and are granted by `grantGates(userId)`, which `sync`
runs.
- **Per giveaway-eligible game:**
  - a **Pro banner** at the "good player" personal best (`score-ranges.json` → `good.median_pb`, rounded)
  - an **Elite frame** at the top-1% best (`top1.pb`)
  The shop shows each player's best next to the requirement. This list follows `cfg.GAMES`, so it changes when the
  games list does.
- **Weekly leaderboard:** `grantWeekly()` runs hourly and once per week (settings key `econ_weekly_<week>`). Last
  week's top 3 on any game board get the **Weekly Podium** badge, and the top 10 get the **Weekly Top 10** title.
  Held runs, banned players and demo accounts are skipped.

## 5. Endless seasons and the reward track (`src/seasons.js`)

- **Calendar.** Seasons last 8 weeks (56 days) and roll forever. Season 1, "Neon Genesis", runs Oct 1 - Nov 25 2026
  (it ends at 11:59:59 PM ET). There are 20 names; after those, a numeral is added ("Purple Haze II").
- **Overrides.** Admin changes are stored in `season_overrides`. Extending or shortening a season shifts every season
  after it.
- **XP.** Season XP is the normal hub XP (`progress.xpFor`) earned inside the season window, plus the head start.
- **Track.** 60 free levels. There is no paid pass.
  - **Level cost:** level L costs `200 + 10L` XP, so level 60 is 30,300 XP. That is about 6-8 weeks of regular play.
  - **Cosmetics:** 13 season-exclusive cosmetics, at levels 3, 6, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55 and 60
    (`SCHEDULE`). They are never sold and never return.
  - **Points:** every other level pays `40 + 20 × floor(L/10)` Hub Points.
  - **Perks:**

    | Level | Perk |
    |---|---|
    | 8 | 5% off |
    | 18 | early peek at tomorrow's daily picks |
    | 28 | 10% off |
    | 38 | vault radar: Vault returns over the next 7 days |
    | 48 | 15% off |
    | 58 | season glow on the leaderboard |

  - **Overdrive:** past level 60, every 2,000 XP is an Overdrive star worth 100 points, up to 20 per season.
  - `claimTrack(userId)` grants everything unlocked. It is idempotent: ledger reason `season`, refs
    `<n>:L<level>` and `<n>:O<k>`. `shop.sync` calls it.
- **Soft reset.** Each season starts at 0 XP plus a **head start** of 10% of last season's XP, up to 2,000.
- **End of season.** `archive(n)` runs from `sweep()` every 10 minutes and on `/api/seasons`. It:
  - writes `season_results` (rank, xp, level) for every player with XP
  - logs to `season_archive_log`
  - gives the top 10 the "S<n> Top 10" title and #1 the "S<n> Champion" title
  - sends notifications

  The hall of fame (`hallOfFame()`) and each player's past seasons (`history(userId)`) read from it.
- **Achievements.** `bestSeasonTier(userId)` keeps the old 20-step achievement scale (`floor(level / 3)`).

## 6. API

| Route | What |
|---|---|
| `GET /api/shop` | `view(user)`. Public, because the shop is browsable signed out. Returns `daily`, `weekly`, `season{items}`, `events[]`, `earned_items[]`, `daily_ends`/`weekly_ends`/`season_ends`, `perks`, `rules`, and, with perks, `peek` and `vault_radar`. Plus balance fields from v5b. |
| `POST /api/shop/buy` | `buy(user, id)` |
| `GET /api/shop/item/:id` | `detail(user, id)`: where it is on sale and until when, `priceParts`, `your_price`, `history` (first seen, appearances, vaulted), owners, requirement |
| `GET /api/shop/rules` | the rules text plus EARN, RARITY, TYPE_MULT, CAP, COOL |
| `GET /api/shop/upcoming` | upcoming events and the season end |
| `GET /shop/art/:id.svg` | generated banner and badge art (immutable, 30-day cache) |
| `GET /api/seasons` | current season, the viewer's progress, board, hall of fame, the viewer's history |
| `GET /api/seasons/:n` | one season (past ones from the archive) |

Pages are in `public/js/economy.js`:
- `/shop`
- `/season`
- `/shop/how-it-works`, the explainer (`/seasons-and-shop` and `/economy` redirect to it)

## 7. Engine functions

**`src/shop.js`**
- `rotation(t)` returns `{day, daily[], weekly[], season{number,name,items[]}, events[], tags{id:new|vault|returning|event}, daily_ends, weekly_ends, season_ends}`
- `inRotation(rot, item)` and `allOnSale(rot)`
- `buy(user, id, t)`, `sync(userId)` → balance, `balance`, `earned`, `owned(userId)` → Set
- `resolve(id)`, and `BY_ID[id]`, a Proxy that resolves handmade and generated items
- `pub(item, owned)`
- `listPrice(item, t)`, `priceParts(item, t)`, `priceFor(item, user, t)`
- `view(user, t)`, `detail(user, id, t)`, `history(id)`
- `catalog({limit, type, q})`: every item that has appeared so far, newest first, with history
- `schedule(days, t)`: the upcoming daily, weekly and event plan (the admin preview)
- `stats()`
- `listFor(ownedSet, type)`: items for the Customize page (owned plus on sale)
- `grantGates(userId)`, `grantWeekly(t)`, `gateItem(gate)`
- `eventsOn(t)`, `upcomingEvents()`
- `css()`, `cssKey()`, `attach(BYmaps)`, `routes(app, A, H)`
- constants: `EPOCH_DAY`, `EVENTS`, `GATES`, `CAP`, `COOL`, `TYPE_MULT`, `RARITY`, `EARN`, `RULES`, `DISCLAIMER`

**`src/shop-gen.js`**
- `make(src, num, slot, ctx)` and `parse(id)`
- `itemCss(item)`, `bannerSvg(seed, palette, motif, rarity)`, `badgeArt(item, iconSvg)`, `svgUri`
- `KEYFRAMES`, `PALETTES`, `MOTIFS`, `WORDS`, `ID_RE`, `hash`, `rng`

**`src/seasons.js`**
- `seasonAt(t)`, `info(n)`, `nameOf(n)`
- `seasonProgress(userId, t)`, `levelOf(xp)`, `trackFor(n, level)`, `trackItem(n, slot)`
- `claimTrack(userId)`, `perksOf(userId, t)` → `{discount, peek, vault, glow}`, `headStart(userId, n)`
- `seasonBoard(limit)`, `bestSeasonTier(userId)`
- `archive(n)`, `sweep()`, `hallOfFame(limit)`, `history(userId)`
- constants: `LEVELS`, `LEN_DAYS`, `CUM`, `PERKS`, `SCHEDULE`, `OVERDRIVE_XP`, `RULES`

`src/progress.js` `seasonAt`, `seasonProgress`, `seasonBoard` and `bestSeasonTier` delegate to `seasons.js`, so older
callers keep working. `tiers`, `tier`, `tier_xp`, `into` and `track[].reward` are still returned.

## 8. Admin hooks (used by `src/admin-ops.js`)

**Seasons.** `admin-ops.js` detects the engine through `require('./seasons').adminList`.
- `adminList()` returns `{engine: 'src/seasons.js', current{…, players, top}, seasons[] (3 back to 3 ahead, with state live/ended/upcoming and overrides), hall_of_fame, reward_types, rules, palettes, perks, length_days, levels}`.
- `adminUpdate(n, body, who)` edits the `name`, `theme` (palette key), `notes` and `ends_at` of the current or a
  future season. It can also set `starts_at` for a future season. It refuses an end inside the next hour.
  `track` is ignored, with a note: the track is fixed by the engine.
- `adminEnd(who, confirmName)` ends the live season now. When `confirmName` is given it must be the season's exact
  name. The season is archived immediately, everyone is notified and the next one starts. Returns
  `{ok, ended, next, archived}`.

**Shop.** These are safe to wrap; `buy` calls them through `module.exports`.
- `rotation`: pins and retired items. The overlay adds pins into `daily`/`weekly`, and `inRotation` then accepts them.
- `pub`: sale labels.
- `priceFor`: sales.
- `sync`: Double Points bonus.

Do not replace `buy`. If you need a different price, wrap `priceFor`. `view` and `detail` also price through
`module.exports.priceFor`, so a sale shows on the cards. Use `catalog()`, `schedule()` and `stats()` for the admin
shop screens. Item ids from `catalog()` are valid in pins, featured and retired lists.

## 9. Changing the numbers

Every constant is at the top of its file. Changing `CAP`, `COOL`, the slot counts or `EPOCH_DAY` changes **past** shop
history too, because the sim re-runs from the epoch. Owned items are never affected. Price constants only change
future prices. Season length changes only apply to seasons that have not started (use `adminUpdate` for the live one).
