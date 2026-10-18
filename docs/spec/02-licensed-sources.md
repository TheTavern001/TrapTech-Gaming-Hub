# 02 — Licensed / open game & asset sources (verified Oct 18 2026 ET unless marked UNVERIFIED)

Principle (Reese): take and **self-host** games in our hub wherever the licence allows (original or open-source). Third-party iframe/feed games are at most an optional **non-giveaway "Free play"** section. Never copy commercial titles (e.g. Bloons, Subway Surfers); never claim a feed or repo gives "exact replicas" — exact copies of commercial games are impossible and unwanted. Not legal advice: Reese's lawyer must review before launch.

## A. The key conflicts (be honest)
1. **Giveaway scoring:** third-party iframe games cannot call our signed `/api/run/start` + score submit, so we cannot verify scores, enforce endless/uncapped rules, collect skill tie-break telemetry or run sudden-death playoffs. They can NEVER be giveaway-eligible.
2. **Ads/SDKs:** GameDistribution and CrazyGames require their own SDK/ads (below). That clashes with our brand ad slots and with the 21+/sponsor-safe experience; some terms give the distributor *exclusive* ad/IAP rights on the game.
3. **Hosting:** feed games are generally embedded (iframe), not self-hosted by us; we may not modify or strip SDK/tags; the licence can be revoked per game at the distributor's discretion.
4. **Memory/CSP:** iframes of other origins need CSP `frame-src` allowances and add third-party tracking; keep them in a separate page (`/free-play`) with a clear "not eligible for giveaways" label and consent notice.
So: self-hosted open-source/original games remain the giveaway path.

## B. Game feeds / portals (optional free-play only)
| Source | Link | What the terms say (paraphrased) | Ads/SDK forced? | Embed vs self-host | Verdict |
|---|---|---|---|---|---|
| GameDistribution (Azerion) — publisher licence | https://static.gamedistribution.com/terms/publisher.html (last updated 19 Jun 2025); partnership page https://gamedistribution.com/publishers/partnership/ | Non-exclusive, limited, non-sublicensable, non-transferable licence to show Games on *approved Publisher Properties* only; not as pay-to-own/subscription or in native apps without written approval; distributor has exclusive right to market/sell In-Game Ads and In-Game Purchases; publisher must not alter/reverse-engineer the SDK, games or tags; revenue share to publisher (a summary says 33% of net revenue, EUR 100 threshold — treat the % as UNVERIFIED until read in the contract) | **Yes** — the game's SDK serves ads (developer page: SDK mandatory) | Direct embed of GameDistribution game URLs (iframe) or managed white-label portal (subdomain, 4–6 weeks legal) | Possible *optional* free-play section only; needs contract + legal review; not giveaway-eligible; no Hub brand ad slots inside games |
| CrazyGames | Dev terms https://files.crazygames.com/documents/developer_terms_20250818.pdf ; requirements https://docs.crazygames.com/requirements/intro/ ; FAQ https://docs.crazygames.com/faq/ | These are **developer-side** terms (we would be *publishing to* CrazyGames, they host/iframe our games and require their SDK for revenue). They are NOT a verified portal-feed for us to embed their catalogue. A CrazyGames portal/publisher feed for third-party sites: **UNVERIFIED** (not found in the pages fetched) | Their SDK required for monetisation; "no external ads" in basic launch | n/a for embedding their games | Do not plan on embedding CrazyGames games. Optional: publish OUR originals there for reach (but no giveaway integration; separate build) |
| itch.io (tag Open Source + HTML5) | https://itch.io/games/free/tag-open-source/tag-html5 | A discovery list only; licence is per game (check repo LICENSE); the tag does not itself grant redistribution rights | No (per game) | Self-host only if repo licence permits redistribution | Good *sourcing* list; verify each repo licence |
| js13kGames | https://js13kgames.com/2024/rules ; https://github.com/js13kGames/games/issues/33 | Entrants keep copyright; competition gets a broad non-exclusive licence. **Archive games are NOT redistributable by third parties without per-author permission** unless the source repo has its own LICENSE (organisers' answer, Jun 2026) | No | Use only games whose *source repo* has MIT/Apache/CC0 etc. (e.g. a repo with its own LICENSE); otherwise ask the author | Great source of small, fast games — per-repo licence check mandatory |
| GitHub open-source HTML5 games | per repo | MIT/BSD/Apache/zlib/CC0: redistribute+modify with notice kept; GPL: allowed but derivative must be GPL (source offer); no licence = no rights | No | Self-host (our path) | Primary open-source path. Existing list: docs/GAME-CANDIDATES.md and game-candidates-120.md (licences were verified 2026-10-04 per that file; re-verify before import) |

## C. Engines / code
| Source | Link | Terms | Notes |
|---|---|---|---|
| Phaser (engine) | https://www.phaser.io/download/license ; https://github.com/phaserjs/phaser/blob/master/LICENSE.md | MIT: free for commercial use, keep notice | Fine to use. **Caution:** `phaserjs/examples` repo — code MIT, but its README says the *assets are not* licensed for your commercial games or games with advertising: never copy example assets |
| Godot engine + demos | https://godotengine.org/license/ ; https://github.com/godotengine/godot-demo-projects/blob/master/LICENSE.md | Engine MIT (include notice in credits); demo projects MIT, but individual demos may carry their own LICENSE (e.g. dodge_the_creeps lists KidsCanCode MIT) | Web export is heavy (WASM, tens of MB; Godot web perf is lower) — does not fit our <2 MB/game rule or 128 MB host well |
| Three.js | https://github.com/mrdoob/three.js (MIT; UNVERIFIED this session — verify) | MIT | Our 3D path |

## D. Art / audio / 3D assets
| Source | Link | Terms | Attribution |
|---|---|---|---|
| Kenney | https://kenney.nl/support | All assets on asset pages are CC0, commercial use OK | Not required (credit "Kenney" optional); do NOT use Kenney's logo |
| OpenGameArt | https://opengameart.org/content/faq | Per-asset licences: CC0, CC-BY 3/4, CC-BY-SA, OGA-BY, GPL. Commercial use OK if terms followed; CC-BY needs credit and (CC-BY/SA) no DRM; SA requires derivatives under same licence; previews are "all rights reserved" — use only the downloadable file; site warns artists may change licence (existing grants stay) | Per licence; use format "asset by author licensed X: URL" |
| Poly Haven | https://polyhaven.com/license | All HDRIs, textures, models CC0; commercial OK; no credit needed; site ToS forbids scraping (use downloads/API per API terms) | Not required |
| Quaternius | https://quaternius.com/faq.html | FAQ answers (commercial use, credit) were collapsed in the fetch — **UNVERIFIED**: packs are commonly CC0 but check each pack's page/licence file before use | Check per pack |
| Freesound | https://freesound.org | Mixed per-sound licences (OGA says its CC Sampling+ is not Debian-compatible) | Check per sound; prefer CC0 or generated WebAudio SFX (our current approach) |

## E. Import procedure for any open-source game
1. Confirm a LICENSE file at repo root and in media folders; list every asset licence. 2. Reject unknown/no-commercial/ripped assets. 3. Copy into `public/games-lib/<slug>/` keeping LICENSE + CREDITS.md. 4. Adapt to kit.js/adapter.js (signed run, uncapped score, portrait, skill metrics). 5. Replace art to the AAA gate (docs/AAA-REBUILD-ROADMAP.md). 6. Registry `source`, `licence`. 7. Test + review (01 §1.4). GPL games: isolate in their folder with source offer, or skip.
## F. Free-play section (optional, later)
Route `/free-play`, third-party iframes behind explicit consent, clearly "not eligible for giveaways/leaderboards", no hub currency/XP from them, CSP `frame-src` allow-list per approved portal, kill-switch in Admin. Requires signed distributor agreement and lawyer review first. Status: NOT built; contract not signed (unknown whether Reese wants it).
