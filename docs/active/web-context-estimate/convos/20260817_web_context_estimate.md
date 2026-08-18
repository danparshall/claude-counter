# 20260817 — Web context estimate: investigation + Phase A plan

**Date:** 2026-08-17
**Branch:** `web-context-estimate`
**Machine:** Dans-MacBook-Air

## Summary

Session goal: give Dan a Nori-statusline-style "current convo context" estimate on claude.ai web, visible before compaction fires. Branched `web-context-estimate` off `add-test-suite` (pre-merge of PR #1; rebase onto `main` after it lands).

We first clarified what the extension already shows. There are two UI surfaces: the header `~N tokens` mini-bar (context estimate vs a fixed 200K, no marker) and the session/weekly usage bars near the composer (vertical marker = time position within the reset window). Dan's impression that "the 200k bar shows a line at the current time" was the usage bar behaving as documented; open question whether the header counter renders at all on current claude.ai DOM (selector drift would explain seeing only the usage bars).

A web-research subagent then investigated whether real context data can be read instead of estimated. Answer: no — no known surface of claude.ai's private API exposes per-conversation tokens or context remaining. Estimation stays, so the work becomes calibration + correctness. Findings split into two tickets, and a full implementation plan for the first was written and committed.

## Topics Explored

- Extension architecture: `tokens.js` (trunk walk + o200k count), `ui.js` (two bar surfaces), `main.js` (refresh cadence), `bridge.js` (fetch/SSE interception), `bridge-client.js` (generic event dispatch).
- Refresh cadence gap: conversation metrics refresh only on navigation/branch clicks, not after generations.
- Data-source investigation (subagent): private API surfaces, lugia19/Claude-Usage-Extension internals, web compaction behavior, model context-window sizes.

## Provisional Findings

- No readable context field exists in claude.ai traffic (strong indirect evidence: lugia19 still tokenizes client-side). Two unverified possibilities remain: a `usage` object in SSE `message_start`, and a post-compaction tree marker — nobody has published a HAR of web compaction.
- Context windows are model-dependent on web: 1M (Opus 5/Sonnet 5, all paid plans), 500K (4.x generation), 200K (others). The extension's fixed 200K scale is wrong for current models.
- Web compaction is real, non-disableable, threshold unpublished (~83–95% by Claude Code analogy).
- Full details: [`../results/20260817_data_source_investigation.md`](../results/20260817_data_source_investigation.md).

## Decisions Made

- Work split: Phase A (correctness fixes) and Phase B (instrumentation) — tickets below. Phase A is mergeable independently of the threshold question.
- Displayed token number includes the ×1.2 calibration (Dan's explicit call — number and bar must agree; ×1.2 corrects o200k's undercount, so it's the more honest display). Tooltip discloses the calibration.
- Defaults encoded in the plan so the implementer is unblocked: provisional model-string fixtures, red fill at 85% (no marker line), model-only window lookup (plan tier ignored).
- Plan doc: [`../plans/20260817_phase_a_context_estimate_correctness.md`](../plans/20260817_phase_a_context_estimate_correctness.md) — next agent implements.
- Enabled GitHub issues on the fork (disabled by default on forks) so repo-specific tickets live with the code.

## Results

- [`../results/20260817_data_source_investigation.md`](../results/20260817_data_source_investigation.md) — data-source investigation report (subagent, provenance header inside).

## Open Questions

- Does the header token counter render on current claude.ai DOM? (Dan to check next web session.)
- Real `model` id strings from a live conversation GET — needed to de-provisionalize Phase A test fixtures.
- SSE `message_start` usage object and compaction network signature — Phase B's empirical questions.
- Whether 85%-red-fill needs a later ~95% escalation tier.
- Free-plan window sizes (unpublished; deferred).

## Captured Tasks

- [#2: Phase A: context-estimate correctness (per-model window, refresh cadence, media counting)](https://github.com/danparshall/claude-counter/issues/2) — captured 2026-08-17
- [#3: Phase B: instrument bridge to capture compaction network signature + unknown SSE events](https://github.com/danparshall/claude-counter/issues/3) — captured 2026-08-17
