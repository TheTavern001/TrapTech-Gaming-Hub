# Trap Tech Gaming Hub — Complete Handoff, Status & Memory
**Last updated:** 2026-10-15  
**Live hub:** https://glassy-drifter-9532.de.deplexo.com/  
**Purpose:** Single document containing the AAA vision, assets, tools, current state, open gates, hard rules, and all prior context.

---

## 1. Live Environment & Current State
- **Platform:** Deplexo
- **Repository:** TheTavern001/gaming-hub-2
- **Production branch watched by Deplexo:** `qa/gameplay-distinctness-and-collision-20261013`
- **Production SHA:** `278af07`
- **Auto-deploy on push:** OFF (intentionally)
- **App state:** Running
- **Created:** Oct 3, 2026
- **Deployments:** ~20
- **Build method:** Dockerfile
- **Root directory:** `.`
- **Persistent storage:** `/data`
- **Working branch:** `progress/finish-gates-and-polish-20261015`

### Catalog Reality
- Registered games: ~87–93 (13 core + ~80 library)
- Independently AAA / device-certified: **0**
- Official prize games: fail-closed until certified
- 500+ quality goal: held until existing catalog is reviewed and pipeline protects quality

### Major Open Gates
- Device QA (Android/desktop FPS, touch, visual sign-off) incomplete
- No approved 3D wearable meshes or certified neutral avatar starter
- Anti-cheat / signed-run replay for prizes not complete
- Docker + isolated HTTP, SQLite, backup/rollback, private-preview not fully proven for new candidates
- Stripe payments not proven end-to-end
- Draft PR #29 (five-release overhaul) exists — do not merge to production

---

## 2. AAA Vision (Phone-First, 99% Mobile)

The hub must feel like one premium product.

### Visual Identity
- Deep black / near-black + electric neon
- Soft bloom and volumetric-style light shafts / glowing gradients
- Ambient particles (motes, embers, highlights)
- Consistent readable typography and iconography
- Clear silhouettes and high contrast

### Lobby & Flow
- Cinematic first screen with giveaway countdown, featured carousel, avatar preview
- Smooth transitions, large touch targets, safe-area aware
- Unified look across lobby, games, shop, seasons, giveaways

### In-Game Feel
- Readable in first 10 seconds, skill expression after
- Strong juice (hit flash, light shake, floating score pops, trails)
- Tight touch controls, clear pause/restart
- Server-validated scoring
- Stable 30–60 fps, no thermal issues

### Premium Systems
- Free meaningful face/basic avatar customization
- Cosmetics that look intentional (no pay-to-win)
- Ceremonial, transparent giveaways
- Season tracks and quests that reward cosmetics only

---

## 3. Design Principles
1. Art direction over raw fidelity
2. Readability on small screens first
3. Performance is part of quality
4. Juice creates the expensive feel
5. One cohesive product
6. Trustworthy scoring and giveaways
7. Original games only — no close commercial clones

---

## 4. Free Asset Sources (Commercial-Safe)
Always verify license and credit in `CREDITS.md`.

| Source | Best For | License | Link |
|--------|----------|---------|------|
| Kenney.nl | UI, sprites, audio, particles | CC0 | https://kenney.nl |
| Quaternius | Low-poly 3D characters, vehicles, environments | CC0 | https://quaternius.com |
| Poly Haven | PBR textures, HDRIs, models | CC0 | https://polyhaven.com |
| OpenGameArt | Sprites, tilesets, audio | Mixed | https://opengameart.org |
| itch.io free | Assets, VFX, UI | Mixed | https://itch.io/game-assets/free |
| KayKit | Stylized 3D kits | CC0 / free commercial | https://kaylousberg.itch.io |
| freesound | Sound effects | Check | https://freesound.org |

---

## 5. Path to Large Catalog & AI Acceleration

There are no 500 free polished AAA commercial games available for legal use.  
Close clones are not acceptable.

**Realistic approach:**
- Certify and polish the existing catalog first
- Build original short arcade, puzzle, runner, timing, and skill games
- Use shared systems (juice, scoring, UI, avatar) for consistency and speed
- Scale with CC0 assets + genre templates
- Hundreds of registered games is achievable; hundreds of certified giveaway-ready games is multi-year

### AI Tools for Original Prototypes
| Tool | Output | Link |
|------|--------|------|
| Rosebud AI | 2D/3D browser games | https://www.rosebud.ai |
| Chatforce | 2D/3D + art/audio | https://chatforce.com |
| OpenGame | HTML5 & 3D prototypes | https://opengame.app |
| Voidless | Godot / Phaser agent | https://voidless.dev/game-agent |
| GDevelop + AI | Visual + HTML5 export | https://gdevelop.io |

### Engines
- Phaser: https://phaser.io
- Godot: https://godotengine.org
- PixiJS: https://pixijs.com

### Open-source references (license-check required)
- https://github.com/attogram/games
- https://github.com/michelpereira/awesome-open-source-games
- https://trilarion.github.io/opensourcegames/

---

## 6. Hard Rules
- Auto-deploy stays OFF until explicit owner approval of a controlled SHA
- No AAA claims without device evidence
- No unlicensed or close commercial clones
- Preserve score integrity and fail-closed prize gates
- Credit all assets
- Owner device QA required before public certification

---

## 7. Immediate Priorities
1. Apply neon lighting, particles, and juice to lobby and featured games
2. Generate original short prototypes with AI tools and restyle with CC0 assets
3. Integrate only after mobile controls, performance, and scoring are solid
4. Device-test and document in small batches
5. Advance private-preview and anti-cheat readiness
6. Controlled redeploy only when a fixed SHA is ready

---

## 8. Existing Key Files
- `public/js/juice.js` — shared juice helpers
- `docs/audit/` — journals, QA trackers, remaining-work notes
- Draft PR #29 — five-release program (do not merge yet)

This single document replaces the previous separate handoff and status files. All prior Trap Tech Gaming Hub context is contained here.
