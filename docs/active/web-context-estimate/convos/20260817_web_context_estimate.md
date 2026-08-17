# 20260817 — Web context estimate: data-source investigation

**Date:** 2026-08-17
**Branch:** `web-context-estimate` (off `add-test-suite`, pre-merge; rebase onto `main` after PR #1 lands)
**Status:** in progress — this is a stub; full summary at session end via finish-convo.

## So far

- Goal: trustworthy "current convo context" estimate on claude.ai web, visible before compaction (Nori-statusline analog).
- Clarified the two UI surfaces: header `~N tokens` mini-bar (context, no marker) vs. session/weekly usage bars (vertical marker = time position in window). Dan's "bar at current time" is the usage bar; open question whether the header counter renders at all on current DOM.
- Web-research subagent findings saved to [`results/20260817_data_source_investigation.md`](../results/20260817_data_source_investigation.md): no readable context field exists; window sizes are model-dependent (1M/500K/200K); compaction network signature unpublished.
- Split follow-on work into Phase A (correctness fixes) and Phase B (instrumentation).

## Captured Tasks

- [#2: Phase A: context-estimate correctness (per-model window, refresh cadence, media counting)](https://github.com/danparshall/claude-counter/issues/2) — captured 2026-08-17
- [#3: Phase B: instrument bridge to capture compaction network signature + unknown SSE events](https://github.com/danparshall/claude-counter/issues/3) — captured 2026-08-17
