> Historical R1 trigger record. It does not authorize a new deployment. Follow the latest owner request and PRIVATE-CANDIDATE-2026-10-16.md; automatic deployment remains off pending controlled private review.

# R1 / 5 — Deplexo private release: single triggered build
Date: 2026-10-15

Existing application: glassy-drifter-9532 (20e0c3e0-87bf-4d2f-8c25-5e41401a5121)
User reports: AUTO DEPLOY ON PUSH is enabled. Authenticated setting not independently accessible here.
GitHub target source ref: qa/gameplay-distinctness-and-collision-20261013
Prior GitHub source checkpoint: 0ff73e6626be974c78bad7e40563dbd0b6b4f8ef
Scope: ONLY R1 private preview; no public activation, paid giveaways, prizes or store purchases.

This file records the sole R1 release-triggering branch push. Do not push additional release commits while its status is unknown. A GitHub push is NOT proof Deplexo queued or completed the build.

R1 content: already-staged 13 core + 74 playable library game source and shared-engine deep audit; six archived duplicates excluded; deterministic wind/AI, Goo Tower mobile touch cancellation, gated imported game starts, server-side prize proof holds, Docker HTTP/SQLite and security tests, optional separate full 87-browser QA runner.

The user wants approximately five sequential releases, one at a time. Several changes are already in the candidate source, so later releases are quality/acceptance iterations, NOT isolated reconstruction of previously bundled commits.

R1 advancement requires: actual Deplexo checkout of THIS new trigger commit SHA (compare with GitHub), final deployment SUCCESS/READY; Docker preflight and smoke complete; correct /healthz and /api/build fingerprint; private guest 503 checks; owner sign-in success; SQLite /data continuity and backup verified. The full 87-title browser/device/replay tests must be recorded separately and NOT inferred from Docker success. On failed R1, correct first failure and issue just one recovery commit, not R2.

R2 graphics, game collisions, control/asset upgrades after R1 host READY. R3 avatar/shop/quests/UI after R2 READY. R4 settlement security, load/replay and mobile resilience after R3 READY. R5 full device, security and QA certification gates after R4 READY. Start expansion to 500 only after owner-approved, individually verified existing catalog.

Existing secrets, private review environment, 21+ gate, /data mount, and paid-prize hold must remain unchanged.

Historical FAILED entries are diagnostic deployment history, not permanent CURRENT failures. Deplexo public API documents reading history but no per-deployment delete; never delete/recreate this app solely to hide old failures because app deletion destroys its data volume. Retain chronological failure and recovery evidence.
