# Trap Tech Gaming Hub — Consolidated Project Status & Memory
**Last updated:** 2026-10-15  
**Purpose:** Single source of truth capturing all prior decisions, current state, open gates, and requirements. Do not lose this context.

---

## Live Environment
- **Hub URL:** https://glassy-drifter-9532.de.deplexo.com/
- **Platform:** Deplexo
- **Repository:** TheTavern001/gaming-hub-2
- **Current production branch watched by Deplexo:** `qa/gameplay-distinctness-and-collision-20261013`
- **Current production SHA:** `278af07`
- **Auto-deploy on push:** OFF (intentionally left off)
- **App state:** Running
- **Created:** Oct 3, 2026
- **Deployments observed:** ~20
- **Last deploy:** ~1 day prior to 2026-10-15 screenshot
- **Build method:** Dockerfile
- **Root directory:** `.`
- **Persistent storage:** `/data`
- **Working progress branch:** `progress/finish-gates-and-polish-20261015`

---

## Catalog & Certification Reality
- Registered games: approximately 87–93 (13 core + ~80 library)
- Independently AAA / device-certified games: **0**
- Overlap clusters and distinctness reviews still required
- Official prize / giveaway games remain fail-closed until certification
- Expansion toward 500+ held until existing catalog is reviewed and pipeline can protect quality

---

## Major Open Gates (as of last full review)
- Real mobile/graphics sign-off, Android/desktop FPS + touch runs, physical device QA incomplete
- Shop, avatar, and cosmetics: no approved 3D wearable meshes or certified neutral starter; many cosmetic IDs are not real 3D assets
- Security / anti-cheat gates and signed-run replay for prize games remain fail-closed
- Full Docker image + isolated HTTP, native SQLite integration, backup/rollback, and private-preview gating not fully confirmed for new candidates
- Payments (Stripe) not proven end-to-end (signed webhooks, ledger settlement, refund handling)
- 500 quality-approved games far off

---

## Key Documents Already in Repo
- `docs/TRAP-TECH-GAMING-HUB-AAA-DESIGN-HANDOFF.md` — Full AAA vision, assets, AI tools, production path
- `docs/audit/FINISH-GATES-PROGRESS-2026-10-15.md`
- `docs/audit/FREE-ASSET-POLISH-PLAN-2026-10-15.md`
- `public/js/juice.js` — Shared non-scoring juice helpers
- Deployment journal, QA trackers, and numerous audit files under `docs/audit/`
- Draft PR #29 — Whole-Hub five-release program (do not merge to production)

---

## AAA Direction (Phone-First, 99% Mobile)
- Dark neon identity, volumetric-style lighting, ambient particles, strong juice
- Cohesive lobby → game → reward loop
- Tight touch controls, stable 30–60 fps, no thermal issues
- Original games only — no close clones of commercial titles
- Free CC0 assets (Kenney, Quaternius, Poly Haven, etc.) for polish
- AI tools (Rosebud, Chatforce, OpenGame, Voidless, GDevelop, Phaser, Godot) for accelerating original short prototypes
- Shared systems required for scale

---

## Hard Rules
- Keep auto-deploy OFF until explicit owner approval of a controlled candidate
- Do not claim AAA certification without device evidence
- Do not ship unlicensed or close commercial clones
- Preserve score integrity and fail-closed prize gates
- Credit assets even when CC0
- Physical device QA and owner visual sign-off required before public claims

---

## Immediate Priorities
1. Unify visual language and juice on existing featured games
2. Generate and integrate original short arcade/puzzle prototypes via AI tools + CC0 assets
3. Device-test and document results
4. Advance private-preview and anti-cheat readiness
5. Only then consider controlled redeploy of a fixed SHA

This file exists so no prior context, decision, or open gate is lost between sessions.
