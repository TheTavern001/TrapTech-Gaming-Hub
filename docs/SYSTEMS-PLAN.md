# Systems stream plan: promised vs actual (Oct 17, 2026, ET)

Sources reread: HANDOFF-AGENT.md, FINALIZE.md, V7-CHECKLIST.md, PROGRESS-V7.md, game-audit.md Part 2, docs/ECONOMY.md + PASS-QUESTS.md + ADMIN-AUTH.md, plus the actual code on branch `v8-games-upgrade` (tree copied to /workspace/sys, game folders untouched).
IMPORTANT: game-audit Part 2 was written against the stale `hub-fix` tree. Several of its P0 items were already fixed on this branch by commits 1c0f411 / 984590f; they are re-verified below instead of redone.

Baseline (before my changes): `tools/e2e-api.js` 20 pass / 12 fail on a fresh DB (all 12 are pre-existing and stale vs. the booked-event redesign: Hub ID format `TH-######`, giveaway window creation via /api/admin/giveaways, so event-token tests cascade). `test:cosmetics` OK. Recorded so I do not claim them as regressions.

Legend: DONE-verified = I read the code and exercised it; PARTIAL; MISSING; CONFLICT = contradicts a Reese decision.

## A. Promises from V7-CHECKLIST / HANDOFF (non-game)
| # | Promise | Actual on branch | Status | Plan |
|---|---|---|---|---|
| 7 | Trap Tech logo everywhere | crown TT in header/splash/about | DONE-verified (screenshots) | keep |
| 8 | Shop on proper timers (daily/weekly/season/events), no fixed tiers | rotation sim, DST-tested, countdowns | DONE | keep; events were empty in audit -> 11 named events exist in EVENTS |
| 9 | Shop keeps generating new items forever | yes, but names are template + serial ("Cured Hunter · 017A"), 18x16 word lists, 3 themes | PARTIAL | S1: unique-name universe (12,000+ designs, unbounded editions) |
| 10 | Seasons defined | S1 56 days, 60 levels, free + premium track | DONE | keep |
| 11 | Shop items far better, rendered previews | one SVG template for every item (audit tier 2) | NOT MET | S1: new SVG renderer (lit metal, gems, foil, scenes), per-type |
| 12-14 | Sponsor tiers removed, "Sponsor a Host" / private no-price quotes, brand-locked players | quote flow private; brands + affiliation exist | DONE | S4 builds on it |
| 15-16 | Domain + finalize list | docs only | needs Reese | listed in handoff |
| 5 | Avatars (editor, 70 parts, server SVG + 3D preview) | flat SVG; 3D editor says "Compatibility preview · rigged wardrobe asset pending" | PARTIAL | S2: upgraded SVG avatar renderer + remove pending banner |
| 4 | Monetisation: BTC to one address, cosmetic only, Season Pass, Crowns/Credits | monetize.js + btc.js + Stripe option; checkout default OFF; BTC_ADDRESS env only | PARTIAL | S5: default address constant, cosmetic orders, reconciliation tests, flags |
| - | Prestige numbered x of y | Prestige unlimited, one per player (1c0f411) | DONE-verified in code | keep; test |
| - | Admin: secret ADMIN_PATH, TOTP, Owner/admin roles, player mgmt, giveaway builder, shop controls | all exist (admin-sec, admin-roles, admin-users, admin-giveaways, admin-ops) | DONE per PROGRESS-V7 (admin 150/0, sec 66/0) | S3: add central Settings pages for new systems (catalog, quests, brands, security, privacy), regression run |
| - | i18n 21 languages | exists | DONE | keep |

## B. Part 2 audit list vs this branch
| Audit item | Branch state | Status |
|---|---|---|
| Vault retirement -> long cooldown | COOL common 60 / rare 120 / epic 180 / legendary 270, CAP only legacy pre 2026-10-18 | DONE (1c0f411) |
| Scarcity price clamp | MIN_ACTIVE_FOR_SCARCITY = 500 | DONE |
| Prestige unlimited | supply cap removed | DONE (re-test) |
| Price modal one line + collapsed "How is this priced?" | economy.js, hub-store.js | DONE (verify in browser, S2) |
| Bottom nav Shop tab, fits 320px | 6 tabs (screenshot: Home Games Ranks Prizes Social Shop) | DONE-verified at 390px; re-check 320px |
| Giveaways page: Book a giveaway + My giveaway affiliation | both buttons present (screenshot) | DONE |
| Per-giveaway audience Open / Affiliated / Invite-only | only open vs brand-members (`open_to_all`); invite codes join a brand, no invite-only giveaway | PARTIAL -> S4 |
| Brand profile pages /brand/<slug> | none | MISSING -> S4 |
| Featured Brands carousel (Home + Giveaways) | "FEATURED" chip on a giveaway only | MISSING -> S4 |
| Copy never promises follower/sub goals; skill-only tie-breaks | tie-breaks skill-only (e2e-tiebreak); `elig_followers_only` field name is misleading | PARTIAL -> S4 copy audit + guard test |
| Real art pipeline, 10k cosmetics, quests/achievements at scale | 138 achievements (icon-font names), 48 pass quests, rotating-quests.js templates are PREVIEW ONLY (no progress, no claims) | MISSING -> S1 |
| Season pass UI shows 60 levels | track renders; premium checkout off | PARTIAL (S5/S2) |
| Events never empty | 11 recurring events + admin events | DONE |
| Raw API errors in games | fixed by guest-mode adapter | DONE (games stream) |
| Shop page balance card layout | BROKEN at 390px: "HUB CREDITS" wraps one letter per line (screenshot) | BUG -> S2 |

## C. Security / privacy audit (Task 6) - current state
| Control | State | Plan |
|---|---|---|
| Password hashing | bcryptjs cost 10 | DONE; keep (cost 11 evaluation vs 128 MB CPU) |
| Rate limiting | in-memory `limiter` on signup/signin/pw etc, LRU capped | extend to new routes; test |
| Secure cookies | `gh_sess` HttpOnly SameSite=Lax; Secure when HTTPS | verify + test |
| CSRF | none for player POSTs (relies on Lax) | S6: Origin/Sec-Fetch-Site check + custom header on mutating /api |
| CSP | only on admin pages | S6: public CSP (app uses ES modules + inline styles) |
| Input validation | per-route | S6: new routes validated; fuzz test |
| Anti-cheat on score submit | L1-L4, signed single-use tokens, server time rate ceilings | DONE (e2e-anticheat); re-run |
| No PII leaks | /api/me vs public profile; bookings.csv has email (admin) | S6: audit public endpoints with test |
| Minimal data | DOB stored (21+), IP salted hashes | keep; document |
| Privacy policy / data export / deletion | policy page exists; NO self-service export or deletion | MISSING -> S6 |
| Dependency audit | not run | S6: `npm audit` |

## D. Work order (this stream)
S0 plan (this file) -> S1 cosmetic universe + renderer + shop integration + quest/achievement engine -> S2 hub/avatar UI fixes -> S3 admin settings -> S4 booking/brands/audience -> S5 payments -> S6 security/privacy -> full regression, push every few chunks.
Constraints honoured: never push main; game folders (public/games*) untouched; memory: everything generated on demand from seeds with tiny LRU caches.
