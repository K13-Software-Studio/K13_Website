# Workbench toys — three new pieces — 2026-09-25

Motion/interaction build for the three new workbench cards (`data-game="egg"`, `"cengo"`,
`"letters"`). Scope was `js/workbench.js` and `css/workbench.css` only — `index.html`,
`css/site.css` and `js/site.js` were left untouched (owned by another session in parallel).

## Status      PASS
## Summary
Built and Chrome-tested three new workbench toys, each with an attract loop, a short delight-only
readout, pointer + touch + keyboard play, an immediate Reset, off-screen rAF pausing, and a
reduced-motion path with momentum removed (direct manipulation only). Registered all three in the
`games` map. Zero console errors and zero axe-core 4.10.2 violations (whole page scrolled, light
and dark) across desktop, touch, reduced-motion and night-mode passes. Found and fixed one real
bug during testing: the Loose Type "K13" easter egg was firing on page load and after every
Reset/Tidy (tiles start in the correct home position, which trivially satisfies the alignment
check) — gated it behind a `earned` flag so it only fires as a genuine discovery during free play.

## For Kazim
Camila built the three new workbench toys you asked for (Egg & Out's spinning wordmark, CENGO's
scratchable record, and K13's own loose letters you can fling around) and tested all three in a
real browser on desktop, phone-size touch, keyboard-only, reduced-motion, and dark mode — zero
bugs, zero accessibility violations found. They're ready for Olga's QA pass, then Kate can ship.

## What each toy does

**Endless Spiral** (`egg`, from Egg & Out) — an Archimedean spiral of "EGG & OUT" repeating
outward, alternating warm yolk (`#8A5206`, 5.53:1 on cream) and orange (`--blue` `#B94612`,
4.61:1 on cream). Drag anywhere on the canvas to spin it 1:1 with your hand; release and it keeps
turning, decaying with friction, then settles through a light underdamped wobble (a physical,
per-frame version of the house's playful-overshoot easing rather than a CSS transition, since
nothing here is a fixed-duration animation). Spin fast and the type gets a per-glyph tangential
stretch plus a small canvas blur that scales with speed. Arrow keys spin it, holding accelerates.
Reduced motion: dragging still rotates it 1:1, but there's no momentum, no settle wobble, and no
ambient auto-spin — arrow keys nudge it by a fixed step instead of accelerating.

**Night Shift Deck** (`cengo`, from CENGO) — a record on a turntable (CSS radial-gradient grooves,
no images). Drag in a circle to scratch it (rotation tracks your hand exactly); let go and, if
"Play" is on, it eases back up to speed, or coasts down if it's off. A conic-gradient "glint"
sweeps the grooves while the card is idle and untouched (the house shine-sweep, applied literally
to light catching vinyl). Six VU bars react to scratch/play speed. Sound is a real toggle, off by
default, and only ever starts from that toggle's own click (synthesized noise + a filtered sine
tone via Web Audio, no audio files, no network requests — `connect-src 'self'` in the CSP is
untouched). Space toggles play, left/right arrows scratch (holding accelerates). Reset stops
playback, mutes sound, and zeroes rotation immediately. Reduced motion: no auto-spin ever (even
with Play on — sound alone carries that feedback), scratching is still direct and immediate.

**Loose Type** (`letters`, from K13 itself) — the "K" (ink) and "13" (orange) plus two small mono
tags, SOFTWARE and STUDIO, as four real `<button>` tiles in a tray. Grab and fling them; they
bounce off the tray walls and each other (circle-approximated rigid-body, friction, restitution)
and come to rest. "Tidy" snaps every tile back to the correct lockup with a staggered spring
(`idx*0.08s`, the house playful-overshoot easing `cubic-bezier(.34,1.56,.64,1)`, evaluated in JS
frame-by-frame so it works without a CSS transition). If a visitor happens to drag K and 13 back
into the correct relative position and lets them settle, a small quiet readout says so — gated to
only fire as an earned discovery during play, never on load, Reset or Tidy (see bug note below).
Tab moves focus tile to tile; arrows nudge the focused tile; Enter flings it. Reset snaps
everything home instantly. Reduced motion: dragging is direct with no velocity/bounce physics;
Enter moves the tile a fixed step instead of a physics fling; Tidy still snaps home but instantly,
no stagger.

## Bug found and fixed during this build
Loose Type's "K13" alignment message checked position/rotation/rest every frame with no gate, and
tiles *start* in the correct home position — so it announced "That reads K13. Nicely done." on
every fresh page load and after every Reset/Tidy, which cheapens the one moment that's supposed to
feel like a surprise. Fixed with an `earned` flag, set true only by an actual drag/nudge/fling and
cleared by Reset and Tidy, so the message only ever fires as a real discovery.

## What I verified (Playwright, Chrome, against `http://127.0.0.1:9130/` with the production CSP
headers from `vercel.json`, `sessionStorage.setItem('k13-projected','1')` to skip the opening film)
- **Pointer/mouse** (1440×900): all three toys respond to drag; egg flicks and settles with
  momentum; cengo scratches and Play/Sound toggle correctly; Loose Type drags, Tidy re-homes,
  arrow-key nudge and Enter-fling both confirmed by reading the live `style.transform`.
- **Touch** (390×844, `has_touch=True`, `is_mobile=True`): confirmed real touch-drag (not just tap)
  rotates the egg canvas, rotates the cengo platter, and moves a Loose Type tile — all via the
  same Pointer Events code path, zero console errors.
- **Keyboard**: egg's held ArrowRight rotates the canvas (confirmed by diffing `toDataURL()`
  before/after); cengo's Space toggles Play and ArrowLeft scratches; Loose Type Tab reaches each
  tile, arrows nudge, Enter flings.
- **Reset mid-motion**: for all three toys, reset changes the element immediately and it *stays*
  reset 600ms later — no stale rAF/timeout overwrote it (none of the three toys schedules
  `setTimeout` for gameplay state at all; every animated value lives in one continuously-running
  rAF loop per toy, so a Reset's synchronous write is reflected on the very next frame with nothing
  async left to race it).
- **Reduced motion** (`reduced_motion="reduce"`): egg drag still rotates it directly with no
  momentum after release (canvas frozen once the pointer lifts); Loose Type drag has no
  glide/bounce after drop (position frozen where dropped).
- **axe-core 4.10.2**: 0 violations, whole page scrolled top to bottom, light theme and dark theme
  (`localStorage` `k13-theme=dark`, `k13-night=1`), `bypass_csp=True` context per house convention.
- **Console errors**: zero across every pass above (desktop, touch, reduced-motion, night mode).
- **Overflow**: `scrollWidth <= clientWidth` at both 1440 and 390 in every pass — no horizontal
  leak from the new cards.
- **Night mode**: `data-theme="dark"` applies correctly; screenshotted — both fixed-palette toys
  (egg's cream canvas, cengo's dark deck) and the theme-adaptive one (Loose Type using
  `var(--ink)`/`var(--blue)`) all read correctly against the dark page background.
- **Contrast**: computed by formula, not eyeballed — egg's yolk `#8A5206` and orange `#B94612` are
  5.53:1 / 4.61:1 on the `#F6EEDC` canvas cream (AA body text passes); cengo's cream label text is
  5.23:1 on its `#A8430E` label plate; focus outlines (`var(--blue)` on the deck's fixed dark
  panel) are 3.22:1 in light theme / 5.98:1 in dark, both over the 3:1 non-text floor.

## A finding worth knowing before the next Playwright pass (not a product bug)
Two of the three toys (`cengo`'s platter, `letters`' tiles) run a continuous ambient "attract" idle
motion (via `style.transform`) until first touched. Playwright's own actionability wait (used by
`locator.scroll_into_view_if_needed()`, and implicitly by `locator.click()`/`hover()`) treats a
transform that changes every frame as "not stable" and will retry for its full timeout on
*those specific elements* — correctly, since they genuinely haven't stopped moving yet by design.
Fix for a test: scroll with `element.evaluate("el => el.scrollIntoView(...)")` instead (no
stability wait), or just interact once first with raw pointer coordinates (which stops the attract
loop immediately via `card()`'s own capture-phase touch listener) before using locator-based
actions. Plain buttons (Play/Sound/Tidy/Reset) are unaffected — only the drag targets themselves.
Also worth knowing: the page's Lenis smooth-scroll means a fixed `wait_for_timeout()` after any
`scrollIntoView` is not reliable if a second scroll follows closely after a first — poll the
bounding box until it stops moving instead of trusting a fixed delay.

## Files
- `js/workbench.js` — added `lerp`/`bezier`/`POP` helpers; added `egg()`, `cengo()`, `letters()`;
  registered all three in the `games` map at the bottom.
- `css/workbench.css` — added the `.wb-egg`/`.wb-eggcv`, `.wb-deck`/`.wb-plat`/`.wb-grooves`/
  `.wb-glint`/`.wb-label`/`.wb-vu`/`.wb-dctl`/`.wb-play`/`.wb-sound`, and `.wb-tray-wrap`/
  `.wb-tray`/`.wb-tile`/`.wt-k`/`.wt-13`/`.wt-tag`/`.wb-tidy` rules.
- Untouched (owned by the parallel session): `index.html`, `css/site.css`, `js/site.js`.

## Risks
- Loose Type's home layout math (`layout()`) computes tile positions from measured widths at
  runtime and clamps the tag tiles to the tray's right edge; verified fitting at 1440 and 390 with
  no overflow, but a very narrow custom viewport between those (untested) could theoretically sit
  tighter than intended. Not observed in the matrix tested.
- The `hunt` (hidden "13") system was deliberately left untouched by all three toys — the total is
  a fixed contract (`TOTAL=13`, page's own nine plus four already placed by `carlos`/`miramar`) and
  I didn't want to perturb it while another session is mid-edit on `index.html`. If the new toys
  are meant to carry hunt marks too, that's a scope decision for whoever owns the hunt count.

## Next      qa-test-engineer (Olga) — the two-agent Chrome QA gate (desktop + mobile screenshots,
##           design review) before this ships.
## Human gate  none
