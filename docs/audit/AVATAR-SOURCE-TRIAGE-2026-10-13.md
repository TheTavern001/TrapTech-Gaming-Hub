# Avatar and shop source audit — 2026-10-13 (draft-branch checkpoint)

**Status: SOURCE-REVIEW ONLY — NOT AAA-APPROVED, NOT DEPLOYED.** This is a defect register, not a claim that the new avatar or shop visuals are finished. No Android frame captures or interactive browser tests were run in this checkpoint.

## Findings by source

| Area | Source evidence | Disposition | Why it matters |
| --- | --- | --- | --- |
| Shared starter | `src/avatars.js` defines one `STARTER_AVATAR`: other / adventurer outfit / no headwear, accessories or handhelds; choice is male, female, other | **KEEP ARCHITECTURE; VERIFY RENDER** | Existing accounts and paid cosmetics must never be reset; all new accounts begin from the same baseline tier |
| Licensed rigged starter | `public/js/avatar-rig.js` loads local male/female Quaternius `.gltf` files, has idle animation, shading and adaptive pixel ratio | **REWORK / TEST** | Good source-art starting point but browser/physical-device visual quality is unverified |
| Other presentation | `avatar-rig.js` chooses the female rig only for `gender === 'female'`; other choices load male | **REWORK** | “Other” currently maps to male art, not an independently reviewed neutral presentation |
| Wardrobe coverage | `public/js/avatar-3d.js` only accepts outfit `adventurer`, no hat/accessory/held, and particular hair, face, eyes, mouth, beard for licensed rig mode | **BLOCKER / REWORK** | Most alternative wardrobe selections fall back to a simple code-generated character |
| Unported cosmetic previews | `public/js/avatar-3d.js` renders primitive meshes when rig support is unavailable; `avatar-editor.js` labels these as “Compatibility preview · rigged wardrobe asset pending” | **BLOCKER / REWORK** | Legacy bobble/simple 3D look survives, inconsistent with owner's requested quality |
| Model attachments | `public/js/avatar-rig.js` presently does not read/equip `cfg.hat`, `cfg.outfit`, or `cfg.held` | **BLOCKER / REWORK** | Cannot claim the licensed rig has accurate multi-slot 3D cosmetics |
| Preview vs persisted avatar | `public/js/avatar-editor.js` previews locally, while `src/avatars.js` checks server ownership on save | **KEEP ARCHITECTURE; TEST** | Do not bypass server ownership or mislabel visual compatibility as a finished item |
| Profile effects / cosmetics | `src/shop-gen.js` builds stable deterministic CSS/SVG banners, frames, effects, titles and badges | **KEEP ENGINE; REWORK ART / TEST** | Generated color/effect variants must not be described as 1,000+ distinct source-quality 3D cosmetics |
| Shop asset sourcing | `docs/AVATAR-CATALOG-SHARED-GAMES-AAA-AUDIT.md` lists Quaternius, Kenney, KayKit and other possible licensed sources | **INTAKE / PROVENANCE REQUIRED** | Verify exact downloaded files, attribution and commercial rights per item; never assume a proposed source is integrated |

## Locked implementation priorities

1. **Do not remove existing ownership, saves or purchases.** Migrate visual rendering and add versioned rig/outfit attachments around the existing ID model.
2. **Replace the procedural bobble fallback**, not merely repaint it. Build an audited rig/material pipeline with actual independently licensed modular clothes/props compatible with the same humanoid skeleton. Until that exists, flag unsupported visual combinations rather than claiming they render accurately.
3. Verify the same base character quality for male, female and other presentation choices. Add an independently reviewed third presentation or allow a deliberately neutral choice using the same compatible base, without presenting the male rig as a different sourced model.
4. Source-license pilot: one common starter outfit + one alternate top/bottom or unified garment + hat + handheld + accessory, with real attachment anchors and item-by-item art provenance. Confirm drag rotation, idle, turntable, clipping, saved profile and mobile 60 FPS.
5. After the pilot, expand clothing slots to hair, hats, tops, bottoms, shoes, accessories, handhelds, effects, backgrounds and profile embellishments. Validate compatibility combinations and inventory lock state.
6. **A player's purchases must never change hitboxes, score, speed, competition entry, or game difficulty.** Offer the same unlocks via gameplay or optional purchase when intended; distinguish limited prestige art from pay-to-win.
7. Record source SHA, rights, physical Android + desktop captures, p50/p95 frame times, and owner approval for each accepted visual family. Incomplete or unrendered wardrobe items remain REWORK even if the API functions.

## Other locked audits before 500 expansion

- Verify mobile header cropping at 320/360/390/768px. Branch PR #10 has a source-level responsive header replacement using `traptech-app-icon.svg`; **not yet browser or owner verified**.
- Play through all 13 active core + 80 Games Library titles before approving expansion. Dispositions must be KEEP, REWORK, REMOVE, or REPLACE LATER with reasons and evidence. Structural checks do not establish AAA visual quality.
- Shop/achievement/payments/persistence/leaderboard/giveaway tests need fresh evidence and no advantage-bearing cosmetics.
- Deplexo failed image builds must first be traced to their actual Docker error. See issue #11 and the deployment journal.
- The 500 title target counts only entries explicitly quality-approved by `tools/quality-readiness.js`, not 93 present registry rows.

**Resume from:** source commit `2fc38b3` on `audit/phase1-brand-qa-ledger-20261013` plus issue #11. Next implement the real rigged-wardrobe pilot after stabilizing Deplexo; do not infer a successful deployment from branch code.
