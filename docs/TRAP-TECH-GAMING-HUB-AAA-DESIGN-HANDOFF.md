# Trap Tech Gaming Hub — AAA Design & Asset Handoff
**Date:** 2026-10-15  
**Focus:** Phone-first (99% Android + iPhone) premium giveaway gaming hub  
**Goal:** Make the hub and every game feel expensive, cohesive, and immediately impressive

---

## 1. AAA Vision for the Trap Tech Gaming Hub

The hub is a single premium product, not a menu of mismatched mini-games. On a phone it should feel alive, sharp, and intentional from the first second.

### Visual Identity
- Deep black / near-black base with electric neon accents
- Soft bloom, controlled volumetric-style light shafts or glowing gradients for depth
- Subtle ambient particles (light motes, soft embers, floating highlights)
- Consistent custom typography and iconography that stay readable on small screens
- High-contrast materials and clear silhouettes so everything reads at a glance

### Lobby & Navigation
- Cinematic first screen: animated hero area, live giveaway countdown, featured-game carousel, high-quality avatar preview
- Smooth transitions and micro-interactions on every interactive element
- Thumb-friendly touch targets, proper safe-area handling, no clutter
- One unified visual language across lobby, games, shop, seasons, and giveaways

### In-Game Feel
- Immediate readability in the first 10 seconds; skill expression afterward
- Strong juice on every meaningful action (hit flash, light screen shake, floating score pops, trails, combo indicators)
- Tight touch controls, clear pause/restart/goal states
- Server-validated scoring so leaderboards and official giveaways stay trustworthy
- Stable frame rate (target 60 fps where possible, solid 30 fps minimum) without thermal throttling

### Systems That Feel Premium
- Free, meaningful face and basic avatar customization that actually changes appearance
- Earned/purchased cosmetics (outfits, frames, banners, titles) that preview correctly and look intentional
- Clear, ceremonial giveaway presentation with transparent rules
- Season tracks, daily/weekly quests, and achievements that reward cosmetics only (no pay-to-win)
- Curated shop that feels high-quality rather than cluttered

---

## 2. Design Principles (Phone-First)

1. **Art direction over raw fidelity** — Consistent style beats mismatched high-poly assets.
2. **Readability first** — Silhouettes, color contrast, and clear feedback matter more on small screens.
3. **Performance is part of quality** — Smooth and cool phone > occasional high peaks that cause heat or stutter.
4. **Juice sells the feel** — Particles, lighting, and feedback create the “expensive” impression more than extra polygons.
5. **One product** — Lobby, games, avatar, shop, and giveaways must look like they belong together.
6. **Trust** — Official giveaways and leaderboards must feel legitimate and skill-based.

---

## 3. Free Asset Sources (Commercial-Safe)

Use these for UI, sprites, 3D models, textures, audio, and VFX. Always verify the exact license on the pack before use and credit in `CREDITS.md` even when not required.

| Source | Best For | License Notes | Link |
|--------|----------|---------------|------|
| **Kenney.nl** | UI packs, icons, sprites, audio, particles | CC0 | https://kenney.nl |
| **Quaternius** | Low-poly 3D characters, vehicles, environments | CC0 | https://quaternius.com |
| **Poly Haven** | PBR textures, HDRIs, models | CC0 | https://polyhaven.com |
| **OpenGameArt** | Sprites, tilesets, audio | Mixed (check each) | https://opengameart.org |
| **itch.io (free)** | Game assets, VFX, UI | Mixed (check each) | https://itch.io/game-assets/free |
| **KayKit** | Stylized 3D kits | CC0 / free commercial | https://kaylousberg.itch.io |
| **FreeSFX / freesound** | Sound effects | Check license | https://freesound.org |

**Recommended starting packs**
- Kenney UI Pack, Game Icons, Particle Pack, Audio
- Quaternius Ultimate Modular Characters / vehicles / nature
- Poly Haven concrete, metal, and emissive textures for neon environments

---

## 4. Free / Open High-Quality Games Suitable for Integration

These are not “AAA console titles,” but they are among the best free, legally usable games or engines that can be adapted into a polished hub experience. Prioritize ones with clear licenses, mobile-friendly controls, and distinct mechanics.

| Game / Project | Genre | Why It Fits | License / Notes | Source |
|----------------|-------|-------------|-----------------|--------|
| **Kenney game prototypes** | Various arcade | Clean, consistent art, easy to restyle | CC0 assets | kenney.nl |
| **Phaser examples / community games** | Arcade, puzzle | Web-native, mobile touch friendly | MIT / various | phaser.io / GitHub |
| **Open-source HTML5 games** (e.g. certain 2048, snake, breakout variants) | Puzzle / arcade | Simple to integrate and juice up | Check per repo | GitHub search “html5 game mit” |
| **Godot demo projects** (export to web) | Various | High-quality open demos | MIT | godotengine.org |
| **Three.js / WebGL showcases** | 3D mini-games | Good for avatar or garage-style experiences | MIT | threejs.org examples |

**Integration rules**
- Preserve or re-implement scoring so it remains server-authoritative for giveaways.
- Replace or restyle assets to match the hub’s dark neon identity.
- Add the shared juice layer (particles, flashes, score pops).
- Credit original authors in `CREDITS.md`.
- Do not ship unlicensed clones of commercial games.

**Priority for the hub right now**
1. Polish and unify the existing 80+ library games with free Kenney/Quaternius assets and juice.
2. Add 1–2 new high-quality open arcade or puzzle titles only after the current catalog has consistent visual and feedback quality.
3. Keep official prize games fail-closed until device QA and anti-cheat review are complete.

---

## 5. Immediate Next Steps

1. Apply the dark neon + volumetric-style lighting and ambient particles to the lobby.
2. Integrate the shared juice helpers into featured games (Terp Tapper, Drift Rush, Rail Rush, etc.).
3. Swap placeholder or low-quality art in priority games with Kenney/Quaternius CC0 assets.
4. Ensure every screen respects phone safe areas and large touch targets.
5. Update `CREDITS.md` with every new free asset used.
6. Keep auto-deploy OFF until a controlled private preview is ready for device review.

---

## 6. Success Criteria (Phone)

- Lobby looks sharp and atmospheric on a mid-range Android and recent iPhone.
- Featured games feel responsive with clear juice and no stutter.
- Avatar and cosmetics preview cleanly.
- Giveaway and leaderboard screens feel legitimate and exciting.
- Frame rate stays stable and the phone does not overheat during normal sessions.
- The entire hub feels like one premium product.

This document is the design and sourcing handoff. Visual approval, device FPS traces, and final giveaway certification still require owner review on real phones.
