# Research Log — `web-context-estimate`

Goal: a trustworthy "current convo context" estimate on claude.ai web, visible **before** compaction fires — analogous to Nori's CLI statusline (`Context: 63.9k`).

Branched off `add-test-suite` (2026-08-17) before that branch's PR #1 merged; rebase onto `main` after merge.

## Key questions

1. Does claude.ai's network traffic (completion SSE, conversation fetches) expose *real* context/usage numbers, so we can read instead of estimate?
2. What is claude.ai's actual compaction trigger (threshold, model-dependence)? Must be observed, not assumed.
3. If estimation is unavoidable, how large is the gap between the extension's tokenizer count (skips thinking, images, documents, system prompt, tool definitions) and true context?

## Sessions (newest first)

## Session: 2026-08-17 — [`20260817_web_context_estimate`](convos/20260817_web_context_estimate.md)

### Topics Explored
- Clarified the extension's two UI surfaces (header context mini-bar vs usage bars with time marker).
- Found the refresh-cadence gap (metrics only update on navigation, not generation end).
- Subagent investigation: can real context data be read from claude.ai traffic?

### Provisional Findings
- No readable context field exists; estimation + calibration is the path.
- Context windows are model-dependent (1M/500K/200K) — fixed 200K scale is wrong.
- Web compaction threshold unpublished; its network signature is an open empirical gap.

### Results
- [`results/20260817_data_source_investigation.md`](results/20260817_data_source_investigation.md)

### Next Steps
- Next agent implements Phase A per [`plans/20260817_phase_a_context_estimate_correctness.md`](plans/20260817_phase_a_context_estimate_correctness.md) (issue #2; TDD, tests first). Rebase onto main once PR #1 merges.
- Dan: capture a real `model` string from a conversation GET; check whether the header counter renders on current DOM.
- Phase B (issue #3) after: SSE/compaction instrumentation.
- Decisions locked this session: displayed number includes ×1.2; model-only window lookup; red fill at 85%.
