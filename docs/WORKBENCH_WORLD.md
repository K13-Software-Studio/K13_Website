# The Workbench World: build spec (2026-10-06)

Request: Kazim, verbal, 2026-10-06: the Workbench page becomes an immersive arcade room, an indie RPG world
in the Stardew Valley spirit. Visitors walk around and poke at things like a museum; the games live in arcade
machines; the toys sit on workbenches; the crew walk around as indie (pixel) versions of themselves; hidden
riddles in the details. Decisions (Kazim, 2026-10-06): pixel art drawn in code; Kazim and Gürkan appear as
the owners of the place; the world replaces the /workbench/ page when ready.

## What a visitor gets
- `/workbench/` opens on **K13 Studio, after hours**: a top-down pixel building seen from above, Stardew style.
  The visitor is a small character (a K13 intern in an orange hoodie) standing on the welcome mat.
- Walk with arrows/WASD, or tap/click a spot to walk there (pathfinding). Walk up to anything and press
  **E / Enter / Space** (or tap it) to interact. A small prompt bubble shows what is interactable.
- **Arcade machines** hold the 15 games. Interacting opens the machine: a modal styled as a cabinet screen
  with the real game inside (the existing game card, moved into the modal). Esc or Close returns to the room.
- **Workbenches** hold the 15 desk toys the same way.
- **The crew** wander their corners. Talk to them: a dialogue box with their name, role and a line or two in
  their own voice, sometimes a hint toward a secret.
- **Kazim and Gürkan** run the place from the front counter (the Masterminds' counter).
- **13 secrets** hide in the details. A small "Secrets n/13" chip appears after the first one is found.
  Finding all 13 opens the back room.
- **Prefer a list?** A plain toggle shows the classic page (every toy and game as cards). It is the
  no-JavaScript, reduced-attention and screen-reader path, and it must stay fully usable.

## Architecture (plain ES5 scripts, no modules, no libraries)
One global namespace, filled by separate files, read by the engine:

```
window.K13World = {
  map:     {...}   // js/world/map.js      (engine builder)   tiles, rooms, objects, spawn points
  people:  {...}   // js/world/people.js   (characters builder) sprites + roster + dialogue
  decor:   {...}   // js/world/decor.js    (decor builder)    object/tile pixel art + cabinet marquees
  secrets: {...}   // js/world/secrets.js  (decor builder)    the 13 secrets and the riddle chain
}
// js/world/engine.js (engine builder) boots last and runs everything.
```
Load order in `workbench/index.html`: people, decor, secrets, map, engine (all `defer`). The engine must run
with any of the other three missing (draw labelled placeholder boxes and default dialogue), so builders can
work in parallel.

### Grid and pixels
- Tile = 16 x 16 logical px. Characters are 16 x 24 (a tile wide, a tile and a half tall), feet on the tile.
- Draw at an integer scale (2 to 4 by viewport), `imageSmoothingEnabled=false`, devicePixelRatio aware (cap 2).
- Everything is drawn in code into offscreen canvases once (sprite caches), then blitted. No image files,
  no fetches, no inline styles (the site CSP forbids style attributes; use classes or element.style).
- Palette (one shared table in people.js and decor.js, K13 tokens): graphite #1F2023, ink #26272B,
  steel #414347, slate #5D5F65, paper #F3F5FA, cream #F6EEDC, white #FFFFFF, orange #EA5E14,
  deep orange #B94612, gold #F0B429, jade #4F9E92, deep jade #2F6F65, wood #8A5A3B, wood dark #5E3B26,
  floor warm #D8C4A6, floor dark #B9A07E, plant #3C8A5E, skin tones and hair tones as needed.
  **Never purple, violet, indigo or lavender.** Neon signs are orange, gold or jade.
- Night mode (`<html data-theme="dark">`): the same building after dark, lamps glowing (a light-radius
  overlay), windows dark. Light mode: late afternoon sun through the windows.

### The map (js/world/map.js)
Map ~ 52 x 34 tiles. Rooms (approximate, the engine builder finalises the layout and exports it):
- **Lobby** (south centre): entrance door, welcome mat (spawn), the **Masterminds' counter** with Kazim and
  Gürkan behind it, a "K13" neon sign, a waiting bench, a plant, the guestbook.
- **Arcade hall** (west wing): 15 cabinets in rows, a change machine, a high-score board, a **16th cabinet
  under a dust sheet** (secret), a claw machine decor, a "FREE PLAY" neon.
- **Workshop** (east wing): workbenches with the 15 toys, a pegboard of tools, a lathe, sawdust, a radio.
- **Lounge** (centre): couch, rug, bookshelf, coffee machine, a pinball table (decor), a fish tank,
  a record player.
- **Studio floor** (north centre): desks with monitors where the crew work, a whiteboard, a printer.
- **The back room** (north-east, locked): the War Room: a wall of screens, the board. Opens at 13/13 secrets.

Exported shape (`K13World.map`):
```
{ w, h, tiles:[row strings], legend:{char:{floor|wall|solid, tile:'name'}},
  rooms:[{id,name,x,y,w,h}], spawn:{x,y},
  objects:[{id, kind, x, y, w, h, solid, label, game?, toy?, room}],   // interactables + decor
  posts:{ <personId>: {x,y,room, wander:[[x,y],...]} } }               // where each character lives
```
Object ids are fixed contracts (secrets and decor key on them):
- cabinets: `cab-<game>` for game in hardest13 platform13 contra13 race13 paper13 dx13 rope13 haxball13
  duo13 bubble13 bloons13 worms13 goldminer13 volfied13 heli13; plus `cab-secret` (the dusted 16th).
- workbenches: `bench-<toy>` for toy in eggtoss carlos miramar tide egg cengo stack sandwich goldenhour roof
  eggcursor pours limewash dumpling angry13.
- fixtures: `counter`, `neon-k13`, `guestbook`, `door-front`, `door-back`, `change-machine`, `scoreboard`,
  `claw`, `couch`, `bookshelf`, `coffee`, `pinball`, `fishtank`, `records`, `whiteboard`, `printer`,
  `radio`, `pegboard`, `plant-1`..`plant-6`, `poster-13`, `window-1`..`window-6`, `rug`, `desk-1`..`desk-8`,
  `screens` (back room), `keypad` (next to door-back).

### Characters (js/world/people.js)
Exports `K13World.people = { list:[...], draw(ctx, id, dir, frame, x, y, scale), lines(id, ctx) }`.
- `list`: `{id, name, role, colors, post?}` for every character. Directions `down|up|left|right`,
  4 walk frames + 1 idle (gentle breathing bob).
- Roster: **the current crew only** (War Room `.k13/team/*.json` on origin/main): James, Jessica, Natalia,
  Camila, Olga, Kate, Valentina, Mariana, Leticia, Gabi, Nastiya, Ana, Selma, Baha, Fadil, Memotti, Emre,
  Chefito, Halodinho; plus **Tony (Gangaa)**; plus the Masterminds **Kazim** and **Gürkan**; plus the
  visitor (`player`, a K13 intern in an orange hoodie). **No former crew, ever** (Michael, David, Memati,
  Robert, Chris, Irina are retired from every likeness): never read their portraits, never name them.
- Looks: a pixel caricature per person (hair, skin, outfit colours, one signature item), read from their
  War Room portrait `.k13/avatars/full/<first name>.jpg` for the people listed above only.
  James's portrait is Kazim's long-haired photo: James has the long hair. Kazim has the same face with short
  dark hair (no photo of his own yet). Gürkan uses Tony (Gangaa)'s photo as his stand-in until his own
  arrives: give him a different outfit (jade, his board colour #1F8A70) so the two never read as one person.
- Dialogue: 2 to 4 short lines each, in their own voice (from their team card's personality and voice),
  written the way you would be glad to read about yourself. No corrections or comparisons of people.
  Some lines carry hints for the secrets (secrets.js supplies them via `hintFor(personId)`).

### Decor and secrets (js/world/decor.js, js/world/secrets.js)
`K13World.decor = { tile(ctx, name, x, y, s), object(ctx, obj, s, t), marquee(gameId) }`. Cabinet art per
game (side art and a lit marquee with the game's name), all fixtures above, animated where it helps
(neon flicker, fish, screens), every animation off under reduced motion.

`K13World.secrets = { list:[{id, title, where:objectId|personId, how:'look'|'take'|'use'|'code'|'talk'|'sequence', ...}],
  onInteract(objId, state) -> {say, give?, found?}, hintFor(personId, state) -> line|null, finale(state) }`.
13 secrets, each tied to a real K13 thing (projects, house rules, the 13 hunt, the studio's story), a few
chained (a code found in one place opens the keypad), all solvable without outside knowledge, at least
3 found by plain curiosity in the first minute. State lives in localStorage `k13_world`.

### Engine (js/world/engine.js, css/world.css, workbench/index.html)
- Canvas world filling the section (about 70 to 80 vh, full width), camera follows the player smoothly
  (cut under reduced motion), y-sorted drawing so characters walk behind and in front of objects.
- NPCs wander between their `wander` points, stop when the player is near, face the player when talked to.
- Interaction prompt: a small bubble over the target ("Play Debt Breaker", "Talk to Olga", "Look").
- The game/toy modal: a `<dialog>`-like overlay styled as a cabinet (bezel, marquee from decor). The
  existing card element (`#g-<game>` or the toy's card) is moved into it and back on close; the games pause
  when hidden (they already do). Focus moves into the modal and returns to the world on close; Esc closes.
- HUD (DOM, above or over the top edge of the canvas, never covering interaction): place name, Secrets n/13,
  a Help button (controls), the **Prefer a list** toggle, and a mute-free world (no audio).
- Mobile: tap-to-walk plus a small on-screen interact button; world fits the screen, no page scroll trap.
- Accessibility: the canvas has a role and a live text description of what is near ("You are in the Arcade
  hall. Near: Debt Breaker cabinet."); every interaction is reachable by keyboard; the list mode is complete.
- The classic sections (toys and arcade with every card) stay in the page as the list mode and as the
  "bay" the modal borrows cards from.

## House rules that apply (each one came from a real bug)
- Unique class prefix `kw-` for all world CSS; grep first.
- No inline style attributes, no inline scripts, absolute asset paths, no external resources.
- Nothing may cover a button: verify with elementFromPoint at every control's centre, 1280 and 390.
- No em dashes in copy a visitor reads. Never purple. Never a coloured stripe along one edge of a container.
- prefers-reduced-motion respected everywhere; the world still works.
- Plain ES5 IIFEs, no console output, no test hooks left in shipped files.

## Phases
1. This round: the building, walking, all 30 machines and benches working, the crew and the Masterminds with
   dialogue, decor, the 13 secrets with the back-room finale, list mode, mobile.
2. Later: an outdoor street (K13 town with the client shops as buildings), seasons, more rooms.
