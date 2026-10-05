# K13 Software Studio: Brand & Website Kit

*Software with an edge. Crafted with care.*

## The identity

K13 is a **typographic brand**. The wordmark is set in Fraunces: a bold ink **K** and an
orange **13**, with a JetBrains Mono "SOFTWARE STUDIO" tag beside it, exactly as the
site's top nav renders it. The favicon is the same idea reduced to a tile (white
background in both color schemes, on purpose).

There is no glyph or badge mark. A rounded-square mark existed once and was retired for
good on 2026-08-18 (see `CLAUDE.md`, Settled decisions). Do not recreate one.

## Palette

The tokens `index.html` actually runs on (curated 2026-08-19):

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#1F2023` | base graphite |
| `--ink-2` | `#3A3C40` | elevated graphite |
| `--paper` | `#F3F5FA` | the field |
| `--paper-2` | `#FFFFFF` | cards |
| `--paper-3` | `#E9EDF7` | lines |
| `--blue` | `#B94612` | accent, deep |
| `--blue-2` | `#EA5E14` | accent, bright |
| `--faint` | `#6C6E74` | muted labels |
| `--muted` | `#5D5F65` | muted text |
| `--wash-blue` | `#FCE0CC` | wash |
| `--wash-lilac` | `#E8E1FB` | wash |
| `--wash-mint` | `#D6F0E6` | wash |
| `--wash-peach` | `#FBE6DD` | wash |

## Type

Three families, three jobs, nothing else:

- **Fraunces** carries display: headlines, the wordmark, accent italics.
- **Inter** carries body text.
- **JetBrains Mono** carries labels, tags, and small tracked-uppercase lines.

All are free on Google Fonts.

## Contact

All inquiries route to **projects.k13@gmail.com** (form and mailto links are wired to it).
The public domain is **k13projects.com**.

## What's in this kit

```
index.html      One-page site in a single file, zero build step.
                Lenis smooth scrolling, scroll-driven reveals,
                parallax "K13" backdrop, animated underline,
                marquee, magnetic buttons, custom cursor,
                inquiry form that opens the visitor's mail app
                (no backend needed), reviews, mobile responsive.

favicon.svg     The typographic K13 tile (Kazim-approved 2026-08-13).

assets/         kazim.jpg (the About portrait) and shots/ (the ten
                Work-section screenshots; oversized, WebP pass pending).
```

## Hooking up k13projects.com

The site is one static file, so any host works:

1. **Vercel (current setup):** the repo is imported as the `k13-website` project;
   `main` serves production and branch subdomains (b1, b2, ...) serve stakeholder previews.
2. **Any shared host:** upload `index.html` to the web root. Done.

To change the contact address later, search for `projects.k13@gmail.com` in
`index.html` and replace all occurrences.
