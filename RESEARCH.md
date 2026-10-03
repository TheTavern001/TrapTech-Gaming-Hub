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
