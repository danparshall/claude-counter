# Context-Estimate Correctness (Phase A) Implementation Plan

**Goal:** Make the extension's context estimate trustworthy — right window scale per model, fresh after every turn, media counted, calibrated, with a compaction warning.

**Originating conversation:** [`../convos/20260817_web_context_estimate.md`](../convos/20260817_web_context_estimate.md) (issue [#2](https://github.com/danparshall/claude-counter/issues/2))

**Context:** Investigation ([`../results/20260817_data_source_investigation.md`](../results/20260817_data_source_investigation.md)) found no readable context field in claude.ai's traffic — estimation is unavoidable. But the current estimate has four independent correctness bugs: fixed 200K scale (wrong for 1M/500K models), staleness mid-session, images/documents counted as zero, and no compaction signal.

**Confidence:** High for the mechanism changes (window lookup, refresh cadence). Medium for the calibration constants (×1.2, media heuristics, ~85% threshold) — these are lugia19 folklore plus Claude Code analogues, pending Phase B's empirical data (issue [#3](https://github.com/danparshall/claude-counter/issues/3)).

**Architecture:** All logic changes land in pure, testable functions (`tokens.js`, new model-lookup helper); `main.js` threads a `contextLimit` value to the UI; `bridge.js` gains one outbound event. No new files except tests and `models.js`; no new dependencies.

**Branch:** `web-context-estimate`, worktree `/Users/dan/code/claude-counter-fork`. Rebase onto `main` once PR #1 (add-test-suite) merges — the branch already contains its commits, so the rebase is trivial. Check `gh pr view 1 --repo danparshall/claude-counter` at session start.

**Tech Stack:** Vanilla JS content scripts (IIFE modules on the `globalThis.ClaudeCounter` namespace), vitest + jsdom. `tests/helpers/load.js` loads content-script modules without DOM side effects — read it before writing tests.

**Decisions pre-made (Dan may override; defaults chosen so the implementer is never blocked):**
- Q1 fixtures: proceed with provisional model-id strings, marked `// FIXTURE-PROVISIONAL` in tests; swap in real strings when Dan captures a conversation GET.
- Q2 warn styling: red fill at ≥85% (no static marker line — illegible on a ~60px mini bar).
- Q3 plan tiers: ignore plan tier entirely; key window size off model only. Free-plan sizes are unpublished.

---

**Testing Plan**

Unit tests (extend existing files where natural, new files otherwise):

- **`tests/models.test.js`** (new) — `CC.models.contextLimitForModel(modelString)` behavior: strings containing `opus-5`/`sonnet-5` → 1,000,000; `opus-4`/`sonnet-4` variants (4-6, 4-7, 4-8) → 500,000; `haiku` and unrecognized strings → 200,000; `null`/`undefined`/empty → 200,000.
- **`tests/tokens.test.js`** (extend) — media counting: an image content item with width/height → `⌈(w×h)/750⌉` capped at 1600; image without dimensions → flat fallback; document attachment with `extracted_content` → text counted once, page heuristic NOT added (no double count); document with page count and no extracted content → `2250 × pages`. Calibration: trunk with only text → total = `⌈raw × 1.2⌉`; mixed trunk → `⌈text × 1.2⌉ + media` (media heuristics are already in Claude-token units — calibrating them again would double-count the correction).
- **`tests/bridge-protocol.test.js`** (extend) — a completion-URL event-stream that reaches its end posts exactly one `cc:generation_end`; a non-completion event-stream posts none; `retry_completion` also fires it.
- **`tests/ui-context-bar.test.js`** (new, jsdom) — `setConversationMetrics({totalTokens, contextLimit})` behavior: bar fill percent computed against the passed limit, not a global constant; warn class present at ≥85% of limit and absent below; tooltip text contains the actual limit ("500k"/"1M").

NOTE: I will write *all* tests before I add any implementation behavior.

---

**Steps**

*Capture ground truth (5 min, no code):*

1. If Dan has supplied real `model` strings from a live conversation GET, put them in test fixtures. Otherwise use best-guess strings (e.g. `claude-opus-5`, `claude-sonnet-4-6`) marked `// FIXTURE-PROVISIONAL`, and note the swap as a follow-up in the convo doc.

*Write all failing tests:*

2. Write `tests/models.test.js` (window lookup cases above).
3. Extend `tests/tokens.test.js` with media-counting cases.
4. Extend `tests/tokens.test.js` with calibration cases.
5. Extend `tests/bridge-protocol.test.js` with `cc:generation_end` cases.
6. Write `tests/ui-context-bar.test.js`.
7. Run `npm test`; confirm every new test fails and every pre-existing test (47) still passes.

*Implement, one commit per green cluster:*

8. `src/content/constants.js`: replace `CONTEXT_LIMIT_TOKENS` with `DEFAULT_CONTEXT_LIMIT_TOKENS: 200000`, add `CONTEXT_WARN_FRACTION: 0.85`, `TOKEN_CALIBRATION: 1.2`.
9. New `src/content/models.js` (IIFE, exports `CC.models.contextLimitForModel`) — substring pattern table ordered most-specific-first, default 200K. Run models tests → green. Commit.
10. `src/content/tokens.js`: add `estimateMediaTokens(msg)` beside `stringifyMessageCountables`; `computeConversationMetrics` returns `{textTokens, mediaTokens, totalTokens, model, ...}` where `totalTokens = ⌈text×1.2⌉ + media` and `model` comes from the conversation object. Run tokens tests → green. Commit.
11. `src/injected/bridge.js`: pass the request URL into `handleEventStream`; after the read loop completes on a completion/retry_completion URL, `post('cc:generation_end', {})`. Run bridge tests → green. Commit.
12. `src/content/main.js`: in `handleConversationPayload`, compute `contextLimit = CC.models.contextLimitForModel(metrics.model)` and pass it to `ui.setConversationMetrics`; add `CC.bridge.on('cc:generation_end', refreshConversation)`. Commit.
13. `src/content/ui.js`: `setConversationMetrics` accepts `contextLimit` (fallback `DEFAULT_CONTEXT_LIMIT_TOKENS`); warn styling on the mini bar at ≥ `CONTEXT_WARN_FRACTION` (existing `RED_WARNING` via the `cc-warn` mechanism — note `lengthBar` currently sets `fillWarn` to the normal fill color; change that); tooltip rewritten to state the actual scale, the ×1.2 calibration, and "compaction expected above ~85% (threshold unverified)". Run UI tests → green. Commit.
14. `manifest.json` + `userscript/claude-counter.user.js`: register `src/content/models.js` in the content-script load order (before `main.js`; match how `parsers.js` was added in commit `d9d9798`). Commit.
15. Full `npm test`; fix anything red. CI (Node 22 + 24) must pass on push.

*Verify in the real app:*

16. Load the unpacked extension; open a real conversation; confirm: header counter renders on current claude.ai DOM, number ≈ previous×1.2, bar scale matches the model, count updates after sending a message without navigating. (This step needs Dan or a browser session — flag if unavailable.)

---

**Testing Details** All new tests assert observable behavior: token totals for constructed conversation payloads, posted window messages from a synthetic SSE stream, rendered DOM state (fill width, warn class, tooltip text) — never internal call patterns, never mock echoes.

**Implementation Details**
- Unknown/absent model → 200K default. Conservative on purpose: overstates fullness, so the warning fires early rather than late.
- ×1.2 applies to text tokens only; media heuristics are already Claude-token-scale (double-calibration trap).
- Attachments with `extracted_content` keep the existing text path; page-count heuristic only when extraction is absent.
- `cc:generation_end` fires from the stream reader that already exists for `message_limit` — no new interception.
- Bridge-client needs no changes — its `on()` dispatches event types generically.
- No debounce on the generation-end refetch initially; `cc:conversation` handling is idempotent. Add one only if real usage shows duplicate fetches.
- Keep the existing hide-at-99.5% behavior; it now keys off the correct limit.
- Substring matching for model ids (not exact match) so minor version suffixes don't break the lookup.
- Displayed number includes the ×1.2 calibration (Dan's explicit decision, this convo) — number and bar must agree; tooltip discloses the calibration.

**What could change:** Phase B's empirical data (issue #3) may replace the ×1.2 factor, the 85% threshold, and possibly the entire estimator — if a usage object turns up in the SSE stream, most of `tokens.js` becomes a fallback path. The model→window table will need maintenance as models ship; the 200K default bounds the damage.

**Questions** (defaults pre-made above; surface to Dan only if a default proves untenable)
1. Real `model` strings for fixtures — pending from Dan's browser.
2. Whether 85%-red-fill suffices or a later ~95% escalation tier is wanted.
3. Plan-tier awareness deferred entirely to a future phase.
