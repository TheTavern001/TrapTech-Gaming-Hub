# Universal Game Integration Contract

## Product requirement
Every supported game should be launchable with one click from The Gaming Hub in a browser. Players should not have to download or install a game. Games may be original, licensed, hosted on a partner domain, or embedded from a provider, provided the provider's terms and technical capabilities allow the integration.

## Score access is not universal
A parent page cannot read arbitrary content inside a cross-origin iframe due to browser same-origin protections. A provider must support an approved score API/webhook, a documented SDK or postMessage protocol with server-verifiable evidence, or the game must be licensed for direct hosting and instrumented with the Hub adapter. A Hub-controlled remake is another option when its code and assets are original or properly licensed.

If no permitted, trustworthy score interface exists, the game can be offered as casual-only but must not be advertised as ranked or giveaway-eligible. Do not treat a number sent by an iframe as verified merely because the page sends it to the Hub.

## Integration classes
- **H1 — Server verified:** provider validates the result and supplies a signed/authenticated score receipt. Eligible for official giveaways only after end-to-end testing.
- **H2 — Hub validated:** game runs under Hub control with signed single-use sessions and server-side replay or event-log validation. Eligible only after its scoring rules are reviewed.
- **H3 — Provider reported:** an approved provider API/SDK reports a score but the Hub cannot independently replay the game. Public rankings may be possible with abuse controls; prize eligibility requires explicit risk review and adequate provider evidence.
- **H4 — Casual only:** no permitted, trustworthy score interface. One-click play may be supported if embedding/hosting is allowed, but no ranked score or giveaway eligibility is claimed.

The registry should record provider, canonical title, launch mode, integration class, score source, licensing/permission evidence, last verification date, giveaway eligibility and fallback behavior.

## Universal Hub play session
1. Require sign-in before a score counts. Casual preview may be available without sign-in but never counts as a giveaway entry.
2. Hub server issues a short-lived, single-use run session bound to player, game, event (if any), seed/version when available, and start time.
3. Launch the game without losing the Hub session or official event context.
4. Receive results only through an approved adapter. Treat browser messages, URL parameters, DOM text, client timers and client-supplied usernames as untrusted.
5. Verify scores with the appropriate policy; enforce bounds and duration rules, prevent replay/duplicate submission, and bind each record to the authenticated user and event.
6. Store a run ID, game/version, validation status, score, verified metrics, timestamps, event ID and evidence reference/hash where legally permitted.
7. Show a clear saved/rejected/casual-only status. A score is not leaderboard-qualified until validation completes.

## One clear #1 Player
- Publish the ranking rule before a competition begins: game, score metric, best-run or aggregate mode, start/end time, minimum requirements and eligibility rules.
- Use one authoritative server-side standings query and a stable documented comparator across live boards, final results, APIs and UI.
- Rank by the published primary metric. For ties, use only game-valid, server-verified skill metrics defined before the event.
- If predeclared skill metrics remain tied, start a sudden-death playoff with identical published conditions and a bounded window; repeat with a new common seed/round if still tied.
- Do not announce a winner while the event is open, a valid run is in progress, or pending score verification could change standings.
- At close, lock a final standings snapshot, record the comparator version, disqualifications and winner decision, and make the result auditable.
- If a provider cannot provide enough evidence for a deterministic winner, that game is not eligible for a prize competition until the gap is resolved.

A tie-break must not manufacture a false skill distinction. A timestamp or attempt-count rule is not a substitute for trustworthy skill verification when the promise is a unique skill winner.

## External provider requirements
Verify provider terms permit commercial embedding, public access, Hub branding, score collection, user tracking and prize competitions as applicable. Do not scrape scores, bypass frame restrictions, strip ads, spoof referrers, or proxy content to evade provider controls. Do not upload third-party game files to R2 without redistribution rights.

Use a sandboxed iframe with narrowly allowed capabilities. Validate event.origin, event.source, message schema, payload size, rate and session nonce for postMessage integrations. A valid origin proves which site sent a message, not that the score is honest. Never accept a score as verified based solely on a client-side message.

## Rollout and release gates
1. Inventory each catalog entry and classify it H1/H2/H3/H4. Catalog count is not the verified-playable count.
2. Verify launch path, mobile controls, resize/fullscreen, back/exit, loading/error states, score capture and provider permissions for every game.
3. Test expired/reused/cross-player/cross-game/cross-event tokens, forged scores, duplicate messages, invalid origins, score replay, late runs, ties and playoffs.
4. Only after successful tests, enable ranked and giveaway flags. Default unknown games to casual-only.
5. Use one-click launch and lazy-load only the selected game. Keep identity, event enforcement and standings on the Hub backend.

## Current implementation note
The current library uses same-origin HTML pages and a Hub adapter calling /api/run/start and /api/score. Existing documentation records 100 catalog entries, most not freshly verified, and many still at anti-cheat L2. Do not assume every current entry is already eligible for official giveaways. This contract defines the target; it does not claim all games already meet it.
