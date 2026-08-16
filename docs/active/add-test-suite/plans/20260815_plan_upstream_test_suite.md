# Upstream Test Suite Implementation Plan

> **STATUS: EXECUTED 2026-08-15/16** — [PR #42](https://github.com/she-llac/claude-counter/pull/42), 47/47 tests green, cycle bug confirmed and fixed. Execution record: `../convos/20260815_upstream_test_suite_implementation.md`. Deviations from plan: Node floor 22 not 20 (jsdom 30); cycle probe uses a killable child process + plain `it` instead of `it.fails` (sync hang can't be interrupted in-process); smoke check declined by Dan, replaced with `node --check` + manifest validation. File relocated 2026-08-16 from the copycat clone root to this docs tree.

**Goal:** Fork `she-llac/claude-counter`, add a behavior test suite for its core logic, and PR it upstream.

**Originating conversation:** `../convos/20260815_claude_counter_zip_review.md` (originally sibling files in the copycat clone's root — that repo had no docs/ scaffold; it is a copycat clone we audited, not our project).

**Context:** The audit established that she-llac's extension is legitimate and well-written but has zero tests, no package.json, and no CI. The logic core (trunk reconstruction, token serialization, usage parsing, time math) is pure and eminently testable. A tested upstream benefits everyone downstream — including the fork ecosystem we mapped — and builds on the goodwill from issue [she-llac/claude-counter#41](https://github.com/she-llac/claude-counter/issues/41).

**Confidence:** High on the audit findings (hash-verified, code read in full). Medium on PR acceptance — the maintainer has never signaled interest in test tooling; mitigate by keeping the PR pure-additive and split into cherry-pickable commits.

**Architecture:** Source files are IIFEs attaching to `globalThis.ClaudeCounter` (no modules, no exports). Tests import them for side effects — `import '../src/content/constants.js'` executes the IIFE and populates the global — then exercise the public `CC.*` surface. No bundler needed. Vitest as runner (jsdom env only where DOM is touched). Two tiers: Tier 1 is pure-additive (touches no shipped file); Tier 2 is a minimal refactor exposing `main.js`'s private parsers for testing, as a separate commit the maintainer can drop.

**Branch:** `add-test-suite` in the fork `danparshall/claude-counter`. Working clone at `~/code/claude-counter-fork`.

**Tech Stack:** Node ≥20, Vitest (devDependency, pinned), jsdom via Vitest's environment option. No runtime dependencies added.

---

## Important machine gotcha

macOS APFS is case-insensitive. `~/code/Claude-Counter` (this copycat clone) already exists, so `gh repo fork --clone` defaulting to `claude-counter` would collide. Always clone to the explicit path `~/code/claude-counter-fork`.

## Characterization-testing caveat (read before implementing)

This is testing-after for existing code. The TDD discipline maps as follows: write every test from the *documented/intended* behavior (README + code reading) **before** running any of them. Then run the suite once.

- Tests that pass: locked-in characterization.
- Tests that fail: STOP. Each failure is either (a) your misreading — fix the test and note why, or (b) an upstream bug — do NOT "fix" the source to make it pass. Record it, keep the test marked `.fails` (Vitest `it.fails`) with a comment, and report it in the PR description.

Known bug candidate to probe deliberately: `buildTrunk` in `src/content/tokens.js` has no cycle guard. A parent chain `A → B → A` should hang. If confirmed, the test documents it via `it.fails`; offer the one-line fix (visited-set) as its own commit.

Tier 2 (parser exposure) is genuine red-green TDD: those tests fail until the refactor lands.

## Testing Plan

All tests exercise the real code loaded from `src/`, with the real 2MB vendored tokenizer — no mocking of the units under test.

**Unit tests — `tests/tokens.test.js`** (node environment):

I will test `CC.tokens.computeConversationMetrics` and its observable behavior through crafted conversation payloads:

- Trunk reconstruction: leaf-to-root walk selects the active branch, not abandoned siblings; empty `chat_messages`; missing `current_leaf_message_uuid` returns zero metrics; orphaned parent (chain breaks mid-walk) counts partial trunk; terminates at the all-zeros ROOT uuid; cycle in parent chain (expected upstream bug — `it.fails` guard with a timeout).
- Countable-content rules: `thinking`/`redacted_thinking`/`image`/`document` blocks contribute zero tokens; `text` blocks count; `tool_use`/`tool_result` serialize deterministically (two payloads with different key insertion order produce identical counts); attachment `extracted_content` counts.
- Token counting: known strings produce stable o200k counts (assert exact values from the real vendored tokenizer, e.g. `"hello world"`); empty/missing text → 0.
- Cache math: `cachedUntil` = last assistant `created_at` + 5 min; user-only conversation → null; multiple assistant messages pick the latest.
- Cache behavior with a stub bridge: provide `CC.bridge.requestHash` backed by `node:crypto`; verify a repeated message id with unchanged text returns the same count (cache hit) and a changed text re-tokenizes. Verify graceful fallback when the bridge is absent (hashing unavailable → still counts).

**Unit tests — `tests/parsers.test.js`** (Tier 2, node environment, written first and failing until refactor):

I will test usage-payload normalization for both wire formats:

- `/usage` REST shape: percentage clamped to [0,100] (inputs −5, 0, 42.5, 100, 250); non-numeric/missing `utilization` → window dropped; both windows missing → null; `resets_at` passed through only when a string.
- SSE `message_limit` shape: fraction ×100 (0.334 → 33.4); epoch-seconds `resets_at` → ISO string (assert exact conversion); missing `windows` → null; `5h`/`7d` keys map to `five_hour`/`seven_day`.

**Unit tests — `tests/format.test.js`** (Tier 2, needs `ui.js` helpers exposed OR tests via DOM; decide at implementation — see Questions):

- `formatSeconds`: 0 → "0:00", 61 → "1:01", 600 → "10:00".
- `formatResetCountdown` boundaries: past → "0m", 59 min, 60 min → "1h 0m", 23h59m, 24h → "1d 0h".

**Integration test — `tests/bridge-protocol.test.js`** (jsdom environment):

I will test the postMessage request/response protocol behaviorally: load `bridge-client.js`, fake the page side by listening for `cc:request` on `window` and replying with `cc:response`; assert `CC.bridge.request()` resolves with the payload, rejects on `ok: false`, times out when unanswered, and ignores messages lacking the `cc: 'ClaudeCounter'` marker or from other sources. This tests the real client code against the documented wire protocol — the fake replaces the *other process*, not the unit under test.

**Deliberately out of scope:** `main.js` orchestration (runs observers/intervals on import; not importable without DOM scaffolding claude.ai's markup), `ui.js` DOM injection (brittle against claude.ai markup; low value), the injected `bridge.js` fetch-patching (requires a live fetch environment; note as future work in PR).

NOTE: I will write *all* tests before I add any implementation behavior.

## Steps

### Phase 0 — Fork and scaffold

1. Run `node --version`; confirm ≥20. If absent, stop and ask Dan (brew install is an ASK-gated command).
2. Fork: `gh repo fork she-llac/claude-counter --clone=false`.
3. Clone explicitly: `git clone https://github.com/danparshall/claude-counter.git ~/code/claude-counter-fork`.
4. Set repo-local git identity: `git -C ~/code/claude-counter-fork config user.name "Dan Parshall (air)"` and email `parshall.dan@gmail.com`.
5. Create branch: `git -C ~/code/claude-counter-fork switch -c add-test-suite`.
6. Add `package.json`: name/private/type left minimal; `devDependencies: { "vitest": pinned exact }`; script `"test": "vitest run"`. No runtime deps.
7. Add `vitest.config.js`: default environment `node`; jsdom only via per-file `// @vitest-environment jsdom` pragma (avoids pulling jsdom into pure tests).
8. Extend upstream `.gitignore` with `node_modules/`.
9. `npm install`. Verify `npx vitest run` reports "no tests found".
10. Commit: `chore: add vitest test scaffolding (dev-only, no runtime changes)`.

### Phase 1 — Write ALL Tier-1 tests (no source edits)

11. Write `tests/helpers/load.js`: imports `constants.js`, vendor tokenizer, `tokens.js` in order; exports fresh-global helper and a conversation-payload builder (`makeMessage`, `makeConversation`).
12. Write trunk-reconstruction tests (branching, empty, missing leaf, orphan, ROOT termination).
13. Write the cycle-guard probe test with `it.fails` + 2s timeout + explanatory comment.
14. Write countable-content tests (excluded block types, tool block determinism, attachments).
15. Write exact-count tokenizer tests and empty-input tests.
16. Write cache-math tests (`cachedUntil`, latest-assistant selection).
17. Write token-cache behavior tests with the `node:crypto` stub bridge and the no-bridge fallback.
18. Write `tests/bridge-protocol.test.js` (jsdom pragma) per the testing plan.
19. Run the full suite ONCE. Triage per the characterization caveat above. Do not edit `src/` in this phase.
20. Commit: `test: characterization suite for token/trunk/cache logic and bridge protocol`.

### Phase 2 — Tier-2 red-green (parser exposure)

21. Write `tests/parsers.test.js` against a not-yet-existing `CC.parsers.parseUsageFromUsageEndpoint` / `parseUsageFromMessageLimit`.
22. Run; confirm all fail (red).
23. Refactor minimally: move the two functions from `main.js` into new `src/content/parsers.js` attaching to `CC.parsers`; `main.js` calls `CC.parsers.*`; add the file to `manifest.json` content_scripts BEFORE `main.js`; mirror the same ordering in `userscript/claude-counter.user.js` if it duplicates the parsers (check first — if the userscript is a self-contained copy, leave it untouched and note in PR).
24. Run; confirm green. Confirm Tier-1 suite still green.
25. Commit separately: `refactor: expose usage parsers as CC.parsers for testability`.
26. Decide `format.test.js` per Question 2; implement or drop.

### Phase 3 — Optional CI + PR

27. Add `.github/workflows/test.yml`: npm ci + `npm test` on push/PR. Separate commit (maintainers sometimes decline CI).
28. Sanity-check the extension still loads: Chrome → Load unpacked → `~/code/claude-counter-fork` → open claude.ai, confirm counter renders (manual smoke; Tier-2 touched runtime files).
29. Push branch to fork.
30. Open PR to `she-llac/claude-counter` with `gh pr create --repo she-llac/claude-counter`. Body: what's tested, characterization framing, commit-by-commit cherry-pick guide, any bugs found (cycle guard), link to issue #41 for context. Explicitly offer to drop Tier 2 / CI commits if unwanted.
31. Update this plan's originating convo file and STATUS trackers per finish-convo when the session ends.

## Edge cases

- Cycle in parent chain (probable hang — the marquee finding; test with timeout).
- `chat_messages` entries missing `uuid` (cache keying falls back to direct count — covered in cache tests).
- `utilization` exactly 0 (falsy but valid — must render as 0%, not "missing"; parser tests cover).
- `resets_at` epoch of 0 / negative (SSE parser converts blindly; characterize current behavior, don't judge).
- Tool blocks with circular `input` objects (stableStringify guard returns '[Circular]' — characterize).
- Non-array `content` on a message (defensive path returns empty — characterize).
- macOS path collision (Phase 0, step 3).

## Questions

1. **PR etiquette:** open a short "would you accept a test-suite PR?" comment on issue #41 before doing Phase 1, or just ship the PR? Shipping is more concrete; asking risks nothing. Dan's call — default is ship directly, offering commit-drops.
2. **`format.test.js` scope:** `formatSeconds`/`formatResetCountdown` are private to `ui.js`, which needs jsdom and instantiates nothing on import (safe to import — helpers are module-scoped though, so exposure would need a `CC.format` refactor). Is a second refactor commit worth two small helpers? Default: skip; note as future work.
3. **Fork visibility:** the fork will be public under `danparshall`. Fine given issue #41 already links Dan to this project? Assumed yes.
4. **Pin Vitest to which major?** Latest stable at implementation time, exact-pinned. Check `npm view vitest version` during Phase 0.

---

**Testing Details:** The suite feeds crafted conversation/usage payloads through the real shipped code (including the real o200k tokenizer) and asserts observable outputs: token totals, trunk selection, cache timestamps, normalized usage windows, and postMessage protocol semantics. The only fakes are process-boundary stand-ins (the page side of postMessage; `crypto` via node) — never the units under test. No test asserts internal state, call counts, or data-structure shapes.

**Implementation Details:**
- IIFE sources load via side-effect `import`; ordering matters (constants → vendor → tokens).
- Reset `globalThis.ClaudeCounter` between test files to avoid cross-contamination (Vitest isolates per file by default — rely on that, verify once).
- `it.fails` documents upstream bugs without blocking the suite.
- Tier 1 must not modify any shipped file; Tier 2 modifies exactly `main.js` + `manifest.json` + adds `parsers.js`.
- Every commit leaves the extension loadable (manifest stays valid).
- PR framed as cherry-pickable: scaffolding / tests / refactor+tests / CI.
- Cycle-guard fix offered as a fifth optional commit only if the probe confirms the hang.
- No absolute paths inside tests; suite must run from a bare `git clone && npm ci && npm test`.

**What could change:** If she-llac responds to issue #41 with maintenance signals (or hostility to tooling), rescope: a hostile response converts this plan back to the standalone tested-rebuild in Dan's own repo (the audit convo's original Option A). If the cycle probe shows `buildTrunk` actually terminates (my reading may be wrong), drop the `it.fails` framing. If claude.ai payload formats have shifted since 0.4.2, characterization targets the code, not live claude.ai — live-format drift is out of scope.

**Questions:** see numbered list above; #1 (ask-first vs. ship) is the only one blocking Phase 1.

---
