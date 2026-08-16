# Convo: upstream test suite implementation

**Date:** 2026-08-15 (session ran into 2026-08-16 UTC)
**Branch:** add-test-suite (docs on research-docs)
**Machine:** Dans-MacBook-Air

## Summary

Executed `plans/20260815_plan_upstream_test_suite.md` end to end. Forked
`she-llac/claude-counter` to `danparshall/claude-counter`, cloned to
`~/code/claude-counter-fork` (explicit path — APFS case-collision with the
copycat clone at `~/code/Claude-Counter`), and built the test suite on branch
`add-test-suite`: 47 tests, all green, across five cherry-pickable commits
(scaffolding / Tier-1 characterization / parser refactor+tests / CI /
cycle-guard fix). Opened **PR #42** to upstream:
https://github.com/she-llac/claude-counter/pull/42.

The plan's marquee bug candidate was confirmed: `buildTrunk` has no cycle
guard, so a cyclic `parent_message_uuid` chain loops the synchronous walk
forever (tab freeze). Because a busy sync loop can't be interrupted by an
in-process timeout, the probe runs in a child process killed after 2s — a
deviation from the plan's `it.fails` framing (see Decisions). The fix (a
visited set) shipped as the fifth, droppable commit, done red-green.

Dan approved "ship directly" on the PR-etiquette question (issue #41 had no
maintainer response at session time, checked), declined the browser smoke
check, and chose this `research-docs` branch as the docs home — the copycat
clone can't be pushed, and docs must not contaminate the PR branch.

## Topics Explored

- Loading IIFE + UMD sources in Vitest without a bundler (side-effect imports;
  the vendored o200k UMD sets the global even under Node — helper normalizes
  the export-capture case anyway)
- Observing cache hits behaviorally: remove the tokenizer global between
  computations — cached counts survive, recounts drop to 0
- jsdom's `event.source: null` postMessage limitation, sidestepped by
  hand-dispatching `MessageEvent` with `source: window` from the fake page side
  (which also made source-filtering directly testable)
- Child-process probing for synchronous-hang bugs (`spawnSync` + `timeout`)
- gh/git auth: credential-helper hang on HTTPS push; OAuth `workflow`-scope
  rejection for CI files; SSH push as the resolution

## Provisional Findings

- **Confirmed upstream bug:** `buildTrunk` cycle → infinite synchronous loop.
  Fixed in the PR's final commit (visited set); test asserts termination.
- Exact o200k characterization values locked in: "hello world"=2,
  quick-brown-fox=10, "cache me if you can"=5, "attached content"=2,
  "hello\nworld"=3.
- The `: countTokens(msgText)` fallback in `computeConversationMetrics` is
  unreachable — uuid-less messages can never join the trunk. Noted in PR as
  observation only.
- `src/vendor/o200k_base.js` references a missing `.js.map` → benign Vite
  ENOENT warning during test runs; left alone (vendored file).
- Dev-tooling Node floor is 22, not the plan's 20 (jsdom 30 requires ≥22.22);
  CI matrix runs Node 22/24.
- The userscript build is a self-contained copy (duplicates the parsers and
  format helpers) — left untouched, noted in PR.

## Decisions Made

- **Ship directly** (Dan's call on the plan's blocking Question 1); no
  ask-first comment on #41.
- **Cycle test uses plain `it` asserting current behavior**, not `it.fails`
  (subagent review finding: `it.fails` masks harness crashes and its
  semantics invert on fix). Pre-fix it asserted the hang; the fix commit
  flipped it to assert termination.
- **`format.test.js` skipped** (plan Question 2 default) — noted in PR as
  possible follow-up needing a `CC.format` refactor.
- **Smoke check declined by Dan**; substituted `node --check` on all shipped
  scripts + manifest JSON validation.
- **Docs live on this `research-docs` branch** in the public fork, cut from
  main, never merged into the PR. Copycat clone (`~/code/Claude-Counter`)
  retains the original untracked copies for now.
- Repo-local git tweaks in the fork: identity `Dan Parshall (air)`, credential
  helper `!gh auth git-credential` (repo-local to avoid writing through the
  dotfiles gitconfig symlink), remote switched to SSH (OAuth token lacks
  `workflow` scope; SSH pushes aren't scope-restricted).

## Results

- PR #42: https://github.com/she-llac/claude-counter/pull/42 (five commits,
  `8fc0b91..fa5c33e` on `add-test-suite`)
- Test suite: `tests/` on `add-test-suite` — 47 passing
- Subagent test-quality review: 6 actionable findings, all applied
  (child-process probe hardening, listener-assertion misattribution,
  `isolate: true` pin, comment fixes)

## Open Questions

- Will she-llac respond to #41 / #42? A hostile response converts the effort
  back to the standalone tested-rebuild (audit convo's Option A).
- Dan still owes the three abuse reports in `ABUSE_REPORTS.md` (~2 min).
- Delete the now-duplicated originals in `~/code/Claude-Counter`? (Needs
  Dan's explicit OK — deletion gate.)
- Future work if PR lands: `CC.format` refactor + tests, injected `bridge.js`
  fetch-patch tests, `main.js` orchestration tests with DOM scaffolding.
