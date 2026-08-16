# GitHub abuse reports — claude-counter copycats

Prepared 2026-08-15. Context: audit of `claude-counter-0.4.2.zip` (this repo's clone source) traced it
to the original at `she-llac/claude-counter`; a survey found deceptive re-hosts. Full evidence filed at
https://github.com/she-llac/claude-counter/issues/41

Official binary baseline: `claude-counter-0.4.2.zip`
SHA-256 `e6132108d9c1734285583e844c9142e560483ad2814e637292d02e90c950b588` (1,222,469 bytes, Mozilla-signed).

**How to file:** open each link below (prefills the repo), pick **"I want to report spam"** (or
"misleading/inauthentic content" where offered), and paste the matching text. Three forms, ~2 minutes.

---

## 1. Pratik-kiran-Rout/Claude-Counter

**Form:** https://github.com/contact/report-abuse?report=Pratik-kiran-Rout%2FClaude-Counter+%28Repository%29

> This repository re-hosts the release binary of another developer's browser extension
> (she-llac/claude-counter) with a fabricated README presenting it as the account owner's own project.
> The README appears LLM-generated: release and repo links are dead "(#)" anchors, and it instructs
> users to sideload the zip via Chrome "Load unpacked" with "Do NOT unzip" — a pattern associated with
> deceptive extension distribution. No license file, no attribution. The repo's only commits are
> "Add files via upload" of the binary (created 2026-06-02). The binary is currently byte-identical to
> the official release (SHA-256 e6132108d9c1734285583e844c9142e560483ad2814e637292d02e90c950b588), but
> the repo trains users to install browser extensions from an account with no connection to the project.
> Original author has been notified: https://github.com/she-llac/claude-counter/issues/41

## 2. Kunalchandra007/Claude-counterr

**Form:** https://github.com/contact/report-abuse?report=Kunalchandra007%2FClaude-counterr+%28Repository%29

> This repository re-hosts the release binary of another developer's browser extension
> (she-llac/claude-counter) without attribution, with the original README edited to direct users to
> install from this copy instead of the official source. Created 2026-04-17. The hosted zip is currently
> byte-identical to the official release
> (SHA-256 e6132108d9c1734285583e844c9142e560483ad2814e637292d02e90c950b588); the concern is
> inauthentic re-distribution that conditions users to sideload extensions from an unaffiliated account,
> which can be weaponized by a later "update." Original author notified:
> https://github.com/she-llac/claude-counter/issues/41

## 3. rishavm003/claude-counter

**Form:** https://github.com/contact/report-abuse?report=rishavm003%2Fclaude-counter+%28Repository%29

> This repository distributes a MODIFIED build of another developer's browser extension
> (she-llac/claude-counter) under the official name, version number, and release filename
> ("v0.4.2", claude-counter-0.4.2.zip/.xpi), with the Mozilla code signature stripped and the original
> author's Firefox extension GUID ({236c6889-52b6-4454-bc4b-5a2ad18effa2}) retained — so it impersonates
> the original extension's identity to the browser. The binary differs from the official release
> (1,205,164 bytes vs 1,222,469; added background service worker and permissions). The README is fully
> rebranded with no attribution. Whether or not the current modifications are harmful, shipping an
> unsigned altered binary under another project's exact identity is deceptive distribution.
> Original (signed) release: https://github.com/she-llac/claude-counter/releases/tag/v0.4.2
> Original author notified: https://github.com/she-llac/claude-counter/issues/41

---

## Not reported (for the record)

- **License violators** (Ifaz2611, DP1110, ThilakesB, wobble-limited): copyright-notice removal is a
  DMCA matter; only she-llac has standing. Listed in issue #41 with evidence.
- **Unattributed rebrands with LICENSE intact** (AIstar007, dewanshshekhar, Priyan2520, tan-codes22,
  ignitedvisions): MIT-permitted, however shabby.
- **Compliant mirrors / attributed forks** (shrix, merakianssss, jitenpatel003, 7vik-dev,
  ShadowAISolutions, RamachandraKulkarni, mohitkumhar, kr1shnasomani, ShivaRitesh, FarGin13): no action.
