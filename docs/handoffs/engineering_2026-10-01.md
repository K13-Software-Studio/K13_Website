# Engineering handoff — 2026-10-01 regression triage (LobsterLab + Miramar)

**Agent:** Natalia (frontend-engineer)
**Request:** Kazim, 2026-10-01 regression checkup (`frontend.json`, `security.json`, `sites.json` in the regression scratchpad)
**Scope:** two unrelated repos, fixed independently per `RULES.md`. No work landed in K13_Website itself; this file lives here only because that is this session's home repo.

## Status: both PRs open, verified, NOT merged (human gate hit)

`gh pr merge --merge` was denied by the Claude Code permission system on both repos with reason
"Merge Without Review." This is a harness-level gate, not a judgment call I can appeal or route
around, so both PRs are left open for Kazim (or release-engineer with the right permission) to
merge. Nothing else about the task was blocked.

## A) LobsterLab

- **Branch:** `lobster_oct01_v1` · **Worktree:** `/Users/k13/git-store/worktrees/LobsterLab/lobster_oct01_v1` (left in place, not merged)
- **PR:** https://github.com/K13-Software-Studio/LobsterLab/pull/47 (open)
- **Fixed:**
  - No CSP header at all to a real, enforced `Content-Security-Policy` in `next.config.mjs`,
    allowlist derived from a live Playwright capture of lobsterlab.us with analytics consent
    granted (only external host ever contacted: `www.googletagmanager.com`). Verified zero CSP
    console violations on `/`, `/accessibility`, `/privacy`, `/terms` and a 404, with and
    without consent.
  - 2 of 3 serious axe findings on the homepage, with no visible change: `aria-prohibited-attr`
    (star rating div needed `role="img"` to pair with its `aria-label`) and
    `scrollable-region-focusable` (the horizontally-scrolling reviews rail needed `tabIndex={0}`
    + an `aria-label`). Both confirmed fixed by a before/after axe-core run; screenshot diff of
    the Reviews section confirms pixel-identical rendering.
- **Needs Kazim:** the third serious finding, `color-contrast` on the brand orange `#fe6700`
  against white (2.93:1, floor is 4.5:1) on the ORDER ONLINE button, the italic hero line, and
  nav/mailto links on `/privacy` and `/terms`, plus the much fainter WordmarkWall background
  texture (1.09:1, intentionally pale). Fixing any of it changes a visible brand colour, which
  `RULES.md` item 2 routes to Kazim rather than an agent. Two options, either works: darken the
  orange token enough to clear 4.5:1 at small sizes (changes the accent everywhere it is used in
  body text), or keep the orange for large/bold display text only (>=19px bold needs just 3:1)
  and swap small-text/link/button uses to navy or another passing combination.
- **Build/typecheck:** `npm run build` passes clean. No ESLint config exists in this repo
  (`next lint` wants interactive setup); not something I configured from scratch, out of scope.
- **Not yet done:** merge, then step 6 of `RULES.md` (confirm the production deployment from the
  merge commit is READY on Vercel, fetch the live URL, re-check CSP headers with `curl -sI` and
  re-run axe on the live page).

## B) Miramar

- **Branch:** `mira_oct01_v1` · **Worktree:** `/Users/k13/git-store/worktrees/Miramar/mira_oct01_v1` (left in place, not merged)
- **PR:** https://github.com/K13-Software-Studio/Miramar/pull/41 (open)
- **Fixed:**
  - **Root cause of both the never-reaches-network-idle/8.6s load finding and the vendor logo
    grid intermittently failing to render**: the hero `<video>` had `preload="auto"` on a 6.6MB
    `hero.mp4`. A live, time-stamped Playwright capture of production showed it as the single
    slowest resource on the page, still downloading at the 6.3s mark and crowding out everything
    requested after it (including the lazy-loaded vendor images). Changed to
    `preload="metadata"`: same autoplay/loop/muted video, same poster fallback, just not fetched
    eagerly at full priority on page load. This is the standard, well-documented fix for this
    exact pattern; I could not fully re-measure the production timing improvement without
    deploying, so that re-measure is step 6 below, not yet done.
  - Removed the dead `/_vercel/insights/script.js` include (Vercel Web Analytics 404ing with a
    `text/plain` MIME type). Confirmed via `vercel project inspect` and a direct fetch that Speed
    Insights (`/_vercel/speed-insights/script.js`) is actually enabled and returns 200; left that
    one alone.
  - Moved `Content-Security-Policy-Report-Only` to an enforced `Content-Security-Policy` in
    `vercel.json`. The existing allowlist was missing three hosts the Behold Instagram widget
    actually calls (`feeds.behold.so` for data, `behold.pictures` for thumbnails, and Instagram's
    own video CDN under `*.cdninstagram.com` / `*.fbcdn.net`, which had no `media-src` and was
    falling back to `default-src 'self'`). Added all three, then verified zero CSP violations on
    `/`, `/privacy.html` and `/accessibility.html`: once against production in report-only mode
    (full-page scroll, so the Instagram widget and the map embed both actually load) and again
    locally with the policy genuinely enforced. Screenshots confirm the vendor grid and the
    Instagram feed both render exactly as before.
- **Needs Kazim:** `privacy.html` already tells visitors "We use Vercel Web Analytics and Speed
  Insights," but Web Analytics was never actually turned on for the `miramar` Vercel project,
  that's why it 404ed. Enabling it is a dashboard toggle (Project → Analytics → Enable), not a
  code change, and it is the kind of account-level, possibly-billing-adjacent call `RULES.md`
  routes to a human rather than an agent. Two directions: enable it to match what the privacy
  policy already promises, or edit that page's Analytics section if Web Analytics genuinely isn't
  wanted. I did not touch `privacy.html`.
- **Not yet done:** merge, then step 6 of `RULES.md` (confirm the production deploy is READY,
  fetch the live URL, re-time the load with the video fix live, re-check CSP is enforced with
  zero violations on the real production asset set, confirm the analytics 404 is gone).

## General

- Followed `RULES.md` throughout: own worktree per repo (never the primary checkout), branch
  naming from each repo's own `CLAUDE.md`, `k13-tabguard status` checked before every commit/push,
  smallest fix that resolves each finding, no visible/brand changes applied without flagging them,
  CSP allowlists derived from real captured network requests, build verified, no em dashes.
- Did not run Before & After, drop a journal note, or touch the War Room checkout (James's job,
  per `RULES.md` item 7).
- Worktrees intentionally left in place since nothing merged yet; remove with `git worktree
  remove` once Kazim (or release-engineer) completes the merges.

## Files touched

- `/Users/k13/git-store/worktrees/LobsterLab/lobster_oct01_v1/next.config.mjs`
- `/Users/k13/git-store/worktrees/LobsterLab/lobster_oct01_v1/components/Reviews.tsx`
- `/Users/k13/git-store/worktrees/Miramar/mira_oct01_v1/vercel.json`
- `/Users/k13/git-store/worktrees/Miramar/mira_oct01_v1/website/index.html`

## Risks

- Neither fix is live yet; the two "before/after load time" and "live CSP enforced" verifications
  required by `RULES.md` item 6 are blocked on the merge, not on anything technical.
- The Miramar CSP enforcement is a behavioural change (report-only to blocking). I verified zero
  violations end to end, but a CSP that blocks instead of just logging is the one kind of change
  here with real regression risk if something was missed; worth a quick manual look at the live
  site immediately after that deploy goes out.

## Human gate

**Kazim:** two PRs are ready and waiting on a merge the permission system would not let me do:
- https://github.com/K13-Software-Studio/LobsterLab/pull/47
- https://github.com/K13-Software-Studio/Miramar/pull/41

Plus two color/analytics decisions above ("needs Kazim" in each section) that are genuinely his
call, not mine.

## Next

**qa-test-engineer** (Olga), via the Michael code-review gate, once the PRs are merged and the
production re-checks in `RULES.md` item 6 are run.
