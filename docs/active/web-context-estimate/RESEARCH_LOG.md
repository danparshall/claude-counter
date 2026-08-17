# Research Log — `web-context-estimate`

Goal: a trustworthy "current convo context" estimate on claude.ai web, visible **before** compaction fires — analogous to Nori's CLI statusline (`Context: 63.9k`).

Branched off `add-test-suite` (2026-08-17) before that branch's PR #1 merged; rebase onto `main` after merge.

## Key questions

1. Does claude.ai's network traffic (completion SSE, conversation fetches) expose *real* context/usage numbers, so we can read instead of estimate?
2. What is claude.ai's actual compaction trigger (threshold, model-dependence)? Must be observed, not assumed.
3. If estimation is unavoidable, how large is the gap between the extension's tokenizer count (skips thinking, images, documents, system prompt, tool definitions) and true context?

## Sessions (newest first)

- **2026-08-17** — [`20260817_web_context_estimate`](convos/20260817_web_context_estimate.md): branch created; decided to investigate data sources before designing around the tokenizer estimate.
