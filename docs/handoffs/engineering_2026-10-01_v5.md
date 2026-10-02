# Engineering handoff — 2026-10-01 consent-gated GA4 analytics (3 Tiger repos)

**Agent:** Natalia (frontend-engineer)
**Request:** Kazim, 2026-10-01 (`ANALYTICS_SPEC.md` + `RULES.md` in the regression scratchpad)
**Scope:** three unrelated repos, each in its own worktree, each shipped through its own
branch → PR. No work landed in K13_Website itself; this file lives here only because that is
this session's home repo.

## Status: Done — 3 PRs open, verified locally, NOT merged (release-engineer's gate, per spec)

Spec line 3: "open the PR and stop; do NOT merge (James merges)." All three PRs are ready for
James. The code is inert on every repo (no `NEXT_PUBLIC_GA_ID` set anywhere), so merging alone
changes nothing live until Kazim creates the GA4 properties.

## Decisions (Kazim's, already made in the spec, recorded here for traceability)
- GA4 only, no Google Tag Manager, one property per site in Tiger's own GA account (Kazim
  creates them; IDs pending).
- Consent pattern ported from LobsterLab's `lib/analytics.ts` / `ConsentBanner.tsx`: nothing
  loads before explicit opt-in, nothing loads without an id configured.
- Shrey gets no access to the new sites and is not mentioned anywhere in these repos (confirmed:
  not referenced in any file I touched).

## Per repo

### STATION8 — PR [#22](https://github.com/K13-Software-Studio/STATION8/pull/22) (`st8_oct01_v3` → `main`)
- **Files:** `lib/analytics.ts`, `features/analytics/{ConsentBanner,SectionViewTracker,TrackedCtaLink}.tsx`,
  `app/layout.tsx`, `app/page.tsx`, `features/bookings/BookingsModal.tsx`, `features/contact/Footer.tsx`,
  `next.config.ts`, `app/privacy/page.tsx`, `app/cookies/page.tsx`, `CLAUDE.md`.
- **Events wired:** `section_view` on `hero`, `tagline`, `who-we-are`, `vendors`, `events`, `bookings`,
  `visit-us`, `contact` (hero/tagline gained ids). `cta_click` slugs: `directions` (visit-us),
  `booking_form` (bookings), `email` (contact, both inquiry mailtos), `social` (contact, Instagram).
- **CSP:** `script-src`/`img-src` gain `googletagmanager.com`; `connect-src` was already
  `'self' https:` (any host), so GA4's collect hosts needed no change there.
- **Verification:** zero Google requests pre-consent, Accept loads only `gtag.js`, Decline and
  no-id both silent, zero CSP console violations. axe-core: one pre-existing sitewide
  color-contrast finding (sand-stone/70 footer text, 31 nodes, confirmed against `origin/main`
  baseline) gains one more node (the new "Cookie settings" link, same classes as its four
  siblings) rather than a new violation category. `pnpm build`/scoped `lint` clean on every file
  touched; `pnpm typecheck` and the rest of `pnpm lint` have pre-existing failures in
  `lib/event-lifecycle.test.ts` / `lib/events.test.ts`, confirmed unrelated and unchanged from
  `origin/main`.
- **Needs Kazim:** create the GA4 property, set `NEXT_PUBLIC_GA_ID` on Vercel. The footer
  contrast finding is pre-existing and a visible-color change, flagged in the PR body, not fixed
  here.

### Global Fork — PR [#27](https://github.com/K13-Software-Studio/GlobalFork/pull/27) (`gf_oct01_v5` → `main`)
- **Files:** `src/lib/analytics.ts`, `src/components/{ConsentBanner,SectionViewTracker,TrackedPillButton}.tsx`,
  `src/components/PillButton.tsx` (added a forwarded `onClick`), `src/app/layout.tsx`, `src/app/page.tsx`,
  `src/components/sections/{Hero,Visit,Bookings,SiteFooter}.tsx`, `next.config.ts`,
  `src/app/{privacy,cookies}/page.tsx`, `CLAUDE.md`.
- **Events wired:** `section_view` on `hero`, `tagline`, `about`, `vendors`, `events`, `bookings`,
  `visit`, `follow`, `contact` (hero gained an id, the rest already had one). `cta_click` slugs:
  `directions` (visit), `booking_inquiry` (bookings), `email` (contact, both inquiry mailtos),
  `social` (contact, Instagram).
- **CSP:** the existing enforced CSP (Behold widget + published-Google-Sheets allowlist, from
  `docs/handoffs/security_2026-10-01.md`) is kept exactly as-is; GA4 origins are additive only on
  `script-src`, `img-src`, `connect-src`.
- **Verification:** zero Google requests pre-consent, Accept loads only `gtag.js` with zero CSP
  console errors (Behold and the Sheets feed both still load), Decline and no-id both silent,
  **zero axe-core violations** on every page tested, with and without the banner open. `pnpm
  build` and scoped `eslint` on every touched file are clean. The repo's two pre-existing eslint
  errors (`BeholdWidget.tsx` namespace, `SmoothScroll.tsx` set-state-in-effect) are unchanged
  from `origin/main`; the identical pattern in the new `ConsentBanner.tsx` is suppressed with a
  one-line justification (reading browser-only localStorage for first-paint visibility can't be
  computed during render without a hydration mismatch).
- **Needs Kazim:** create the GA4 property, set `NEXT_PUBLIC_GA_ID` on Vercel.

### Cosmos — PR [#37](https://github.com/K13-Software-Studio/Cosmos/pull/37) (`cosmos_oct01_v3` → `main`)
- **Files:** `lib/analytics.ts`, `components/{ConsentBanner,SectionViewTracker}.tsx`,
  `components/Buttons.tsx` (added `cta_click` to the two shared modal-open buttons),
  `components/{Locations,CateringSection,Footer}.tsx`, `components/{Values,BestSellers,Reviews}.tsx`
  (gained section ids), `app/layout.tsx`, `app/page.tsx`, `next.config.mjs`, `app/privacy/page.tsx`,
  `CLAUDE.md`.
- **Events wired:** `section_view` on `top`, `about`, `values`, `best-sellers`, `menu`, `catering`,
  `locations`, `reviews`, `contact`. `cta_click` slugs: `order_online` (menu or locations,
  depending which instance of the shared button fired), `menu` (menu), `directions` and `call`
  (locations), `catering` (catering), `email` and `social` (contact).
- **CSP:** this repo's static CSP was previously scoped tight to `'self'` with no third parties
  at all (by design, per its own comment: "revisit the day analytics is added"); `script-src`,
  `img-src`, `connect-src` now also allow GA4's hosts.
- **Verification:** zero Google requests pre-consent, Accept loads only `gtag.js` with zero CSP
  console errors, Decline and no-id both silent, **zero axe-core violations** on every page
  tested. `next build` (full TS check included) and an explicit `tsc --noEmit` both pass clean.
- **Could not verify:** `npm run lint`. This repo has never had an ESLint config committed
  (confirmed on `origin/main` before my branch, not something this PR removed); `next lint`
  only offers an interactive first-run setup prompt, which is out of scope for this task to
  decide on Kazim's behalf. Flagged in the PR body under "needs Kazim" rather than silently
  skipped or silently fixed.
- **Needs Kazim:** create the GA4 property, set `NEXT_PUBLIC_GA_ID` on Vercel. Separately decide
  whether Cosmos should get an ESLint config at all (pre-existing gap, unrelated to analytics).

## Common verification method (all three)
Built locally with `NEXT_PUBLIC_GA_ID=G-TEST000000` (local `.env.local`, gitignored, never
committed, removed before the final build/commit). Playwright against the production server:
before consent (0 Google requests, banner visible), Accept (gtag.js request fires, 0 CSP
console errors), section scroll and CTA clicks (handlers fire without throwing), Decline +
reload (0 Google requests, banner stays hidden), footer "Cookie settings" reopens the banner.
axe-core run on every legal page plus the home page. Desktop (1440×900) and mobile (390×844)
screenshots of the banner captured for each site, reviewed visually against each brand
(screenshots live in the regression scratchpad, not committed to any repo).

## Risks
- None of the three sites can send a real GA4 hit yet, by design, until Kazim sets the id; this
  was true at the start of this task and is unchanged.
- STATION8's footer contrast debt (pre-existing) now has one more affected node from the new
  "Cookie settings" link, inheriting the same pattern as its four siblings. Not a new defect
  class, flagged for a separate visible-color decision.
- Cosmos has no lint tooling at all; nothing this task did makes that worse, but it also means
  the lint gate genuinely could not run there.

## Files (handoff only, not committed)
- This file: `docs/handoffs/engineering_2026-10-01_v5.md`
- Screenshots: scratchpad `analytics_shots/{station8,globalfork,cosmos}-consent-{desktop,mobile}.png`

## Next
**Human gate:** Kazim creates the three GA4 properties and sets `NEXT_PUBLIC_GA_ID` on each
Vercel project; until then, merging is safe but changes nothing live.
**Next agent:** release-engineer (Kate) for the merge decision on all three PRs, once reviewed.
Then qa-test-engineer (Olga) only if Kazim wants a second Chrome pass before merge; the spec's
own verification (above) already covers the consent/CSP/axe gates the house QA pass would check.
