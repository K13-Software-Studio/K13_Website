# The Workbench World, round 4: shops as their real selves (2026-10-06)

From Kazim's answers (docs/WORKBENCH_WORLD_3.md): real menu boards, staff and customers, a signature object
per place, a small task per place, a place-specific mini game, crowds by the hour, and the live site seen
from inside the game: "Canlı site oyunun içinden scroll edilebilip etkileşime geçilebilsin… sitenin motifleri
ve menünün itemleri etrafta bulunabilir, sitedeki resimlerden yararlanılabilir." His decision: a scrollable
full-page copy of each real site inside its shop, with a corner button that opens the real site; no client
site's security settings change.

Also in this round: **one building per real address.** Food halls are one building on their real block,
with each brand as a counter inside, so every place stands where it really is (today some shops sit up to
27 km away because each needed its own city block).

## Public facts only (unchanged rule)
Only the 13 public Work rows and what their own public sites show (menus, images, motifs, addresses).
Never EDISYN, private client work, prices or text that is not on the public site, or anything invented
and presented as real. Staff and customers are generic people (made with the character creator), never
real staff.

## Buildings (one per real address)
- **Miramar Food Hall, San Clemente**: host Miramar; counters Egg&Out, Lobster Lab, Cosmos Burger.
- **Windmill Food Hall, Carlsbad**: Tiger Hospitality's flagship address; counters Tiger Hospitality (its
  office corner), La Vida, Lobster Lab, Cosmos Burger.
- **Station 8, UC San Diego**: host Station8; counters Lobster Lab and Cosmos Burger (both "coming soon").
- **Global Fork Food Hall, Little Italy**: host Global Fork; counters Lobster Lab, Cosmos Burger.
- **Cosmos Burger, Oceanside**; **Lobster Lab, Del Mar**; **Carlos Almaraz at LACMA**: standalone.
- **Worldwide pier**: CENGO, TrustMeBro, baa atelier, BarFix, as today.
The geo data keeps each place's real coordinates; the region groups places that share an address into one
building and gives it the nearest lot to the real spot.

## Contract
**Data builder** owns `data/world-shops.json`, `scripts/capture-sites.py`, `assets/world/sites/*`, and the
merge of shop data into `js/world/world-data.js` through `scripts/sync-world.py` (`K13World.data.shops`):
```
shops: { <projectKey>: {
  name, url, palette:[hex...] (from the live site, never purple), motifs:[short words],
  menu:[{item, price?}] (up to 8, exactly as printed on the public site; omit price if not printed),
  signature:{kind:'stage'|'stalls'|'aquarium'|'griddle'|'greenery'|'brandwall'|'djbooth'|'ticker'|'plaster'|'scalebar'|'mural'|'eggbar', label},
  images:[{src:'/assets/world/sites/<key>-<n>.webp', w, h, alt}] (2 to 4 small images from the public site),
  full:{src:'/assets/world/sites/<key>-full.webp', w, h} (full-page capture of the live site, desktop width 1280, scaled to 720 wide),
  task:{ask, item, give, thanks} (a tiny errand in the place's own voice),
  toy:<workbench toy id or null>, crowd:{morning, noon, evening, night} (0..1 busyness from opening hours if printed, else a sensible guess marked guess:true)
} }
halls: [{id, name, address, lat, lng, host:<projectKey>, counters:[<placeId>...]}]
```
**World builder** owns `js/world/region.js`, `js/world/engine.js`, `css/world.css`, `workbench/index.html`:
halls as one building; hall interiors with one counter per brand (its sign, menu board, signature object,
toy bench when it has a toy); standalone shop interiors themed from `shops[key]`; staff behind counters and
customers by the hour (creator looks via `people.randomLook(seed)`); the task flow (talk to staff, find the
item in the room, bring it back, thanks + a sticker saved in `k13_world.stickers`); a **site screen** in every
place: interacting opens a modal with the scrollable full-page copy (`shops[key].full`), the place's images,
and a corner **Open the live site** link (new tab); motifs and menu items appear as room decor; keep every
earlier feature.
**Art builder** owns `js/world/town.js`: the signature objects above, a menu board that draws real text
items, a counter with a brand sign (`counter(ctx, key, ...)`), the site-screen kiosk, decor from motifs
(plants, posters, crates, string lights, tiles), hall furniture (shared seating, a long communal table),
all in the stage 1 and 2 style, day and night, never purple.
