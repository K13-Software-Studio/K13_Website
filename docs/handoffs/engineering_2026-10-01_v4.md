# Engineering handoff — 2026-10-01 consent-gated GA4 analytics (2 repos)

**Agent:** Natalia (frontend-engineer)
**Request:** Kazim, verbal, 2026-10-01 (Tiger sites analytics spec,
`scratchpad/regression/ANALYTICS_SPEC.md`).
**Scope:** two unrelated repos, fixed independently per `RULES.md`. No work landed in
K13_Website itself; this file lives here only because that is this session's home repo.

## Status: Done — 2 PRs open, verified, NOT merged (release-engineer's gate)

Per the task brief, I did not merge. Both PRs are ready for James.

## For Kazim

Both Tiger sites can now measure how they're used, but only once you tell them to: a visitor sees
a consent banner first, and nothing is sent to Google Analytics until they click Allow. It ships
completely off today, no banner even shows, because there's no GA4 ID yet. Once you create the two
GA4 properties and paste each ID into one small file, it turns on with no further code changes.
Both are open pull requests waiting for James to merge.

## A) THG-Website (tigerhospitalitygroup.com)

- **Branch:** `tiger_oct01_v4` · **Worktree:**
  `/Users/k13/git-store/worktrees/THG-Website/tiger_oct01_v4`
- **PR:** https://github.com/K13-Software-Studio/THG-Website/pull/36 (open, not merged)
- **Ported LobsterLab's `lib/analytics.ts` consent pattern** (commits bd7fdec, 4e55837) to vanilla
  JS for a static-HTML site. GA4 only, no GTM, per the spec's house decision.
  - `js/analytics-config.js`: `window.K13_GA_ID = ""`. Kazim creates the GA4 property in Tiger's
    own Google Analytics account; pasting the ID there is the only step left.
  - `js/analytics.js`: consent gate (`localStorage` key `thg-consent`), GA4 loader
    (`anonymize_ip`, `allow_google_signals: false`, `allow_ad_personalization_signals: false`),
    `section_view {section}` (IntersectionObserver, 50% visible, once per page view),
    `cta_click {cta, location}` classified from real clicks: `call`, `email`, `social`,
    `directions`, `careers`, `contact-form-submit`. Banner + a "Cookie Settings" link injected
    into the footer to reopen it, both only when a GA4 ID is actually configured.
  - **Two sections had no `id`** (`vendor-cta-section`, `timeline-section`): added `vendor-cta`
    and `timeline` so their clicks resolve a real `location` instead of `unknown` (`locations`
    was also added to the map section). Found this by testing against the real DOM, not by
    inspection alone: a synthetic click on the vendor email link reported `location: unknown`
    until the ID was there.
  - CSP: both `vercel.json`'s enforced header **and** `index.html`'s own `<meta>` CSP tag (a
    second, separately-enforced policy I found while reading the file; the browser intersects
    both) now allow `googletagmanager.com`, `*.google-analytics.com`,
    `*.analytics.google.com`. Nothing broader.
  - `privacy-policy.html`: new "Cookies and Analytics" section — what GA4 collects, that it only
    runs after consent, how to change the choice (footer link), retention, no selling/sharing
    for ads, CCPA/CPRA wording. **Marked draft, counsel review recommended.**
  - `css/style.css`: `.k13-consent-*` banner styles from the site's own tokens, with a
    `prefers-reduced-motion` fallback. The banner's link color needed its own check: the site's
    existing `--privacy-gold-text` (already flagged in `style.css` as "never actually verified")
    measures 4.49:1 by axe-core on this banner's background, just under the 4.5:1 floor; went one
    step darker to a verified 5.4:1 instead of reusing it as-is.
  - `CLAUDE.md`: new Analytics section recording the ID file, consent key, full event list, and
    CSP contract.
- **Verified locally** with a TEST ID (`G-TEST000000`, never committed), served through a local
  server replaying `vercel.json`'s exact headers:
  - No ID at all: zero banner, zero `Cookie Settings` link, zero requests to any Google domain.
  - Before consent (ID set): zero Google requests.
  - Accept: `gtag` config + `page_view` + every reachable `section_view` + `cta_click` fire with
    correct params, read straight out of the real `/g/collect` request payloads (not inferred).
    Found and fixed a real gap here: the hero section is already past the 50% threshold before a
    visitor decides, so the IntersectionObserver's one-time callback fired while consent was
    still unset and would never fire again after Accept. Fixed by only "consuming" a section's
    tracking slot once it's actually sent, plus a catch-up check on Accept for anything already
    on screen.
  - Decline: zero requests, ever, including after a reload.
  - `axe-core` (desktop + mobile), `index.html` and `privacy-policy.html`, compared against
    `origin/main` as the baseline: zero new violations (the gold-text issue above was caught this
    way, before it ever shipped).
  - Screenshots: `scratchpad/regression/analytics_shots/thg_desktop_banner.png`,
    `thg_mobile_banner.png`.

## B) Miramar (miramarfoodhall.com)

- **Branch:** `mira_oct01_v3` · **Worktree:** `/Users/k13/git-store/worktrees/Miramar/mira_oct01_v3`
- **PR:** https://github.com/K13-Software-Studio/Miramar/pull/42 (open, not merged; this repo's
  GitHub org also moved mid-task from `k13-projects` to `K13-Software-Studio` — updated the
  `origin` remote to the new URL before pushing)
- **Same pattern as THG**, adapted to this site's sections and CTAs.
  - `website/js/analytics-config.js` / `website/js/analytics.js`: same consent gate
    (`localStorage` key `mira-consent`), same GA4 loader settings. Events: `section_view` on
    every top-level section (all already had stable IDs — nothing to add), `cta_click` for
    `call`, `email`, `social`, `directions`, `booking` (the "Get in Touch" celebrations CTA),
    `contact-form-submit`, `booking-form-submit`. The celebrations modal and its form live
    outside `<main>`, detached from the "bookings" section that triggers them, so those two are
    hardcoded to that location rather than resolved from the DOM.
  - **CSP lives in the repo-root `vercel.json`, not `website/vercel.json`** (which carries no
    headers at all) — confirmed by diffing the live `miramarfoodhall.com` response against both
    files before touching either, since trusting the wrong one would have shipped a silent no-op.
    Added `googletagmanager.com`, `*.google-analytics.com`, `*.analytics.google.com`.
  - `website/privacy.html`: this was the one named in the spec as needing a real correction, not
    just an addition — its "Analytics" section claimed Vercel Web Analytics, which was never
    actually enabled. Replaced with the GA4-with-consent truth (collection, consent-only,
    footer-link opt-out, retention, no selling/sharing, CCPA/CPRA wording) and gave Speed
    Insights (real, cookieless, unrelated to this consent gate) its own honest line instead of
    being conflated with GA4. **Marked draft, counsel review recommended.**
  - `website/accessibility.html`: wired the same two scripts so the banner/consent state is
    consistent across every page, not just the home and privacy pages.
  - `website/css/styles.css`: `.k13-consent-*` banner styles from the site's own tokens; its
    existing `--color-teal` already clears 4.8:1 on the banner background, no new color needed.
  - `CLAUDE.md`: new Analytics section, same shape as THG's.
- **Verified locally** the same way as THG, plus the Miramar-specific cases: clicked the real
  "Get Directions" link, an `Instagram` vendor link, the "Get in Touch" celebrations CTA, and
  submitted the celebrations form with required fields filled — all four produced correctly
  classified `cta_click` events (`directions`/`location`, `social`/`vendors`, `booking`/`bookings`,
  `booking-form-submit`/`bookings`) in the real network payloads. `axe-core` (desktop + mobile)
  across `index.html`, `privacy.html`, `accessibility.html`: zero new violations against
  `origin/main`.
  - Screenshots: `scratchpad/regression/analytics_shots/mira_desktop_banner.png`,
    `mira_mobile_banner.png`.

## Needs Kazim

- Nothing blocking. Both GA4 properties still need creating in Tiger's own Google Analytics
  account; the IDs are the only thing missing before either site starts actually measuring
  anything. Neither privacy-page addition has had counsel review.

---

## Status      PASS
## Summary     Ported LobsterLab's consent-gated GA4 pattern to THG-Website and Miramar: a
##             banner gates everything, both ship inert with no ID set, usage events
##             (section_view, cta_click) wired to each site's real sections and CTAs, CSP and
##             privacy pages updated, axe-core clean against origin/main on every touched page.
## For Kazim   Both Tiger sites can now measure what's actually used, but only after a visitor
##             says yes; nothing is on until you create the two GA4 properties and paste in the
##             IDs, and it's completely invisible until then.
## Files       THG-Website: js/analytics-config.js, js/analytics.js, index.html,
##             privacy-policy.html, css/style.css, vercel.json, CLAUDE.md.
##             Miramar: website/js/analytics-config.js, website/js/analytics.js,
##             website/index.html, website/privacy.html, website/accessibility.html,
##             website/css/styles.css, vercel.json (repo root), CLAUDE.md.
## Risks       Both privacy-page edits are draft, not counsel-reviewed. THG's index.html carries
##             a second, separate meta-tag CSP alongside vercel.json's header; both were updated
##             together but any future CSP edit there needs to touch both again. Miramar's repo
##             moved GitHub orgs (k13-projects -> K13-Software-Studio) mid-task; origin remote
##             updated, PR opened against the new location.
## Next        release-engineer (Kate) via Michael's code-review gate, then qa-test-engineer
##             (Olga) for a fresh Chrome pass once an ID is live to test against.
## Human gate  Create the two GA4 properties (Tiger's Google Analytics account) and paste the
##             IDs into each site's analytics-config.js. Counsel review of both privacy-page
##             additions before they're treated as final.
