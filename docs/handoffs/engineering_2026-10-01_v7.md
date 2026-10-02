# Engineering handoff — GA4 send fix (2026-10-01 regression triage)

## Status
Done. Four repos, four PRs opened, none merged (as instructed).

## Summary
Applied the proven GA4 fix (from LobsterLab PR #50) across four K13-Software-Studio repos whose
consent-gated GA4 analytics was added earlier in this same 2026-10-01 regression triage batch
(sibling branches lavida_oct01_v4, ego_oct01_v3, tiger_oct01_v4, mira_oct01_v3, all already merged
to `main` before this work started). Two root causes, same as LobsterLab:

1. **Arguments bug (LaVida, Egg-Out only):** the gtag shim was `function gtag(...args: unknown[])
   { dataLayer.push(args) }` — a rest-parameter array, which `gtag.js` silently ignores because it
   reads the real `arguments` object off each call. No hit ever left the page, even with consent
   granted. Fixed to push `arguments` directly. THG and Miramar's static-site `analytics.js` were
   already written correctly (confirmed by reading both before touching anything) — code-fix was
   not needed there, matching the task brief.
2. **CSP (all four):** `connect-src` (and `img-src` where it didn't already have a blanket or
   existing grant) was missing `https://www.google.com`, the origin GA4's `/g/collect` fallback
   endpoint posts to. Added it alongside the already-present `*.google-analytics.com`,
   `*.analytics.google.com` and `www.googletagmanager.com` entries. THG has two CSP sources
   (`vercel.json` header + `index.html` meta); both were fixed. `privacy-policy.html` carries no
   CSP meta, confirmed by grep, left untouched. Miramar has two `vercel.json` files; only the
   repo-root one is live (confirmed by reading `website/vercel.json`, which carries no headers
   block), so only that one was touched.

Each repo: fresh worktree from `origin/main` (never the primary checkout, never another tab's
branch — several sibling `_oct01_v*` branches were actively checked out in other worktrees from
this same batch), smallest possible diff, production build with a dummy GA4 id, served with the
project's real response headers, verified with `ga_hit_test.py` (Playwright, intercepts and aborts
every Google collection request so nothing left the machine), committed, pushed, PR opened. THG and
Miramar needed a temporary `window.K13_GA_ID` for local-only testing — confirmed reverted before
commit in both (diff of `analytics-config.js` is empty in the final commit).

**Account verified** (`~/.claude.json` → `oauthAccount.emailAddress`): `eren@tigerhospitalitygroup.com`.
Gold Rule not implicated — none of these four repos are EDISYN.

## Results per repo

| Repo | PR | Fixes applied | accept (before/after/events/csp) | decline |
|---|---|---|---|---|
| LaVida | [#25](https://github.com/K13-Software-Studio/LaVida/pull/25) | arguments + CSP | before=0 after=4, events=[page_view, section_view], csp_violations=0 | after=0 |
| Egg-Out | [#50](https://github.com/K13-Software-Studio/Egg-Out/pull/50) | arguments + CSP | before=0 after=4, events=[page_view, section_view], csp_violations=0 | after=0 |
| THG-Website | [#37](https://github.com/K13-Software-Studio/THG-Website/pull/37) | CSP only (both sources) | before=0 after=4, events=[page_view, section_view], csp_violations=0 | after=0 |
| Miramar | [#43](https://github.com/K13-Software-Studio/Miramar/pull/43) | CSP only (root vercel.json) | before=0 after=4, events=[page_view, section_view], csp_violations=0 | after=0 |

All four PASS against the spec in `GA_FIX.md` (accept: before=0, after>0, events include
`page_view` and `section_view`, `csp_violations=0`; decline: after=0).

## Files
- `/Users/k13/git-store/worktrees/LaVida/lavida_oct01_v5/src/lib/analytics.ts`
- `/Users/k13/git-store/worktrees/LaVida/lavida_oct01_v5/vercel.json`
- `/Users/k13/git-store/worktrees/Egg-Out/ego_oct01_v4/egg-out-web/src/lib/analytics.ts`
- `/Users/k13/git-store/worktrees/Egg-Out/ego_oct01_v4/egg-out-web/next.config.ts`
- `/Users/k13/git-store/worktrees/THG-Website/tiger_oct01_v5/vercel.json`
- `/Users/k13/git-store/worktrees/THG-Website/tiger_oct01_v5/index.html`
- `/Users/k13/git-store/worktrees/Miramar/mira_oct01_v4/vercel.json`

Worktrees left in place (not removed per rule 10, which only applies once merged); each is clean
and pushed.

## Risks
- None found beyond what's fixed. Build/typecheck passed on Egg-Out (Next.js `tsc` ran as part of
  `next build`); LaVida's `npm run lint` failed with `eslint: command not found` in the worktree
  (node_modules was symlinked for the Vite build, which Turbopack later rejected for Egg-Out and
  was replaced with a real `npm install` there — LaVida's build itself succeeded via the symlink,
  only the separate `eslint` binary resolution failed in that shared-node_modules setup). Not a
  regression from this change; flagging in case a clean lint run is wanted before merge.
- CSP changes are narrowly scoped (one origin, two directives max per repo); no enforcement mode
  was changed anywhere (THG and Miramar's root vercel.json CSPs were already enforced, not
  report-only, before this change).

## Next
- qa-test-engineer (Olga), via the Michael code-review gate, per standard pipeline.
- These four PRs are stacked on top of each repo's already-merged GA4-analytics-add branch; no
  further dependency.

## Human gate
- **Do not merge** — explicit instruction in `GA_FIX.md`. All four PRs are open and waiting.
- Each repo's GA4 property id is still an empty string (`VITE_GA_ID` / `NEXT_PUBLIC_GA_ID` /
  `window.K13_GA_ID`) — analytics stays inert in production until Kazim creates the real GA4
  properties and pastes the ids in, unrelated to this fix.
