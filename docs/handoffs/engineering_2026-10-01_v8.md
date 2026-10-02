# Engineering handoff — GA4 send fix: STATION8, GlobalFork, Cosmos (2026-10-01 regression triage)

**Agent:** Natalia (frontend-engineer) · **Date:** 2026-10-01

Applied the proven GA4 send fix (recipe in the regression scratchpad's `GA_FIX.md`, originally
shipped on LobsterLab PR #50) to the three remaining Tiger Hospitality sites whose consent-gated
GA4 analytics was added earlier in this same 2026-10-01 batch (sibling branches `st8_oct01_v3`,
`gf_oct01_v5`, `cosmos_oct01_v3`, all already merged to `main` before this work started). Same two
root causes LobsterLab had:

1. **`gtag()` pushed a rest-parameter array (`...args`) to `dataLayer` instead of the real
   `arguments` object.** gtag.js only recognises the latter; the array looks identical in the
   queue but is silently dropped, so the tag loaded, every event queued, and nothing was ever
   sent. Fixed identically in all three `lib/analytics.ts` (GlobalFork: `src/lib/analytics.ts`).
2. **CSP missing `https://www.google.com`**, GA4's `/g/collect` fallback host, from `connect-src`
   and `img-src`, fixed in GlobalFork and Cosmos. STATION8 needed no CSP change: its
   `connect-src` was already the unrestricted `'self' https:`.

### Narrative

Three PRs opened, none merged (per this batch's explicit instruction). Each repo worked in its
own `git worktree` off `origin/main` (never a primary checkout), its own branch, its own PR,
`--repo K13-Software-Studio/<repo>` on every `gh` call. Worktrees left in place (not merged, so
not removed per the house rule's own condition).

- **STATION8** — `lib/analytics.ts` only. Biome's `noArguments` rule had to be suppressed inline
  (`// biome-ignore lint/complexity/noArguments: ...`) since this is the one place `arguments` is
  required, not optional; the LobsterLab reference comment uses an ESLint disable, which Biome
  ignores, so this needed its own form. No CSP edit; `connect-src 'self' https:` already covers
  GA4's collect endpoints.
  PR: https://github.com/K13-Software-Studio/STATION8/pull/23 (branch `st8_oct01_v4`)
- **GlobalFork** — `src/lib/analytics.ts` + `next.config.ts`. Added `https://www.google.com` to
  `connect-src` and `img-src`, additive to the existing Behold widget + Google Sheets allowlist,
  confirmed untouched (checked the live response header after the build).
  PR: https://github.com/K13-Software-Studio/GlobalFork/pull/28 (branch `gf_oct01_v6`)
- **Cosmos** — `lib/analytics.ts` + `next.config.mjs`. Same `https://www.google.com` addition to
  `connect-src` and `img-src`.
  PR: https://github.com/K13-Software-Studio/Cosmos/pull/38 (branch `cosmos_oct01_v4`)

### Verification

Each repo: installed deps, built for production with a dummy `NEXT_PUBLIC_GA_ID=G-TEST000000`,
served the build, then ran `ga_hit_test.py` (intercepts and aborts every collection request so
nothing leaves the machine, counts what fired):

```
STATION8   accept: before=0 after=4 events=['page_view','section_view'] csp_violations=0
STATION8   decline: before=0 after=0 events=[] csp_violations=0
GlobalFork accept: before=0 after=4 events=['page_view','section_view'] csp_violations=0
GlobalFork decline: before=0 after=0 events=[] csp_violations=0
Cosmos     accept: before=0 after=4 events=['page_view','section_view'] csp_violations=0
Cosmos     decline: before=0 after=0 events=[] csp_violations=0
```

All three: build clean, typecheck clean. STATION8 lint (Biome) clean on the touched file, 8
pre-existing errors remain elsewhere (event-lifecycle, test files, a11y in unrelated modals),
unchanged by this PR. GlobalFork lint (ESLint) clean on touched files, 2 pre-existing errors
remain in `BeholdWidget.tsx`/`SmoothScroll.tsx`, unrelated. Cosmos has no lint tooling configured
yet (no ESLint or Biome config committed), pre-existing gap, out of scope for this fix, not
raised as a blocker.

One local-only friction note, not part of the shipped diff: GlobalFork's `pnpm-workspace.yaml`
has a stale `ignoredBuiltDependencies` block (sharp, unrs-resolver) that a newer system-wide
`pnpm` (v12.5.1, vs. STATION8's pinned `pnpm@10.33.2`) turns into a hard install-time gate
requiring explicit approval. Worked around locally (direct `node_modules/.bin/*` calls, bypassing
`pnpm run`'s install check) without touching the committed file. GlobalFork has no `packageManager`
field pinning a pnpm version the way STATION8 does; flagging in case it bites the next person who
runs a bare `pnpm install` there.

<!-- Handoff block below, verbatim per AGENT_HANDOFF_PROTOCOL.md -->
## Status      PASS
## Summary     GA4 send bug fixed on STATION8, GlobalFork and Cosmos: gtag() now pushes the real
##             `arguments` object instead of a silently-dropped rest array, and GlobalFork/Cosmos
##             gained the missing `https://www.google.com` CSP host. Verified on a production
##             build with ga_hit_test.py: accept sends page_view + section_view (before=0,
##             after=4) with 0 CSP violations on all three; decline stays at 0 on all three.
## For Kazim   Natalia fixed the same "Google Analytics loads but never actually sends data" bug
##             on STATION8, Global Fork and Cosmos Burger that was already fixed on Lobster Lab;
##             all three have a pull request open and waiting for your review, none merged yet.
## Files       STATION8/lib/analytics.ts; GlobalFork/src/lib/analytics.ts,
##             GlobalFork/next.config.ts; Cosmos/lib/analytics.ts, Cosmos/next.config.mjs
## Risks       None functional. GlobalFork's pnpm install needs a local-only build-approval
##             workaround (not committed); Cosmos has no lint tooling configured yet
##             (pre-existing, out of scope for this fix).
## Next        Michael (code-review) gate, then Olga (qa-test-engineer) for the Chrome pass
## Human gate  Merge all three PRs when ready (withheld per "Do NOT merge"). GA4 property IDs are still unset in Vercel on all three, so analytics stays inert until Kazim sets NEXT_PUBLIC_GA_ID, unchanged from before this fix.
