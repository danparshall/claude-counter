# Research Log — add-test-suite

Index for the upstream-test-suite work on `she-llac/claude-counter` (fork:
`danparshall/claude-counter`). Docs live on the `research-docs` branch; the
code lives on `add-test-suite` (PR #42). Newest entries first.

## Session: 2026-08-15/16 — 20260815_upstream_test_suite_implementation

### Topics Explored
- Executed `plans/20260815_plan_upstream_test_suite.md` in full: fork, vitest
  scaffold, 47-test suite, parser refactor, CI, PR #42 to upstream.
- Full detail: `convos/20260815_upstream_test_suite_implementation.md`.

### Provisional Findings
- `buildTrunk` cycle-hang bug CONFIRMED via child-process probe; fixed
  red-green in the PR's final (droppable) commit.
- Dev Node floor is 22 (jsdom 30), not the planned 20.
- `computeConversationMetrics`'s uuid-less fallback is unreachable dead code.

### Results
- https://github.com/she-llac/claude-counter/pull/42 — five cherry-pickable
  commits, 47/47 tests green.

### Next Steps
- Watch #41/#42 for maintainer response; rescope to standalone rebuild if
  hostile (audit convo Option A).
- Dan: file the three abuse reports (`ABUSE_REPORTS.md`).
- If PR lands: `CC.format` refactor, `bridge.js` fetch-patch tests.

## Session: 2026-08-15 — 20260815_claude_counter_zip_review (pre-branch)

### Topics Explored
- Security audit of `claude-counter-0.4.2.zip` (suspected sketchy); copycat
  ecosystem survey (~24 repos). Ran in the copycat clone
  `~/code/Claude-Counter` before this doc structure existed; convo file
  relocated here. Full detail: `convos/20260815_claude_counter_zip_review.md`.

### Provisional Findings
- Zip is byte-identical to she-llac's official, Mozilla-signed 0.4.2 release;
  code benign; the hosting repo is a parasite re-host.
- Three deceptive re-hosts, one identity-impersonating rebuild, four MIT
  violations identified.

### Results
- Filed https://github.com/she-llac/claude-counter/issues/41 with evidence.
- `ABUSE_REPORTS.md` — paste-ready report package (Dan to file).
