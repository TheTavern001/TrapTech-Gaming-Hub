# Feature-gap research: The Gaming Hub vs. other gaming hubs and giveaway platforms

*Researched Oct 3, 2026 by Trap Tech Solutions for The Gaming Hub (v3). The "Before" column is the state before v3 and "After v3" is the state now. Priority = value for a **free-to-play, points-only giveaway gaming hub with cannabis-brand sponsors**.*

## Top findings
1. **Accounts with social features are now standard on web portals.** CrazyGames ships friends, an online/"playing now" status, one-click "play together", and profiles showing stats and **play streaks** [1][2]. Poki has accounts with cloud saves [3]. We had accounts but no social graph.
2. **Streaks and daily goals are the main retention tools.** Duolingo reports that users who reach a 7-day streak are 2.4x more likely to come back the next day, and streak-protection mechanics raised retention [4][5].
3. **Season / battle-pass tracks: XP from any activity unlocks a reward track** that lasts one season [6][7]. Our version has to be **free only**: no paid track, cosmetic only.
4. **Tournaments.** Skill-game platforms (Skillz) run head-to-head, **bracket**, and timed tournaments, mostly **asynchronous** (players play the same conditions at different times) [8][9][10]. Async play suits our single-player games.
5. **Giveaway tools grow through referrals.** Gleam's "Viral Share" gives each entrant a unique link and counts a referral only **when the referred person completes an action**, not on the click [11][12]. Gleam also supports random, leaderboard and manual winner picks [13].
6. **Streamer bots tie giveaways to loyalty points.** StreamElements does this with a loyalty-points system, ticket caps and multiple winners [14]. We stay points-only and do not sell tickets.
7. **Achievement identity.** Xbox (Gamerscore badges, completed-game highlights) and PlayStation (trophy levels, rarity) make long-term progression visible on the profile [15][16]. Kongregate tied badge points to account **levels** [17].
8. **Legal.** US sweepstakes need **"No purchase necessary"**, a free method of entry with equal odds, and clear rules covering eligibility, dates, entry, prizes, odds, winner selection and notification, and a winners list [18][19][20].
9. **Age gating for cannabis content.** Several states require a **neutral date-of-birth age screen** (a yes/no button is not enough in Maryland/Delaware) before cannabis-brand content is viewed [21][22].
10. **PWA install** needs a manifest (name, 192 and 512 px icons, start_url, standalone display). The automatic install prompt also needs a service worker with a fetch handler [23][24].

## Gap table
Who has it: CG = CrazyGames, Poki, itch = itch.io, Kong = Kongregate, Steam, Disc = Discord, Gleam, SE = StreamElements/Nightbot, Skillz, XB/PS = Xbox/PlayStation, FN = Fortnite.

| Feature | Who has it | Before | After v3 | Priority |
|---|---|---|---|---|
| Player accounts + profiles | CG, Poki, Steam, XB/PS | Yes | Yes (XP level, followers, season tier added) | - |
| Achievements + rarity | XB/PS, Steam, Kong | Yes (84) | **Yes (103)** | - |
| Player XP levels | Kong, XB (Gamerscore), FN | No | **Built** | High |
| Daily quests | FN, Duolingo-style apps | No | **Built** (3 a day + all-done bonus) | High |
| Daily login / play streaks | CG profiles, Duolingo | No | **Built** (daily check-in streak) | High |
| Seasons / free reward track | FN, most live games | No | **Built** (quarterly season, 20 free tiers, season board) | High |
| Tournaments: timed events | Skillz, Kong challenges | No | **Built** | High |
| Tournaments: brackets (async) | Skillz | No | **Built** (8-player seeded bracket from qualifiers) | Medium |
| Friends / follow | CG, Steam, Disc | No | **Built** (follow, friends leaderboard, following feed) | High |
| Notifications center | Disc, Steam, Skillz | Bell = live giveaway count | **Built** | High |
| Referral codes | Gleam viral share | No | **Built** (counts after the friend's first scored run; cosmetic rewards) | High |
| Shareable score / result cards (OG image) | Gleam share, Steam, games | No | **Built** (server-rendered PNG + share pages) | High |
| Giveaway share links | Gleam | No | **Built** (link + referral code) | High |
| Global activity feed | Steam, Disc | Partial (Community) | **Improved** (Everyone / Following tabs, new event types) | Medium |
| Search (games, players, giveaways) | CG, Poki, itch | Games only | **Built** (global search) | Medium |
| PWA install + offline shell | Poki/CG (mobile web) | No | **Built** | Medium |
| Official giveaway rules + NPN | Gleam (T&C generator), all sweepstakes | No | **Built** (template + per-giveaway rules) | High |
| Terms / Privacy / Responsible play | All | Combined stub | **Built** (separate pages) | High |
| 21+ age gate (date of birth) | Cannabis brand sites (required) | No | **Built** (neutral DOB gate + 21+ check at signup) | High |
| Accessibility (focus, aria, reduced motion, contrast) | WCAG 2.2 [25] | Partial | **Improved** | High |
| Dark mode | Most portals | Dark only (brand) | Dark by design (kept) | Low |
| Real-time multiplayer / play together | CG, Disc activities [26] | No | Not built (big infra) | Low (later) |
| Chat / DMs | Disc, Steam | No | Not built (moderation burden) | Low |
| Developer uploads / game jams | itch, Kong | No | Not built (not our model) | Low |
| Paid battle pass / loyalty-point shop | FN, SE | No | **Deliberately not built** (points/cosmetic only) | n/a |
| Streak freeze / repair | Duolingo | No | Not built | Low |

## Sources
1. CrazyGames account integration docs - https://docs.crazygames.com/requirements/account-integration/
2. PocketGamer.biz, "CrazyGames launches new social features" (Jun 2024) - https://www.pocketgamer.biz/crazygames-launches-new-social-features-for-instant-multiplayer-gaming/
3. Poki user accounts docs - https://developers.poki.com/guide/accounts
4. Duolingo blog, "Improving the streak" - https://blog.duolingo.com/improving-the-streak/
5. Duolingo blog, "How streaks keep learners committed" - https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/
6. Epic Games support, Fortnite passes - https://www.epicgames.com/help/en-US/c-Category_Fortnite/c-Fortnite_Gameplay/understanding-the-fortnite-battle-pass-lego-pass-og-pass-and-music-pass-a000094994
7. Fortnite Battle Pass page - https://www.fortnite.com/battle-pass
8. Skillz docs, tournaments - https://docs.skillz.com/docs/tournaments-and-gameplay-parameters/
9. Skillz support, bracketed tournaments - https://support.skillz.com/hc/en-us/articles/115001139223-How-do-bracketed-tournaments-work-When-do-they-pay-out
10. Skillz support, player matching (async) - https://support.skillz.com/hc/en-us/articles/211525983-How-does-Skillz-player-matching-work
11. Gleam docs, Viral Share - https://gleam.io/docs/actions/viral-share
12. Gleam guide, referral rewards - https://gleam.io/guides/referral-rewards
13. Gleam giveaways - https://gleam.io/solutions/giveaways
14. StreamElements giveaways module - https://docs.streamelements.com/chatbot/modules/giveaways
15. Windows Central, Xbox Gamerscore badges - https://www.windowscentral.com/gaming/xbox/a-welcome-change-xboxs-new-update-is-making-achievements-feel-meaningful-again-thanks-to-gamerscore-badges
16. Xbox Wire, achievements improvements (Apr 2026) - https://news.xbox.com/en-us/2026/04/08/xbox-insiders-may-2026-console-features/
17. Kongregate support, achievements/levels/badges/points - https://kongregatesupport.zendesk.com/hc/en-us/articles/26730968151437-What-are-achievements-levels-badges-and-points
18. Fasthoff Law, AMOE and equal dignity - https://fasthofflawfirm.com/blog/sweepstakes-alternate-method-of-entry-equal-dignity
19. USPIS consumer guide to sweepstakes - https://www.uspis.gov/wp-content/uploads/2019/12/pub-546_consumers-guide-to-sweepstakes-lotteries_508.pdf
20. Sweepstakes rules template guide - https://reviewraffles.com/sweepstakes-rules-template/
21. Maryland Cannabis Administration, age verification for websites - https://cannabis.maryland.gov/Documents/2025_PDF_Files/Bulletins/Age%20Verification%20Requirements%20for%20Websites%20and%20Social%20Media.pdf
22. Delaware advertising regulation (LII) - https://www.law.cornell.edu/regulations/delaware/4-Del-Admin-Code-SS-5001-10.0
23. web.dev, install criteria - https://web.dev/articles/install-criteria
24. Chrome for Developers, updated install criteria - https://developer.chrome.com/blog/update-install-criteria
25. W3C WCAG 2.2 - https://www.w3.org/TR/WCAG22/
26. Discord Activities - https://discord.com/blog/server-activities-games-voice-watch-together

## v4 design notes: giveaways with 100+ entrants
- **Why "reached first" is the main tiebreaker:** it rewards whoever set the score earliest and can't be gamed by playing again later. The server
  timestamp of the run is the official clock (Official Rules section 3). Fewer attempts comes next, then the earlier run ID, so every place is unique and
  rankings always reproduce.
- **Why commit-reveal for random draws:** publishing SHA-256(seed) before the end and the entrant-list hash at the end means the operator can't pick the seed
  after seeing the entrants. Anyone can recompute the order with standard SHA-256/HMAC tools (or the results page).
- **Why a locked snapshot plus DB triggers:** results for paid-out prizes must not shift if a late, replayed or back-dated score lands. Disqualifications and
  confirmations are stored separately, so the snapshot never changes and the audit trail shows every decision.

> Not legal advice. The giveaway rules and age gate are templates and good-faith implementations. Have counsel review them for each state/brand before running real prizes.

---

# v5 research (Oct 2026)

## 1. Potato in-app browser, phones and WebViews

**Potato Chat platform**
- Potato exposes a Telegram-style **Bot API** (HTTPS, `https://api.rct2008.com:8443/<token>/METHOD`, webhook or getUpdates) and an **authorized-login SDK**. Its interactive-web feature is the **game platform**: create a game with `/newgame`, send it with `sendGame`, answer the callback query with the game URL and *"the potato app will open our game in its built-in browser"*. No Telegram-style Mini-App/WebApp JS SDK (`window.Telegram.WebApp`-like) is documented, so the hub must work as a plain web page inside Potato's built-in browser. Sources: https://potato.im/api/bot , https://web.potato.im/bots , https://www.potato-chat.com.cn/en/api/
- Links: bots/users are reachable by `potato.im/<username>` links (documented for bots); channel invites use `https://m.pt.im/joinchat/<code>` which hands off to the app scheme `pt://join?invite=<code>`. Usernames: a-z, 0-9, `_`, case-insensitive, min 5 chars. Sources: https://potato.im/bots , https://m.pt.im/joinchat/7Cn0-JaPruK6IK5oKDuBAQ (page source), https://www.potato.im/faq
- Decision: winner/booking contact uses the handle (copy button) plus an `https://potato.im/<handle>` link; we do not depend on an undocumented `pt://user/...` scheme.

**WebView behaviour that breaks typical sites**
- Android WebView ships with `domStorageEnabled=false` by default, so `localStorage` can be missing/throw; cookies can be disabled by the host app (`CookieManager.setAcceptCookie`). Sources: https://developer.android.com/reference/android/webkit/WebSettings#setDomStorageEnabled(boolean) , https://developer.android.com/reference/android/webkit/CookieManager
- `window.open` / `target=_blank` need `setSupportMultipleWindows` + `onCreateWindow` on Android and a `WKUIDelegate createWebViewWith` on iOS; many in-app browsers just ignore them. Sources: https://developer.android.com/reference/android/webkit/WebSettings#setSupportMultipleWindows(boolean) , https://developer.apple.com/documentation/webkit/wkuidelegate/1536907-webview
- iOS/WKWebView only allows Web Audio after a user gesture; an `AudioContext` must be resumed inside a touch handler. Source: https://developer.mozilla.org/en-US/docs/Web/Media/Autoplay_guide , https://webkit.org/blog/6784/new-video-policies-for-ios/
- Notch/home-indicator: `viewport-fit=cover` + `env(safe-area-inset-*)`. Dynamic toolbars: `100dvh` (fallback `100vh`). Sources: https://webkit.org/blog/7929/designing-websites-for-iphone-x/ , https://developer.mozilla.org/en-US/docs/Web/CSS/length#dynamic_viewport_units
- No 300 ms delay / double-tap zoom: `touch-action: manipulation` with a `width=device-width` viewport (and don't disable pinch zoom - accessibility). Sources: https://developer.chrome.com/blog/300ms-tap-delay-gone-away , https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
- iOS zooms into inputs under 16px font. Source: https://webkit.org/blog/5610/more-responsive-tapping-on-ios/
- `navigator.share` is available in Safari/Chrome Android but often missing in WebViews; `navigator.clipboard` needs a secure context and may be blocked - fallback to `execCommand('copy')`, then an on-page selectable field (never `prompt()`, which some WebViews suppress). Sources: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share , https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText
- Budget: <2 MB initial on 4G; gzip text assets (express `compression`, MIT).

**What we built**: `public/js/store.js` (storage wrapper with in-memory fallback + `copyText` with on-page sheet), session token returned at sign-in and sent as `X-Session` when the cookie didn't stick, global audio unlock on first tap shared with game synths, safe-area/dvh/touch-action CSS, no `target=_blank` in flows, gzip, portrait-first canvases with a 5-second non-blocking "rotate" tip for Jetpack Dash. Verified by `tools/e2e-mobile.js` (Pixel 7, iPhone 14, Android WebView UA, iOS Potato in-app UA, and a locked WebView with storage throwing and cookies stripped).

## 2. Sponsor tiers and multi-brand sponsorship
**Findings**
- Sponsorship guides agree on 3-4 tiers. Each tier should have a *different primary value*, not just "more logos". Entry tiers get exposure, the middle tier gets activation, and the top tier gets exclusivity, access and reporting. Exclusivity/naming rights are reserved for the top; add-ons are priced separately. A top tier of roughly 3-4x the entry price is common. Sources: https://www.i4a.com/blog/event-sponsorship-packages/ , https://www.sponsorcx.com/the-ultimate-sponsorship-tier-package-template/ , https://www.nunify.com/blogs/sponsorship-packages
- Licensed cannabis brands may only advertise in digital media where at least **71.6% of the audience is reasonably expected to be 21+** (California BPC §26151, Colorado 1 CCR 212-3 3-720). California also requires age affirmation before direct, individualized communication. Sources: https://law.justia.com/codes/california/code-bpc/division-10/chapter-15/section-26151/ , https://www.law.cornell.edu/regulations/colorado/1-CCR-212-3-3-720
**Decisions**
- Tiers: Basic, Premium and Elite. All three are compared on the same 8 dimensions: duration, game placement, giveaway slots, brand channel, outbound links, analytics, multi-brand rights and support. Each tier changes the *kind* of value, not only the amount:
  - Basic is a single-giveaway trial with no outbound link.
  - Premium adds a brand channel and 1 tracked link.
  - Elite adds 3 tracked placements, featured placement and a results report.
- Launch prices are shown next to the higher regular prices (admin-editable): $49→$79 for 7 days, $149→$229 for 14 days, $399→$599 for 30 days.
- Elite works out to $13.30/day against $10.60/day for Premium and $7/day for Basic, so the extra exclusivity costs only a modest per-day premium. A 14-day Elite costs $249→$369.
- Several brands share one giveaway or game through co-sponsor and category-exclusive add-ons. Each brand keeps its own channel, link and click analytics.
- The whole hub is behind a 21+ date-of-birth gate, so 100% of signed-in players have affirmed they are 21+, well above the 71.6% bar. Cannabis sellers must tick a license checkbox when booking; other businesses don't.
- Copy says "upcoming and independent brands" and never "underground".

## 3. Anti-camping: brand channel separation + eligibility
**Findings**
- SteamGifts' contributor levels and private giveaways exist to stop "leeching", meaning accounts that enter everything and never take part. Groups add rules like minimum activity, no repeat wins and sent/won ratios. A whitelist or group giveaway only counts once it has 5+ entries, which stops small groups farming value. Sources: https://www.steamgifts.com/discussion/RqwrY/contributor-levels , https://www.sgtools.info/faq , https://www.steamgifts.com/about/guidelines
- Sweepstakes rules should list every eligibility restriction before entry opens, including previous-winner limits. They must say how entries are counted and capped ("one entry per person" must define the unit) and describe an alternate-winner process. Broadcasters commonly use win-frequency limits such as "once every 15 days nationally, max 3 per month". Sources: https://fasthofflawfirm.com/blog/sweepstakes-official-rules , https://z1043.iheart.com/content/2026-09-28-jingle-ball-contest-rules/ , https://arrowheadpromotion.com/faqs , https://sideman.com/contests-and-sweepstakes-101/
- Bonus entries must never be tied to purchases (no purchase necessary / no consideration).
**Decisions** (defaults, editable per giveaway)
- Players must explicitly tap "Enter giveaway". Entry requires 3 runs in the last 7 days and an account at least 2 days old.
- A player can hold at most 3 live entries at once.
- A 30-day cooldown applies after any win, plus one win per brand per 30 days. Following the brand is an optional requirement.
- Activity-weighted entries are 1 + 1 per 5 runs, max 5. They come only from free play, never from purchases.
- Brand channels keep each sponsor's audience and giveaways separate.
- The draw is a verifiable weighted random draw (Efraimidis-Spirakis keys). Cooldown winners are skipped at lock and logged.
- All of the above is printed in Official Rules §4-§5 and on each giveaway's eligibility card.

## 4. Zero user-to-user messaging
- Hubs with open DMs carry the highest moderation and grooming/abuse risk. Unmoderated chat in a 21+ hub with cannabis sponsors would also be a compliance risk under California's rules on individualized communication.
- Decision: there is no chat, no DMs and no free-text comments to other players.
  - Social features are friends (mutual follows), play-together score challenges and friend leaderboards.
  - Usernames pass a profanity/staff-impersonation filter.
  - Winners are contacted privately by Trap Tech on Potato, from the private Potato username a player saves in Settings.
  - `/api/messages` and `/api/dm` return 404 (API test).

## 5. Points, cosmetics shop and achievements
- Shops in Fortnite and Rocket League show that rotating storefronts (daily + weekly) and rarity tiers drive return visits. Cosmetics must stay cosmetic: nothing can affect scores or giveaway odds, and points have no cash value, which keeps giveaways "no purchase necessary". Points are earned only by playing, with a daily cap (40 scored runs/day) so they can't be farmed.
- Shop themes are cannabis culture (leaf, terp, strain-art styles), underground/street culture, gaming and money. Nothing glorifies dealing: no "plug", "trap house" or "re-up" items, and a browser test checks the shop copy.
- Achievements are tiered so that most players unlock something early while a few chase very hard goals. The hard Legendary tier includes One Percenter (top 1% of a 100+ player board), Centurion (100-day streak), Iron Thumbs (2,000 runs), Grandmaster (Gold tier in every game) and Dynasty.
- Referral badges were renamed Crew Builder, Squad Goals and Party Starter. Nothing sounds like a vendor or admin, and "plug" was avoided because it is slang for a dealer.
- 8 admin-only special badges can't be earned by play. Every grant and revoke goes in an audit log.

## 6. Smart anti-cheat that keeps great legit scores
**Findings**: the authoritative check is a server-issued seed plus re-simulation of the input log. Telemetry is evidence, not proof. Bounds and rate checks catch impossible scores. Sources: https://vittorioromeo.com/index/blog/oh_secure_leaderboards.html , https://horizon.pm/features/validated-actions , https://www.reddit.com/r/howdidtheycodeit/comments/131yoha/how_do_game_developers_validate_score_boards/
**Decisions**
- Every run starts with a signed run token and a server seed. Memory Match is replayed exactly on the server with mulberry32 + Fisher-Yates, the same code as the client.
- Each score carries input telemetry: count, mean, standard deviation and minimum interval.
- Only scores above 2x the per-game plausibility ceiling (measured with the *server* clock) are rejected outright.
- Severity-2 signals hold a run for review. These are over-rate, replay mismatch, zero inputs on a high score, robotic rhythm, or two notes together.
- Single notes count normally, so great legit scores are never removed automatically. Notes are a big jump over the player's own history, a record smash, very fast inputs and clock skew.
- Admin Fair Play queue offers clear or keep-excluded. Nobody is banned automatically.

## 7. Graphics: realistic art from free, reuse-OK sources
**Findings**
- **Poly Haven**: every HDRI and texture is CC0. That allows commercial use, modification and redistribution, with no attribution needed (it is appreciated). The textures are photoscanned, not AI-generated. Sources: https://polyhaven.com/license , https://docs.polyhaven.com/en/faq
- **Openverse** indexes CC0 and Public Domain Mark works but does not verify licenses, so each file was checked on its source page (Wikimedia Commons, rawpixel, StockSnap, Flickr). CC0 is a waiver by the rights holder; PDM labels works already free of known copyright. Sources: https://openverse.org/about , https://wiki.creativecommons.org/wiki/CC0_PDM_comparison_chart , https://wiki.creativecommons.org/wiki/CC0_FAQ
- **Kenney** asset packs are CC0 (License.txt in the pack). Source: https://kenney.nl/assets/racing-pack
- Thumbnail guidance from the two biggest web-game portals:
  - **CrazyGames** covers come in 16:9, 2:3 and 1:1. They should look consistent and carry the game title only (no "New/Play now", no store logos, no borders), with no copyrighted art and nothing blurry. Source: https://docs.crazygames.com/requirements/game-covers/
  - **Poki** advises one clear foreground subject or main character in a dynamic pose, a simple background, strong contrast, art that matches the real game, and no padding or borders. Its tests found text-free tiles perform better. Sources: https://developers.poki.com/guide/game-thumbnail , https://developers.poki.com/guide/content-player-safety
  - Quality guidance: one consistent art style per game, high resolution and no compression artifacts. Source: https://docs.crazygames.com/requirements/quality/
**Decisions**
- In-game art pipeline: `tools/build-graphics.py` turns 11 Poly Haven sources (HDRIs as tonemapped, blurred panoramas plus photoscanned textures), 14 CC0 photos and the Kenney Racing Pack into 45 optimized WebPs. All 12 games load them through `loadArt()` in the engine and fall back to the old procedural art if an image fails to load.
- What each game now shows:
  - **Jetpack Dash**: a real night city (Shanghai Bund HDRI) and photo gold coins.
  - **Drift Rush**: asphalt and grass photo textures, Kenney cars and props, rumble-strip curbs.
  - **Plinko**: walnut board, chrome pegs, blurred bar backdrop.
  - **Spin to Win**: cherry-wood rim, lounge backdrop.
  - **Memory Match**: 15 real photo card faces, velvet backs, walnut table.
  - **High Score**: brick wall, real archery targets, gold-coin x2 targets.
  - **Blazed Roulette**: felt and wood.
  - **Terp Tapper**: real lime, lemon, orange and grapefruit slices.
  - **Stack 2048**: poker-chip tiles on felt.
  - **Munchies Snake**: citrus food and a gold coin on grass.
  - **Brick Breaker**: brick-wall backdrop and gold bricks.
  - **Sky Hopper**: night city with metal towers.
- Store cards: `tools/shoot-games.js` captures real gameplay frames. Where a portrait frame crops badly, `tools/build-thumbs.py` stages a hero scene from the same in-game art (Drift Rush, High Score, Terp Tapper, Stack 2048, Snake), so the art matches the game as Poki and CrazyGames ask. Following CrazyGames' "title only" rule, each card has the title, the small Trap Tech wordmark (owner requirement) and an accent bar, with no tagline or CTA. Output sizes are 800x450, 600x620 and a 1200x630 share image.
- Every source file is listed in `CREDITS.md` with author, provider, license and URL. License texts are in `licenses/`.
- Honest limits: the Kenney cars are stylised rather than photo-real. The fruit notes for lemon and grapefruit are hue-shifted orange slices. Characters stay Kenney CC0 because no CC0 photo-real character sprites suit a 2D runner.

## 8. More real games
- Reese believed 150+ games were planned; the repo never contained them. v5 adds 4 more complete games on the same run-token, anti-cheat, achievements, leaderboard and giveaway flow: Stack 2048, Munchies Snake, Brick Breaker and Sky Hopper. **Total: 12 real, playable games.** Each has per-game plausibility caps, Bronze/Silver/Gold tiers, real-photo art and a thumbnail. The API test checks all 12 games save runs; the browser test plays all 12; the mobile test plays all 12 on 5 phone profiles.
