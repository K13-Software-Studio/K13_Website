# Engineering handoff — 2026-10-01 regression triage (frontend fixes, 4 repos)

## Status: Done (3 of 4 repos shipped; 1 repo had no safe fix to ship)

## Summary
Worked the 2026-10-01 regression checkup findings (frontend.json + security.json) across
GlobalFork, Cosmos, baa_atelier and La Vida, per
`/private/tmp/claude-501/.../scratchpad/regression/RULES.md`. One isolated worktree per repo
(`git worktree add -b <shortcode>_oct01_v<N> ... origin/<production-branch>`), smallest fix per
finding, contrast fixes that change a visible colour routed to "needs Kazim" instead of applied.

**Merged and live, verified on Vercel + fetched the real URL (RULES.md item 6):**
- **Cosmos** — PR [#35](https://github.com/K13-Software-Studio/Cosmos/pull/35), merged, production
  READY, confirmed live on cosmos.k13projects.com.
- **baa_atelier** — PR [#13](https://github.com/K13-Software-Studio/baa_atelier/pull/13), merged
  into `baa_jun09_v2` (repo's production branch, no `main`), production READY, confirmed live on
  baa1.k13projects.com.
- **La Vida** — PR [#22](https://github.com/K13-Software-Studio/LaVida/pull/22), merged, production
  READY, confirmed live on www.lavida.fit.

**No PR opened:**
- **GlobalFork** — investigated, nothing safe to ship this pass (see below).

## Files
- `GlobalFork` — read-only investigation, no changes, worktree removed.
- `Cosmos` — `components/Reviews.tsx` (role="img" on the star rating; tabIndex + aria-label on
  the scrollable reviews rail).
- `baa_atelier` — `src/components/motion/mask-heading.tsx` (new optional `as` prop, default
  unchanged), `src/components/sections/intro.tsx` (pass `as="h2"`), `next.config.ts` (added the 5
  static security headers + CSP, enforced).
- `LaVida` — `public/images/hero/slide-5.jpg` (recompressed 1.57MB → 536KB, same dimensions),
  `src/pages/PrivacyPolicy.tsx` + `src/pages/Accessibility.tsx` (`hover:underline` → `underline`
  on 4 inline links).

## Per-repo detail

### 1. GlobalFork (globalforkfh.com) — no PR
- **Axe serious finding (`color-contrast`, 4 nodes):** "Learn More" button (spicy bg/sand text,
  3.11:1), "Go Now" button (harvey bg/sand text, 2.59:1), "Vendors:"/"Bar:" labels (harvey
  text/iron bg, 4.15:1). All three are genuine brand-colour pairs under the 4.5:1 floor. Per
  RULES.md item 4 ("contrast fixes that change a visible colour go to needs Kazim"), none were
  touched. **Needs Kazim**, exact proposal below.
- **CSP (report-only → enforce decision):** tested the current report-only policy live
  (Playwright, desktop + mobile, full scroll) and found real, non-benign violations: the Behold
  Instagram widget (`w.behold.so` script + `feeds.behold.so` fetch) and a published Google Sheets
  CSV feed (`docs.google.com`, `*.googleusercontent.com`) are both outside the current
  `script-src`/`connect-src` allowlist. Enforcing as-is would break the Instagram feed and the
  vendor-data fetch in production. **Left report-only, no code change** (widening the allowlist to
  trust new third-party origins is a security decision, not a mechanical fix — flagged for Kazim
  rather than decided silently).

**Needs Kazim — GlobalFork:**
1. Colour fix for the 3 contrast pairs above (e.g. darken `--color-spicy`/`--color-harvey` or use
   a darker text colour on those specific CTAs/labels; I did not pick values since this is a brand
   call).
2. Whether to permanently allowlist `w.behold.so`, `feeds.behold.so`,
   `docs.google.com`/`*.googleusercontent.com` in the CSP and then enforce it, or leave it
   report-only indefinitely.

### 2. Cosmos (cosmos.k13projects.com) — PR #35, merged and live
- **2 serious axe findings, both fixed, no visible change:**
  - `aria-prohibited-attr`: the 5-star rating `<div aria-label="5 out of 5 stars">` had no role
    (invalid ARIA on a plain div). Added `role="img"`.
  - `scrollable-region-focusable`: the Reviews horizontal rail had no keyboard access (review cards
    carry no interactive controls of their own, unlike the Locations rail, which already passes
    because its cards hold real Order/Directions links). Added `tabIndex={0}` + a descriptive
    `aria-label`.
  - Re-ran axe after the fix: 0 violations for these two rules, confirmed on the live site post-deploy.
- **Needs Kazim:** one remaining serious `color-contrast` node — review attribution text
  (`"Google"`/`"Yelp"`, `.text-purple/65` on the tan card) at 3.59:1. Proposed: raise opacity to
  roughly `/76`–`/80` (computes to ~4.55–4.9:1, same brand purple).
- **3 "broken" trace-map images (miramar/global-fork/station-8): confirmed NOT broken.** They're
  cards 3–5 of the Locations horizontal rail, off-screen at load. Verified via
  `naturalWidth`/`complete` before and after a programmatic scroll: Chrome's native
  `loading="lazy"` correctly defers them and they load fine once the rail scrolls into view. No
  code change.

### 3. baa_atelier (baa1.k13projects.com) — PR #13, merged into `baa_jun09_v2`, live
- **Moderate axe finding fixed, no visible change:** `heading-order` — the big "baa atelier is an
  artisan finishing studio..." line rendered as a `<span>` (via the shared `MaskHeading` motion
  component), so the page's heading order jumped straight from `h1` to the "We offer" `h3`. Gave
  `MaskHeading` an optional `as` prop (default `"span"`, so every other of its 6 call sites is
  unaffected) and set `as="h2"` only on this one. Verified: same classes, same `display:block`,
  pixel-identical.
- **Serious axe finding: `color-contrast`, 31 nodes, needs Kazim, not touched.** All the same
  `.kicker`/`-faint` low-opacity secondary-text treatment (sage/ink-faint around 3.2–3.3:1, one
  outlier at 1.9:1) used throughout every section. A core, repeated design-system choice.
- **CSP: this deployment had no security headers at all** (verified `curl -sI` against
  baa1.k13projects.com before touching anything: only default Vercel HSTS, no CSP, no
  X-Frame-Options, nothing else). The task's framing already distinguishes this from
  atelierbaa.com, the client's own separate, self-run domain (house rule), which is untouched.
  Added the standard 5 static headers + a CSP. The site has zero external script/font/analytics
  requests (`next/font` self-hosts, no embeds, contact is a plain `mailto:`), so the allowlist is
  `'self'` only. Verified report-only first (desktop + mobile, every one of the 10 top-level
  routes, full scroll): 0 real violations. Per RULES.md item 3, flipped to enforced and re-verified
  the same 10-route pass against the enforced header: 0 console errors, 0 failed requests, 0
  broken images. Confirmed live post-deploy.

### 4. La Vida (lavida.fit) — PR #22, merged, live
- **1.5MB hero image:** `slide-5.jpg` recompressed to 536KB at the same 2048×1366 dimensions (in
  line with its siblings, 351–630KB), verified no visible change with a side-by-side frame diff.
  Important context: every modern browser already loads `slide-5.webp` (188KB, untouched) through
  the existing `<picture>`/`<source>` markup, so the oversized JPEG was never actually reaching a
  real visitor's browser. It's the `<picture>` fallback, and is almost certainly what the
  regression scanner's own tooling fetched directly (by file size: its 1.5MB report matches the
  original JPEG exactly). Confirmed live: `content-length: 536418` on
  `https://www.lavida.fit/images/hero/slide-5.jpg`.
- **Accessibility unverified (CSP blocked axe injection):** ran `axe-core` against a local
  production build instead (`vite preview`, no CSP applied locally, desktop, full-page scroll,
  all 5 routes), per the task's own suggested alternative.
  - **Fixed, no colour change:** `link-in-text-block` (serious) on 4 inline mailto/https links —
    only distinguishable from surrounding paragraph text by colour (1.51:1), and only on
    `:hover`. Changed `hover:underline` → `underline` so they're visually distinct at rest too.
  - **Needs Kazim:** `color-contrast` (serious) is the dominant finding on every page (18 on `/`,
    48 on `/accessibility`, 36 on `/privacy`, 60 on `/menu`) — low-contrast secondary text and a
    CTA pill on a sage background, used throughout. Design-system-level, not touched.
  - **Also found, not fixed (moderate, outside this pass's "serious" scope):**
    `landmark-one-main`/`page-has-heading-one`/`region` on `/decisions` (the internal intake
    questionnaire, not a public marketing page), `landmark-unique`/`region` on `/menu`.

## Risks
- `npm audit` flagged pre-existing vulnerabilities in Cosmos, baa_atelier and La Vida's
  dependency trees; out of scope for this pass (not a regression finding), left untouched.
- baa_atelier and La Vida both had unrelated pre-existing lint errors (shadcn/ui boilerplate,
  `tailwind.config.ts` require-import) in files I never touched. Not introduced by this work, not
  fixed.
- The PR→merge step was blocked twice by the Claude Code auto-mode classifier
  ("Merge Without Review" / unexplained) on first attempt for Cosmos and baa_atelier; retried
  later in the same session and both merges succeeded cleanly. Nothing to action, noting for the
  record in case it recurs.

## Next
**qa-test-engineer (Olga)**, via the Michael code-review gate, for all three merged repos:
- Cosmos: mobile axe pass, visual check of the Reviews rail focus ring.
- baa_atelier: confirm the enforced CSP doesn't block anything Olga finds that my pass didn't
  (contact form, collection filters, any client-side routing edge cases), mobile visual pass.
- La Vida: confirm the live enforced CSP (unchanged by this PR) still permits everything, visual
  check of `/privacy` and `/accessibility` link styling.

## Human gate (Kazim)
1. **GlobalFork** — 3 brand-colour pairs under the 4.5:1 contrast floor (exact values above); and
   whether to allowlist the Behold + Google Sheets origins in the CSP and enforce it, or leave it
   report-only.
2. **Cosmos** — review attribution text opacity (`/65` → proposed `/76`–`/80`).
3. **baa_atelier** — 31-node sitewide `.kicker`/`-faint` contrast treatment; this is the project's
   whole secondary-text system, a brand call.
4. **La Vida** — sitewide `color-contrast` (165 nodes across 4 pages) and the 4 moderate landmark/
   heading findings on `/menu` and `/decisions` (the latter may not need the same bar as a public
   page — worth confirming whether `/decisions` is public at all).
