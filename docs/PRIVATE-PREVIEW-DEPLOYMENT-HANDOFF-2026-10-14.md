# Private preview deployment — evidence-required handoff

**Scope:** R1 private, restricted-access testing only. **Not public launch** and not approval of the 87-game catalog, 3D avatars, premium shop, prizes, payments, or 500-game roadmap.

## Current state
- Work source: `program/five-release-full-hub-overhaul-20261013` / PR #29.
- Production: **last owner-screenshot-confirmed** Deplexo deployment `278af07`; never infer a host deployment from a GitHub commit.
- Automatic deployment: **OFF**, deliberately.
- Running environment for this chat: Node 22 and Git available; **no Docker/Podman**; private GitHub clone fails DNS. Full repository testing **not performed here**.
- No safe R1 candidate SHA certified yet. Source changes committed but are not image or host evidence.

## Freeze, build, and verify

1. Select a specific **full 40-character SHA**, freeze commits on it, and fetch a clean local checkout of that ref (not a moving branch).
2. From the clean checkout with Node 20+ and a Docker-capable host, run:

```sh
git status --porcelain
node tools/release-status.js
node tools/preflight-manual-release.js --release=R1 --private-preview
node tools/offline-release-rehearsal.js --release=R1 --full
```

3. A full rehearsal is expected to flag missing owner/device acceptance even if source and Docker checks succeed; **inspect individual source tests, Docker build, isolated server and auth HTTP results separately**, rather than treating the overall blocked result as a compiler failure.
4. Independently capture `git rev-parse HEAD`, Docker image fingerprint, first startup logs, `/healthz` and `/api/build` response, runtime configuration validation, and **an off-host verified backup/restore** before the first production data migration.
5. Check all commercial and official-prize operations are blocked for unverified items. Do not test real purchases with real customer cards. Avoid enabling giveaway verification for uncertified games.
6. Only after the exact SHA and environment clear this predeployment review, arrange **one controlled private deployment** to the existing single Deplexo app. Keep the previous image available for rollback. The owner must explicitly change the Deplexo deployment setting; this note does not authorize toggling it.
7. Perform Android Chrome and iOS Safari/WKWebView acceptance on the deployed SHA: login/logout and session revocation, 21+ gate, navigation and repeated profiles, avatar GPU memory/fps, purchasing restrictions, at least one end-to-end sample run per mechanics family, score hold/rejection, rewards, and responsive safe-area/landscape checks. Log every failure and exact build fingerprint.
8. Fix/redeploy the tested R1 candidate if necessary; advance R2–R5 only with device and owner acceptance recorded. Public launch also requires all planned titles and payment/security gates independently certified.

## Existing Deplexo app, not a second test site

- The owner will review new features on the **existing** `glassy-drifter-9532.de.deplexo.com` app, in a *controlled first manual candidate deployment*. Do not create a second Deplexo app or tell the owner to install Docker.
- **PR #29 now targets `main`**, and remains **DRAFT / NOT MERGED**. This does not change production or the existing Deplexo auto-deploy setting.
- Before enabling any deployment, verify the **branch currently configured for the existing Deplexo app**. Owner history previously showed `qa/gameplay-distinctness-and-collision-20261013`; if still configured, merging to `main` will not by itself update that app. Choose the exact reviewed release commit/branch in Deplexo deliberately, never guess.
- Keep client-facing payments, booked giveaways, prize runs and exclusive sales blocked until verified. Source logic fails closed for unapproved prize-scoring titles and unpaid bookings, but Stripe/webhooks, native database integration and backup/rollback remain unverified.
- Deplexo is the only available Docker-capable integrated build path in this session: the assistant runtime has no Docker and cannot resolve github.com to clone the private repo. Treat Deplexo's first build as a **test of the candidate**, not prior proof it works. Capture actual build logs, release SHA/fingerprint and rollback state before promoting it to any clients.
- **Optional brand link policy:** only one non-required public HTTPS channel link inside a normal booked giveaway; no subscriber count, follower-gating claim, automatic platform verification or growth/time guarantee. This is enforced by `src/giveaway-linked.js` and `tools/test-optional-sponsor-channel.js`.

## Go/no-go decision

**NO-GO** until complete checkout + Docker/HTTP source build pass, backup/rollback verified, private controls locked down and reviewed, and exact deployment candidate SHA recorded. These are predeployment criteria. Postdeployment device tests are required before calling R1 owner-approved.

## How to report evidence

Record UTC timestamp, exact Git commit SHA, host/image IDs, every command and exit code, names of failing checks, HTTP responses, phone model/browser/OS, screenshots or traces, and owner approval in `docs/DEPLOYMENT-JOURNAL.md`. Never mark a pending or not-run check as passed.

## Resumption
Continue from this file and PR #29, not the screenshot-only production revision. First priority: arrange a complete checked-out Docker-capable test environment, collect full offline build evidence, then select the first restricted private deploy. Do not add another title or reopen automatic deployment merely because the repo has new commits.
