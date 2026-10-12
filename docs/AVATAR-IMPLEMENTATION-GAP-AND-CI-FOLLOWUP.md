# Avatar Implementation Gap and CI Gate — Follow-up

## Current implementation found in source
The existing avatar module is `src/avatars.js`. It stores a JSON object of part IDs in the user record and renders a small server-generated SVG at `/avatar/<username>.svg`. It supports server-validated part ownership and a Hub Crowns purchase route. This is a useful existing cosmetic foundation, but it is **not** the requested interactive 3D avatar experience.

## Gap versus the owner’s target
- Current rendering is 2D SVG, not a rigged 3D model.
- Existing part categories and constraints are implementation-defined; they do not establish a modular humanoid rig with interchangeable clothing, hair, body presets and accessories.
- No evidence yet shows the three equal-status masculine/feminine/androgynous starting presets, full-body rotate/zoom, lighting/material controls, animation previews, saved looks, or robust compatibility checks across cosmetic combinations.
- Existing Hub Crowns and cosmetics need to remain cosmetic-only, server validated and separate from competitive scoring.
- The screenshot is a style reference only. Do not reproduce its character, distinctive interface, logos or proprietary assets.

## Recommended implementation boundary
1. Keep the existing SVG endpoint as a lightweight fallback for older devices, social previews and surfaces that cannot render 3D.
2. Add a dedicated avatar-customizer route/view, not an untested replacement of the existing profile.
3. Introduce a versioned avatar schema that references allow-listed body preset, rig, skin/material, face, hair, clothing, accessories, emotes and loadout IDs. The server remains authoritative for ownership and unlock state.
4. Select a licensed, redistributable base rig and modular asset pipeline before coding the viewer. Record provenance per mesh, texture, animation, sound and font. Do not bundle assets solely because they are downloadable.
5. Build an interactive 3D preview with a conservative mobile performance fallback. Prefer a locally bundled, pinned renderer/library only after checking repository dependency/security/licensing and offline behavior.
6. Migrate old avatar JSON through a compatibility adapter; keep current avatar URLs and stored parts valid until migration tests pass.
7. Add tests for invalid part IDs, mismatched rig attachments, unauthorized cosmetics, purchase replay, balance rollback, save/load, account switching and reduced-motion/fallback mode.

## Release gate evidence
The implementation is not complete until screenshots/video, real-device tests, performance data, asset provenance and automated security/regression tests exist for the exact release candidate.

## CI finding on current audit branch
GitHub Actions run `38178774710` for commit `55b1716d0c8367a82e7239bce3b2216e3724953f` reports the `V1 launch syntax checks` workflow failed in job `syntax`. The available job summary did not identify a failed step, so the cause is **unresolved** and must be inspected from the run logs or reproduced locally before this branch is considered green. Do not mark the release gate as passed on the basis of the documentation commits.

## Scope disclaimer
This document records findings and a safe implementation plan. It does not implement the 3D avatar, does not prove current game quality, and does not authorize production deployment.
