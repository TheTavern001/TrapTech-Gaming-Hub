#!/usr/bin/env bash
# Offline release verification without GitHub Actions, Deplexo deployment,
# payment credentials, production accounts or /data. Complete checkout needed.
set -u -o pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
release="${1:-R1}"
case "$release" in R1|R2|R3|R4|R5) ;; *) echo "Usage: scripts/offline-release-gate.sh R1|R2|R3|R4|R5 [--docker]" >&2; exit 2;; esac
do_docker=false
[[ "${2:-}" == "--docker" ]] && do_docker=true
run_id="$(date -u +%Y%m%dT%H%M%SZ)"
report="${REPORT_PATH:-${TMPDIR:-/tmp}/traptech-release-${release}-${run_id}.log}"
tmpdir="$(mktemp -d "${TMPDIR:-/tmp}/traptech-gate-XXXXXX")"
trap 'rm -rf "$tmpdir"' EXIT
{
  printf 'Trap Tech OFFLINE only — NEVER a Deplexo deployment\n'
  printf 'DateUTC: %s\n' "$(date -u +%FT%TZ)"
  printf 'Release: %s\n' "$release"
  printf 'Git source HEAD: %s\n' "$(git rev-parse HEAD 2>/dev/null || printf UNKNOWN)"
  printf 'Production host: NOT TESTED HERE. Deplexo screenshots and actual current SHA require separate confirmation\n'
  printf 'Device Android/iOS: NOT TESTED HERE\n'
} > "$report"
fail=0
run() {
  local label="$1"; shift
  echo "TEST $label ..." | tee -a "$report"
  if "$@" >> "$report" 2>&1; then
    echo "PASS $label" | tee -a "$report"
  else
    local code="$?"
    echo "FAIL $label exit=$code" | tee -a "$report"
    fail=$((fail+1))
  fi
}
if ! command -v node >/dev/null 2>&1; then
  echo "FAIL Node.js missing; local audit cannot run" | tee -a "$report"
  exit 1
fi
run node-version node --version
run post-r1-failed-build-evidence node tools/test-post-r1-build-evidence.js
run docker-build-audit-context node tools/test-docker-audit-context.js
run qa-browser-runtime-integrity node tools/test-qa-browser-runtime-integrity.js
run qa-mobile-frame-pacing node tools/test-qa-frame-pacing.js
run r2-unified-release-candidate node tools/test-unified-release-candidate.js
run r1-incident-gate node tools/test-r1-incident-gates.js
run r1-test-qa-87-browser-contract node tools/test-qa-87-browser-contract.js
run r1-test-qa-game-batches node tools/test-qa-game-batches.js
run r1-test-traptech-pwa-icons node tools/test-traptech-pwa-icons.js
run r1-test-audit-game-runtime-paths node tools/test-audit-game-runtime-paths.js
run r1-test-config-secret-preflight node tools/test-config-secret-preflight.js
run r1-test-prelaunch-imports node tools/test-prelaunch-imports.js
run wallet-source-syntax node --check src/unified-wallet.js
run wallet-native-sqlite node tools/test-unified-wallet.js
run reward-hold-clawback node tools/test-reward-integrity.js
run payment-settlement-proof node tools/test-payment-settlement-proof.js
run payment-quoted-order-integrity node tools/test-payment-order-snapshots.js
run account-session-revocation node tools/test-session-revocation.js
# Real HTTP auth/session integration is intentionally run by Docker STEP12
# with BUILD_SMOKE=1 on localhost only; it refuses execution otherwise.
run reviewed-wallet-cannot-be-spent node tools/test-reviewed-wallet-read.js
run full-meta-fairness node tools/test-full-hub-meta-contract.js
run game-owner-mechanics node tools/test-owner-reported-gameplay.js
run three-real-games node tools/test-three-gameplay-fixes.js
run mobile-phone-entry node tools/test-mobile-only-entry.js
run keep-guard-barracks-real-mechanics node tools/test-keep-guard-barracks.js
run td-keyboard-touch-parity node tools/test-td-keyboard-touch-parity.js
run load-harness-loopback-safety node tools/test-private-10k-harness.js
run deplexo-snapshot-boot-order node tools/test-deplexo-snapshot-boot-order.js
run private-review-access-controls node tools/test-private-review-access.js
run private-preview-image-mode node tools/test-private-preview-rehearsal-mode.js
run giveaway-payment-and-game-approval node tools/test-giveaway-booking-release-gates.js
run giveaway-stripe-provider-settlement node tools/test-booking-stripe-settlement.js
run sponsor-stripe-webhook-signature node tools/test-sponsor-webhook-signature.js
run booked-skill-winner-contract node tools/test-booked-skill-winner-contract.js
run booking-library-proposals node tools/test-booking-library-selection.js
run optional-sponsor-channel node tools/test-optional-sponsor-channel.js
run arrow-hero-swept-collision node tools/test-arrow-hero-swept-collision.js
run arrow-hero-hostile-projectiles node tools/test-arrow-hero-hostile-projectiles.js
run arrow-hero-postmove-contact node tools/test-arrow-hero-contact-after-move.js
run arrow-hero-room-reachability node tools/test-arrow-hero-room-reachability.js
run full-gameplay-distinctness node tools/test-owner-gameplay-distinctness.js
run cannabis-touch-and-gameplay node tools/test-cannabis-gameplay-qa.js
run grow-op-timed-difficulty node tools/test-grow-op-timed-difficulty.js
run grow-op-wave-catchup node tools/test-grow-op-wave-catchup.js
run grow-op-newborn-pests node tools/test-grow-op-newborn-pests.js
run grow-op-immediate-swat node tools/test-grow-op-immediate-swat.js
run grow-op-expiring-pest node tools/test-grow-op-expiring-pest.js
run grow-op-suspended-tab node tools/test-grow-op-suspended-tab.js
run kit-mobile-lifecycle node tools/test-kit-mobile-lifecycle.js
run kit-score-submit-error node tools/test-kit-score-submit-error.js
run kit-game-start-error node tools/test-kit-game-start-error.js
run kit-run-serial node tools/test-kit-run-serial.js
run kit-hidden-start node tools/test-kit-hidden-start.js
run private-preview-readiness node tools/test-private-preview-readiness.js
run private-review-access node tools/test-private-review-access.js
run private-preview-payment-lock node tools/test-owner-preview-payment-lock.js
run retired-duplicates node tools/test-owner-duplicate-retirements.js
run external-source-vehicles node tools/test-imported-kenney-cars.js
run neutral-rig-fingerprint node tools/test-neutral-avatar-source.js
run avatar-one-credits-wallet node tools/test-avatar-one-credit-wallet.js
run avatar-credit-spend-behavior node tools/test-avatar-credit-spend-behavior.js
run shop-wardrobe-integration node tools/test-shop-avatar-credit-integration.js
run complete-existing-game-review-register node tools/test-existing-game-review-register.js
run mobile-frame-allocations node tools/test-mobile-frame-allocation-regressions.js
run prize-score-fail-closed node tools/test-prize-score-proof.js
run candidate-admission-boundary node tools/test-game-candidate-queue.js
run deplexo-evidence-separation node tools/test-deplexo-release-evidence.js
run all-game-source-mechanics node tools/audit-full-game-mechanics.js
run prelaunch-static-imports node tools/verify-prelaunch.js
if "$do_docker"; then
  if command -v docker >/dev/null 2>&1; then
    run docker-full-build docker build --pull=false -t "traptech-local-audit:$run_id" .
  elif command -v podman >/dev/null 2>&1; then
    run podman-full-build podman build -t "traptech-local-audit:$run_id" .
  else
    echo "FAIL Docker/Podman not available; full image build NOT VERIFIED" | tee -a "$report"
    fail=$((fail+1))
  fi
else
  echo "BLOCKED Docker STEP11/STEP12 NOT RUN; source-only preflight is not a release verification" | tee -a "$report"
  fail=$((fail+1))
fi
# Actual owner/device acceptance, never bypassed just because source passes.
run "release-$release-readiness" node tools/preflight-manual-release.js "--release=$release" --require-ready
echo "TOTAL FAILED CHECKS: $fail" | tee -a "$report"
echo "Evidence file: $report"
if ((fail>0)); then
  echo "BLOCKED: Do not enable Deplexo automatic deployment or promote this SHA." | tee -a "$report"
  exit 1
fi
echo "LOCAL NODE AND CONTAINER TESTS GREEN; exact host readback, phone QA and owner approval still required." | tee -a "$report"
