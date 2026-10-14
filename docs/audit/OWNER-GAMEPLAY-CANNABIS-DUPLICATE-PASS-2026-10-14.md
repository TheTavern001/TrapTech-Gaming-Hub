# Owner gameplay and distinctness audit — 14 October 2026

**RELEASE BLOCKED · SOURCE QA PASS ONLY · NO DEPLEXO DEPLOYMENT**

The owner reports that multiple themed games feel difficult, do not match the named gameplay inspiration, still look like prototypes, and overlap mechanically. The Hub is intended for **98% Android/iPhone use**, with prizes requiring equivalent controls and validated scores. **This is not a human visual/AAA/device certification**; it reconciles the actual GitHub source and prepares a repeatable per-title test matrix.

## Inventory and rules

- Source registry: 13 active core titles and 80 historical library game IDs. Six library records remain intentionally archived with their original IDs and scores; **87 proposed playable**. This number is an inventory count, not a count of polished games.
- Library Cannabis category: **11 games**, plus core Terp Tapper, Grow Guard, Haze Defense, and the food-themed Neon Munchies. Each now has an individual unapproved record in `docs/audit/ALL-93-OWNER-GAMEPLAY-DISTINCTNESS-2026-10-14.json`.
- 13 mechanical-overlap review groups, with one especially high-risk unresolved duplication: **Pop Defense ↔ Haze Defense**. Both allow building/upgrading towers to destroy layered/splitting path enemies. A separate art theme does not establish unique gameplay. **Do not delete/migrate either one until replay, historic leaderboard, and owner quality decisions**; review Keep Guard too.
- No externally linked game play, fake title/thumbnail-only games, assumed proprietary clone rights or extra count toward 500. New admissions remain postponed until the existing Hub reaches acceptance.

## Actual game fixes committed in isolated source branch

| Game | Source defect identified | Repair now staged | Remaining approval blockers |
|---|---|---|---|
| **Trim Rush** | Initialized first bud *before* `g.done`, producing zero leaves and unearned “clean trim” score; Space found and cut a leaf automatically; said 60 seconds though starts at 30 | Set `g.done=0` and `g.next=0` before `nextBud`; remove automatic Space trimming; accurate 30-second start/renewable clock instructions | Professional external plant art, convincing clip animations, drag occlusion/touch precision, real-phone play |
| **Bud Bar** | First tap on a different lane often selected only, rather than serving; hidden right-edge exception made controls confusing | Any deliberate tap in a counter lane serves that lane once | Catch-empty controls, hit regions, fairness and outsourced shop props/characters |
| **Strain Crush** | Claimed 3 minutes but starts at 60 seconds; generated 8×8 board could have **zero legal swaps** | Honest timed-endless copy; seeded `hasLegalSwap` check at game start and between cascades; deterministic, zero-score reshuffle for dead board | Professional distinctive gem sprites/animations, mobile drag/tap selection, high-FPS gravity, scoring exploit review |
| **Grow Op** | Claimed a 3-minute round, but actually scores endless harvest survival until three plants die | Instructions now describe the real survival/harvest loop | Licensed 3D/professional scene, intuitive multi-plant tap/Water/Feed/Pest/Harvest indicators, phone landscape UX |
| **Dunk Flick** | Keyboard Space solved ballistic trajectory using destination hoop coordinates—an automatic perfect-aim exploit | Arrow keys adjust direction/power; Space launches via same manual shot physics as touch | Full touch aim physics, responsive hoop/bounce art, cross-platform competitive fairness |
| **Mole Whack** | Previous QA found auto-whack Space and clock copy mismatch | Previously staged remove auto-target and correct help; re-verified by owner matrix gate | Real tap speed/hit detection, styling, active game loop quality |
| **Most Wanted Run** | Previously ended on scenery bumps rather than police bust; procedural cars | Previous arrest/traffic fix plus genuine licensed Kenney source player/police/high-heat car GLBs; scoped frame-object reuse | Actual Smashy Road-like chase physics and phone steering, visuals/assets, device/WebGL/security |
| **Rail Rush / Arrow Hero** | Owner saw missing train-side hit and broken touch skill selection | Prior isolated branch fixes and regression gates | Real device touch/collision/visual validation |

### Other Cannabis games — still blocked pending deep play and new art

| Game | Intended gameplay, which must remain distinct | What needs first review |
|---|---|---|
| **Bud Merge** | 2048 numerical slide/merge | Real vendor UI/score bridge and proper mobile grid responsiveness; not equivalent to match-three |
| **Green Dash** | Timed delivery scooter dodging traffic | Vehicle collision forgiveness, clarity of roadside drop zones, quality scenes and actual physics feel |
| **Roll Up** | Six-stage precision-timing, filling and rolling | High-friction tutorial/step discoverability, release timing on iOS, difficulty curve and illustration/animation |
| **Smoke Rings** | Hold/aim/puff rings through moving hoops with wind | Charge-release frame timing, reliable ring/hoop crossing, missed shots, clear foreground targets and performance |
| **Bud Sort** | Conveyor stream sorting among four bins or reject | Make controls self-evident; ensure swipes/taps map to the correct highlighted item and correct strain, accessible bin sizes |
| **Pest Patrol** | Tap pests to protect three grow plants | Hitboxes, ladybug exceptions, enemy movement, touch reaction curve, professionally illustrated bugs/plants |
| **Cup Toss** | Pseudo-3D cup-pong ballistics, rack clear/reload | Cup-rim collision correctness, throw alignment, gameplay feedback and model art; prior no-op timer removed |

**Core game distinction:** Terp Tapper is a four-lane rhythm-tapping loop, Grow Guard is PvZ-style five-row placement defense, Haze Defense is layered/splitting path tower defense, and Neon Munchies is an arena snake. They should not remain simply because they have different illustrations; source references and phone play must verify distinct high-quality experiences.

## Mechanic-family consolidation candidates

**Already intentionally archived:** Wreck Ride, Rig Rally, Egg Roll, Monster Crush, Dune Glide → Hill Hauler; Drift King → Drift Rush. Source IDs, historical records and references retained.

**High priority for decision:** Pop Defense and Haze Defense (layered, splitting path-enemies); inspect Keep Guard too. Keep the best genuinely differentiated, professional game. Preserve historic scores and event IDs when archiving others.

**Still require side-by-side owner play:** Drift Rush versus Neon Circuit; Green Dash versus Cab Rush and Throttle Rider; Cup Toss versus Paper Toss; Hoop Streak versus Dunk Flick; Mole Whack versus Pest Patrol; Rail Rush versus Roof Runner/Desert Dash/Tunnel Hop; Arrow Hero versus Moon Swarm/Rift Survival; Void Swarm versus Star Swarm/Alien Rows; Pop Defense versus Keep Guard and Node Siege. Node Siege's build-your-own-maze/BFS route finding may justify its separate inclusion.

## Verification and ship constraints

- Added `tools/test-cannabis-gameplay-qa.js`, which invokes real `Kit.run` init/update hooks and checks 40 deterministic match-three initial seeds plus a forced no-moves board. **234 source-backed V8 simulated assertions PASS** across 5 games. This is *not* Node 20/Docker, a physical phone or an AAA approval.
- Added `tools/test-owner-gameplay-distinctness.js`, an exact all-93 registry / 13-family consistency and exploit-recurrence gate. Expanded `tools/audit-full-game-mechanics.js` to generate per-title graphics, timing, auto-target, randomness, reference and touch/device QA triage. Wired both to Docker prelaunch; **full Docker has not been run for this branch**.
- Real iPhone Safari/WebKit, Android Chrome/WebView physical tests, 60 FPS P95 measurements, audio latency, 720p mobile adaptation, licensed external art/video clips and signed giveaway replay all remain pending. No game is individually AAA-certified.
- **Never deploy the source branch to production or tell the owner to enable auto-deploy** until R1–R5 acceptance requirements justify a consolidated manual release. Screenshot-confirmed host CURRENT/READY remains `278af07`, not these source commits.

### Resume next
1. Run actual Node/Docker source test suite against complete checkout, address failures; audit and compare **every** game by its gameplay reference (not just code signature).
2. Finish the remaining high-risk duplicate decisions with score-history preservation and choose one per gameplay mechanic, redesigning any exceptions with actual distinctive rules.
3. Replace placeholder game scenes and 3D/canvas art using commercially redistributable, tested external asset packs. Professional authoring + phone composition required—not re-colored geometric prototypes.
4. Produce phone video, latency, collision, FPS and scored-run replay evidence per active title; retain all game/Hub/shop/avatars/security/credit economy QA gate blocks until passed.
