# Owner prelaunch test — start here

This is the simplest safe path to test the current launch candidate without opening it to the public.

## Important status
The full automated browser audit completed successfully for all 100 catalog entries on the current branch, alongside syntax and static checks. This proves the test harness could load and exercise the catalog in an isolated CI environment. It does not prove that the games are AAA quality, bug-free, secure against every attack, or deployed to the live Deplexo URL. All 100 games remain NOT SIGNED OFF in the human QA tracker.

## 1. Open the current live site only to check the deployment
Current known URL: https://deplexo.com/apps/20e0c3e0-87bf-4d2f-8c25-5e41401a5121

This URL may still serve the previous deployed commit. Do not assume it includes the launch-candidate branch. If you do not see the changes, that is not a test failure—the branch must first be deployed to a private preview or a staging service.

## 2. Check the launch candidate in GitHub
- Pull request: https://github.com/TheTavern001/gaming-hub-2/pull/4
- Full 100-game automated audit: https://github.com/TheTavern001/gaming-hub-2/actions/runs/38158578751
- Syntax checks: https://github.com/TheTavern001/gaming-hub-2/actions/runs/38158578778
- Static checks: https://github.com/TheTavern001/gaming-hub-2/actions/runs/38158578856
- Browser smoke tests: https://github.com/TheTavern001/gaming-hub-2/actions/runs/38158578739

Keep the pull request in draft and do not merge it into production yet. The branch is a test candidate, not a launch approval.

## 3. Personal playtest order
Once a private preview of this branch is available, use your Android phone first:
1. Sign up or sign in with a test account. Do not use your only owner account for abuse testing.
2. Open the Games Library and test 5 different genres. For each game, test start, pause if supported, restart, game over, return to Hub, and score submission.
3. Try both touch controls and rotating the phone if the game claims to support landscape.
4. Open the avatar editor. Change body/build, face/skin/hair, outfit, headwear, accessory, held prop, and background. Save, reload, and verify persistence.
5. Open profile, achievements, quests, season pass, store, and giveaway pages. Verify all free games remain playable without buying anything.
6. Confirm every paid item is cosmetic/profile-only. Compare the same game and same conditions on free and paid accounts; no paid XP multiplier, score boost, extra attempt, extra entry, or easier eligibility is allowed.
7. Test checkout only with Stripe test mode once the owner has configured it. Never make a real purchase during QA.
8. Try expected-denial tests: modify a score request, replay a submission, alter a product price in browser tools, access a guessed admin URL, and submit a required giveaway checklist without completing it. The server must reject unauthorized changes.
9. Record each issue with game name, device/browser, steps, expected result, actual result, and screenshot/video. Do not publish a game that has a score/eligibility exploit, crash, or game-breaking control bug.

## 4. What must happen before you can test the new branch on a real page
The PR needs a private preview deployment. The currently known Deplexo link is not proof of a branch preview, and this repository workflow does not deploy the branch to Deplexo. Use a staging service with private access or a separate protected preview URL. Keep production database and payment credentials out of the preview; use a separate test database, dummy secrets, Stripe test keys, and no real wallet funds.

## 5. What you need to do
You do not need to code the integrations yourself. The remaining owner-side tasks are:
- Create/enable a private preview deployment and tell me its preview URL, or share the hosting provider name and the exact deployment screen you see (hide all secret values).
- Create a Cloudflare R2 bucket and add its credentials only to the host's private environment-variable panel, following docs/CLOUDFLARE-AND-PAYMENTS-SETUP.md.
- Configure Stripe in test mode using that same guide, then run purchase/cancel/refund tests.
- Review the per-game results and personally test the games on the preview before deciding which games to fix, replace, or temporarily disable.

Never send API keys, passwords, webhook signing secrets, Cloudflare secret access keys, or wallet seed phrases in chat or screenshots.
