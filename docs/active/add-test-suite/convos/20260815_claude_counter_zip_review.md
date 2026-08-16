# Convo: claude-counter zip review & copycat investigation

> Relocated 2026-08-16 from `~/code/Claude-Counter` (copycat clone root) to the fork's `research-docs` branch. Path references below ("this directory", `/tmp/...`) describe the original session environment. Open item 2 (rebuild scope) was resolved by the upstream-PR path: see `../plans/20260815_plan_upstream_test_suite.md` and PR #42.

**Date:** 2026-08-15 · **Machine:** MacBook Air · **Repo:** clone of `Pratik-kiran-Rout/Claude-Counter` (a copycat — not ours, don't push here)

## What Dan asked

Unzip `claude-counter-0.4.2.zip`, review it (suspected sketchy), discuss, then reproduce the
non-dangerous functionality via TDD.

## What happened

### 1. Security review — verdict: code benign, repo is a parasite

- Zip extracted to `/tmp/claude-counter-0.4.2/`. It is a **Mozilla-AMO-production-signed Firefox XPI**
  (unlisted/self-distributed tier: automated scan, no human review; cert CN matches gecko GUID
  `{236c6889-52b6-4454-bc4b-5a2ad18effa2}`, issued 2026-01-31).
- **Byte-identical** (SHA-256 `e6132108...b588`) to the official release of the real project:
  **`she-llac/claude-counter`** (2.3k stars, real dev history, 95k+ zip downloads).
- Provenance proof: signing-cert notBefore (13:15 UTC) sits between she-llac's "Bump version to 0.4.2"
  commit (12:39) and release upload (13:19) on 2026-01-31 — a copycat can't fake that interlock.
- Code audit: content script + page-context bridge that monkey-patches `window.fetch` on claude.ai,
  reads conversation tree + SSE `message_limit` events, counts tokens with vendored `o200k_base`
  (2MB file = pure tokenizer, hash-checked). Network egress: three `claude.ai` URLs, nothing else.
  Only sensitive read: `lastActiveOrg` cookie for the `/usage` API path. Quality is good; one wart:
  `postMessage` with `'*'` origin (negligible added surface on same-origin).

### 2. Copycat survey (subagent sweep of ~24 repos)

- MIT question (Dan): attribution required, yes — but MIT *permits* re-hosting/selling; only
  notice-stripping violates. DMCA standing belongs to she-llac only.
- **Deceptive binary re-hosts:** Pratik-kiran-Rout (our clone source; slop LLM README, dead links),
  Kunalchandra007, kailashpachipala. Hosted zips verified hash-identical today.
- **Modified rebuild under official identity:** `rishavm003/claude-counter` — different binary as
  "v0.4.2" with she-llac's GUID, signature stripped, +background.js/notifications. Diffed: currently
  benign feature fork, vendor file untouched — but impersonates the extension's identity.
- **True MIT violations:** Ifaz2611 (relicensed Apache-2.0 as own), DP1110 (rewrote copyright),
  ThilakesB & wobble-limited (stripped LICENSE).
- **Fine:** attributed forks/mirrors (kr1shnasomani, ShivaRitesh, FarGin13, mohitkumhar, shrix, etc.).

### 3. Actions taken

- **Filed issue with full evidence:** https://github.com/she-llac/claude-counter/issues/41
- **Abuse-report package saved:** `ABUSE_REPORTS.md` in this directory — prefilled GitHub report-abuse
  links + paste-ready text for the three deceptive re-hosts. **Dan files these after restart.**

## Open items (resume here)

1. **Dan: submit the three abuse reports** from `ABUSE_REPORTS.md` (~2 min of form-filling).
2. **Pending decision — rebuild scope** (asked three times, deflected by provenance tangents, still open):
   - Core logic only via TDD (recommended): trunk-walk, token count, usage/SSE parsing, cache timing
   - Full clean-room rebuild incl. bridge + UI
   - Audit-and-adopt she-llac's v0.4.2 (hash pinned)
3. Decided earlier: rebuild lives in a **new danparshall repo** (scaffolded with research doc structure),
   not this clone. Not yet created.
4. Optional: check on issue #41 for she-llac's response; watch whether copycat repos change.

## Artifacts

- `/tmp/claude-counter-0.4.2/` — extracted official zip (audited)
- `/tmp/rishavm003-extracted/` — extracted modified rebuild (diffed)
- `/tmp/she-llac-issue.md` — issue text as filed
- `ABUSE_REPORTS.md` — report texts + links (persistent, this dir)
