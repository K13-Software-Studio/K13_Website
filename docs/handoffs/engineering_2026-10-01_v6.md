# Engineering handoff — Tiger sites consent-gated GA4 analytics

**Agent:** Natalia (frontend-engineer) · **Date:** 2026-10-01

## Status
Done — 3 PRs open, none merged (per spec, James merges).

## Summary
Implemented consent-gated GA4 analytics with usage events (`section_view`, `cta_click`) across
three Tiger Hospitality repos, per `ANALYTICS_SPEC.md` and `RULES.md` in the regression-triage
scratchpad. Pattern ported faithfully from LobsterLab's existing, shipped `lib/analytics.ts` /
`ConsentBanner.tsx`: nothing loads before an explicit Accept, the whole module is inert unless an
analytics ID is configured, GA4 only (no GTM on the two new sites), no ads signals.

- **LaVida** (Vite/React SPA): full port — module, banner (restyled to the site's olive/pink
  palette), CSP additions in `vercel.json`, Privacy Policy updated to be consent-aware, footer
  "Cookie settings" link, 7 sections + ~15 CTA points instrumented.
  PR: https://github.com/K13-Software-Studio/LaVida/pull/24 (branch `lavida_oct01_v4`)
- **Egg-Out** (Next.js, pre-launch): full port — module, banner (Capo/farmer/grill look), CSP
  additions in `next.config.ts`, **new** `/privacy` page (didn't exist), footer Privacy + Cookie
  settings links, 5 real content sections instrumented (3 decorative elements correctly skipped).
  PR: https://github.com/K13-Software-Studio/Egg-Out/pull/49 (branch `ego_oct01_v3`)
- **LobsterLab** (Next.js, GA4+GTM already live): scope was narrower per instructions — only
  added `section_view`/`cta_click` alongside its existing named events, no vendor/CSP/banner
  changes, GTM untouched (events also land in GTM's own `dataLayer`).
  PR: https://github.com/K13-Software-Studio/LobsterLab/pull/49 (branch `lobster_oct01_v3`)

Each worked in its own `git worktree` off `origin/main` (never the primary checkout), own branch,
own PR, `--repo K13-Software-Studio/<repo>` on every `gh` call. Worktrees left in place (not
merged yet, so not removed per the house rule's own condition).

## A bug caught by verification (fixed before shipping, same shape in all three)
First implementation had every section's `IntersectionObserver` dedupe itself the instant a
section crossed 50% visible — **including before the visitor had clicked Accept**, since `track()`
silently no-ops without consent but the "already fired" flag was set anyway. That silently dropped
`section_view` for any section visible at load (the hero) forever, even after the visitor later
accepted. Fixed in `TrackSectionView.tsx` (LobsterLab, Egg-Out) and `use-section-view.ts` (LaVida):
while a section is on-screen and consent is still undecided, it polls briefly instead of giving up,
so it fires the moment Accept is clicked. Caught by testing with a throwaway `G-TEST000000` ID and
inspecting `window.dataLayer` before vs. after the fix.

## Files (high-signal, see each PR for the full diff)
- `lib/analytics.ts` / `src/lib/analytics.ts` — the consent-gated module (new in LaVida/Egg-Out,
  untouched in LobsterLab)
- `ConsentBanner.tsx` — new in LaVida/Egg-Out, restyled per-site
- `TrackSectionView.tsx` / `use-section-view.ts` — the section_view mechanism
- `vercel.json` (LaVida) / `next.config.ts` (Egg-Out) — CSP additions
- `src/pages/PrivacyPolicy.tsx` (LaVida, updated) / `src/app/privacy/page.tsx` (Egg-Out, new)
- Per-repo `CLAUDE.md` — new "Analytics" section recording the env var, events, consent rule, and
  "ID pending"

## Verification performed
- `npm run build` (+ `tsc --noEmit` for LaVida) clean on all three; no new lint errors in touched
  files.
- Built each site locally with a throwaway test ID (`G-TEST000000`, never committed, not in any
  commit): confirmed zero requests to Google before consent, zero after Decline, zero banner when
  no ID is configured, `gtag.js` loads only after Accept with **zero CSP violations**.
- `window.dataLayer` inspection confirmed every `section_view`/`cta_click` fires with the correct
  shape once consent is granted. Note: a non-provisioned placeholder GA4 ID does not produce a real
  collect-endpoint network hit (confirmed by direct probing, even a manual `gtag('event', ...)`
  call produces zero network requests) — a Google-edge behavior for unrecognized property IDs, not
  a defect in this code. The dataLayer push, which is what this codebase controls, is what was
  verified instead.
- axe-core (desktop + mobile) on each: the new banner/footer links introduced a handful of
  contrast failures on first pass (LaVida's `--primary` token is ~2.7:1; Egg-Out's footer
  `text-offwhite/40` inherited default is ~3.3:1) — fixed by switching to already-proven
  higher-contrast tokens the sites use elsewhere (`olive-dark` / `text-offwhite/70`). Final state:
  zero new violations on any of the three; all remaining findings are pre-existing and unrelated
  (documented per-repo in each PR body, left alone per "contrast fixes that change a visible
  colour go to needs-Kazim" — these predate this change).
- Screenshots (desktop + mobile) of each banner saved to
  `.../scratchpad/regression/analytics_shots/{lavida,eggout,lobster}_banner_{desktop,mobile}.png`.

## Risks / open items
- **IDs pending**: Kazim creates the GA4 properties in Tiger's own Google Analytics account for
  LaVida and Egg-Out. Code ships safely inert until then.
- **Privacy pages are draft, counsel review recommended** (LaVida's updated section, Egg-Out's new
  page) — flagged in both PR bodies.
- Pre-existing `color-contrast` findings on all three sites (unrelated to this change) are
  documented in each PR but not fixed — out of scope, would change a visible color on already-
  shipped elements.
- LaVida and Egg-Out CTA/section lists are not exhaustive of every single link on the page, just
  the "key actions" the spec names (order online, menu, directions, catering forms, social,
  email); no "call" CTA exists on either site (no tel: link present), so none was added.

## Next
qa-test-engineer (Olga), via the Michael code-review gate, per the standard pipeline — then James
reviews/merges each PR per spec ("do NOT merge" was this agent's own instruction).

## Human gate
None required from this agent; nothing here is irreversible, money-related, or client-facing yet
(all three PRs are open, unmerged, IDs unset). Kazim's own gate is creating the two GA4 properties
whenever he's ready.
