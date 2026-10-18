# 01 — Game library: ~500 games, redo specs, batches

Source facts: docs/GAME-STATUS.md/game-status.md, game-audit.md, docs/GAMES-LIB.md, docs/REESE-MASTER-CATALOG.md, docs/PUBLIC-LAUNCH-500-GAME-AND-AVATAR-SHOP-AUDIT.md, docs/AAA-REBUILD-ROADMAP.md.

## 1.1 Wants (Reese's intent)
- A library that grows to ~500 launch-ready games (not 500 registry rows); every game must be genuinely fun, original or properly licensed, AAA-feeling visually, portrait mobile-first. 'Exact copies' of commercial games are impossible and not wanted: take the *gameplay concept*, build an original adaptation (REESE-MASTER-CATALOG: 'Never pretend a copyrighted game was copied').
- 3D runners, driving, tower defense, shooters (a Zombie-Cubes-style game), polished 2D, physics, plus 10–15 cannabis-themed originals (21+ audience; no real-brand logos; no sales/promo claims in-game).
- Giveaway games must be: portrait, endless, uncapped score, skill-only tie-breaks, no luck. Non-giveaway 'just for fun' allowed for others.
- Where licensing allows, games are taken and **self-hosted in the hub** (open-source/original). Third-party iframe feeds only as an optional non-giveaway 'Free play' section (see 02-licensed-sources.md).

## 1.2 What exists now (honest)
- 74 playable library games + 6 retired duplicate slugs (registry `src/games-lib.js`, 80 entries) + 13 core games (public/js/games). 87 playable total. None is truly AAA. Classes today across the 74 (per game-status.md): see counts in section 4 of docs/HANDOFF.md and the per-game list in 1.7.
- Shared kit: `public/games-lib/kit.js` (canvas, input, touch, particles, WebAudio, juice allowlist of 64 games), `adapter.js` (signed run start, telemetry, score submit, guest mode), carart/topcar/sky3d art modules. Anti-cheat levels L1–L4 (docs/ANTI-CHEAT.md; most lib games L2).
- Verified only on a local server with bot input; not yet on real phones; fps measured under software GL only.

## 1.3 What remains
- Redo EVERY existing game (no skips), worst first, with new gameplay + original art (1.6, 1.7). Fix heavy-3D perf. Build ~400 new games (1.5) in batches of ~20 (1.8). Real-device QA for all.

## 1.4 Acceptance criteria per game (quality gate 7/10)
Evidence required for each game: (1) portrait 390x780 layout, no letterbox; (2) endless/uncapped/skill-only if giveaway-eligible, with registry fields set; (3) title, pause/resume, game-over, restart; (4) 60 fps target on a mid-range phone (P95 frame ≤16.7 ms; >20 ms sustained = blocker), adaptive DPR; (5) signed run start + legit score accepted + forged score rejected (`tools/e2e-games-lib.js`); (6) 0 console errors; (7) original or properly licensed code/art/audio with exact source in CREDITS.md; (8) size <2 MB gzip; (9) reviewer score ≥7/10 on: fun in 30 s, clarity, juice/feel, art cohesion, fairness, replay pull, difficulty curve; (10) skill tie-break metric implemented (docs/ANTI-CHEAT.md, src/games-lib-playoff.js). Two failed rebuild passes → replace the game, don't lower the bar.

## 1.5 Planned new titles (~398) — original working names
All names are *working titles of original concepts*, not copies of any commercial game (check trademark clashes before launch; names given in 'x-style' are reference notes only). Where only a title is given the loop is **not yet designed** (to be specified in its batch brief); lines with a colon have a one-line core loop. Every game: endless/uncapped score, portrait, giveaway-eligible only if skill-only (mark otherwise 'just for fun'), L2 anti-cheat minimum.

### Cannabis-themed (original, 21+ audience; no real brands, no promo claims) (14)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then shorter run time, then combo max; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

1. **Dab Rig Dash** — core loop: tilt-steer a glowing rig through smoke tunnels collecting terp orbs
2. **Trichome Trail** — core loop: endless 3D ride down a frosty bud ridge, lean to avoid sugar-leaf spikes
3. **Curing Jar Stack** — core loop: stack drying racks with rhythm taps, wobble physics
4. **Grinder Gauntlet** — core loop: rotate a 3-ring grinder to catch falling buds, rings spin faster
5. **Hydro Flood** — core loop: 2D pipe-rerouting survival; keep roots fed as flow speeds up
6. **Terp Match Frenzy** — core loop: swipe-chain aroma tiles, combo multiplier decays
7. **Greenhouse Defense** — core loop: 3D tower defense vs pests with lamps, fans, ladybug turrets
8. **Kief Catcher** — core loop: catch falling kief with a shrinking screen, precision chain
9. **Harvest Moon Runner** — core loop: night 3D endless run through a grow field
10. **Roll Master** — core loop: 60-second rolling-paper dexterity score attack (swipe pace)
11. **Smoke Ring Slalom** — core loop: fly through rings that drift on wind, uncapped streak
12. **Clone Cutter** — core loop: slice cuttings along dotted lines; accuracy+speed
13. **Munchie Mayhem** — core loop: serve snack orders on a conveyor, endless rush
14. **Lava Lamp Lofi** — core loop: one-button rhythm game synced to generated lo-fi loops

### 3D endless runners (20)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: distance, then fewer collisions, then time-to-first-obstacle-clear; asset source: Three.js (MIT) + code-built geometry; models only from Quaternius/Kenney/Poly Haven (CC0); WebAudio SFX; quality gate: 7/10.

15. **Skyline Sprint** — core loop: rooftop parkour, slide/jump/wallrun
16. **Canyon Carver** — core loop: carve a snowboard line down a desert canyon
17. **Neon Tunnel Tumble** — core loop: rotate the tunnel, dodge gates
18. **Jungle Vine Rush** — core loop: swing between vines over a gorge
19. **Ice Cavern Slide** — core loop: slippery tilt run with crystal slalom
20. **Lava Lane** — core loop: hop shifting basalt tiles
21. **Cloud Step** — core loop: step between moving platforms in a sunset sky
22. **Subway Ghost** — core loop: phase between tracks with a 2-lane phase swap
23. **Trash Panda Run** — core loop: raccoon through alley obstacles
24. **Rail Rider** — core loop: balance a rail grind with trick combo
25. **Pipe Dream Plunge** — core loop: slide down giant pipes
26. **Meteor Hopper** — core loop: leap between falling asteroids
27. **Aqua Dash** — core loop: underwater swimming run with currents
28. **Glider Gorge** — core loop: hang-glider canyon slalom
29. **Wind Tunnel Wing** — core loop: wingsuit gates
30. **Temple Tumble** — core loop: original ruin runner with trap rhythm
31. **Toy Train Track** — core loop: build-as-you-go tracks, ride
32. **Marble Maze Run** — core loop: roll a marble down procedural ramps
33. **Beat Runner** — core loop: obstacles fire on generated beat
34. **Pogo Peak** — core loop: bounce up a growing mountain

### 3D driving / vehicles (24)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: distance, then drift/near-miss count, then fastest checkpoint split; asset source: Three.js (MIT) + code-built geometry; models only from Quaternius/Kenney/Poly Haven (CC0); WebAudio SFX; quality gate: 7/10.

35. **Drift Harbor** — core loop: drift-chain score around dockyards
36. **Traffic Needle** — core loop: dense-highway weaving, near-miss multiplier
37. **Mesa Rally** — core loop: tilt-steer desert stage with checkpoints that extend time
38. **Monster Mesa** — core loop: endless truck jumps with trick score
39. **Cliffside Courier** — core loop: deliver parcels on cliff roads
40. **Smash Alley** — core loop: demolition arena last-car-standing waves
41. **Kart Cascade** — core loop: obstacle-run kart on falling tracks
42. **Taxi Tangle** — core loop: fare chaining in a procedural city
43. **Moto Madness** — core loop: bike wheelie/jump endless
44. **Hill Haul Max** — core loop: physics hill climb with fuel
45. **Ice Road Trucker** — core loop: slide control on frozen lake
46. **Bus Bounce** — core loop: bridge jump stunt bus
47. **Burnout Boulevard** — core loop: boost-risk endless lanes
48. **Canyon Crash Derby** — core loop: knock opponents off ledges
49. **Retro Racer 3D** — core loop: pseudo-3D outrun-style hills
50. **Tow Truck Rescue** — core loop: hook and haul wrecks, timed
51. **Crane Chaos** — core loop: operate a crane to stack containers
52. **Rollercoaster Rider** — core loop: tilt-balance on tracks
53. **Hover Lane** — core loop: sci-fi hover lanes with boost pads
54. **Snow Plow Panic** — core loop: clear roads before time ends
55. **Garbage Rush** — core loop: bin collection route optimization
56. **Skate Park Flow** — core loop: endless skate trick chain
57. **Jet Ski Jump** — core loop: wave ramps & rings
58. **Tank Trials** — core loop: arcade tank obstacle dash

### 3D / hybrid tower defense (16)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: highest wave, then lives left, then gold efficiency; asset source: Three.js (MIT) + code-built geometry; models only from Quaternius/Kenney/Poly Haven (CC0); WebAudio SFX; quality gate: 7/10.

59. **Garden Gate TD** — core loop: lanes, plants-as-towers, original creatures
60. **Castle Cairn** — core loop: wall + archer towers with upgrade tree
61. **Space Lane Station** — core loop: orbital turrets vs swarm
62. **Crystal Mine Guard** — core loop: defend a drill in tunnels
63. **Toy Box Defense** — core loop: toy soldiers vs plush monsters
64. **Cyber Grid TD** — core loop: path-rewrite towers
65. **Pirate Cove Cannons** — core loop: sea waves
66. **Dino Dam** — core loop: block raptor paths
67. **Lighthouse Watch** — core loop: beam towers vs ghost ships
68. **Volcano Village** — core loop: lava-flow wave defense
69. **Frost Fort** — core loop: freeze/slow synergies
70. **Orchard Guard** — core loop: bees vs pests
71. **Rail Yard Stand** — core loop: ambush trains
72. **Pocket Dimension TD** — core loop: rotate the maze
73. **Bug Hive Siege** — core loop: hold chokepoints, endless scaling
74. **Mech Bay TD** — core loop: build, merge, upgrade turrets

### 3D shooters & survival (incl. Zombie Cubes-style) (24)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then survival time, then accuracy; asset source: Three.js (MIT) + code-built geometry; models only from Quaternius/Kenney/Poly Haven (CC0); WebAudio SFX; quality gate: 7/10.

75. **Cube Siege (Zombie Cubes-style flagship)** — core loop: 3D voxel arena, waves of cube zombies, weapon wall buys, grenades, barrels, boss every 10 waves (extend cube-horde)
76. **Bunker Breach** — core loop: top-down twin-stick vs swarm
77. **Orbital Outpost** — core loop: low-g arena shooter
78. **Neon Nexus** — core loop: dual-stick synthwave arena
79. **Lab Lockdown** — core loop: corridor survival
80. **Monster Mall** — core loop: hold a mall with turret traps
81. **Arena Zero** — core loop: endless boss rush
82. **Rail Gun Run** — core loop: on-rails shooter, combo
83. **Siege Squad** — core loop: 3-hero auto-fire survivors
84. **Dungeon Dash** — core loop: roguelite room clears (endless depth)
85. **Asteroid Reaper** — core loop: ship survivor with upgrades
86. **Swarm Command** — core loop: place drones, auto-fight
87. **Ghost Hunt** — core loop: flashlight arcade shooter
88. **Mutant Meadow** — core loop: farm defense shooter
89. **Alien Archive** — core loop: wave shooter with module picks
90. **Ricochet Range** — core loop: bounce-shot target gallery
91. **Sniper Alley** — core loop: timing/wind precision, endless
92. **Quick Draw Duel** — core loop: reaction arena (skill)
93. **Shield Siege** — core loop: rotate a shield, reflect bullets
94. **Laser Maze Run** — core loop: dodge/duck lasers
95. **Bullet Ballet** — core loop: pattern bullet-hell, graze score
96. **Robot Rampage** — core loop: arena brawler with parts
97. **Void Vault** — core loop: heist survival
98. **Zombie Cargo** — core loop: truck defense on a highway

### Polished 2D arcade (fresh takes, not clones) (30)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then shorter run time, then combo max; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

99. **Pixel Pounce** — core loop: TBD in batch brief (concept = title)
100. **Frog Hop Delta** — core loop: TBD in batch brief (concept = title)
101. **Maze Marauder** — core loop: TBD in batch brief (concept = title)
102. **Bounce Brigade** — core loop: TBD in batch brief (concept = title)
103. **Jelly Jam** — core loop: TBD in batch brief (concept = title)
104. **Pinball Plaza** — core loop: TBD in batch brief (concept = title)
105. **Comet Catch** — core loop: TBD in batch brief (concept = title)
106. **Disco Drop** — core loop: TBD in batch brief (concept = title)
107. **Orbit Optimizer** — core loop: TBD in batch brief (concept = title)
108. **Laser Lane** — core loop: TBD in batch brief (concept = title)
109. **Block Bloom** — core loop: TBD in batch brief (concept = title)
110. **Ball Blitz** — core loop: TBD in batch brief (concept = title)
111. **Shape Shifter** — core loop: TBD in batch brief (concept = title)
112. **Rocket Rinse** — core loop: TBD in batch brief (concept = title)
113. **Echo Escape** — core loop: TBD in batch brief (concept = title)
114. **Gravity Garden** — core loop: TBD in batch brief (concept = title)
115. **Swing Sprint** — core loop: TBD in batch brief (concept = title)
116. **Ninja Nibble** — core loop: TBD in batch brief (concept = title)
117. **Spark Sprint** — core loop: TBD in batch brief (concept = title)
118. **Pogo Pals** — core loop: TBD in batch brief (concept = title)
119. **Brick Blaze** — core loop: TBD in batch brief (concept = title)
120. **Slime Slinger** — core loop: TBD in batch brief (concept = title)
121. **Boomerang Bash** — core loop: TBD in batch brief (concept = title)
122. **Magnet Maze** — core loop: TBD in batch brief (concept = title)
123. **Wave Rider** — core loop: TBD in batch brief (concept = title)
124. **Pop Parade** — core loop: TBD in batch brief (concept = title)
125. **Mirror Mayhem** — core loop: TBD in batch brief (concept = title)
126. **Dash Dungeon** — core loop: TBD in batch brief (concept = title)
127. **Rune Run** — core loop: TBD in batch brief (concept = title)
128. **Comet Courier** — core loop: TBD in batch brief (concept = title)

### Physics & destruction (20)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then fewer shots used, then time; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

129. **Wrecking Yard** — core loop: TBD in batch brief (concept = title)
130. **Catapult Canyon** — core loop: TBD in batch brief (concept = title)
131. **Domino Demo** — core loop: TBD in batch brief (concept = title)
132. **Bridge Breaker** — core loop: TBD in batch brief (concept = title)
133. **Tower Topple** — core loop: TBD in batch brief (concept = title)
134. **Ragdoll Rooftop** — core loop: TBD in batch brief (concept = title)
135. **Pachinko Punch** — core loop: TBD in batch brief (concept = title)
136. **Slingshot Skies** — core loop: TBD in batch brief (concept = title)
137. **Tumble Tower** — core loop: TBD in batch brief (concept = title)
138. **Bowling Blitz Physics** — core loop: TBD in batch brief (concept = title)
139. **Crane Smash** — core loop: TBD in batch brief (concept = title)
140. **Bomb Squad Blocks** — core loop: TBD in batch brief (concept = title)
141. **Marble Mayhem** — core loop: TBD in batch brief (concept = title)
142. **Pendulum Panic** — core loop: TBD in batch brief (concept = title)
143. **Cannon Cove** — core loop: TBD in batch brief (concept = title)
144. **Demolition Derby Dome** — core loop: TBD in batch brief (concept = title)
145. **Sandcastle Siege** — core loop: TBD in batch brief (concept = title)
146. **Glass House Smash** — core loop: TBD in batch brief (concept = title)
147. **Rope Swing Rescue** — core loop: TBD in batch brief (concept = title)
148. **Cart Crash Canyon** — core loop: TBD in batch brief (concept = title)

### Puzzle & brain (skill-scored, timed or endless) (20)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then moves used, then time; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

149. **Merge Meadow** — core loop: TBD in batch brief (concept = title)
150. **Tile Tango** — core loop: TBD in batch brief (concept = title)
151. **Color Cascade** — core loop: TBD in batch brief (concept = title)
152. **Chain Reaction Lab** — core loop: TBD in batch brief (concept = title)
153. **Gem Grid Rush** — core loop: TBD in batch brief (concept = title)
154. **Word Rush (original word-chain)** — core loop: TBD in batch brief (concept = title)
155. **Number Sprint** — core loop: TBD in batch brief (concept = title)
156. **Sliding Sprint** — core loop: TBD in batch brief (concept = title)
157. **Pipe Panic** — core loop: TBD in batch brief (concept = title)
158. **Bubble Burst Blitz** — core loop: TBD in batch brief (concept = title)
159. **Hex Harmony** — core loop: TBD in batch brief (concept = title)
160. **Tangram Timed** — core loop: TBD in batch brief (concept = title)
161. **Light Bridge** — core loop: TBD in batch brief (concept = title)
162. **Switchboard** — core loop: TBD in batch brief (concept = title)
163. **Drop Sort** — core loop: TBD in batch brief (concept = title)
164. **Memory Maze** — core loop: TBD in batch brief (concept = title)
165. **Pattern Pulse** — core loop: TBD in batch brief (concept = title)
166. **Cube Fold** — core loop: TBD in batch brief (concept = title)
167. **Rotate Rail** — core loop: TBD in batch brief (concept = title)
168. **Connect Cables** — core loop: TBD in batch brief (concept = title)

### Reflex, precision & skill (20)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then streak length, then average reaction ms; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

169. **Stack Surge** — core loop: TBD in batch brief (concept = title)
170. **Knife Frenzy** — core loop: TBD in batch brief (concept = title)
171. **Dunk Dash** — core loop: TBD in batch brief (concept = title)
172. **Perfect Pour** — core loop: TBD in batch brief (concept = title)
173. **Timing Tower** — core loop: TBD in batch brief (concept = title)
174. **Tap Tempo** — core loop: TBD in batch brief (concept = title)
175. **Bullseye Blitz** — core loop: TBD in batch brief (concept = title)
176. **Needle Thread** — core loop: TBD in batch brief (concept = title)
177. **Hop Hoop** — core loop: TBD in batch brief (concept = title)
178. **Sniper Swing** — core loop: TBD in batch brief (concept = title)
179. **Laser Limbo** — core loop: TBD in batch brief (concept = title)
180. **Catch the Beat** — core loop: TBD in batch brief (concept = title)
181. **Fast Fingers** — core loop: TBD in batch brief (concept = title)
182. **Slice Storm** — core loop: TBD in batch brief (concept = title)
183. **Swipe Strike** — core loop: TBD in batch brief (concept = title)
184. **Pendulum Pop** — core loop: TBD in batch brief (concept = title)
185. **Precision Pitch** — core loop: TBD in batch brief (concept = title)
186. **Quick Quench** — core loop: TBD in batch brief (concept = title)
187. **Dodge Deluxe** — core loop: TBD in batch brief (concept = title)
188. **Pixel Parry** — core loop: TBD in batch brief (concept = title)

### Sports (arcade, score-attack) (20)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then streak, then accuracy; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

189. **Penalty Pro Rush** — core loop: TBD in batch brief (concept = title)
190. **Hoop Hero** — core loop: TBD in batch brief (concept = title)
191. **Home Run Heights** — core loop: TBD in batch brief (concept = title)
192. **Strike Zone Bowling** — core loop: TBD in batch brief (concept = title)
193. **Putt Planet** — core loop: TBD in batch brief (concept = title)
194. **Rally Rush** — core loop: TBD in batch brief (concept = title)
195. **Puck Pulse** — core loop: TBD in batch brief (concept = title)
196. **Skate Spin** — core loop: TBD in batch brief (concept = title)
197. **Dart Derby** — core loop: TBD in batch brief (concept = title)
198. **Archery Arena** — core loop: TBD in batch brief (concept = title)
199. **Free Throw Frenzy** — core loop: TBD in batch brief (concept = title)
200. **Goalie Grind** — core loop: TBD in batch brief (concept = title)
201. **Disc Golf Dash** — core loop: TBD in batch brief (concept = title)
202. **Surf Streak** — core loop: TBD in batch brief (concept = title)
203. **Snow Slalom** — core loop: TBD in batch brief (concept = title)
204. **Cricket Clash Arcade** — core loop: TBD in batch brief (concept = title)
205. **Badminton Blitz** — core loop: TBD in batch brief (concept = title)
206. **Race Walk Rush** — core loop: TBD in batch brief (concept = title)
207. **Kayak Gates** — core loop: TBD in batch brief (concept = title)
208. **Curling Quick** — core loop: TBD in batch brief (concept = title)

### Combat & beat-'em-up (endless) (15)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then hits taken, then time; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

209. **Brawler Alley** — core loop: TBD in batch brief (concept = title)
210. **Blade Blitz** — core loop: TBD in batch brief (concept = title)
211. **Ninja Night** — core loop: TBD in batch brief (concept = title)
212. **Boss Rush Arcade** — core loop: TBD in batch brief (concept = title)
213. **Sword Storm** — core loop: TBD in batch brief (concept = title)
214. **Punch Parade** — core loop: TBD in batch brief (concept = title)
215. **Dojo Dash** — core loop: TBD in batch brief (concept = title)
216. **Shield Slam** — core loop: TBD in batch brief (concept = title)
217. **Arena Axe** — core loop: TBD in batch brief (concept = title)
218. **Fist Fury Endless** — core loop: TBD in batch brief (concept = title)
219. **Staff Strike** — core loop: TBD in batch brief (concept = title)
220. **Samurai Sprint** — core loop: TBD in batch brief (concept = title)
221. **Gladiator Gauntlet** — core loop: TBD in batch brief (concept = title)
222. **Combo Colosseum** — core loop: TBD in batch brief (concept = title)
223. **Shadow Sparring** — core loop: TBD in batch brief (concept = title)

### Specialty & classic-style (original) (20)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then shorter run time, then combo max; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

224. **Light Cycle Legends** — core loop: TBD in batch brief (concept = title)
225. **Lander Legends** — core loop: TBD in batch brief (concept = title)
226. **Frogger-style Crossing Chaos** — core loop: TBD in batch brief (concept = title)
227. **Marble Run Master** — core loop: TBD in batch brief (concept = title)
228. **Pipe Mania Rush** — core loop: TBD in batch brief (concept = title)
229. **Snake Surge** — core loop: TBD in batch brief (concept = title)
230. **Pac-style Phantom Chase** — core loop: TBD in batch brief (concept = title)
231. **Breakout Beyond** — core loop: TBD in batch brief (concept = title)
232. **Asteroid Arena** — core loop: TBD in batch brief (concept = title)
233. **Pong Pulse** — core loop: TBD in batch brief (concept = title)
234. **Tempest Tunnel (original vector tube shooter)** — core loop: TBD in batch brief (concept = title)
235. **Missile Meadow** — core loop: TBD in batch brief (concept = title)
236. **Berzerk Bunker** — core loop: TBD in batch brief (concept = title)
237. **Defender Dunes** — core loop: TBD in batch brief (concept = title)
238. **Centipede Garden** — core loop: TBD in batch brief (concept = title)
239. **Galaxy Guard** — core loop: TBD in batch brief (concept = title)
240. **Invader Interlude** — core loop: TBD in batch brief (concept = title)
241. **Robo Rampage 2084** — core loop: TBD in batch brief (concept = title)
242. **Battlezone Bluff** — core loop: TBD in batch brief (concept = title)
243. **Rally Racer Retro** — core loop: TBD in batch brief (concept = title)

### Casual duel-compatible (async seed, V1.1) (10)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then shorter run time, then combo max; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

244. **Seed Sprint** — core loop: TBD in batch brief (concept = title)
245. **Mirror Match Stack** — core loop: TBD in batch brief (concept = title)
246. **Duel Dodge** — core loop: TBD in batch brief (concept = title)
247. **Face-off Flip** — core loop: TBD in batch brief (concept = title)
248. **Twin Tap** — core loop: TBD in batch brief (concept = title)
249. **Ghost Race Runner** — core loop: TBD in batch brief (concept = title)
250. **Head-to-Head Hoops** — core loop: TBD in batch brief (concept = title)
251. **Duel Dash** — core loop: TBD in batch brief (concept = title)
252. **Pair Puzzle** — core loop: TBD in batch brief (concept = title)
253. **Quick Quiz Racer** — core loop: TBD in batch brief (concept = title)

### Rhythm & music (15)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then shorter run time, then combo max; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

254. **Beat Blaster** — core loop: TBD in batch brief (concept = title)
255. **Rhythm Rails** — core loop: TBD in batch brief (concept = title)
256. **Pulse Pad** — core loop: TBD in batch brief (concept = title)
257. **Lo-fi Lane** — core loop: TBD in batch brief (concept = title)
258. **Echo Notes** — core loop: TBD in batch brief (concept = title)
259. **Drum Dash** — core loop: TBD in batch brief (concept = title)
260. **Synth Sprint** — core loop: TBD in batch brief (concept = title)
261. **Metronome Maze** — core loop: TBD in batch brief (concept = title)
262. **Chord Climb** — core loop: TBD in batch brief (concept = title)
263. **Bass Drop Runner** — core loop: TBD in batch brief (concept = title)
264. **Neon Notes** — core loop: TBD in batch brief (concept = title)
265. **Vinyl Voyage** — core loop: TBD in batch brief (concept = title)
266. **Clap Combo** — core loop: TBD in batch brief (concept = title)
267. **Tempo Trails** — core loop: TBD in batch brief (concept = title)
268. **Groove Gate** — core loop: TBD in batch brief (concept = title)

### Idle-lite & strategy-score (skill, uncapped) (15)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then shorter run time, then combo max; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

269. **Economy Orchard** — core loop: TBD in batch brief (concept = title)
270. **Tycoon Tumble (timed)** — core loop: TBD in batch brief (concept = title)
271. **Merge Mine** — core loop: TBD in batch brief (concept = title)
272. **Auto Arena Architect** — core loop: TBD in batch brief (concept = title)
273. **Colony Clicker Cap-free** — core loop: TBD in batch brief (concept = title)
274. **Factory Flow** — core loop: TBD in batch brief (concept = title)
275. **Trade Route Rush** — core loop: TBD in batch brief (concept = title)
276. **Tiny Town Timed** — core loop: TBD in batch brief (concept = title)
277. **Garden Grow Rush** — core loop: TBD in batch brief (concept = title)
278. **Skill Tree Sprint** — core loop: TBD in batch brief (concept = title)
279. **Logistics Lane** — core loop: TBD in batch brief (concept = title)
280. **Fleet Frontier** — core loop: TBD in batch brief (concept = title)
281. **Orchard Optimizer** — core loop: TBD in batch brief (concept = title)
282. **Quarry Queue** — core loop: TBD in batch brief (concept = title)
283. **Bakery Blitz** — core loop: TBD in batch brief (concept = title)

### Space & sci-fi (15)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then shorter run time, then combo max; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

284. **Starlane Surge** — core loop: TBD in batch brief (concept = title)
285. **Comet Convoy** — core loop: TBD in batch brief (concept = title)
286. **Wormhole Weave** — core loop: TBD in batch brief (concept = title)
287. **Nebula Navigator** — core loop: TBD in batch brief (concept = title)
288. **Lunar Loop** — core loop: TBD in batch brief (concept = title)
289. **Ion Interceptor** — core loop: TBD in batch brief (concept = title)
290. **Gravity Well Gauntlet** — core loop: TBD in batch brief (concept = title)
291. **Satellite Slinger** — core loop: TBD in batch brief (concept = title)
292. **Mars Mule Run** — core loop: TBD in batch brief (concept = title)
293. **Alien Airlock** — core loop: TBD in batch brief (concept = title)
294. **Photon Pilot** — core loop: TBD in batch brief (concept = title)
295. **Ring World Run** — core loop: TBD in batch brief (concept = title)
296. **Dock Drift** — core loop: TBD in batch brief (concept = title)
297. **Solar Sail Slalom** — core loop: TBD in batch brief (concept = title)
298. **Meteor Mine** — core loop: TBD in batch brief (concept = title)

### Nature, animals & cozy (15)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then shorter run time, then combo max; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

299. **Koi Pond Combo** — core loop: TBD in batch brief (concept = title)
300. **Bee Line Blitz** — core loop: TBD in batch brief (concept = title)
301. **Penguin Slide Slalom** — core loop: TBD in batch brief (concept = title)
302. **Fox Forest Run** — core loop: TBD in batch brief (concept = title)
303. **Turtle Tumble** — core loop: TBD in batch brief (concept = title)
304. **Owl Orchard** — core loop: TBD in batch brief (concept = title)
305. **Whale Wave Rider** — core loop: TBD in batch brief (concept = title)
306. **Hedgehog Hustle** — core loop: TBD in batch brief (concept = title)
307. **Butterfly Bloom** — core loop: TBD in batch brief (concept = title)
308. **Duck Dash Delta** — core loop: TBD in batch brief (concept = title)
309. **Panda Platform Pop** — core loop: TBD in batch brief (concept = title)
310. **Gecko Grip** — core loop: TBD in batch brief (concept = title)
311. **Otter Overflow** — core loop: TBD in batch brief (concept = title)
312. **Moth to Flame Maze** — core loop: TBD in batch brief (concept = title)
313. **Crab Cove Combo** — core loop: TBD in batch brief (concept = title)

### Fantasy & medieval (15)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then shorter run time, then combo max; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

314. **Dragon Dive** — core loop: TBD in batch brief (concept = title)
315. **Wizard Whirl** — core loop: TBD in batch brief (concept = title)
316. **Knight Night Run** — core loop: TBD in batch brief (concept = title)
317. **Goblin Gold Rush** — core loop: TBD in batch brief (concept = title)
318. **Rune Raider** — core loop: TBD in batch brief (concept = title)
319. **Elf Arrow Arena** — core loop: TBD in batch brief (concept = title)
320. **Orc Obstacle** — core loop: TBD in batch brief (concept = title)
321. **Castle Climb** — core loop: TBD in batch brief (concept = title)
322. **Potion Pop** — core loop: TBD in batch brief (concept = title)
323. **Mimic Maze** — core loop: TBD in batch brief (concept = title)
324. **Griffin Gauntlet** — core loop: TBD in batch brief (concept = title)
325. **Bard's Beat** — core loop: TBD in batch brief (concept = title)
326. **Troll Bridge Toll** — core loop: TBD in batch brief (concept = title)
327. **Phoenix Flight** — core loop: TBD in batch brief (concept = title)
328. **Cursed Crypt Crawl** — core loop: TBD in batch brief (concept = title)

### Horror-lite & arcade spooky (age-appropriate) (10)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then shorter run time, then combo max; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

329. **Haunted Halls Hustle** — core loop: TBD in batch brief (concept = title)
330. **Ghost Glow Run** — core loop: TBD in batch brief (concept = title)
331. **Pumpkin Patch Panic** — core loop: TBD in batch brief (concept = title)
332. **Vampire Vamoose** — core loop: TBD in batch brief (concept = title)
333. **Mummy Maze Dash** — core loop: TBD in batch brief (concept = title)
334. **Witch Wheel Wipeout** — core loop: TBD in batch brief (concept = title)
335. **Skeleton Slide** — core loop: TBD in batch brief (concept = title)
336. **Bat Cave Weave** — core loop: TBD in batch brief (concept = title)
337. **Werewolf Waltz** — core loop: TBD in batch brief (concept = title)
338. **Spider Silk Swing** — core loop: TBD in batch brief (concept = title)

### Retro-futurist & cyber (10)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then shorter run time, then combo max; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

339. **Synthwave Slalom** — core loop: TBD in batch brief (concept = title)
340. **Cyber Cycle Chase** — core loop: TBD in batch brief (concept = title)
341. **Data Dive** — core loop: TBD in batch brief (concept = title)
342. **Hack the Grid** — core loop: TBD in batch brief (concept = title)
343. **Pixel Pulse Racer** — core loop: TBD in batch brief (concept = title)
344. **Neon Noodle Run** — core loop: TBD in batch brief (concept = title)
345. **Vapor Vault** — core loop: TBD in batch brief (concept = title)
346. **Arcade Alley 84** — core loop: TBD in batch brief (concept = title)
347. **Circuit Courier** — core loop: TBD in batch brief (concept = title)
348. **Glitch Gauntlet** — core loop: TBD in batch brief (concept = title)

### Kitchen & food (arcade) (12)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then shorter run time, then combo max; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

349. **Sushi Sprint** — core loop: TBD in batch brief (concept = title)
350. **Pizza Plunge** — core loop: TBD in batch brief (concept = title)
351. **Burger Blitz Belt** — core loop: TBD in batch brief (concept = title)
352. **Taco Tower** — core loop: TBD in batch brief (concept = title)
353. **Noodle Nest** — core loop: TBD in batch brief (concept = title)
354. **Cupcake Catch** — core loop: TBD in batch brief (concept = title)
355. **Smoothie Swirl** — core loop: TBD in batch brief (concept = title)
356. **Wok Wave** — core loop: TBD in batch brief (concept = title)
357. **Pancake Flip Flurry** — core loop: TBD in batch brief (concept = title)
358. **Ice Cream Stack Rush** — core loop: TBD in batch brief (concept = title)
359. **Soup Slide** — core loop: TBD in batch brief (concept = title)
360. **Cookie Combo** — core loop: TBD in batch brief (concept = title)

### Seasonal / event-themed (rotate with shop events) (12)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then shorter run time, then combo max; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

361. **Spooky Haze Hustle** — core loop: TBD in batch brief (concept = title)
362. **Frosted Holiday Hop** — core loop: TBD in batch brief (concept = title)
363. **New Year Glow Run** — core loop: TBD in batch brief (concept = title)
364. **Heart Eyes Match** — core loop: TBD in batch brief (concept = title)
365. **Lucky Green Lanes** — core loop: TBD in batch brief (concept = title)
366. **4/20 Week Warmup (21+, no promo claims)** — core loop: TBD in batch brief (concept = title)
367. **Summer Arcade Splash** — core loop: TBD in batch brief (concept = title)
368. **Munchies Week Maker** — core loop: TBD in batch brief (concept = title)
369. **Launch Week Loop** — core loop: TBD in batch brief (concept = title)
370. **Birthday Bash Blocks** — core loop: TBD in batch brief (concept = title)
371. **Snowball Siege** — core loop: TBD in batch brief (concept = title)
372. **Fireworks Finale** — core loop: TBD in batch brief (concept = title)

### City, transit & builders (13)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then shorter run time, then combo max; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

373. **Skyline Stacker** — core loop: TBD in batch brief (concept = title)
374. **Metro Merge** — core loop: TBD in batch brief (concept = title)
375. **Bridge Builder Blitz** — core loop: TBD in batch brief (concept = title)
376. **Road Roller Rush** — core loop: TBD in batch brief (concept = title)
377. **Parking Pro Precision** — core loop: TBD in batch brief (concept = title)
378. **Bike Courier Dash** — core loop: TBD in batch brief (concept = title)
379. **Tram Tangle** — core loop: TBD in batch brief (concept = title)
380. **Harbor Hauler** — core loop: TBD in batch brief (concept = title)
381. **Airport Apron Rush** — core loop: TBD in batch brief (concept = title)
382. **Elevator Escape** — core loop: TBD in batch brief (concept = title)
383. **Zip Line Zoom** — core loop: TBD in batch brief (concept = title)
384. **Construction Crane Combo** — core loop: TBD in batch brief (concept = title)
385. **Traffic Cop Timed** — core loop: TBD in batch brief (concept = title)

### Math & logic (timed, uncapped) (13)
Default spec for this genre — endless/uncapped: yes; skill tie-break metrics: score, then moves used, then time; asset source: Canvas/kit.js, code-drawn vector art; optional Kenney/OpenGameArt CC0 sprites (record in CREDITS.md); WebAudio SFX; quality gate: 7/10.

386. **Sum Sprint** — core loop: TBD in batch brief (concept = title)
387. **Prime Pop** — core loop: TBD in batch brief (concept = title)
388. **Equation Express** — core loop: TBD in batch brief (concept = title)
389. **Logic Locks** — core loop: TBD in batch brief (concept = title)
390. **Binary Blitz** — core loop: TBD in batch brief (concept = title)
391. **Grid Guess Skill (deduction, no luck)** — core loop: TBD in batch brief (concept = title)
392. **Pattern Painter** — core loop: TBD in batch brief (concept = title)
393. **Shape Sum** — core loop: TBD in batch brief (concept = title)
394. **Counting Coaster** — core loop: TBD in batch brief (concept = title)
395. **Order Overload** — core loop: TBD in batch brief (concept = title)
396. **Estimate Express** — core loop: TBD in batch brief (concept = title)
397. **Sequence Surge** — core loop: TBD in batch brief (concept = title)
398. **Mirror Math** — core loop: TBD in batch brief (concept = title)

## 1.6 The 13 core games — rebuild specs (public/js/games/*.js, ids in src/config.js)
Status: never fully audited signed-in; art tiers unverified (needs real session). Each needs: portrait layout, AAA art pass, juice, skill tie-break metric, signed-score regression.
- jetpack-dash (Arcade, unit m): endless jetpack flight; rebuild with parallax biomes, coin patterns, missile warnings; tie-break distance→coins→time.
- drift-rush (Racing): endless drift driving; 3D/pseudo-3D upgrade, drift combo scoring, traffic.
- memory-match (Puzzle): score-based memory; add timed endless levels, new art sets; skill metric moves/time. Note: confirm it is skill-based (no luck).
- high-score (Arcade): clarify core loop and rebuild; unknown exact mechanic here — read source first.
- terp-tapper (Arcade): tapping/rhythm; polish art, combo system.
- munchies-snake (Arcade, 'Neon Munchies'): snake variant; new neon 3D/2D art, power-ups.
- brick-breaker (Arcade): breakout; power-ups, level themes, endless waves.
- sky-hopper (Arcade): vertical hopper; biomes, enemies.
- void-swarm (Arcade): survivors-style swarm shooter; weapons/upgrades/boss; high scores ~100k+ (pass-quest thresholds).
- stack (Arcade): precision stacking; visual upgrade, perfect-chain scoring.
- grow-guard (Strategy): tower-defense-like; AAA 3D/2D upgrade, endless waves.
- sling-smash (Physics): slingshot destruction; physics polish, campaign + endless.
- haze-defense (Strategy): defense game; upgrade as 1.5 TD standard.
Core score thresholds are in docs/score-ranges.json and docs/pass-quests.json (do not change without re-running tools/pass-quest-sim.js).

## 1.7 Every existing library game — redo spec (worst first)
Redo means: keep the game's *identity* (category and fantasy) but add a genuinely new gameplay mechanic/twist plus original art; classes below are the HONEST state today. Audit issues come from game-audit.md (Oct 17); 'plan' was the audit's original suggestion.

1. **Rail Rush** (`rail-rush`, Endless Runners, audit tier 4, class: juice-only, giveaway). Scoring: Distance x multiplier (1-5 from coins, x2 power-up) + coins 10 x multi. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (distance, then fewer collisions, then time-to-first-obstacle-clear); gate 7/10.
2. **Road Hopper** (`road-hopper`, Endless Runners, audit tier 3, class: juice-only, giveaway). Scoring: 1 per furthest row + coins 5. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (distance, then fewer collisions, then time-to-first-obstacle-clear); gate 7/10.
3. **Most Wanted Run** (`wanted-run`, Driving, audit tier 3, class: juice-only, giveaway). Scoring: Survival time x heat + wrecked cops 50. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (distance, then drift/near-miss count, then fastest checkpoint split); gate 7/10.
4. **Cloud Hopper** (`cloud-hopper`, Endless Runners, audit tier 3, class: overlay, giveaway). Scoring: Height climbed + pickups. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (distance, then fewer collisions, then time-to-first-obstacle-clear); gate 7/10.
5. **Rock Buster** (`rock-buster`, Arcade Shooters, audit tier 2, class: overlay, giveaway). Scoring: Rocks 20/50/100, UFO 300. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then survival time, then accuracy); gate 7/10.
6. **Star Swarm** (`star-swarm`, Arcade Shooters, audit tier 2, class: overlay, giveaway). Scoring: Bugs 50-160 (diving x2), stage bonus. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then survival time, then accuracy); gate 7/10.
7. **Grid Wars** (`grid-wars`, Survival & Horde, audit tier 2, class: overlay, giveaway). Scoring: Enemies 25-150 x multiplier. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then shorter run time, then combo max); gate 7/10.
8. **Moon Swarm** (`moon-swarm`, Survival & Horde, audit tier 2, class: overlay, giveaway). Scoring: Kills 10-80 (enemy tier), uncapped survival. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then shorter run time, then combo max); gate 7/10.
9. **Smoke Rings** (`smoke-rings`, Cannabis, audit tier 2, class: overlay, giveaway). Scoring: Hoop 100 (bullseye 200) x combo up to 6, set clear 500 x set. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then shorter run time, then combo max); gate 7/10.
10. **Beat Tiles** (`beat-tiles`, Puzzle & Brain, audit tier 2, class: overlay, giveaway). Scoring: Tile 1-3 by timing, long-tile hold 1 per 40 px + 3. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then moves used, then time); gate 7/10.
11. **Glow Echo** (`glow-echo`, Puzzle & Brain, audit tier 2, class: overlay, giveaway). Scoring: Pad 10-20 by answer speed, round 25 x round. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then moves used, then time); gate 7/10.
12. **Throttle Rider** (`throttle-rider`, Driving, audit tier 4, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Distance + near-miss chains (first-person). Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (distance, then drift/near-miss count, then fastest checkpoint split); gate 7/10.
13. **Orb Coil** (`orb-coil`, Puzzle & Brain, audit tier 4, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Orbs 10 x combo + chain bonus 50 x combo. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then moves used, then time); gate 7/10.
14. **Neon Flipper** (`neon-flipper`, Puzzle & Brain, audit tier 4, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Bumper 100, sling 10, target 250, lane 500, bank 5000 (all x multiplie. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then moves used, then time); gate 7/10.
15. **Cup Toss** (`cup-toss`, Cannabis, audit tier 4, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Cup 100 (+50 bounce, +30 rattle) x streak up to 5, rack 500 x rack. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then shorter run time, then combo max); gate 7/10.
16. **Pin Strike** (`pin-strike`, Sports, audit tier 4, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Pins + real strike/spare bonuses over endless frames. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak, then accuracy); gate 7/10.
17. **Bullseye** (`bullseye`, Combat, audit tier 4, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Arrow ring x10 (+5 X), end bonus 20 x end. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then hits taken, then time); gate 7/10.
18. **Spot Kick** (`spot-kick`, Sports, audit tier 4, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Goal 100-200 by corner x2 ring x streak up to 4. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak, then accuracy); gate 7/10.
19. **Knockout Ring** (`knockout`, Combat, audit tier 4, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Hits 60-600 (counter x2), dodge 50, KO 1000 x KOs + stamina. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then hits taken, then time); gate 7/10.
20. **Cue Club** (`cue-club`, Sports, audit tier 4, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Pot 100 x pots-this-turn, rack 500 x racks. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak, then accuracy); gate 7/10.
21. **Long Ball** (`long-ball`, Sports, audit tier 4, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Homer = distance ft x streak mult up to 4. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak, then accuracy); gate 7/10.
22. **Rally Court** (`rally-court`, Sports, audit tier 4, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Return 10 x rally (cap 10) x2 sweet spot, point 200 + 25 x rally. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak, then accuracy); gate 7/10.
23. **Ice Snipe** (`ice-snipe`, Sports, audit tier 4, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Goal 100-250 by corner x streak up to 4. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak, then accuracy); gate 7/10.
24. **Reel Deal** (`reel-deal`, Sports, audit tier 4, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Fish = kg x 100 x (1 + rarity x 2). Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak, then accuracy); gate 7/10.
25. **Hoop Streak** (`hoop-streak`, Sports, audit tier 4, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Make 100/150 (2/3 pt) x1.5 swish x2 fire. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak, then accuracy); gate 7/10.
26. **Maze Muncher** (`maze-muncher`, Specialty, audit tier 3, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Dots 10, power 50, ghosts 200-1600, mazes repeat faster. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then shorter run time, then combo max); gate 7/10.
27. **Pop Defense** (`pop-defense`, Tower Defense, audit tier 3, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Layer pops 1, wave bonus 25 x wave. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (highest wave, then lives left, then gold efficiency); gate 7/10.
28. **Light Cycle** (`light-cycle`, Reflex & Skill, audit tier 3, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Rival derezzed 100 x round, round clear 500 x round, near-miss 2, surv. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak length, then average reaction ms); gate 7/10.
29. **Missile Guard** (`missile-guard`, Arcade Shooters, audit tier 3, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Warheads 25, wave bonus cities x100 + ammo x5. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then survival time, then accuracy); gate 7/10.
30. **Bubble Pop** (`bubble-pop`, Puzzle & Brain, audit tier 3, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: 10 per match bubble, 20 x drops (x up to 4), clear 1000. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then moves used, then time); gate 7/10.
31. **Knife Toss** (`knife-toss`, Reflex & Skill, audit tier 3, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Knife 10, apple 50, stage 100 x stage. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak length, then average reaction ms); gate 7/10.
32. **Bud Bar** (`bud-bar`, Cannabis, audit tier 3, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Serve 50, empties 25. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then shorter run time, then combo max); gate 7/10.
33. **Roll Up** (`roll-up`, Cannabis, audit tier 3, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Step accuracy 0-100 x streak multiplier (up to x5), order bonus 2 x av. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then shorter run time, then combo max); gate 7/10.
34. **Bud Sort** (`bud-sort`, Cannabis, audit tier 3, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Jar 10-20 by timing x combo up to 8. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then shorter run time, then combo max); gate 7/10.
35. **Pest Patrol** (`pest-patrol`, Cannabis, audit tier 3, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Mite 10, caterpillar 20, beetle 40 x combo up to 5, wave 100 x wave. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then shorter run time, then combo max); gate 7/10.
36. **Moon Lander** (`moon-lander`, Specialty, audit tier 3, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Landing (50 + softness + upright) x pad 2-5. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then shorter run time, then combo max); gate 7/10.
37. **Putt Party** (`putt-party`, Sports, audit tier 3, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Hole 300 + 200 per stroke under par, ace +1000. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak, then accuracy); gate 7/10.
38. **Kickflip City** (`kickflip-city`, Sports, audit tier 3, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Combo = trick/grind points x tricks in combo, banked on clean landing. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak, then accuracy); gate 7/10.
39. **Tunnel Hop** (`tunnel-hop`, Endless Runners, audit tier 3, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Distance m. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (distance, then fewer collisions, then time-to-first-obstacle-clear); gate 7/10.
40. **Neon Circuit** (`neon-circuit`, Driving, audit tier 3, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Energy cells 30–125 by combo; near-miss 5. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (distance, then drift/near-miss count, then fastest checkpoint split); gate 7/10.
41. **Block Drop** (`block-drop`, Puzzle & Brain, audit tier 2, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Lines 100/300/500/800 x level + soft drop. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then moves used, then time); gate 7/10.
42. **Hill Hauler** (`hill-hauler`, Driving, audit tier 2, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Distance in m + coins 5. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (distance, then drift/near-miss count, then fastest checkpoint split); gate 7/10.
43. **Arrow Hero** (`arrow-hero`, Survival & Horde, audit tier 2, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Kill 25, boss 1000, room clear 100 x room. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then shorter run time, then combo max); gate 7/10.
44. **Goo Tower** (`goo-tower`, Physics & Destruction, audit tier 2, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Peak tower height in m (wind grows). Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then fewer shots used, then time); gate 7/10.
45. **Green Dash** (`green-dash`, Cannabis, audit tier 2, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Distance + deliveries 100. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then shorter run time, then combo max); gate 7/10.
46. **Cab Rush** (`cab-rush`, Driving, audit tier 2, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Fares 50 + speed bonus; time extends per fare. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (distance, then drift/near-miss count, then fastest checkpoint split); gate 7/10.
47. **Road Brawl** (`road-brawl`, Driving, audit tier 2, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Distance + takedowns 60-100. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (distance, then drift/near-miss count, then fastest checkpoint split); gate 7/10.
48. **Derby Smash** (`derby-smash`, Driving, audit tier 2, class: art-upgraded (scenery/sprites, same mechanic), giveaway). Scoring: Impact damage dealt + wrecks 150. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (distance, then drift/near-miss count, then fastest checkpoint split); gate 7/10.
49. **Skee Roll** (`skee-roll`, Reflex & Skill, audit tier 4, class: art-rebuilt, giveaway). Scoring: Rings 10-100; 9-ball frames, beat the rising target to continue, frame. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak length, then average reaction ms); gate 7/10.
50. **Helix Drop** (`helix-drop`, Reflex & Skill, audit tier 3, class: art-rebuilt, giveaway). Scoring: Floors passed with combo, fireball smashes. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak length, then average reaction ms); gate 7/10.
51. **Hex Spin** (`hex-spin`, Reflex & Skill, audit tier 3, class: art-rebuilt, giveaway). Scoring: Survival time in 0.1s. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak length, then average reaction ms); gate 7/10.
52. **Color Hop** (`color-hop`, Reflex & Skill, audit tier 3, class: art-rebuilt, giveaway). Scoring: Stars collected. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak length, then average reaction ms); gate 7/10.
53. **Mole Whack** (`mole-whack`, Reflex & Skill, audit tier 3, class: art-rebuilt, giveaway). Scoring: Critter 10, gold 50, combo x5; hits refill the clock (+0.6s / gold +2s. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak length, then average reaction ms); gate 7/10.
54. **Strain Crush** (`strain-crush`, Cannabis, audit tier 3, class: art-rebuilt, giveaway). Scoring: 10 per gem x cascade chain; matches refill the clock. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then shorter run time, then combo max); gate 7/10.
55. **Tile Twin** (`tile-twin`, Puzzle & Brain, audit tier 3, class: art-rebuilt, giveaway). Scoring: Pair 20 x combo up to 6 + 5 x layout, clear 500 x layout. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then moves used, then time); gate 7/10.
56. **No Brakes** (`no-brakes`, Driving, audit tier 3, class: art-rebuilt, giveaway). Scoring: Distance + cars passed 10. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (distance, then drift/near-miss count, then fastest checkpoint split); gate 7/10.
57. **Paper Toss** (`paper-toss`, Reflex & Skill, audit tier 3, class: art-rebuilt, giveaway). Scoring: 1-5 per basket by wind strength. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak length, then average reaction ms); gate 7/10.
58. **Alien Rows** (`alien-rows`, Arcade Shooters, audit tier 2, class: rebuilt, giveaway). Scoring: Aliens 10-30, saucer 100-300, wave bonus. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then survival time, then accuracy); gate 7/10.
59. **Hex Stack** (`hex-stack`, Puzzle & Brain, audit tier 2, class: rebuilt, giveaway). Scoring: Hexes burst x chain (endless, speeds up). Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then moves used, then time); gate 7/10.
60. **Cube Horde** (`cube-horde`, Survival & Horde, audit tier 2, class: rebuilt, giveaway). Scoring: Kills 10-50 x combo, wave bonus. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then shorter run time, then combo max); gate 7/10.
61. **Keep Guard** (`keep-guard`, Tower Defense, audit tier 2, class: rebuilt, giveaway). Scoring: Raiders 10-120, wave bonus 50 x wave. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (highest wave, then lives left, then gold efficiency); gate 7/10.
62. **Node Siege** (`node-siege`, Tower Defense, audit tier 2, class: rebuilt, giveaway). Scoring: Enemies 10-300, wave bonus 40 x wave (maze building). Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (highest wave, then lives left, then gold efficiency); gate 7/10.
63. **Roof Runner** (`roof-runner`, Endless Runners, audit tier 2, class: rebuilt, giveaway). Scoring: Distance m. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (distance, then fewer collisions, then time-to-first-obstacle-clear); gate 7/10.
64. **Zig Path** (`zig-path`, Reflex & Skill, audit tier 2, class: rebuilt, giveaway). Scoring: Turns + gems 5. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak length, then average reaction ms); gate 7/10.
65. **Bug Blaster** (`bug-blaster`, Arcade Shooters, audit tier 2, class: rebuilt, giveaway). Scoring: Head 100, body 10, spider 300-900, mushroom 1. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then survival time, then accuracy); gate 7/10.
66. **Grow Op** (`grow-op`, Cannabis, audit tier 2, class: rebuilt, giveaway). Scoring: Harvest 40-150 by ripeness x health, pests 5; ends when 3 plants die. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then shorter run time, then combo max); gate 7/10.
67. **Trim Rush** (`trim-rush`, Cannabis, audit tier 2, class: rebuilt, giveaway). Scoring: Snip 10/20/30 by cut distance + combo up to 10 (gold leaf x2), bud bon. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then shorter run time, then combo max); gate 7/10.
68. **Dirt Dash** (`dirt-dash`, Driving, audit tier 2, class: rebuilt, giveaway). Scoring: Distance m + clean landings 30. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (distance, then drift/near-miss count, then fastest checkpoint split); gate 7/10.
69. **Dunk Flick** (`dunk-flick`, Reflex & Skill, audit tier 2, class: rebuilt, giveaway). Scoring: 1 per basket, swish streak +n. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak length, then average reaction ms); gate 7/10.
70. **Duck Shot** (`duck-shot`, Reflex & Skill, audit tier 2, class: rebuilt, giveaway). Scoring: Duck 100 + 20 x round x streak, gold +400, perfect bonus. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then streak length, then average reaction ms); gate 7/10.
71. **Rift Survival** (`rift-survival`, Survival & Horde, audit tier 2, class: rebuilt, giveaway). Scoring: Shards 25; wave transition bonus 10 × wave; survival is the primary sk. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then shorter run time, then combo max); gate 7/10.
72. **Bud Merge** (`bud-merge`, Cannabis, audit tier 1, class: rebuilt, giveaway). Scoring: Sum of merged tiles (endless, no win stop). Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then shorter run time, then combo max); gate 7/10.
73. **Desert Dash** (`dino-dash`, Endless Runners, audit tier 1, class: rebuilt, giveaway). Scoring: Distance run (endless, speeds up). Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (distance, then fewer collisions, then time-to-first-obstacle-clear); gate 7/10.
74. **Mine Sweep** (`mine-sweep`, Puzzle & Brain, audit tier 1, class: rebuilt, giveaway). Scoring: 1 per cell + board clear speed bonus. Audit issues: n/a. Original plan: n/a. REDO: new mechanic twist + original art + skill tie-break (score, then moves used, then time); gate 7/10.

Retired duplicates (not playable by design): drift-king, dune-glide, egg-roll, monster-crush, rig-rally, wreck-ride — either delete the folders after confirming no inbound links or rebuild as distinct new games; do not re-enable as aliases.

## 1.8 Build batches (~20 games each)
Order: batch 0 = redo of the existing 87 in 4 waves (worst-first); then batches of ~20 new games (≈20 batches for 400). Per batch: freeze plan → build → static check (`tools/games-lib-static-check.js`) → e2e (`tools/e2e-games-lib.js`) → integrity audit → real Android + iPhone play (title, gameplay, game-over, score submit screenshots) → reviewer score ≥7 → registry + thumbs + CREDITS → docs/GAMES-LIB.md regenerated → ONE push (≤4 files per call) → live smoke. Do not ship a batch that lowers the average; quarantine with `playable:false`.
Suggested batch themes: B1 cannabis originals(14)+Cube Siege flagship; B2–B4 3D runners/driving; B5–B6 3D TD; B7–B8 shooters/survival; B9–B20 2D/physics/puzzle/sports/etc. from 1.5.

## 1.9 Zombie-Cubes-style shooter (flagship)
Wants: a first-class 3D voxel survival shooter 'in the style of' Zombie Cubes (do not copy its code/art/name). Exists: `cube-horde` rebuilt 5:30 PM Oct 17 (weapons, grenades, barrels, boss, upgrades; all geometry code-built, WebAudio SFX; no external assets). Remaining: Cube Siege = expand cube-horde to: 3 arenas, 8 weapons with upgrade tiers, perk shop between waves, boss every 10 waves, co-op-free, endless uncapped waves, tie-break = highest wave → kills → time; perf: instancing (InstancedMesh), pooled cubes, DPR cap, ≥30 fps on mid phone. Acceptance: 1.4 + 9-point manual playthrough.

## 1.10 Licensing rules (details: 02-licensed-sources.md)
Allowed: original code (MIT, Trap Tech), CC0 assets (Kenney, Quaternius, Poly Haven, OpenGameArt CC0), MIT/BSD/Apache/zlib open-source games with LICENSE verified per repo (keep license file + attribution), GPL only if we accept GPL for that game's folder (viral; avoid mixing into our MIT code). Forbidden: ripped/pirated assets, commercial names/art/code, unclear-license games, 'No-commercial' assets, copying titles like Bloons. Record source+licence per game in CREDITS.md and registry `source`/`licence`.
