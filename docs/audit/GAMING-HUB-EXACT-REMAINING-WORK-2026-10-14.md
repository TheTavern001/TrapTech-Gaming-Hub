# Gaming Hub — exact remaining implementation and acceptance work
_Audit date: 2026-10-14. Source branch: `program/five-release-full-hub-overhaul-20261013` / PR #29._

This is the source-backed product/release gap list, **not a claimed AAA certificate**. Never equate a GitHub commit, generated item ID, or thumbnail with phone-tested gameplay, renderable wardrobe gear or production deployment.

## Current factual baseline
- **93 registered game IDs** = 13 core + 80 library; **87 proposed playable**, **6 archived duplicates**. Names, source locations, archive status, graphics/score/device acceptance, and overlap membership are listed individually in `docs/audit/EXISTING-GAME-REVIEW-REGISTER-2026-10-14.json`.
- **0 individually approved games** and **0 Android+iOS game signoffs** in `GAME-QUALITY-ACCEPTANCE.json`; 87 remaining individual certifications before public launch.
- **13 source-flagged overlap groups** containing **33 currently playable titles**; this is a **triage queue**, not 33 proven duplicate titles. One high-risk family is `layered-path-tower-defense` (`haze-defense`, `gl-pop-defense`, `gl-keep-guard`). Pop and Keep both use `td.js` with fixed path/place-upgrade behavior; Haze also uses fixed-path turrets and layered/splitting targets. Compare their controls, towers, progression and real device quality, then keep a representative rather than three reskins. `gl-node-siege` has BFS maze rerouting and may qualify as mechanically independent. Preserve historical IDs/scores if retiring titles.
- **1,200 generated profile-cosmetic IDs** are present, **not 1,200 tested 3D wearable assets**. **0 independently certified 3D cosmetic wearables**. **12 prestige original IDs** are preview-only/sales disabled.
- The neutral Quaternius source QA GLB contains **65 rig joints, 3 meshes, 0 animations and 0 images**; it is flagged `QA_IMPORT_ONLY_NOT_DEFAULT`. A finished common starter, equipment sockets, material variants, animation retargeting and avatar-using games remain unapproved.
- **3,150 quest template count in build ledger** does not equal 3,150 awarded/verified achievements. Quest definitions/end-to-end awarding remain uncertified.
- **26 workstreams** in five-release board: **15 source-only, 6 blocked, 5 not started, 0 owner approved**. Separate security checklist contains **15 gates, 0 owner-approved**.
- Last owner screenshot reported Deplexo `278af07` as current. Current PR source is **not confirmed deployed**, auto deploy is OFF.

## Integration work committed during this audit
1. Avatar purchase requests now use **one server-controlled Hub Credits wallet**. Old `/api/avatar/buy` Crown spending fails closed with HTTP 410. `/api/avatar/buy-credits` is canonical; historical Points endpoint is a compatibility alias to the same signed-credit debit. Existing Crown ledger rows are not deleted.
2. Wardrobe shows one Credits balance and one unlock route; it links to the Credits store. Profile cosmetics shop and Hub Store now link to the Avatar Wardrobe, while stating clearly that a badge/banner is not automatically wearable 3D equipment.
3. Every registered title has an explicit source-only QA/graphics/phone/score review row; archived scores remain intact. Public library no longer shows misleading A/A+ tier badges before verified acceptance.
4. Release regression suite gains wallet spending/idempotency, Prestige rejection, storefront links, catalog inventory completeness, and unapproved-tier checks. Source assertions and isolated handler simulation passed; **full native SQLite, Docker and phone runs have not happened**.

## Actual unfinished product work, in delivery order

| Work area | Evidence required before calling finished |
| --- | --- |
| Game controls, collisions, loops and scores | Every proposed active title played through, stop/restart/pause, fairness and representative touch inputs on real Android and iPhone; accepted runs and forged-run rejections measured |
| Mechanic deduplication | Compare all 13 overlap groups side by side; formally archive redundant titles without deleting historic IDs, and update source/catalog/leaderboard/giveaway checks together |
| Game visual/audio art pass | Professional scene, textures, character/environment models, animations, sound and game thumbnails per title, licensed and hash-pinned; owner approves side-by-side screenshots and video |
| Mobile performance | Real Android Chrome and iPhone Safari/WKWebView safe areas, landscape, DPR adaptation, touch latency, p95 frame timing, memory/GPU context lifecycle; no universal 4K/60fps claims |
| Avatar & wearable shop | One identical quality starter for new accounts; audited skinned/rigged materials, skin and facial customization, physically attached hats, props, clothes, animated emotes, equip preview and in-game cosmetic use |
| Economy, seasons, quests and achievements | Credits purchase/earn/migration checked on real SQLite, genuine rotation and possession/equipping of items, end-to-end achievement/quest grants, no paid gameplay advantage |
| Security, payments, events | 15 security gates, real Stripe+Bitcoin settlement/refunds/chargebacks, backup and restore, admin 2FA, session revocation, privacy, event payment gating and server replay/score authority |
| Operations/private deployment | Reproducible fixed SHA, complete Docker checks, isolated HTTP startup, backups and rollback, closed unsafe commercial/prize flows; then owner enables one controlled Deplexo build for private phone review |
| Post-review game expansion | Add distinct licensed locally hosted games in QA batches; 500 target means at least 413 **additional approved titles** if all current 87 pass and no more are retired |

## Private testing versus finished public release
Private owner testing does **not** require certifying all 87 as public AAA games first, but DOES require a sound isolated build, rollback-capable data, fail-closed purchases/prizes, stable authentication and an exact candidate SHA. Because GitHub Actions are unavailable and the current assistant runtime cannot run Docker or clone the private repository, Deplexo's own image build may be the first fully integrated Docker evidence once the predeployment safeguards are verified. Treat that as a **controlled test deployment**, not a public launch certificate. Do not enable uncontrolled auto deploy or perform unbacked migrations.

## Precise next checkpoint
Complete the remaining integration tests and first controlled source/build evidence; explicitly review potential duplicate retirements and cross-device visuals. Do not call games, art, 3D cosmetics or the 500 target finished simply because a registry lists them. Keep documenting exact test pass/fail, SHA and recovery point in `docs/DEPLOYMENT-JOURNAL.md`.
