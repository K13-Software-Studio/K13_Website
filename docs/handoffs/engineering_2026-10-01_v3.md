# Engineering handoff — 2026-10-01 colour contrast decisions (4 repos)

**Agent:** Natalia (frontend-engineer)
**Request:** Kazim, 2026-10-01 regression triage, James's final colour contrast calls
(`contrast_decisions.html`, `vote_brand.md`/`vote_a11y.md`/`vote_design.md`,
`DECISIONS.md` items 9-12 in the regression scratchpad).
**Scope:** four unrelated repos, fixed independently per `RULES.md`. No work landed in
K13_Website itself; this file lives here only because that is this session's home repo.

## Status: Done — 4 PRs open, verified, NOT merged (release-engineer's gate)

Per the task brief, I did not merge and did not retry a merge. All four PRs are ready for James.

## For Kazim

Four sites had orange or gold text too faint to read reliably: SD Turf's header and step
cards, LobsterLab's order button and two legal pages, Tiger's Privacy Policy page, and
Egg&Out's order buttons and kickers across the whole site. All four are fixed using your
team's already-approved colours (nothing new chosen), proven with a real accessibility
scanner before and after, and are sitting as four pull requests waiting for James to merge.

## A) SD Turf — DECISIONS.md item 9

- **Branch:** `turf_oct01_v1` · **Worktree:** `/Users/k13/git-store/worktrees/SD_Turf/turf_oct01_v1`
- **PR:** https://github.com/K13-Software-Studio/SD_Turf/pull/16 (open)
- **Applied exactly as decided** (James took Valentina's ALT over the original invented-green
  proposal): rebuilt on SD Turf's real tokens, not new colours.
  - `Header.tsx`: "Center" wordmark `text-grass` (#2fa84f, 2.74:1 on cream) → `text-grass-dark`
    (#1e7a39). **Verified 4.81:1** (hand-computed WCAG relative luminance, matches Valentina's
    claim exactly).
  - `ScrollStory.tsx` (the live "How it works" section — `Process.tsx` carries the identical
    markup but is dead code, not imported anywhere, left untouched): step numerals
    `text-lime/80` (1.91:1) → full `text-lime`, **verified 6.46:1**; step body copy
    `text-cream/70` (2.16:1) → `text-cream-deep`, **verified 9.58:1**.
  - Background `--color-fern` and the step titles (`text-white`, already ~14:1) were not touched.
- **Axe-core, desktop + mobile, before (production) vs after (local `pnpm build && pnpm start`):**
  all 3 targeted violation categories (header label, 4× numeral, 4× body copy) gone after the
  fix. 7 pre-existing, unrelated violations (footer `hover:text-cream` links, copyright line,
  a "Sale" badge, a struck-through price) are present in both before and after — not part of
  item 9, left alone.
- **Methodology note:** SD Turf's `Reveal`/`ScrollStory` components animate opacity on
  scroll-trigger; a raw axe scan on page load produces false-positive contrast failures on
  content still at `opacity:0`. Fixed by emulating `prefers-reduced-motion: reduce` (which this
  site's own components already gate behind, same as every K13 site's house standard) plus a
  full-page scroll pass before scanning.
- **Build:** `pnpm build` passes clean.
- **Screenshots:** `contrast_shots/sdturf_header_{before,after}_desktop.png`,
  `sdturf_steps_{before,after}_desktop.png`, `sdturf_footer_{before,after}_desktop.png`.

## B) LobsterLab — DECISIONS.md item 10

- **Branch:** `lobster_oct01_v2` · **Worktree:**
  `/Users/k13/git-store/worktrees/LobsterLab/lobster_oct01_v2`
- **PR:** https://github.com/K13-Software-Studio/LobsterLab/pull/48 (open)
- **Applied exactly as decided:** kept the Pantone 1505C brand orange (#fe6700) everywhere it's
  a fill or large display text; scoped a darker text-only pair to the one failing button.
  - New tokens in `globals.css`: `--color-order-btn` (#c65000) and `--color-order-btn-hover`
    (#a24200, darker still, per the decision). **Verified 4.62:1** on white (matches Valentina/
    Olga's 4.62:1 exactly); hover computes to 6.33:1.
  - `Nav.tsx`: the two hardcoded "Order Online"/"Order now" buttons (2.94:1 fail) now use the
    new token. The shared `Buttons.tsx` `OrderOnlineButton` used elsewhere was already navy and
    untouched — only `Nav.tsx`'s own duplicate buttons had the bug.
  - `privacy/page.tsx`, `terms/page.tsx`: 4 mailto/accessibility links `text-orange` (2.94:1) →
    the existing `--color-navy` token. **Verified 11.4:1** (matches Valentina's claim).
- **Left untouched (pre-existing, outside item 10's literal scope — a button and "links", not
  these):** the italic hero line, the WordmarkWall background texture (both already flagged
  for Kazim in the prior engineering handoff), the footer copyright line, and the "Effective
  date" lines on /privacy and /terms. All still fail; flagging for a future decision round.
- **Axe-core, desktop + mobile, before vs after (local `npm run build && npm run start`):** the
  4 targeted violations gone; the out-of-scope items above present in both before and after
  (not a regression).
- **Build:** `npm run build` passes clean.
- **Screenshots:** `contrast_shots/lobster_nav_order_btn_{before,after}.png` (1440×900, same
  bounding box both times, orange darkens visibly), `lobster_privacy_link_{before,after}_desktop.png`,
  `lobster_terms_link_{before,after}_desktop.png`.

## C) Tiger (THG-Website) — DECISIONS.md item 11

- **Branch:** `tiger_oct01_v3` (v1/v2 were already taken by other fixers' PRs #33/#34, merged
  earlier today) · **Worktree:** `/Users/k13/git-store/worktrees/THG-Website/tiger_oct01_v3`
- **PR:** https://github.com/K13-Software-Studio/THG-Website/pull/35 (open)
- **Applied exactly as decided:**
  - `--luxury-gold` (#b8954d) in `css/style.css` keeps its value — it genuinely passes against
    the dark hero/nav it's normally used on — but its comment claiming "Darkened for WCAG AA
    contrast compliance" was never actually true on white (2.82:1) and was never verified.
    Corrected the comment to say exactly that, and point at the new page-scoped value.
  - `privacy-policy.html`: new `--privacy-gold-text` (#8b7038) defined inside this page's own
    `<style>` block, scoped to `.privacy-container` only — the shared token is not touched
    anywhere else on the site. **Verified 4.70:1** on white (matches Valentina/Olga's 4.70:1
    exactly). Applied to both "Back to Home" links and all 11 section headings.
  - Audited the whole repo for any other comment claiming "WCAG": this was the only one.
- **Axe-core, desktop + mobile, before (production) vs after (local `node server.js` on
  :9131):** 26 violations → **0**.
- **No build step** (static HTML/CSS/Express); confirmed serving correctly.
- **Screenshot:** `contrast_shots/tiger_privacy_{before,after}_desktop.png`.

## D) Egg&Out — DECISIONS.md item 12

- **Branch:** `ego_oct01_v2` (never touched `ego_sep29_v2`, per instruction; `ego_oct01_v1` was
  another fixer's already-merged security-header PR) · **Worktree:**
  `/Users/k13/git-store/worktrees/Egg-Out/ego_oct01_v2` (app in `egg-out-web/`)
- **PR:** https://github.com/K13-Software-Studio/Egg-Out/pull/48 (open)
- **Applied exactly as decided:** kept the vivid Farmer Yolk `#f26a22` fills everywhere; only
  text sitting on them, or sitting as orange text itself, changed.
  - New `--color-farmer-text` (#b7460b) in `globals.css`, text-only. **Verified 4.51:1** on
    offwhite (matches Valentina/Olga's independently-verified 4.51:1 exactly — confirmed "near
    the mathematical floor" as they both noted). `--color-farmer` itself untouched.
  - CTA button text on farmer fills — Nav, Hero, Menu, Catering, the catering-form submit in
    Modals, and the Marquee ticker (large bold text, but still fails even the 3:1 large-text
    floor at 2.56:1, so in scope) — moved from `text-offwhite` to `text-grill`, the site's
    existing dark ink token. **Verified 5.26:1.**
  - Every kicker/price/accent-dot using orange as small text on offwhite (Hero, Locations,
    Menu, About, the order modal's kicker — 13 spots across 7 files) moved to
    `text-farmer-text`, including the scroll-animated step list's inline colour interpolation
    in `SandwichAssembly.tsx` (`rgba(33,33,33,0.35)` → `#f26a22` becomes `0.65` → `#b7460b`)
    and its reduced-motion static counterpart.
  - Translucent grill captions between `/35` and `/60` (11 spots, both discrete Tailwind
    classes and the same scroll-driven inline interpolation) raised uniformly to `/65` — the
    smallest opacity that clears 4.5:1 on offwhite. **Verified 4.68:1**, a real margin over the
    floor per the house rule to aim ≥0.1 above it.
  - Found mid-fix: the step-number prefixes ("01"–"07") carried an extra `opacity-50` on top of
    their already-fixed parent colour, compounding back down to a fail (e.g. 0.65 × 0.5 =
    0.325 effective). Removed it so the numerals inherit the now-passing parent colour at full
    strength — same underlying issue, same component, not a new colour decision.
  - The Footer "Say hi." accent dot sits on the dark `bg-grill` footer, not offwhite, where
    `#f26a22` already passes (5.26:1); correctly left as `text-farmer`.
- **Left untouched (pre-existing, different token pair, not item 12):** the footer's own
  copyright/address lines (`text-offwhite/40` on `bg-grill`) still fail; flagging for a future
  decision round.
- **Axe-core, desktop + mobile, full-page scroll, reduced-motion emulated, 5-s KineticIntro
  splash skipped before scanning (it visually covers the Hero CTA at the same screen position
  for the first few seconds of every fresh visit):** before (production) 53 unique violation
  nodes → after (local `npm run build && npm run start`) 1 unique node (the out-of-scope
  footer line above).
- **Build:** `npm run build` passes clean.
- **Screenshots:** `contrast_shots/eggout_hero_order_btn_{before,after}.png`,
  `eggout_nav_order_btn_{before,after}.png`, `eggout_hero_{before,after}_desktop.png`.

## Methodology notes (apply to all four)

- All ratios were independently re-derived from the WCAG relative-luminance formula by hand
  (not copied from `contrast_decisions.html` or the vote files), per `RULES.md` item 4 /
  `DECISIONS.md`'s header instruction. Every one matched Valentina's/Olga's claimed numbers.
- Playwright + axe-core (`axe-core@4.13`, `color-contrast` rule only), desktop (1440×900) and
  mobile (390×844) viewports, `mailto:`/`tel:` routes aborted per `RULES.md` item 9.
- Egg-Out's local `next start` intermittently served a stale `.next` chunk manifest after a
  rebuild-without-killing-the-old-process (wrong CSS filename → 500 → unstyled page → false
  "passing" axe reads). Root-caused and fixed by killing the server by PID and confirming the
  HTML's referenced chunk hash matches what's actually on disk before trusting any scan against
  it — worth knowing if a future local test on this repo looks suspiciously clean or suspiciously
  broken.
- Script: `.../scratchpad/regression/contrast_axe_oct01.mjs` (full run) and
  `contrast_buttons_shot.mjs` (the two priority button screenshots), both left in the regression
  scratchpad alongside their JSON report.

## Files touched

- SD_Turf: `src/components/Header.tsx`, `src/components/sections/ScrollStory.tsx`
- LobsterLab: `app/globals.css`, `app/privacy/page.tsx`, `app/terms/page.tsx`, `components/Nav.tsx`
- THG-Website: `css/style.css`, `privacy-policy.html`
- Egg-Out: `egg-out-web/src/app/globals.css`, `About.tsx`, `Catering.tsx`, `Hero.tsx`,
  `Locations.tsx`, `Marquee.tsx`, `Menu.tsx`, `Nav.tsx`, `SandwichAssembly.tsx`, `modal/Modals.tsx`

## Risks

- None of the four fixes are live yet; the `RULES.md` item 6 production re-verification (Vercel
  deploy READY + live-URL re-check) is blocked on James's merge, not on anything technical.
- Every repo still carries pre-existing, out-of-scope contrast failures noted above (not
  introduced by this work, not fixed by this work, explicitly outside DECISIONS.md items 9-12).
- Worktrees intentionally left in place since nothing is merged yet; remove with
  `git worktree remove` once James completes each merge.

## Human gate

**James:** four PRs ready to merge, in this order or any order (independent repos):
- https://github.com/K13-Software-Studio/SD_Turf/pull/16
- https://github.com/K13-Software-Studio/LobsterLab/pull/48
- https://github.com/K13-Software-Studio/THG-Website/pull/35
- https://github.com/K13-Software-Studio/Egg-Out/pull/48

No "needs Kazim" items from this pass — every value in DECISIONS.md items 9-12 was already his
approved call; I applied them as written and verified the math independently.

## Next

**qa-test-engineer** (Olga), via the Michael code-review gate, once James merges and the
production re-checks run. Suggested focus per repo: SD Turf's step-card motion still reads
correctly at a real scroll speed; LobsterLab's new hover state on the Order button; Tiger's
Privacy Policy page on a phone; Egg&Out's KineticIntro skip path and the step-list scroll scrub,
since both were the trickiest things to verify in this pass.
