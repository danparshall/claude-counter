# STATUS — danparshall/claude-counter (fork)

Fork of `she-llac/claude-counter` carrying Dan's upstream test-suite
contribution. This STATUS.md exists only on the `research-docs` branch —
`main` tracks upstream and `add-test-suite` is the PR branch (code only,
never put docs there).

## Active Research Lines

| Branch | Status | Summary |
|---|---|---|
| `add-test-suite` | PR open | Behavioral test suite for upstream (47 tests) + cycle-guard bugfix — [PR #42](https://github.com/she-llac/claude-counter/pull/42) |
| `research-docs` | active | Docs home: convos, plans, audit notes under `docs/active/add-test-suite/`. Never merged into the PR. |

## Context

- Origin story: audit of a copycat-hosted zip (byte-identical to the official
  signed release) → copycat-ecosystem survey → issue
  [#41](https://github.com/she-llac/claude-counter/issues/41) → this PR.
  See `docs/active/add-test-suite/RESEARCH_LOG.md`.
- The copycat clone at `~/code/Claude-Counter` (remote:
  Pratik-kiran-Rout/Claude-Counter) is NOT ours — never push there.
- Fork repo-local git config: identity `Dan Parshall (air)`, credential helper
  `!gh auth git-credential`, SSH remote (OAuth token lacks `workflow` scope).

## Pending

- she-llac's response to #41 / #42 (no response as of 2026-08-16). Hostile →
  rescope to standalone tested rebuild (audit convo Option A).
- Dan: file three abuse reports from
  `docs/active/add-test-suite/ABUSE_REPORTS.md`.

## Recent Sessions

- 2026-08-15/16: [add-test-suite] executed the upstream-test-suite plan;
  confirmed + fixed the buildTrunk cycle-hang; opened PR #42.
- 2026-08-15: [pre-branch] zip audit + copycat survey; filed issue #41.

## Archived Research Lines

| Branch | Archived | Summary |
|---|---|---|
| _none yet_ | | |
