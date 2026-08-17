# Data-source investigation: can we READ true context usage on claude.ai web?

**Provenance:** web-research subagent (nori-web-search-researcher), 2026-08-17, session `20260817_web_context_estimate`. ~45 tool calls over community reverse-engineering repos, lugia19/Claude-Usage-Extension source, and official support docs. Confidence labels inline.

## Bottom line

No known surface of claude.ai's private API exposes a per-conversation token count or "context remaining" figure. The only real numbers in the traffic are rate-limit utilization fractions (not context), a project-knowledge size stat, and binary at-the-limit errors. The most mature tracker in the ecosystem (lugia19) tokenizes client-side — strong indirect evidence the data isn't there to read. Estimation stays necessary; calibration and correct window scale become the design problem.

## Q1 — Private API surfaces (no context field found)

- **Completion SSE**: only usage-bearing event is `message_limit` with windows `5h`, `7d`, and a third window **`7d_oi`** (weekly scoped to the serving model) that our parser currently ignores. No documented `usage`/`input_tokens` in the web stream. **Unverified jackpot:** whether claude.ai's stream includes an API-style `message_start` with a populated `usage` object — no public documentation either way; needs one empirical HAR check.
- **Conversation GET** (`?tree=True...`): no token fields reported by any client.
- **`GET /organizations/{org}/usage`**: richer than our parser — also `seven_day_sonnet`, `seven_day_opus`, `seven_day_oauth_apps`, `seven_day_cowork`, `extra_usage`. All rate-limit, zero context.
- **Real numbers that DO exist:** `GET /organizations/{org}/projects/{id}/kb/stats` → `knowledge_size` (server-side truth for project-knowledge contribution); preflight error "Your message will exceed the length limit for this chat" (binary 100%-context signal).

## Q2 — lugia19/Claude-Usage-Extension internals (confirmed-by-code)

- Token counting: official `count_tokens` API if user supplies a key; else o200k_base × **1.2 multiplier**. Images: `(w*h)/750` capped 1600; documents: `2250 × page_count`.
- Constants: `BASE_SYSTEM_PROMPT_LENGTH: 3200`, per-feature costs ~2200–14000 tokens, `OUTPUT_TOKEN_MULTIPLIER: 4`.
- No context-window constants, no compaction detection anywhere in the repo.

## Q3 — Web compaction (existence confirmed; threshold + network signature unknown)

- Paid plans with code execution enabled; possibly extended to free users Feb 2026 (press report, unverified).
- UI signal: progress bar "Compacting our conversation so we can keep chatting. This takes about 1-2 minutes." Full history stays scrollable; only working context compresses. Cannot be disabled.
- Threshold unpublished. Claude Code reference points conflict: ~83.5% vs ~95% of window. API-side product uses `compact_20260112` strategy in `context_management.edits`.
- **No documented API/tree marker post-compaction. Nobody has published a HAR of a web compaction event.** Highest-value empirical gap: capture one; check (a) SSE `message_start` usage object, (b) what marker compaction leaves in the tree GET (API-side it's a summary content block).

## Q4 — Context window sizes on web, 2026 (official support doc)

- **Opus 5 / Sonnet 5: 1M tokens on all paid plans, in web chat.**
- Opus 4.8/4.7/4.6, Sonnet 4.6: **500K** on paid plans.
- Other models (e.g., Haiku 4.5): **200K**. Free plan unspecified.
- ⇒ The extension's fixed 200K bar scale is wrong for current models on paid plans — must be model-dependent (`model` field is already in the conversation GET) and plan-aware (`bootstrap/{org}/app_start` → org tier).

## Actionable summary

1. Tokenizer estimation stays; scale the bar per-model (200K/500K/1M), not fixed 200K.
2. Cheap wins from real data: `7d_oi` + per-model weekly windows; `kb/stats.knowledge_size` for project convos; treat preflight length-limit error as 100% signal.
3. Next empirical step: HAR-capture a compaction event (SSE usage object? tree marker?). Nothing public answers this.

Source URLs: see subagent report archived in session convo; primary — lugia19/Claude-Usage-Extension, linuxlewis/claude-usage SPEC.md, support.claude.com articles 8606394 / 11647753 / 12466728, platform.claude.com compaction docs.
