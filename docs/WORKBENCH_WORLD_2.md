# The Workbench World, stage 2: SoCal, a living map (2026-10-06)

Request: Kazim, verbal, 2026-10-06: deepen the world into a real life that grows with the work. The map is
San Diego, Orange County and Los Angeles; the shops sit where they really are, aligned the way the real map
is; characters and the story are part of it, and the world keeps developing as K13 does.

Stage 1 (docs/WORKBENCH_WORLD.md) stays: the K13 studio interior is now **K13 HQ, San Diego**, one building
on a bigger map. Walk out of its front door and you are on the street.

## What a visitor gets
- **The region**: a top-down pixel map of the Southern California coast from Los Angeles to San Diego, three
  districts (LA, Orange County, San Diego), the ocean on the west, beaches, the I-5 and the coast road, hills
  inland. Geography is real: every place is projected from its real latitude and longitude, so the coast
  bends where it bends and San Clemente sits between Laguna and Oceanside.
- **The shops**: each of the 13 projects on the public Work list (and only those) is a building at its
  real location (several buildings when a client has several real locations). Each has its own storefront
  art. Walk in: a small interior with the project's desk toy when it has one (the Miramar marquee lives in
  Miramar, the egg toss in Egg & Out), a framed look at the live site, and a "Visit the live site" link.
- **Life**: the clock is San Diego's real time (dawn, day, dusk, night lighting). In the morning the crew
  leave HQ and go to the shops K13 has worked on most recently; in the evening they come home. Shops K13
  shipped something new for recently have a small "New" flag; the K13 Daily newspaper stand in HQ lists the
  latest public moves.
- **It keeps growing**: the world reads a generated data file. Every time the site ships, a script refreshes
  it from the studio's real records, so a new public project becomes a new building (it appears as a
  construction site first if it is announced on the site but not live yet), and activity moves the crew.
- **Getting around**: walk, or take the K13 van at bus stops in each district (a quick fast-travel ride on
  the freeway, a nod to Fast Track 13). A minimap shows the three districts and where you are.
- **Prefer a list** stays. The list mode now also lists the places on the map.

## Hard data rule (public facts only)
The world is public. It may show only what k13projects.com already shows: the 13 Work rows (names, public
URLs, one-line descriptions), their public addresses as printed on their own public sites, and dates of
public ships. Never: EDISYN or anything of Halil's, private or in-progress client work by name (OKTO, TLC,
ICP and the rest), the War Room journal's private lane ("James's note"), Our Story text, revenue, people's
private details. Unknown or private locations are not guessed: a project with no public address goes to the
**Worldwide pier** (a harbour in San Diego for remote and international work: BarFix, TrustMeBro, CENGO,
baa atelier's Belgium side, and so on).

## Architecture (adds to stage 1; same rules: plain ES5, no libraries, no inline styles, prefix kw-)
```
data/world-places.json   (geo builder)  hand-kept, sourced: each public project's real locations
                                         {key, name, workRow, url, category, places:[{label, address, lat, lng, source}]}
                                         plus coast/freeway/district polylines in lat/lng and HQ's spot.
scripts/sync-world.py    (geo builder)  reads data/world-places.json + the site's Work rows + the War Room's
                                         public-safe records, writes js/world/world-data.js
js/world/world-data.js   (generated)    window.K13World.data = {generated, places:[...], activity:{...}, news:[...],
                                         geo:{bbox, coast, freeways, districts, hq}}
js/world/region.js       (overworld builder)  builds the region tile map from data.geo + data.places
js/world/town.js         (art builder)  storefronts (13+, with state variants), street and nature tiles,
                                         landmarks, the van, the newspaper stand, interiors
js/world/engine.js       (overworld builder)  grows to multiple maps: HQ interior, the region, shop interiors
```

### Projection and scale
- Region bbox about lat 32.55 to 34.20, lng -118.60 to -116.95. An equirectangular projection with
  cos(33.4 deg) on longitude, so distances are honest. Target map around 220 x 300 tiles (tile 16 px); the
  geo builder picks the exact scale and exports `project(lat,lng) -> {x,y}` in world-data.js.
- Snap each building to the nearest free buildable tile on its own side of the coast; when two real places
  collide, nudge the smaller along the street, never across a district line.
- Cities are drawn where they are: a downtown grid at San Diego, Little Italy, La Jolla and UC San Diego,
  Oceanside and Carlsbad, San Clemente, Dana Point, Laguna, Newport and Irvine, Long Beach, downtown LA and
  the westside. Roads follow the real I-5 and coast road polylines.

### Activity (public-safe, generated)
`activity[projectKey] = {lastShip:'YYYY-MM-DD', shipsLast30:n, crew:[personId,...]}` where `crew` is who on
the current roster touched that project most recently (from the studio's records; current roster only, never
former crew). `news` is up to 13 short public lines ("Miramar got a new homepage", date), drawn only from
ships of the 13 public projects and the site itself.

## Builders (three, in parallel, one worktree, separate files)
- **Geo and data**: data/world-places.json (researched from each project's own public site, every place
  with a source URL), scripts/sync-world.py, js/world/world-data.js (generated, committed), the coast and
  freeway polylines, a Node check that every place projects onto land on the correct side of the coast.
- **Overworld**: js/world/region.js and engine.js stage 2: multi-map, doors (HQ, shops), the region,
  camera across a big map with chunked rendering, minimap, van fast travel, real-clock lighting, crew
  commute driven by activity, the K13 Daily stand, list mode extended.
- **Town art**: js/world/town.js: storefronts per project with live / new / construction variants, street,
  sidewalk, crosswalk, sand, animated ocean and surf, grass, hills, palms, freeway with cars, a pier, the
  Worldwide pier, district welcome signs, the van, interiors per category (food hall, kitchen, market,
  studio, gallery, club, office), all day and night.

## House rules (unchanged): never purple, no edge stripes, no em dashes in visitor copy, reduced motion
honoured, nothing covers a button, no keyboard trap, no console output, no test hooks, CSP clean.
