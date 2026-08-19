# Phase A Implementation — Context-Estimate Correctness

**Date:** 2026-08-18
**Branch:** web-context-estimate
**Machine:** Dans-MacBook-Air

## Summary

Implemented the full Phase A plan ([`../plans/20260817_phase_a_context_estimate_correctness.md`](../plans/20260817_phase_a_context_estimate_correctness.md), issue #2) with strict TDD: all failing tests written and committed first, then four implementation commits, each landing when its test cluster went green. The suite grew from 47 to 78 tests; CI (Node 22 + 24) is green on push.

Session also did housekeeping: moved the branch out of the main worktree into `.worktrees/web-context-estimate/` (per the worktree/main invariant — the main worktree is back on `main`), carried over the prior session's uncommitted `manifest.json` comment via stash, and verified PR #1 (add-test-suite) is still open, so no rebase happened.

The estimator now: scales the mini-bar to the model's context window (looked up from the conversation's `model` string), counts images and unextracted documents via heuristics, applies the ×1.2 tokenizer calibration once to the trunk text sum, warns in red at ≥85% of the window, refreshes at generation end (no navigation needed), and discloses all of this in the tooltip. All calibration constants remain provisional pending Phase B (issue #3) empirical data.

## Topics Explored

- TDD RED/GREEN cycle over four clusters: models lookup, tokens media+calibration, bridge `cc:generation_end`, UI threading.
- Subagent test-quality review before GREEN; its findings applied (one non-discriminating cache test removed, warn-color test strengthened, content-block-document behavior pinned to 0).
- Userscript divergence: the plan cited commit `d9d9798` as precedent for updating the userscript, but that commit had left the userscript untouched. Ported Phase A into the userscript anyway so that install path doesn't ship a wrong 200K scale.

## Provisional Findings

- `computeConversationMetrics` now returns `{textTokens, mediaTokens, totalTokens, model, ...}` — `textTokens` is the raw o200k sum (what the cache stores), `totalTokens` the calibrated display total `⌈text×1.2⌉ + media`.
- Sum-then-calibrate (not per-message) is locked in by test; media heuristics are already Claude-token-scale and are deliberately not calibrated (double-count trap).
- Image fallback without dimensions = 1600 tokens (the cap) — conservative-by-design choice made this session; plan had left the value open.
- jsdom test harness notes: `ui.js` needs a `CC.waitForElement` stub (lives in `main.js`), and per-test `CounterUI` instances must have their `domObserver` disconnected or teardown throws.

## Decisions Made

- SSE tests live in a new `tests/bridge-sse.test.js` rather than extending `bridge-protocol.test.js` (that file's contract is "fake page side, real client"; loading the real injected script there would invert it).
- Userscript gets the Phase A port by hand (see above); a build step generating it from `src/` is a candidate follow-up task.
- Model string source: `conversation.model`, `null` when absent → 200K default.

## Results

- No analysis artefacts; deliverable is code. Commits `8f78f29` (RED), `45b42f3`, `5e6e8df`, `0c21c31`, `9893d95`, `1734989` (GREEN clusters). 78/78 tests, CI green.

## Open Questions

- **Real `model` strings still needed** — all model-id fixtures are marked `// FIXTURE-PROVISIONAL`; Dan to capture a conversation GET.
- **Plan step 16 (real-app verification) not done** — needs Dan's browser: header renders on current DOM? number ≈ old×1.2? bar scale matches model? count updates after send without navigating?
- ×1.2, media heuristics, and the 85% threshold await Phase B (issue #3) empirical data.
- Whether a ~95% escalation tier is wanted on top of the 85% red fill.
- Userscript has no test coverage (self-contained copy); consider a build step.
