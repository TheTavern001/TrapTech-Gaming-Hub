# Avatar Source Audit — Existing 3D Viewer and Remaining Work

## Correction to the previous gap note
The repository already contains a genuine WebGL avatar preview implementation:
- `public/js/avatar-editor.js` mounts the interactive preview and provides an SVG preview fallback.
- `public/js/avatar-3d.js` dynamically imports Three.js version 0.180.0 from jsDelivr, creates a WebGL scene, renderer, lighting/shadow configuration and touch-draggable preview.
- `src/avatars.js` remains the server-side source of allowed part IDs, avatar save validation, ownership checks and Hub Crowns purchase validation.

Therefore, it would be inaccurate to say that no 3D avatar implementation exists. The correct status is: **a prototype 3D viewer exists; parity with the requested fully customizable, polished avatar product is not yet verified.**

## Implementation update — 2026-10-12
The avatar preview now has explicit zoom-in, zoom-out and reset-view controls, plus keyboard rotation (arrow keys or A/D), zoom (+/−) and reset (0). The WebGL canvas is keyboard-focusable and exposes the control instructions in its accessible label. Drag-start now synchronizes with the current auto-rotation to avoid a jump when the user begins rotating. The editor also has a randomize-owned-parts shortcut and a reset-to-base action; neither grants ownership of locked items. Named saved looks are now stored per account on the server (up to 12), with ownership validation on save/apply, case-insensitive name upsert, apply-to-profile and delete actions. API regression tests cover the saved-look lifecycle and locked-item rejection. The browser E2E suite now exercises the randomize/reset controls, WebGL zoom controls when available, SVG fallback, and save/apply/delete saved-look flow; it still needs an actual browser run.

This is source-level implementation only. The interactions still need real browser, touch, keyboard, reduced-motion and WebGL-fallback testing before the avatar acceptance gate can be marked complete.

## Source-level risks and unknowns
1. **Runtime dependency:** Three.js is loaded from a public CDN at runtime. The editor may fall back when import fails, but offline startup, CSP compatibility, CDN availability, privacy implications and version integrity need explicit testing. Consider pinning and bundling the exact approved dependency after checking repository/build constraints.
2. **Art direction:** procedural or primitive meshes and material styling can demonstrate customization but do not automatically deliver the screenshot's premium character-art quality. Inspect the full mesh construction and real-device renders before deciding whether to rebuild the model pipeline.
3. **Base presentations:** inspect and test whether masculine, feminine and androgynous/neutral base choices are explicit, equal-status and compatible with every clothing/hair/accessory category. Do not infer this from the existence of a body or face category alone.
4. **Customization depth:** verify face shape, proportions, hair style/colour, clothing layers, footwear, accessories, saved looks, randomize/reset, animation/pose preview, zoom and profile identity persistence. Record implemented vs missing rather than counting palette changes as deep customization.
5. **Touch interactions:** touch-action pan-y and drag-to-rotate must be tested to ensure the avatar can rotate without making the page scroll unusable; add explicit zoom controls and keyboard alternatives if missing.
6. **Server authority:** keep the existing server allow-list and ownership validation authoritative. Test malformed JSON, unknown IDs, cross-rig combinations, unauthorized locked items, repeated purchase requests, balance rollback and account switching.
7. **Fallbacks:** verify SVG fallback, reduced-motion handling, WebGL unavailable, context loss, low-memory devices, slow mobile data, screen-reader description and resize/orientation changes.
8. **Asset rights:** inspect every mesh/texture/material/animation/font and third-party dependency. Use an asset manifest with source URL, author, license, attribution, modification rights and exact file/hash. Do not treat a generic repository licence as proof that externally sourced assets are covered.

## Automated check status
At the time of this audit, the latest commit's GitHub Actions runs show failures in:
- Games Library browser smoke tests
- Games Library static checks
- V1 launch syntax checks

The available workflow/job summary does not expose the failed step output through the current log fetch. These failures remain unresolved. Do not merge or publish based on a green assumption; retrieve logs in GitHub Actions and repair the actual failing checks.

## Acceptance criteria for avatar completion
- Three starting presentations are explicit, visually complete, equally customizable and reversible.
- Full-body 3D preview has tested orbit/zoom, responsive resize, stable lighting/materials, idle/pose preview and touch-friendly controls.
- Customization categories work together without broken clipping, gaps or incompatible equipment.
- Save/reload survives logout/login and is consistent on profile cards, leaderboards and event pages.
- Locked items cannot be equipped or purchased without a valid server-side entitlement; repeated purchases are idempotent and balances remain correct.
- The avatar works with WebGL disabled, CDN unavailable, reduced motion and low-performance mobile fallback.
- Real Samsung Android tests and desktop tests include screenshots/video, load time, frame pacing, memory/thermal observation, orientation changes and error recovery.
- All art/dependency rights are recorded and reviewed.

## Scope
This is a source audit and correction of project status, not a claim that these acceptance criteria have passed. No production deployment or live data change was performed.
