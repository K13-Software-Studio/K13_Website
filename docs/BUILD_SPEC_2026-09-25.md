# K13 site, beta_v8 "The Workbench": build spec

> Requested by Kazim, 2026-09-24/25 (verbal, several messages): "update our website with the latest
> vision and approach", "reflect K13 style and vision more, don't be scared to do drastic changes",
> "interactive and fun, display our skills, mini games, hidden puzzles, hidden fun switches", "build
> all of my asks in one go, bring me a finished site, attract the right people and speak to them,
> give people a reason to stay longer and enjoy it". This file is the single source every agent
> builds against. Decisions here are made; do not reopen them, record deviations in your handoff.

## 0. Non-negotiables (from CLAUDE.md, the genome and Kazim)
- Identity typographic only: Fraunces "K" ink `#141D35`, "13" orange accent, JetBrains Mono tag, favicon.svg. The square mark is dead.
- Fonts: Fraunces / Inter / JetBrains Mono. Palette: the 13 live tokens; **remove `--wash-lilac` `#E8E1FB`** (never purple) and replace its uses with peach/mint washes.
- No em dashes in anything a visitor reads (page, meta, OG, alt text, aria labels). Readability first: sketch texture never on text.
- WCAG AA, axe-core zero violations, every interactive thing keyboard-operable, tap targets 24px min (44px for primary), inactive stepper steps `inert`, motion gated by `prefers-reduced-motion`, anything auto-moving > 5s has a pause.
- No new external origins. Externalise CSS and JS into files (`css/site.css`, `js/*.js`) so `script-src` and `style-src` can drop `'unsafe-inline'`; update `vercel.json` accordingly and PROVE zero CSP violations by serving with the exact headers.
- Never claim what cannot be verified. No fake testimonials, no invented metrics. Numbers that drift are dated or derived, never hand-typed.
- Do not name Three Lions Capital or OKTO. EDISYN is not K13's. No Team K13 on the page, no crew photo, no "Ganga".
- Static site, no build step: plain HTML/CSS/JS files. No frameworks, no libraries beyond Lenis (already allowed).

## 1. The people
- **Kazim K., Principal.** The owner who still does the work: product thinking, design, front end, the call.
- **Gürkan A., Toolmaker.** DevOps engineer in Belgium; builds the reusable parts the studio sells on top of, the infrastructure behind services, the tools that get upsold. Uptime, deploys, production security.
- The site speaks as **"we"**, two named people. Never "I'm one builder", never "1 builder". No group photos; Kazim's portrait stays; Gürkan gets a name card without a photo (no photo exists), styled as a second plinth caption beside Kazim's portrait, not an empty placeholder.

## 2. Page order (information architecture)
0. **Opening** (built): the sculpted film loading screen, once per visit, Skip/Esc, `?intro` replays.
1. **Hero**: new headline (see copy), the two names in the eyebrow, status card kept (feed rotating, PAUSE control) with stats **shipped / live / people = 2**, both CTAs.
2. **Who it's for** (new): four doors, each one sentence and one live project as proof: Restaurant and hospitality groups (Tiger, Lobster Lab, Cosmos, Miramar, Global Fork, Egg & Out, La Vida) · Founders with a product (TrustMeBro, BarFix) · Brands and makers (baa atelier, CENGO, Carlos Almaraz) · Institutions (Station8 at UC San Diego). Clicking a door filters/highlights the work tickets below (progressive: without JS it is just links to #work).
3. **How we work**: three rules, rewritten for two people (see copy). Cards get the shine sweep on hover.
4. **Selected work**: the 13 rows kept in the same order and format, restyled as **work tickets** (ticket stub number, name, one-liner, tag chips, "Open" and a live status dot that is real: a small `data-live` mark, checked at build time on 2026-09-25, with the date shown once at the section foot, never per row). Hover preview kept and tightened: one choreographed gesture, sheen on the peek panel, debounced swap. The "Also cooking" and "Built for the studio itself" lines kept (remove "a sports private equity home" from Also cooking; it is named nowhere).
5. **The workbench** (new, the fun): "Five things from the work, made playable." Five self-contained games in a grid of cards, each a real mechanic from a real project, each starting to move on its own when scrolled into view (a short attract loop), each playable with mouse, touch and keyboard, each with a one-line "from <project>" caption and a Reset:
   - **BarFix scale**: drag (or arrow-key) a bottle onto a scale; the readout shows grams → ml left → "pours left" and the money that would have walked out the door. Numbers derived from a tiny honest table (bottle 750ml, tare, density 0.94).
   - **TrustMeBro pick**: two bets with odds and our probability; pick the one with positive expected value; the card does the cold math and shows +EV/−EV, then the "next morning" result.
   - **Tiger map pins**: a tiny SVG map of San Diego (abstract coastline, not Mapbox); tap to drop a pin; each pin names a neighbourhood from a list, the counter reads "N neighbourhoods, one roof".
   - **Carlos brush**: a small canvas; paint with the Almaraz palette (from the site's own tokens), brush size by speed; a Clear; the canvas is labelled as a toy, not his work.
   - **Miramar marquee**: a row of 13 bulbs on a marquee sign; tap/space to light them one by one; when all 13 are lit, the sign runs its "opening night" chase once (respects reduced motion by lighting all with no chase).
6. **What we build + craft showroom**: the three lanes kept. The craft block becomes a **Showroom switch**: a real `<button role="switch">` "Show the craft levels on this page"; on, every section gets a small mono tag at its top-right with its level and a one-line why, judged honestly about our own site: Opening = Immersive · Workbench = Immersive · Work tickets = Tailored · Hero = Signature · Who it's for = Signature · How we work = Essential · Contact = Tailored (functional, on the ladder only for its stepper craft) · Footer = Essential. Ceiling honoured: two Immersive, two Tailored. Off by default; state remembered in localStorage.
7. **On the record** (new proof section): dated, checkable facts, each with what it means to a client: accessibility (axe-core zero violations on this page, dated), security headers on this site (6 named, checkable by anyone with a browser), every listed project fetched live on a date, QA in a real browser before anything ships, dated client reports and delivery films, before/after visual log, security and legal audits on client work. Copy in the house voice. A "Check it yourself" line for the headers (the CSP is literally readable).
8. **The studio** (About): Kazim portrait kept with the layered depth; beside it the two name cards (Principal / Toolmaker) with one line each and where they are (San Diego / Belgium, worldwide remote). Facts: Status · Based · Track record (dated) · What earns a yes. No motto about a crew.
9. **Start a project** (Contact): the 3-step stepper kept and hardened; final step gains two honest fallbacks beside "Send it": "Open in Gmail" (web compose URL with the same subject/body) and "Copy the message" (clipboard, with a visible confirmation that only says copied after it copied). Tap targets fixed. mailto encoding kept.
10. **Footer**: self-setting year (`[data-current-year]` + script), sitemap-consistent links, the "13" hunt counter lives here when active.

## 3. Hidden layer (fun that never blocks reading)
- **Find the 13**: thirteen tiny "13" marks hidden across the page (in the ticket numbers' kerning, a bulb on the marquee, the scale readout, a chip, the 404 page counts as none). First find reveals a small counter in the footer ("1 of 13"). All 13: a quiet reveal card: "You found all thirteen. Most people leave by three." with a CTA that opens the composer pre-filled with subject "I found all 13". Progress in localStorage. Every mark is a real focusable button with an accessible name ("Hidden 13, 4 of 13"), so keyboard users can play too; marks are visually subtle, never invisible (contrast floor 3:1 on the mark itself).
- **Night shift**: click the lockup 13 times → a dark theme (ink ground, paper text, same orange), remembered; a visible switch also appears in the footer once discovered. Contrast recomputed for dark tokens. No purple.
- **Blueprint**: Konami code → the drafting grid overlay + section outlines with their pixel measurements (the site showing its own drafting table). Esc clears.
- **Idle**: after 10s without input on desktop, a pencil-line circle draws itself around the nearest heading in view, once; reduced-motion: nothing.
- Everything here is off for `prefers-reduced-motion` except the states that do not move (night shift, blueprint overlay).

## 4. Motion vocabulary (from the genome, currently missing)
- Reveals: rise + fade, `idx*0.08s` stagger for siblings, reversible.
- Sheen sweep: primary CTA, ticket rows on hover, the lockup once on first paint after the opening.
- Easings: workhorse `cubic-bezier(.4,0,.2,1)` at .3s for hover; premium `cubic-bezier(.22,1,.36,1)` for reveals .6 to .8s; overshoot `cubic-bezier(.34,1.56,.64,1)` for the stepper success ring and count-up settle. Collapse the three hover durations into one.
- Ambient: one breathing loop max on screen at a time (the status dot).

## 5. Performance and files
- Shots: generate WebP at 1500 and 750 wide (ffmpeg libwebp), `srcset` + `sizes`, `loading="lazy"`, JPEG fallback via `<picture>`. Target: full mobile scroll under 1.2MB total excluding the opening film.
- Opening film loads only when it will play.
- Files: `index.html`, `css/site.css`, `js/site.js` (nav, reveals, feed, stepper, counters), `js/intro.js`, `js/workbench.js` (five games + hidden layer), `404.html` shares the CSS. Games mount into `<div data-game="...">` containers and inject their own markup, so the games engineer and the page engineer never edit the same file.
- Meta: title, description, OG/Twitter copy rewritten for two people; OG image: a branded 1200x630 card (typographic lockup on paper with the orange rule; no photo), generated as PNG under `assets/og/`. JSON-LD `Organization` + `Person` x2 + `WebSite`. Sitemap: index + styleguide + 404 excluded; lastmod = build date. robots unchanged.

## 6. Verification bar (Olga owns; nothing ships under it)
axe 0 violations at 1440 and 390 (overlay up and down, showroom on, night shift on) · fitcheck nine viewports, zero horizontal leaks, zero tap targets under 24px, zero hidden-focusable · keyboard: every game playable, every hidden mark reachable, focus visible everywhere · reduced motion: no autoplay anything, games still playable · stepper: stubbed mailto, encoding asserted, Gmail link encoding asserted, copy confirmation honest · console 0 errors, CSP 0 violations under exact headers · all 13 links 200 · footer year live · no em dash in rendered text · no purple pixel (grep tokens + eyeball).

## 7. Handoffs
Each stage writes `docs/handoffs/<stage>_2026-09-25.md` (same day rerun: `_v2`). Commits on `site13_sep25_v1` only, grouped-bullet, no push, no PR: James ships.
