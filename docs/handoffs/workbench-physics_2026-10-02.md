# Handoff: workbench-physics (Camila, motion), 2026-10-02

**Status:** Done, verified in Chromium against the production-header dev server. Not committed (James commits).

**Request:** Kazim, verbal, 2026-10-02: "bring in more quality dynamics and physics on the next games to fill their place."

## Summary
Four new simulated toys fill the four removed slots (14 cards: 12 normal + 2 wide, grid full at 3/2/1 columns).
| Toy | Project | Physics |
|---|---|---|
| One Roof | Tiger Hospitality | Verlet rope, 30 nodes, pendant lamps on swinging cords that clink; drag/fling, breeze |
| Dumpling Drop | Station8 | Rigid spinning discs: gravity, restitution, rolling friction, ball-ball impulses, pegs, kicking bumpers, bins; hold to pour, fling |
| Tide Line | Lobster Lab | Spring-column wave equation, buoyant rigid bodies sampled per point (buoys self-right, crate rocks), splash drops, finger wake, spring-grab and throw |
| Stack Attack | Cosmos Burger | Soft verlet quads with SAT contacts and friction: stack burger layers on a plate, bump the table, topple |
Shared: fixed 120 Hz step + accumulator, DPR-crisp canvas, loop stops off-screen / hidden tab / at rest. Reduced motion: no startup gust/swell/drops, no splash, damped, gentler kicks, still playable. Keyboard + real buttons on each (foot lines say which keys). No external libs, no inline script/style.

## Files
- NEW `js/bench-physics.js`, NEW `css/bench-physics.css`
- `index.html`: link + script tags, 4 mounts reordered into `.bench` (dissimilar toys never adjacent in 3 or 2 columns)
- `css/workbench.css`: deleted only dead rules of the four removed toys (Pin Drop, Stall Call, Twirl, Next Morning, hunt-map/slip/tmb helpers) and their reduced-motion lines; shared selector lists trimmed. `js/workbench.js` untouched.

## Verification
Zero console errors, zero CSP violations; no horizontal overflow at 1440/1024/768/390/320; tap targets all >=24px; keyboard changes state on all four (normal and reduced motion); rAF count 0 while scrolled away; each loop falls to 0 rAF after settling (tide up to ~12 s after heavy play). `[data-hunt]` count at runtime: 13 (unchanged; the new toys add none).

## Risks
- Canvas uses `touch-action:none` like the existing toys, so touch drags inside a stage do not scroll the page.
- Stack Attack tower creeps ~1px/s while awake before it sleeps (verlet contact limit); invisible in practice.
- Canvas content is not in the accessibility tree; status line and button names carry the meaning.
- Cosmos palette uses its yellow/red/cream only (magenta skipped per the no-purple rule).

## Next
qa-test-engineer (Olga): touch devices (real iOS), 320px stage fit, fitcheck.

## Human gate
None.
