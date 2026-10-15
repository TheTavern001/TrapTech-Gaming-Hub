# Deplexo AI-agent deploy and verification — existing Gaming Hub app only

## Why this exists

Deplexo publishes a first-party remote OAuth MCP endpoint at `https://deplexo.com/mcp` with agent tools `get_account`, `list_apps`, `get_app`, `redeploy_app`, and `get_deployment`. Documentation: https://docs.deplexo.com/guides/mcp/ . Cursor can read project-local `.cursor/mcp.json` (checked into this repository). This file contains **no credentials or tokens**.

**One-time setup, performed by the app owner in Cursor:** Open this repository in Cursor, open MCP settings, choose the Deplexo server and authenticate/approve with the browser OAuth flow. Reopen Cursor if it doesn't detect the project file. Confirm the Deplexo account is your own and the connected agent tools appear. Never paste bearer tokens or passwords into this repository or chat.

## Target and guardrails

- App: `glassy-drifter-9532`, existing app UUID `20e0c3e0-87bf-4d2f-8c25-5e41401a5121`.
- Deployment repository: private `TheTavern001/gaming-hub-2`. Both GitHub branches `main` and `qa/gameplay-distinctness-and-collision-20261013` are kept aligned by the release engineer.
- **Use `redeploy_app`, not `deploy_app`.** Do not create a second Deplexo app, clone its database or change volumes/domains.
- Deplexo persists SQLite at `/data`. Preserve existing `SECRET`/session/run keys, admin authorization values, environment configuration and mount. No credential rotation during release. The runtime `tools/prestart-db-snapshot.js` fails closed before migrations, but does **not** replace an independent off-host backup.
- Owner already reported `HUB_PRIVATE_REVIEW=1` and `HUB_PREVIEW_USERNAMES=<existing account>`; verify via authorized account if possible without disclosing usernames or secrets. Do not loosen guest restrictions in order to get a green test.
- Keep automatic deployments OFF. Keep new live purchases, prestige sales, paid events and prize awards OFF while R1-R5/security and individual game quality gates remain incomplete. Do not claim public readiness from a successful Docker build.
- Never report a GitHub push as a Deplexo deployment. Check the exact commit that the Deplexo build actually checked out. If the deployment checks out `570a9feba0f17aa1de120c67b57f3a8a6c0f5930` or `278af07ebfbc0eb2e783d8294cb1707c528c0163`, stop and reconcile its source ref before retrying.

## Agent's next task after account authorization

1. Call `get_account`, `list_apps`, `get_app`. Confirm the **existing** app UUID matches the one above, and identify its latest deployment SHA, status, and logs. Read `docs/DEPLOYMENT-JOURNAL.md` and `docs/audit/DEPLOYMENT-JOURNAL.json`.
2. Confirm source GitHub `main` and `qa/gameplay-distinctness-and-collision-20261013` are aligned and record the precise new HEAD. Deplexo must use that commit, not cached old `main`. Do not change the live env without the owner's explicit approval.
3. If the current host is still stale, call `redeploy_app` on this **existing app only**. Poll/read `get_deployment` for the new deployment ID; do not interpret "queued" or "building" as success. No automatic retry loops; resolve the first failing command in source, run source/Node verification, then retry once.
4. On READY, check `GET /healthz` (200), `GET /api/build` (build fingerprint), and `node tools/verify-private-preview-live.js` (guest restrictions). Test owner sign-in/Hub and game access only through an approved account session. Review `/data` continuity and snapshot without revealing account contents.
5. Run `tools/verify-live-deployment.js` against a locally isolated non-private smoke host when possible; it expects public `/` and `/api/*` routes and is **not suitable against guest-blocked owner-review mode**. Do not mark private mode broken just because generic public smoke receives 503 for private pages.
6. Record the exact Deplexo checkout commit, first failed command or READY evidence, build duration, host fingerprint, rollback, and Android/iOS QA results in both journals. No AAA approval without individual physical-device frame pacing, touch controls, collision/score integrity, anti-cheat replay, visual and accessibility reviews.

Release outcome categories must be distinct: `GITHUB_SOURCE_ONLY`, `HOST_BUILD_FAILED`, `HOST_READY_PRIVATE`, `ANDROID_GAME_ACCEPTED`, `PUBLIC_APPROVED`. Never silently promote one to another.

## References

- Deplexo agent/MCP OAuth setup: https://docs.deplexo.com/guides/mcp/
- Deplexo deployments and status: https://docs.deplexo.com/operations/deployments/
- Deplexo API/CLI alternatives: https://docs.deplexo.com/reference/user-api/ and https://docs.deplexo.com/guides/cli/

