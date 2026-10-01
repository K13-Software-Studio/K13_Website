# Brand review: website intro film — concept brainstorm

**Agent:** Valentina (brand-dna-designer)
**Date:** 2026-09-29
**Scope:** Ideas only. Nothing built, nothing rendered.

## What I looked at
- `docs/prototypes/sculpt/statue.mp4` (confirmed 10.0s) and its contact sheet
  `orbit_intro/src/old_statue_strip.png`
- The existing loading screen `docs/prototypes/sculpt/v6.html` — it already has a projection-room
  choreography (veil dim, beam, screen unfold, `.bones` skeleton ghosting the real page underneath,
  lights-up lift) plus a working skip button and a `sessionStorage` "k13-projected" once-flag
  (currently opt-in via `?once`)
- `index.html` tokens and the hero line: "A studio for software that feels **obvious**," eyebrow
  "K13 Software Studio · Kazim K."
- The rejected orbit remake (`check.png`) — noted only to avoid repeating what failed

## What the intro needs to say
The clay film's own mechanic already dramatizes the tagline: raw material (a code-walled room, a
blank clay block) resolves into something finished and specific (a figure of Kazim, orange
glasses, on a labeled pedestal). That *is* "feels obvious" acted out, not narrated. Recommendation:
add no caption or strapline over the film. Text on top would tell the line instead of showing it,
which undercuts the point. The only text that should ever appear in-frame is the pedestal lockup
itself.

The eyebrow already frames this as personal authorship ("Kazim K.," not "a studio"). The film
should stay a portrait of one person's process, not soften into a generic agency sizzle reel.

## The pedestal lockup: fix it
The contact sheet shows the cube reads "K13" in a plain dark serif-ish weight with "SOFTWARE
STUDIO" in caps below — close to the real lockup but not it, and CLAUDE.md is explicit: K13 only
appears as the typographic lockup (Fraunces "K" ink, "13" orange, JetBrains Mono "SOFTWARE STUDIO"
tag). Recommend a tight macro recomposite of just the pedestal face in the closing seconds: the
existing engraving dissolves/chisels into the true lockup, with the "13" carved in the same orange
already present in the shot's own sparks and glow, so it reads native to the material rather than
pasted on. This does not require re-rendering the whole 10s film, only the pedestal insert.

## Dark film → light site: one brand, not two
Reuse v6.html's existing mechanism rather than inventing a new one; the brand fix is grading, not
new animation:
1. **Color-match the whiteout.** The film's amber reads warmer/more saturated than the site's
   `--blue-2:#EA5E14`. Grade the closing bloom toward the real token pair (`#B94612 → #EA5E14`)
   and the paper to the exact `#F3F5FA`, not a generic warm-to-white dissolve.
2. **Carry one object across the cut.** The last spark/rim-light on the figure's glasses becomes,
   literally, the orange dot in the hero eyebrow / the "13" in the nav lockup on landing — the eye
   tracks one continuous thing through the transition instead of a hard reset.
3. Everything else (veil, beam, `.bones` skeleton pre-ghosting the real page, screen-lift) already
   exists in v6.html and should not be rebuilt.

## Patience and repeat visits
14s is fine once, per person, for a pitch this specific — but only once. Keep the skip button
visible from frame one (already built). Promote the existing `sessionStorage` once-flag from
opt-in (`?once`) to the default: full film on a visitor's first load this session, an instant
lights-up (under 1.5s) on every return within the same session. That is the actual answer to
"how long before someone gets impatient": never twice.

## Concept: "The Obvious Cut"
Builds on the existing 10s clay film, adds roughly 4s of new bookend, total 14s.

| Time | Beat | Status |
|---|---|---|
| 0–10.0s | Existing `statue.mp4` unchanged: room → cube carved → pedestal engraves → figure emerges, salutes, glasses flare | Existing footage |
| 10.0–11.5s | NEW macro insert: pedestal text re-chisels from the current sans engraving into the real lockup (Fraunces "K" ink, "13" orange, JetBrains Mono tag) | New, pedestal-only recomp |
| 11.5–13.0s | NEW: the shot's own orange rim-light blooms and floods outward from the pedestal edge; whiteout graded to site tokens, not generic amber | New, reuses v6.html's beam/veil mechanic |
| 13.0–14.0s | NEW: cube-face afterimage settles into the hero's eyebrow accent dot / nav "13," landing on frame with the real header already ghosted in via `.bones` | New, reuses v6.html's lift/skeleton |

Net new build is ~4s of pedestal recomp + color-matched whiteout; the 10s clay performance itself
is untouched, which is the point: this builds on the old film, it does not replace it.

---

## Handoff block

**Status:** Concept only — brainstorm complete, nothing built or rendered.

**Summary:** The clay film already dramatizes "feels obvious"; no caption belongs on top of it.
One concrete brand fix identified: the pedestal engraving is not the real lockup and should be
recomposited in its closing seconds. One concept proposed, "The Obvious Cut," 14s total, ~4s new
bookend on the existing 10s footage, reusing v6.html's already-built projection-room mechanism
rather than inventing new motion. Skip button and a session once-only autoplay rule cover the
patience question.

**Files:**
- Read only: `docs/prototypes/sculpt/statue.mp4`, `docs/prototypes/sculpt/v6.html`,
  `docs/prototypes/orbit_intro/src/old_statue_strip.png`, `docs/prototypes/orbit_intro/src/check.png`,
  `index.html`
- Written: this file, `docs/handoffs/brand-intro_2026-09-29.md`

**Risks:**
- The pedestal recomp and the color-matched whiteout both assume someone can hit the clay
  pipeline's render style closely enough that the insert doesn't visibly seam against the
  existing 10s of footage; that is a production question, not a brand one, and needs a motion
  pass to confirm feasibility before this is scheduled.
- Promoting the once-per-session flag from opt-in to default is a small behavior change (repeat
  visitors currently see the full film every load) — flagged here rather than changed, since it
  touches how the site behaves for every visitor.

**Next:** ui-motion-designer (motion/timing feasibility on the 4s bookend and the whiteout grade),
then frontend-engineer for build, through the design-review gate.

**Human gate:** Kazim to approve the concept direction and name ("The Obvious Cut"), the pedestal
lockup fix, and the once-per-session default before any build work starts.
