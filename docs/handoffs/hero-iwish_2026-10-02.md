# Handoff: hero "From I wish to it works." (Camila, motion)

Request: Kazim, verbal, 2026-10-02 (motto leads the hero).

## Status
Done, verified locally with the production-header server. Not committed (James commits).

## Summary
- Headline is the motto: "From *I wish*" (soft italic, muted) / "to it works" (solid ink) with a live green dot as its full stop. The dot pings each time a product lands.
- The glass status card and its rotating "Currently" feed are replaced by the **wish machine**: a real wish is typed, a build log ticks (lines + tool chips), the real shipped screen wipes in with a Live badge and its link, then the next wish. Stats (16 / 13 / 24h) live in its footer. Six cycles, about 9.4 s each: BarFix, Station8, Tiger Hospitality, CENGO, TrustMeBro, Miramar.
- Optional delight, built honestly: "Your turn" box. The visitor's wish is shown, the machine says "Now a person reads it. Nothing is built from this box", and "Start a project with this wish" fills the contact stepper's last-step "why" field (and a note on step one), then scrolls there only after confirming the field holds the text.
- The tilted moving screens stay behind, calmer (50% opacity, stronger paper veil). One Pause control (#wallToggle, now in the machine footer, "Pause the motion") stops machine and screens. The machine also holds while the pointer rests on it or focus is inside, when the tab is hidden, and when off screen.
- Phone is its own sequence: wish as a chat bubble with typing dots, a build log that stays as a growing receipt, the screen unfolds below it.
- Reduced motion / no JS: calm static composition (headline, BarFix wish and its live screen), no controls that do nothing.

## Truth of each wish (all names, links, screens read from the Work row in the DOM)
- BarFix (w10): "I wish somebody counted the bottles at 2am." Story: "nobody counts bottles at 2am". Lines/chips: scale, counting engine, 27 passing tests, auditable (event-sourced) stock, row-level security: all in the story.
- Station8 (w05): "...every student could use our market's site, from day one." Story. Lines/chips: CMS, bookings form, vendor map, Next.js, accessibility a requirement: story.
- Tiger Hospitality (w01): "...all our restaurants lived under one roof." Row. Lines/chips: map pin per location, rebuilt site per concept, self-edited menus, structured data, catering inbox: story.
- CENGO (w04): "...my site restocked itself while I'm on stage." Row ("restocks its own music, mixes, tour dates"), tags Artist / Self-updating.
- TrustMeBro (w08): "...someone did the cold math on every bet." Row + tags Data / EV engine.
- Miramar (w03): "...our 1938 theatre could open again, online first." Row + tags Brand / Reporting. "Reporting for the team" is the softest claim; Kazim may want it reworded.
The wishes are paraphrases in plain words, not quotes from named people; the machine never attributes them to a person.

## Files
- index.html (hero markup, meta/OG/Twitter/JSON-LD copy, `css/hero.css` + `js/wish.js` links, `#wishNote` in the stepper)
- css/hero.css (new), js/wish.js (new)
- css/site.css (old glass status card, feed toggle and `.ci` rules removed)
- js/site.js (loader selectors, rotating feed block removed, wall toggle labels, `k13:wish` bridge in the stepper)
- assets/og/k13-og.png (re-rendered 1200x630, same typographic style)

## Verification (Playwright, header-serving server, port 9130)
- Console errors 0, CSP violations 0 (securitypolicyviolation listener) on fresh load, film runs, idle 15 s, yours flow.
- axe-core 4.x (local copy, test only): 0 violations on .hero, whole page (1440) and hero at 390.
- No horizontal overflow at 1440, 1920, 1024, 1024x600, 768, 390, 320, 844x390. No clipped machine children. Tap targets: all hero controls >= 24px; Pause 32px on desktop, 44px on phone. (Pre-existing: hunt marks 18x24, header at 320 crowds the brand tag against Menu.)
- Loader: fresh load and Cmd+R reload both draw the new hero (machine outline, stage, letters) and lift cleanly; the machine starts about 0.3 s after the lift.
- Pause verified: phase and text unchanged for 6 s after clicking Pause. Reduced motion verified at 1440 and 390: stays on the BarFix pair after 9 s.
- Screenshots: /private/tmp/claude-501/-Users-k13-Desktop-PROJECTS-K13-Website/7f98e9f2-b9e9-443b-b8c6-74d3003f04ba/scratchpad/hero/ (sheet_d.png, sheet_m.png, sheet_load_d.png, vp_*.png, reduced_d/m.png, idle15_d.png, yours_d.png, handoff_d.png).

## Risks
- A mouse resting on the machine holds it (intended for reading/clicking); some visitors may read that as "stuck". Pause state is not shown for that case.
- The upgrade path of the wall's autoplay videos is untouched; the machine uses WebP stills with a slow zoom (no video) to stay light.
- CLAUDE.md still lists "Software with an edge" as the settled hero line; James should add the dated 2026-10-02 motto decision. README.md tagline also unchanged.
- The removed "Currently" feed lines (about 60) live only in git history now.

## Next
qa-test-engineer (Olga): fitcheck + Chrome gate on hero, Cmd+R loader, keyboard walk of the machine (link, Pause, input, handoff), screen reader pass on the polite announcement (only on landing). Never click "Send it" in the stepper.

## Human gate
Kazim: approve the headline treatment and the six wishes' wording; confirm the "Your turn" box is wanted.
