# Handoff: workbench-goals (Camila, motion), 2026-10-02

**Status:** Done, verified in Chromium on the production-header dev server. Not committed (James commits).
**Requests:** Kazim, verbal, 2026-10-02: (1) the Egg&Out fried-egg toss as a workbench game; (2) make the lobster one meaningful, games should have a goal; (3) same principle for the other physics toys.

## Summary: every physics toy now has a goal, a progress readout and a win state
| Toy | Goal | Win state |
|---|---|---|
| Sunny Side Up (NEW, wide, Egg&Out) | 5 clean flips (one full turn, yolk back up). Raw toss, hard landing or the floor ends the round. Best kept in localStorage `k13-bench-egg` | Egg slides onto a plate, "Sunny side up!" |
| Tide Line (rebuilt, Lobster Lab) | Run a boat: drop traps on ropes, lobsters walk the seabed and crawl in, hold to haul before they back out. Crate to 13 inside a 100 s tide. Best haul kept in `k13-bench-tide` | Crate pips full, boat sails home |
| One Roof (Tiger Hospitality) | Swing the string so each lamp clinks a neighbour (lights up). Lamps start dark | All lit: a door in the back wall opens and spills light |
| Dumpling Drop (Station8) | One dumpling settled in every one of 5 baskets | Baskets turn gold with ticks, "The market is open" |
| Stack Attack (Cosmos Burger) | 11 layers standing on the plate | Flag on top, "Skyscraper burger" |
Status line carries the progress ("Flips 2 of 5", "Crate 4 of 13. Tide 72 s.", "Lit 3 of 5", "Baskets filled: 3 of 5", "7 of 11 high"); each canvas also draws pips.

Physics notes. Egg: rigid flat body with 10 contact points against the moving pan (impulses, friction, restitution), spring-damped white and yolk, film shell/drop/yolk/lace drawing re-authored. The spin on takeoff is assisted (one or two full turns scheduled from the launch speed) so a clean flip is skill in timing the flick and catching, not luck. Tide: water columns and buoyant bodies kept; trap is heavier than water, rope is a max-length constraint that reels in under haul, buoy fights back, periodic swells.

## Files
- `js/bench-physics.js` (all five toys), `css/bench-physics.css` (+ `.bp-egg` skin)
- `index.html`: one mount `data-game="eggtoss"` (wide) at the top of `.bench`; 12 normal + 3 wide (eggtoss first, sandwich after 6, angry13 last), no wide card next to an Egg&Out toy.
- No change to js/workbench.js or css/workbench.css this round.

## Verification (Playwright, scripted wins)
- Won each game: egg (5 flips via Space, and via real pointer flicks 2 flips), tide (in-page bot hauls to 13: won in 80 s and 85 s, also lost runs at 10 to 11 of 13, so it is winnable but not free), roof (all lit after 7 shakes), dumpling (fling one into each basket), stack (11 Spaces).
- Same win run with prefers-reduced-motion: egg wins, no errors.
- Zero console errors, zero CSP violations, no overflow at 1440/1024/768/390/320, tap targets >=24px, `[data-hunt]` = 13.
- Loops: 0 rAF off-screen; egg, roof, dumpling, stack drop to 0 rAF at rest; Tide runs while a round is in play (timer), sleeps in ready/won/lost.
- Screenshots: scratchpad/wb4/ (egg_toss_mid, egg_crack1/2, egg_win, tide_haul, tide_win, roof_win, dumpling_mid/win, stack_win, bench_1440, bench_390).

## Risks
- Tide Line difficulty is tuned by bot (about 2 in 3 wins); a human may find it easier or harder.
- Touch drags inside stages do not scroll the page (touch-action none, as the other toys).
- Egg spin assist is a deliberate game cheat on the rotation only; everything else is simulated.
- Pointer-hold haul needs the buoy; the Haul button and Down arrow cover touch and keyboard.

## Next
qa-test-engineer (Olga): real touch, hold-to-haul on iOS, 320px.

## Human gate
None.
