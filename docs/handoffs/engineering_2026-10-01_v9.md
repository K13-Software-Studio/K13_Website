# Engineering handoff — 2026-10-01 regression triage: banner + analytics fixes (4 repos)

Natalia (frontend-engineer). Followed `RULES.md` and `GA_FIX.md` from the regression scratchpad.
One PR per repo, own worktree off fresh `origin/main`, did not merge.

## What I found before fixing anything

STATION8 and GlobalFork already had consent-gated GA4 analytics and the gtag `arguments`-array
bug fix merged to `origin/main` by another session earlier the same day (PRs already merged:
STATION8 #20–23, GlobalFork #24–28). Primary checkouts of both repos were stale (hadn't fetched),
which is why the analytics files looked absent when I first searched the working tree — they were
on `origin/main`, not in the local checkout. My work built on top of those merges.

## Per repo

### STATION8 — PR #24 (open, not merged)
**cta_click never reached Google on the "GO NOW" directions link**, confirmed real cause: it
navigates to maps.apple.com in the same tab, and gtag's default transport was racing the
navigation and losing — the click fired client-side but the request never left before the page
tore down. Fixed with `transport_type: "beacon"` in `trackCtaClick` (`lib/analytics.ts`), which
uses `navigator.sendBeacon`, built specifically to survive that handoff. I tried a fancier
`preventDefault` + `event_callback` + 300ms-delayed-navigation approach first (the GA_FIX.md
alternative) but reverted it: in this sandbox, programmatic `window.location.href` reassignment to
an external origin didn't navigate at all (confirmed independent of any of my code — a raw
`page.evaluate("window.location.href=...")` also never moved the page), which means that pattern
risks a visitor getting stuck on a click that should have taken them to directions. The simpler
beacon-only fix has no such failure mode and is the first option the task itself offered.

Also audited every CTA category named in the finding (directions, booking, email, phone, social,
order): the empty-state "Follow @station8publicmarket for updates" button (this site's other
primary CTA, paired with Go Now in its own code comment) had no tracking at all — wired it. No
phone or order links exist on this site yet. One em dash on the privacy page fixed too.

**Proof:** `gtag()` fires with the correct event/cta/transport_type synchronously inside the click
handler, measurably before the navigating request (timing trace). A representative non-navigating
CTA (footer email link), same `track()`/beacon code path, round-trips through the real collect
endpoint with `ep.cta=email`, 0 CSP violations. axe-core 0 violations on the banner (desktop +
mobile). `tsc`/`biome` clean (two pre-existing TS errors in unrelated test files, confirmed present
on `origin/main` before my change, not touched).

### GlobalFork — PR #29 (open, not merged)
Same `transport_type: "beacon"` fix in `trackCtaClick`. This site's `PillButton` already opens
external links in a new tab by default, so it wasn't hitting the exact same-tab race STATION8 was,
but `cta_click` also fires from an in-page anchor (`Bookings`' `href="/#contact"`) and beacon is a
free, reliable default against any future same-tab CTA. Audited the same CTA categories: directions
and booking_inquiry were already wired; the Events section's empty-state "Follow" button (identical
pattern to STATION8) had no tracking — wired it. Three em dashes on the privacy page fixed
(title x2, service-provider list).

**Proof:** real-hit, context-level interception of the GA4 collect endpoint — accept, then click
directions and Follow, both land with the correct `ep.cta` (`directions`, `social`) and 0 CSP
violations. `booking_inquiry`/email use the identical code path. axe-core 0 violations. `tsc`/
`eslint` clean. Production build succeeds (discarded an incidental `pnpm-workspace.yaml` change
that `pnpm approve-builds` made on its own, unrelated to this fix).

### LobsterLab — PR #51 (open, not merged)
All four QA items:
- **(a)** Footer "Cookie settings" link added (matches the other five Tiger sites), dispatches
  `cookie-settings:open`; `ConsentBanner` now listens and reopens regardless of stored decision.
- **(b)** Banner's "Privacy Policy" link: `#fe6700` on white (2.93:1) → `--color-navy` `#013a71`
  (~11.4:1), the site's own body-text token, already in use elsewhere.
- **(c)** Mobile banner was covering the last line of the hero's intro headline on first paint
  (measured 86px overlap at 390x844). Padding at the end of the page can't fix a zero-scroll
  overlap, so I had `ConsentBanner` publish its own measured height as a CSS variable
  (`--consent-banner-h`) while open, and `Hero`'s mobile image height now subtracts it via
  `calc()`. `sm:`/`lg:` untouched — now clears by 32px at 390x844. **Noticed but did not fix:** the
  same overlap exists at 1440x900 on `main` already, unrelated to this change (the `lg:` height
  wasn't touched) — flagging for Kazim rather than fixing something not in the QA finding.
- **(d)** Privacy page's "Cookies and tracking" section now discloses the GTM container when
  `GTM_ID` is configured, names what it's for (Tiger's marketing team managing tags without a
  deploy) and that it rides the same consent gate as GA4. GTM itself untouched, still consent-gated.

**Proof:** axe-core 0 violations (desktop + mobile). `ga_hit_test.py`: before=0, accept sends
page_view + section_view, decline sends 0, 0 CSP violations. Reopen link confirmed to actually
reopen the banner. `tsc` clean, production build succeeds.

### Miramar — PR #45 (open, not merged)
Seven em dashes in `website/privacy.html` ("Information We Collect", "Categories of Third
Parties") rewritten with commas/colons. No analytics work needed here (not in the cta_click
finding). Served locally and confirmed zero em dashes remain, page renders correctly.

## What I did not do
- Did not touch Tiger, La Vida, cosmos, or egg-out — not named in the Fix list.
- Did not chase the section_view-never-reaches-Google framing from RESULTS.md issue #1 — the task
  explicitly said that's wrong for section_view on Tiger/Miramar/LaVida/LobsterLab, and my own
  real-hit tests confirm section_view does reach Google on LobsterLab (and by the same code path,
  on STATION8/GlobalFork once consent is granted).
- Did not touch GlobalFork/STATION8/Miramar's terms/cookies/accessibility pages even though they
  share the same " — SiteName" title pattern as the privacy pages — out of scope (task said
  "privacy page" specifically); noting it here so it isn't silently lost.

## Status      PASS
## Summary     Fixed cta_click delivery (beacon transport) and wired two previously-untracked
##             "Follow" CTAs on STATION8 and GlobalFork; fixed all four LobsterLab banner QA items
##             (reopen link, contrast, mobile hero overlap, GTM disclosure); removed every em dash
##             from the privacy pages on STATION8, GlobalFork, and Miramar. Four PRs open, none
##             merged, each independently verified with axe-core and a real-hit GA4 test.
## For Kazim   Natalia fixed the "GO NOW" button and a cookie-banner bug across four of your Tiger
##             sites (STATION8, GlobalFork, Lobster Lab, Miramar) and opened four pull requests,
##             waiting on your review before anything goes live; one small thing on Lobster Lab
##             (a banner overlapping text on wide desktop screens) was spotted but left alone
##             since it wasn't what was asked.
## Files       STATION8: lib/analytics.ts, features/analytics/TrackedCtaLink.tsx,
##             features/events/EventsList.tsx, app/privacy/page.tsx
##             GlobalFork: src/lib/analytics.ts, src/components/sections/Events.tsx,
##             src/app/privacy/page.tsx
##             LobsterLab: components/ConsentBanner.tsx, components/Footer.tsx,
##             components/Hero.tsx, app/privacy/page.tsx
##             Miramar: website/privacy.html
## Risks       None of the four PRs are merged or deployed yet, so nothing changed in production.
##             STATION8/GlobalFork's "Follow" CTA wiring and LobsterLab's hero-height calc() are
##             new code paths with no prior production exposure; each was verified in a local
##             production build but not yet seen on a live deploy preview.
## Next        code-review (Michael) gate, then qa-test-engineer (Olga) for a live-preview pass on
##             each of the four PRs before any merge.
## Human gate  Merge approval for all four PRs (explicitly told not to merge). LobsterLab's
##             1440x900 banner/headline overlap is a separate, unflagged issue — Kazim's call on
##             whether it gets its own fix.
