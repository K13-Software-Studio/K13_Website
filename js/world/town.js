/* js/world/town.js  -  K13 Workbench World, stage 2: the town (pixel art drawn in code)
   Owner: town art builder. Plain ES5, no libraries, no fetches, no console output, no inline styles.
   Same palette, density and painter as decor.js (K13 tokens + natural colours). Never purple.

   PUBLIC API  (window.K13World.town)
     tile(ctx, name, x, y, s, t, light)        one 16x16 logical tile. x,y = DESTINATION PIXELS of the top-left corner
                                               (already scaled), s = integer scale, t = seconds (water and surf animate).
                                               Names it does not know go to K13World.decor.tile when decor.js is loaded.
     object(ctx, obj, s, t, light)             top-left at (obj.x*16*s, obj.y*16*s) in the ctx's CURRENT transform.
     objectAt(ctx, obj, px, py, s, t, light)   same, at explicit destination pixels. obj = {id|kind, x, y, w?, h?, ...}.
                                               The sprite fills obj.w x obj.h tiles; when missing, info(id) supplies it.
     info(idOrObj)                             {w,h,layer,glow} for an object name; for a storefront key (or an object
                                               with kind 'storefront') {w,h,door:{dx,dy},category,name,key,kind:'storefront'}.
                                               layer: 'floor' (draw first, flat), 'wall' (hangs on a wall), 'object' (y-sorted).
     storefront(ctx, key, state, px, py, s, t, light)   one building, top-left at px,py (scaled pixels). state is
                                               'live' | 'new' | 'construction' (anything else counts as 'live').
     storefrontInfo(key)                       {w,h,door:{dx,dy},category,name,key} always (an unknown key gets a plain
                                               5x5 shop whose sign spells the key, so a new public project already has a body).
     storefrontLights(key, state)              [{x,y,r,color}] in TILE units from the building's top-left, for the engine's
                                               night overlay (empty for construction). The art also glows by itself.
     lights(obj)                               same for an object, like decor.lights.
     interior(category)                        a fresh tile map description for one of K13World.town.categories (below).
     diagRun(kit, dir, x, y, len)              tiles of a diagonal road run, see ROAD KIT.
     shopKey(name)                             canonical storefront key for a key or alias ('lavida', 'hq', ...), or null.
     tileNames, objectNames, shopKeys, shops, categories, carColors, directions, frameInner   lists / metadata.

   LIGHT (last parameter of tile/object/storefront, optional)
     undefined  follows the theme: <html data-theme="dark"> = night, otherwise day.
     'day' | 'night' | 'dawn' | 'dusk'   forces a palette. dawn is a peach tint, dusk an orange one and the lamps are lit.
     'indoor'   for interiors: warm and bright whatever the clock says, window panes follow the theme's sky.
     true       same as 'night'.
   MOTION  every animation (surf, ocean, palms swaying, neon flicker, marquee bulbs, flags, ticker, crane, lighthouse
     beam, fountain, DJ lights) reads matchMedia('(prefers-reduced-motion: reduce)'); reduced shows one still frame.

   DOORS AND SIZES  A storefront sprite is exactly w x h tiles and its bottom row is the doorstep row. info(key).door
     = {dx,dy} is the door TILE inside the building (dy = h-1): the whole footprint is solid except that tile, and the
     visitor enters by walking into it (or pressing E on it from the street, one tile below). Draw the building y-sorted
     by its bottom edge like any object. Door positions, sizes and interior category:
       TigerHospitality_Website_01 7x5 door 3,4 office     LaVida 5x5 door 2,4 kitchen    Miramar 7x5 door 3,4 foodhall
       CENGO 5x5 door 2,4 club       STATION8 8x5 door 3,4 market     GlobalFork 7x5 door 3,4 foodhall
       EggOut 5x5 door 2,4 kitchen   TrustMeBro 5x5 door 2,4 office   baa_atelier 5x5 door 2,4 studio
       BarFix 5x5 door 2,4 bar       LobsterLab 6x5 door 2,4 kitchen  Cosmos 5x5 door 2,4 kitchen
       CarlosAlmaraz 5x5 door 2,4 gallery                             K13HQ 8x6 door 3,5 office  (aliases hq, k13hq, k13)
     States: live = lit windows and a small OPEN sign; new = live plus a ribbon across the door and a NEW pennant on
     the roof; construction = scaffold, tarp over the sign, boarded windows and door, cones and a COMING SOON board.
     At night and dusk lit windows, signs and neon glow; construction stays dark.

   TILES (189 incl. the road kit; 16x16; animated ones marked *)
     water    ocean* ocean-2* ocean-3* ocean-deep* ocean-deep-2* (alternate them per tile so it does not tile visibly)
              harbour* harbour-2* (calm, greener)
     shore    surf-w* surf-e* surf-n* surf-s* : water on the west/east/north/south side of the tile, sand on the other
              surf-in-nw|ne|sw|se* : water pocket in that corner (concave coast)
              surf-out-nw|ne|sw|se* : sand corner in that corner, water around (convex coast)
              aliases: water, sea, shore, surf, harbor
     land     sand sand-2 sand-3 wet-sand wet-sand-2 grass-a grass-b park park-flowers park-path dirt dirt-2
              hill-1 hill-2 (green) hill-3 hill-4 (dry gold) hill-5 (rocky); same ground colour so they blend
              ground-la ground-oc ground-sd (district city ground: warm grey, sage, golden; subtle)
     road     road road-h road-v (single yellow dashes) road-dbl-h road-dbl-v (double yellow) road-edge-n|s|w|e
              road-stop-h road-stop-v   crosswalk-h (on a road that runs east-west) crosswalk-v
     freeway  freeway-h freeway-v (two dashed white lines) freeway-edge-n|s|w|e (solid line + shoulder)
              freeway-median-h freeway-median-v
     walk     sidewalk sidewalk-curb-n|s|w|e (curb on the side facing the road) curb-corner-nw|ne|sw|se plaza plaza-b
     harbour  pier pier-2 (planks east-west) pier-v (planks north-south)
     interior floor-tile floor-green floor-brick floor-club floor-dark floor-pale floor-hall floor-office
              mat-k13 (door mat) wall-plain wall-green wall-lime wall-brick wall-black wall-cap and the -up of each
   OBJECTS (default w x h in tiles; layer; every one can be resized with obj.w / obj.h only where noted)
     nature   palm-1 1x2, palm-2 1x3, palm-3 2x4, palm-4 1x5 (sway), coral-tree 2x3 (orange-red blossom, sway),
              eucalyptus 2x4 (sway), bush, agave, rock 1x1, flowerbed 1x1 floor
     street   lamp 1x2 (glows), parkbench 2x1, busstop 2x2 (K13 van sign), trolleystop 3x2, newsstand 3x2 (K13 DAILY),
              mailbox, hydrant, bikerack, cone 1x1, foodtruck 3x2, fountain 2x2 (animated), scaffold 2x3
     beach    lifeguard 2x3, surfrack 1x2, surfboard 1x1, umbrella 2x2
     harbour  pier 8x2 and pier-v 2x8 (floor layer, resize with obj.w/obj.h, lamps glow at night), worldpier 10x4
              (the Worldwide pier: flags of US, BE, TR, IT, JP, MX, FR and a signpost of distances in miles),
              crane 4x6 (Long Beach, trolley moves), lighthouse 3x6 (Point Loma, beam at night), missionbell 2x3
              (San Clemente, Spanish revival bell wall)
     signs    sign-la 6x2 (LOS ANGELES hill letters), sign-oc 5x3 (Welcome to Orange County), sign-sd 5x3 (San Diego)
     vehicles id 'van-down|up|left|right' (K13 van, orange with 13) or {kind:'van', dir};
              id 'car-<color>-<dir>' or {kind:'car', color, dir}; colors red blue white yellow green black silver
              orange. down/up are 1x2, left/right are 2x1.
     interior counter 4x2 (obj.tone wood|steel|dark|green|cream|red|orange|olive|blue|ink; w resizable) tablelong 4x2
              table 2x2 stool 1x1 stall 3x2 (tone) shelf 2x2 (stock jars|produce|bottles|books) crates 1x1 cart 2x1
              stove 2x2 prep 2x1 fridge 1x2 djbooth 4x2 speaker 1x2 neonsign 3x1 (text, color red|orange|jade|gold)
              discoball 1x1 dancefloor 6x3 (floor) officedesk 2x2 sofa 3x2 pot 1x2 easel 1x2 plinth 1x2 painting 2x2
              (art fire|sea|stucco) viewbench 3x1 barback 6x2 scale 1x2 chalkboard 2x1 (text) frame 3x2 toybench 2x2
              rug 6x3 (floor, tone) intwindow 2x2 bunting 6x1
   INTERIORS  interior(category) -> {id, category, name, w, h, tiles:[row strings], legend, objects, spawn, door, host, slots}
     like map.js: legend maps a char to {floor|wall|solid, tile:'name'} (draw the name with town.tile). Chars: ' ' void,
     '#' wall cap, 'U' upper wall, 'W' lower wall, 'f' and 'g' floor, 'd' the door mat (also door:true).
     objects: [{id,kind,x,y,w,h,solid,layer,label?,slot?,tone?,text?,art?,stock?,fh?}], draw them with town.objectAt
     (floor layer first, then wall layer, then 'object' layer sorted by y+h). fh = footprint height: only the bottom fh rows
     block movement. spawn = feet position in tiles just inside the door; door = {x,y,w:2} the exit tiles on the bottom row.
     Three slots in every interior: slot:'toy' (a bench, 2x2, the desk toy goes on it), slot:'frame' (3x2 on the wall; the
     live-site screenshot goes in frameInner = {dx:0.2,dy:0.2,w:2.6,h:1.6} tiles inside it) and slot:'host' (a counter, stall
     or DJ booth; `host` = {x,y} is where the host NPC stands, feet position behind it). slots{} repeats where each sits.
     Categories and size (tiles): foodhall 16x10, kitchen 14x10, market 16x10, club 14x10, studio 14x10, gallery 14x10,
     office 14x10, bar 14x10. Pass light 'indoor' when drawing them. Frames, toys and hosts overlap nothing.

   ROAD KIT (stage 2b). Masks are 4-bit connections N=1 E=2 S=4 W=8 (0..15). Street tiles are opaque. Freeway, coast road,
   diagonal, ramp and overpass tiles are TRANSPARENT where there is no road: draw a ground tile (grass, sand, ground-*) first.
     road-<mask>        street: 10 px asphalt, 3 px sidewalk with a curb on every unconnected side, rounded corners,
                        T-junctions and 4-way crossings; a centre dash only on straight runs (5 and 10); crosswalk bars on
                        every arm of 3- and 4-way tiles. road-<mask>-nx (masks 7 11 13 14 15) is the same without crosswalks.
                        (road-0 is a cul-de-sac puck, 1 2 4 8 are dead ends.)
     fwy-<mask>         freeway, 2+2 lanes, 16 px wide: shoulders, white edge lines, dashed lane lines, a concrete median.
                        Bends (3 6 9 12) are smooth quarter arcs. 3- and 4-way tiles (7 11 13 14 15) are an all-asphalt
                        interchange apron with an edge line only on the missing side.
     pch-<mask>         Pacific Coast Highway, 2 lanes, 12 px, double yellow, white edges, gravel shoulder; same masks.
     DIAGONALS  A 16 px band at 45 degrees also touches the four edge neighbours of every body tile, so a run is made of
        body tiles plus flank tiles. Use town.diagRun(kit, dir, x, y, len) -> [{name,x,y}] to get them all:
          fwy-d-ne  pch-d-ne  body for a run toward the north-east (tiles (x+k, y-k)); flanks fwy-d-ne-lr (road in its NW
                              corner, placed east and south of each body tile) and fwy-d-ne-ul (road in its SE corner, placed
                              west and north), same for pch
          fwy-d-nw  pch-d-nw  body for a run toward the north-west / south-east (tiles (x+k, y+k)); flanks fwy-d-nw-ur
                              (north and east of each body tile) and fwy-d-nw-ll (south and west), same for pch
        TRANSITIONS between a straight tile and a diagonal body. The name is <kit>-t-<straight edge heading>-<diagonal
        heading>: the straight road enters one edge and the diagonal leaves through a tile corner (centre lines pass through
        the tile centre; the diagonal body tile sits diagonally next to it):
          fwy-t-n-ne  straight comes from the south edge, goes north, then north-east (leaves by the NE corner)
          fwy-t-n-nw  south edge, then north-west          fwy-t-s-se  north edge, then south-east (SE corner)
          fwy-t-s-sw  north edge, then south-west          fwy-t-e-ne  west edge, then north-east
          fwy-t-e-se  west edge, then south-east           fwy-t-w-nw  east edge, then north-west
          fwy-t-w-sw  east edge, then south-west            (pch-t-* are the same eight)
        A transition is its own reverse: at the far end of a north-east run turning north use fwy-t-s-sw, turning east
        fwy-t-w-sw. Its two neighbours on the diagonal side get the flank tiles automatically from diagRun (they are the
        flanks of the first and last body tile).
     OVERPASS  fwy-over-ns (freeway runs north-south on a bridge with concrete rails; the street under it runs east-west and
        its tiles stop on both sides), fwy-over-ew (the other way). fwy-under-ns / fwy-under-ew: the street tile that passes
        under (dark, with abutments); under-ns is a north-south street under an east-west freeway.
     RAMPS  ramp-ns-e-a ramp-ns-e-b ramp-ns-w-a ramp-ns-w-b: a north-south freeway tile with a one lane ramp leaving on the
        east or west side; -a branches at the top and exits low, -b branches at the bottom and exits high (use one as the off
        ramp and the other as the on ramp). ramp-ew-s-a ramp-ew-s-b ramp-ew-n-a ramp-ew-n-b: the same for an east-west
        freeway, ramp on the south or north side (-a branches at the left, -b at the right). ramp-v and ramp-h: a straight
        one lane ramp road (6 px, gravel shoulder) that joins a ramp tile to a street.
   CITY FILL (objects; w x h tiles; every one has info(id); drawn at 1x like the rest, windows glow at night and dusk)
     house-1 house-2 house-3 (3x3) house-4 house-5 house-6 (4x3): stucco walls, Spanish tile roofs, chimney, garage or porch.
     apt-1 (4x4) apt-2 (5x4) apt-3 (3x5): apartment blocks with window grids, balconies, awning and a rooftop.
     strip-1 (6x3) strip-2 (7x3) strip-3 (5x3): a strip of generic shops (CAFE NAILS PIZZA, DELI BOOKS SURF, TACOS BANK).
     parking 6x4, parking-s 4x3: a lot with stalls and parked cars (floor layer, draw before y-sorted objects).
     lawn-1 2x2, lawn-2 3x2 (path), lawn-3 2x2 (flowers): hedge-edged lawns, floor layer.
     gasstation 5x4 (corner station, orange canopy, two pumps, store, glows at night), school 7x4 (brick, flag, SCHOOL),
     church 4x5 (stucco, tile roof, bell tower), park-small 5x5 (fountain, paths, benches, trees, flowers; floor layer),
     median-h 4x3 and median-v 1x4 (tree-lined median strip with palms and shrubs; tile it along a boulevard).
   NOTE  the pixel font has capitals only, so signs read in capitals ("BAA ATELIER"). Distances on the Worldwide
     pier are miles from San Diego, rounded. */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : (typeof global !== "undefined" ? global : {});
  var K = root.K13World = root.K13World || {};
  var TS = 16;

  /* ---------- palette (K13 tokens + natural colours; never purple) ---------- */
  var BASE = {
    graphite: "#1F2023", ink: "#26272B", steel: "#414347", slate: "#5D5F65", paper: "#F3F5FA", cream: "#F6EEDC",
    white: "#FFFFFF", orange: "#EA5E14", dorange: "#B94612", gold: "#F0B429", jade: "#4F9E92", djade: "#2F6F65",
    wood: "#8A5A3B", dwood: "#5E3B26", lwood: "#A97650", ol: "#2B1D16", red: "#C8402B", dred: "#9A2F20", skin: "#F1C7A0",
    plant: "#3C8A5E", dplant: "#2A6644", glass: "#BFE3E0", brass: "#C9A24A", dark: "#101214",
    ocean: "#2F7F99", ocean2: "#3A8CA6", oceanL: "#7CC4CF", oceanD: "#245F7A", oceanDD: "#1B4B63", foam: "#F4F8F2",
    wetsand: "#BFA571", wetsandD: "#A68C5C", sand: "#E2CF9A", sandD: "#CDB982", sandL: "#EEDFB2",
    grass: "#7BAE55", grassD: "#639645", grassL: "#93C468", grass2: "#8DB35A", park: "#6FB562", parkL: "#86C46E",
    fy: "#F5D142", fo: "#F08A3C", fw: "#FFFFFF", fr: "#E2503A", fpk: "#F2A0B0",
    dirt: "#B08A5B", dirtD: "#977248", dirtL: "#C4A171", hill: "#8FA85A", hillD: "#6F8A45", hillL: "#A8BE70",
    hillDry: "#C2A55E", hillDryD: "#A58A47", hillDryL: "#D6BD7A", rock: "#8C8479", rockD: "#6E675D", rockL: "#A39B8E",
    asph: "#4A4C52", asphD: "#404247", asphL: "#585A60", lineY: "#E7B93A", lineW: "#E8E8E2",
    side: "#C9C5BB", sideD: "#B3AEA2", sideL: "#D8D4CB", curb: "#9C998F", curbL: "#B7B4AA",
    plaza: "#D9B98C", plazaD: "#C39F70", plazaL: "#E6CCA3",
    harb: "#3E8A94", harbL: "#78B7B5", harbD: "#2F6F7A", pier: "#A5784E", pierD: "#7E5836", pierL: "#BC8E62",
    gLA: "#CDBFA3", gLAD: "#B8A98C", gOC: "#C2CA9C", gOCD: "#A9B484", gSD: "#D6C28E", gSDD: "#BFAA74",
    trunk: "#9A7A56", trunkD: "#6E5539", trunkL: "#B89A74", palmG: "#4E9A4A", palmD: "#356F38", palmL: "#7DBF5A",
    coral: "#E04A2B", coralL: "#F27A3A", euc: "#7C9A7A", eucD: "#5B7A5C", eucL: "#A5BBA0", eucT: "#D5CBB6",
    stucco: "#EFE4CC", stuccoD: "#D8C9A6", terra: "#C8623A", terraD: "#A04A29", terraL: "#DE7C4E",
    mail: "#2A5C8A", mailD: "#1F4668", silver: "#B9BEC8", silverD: "#8E939D", blue: "#2E6FA8", blueD: "#245A89",
    olive: "#8C9A3A", oliveD: "#6E7B2A", pink: "#F4B6BE", greenD: "#0F5A4A", green: "#17705C", tan: "#D9C99A", brownD: "#4A3326",
    brick: "#B2653F", brickD: "#8F4E2E", brickL: "#C77E54", yolk: "#F6C945", yolkD: "#D9A82A", lime: "#E9E1CF", limeD: "#D3C8AF", limeL: "#F4EEDF"
  };
  var LIT = { orange: "#FF8A3D", gold: "#FFC83D", jade: "#5FD1BE", plant: "#6BD08A", cream: "#FFF3D6", white: "#FFFFFF", red: "#FF5A3C", yellow: "#FFD93D", amber: "#FFB347" };
  var NF = [0.5, 0.56, 0.68];

  function hex2rgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgb2hex(r, g, b) { return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); }
  function dim(h, f) { var c = hex2rgb(h); return rgb2hex(Math.round(c[0] * f[0]), Math.round(c[1] * f[1]), Math.round(c[2] * f[2])); }
  function mix(a, b, t) { var A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(Math.round(A[0] + (B[0] - A[0]) * t), Math.round(A[1] + (B[1] - A[1]) * t), Math.round(A[2] + (B[2] - A[2]) * t)); }
  function rgba(h, a) { var c = hex2rgb(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }

  var PALS = {};
  function buildPal(mode) {
    var o = {}, k, h;
    for (k in BASE) {
      if (!BASE.hasOwnProperty(k)) { continue; }
      h = BASE[k];
      if (mode === "night") { h = dim(h, (k === "pink" || k === "fpk") ? [0.52, 0.44, 0.48] : NF); }
      else if (mode === "dusk") { h = dim(mix(h, "#F2A15A", 0.18), [0.92, 0.88, 0.88]); }
      else if (mode === "indoor" || mode === "indoor-night") { h = mix(h, "#FFD9A8", 0.07); }
      else if (mode === "dawn") { h = dim(mix(h, "#F6C9A0", 0.16), [0.96, 0.94, 0.94]); }
      o[k] = h;
    }
    return o;
  }
  function pal(mode) { return PALS[mode] || (PALS[mode] = buildPal(mode)); }
  function isNightTheme() { try { return root.document.documentElement.getAttribute("data-theme") === "dark"; } catch (e) { return false; } }
  function modeOf(light) {
    if (light === true) { return "night"; }
    if (light === "indoor") { return isNightTheme() ? "indoor-night" : "indoor"; }
    if (light === "night" || light === "dusk" || light === "dawn" || light === "day") { return light; }
    return isNightTheme() ? "night" : "day";
  }
  function lampsOn(mode) { return mode === "night" || mode === "dusk" || mode === "indoor" || mode === "indoor-night"; }
  function still() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  var STILL_T = 2.3;
  function hash(x, y, k) { var n = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return n - Math.floor(n); }

  /* ---------- painter (same as decor.js, plus a few helpers) ---------- */
  function mkP(ctx, ox, oy, s) {
    var p = { ctx: ctx, ox: ox, oy: oy, s: s };
    p.r = function (x, y, w, h, col, a) {
      if (w <= 0 || h <= 0) { return; }
      if (a !== undefined && a < 1) { ctx.globalAlpha = a; }
      ctx.fillStyle = col; ctx.fillRect(ox + x * s, oy + y * s, w * s, h * s);
      if (a !== undefined && a < 1) { ctx.globalAlpha = 1; }
    };
    p.px = function (x, y, col, a) { p.r(x, y, 1, 1, col, a); };
    p.box = function (x, y, w, h, fill, hi, lo) {
      p.r(x, y, w, h, fill);
      if (hi) { p.r(x, y, w, 1, hi); p.r(x, y, 1, h, hi); }
      if (lo) { p.r(x, y + h - 1, w, 1, lo); p.r(x + w - 1, y, 1, h, lo); }
    };
    p.ol = function (x, y, w, h, col) { p.r(x, y, w, 1, col); p.r(x, y + h - 1, w, 1, col); p.r(x, y, 1, h, col); p.r(x + w - 1, y, 1, h, col); };
    p.map = function (x, y, rows, leg) {
      var i, j, ch, col, row;
      for (j = 0; j < rows.length; j++) { row = rows[j]; for (i = 0; i < row.length; i++) { ch = row.charAt(i); col = leg[ch]; if (col) { p.r(x + i, y + j, 1, 1, col); } } }
    };
    p.ell = function (cx, cy, rx, ry, col, a) {
      var j, w;
      for (j = -ry; j <= ry; j++) { w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j * j) / ((ry + 0.5) * (ry + 0.5))))); p.r(cx - w, cy + j, w * 2 + 1, 1, col, a); }
    };
    p.txt = function (str, x, y, col, sz, gap) {
      var i, r, c, g; sz = sz || 1; gap = (gap === undefined) ? 1 : gap;
      for (i = 0; i < str.length; i++) {
        g = FONT[str.charAt(i)]; if (!g) { continue; }
        for (r = 0; r < 5; r++) { for (c = 0; c < 3; c++) { if (g.charAt(r * 3 + c) === "1") { p.r(x + (i * (3 + gap) + c) * sz, y + r * sz, sz, sz, col); } } }
      }
    };
    return p;
  }
  var FONT = {
    "A": "010101111101101", "B": "110101110101110", "C": "011100100100011", "D": "110101101101110", "E": "111100110100111",
    "F": "111100110100100", "G": "011100101101011", "H": "101101111101101", "I": "111010010010111", "J": "001001001101010",
    "K": "101101110101101", "L": "100100100100111", "M": "101111111101101", "N": "110101101101101", "O": "010101101101010",
    "P": "110101110100100", "Q": "010101101110011", "R": "110101110101101", "S": "011100010001110", "T": "111010010010010",
    "U": "101101101101111", "V": "101101101101010", "W": "101101111111101", "X": "101101010101101", "Y": "101101010010010",
    "Z": "111001010100111", "0": "111101101101111", "1": "010110010010111", "2": "110001010100111", "3": "110001010001110",
    "4": "101101111001001", "5": "111100110001110", "6": "011100111101111", "7": "111001010010010", "8": "111101111101111",
    "9": "111101111001110", "&": "010101010101011", "?": "110001010000010", "!": "010010010000010", ".": "000000000000010",
    "-": "000000111000000", ",": "000000000010100", ":": "000010000010000", "/": "001001010100100", "'": "010010000000000",
    "+": "000010111010000", "%": "101001010100101", "~": "000011110000000", " ": "000000000000000"
  };
  function textW(str, sz, gap) { gap = (gap === undefined) ? 1 : gap; sz = sz || 1; return str.length ? (str.length * (3 + gap) - gap) * sz : 0; }
  /* centred text that picks the biggest size (2 or 1) that fits maxW */
  function fit(p, str, cx, y, maxW, col, maxSz) {
    var sz = maxSz || 2;
    while (sz > 1 && textW(str, sz) > maxW) { sz--; }
    p.txt(str, Math.round(cx - textW(str, sz) / 2), y, col, sz);
    return sz;
  }

  /* ---------- sprite cache ---------- */
  var cache = {};
  function sprite(key, w, h, fn) {
    var c = cache[key], x;
    if (c) { return c; }
    c = root.document.createElement("canvas"); c.width = w; c.height = h;
    x = c.getContext("2d"); fn(mkP(x, 0, 0, 1), w, h); cache[key] = c; return c;
  }
  function blit(ctx, cv, dx, dy, s) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, 0, 0, cv.width, cv.height, dx, dy, cv.width * s, cv.height * s);
  }
  function glowAt(ctx, cx, cy, r, color, a) {
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2); ctx.restore();
  }
  function shadow(p, W, H, inset, h) { inset = inset || 1; h = h || 3; p.r(inset, H - h, W - inset * 2, h, "#000000", 0.22); }
  function speck(p, x, y, w, h, col, n, seed, a) {
    var i;
    for (i = 0; i < n; i++) { p.px(x + Math.floor(hash(i, seed, 41) * w), y + Math.floor(hash(i, seed, 42) * h), col, a); }
  }

  /* =====================================================================================
     TILES  (16 x 16 logical px; f = animation frame 0..3, 0 when still)
     ===================================================================================== */
  function tOcean(p, c, f, v, deep) {
    var base = deep ? c.oceanD : c.ocean, mid = deep ? c.oceanDD : c.ocean2, hi = deep ? c.ocean : c.oceanL, i, x, y, ph, l, lv;
    p.r(0, 0, 16, 16, base);
    for (y = 0; y < 16; y += 4) { p.r(0, y + ((v + y) % 3), 16, 1, mid, deep ? 0.7 : 0.5); }
    for (i = 0; i < 5; i++) {
      x = Math.floor(hash(i, v, 31) * 12); y = Math.floor(hash(i, v, 32) * 15); ph = Math.floor(hash(i, v, 33) * 4); l = 2 + Math.floor(hash(i, v, 34) * 3);
      lv = (f + ph) % 4;
      if (lv === 0) { p.r(x, y, l, 1, hi, 0.9); } else if (lv === 1) { p.r(x + 1, y, l - 1, 1, hi, 0.45); }
    }
  }
  function tHarbour(p, c, f, v) {
    var i, x, y, ph, lv;
    p.r(0, 0, 16, 16, c.harb);
    for (y = 1; y < 16; y += 5) { p.r(0, y, 16, 1, c.harbD, 0.35); }
    for (i = 0; i < 4; i++) {
      x = Math.floor(hash(i, v, 51) * 11); y = Math.floor(hash(i, v, 52) * 15); ph = Math.floor(hash(i, v, 53) * 4); lv = (f + ph) % 4;
      if (lv === 0) { p.r(x, y, 4, 1, c.harbL, 0.75); p.r(x + 1, y + 1, 2, 1, c.harbL, 0.35); }
      else if (lv === 1) { p.r(x + 1, y, 2, 1, c.harbL, 0.4); }
    }
  }
  /* shoreline: d(x,y) = signed distance in px to the waterline, negative = water */
  function shore(p, c, f, d, along) {
    var x, y, dd, wob, col;
    for (y = 0; y < 16; y++) {
      for (x = 0; x < 16; x++) {
        wob = Math.sin((along(x, y) / 16 + f / 4) * Math.PI * 2) * 1.3;
        dd = d(x + 0.5, y + 0.5) + wob;
        if (dd < -6) { col = ((x * 3 + y * 5) % 11 === 0) ? c.oceanL : c.ocean; }
        else if (dd < -3.2) { col = c.ocean2; }
        else if (dd < -1.6) { col = c.oceanL; }
        else if (dd < 0.9) { col = c.foam; }
        else if (dd < 2.6) { col = c.wetsand; }
        else if (dd < 4.2) { col = (hash(x, y, 61) > 0.5) ? c.wetsand : c.sand; }
        else { col = (hash(x, y, 62) > 0.9) ? c.sandD : ((hash(x, y, 63) > 0.93) ? c.sandL : c.sand); }
        p.px(x, y, col);
      }
    }
    /* a ghost of foam out in the water, drifting with the frame */
    for (x = 0; x < 16; x++) { for (y = 0; y < 16; y++) {
      dd = d(x + 0.5, y + 0.5) + Math.sin((along(x, y) / 16 + f / 4) * Math.PI * 2) * 1.3;
      if (dd > -5.4 && dd < -4.6 && ((along(x, y) + f * 3) % 8) < 3) { p.px(x, y, c.foam, 0.55); }
    } }
  }
  var SHORE = {
    "surf-w": [function (x) { return x - 8; }, function (x, y) { return y; }],
    "surf-e": [function (x) { return 8 - x; }, function (x, y) { return y; }],
    "surf-n": [function (x, y) { return y - 8; }, function (x) { return x; }],
    "surf-s": [function (x, y) { return 8 - y; }, function (x) { return x; }],
    "surf-in-nw": [function (x, y) { return Math.sqrt(x * x + y * y) - 8; }, function (x, y) { return x + y; }],
    "surf-in-ne": [function (x, y) { return Math.sqrt((16 - x) * (16 - x) + y * y) - 8; }, function (x, y) { return x + y; }],
    "surf-in-sw": [function (x, y) { return Math.sqrt(x * x + (16 - y) * (16 - y)) - 8; }, function (x, y) { return x + y; }],
    "surf-in-se": [function (x, y) { return Math.sqrt((16 - x) * (16 - x) + (16 - y) * (16 - y)) - 8; }, function (x, y) { return x + y; }],
    "surf-out-nw": [function (x, y) { return 8 - Math.sqrt(x * x + y * y); }, function (x, y) { return x + y; }],
    "surf-out-ne": [function (x, y) { return 8 - Math.sqrt((16 - x) * (16 - x) + y * y); }, function (x, y) { return x + y; }],
    "surf-out-sw": [function (x, y) { return 8 - Math.sqrt(x * x + (16 - y) * (16 - y)); }, function (x, y) { return x + y; }],
    "surf-out-se": [function (x, y) { return 8 - Math.sqrt((16 - x) * (16 - x) + (16 - y) * (16 - y)); }, function (x, y) { return x + y; }]
  };
  function tSand(p, c, v) {
    var i, x, y;
    p.r(0, 0, 16, 16, c.sand);
    speck(p, 0, 0, 16, 16, c.sandD, 14, 70 + v);
    speck(p, 0, 0, 16, 16, c.sandL, 9, 80 + v);
    if (v === 1) { for (i = 0; i < 2; i++) { y = 3 + i * 8; p.r(2, y, 5, 1, c.sandD, 0.7); p.r(7, y + 1, 4, 1, c.sandD, 0.7); p.r(11, y, 3, 1, c.sandD, 0.7); } }
    if (v === 2) { x = 4 + Math.floor(hash(1, 2, 90) * 8); p.px(x, 9, c.cream); p.px(x + 1, 9, c.pink); p.px(x, 10, c.sandD); }
  }
  function tWetSand(p, c, v) {
    p.r(0, 0, 16, 16, c.wetsand);
    speck(p, 0, 0, 16, 16, c.wetsandD, 16, 100 + v);
    p.r(1 + v * 3, 4, 5, 1, c.sandL, 0.4); p.r(8, 11 - v, 6, 1, c.sandL, 0.35); p.r(3, 14, 3, 1, c.wetsandD, 0.6);
  }
  function tuft(p, x, y, a, b) { p.px(x, y, a); p.px(x - 1, y - 1, b); p.px(x + 1, y - 1, b); p.px(x, y - 1, b); }
  function tGrass(p, c, v) {
    var i, base = v === 1 ? c.grass2 : c.grass;
    p.r(0, 0, 16, 16, base);
    speck(p, 0, 0, 16, 16, v === 1 ? c.grass : c.grassD, 12, 110 + v, 0.8);
    for (i = 0; i < 5; i++) { tuft(p, 2 + Math.floor(hash(i, v, 111) * 12), 3 + Math.floor(hash(i, v, 112) * 12), v === 1 ? c.grassD : c.grassD, c.grassL); }
    if (v === 1) { p.px(4, 5, c.fw); p.px(11, 11, c.fy); p.px(9, 2, c.fw); }
  }
  function tPark(p, c, v) {
    var i, cols = [c.fy, c.fo, c.fw, c.fpk, c.fr];
    p.r(0, 0, 16, 16, c.park);
    p.r(0, 0, 16, 8, c.parkL, 0.45);
    speck(p, 0, 0, 16, 16, c.grassD, 8, 120 + v, 0.7);
    if (v === 1) {
      for (i = 0; i < 7; i++) {
        var fx = 1 + Math.floor(hash(i, v, 121) * 14), fy = 1 + Math.floor(hash(i, v, 122) * 14), fc = cols[i % cols.length];
        p.px(fx, fy, fc); p.px(fx + 1, fy, fc, 0.6); p.px(fx, fy + 1, c.grassD);
      }
    } else { tuft(p, 5, 6, c.grassD, c.grassL); tuft(p, 12, 12, c.grassD, c.grassL); }
  }
  function tGravel(p, c) {
    p.r(0, 0, 16, 16, c.dirtL);
    speck(p, 0, 0, 16, 16, c.dirt, 18, 130); speck(p, 0, 0, 16, 16, c.sandL, 10, 131);
    p.r(0, 0, 16, 1, c.dirt, 0.5); p.r(0, 15, 16, 1, c.dirt, 0.5);
  }
  function tDirt(p, c, v) {
    p.r(0, 0, 16, 16, c.dirt);
    speck(p, 0, 0, 16, 16, c.dirtD, 16, 140 + v); speck(p, 0, 0, 16, 16, c.dirtL, 10, 150 + v);
    if (v === 1) { p.r(3, 6, 3, 1, c.dirtD); p.r(4, 7, 1, 1, c.dirtD); p.r(10, 11, 3, 1, c.dirtD); p.r(11, 12, 1, 1, c.dirtD); }
    else { p.px(5, 5, c.rock); p.px(6, 5, c.rockL); p.px(12, 10, c.rock); }
  }
  /* hills: ground colour is shared by every variant, so a field of hill tiles reads as one landscape */
  function dome(p, cx, cy, rx, ry, base, hi, lo) {
    p.ell(cx + 1, cy + 2, rx, ry, lo, 0.55);
    p.ell(cx, cy, rx, ry, base);
    p.ell(cx - 1, cy - 1, Math.max(1, rx - 3), Math.max(1, ry - 2), hi, 0.7);
    p.px(cx - rx + 1, cy + ry - 1, lo, 0.8);
  }
  function tHill(p, c, v) {
    var dry = v === 3 || v === 4, base = dry ? c.hillDry : c.hill, d = dry ? c.hillDryD : c.hillD, l = dry ? c.hillDryL : c.hillL;
    p.r(0, 0, 16, 16, base);
    speck(p, 0, 0, 16, 16, d, 12, 160 + v, 0.7);
    if (v === 1) { dome(p, 8, 8, 6, 5, base, l, d); tuft(p, 4, 13, d, l); }
    else if (v === 2) { dome(p, 5, 6, 4, 4, base, l, d); dome(p, 11, 10, 4, 4, base, l, d); }
    else if (v === 3) { dome(p, 8, 7, 7, 5, base, l, d); p.r(3, 10, 4, 1, d, 0.8); p.r(9, 11, 4, 1, d, 0.8); }
    else if (v === 4) { dome(p, 6, 9, 5, 4, base, l, d); p.ell(11, 5, 2, 2, c.rock); p.ell(10, 4, 1, 1, c.rockL); p.px(12, 6, c.rockD); p.px(3, 3, c.plant); p.px(4, 3, c.plant); }
    else { p.ell(8, 9, 5, 4, c.rock); p.ell(7, 8, 3, 2, c.rockL); p.r(5, 12, 7, 1, c.rockD, 0.7); tuft(p, 3, 5, d, l); tuft(p, 13, 4, d, l); }
  }
  function asphalt(p, c, seed) {
    p.r(0, 0, 16, 16, c.asph);
    speck(p, 0, 0, 16, 16, c.asphD, 18, 170 + seed); speck(p, 0, 0, 16, 16, c.asphL, 10, 180 + seed);
  }
  function dashH(p, y, col, th) { var x; for (x = 0; x < 16; x += 8) { p.r(x, y, 5, th || 1, col); } }
  function dashV(p, x, col, th) { var y; for (y = 0; y < 16; y += 8) { p.r(x, y, th || 1, 5, col); } }
  function tRoad(p, c, kind) {
    asphalt(p, c, kind.length);
    if (kind === "h") { dashH(p, 7, c.lineY, 2); }
    else if (kind === "v") { dashV(p, 7, c.lineY, 2); }
    else if (kind === "dh") { p.r(0, 6, 16, 1, c.lineY); p.r(0, 9, 16, 1, c.lineY); }
    else if (kind === "dv") { p.r(6, 0, 1, 16, c.lineY); p.r(9, 0, 1, 16, c.lineY); }
    else if (kind === "en") { p.r(0, 2, 16, 1, c.lineW, 0.9); } else if (kind === "es") { p.r(0, 13, 16, 1, c.lineW, 0.9); }
    else if (kind === "ew") { p.r(2, 0, 1, 16, c.lineW, 0.9); } else if (kind === "ee") { p.r(13, 0, 1, 16, c.lineW, 0.9); }
    else if (kind === "stop-h") { p.r(11, 0, 2, 16, c.lineW, 0.9); } else if (kind === "stop-v") { p.r(0, 11, 16, 2, c.lineW, 0.9); }
  }
  function tFreeway(p, c, kind) {
    var i;
    p.r(0, 0, 16, 16, c.asphD);
    speck(p, 0, 0, 16, 16, c.asph, 16, 190); speck(p, 0, 0, 16, 16, c.asphL, 6, 191);
    if (kind === "h") { dashH(p, 5, c.lineW); dashH(p, 10, c.lineW); }
    else if (kind === "v") { dashV(p, 5, c.lineW); dashV(p, 10, c.lineW); }
    else if (kind === "en") { p.r(0, 3, 16, 1, c.lineW); p.r(0, 0, 16, 3, c.asph, 0.6); } else if (kind === "es") { p.r(0, 12, 16, 1, c.lineW); p.r(0, 13, 16, 3, c.asph, 0.6); }
    else if (kind === "ew") { p.r(3, 0, 1, 16, c.lineW); p.r(0, 0, 3, 16, c.asph, 0.6); } else if (kind === "ee") { p.r(12, 0, 1, 16, c.lineW); p.r(13, 0, 3, 16, c.asph, 0.6); }
    else if (kind === "mh") { p.r(0, 5, 16, 6, c.curb); p.r(0, 5, 16, 1, c.curbL); p.r(0, 10, 16, 1, c.slate); p.r(0, 4, 16, 1, c.lineY); p.r(0, 11, 16, 1, c.lineY); for (i = 0; i < 16; i += 8) { p.r(i, 5, 1, 6, c.slate, 0.5); } }
    else if (kind === "mv") { p.r(5, 0, 6, 16, c.curb); p.r(5, 0, 1, 16, c.curbL); p.r(10, 0, 1, 16, c.slate); p.r(4, 0, 1, 16, c.lineY); p.r(11, 0, 1, 16, c.lineY); for (i = 0; i < 16; i += 8) { p.r(5, i, 6, 1, c.slate, 0.5); } }
  }
  function tSidewalk(p, c, sides) {
    var i;
    p.r(0, 0, 16, 16, c.side);
    p.r(0, 7, 16, 1, c.sideD); p.r(0, 15, 16, 1, c.sideD);
    p.r(7, 0, 1, 7, c.sideD); p.r(3, 8, 1, 7, c.sideD); p.r(11, 8, 1, 7, c.sideD);
    p.r(0, 0, 16, 1, c.sideL, 0.5); p.r(0, 8, 16, 1, c.sideL, 0.5);
    speck(p, 0, 0, 16, 16, c.sideL, 8, 200); speck(p, 0, 0, 16, 16, c.sideD, 5, 201);
    for (i = 0; i < sides.length; i++) {
      var s = sides.charAt(i);
      if (s === "n") { p.r(0, 0, 16, 3, c.curb); p.r(0, 2, 16, 1, c.curbL); p.r(0, 3, 16, 1, "#000000", 0.14); }
      if (s === "s") { p.r(0, 13, 16, 3, c.curb); p.r(0, 13, 16, 1, c.curbL); p.r(0, 12, 16, 1, "#000000", 0.14); }
      if (s === "w") { p.r(0, 0, 3, 16, c.curb); p.r(2, 0, 1, 16, c.curbL); p.r(3, 0, 1, 16, "#000000", 0.14); }
      if (s === "e") { p.r(13, 0, 3, 16, c.curb); p.r(13, 0, 1, 16, c.curbL); p.r(12, 0, 1, 16, "#000000", 0.14); }
    }
  }
  function tCrosswalk(p, c, horiz) {
    var i; asphalt(p, c, 7);
    if (horiz) { for (i = 1; i < 16; i += 4) { p.r(1, i, 14, 2, c.lineW, 0.95); } }
    else { for (i = 1; i < 16; i += 4) { p.r(i, 1, 2, 14, c.lineW, 0.95); } }
  }
  function tPlaza(p, c, v) {
    var x, y;
    p.r(0, 0, 16, 16, c.plaza);
    if (v === 0) {
      for (y = 0; y < 16; y += 4) { p.r(0, y + 3, 16, 1, c.plazaD); for (x = (y / 4 % 2) * 4; x < 16; x += 8) { p.r(x, y, 1, 4, c.plazaD); } }
      speck(p, 0, 0, 16, 16, c.plazaL, 10, 210);
    } else {
      p.r(0, 0, 8, 8, c.plazaL); p.r(8, 8, 8, 8, c.plazaL);
      p.r(0, 7, 16, 1, c.plazaD); p.r(7, 0, 1, 16, c.plazaD); p.r(0, 15, 16, 1, c.plazaD); p.r(15, 0, 1, 16, c.plazaD);
      p.px(3, 3, c.terra, 0.8); p.px(11, 11, c.terra, 0.8); p.px(11, 3, c.jade, 0.7); p.px(3, 11, c.jade, 0.7);
    }
  }
  function tPier(p, c, horiz, v) {
    var i;
    p.r(0, 0, 16, 16, c.pier);
    for (i = 0; i < 16; i += 4) {
      if (horiz) { p.r(0, i + 3, 16, 1, c.pierD); p.r(0, i, 16, 1, c.pierL, 0.45); p.px((i * 3 + v * 5) % 14 + 1, i + 3, c.pier); p.px(2, i + 1, c.pierD, 0.6); p.px(13, i + 1, c.pierD, 0.6); }
      else { p.r(i + 3, 0, 1, 16, c.pierD); p.r(i, 0, 1, 16, c.pierL, 0.45); p.px(i + 1, 2, c.pierD, 0.6); p.px(i + 1, 13, c.pierD, 0.6); }
    }
  }
  function tGround(p, c, base, dark, seed, kind) {
    p.r(0, 0, 16, 16, base);
    speck(p, 0, 0, 16, 16, dark, 14, seed); speck(p, 0, 0, 16, 16, c.sideL, 6, seed + 1, 0.6);
    p.r(2, 8, 5, 1, dark, 0.45); p.r(6, 9, 1, 3, dark, 0.35);
    if (kind === "la") { p.px(11, 4, c.terra, 0.55); p.px(4, 13, c.sandD); }
    if (kind === "oc") { p.px(10, 5, c.grassD, 0.8); p.px(11, 5, c.grassL, 0.8); p.px(3, 12, c.grassD, 0.8); }
    if (kind === "sd") { p.px(12, 10, c.gold, 0.5); p.px(5, 4, c.sandL); }
  }

  var ANIM_TILES = {};
  var TILE_DRAW = {};
  (function () {
    var k, i;
    TILE_DRAW["ocean"] = function (p, c, f) { tOcean(p, c, f, 0, false); };
    TILE_DRAW["ocean-2"] = function (p, c, f) { tOcean(p, c, f, 1, false); };
    TILE_DRAW["ocean-3"] = function (p, c, f) { tOcean(p, c, f, 2, false); };
    TILE_DRAW["ocean-deep"] = function (p, c, f) { tOcean(p, c, f, 3, true); };
    TILE_DRAW["ocean-deep-2"] = function (p, c, f) { tOcean(p, c, f, 4, true); };
    TILE_DRAW["harbour"] = function (p, c, f) { tHarbour(p, c, f, 0); };
    TILE_DRAW["harbour-2"] = function (p, c, f) { tHarbour(p, c, f, 1); };
    for (k in SHORE) { if (SHORE.hasOwnProperty(k)) { (function (key) { TILE_DRAW[key] = function (p, c, f) { shore(p, c, f, SHORE[key][0], SHORE[key][1]); }; ANIM_TILES[key] = 1; })(k); } }
    ANIM_TILES["ocean"] = ANIM_TILES["ocean-2"] = ANIM_TILES["ocean-3"] = ANIM_TILES["ocean-deep"] = ANIM_TILES["ocean-deep-2"] = ANIM_TILES["harbour"] = ANIM_TILES["harbour-2"] = 1;
    TILE_DRAW["sand"] = function (p, c) { tSand(p, c, 0); }; TILE_DRAW["sand-2"] = function (p, c) { tSand(p, c, 1); }; TILE_DRAW["sand-3"] = function (p, c) { tSand(p, c, 2); };
    TILE_DRAW["wet-sand"] = function (p, c) { tWetSand(p, c, 0); }; TILE_DRAW["wet-sand-2"] = function (p, c) { tWetSand(p, c, 1); };
    TILE_DRAW["grass-a"] = function (p, c) { tGrass(p, c, 0); }; TILE_DRAW["grass-b"] = function (p, c) { tGrass(p, c, 1); };
    TILE_DRAW["park"] = function (p, c) { tPark(p, c, 0); }; TILE_DRAW["park-flowers"] = function (p, c) { tPark(p, c, 1); };
    TILE_DRAW["park-path"] = tGravel;
    TILE_DRAW["dirt"] = function (p, c) { tDirt(p, c, 0); }; TILE_DRAW["dirt-2"] = function (p, c) { tDirt(p, c, 1); };
    for (i = 1; i <= 5; i++) { (function (n) { TILE_DRAW["hill-" + n] = function (p, c) { tHill(p, c, n); }; })(i); }
    TILE_DRAW["road"] = function (p, c) { tRoad(p, c, ""); };
    TILE_DRAW["road-h"] = function (p, c) { tRoad(p, c, "h"); }; TILE_DRAW["road-v"] = function (p, c) { tRoad(p, c, "v"); };
    TILE_DRAW["road-dbl-h"] = function (p, c) { tRoad(p, c, "dh"); }; TILE_DRAW["road-dbl-v"] = function (p, c) { tRoad(p, c, "dv"); };
    TILE_DRAW["road-edge-n"] = function (p, c) { tRoad(p, c, "en"); }; TILE_DRAW["road-edge-s"] = function (p, c) { tRoad(p, c, "es"); };
    TILE_DRAW["road-edge-w"] = function (p, c) { tRoad(p, c, "ew"); }; TILE_DRAW["road-edge-e"] = function (p, c) { tRoad(p, c, "ee"); };
    TILE_DRAW["road-stop-h"] = function (p, c) { tRoad(p, c, "stop-h"); }; TILE_DRAW["road-stop-v"] = function (p, c) { tRoad(p, c, "stop-v"); };
    TILE_DRAW["freeway-h"] = function (p, c) { tFreeway(p, c, "h"); }; TILE_DRAW["freeway-v"] = function (p, c) { tFreeway(p, c, "v"); };
    TILE_DRAW["freeway-edge-n"] = function (p, c) { tFreeway(p, c, "en"); }; TILE_DRAW["freeway-edge-s"] = function (p, c) { tFreeway(p, c, "es"); };
    TILE_DRAW["freeway-edge-w"] = function (p, c) { tFreeway(p, c, "ew"); }; TILE_DRAW["freeway-edge-e"] = function (p, c) { tFreeway(p, c, "ee"); };
    TILE_DRAW["freeway-median-h"] = function (p, c) { tFreeway(p, c, "mh"); }; TILE_DRAW["freeway-median-v"] = function (p, c) { tFreeway(p, c, "mv"); };
    TILE_DRAW["sidewalk"] = function (p, c) { tSidewalk(p, c, ""); };
    TILE_DRAW["sidewalk-curb-n"] = function (p, c) { tSidewalk(p, c, "n"); }; TILE_DRAW["sidewalk-curb-s"] = function (p, c) { tSidewalk(p, c, "s"); };
    TILE_DRAW["sidewalk-curb-w"] = function (p, c) { tSidewalk(p, c, "w"); }; TILE_DRAW["sidewalk-curb-e"] = function (p, c) { tSidewalk(p, c, "e"); };
    TILE_DRAW["curb-corner-nw"] = function (p, c) { tSidewalk(p, c, "nw"); }; TILE_DRAW["curb-corner-ne"] = function (p, c) { tSidewalk(p, c, "ne"); };
    TILE_DRAW["curb-corner-sw"] = function (p, c) { tSidewalk(p, c, "sw"); }; TILE_DRAW["curb-corner-se"] = function (p, c) { tSidewalk(p, c, "se"); };
    TILE_DRAW["crosswalk-h"] = function (p, c) { tCrosswalk(p, c, true); }; TILE_DRAW["crosswalk-v"] = function (p, c) { tCrosswalk(p, c, false); };
    TILE_DRAW["plaza"] = function (p, c) { tPlaza(p, c, 0); }; TILE_DRAW["plaza-b"] = function (p, c) { tPlaza(p, c, 1); };
    TILE_DRAW["pier"] = function (p, c) { tPier(p, c, true, 0); }; TILE_DRAW["pier-2"] = function (p, c) { tPier(p, c, true, 1); }; TILE_DRAW["pier-v"] = function (p, c) { tPier(p, c, false, 0); };
    TILE_DRAW["ground-la"] = function (p, c) { tGround(p, c, c.gLA, c.gLAD, 220, "la"); };
    TILE_DRAW["ground-oc"] = function (p, c) { tGround(p, c, c.gOC, c.gOCD, 230, "oc"); };
    TILE_DRAW["ground-sd"] = function (p, c) { tGround(p, c, c.gSD, c.gSDD, 240, "sd"); };
    /* interior floors (outdoor-neutral names the interiors use) */
    TILE_DRAW["floor-tile"] = function (p, c) { p.r(0, 0, 16, 16, c.cream); p.r(0, 0, 8, 8, c.stuccoD, 0.55); p.r(8, 8, 8, 8, c.stuccoD, 0.55); p.r(0, 15, 16, 1, c.stuccoD); p.r(15, 0, 1, 16, c.stuccoD); };
    TILE_DRAW["floor-green"] = function (p, c) { p.r(0, 0, 16, 16, c.jade); p.r(0, 0, 8, 8, c.djade, 0.5); p.r(8, 8, 8, 8, c.djade, 0.5); p.r(0, 15, 16, 1, c.djade); p.r(15, 0, 1, 16, c.djade); p.px(3, 3, c.cream, 0.5); p.px(11, 11, c.cream, 0.5); };
    TILE_DRAW["floor-brick"] = function (p, c) { var y, x; p.r(0, 0, 16, 16, c.brick); for (y = 0; y < 16; y += 4) { p.r(0, y + 3, 16, 1, c.brickD); for (x = (y / 4 % 2) * 4; x < 16; x += 8) { p.r(x, y, 1, 4, c.brickD); } } speck(p, 0, 0, 16, 16, c.brickL, 8, 250); };
    TILE_DRAW["floor-club"] = function (p, c) { p.r(0, 0, 16, 16, c.ink); p.r(0, 0, 16, 1, c.steel, 0.5); p.r(0, 0, 1, 16, c.steel, 0.5); p.r(8, 0, 1, 16, c.graphite); p.r(0, 8, 16, 1, c.graphite); p.px(4, 4, c.red, 0.5); p.px(12, 12, c.gold, 0.5); p.px(12, 4, c.jade, 0.4); };
    TILE_DRAW["floor-dark"] = function (p, c) { var y; p.r(0, 0, 16, 16, c.dwood); for (y = 0; y < 16; y += 4) { p.r(0, y + 3, 16, 1, c.ol, 0.8); p.r(0, y, 16, 1, c.wood, 0.35); } speck(p, 0, 0, 16, 16, c.ol, 8, 260, 0.6); };
    TILE_DRAW["floor-pale"] = function (p, c) { var y; p.r(0, 0, 16, 16, c.lime); for (y = 0; y < 16; y += 8) { p.r(0, y + 7, 16, 1, c.limeD); p.r(((y / 8) * 7 + 3) % 16, y, 1, 7, c.limeD); } speck(p, 0, 0, 16, 16, c.limeL, 8, 270); };
    TILE_DRAW["floor-hall"] = function (p, c) { p.r(0, 0, 16, 16, c.side); p.r(0, 7, 16, 1, c.sideD); p.r(7, 0, 1, 16, c.sideD); p.r(0, 15, 16, 1, c.sideD); p.r(15, 0, 1, 16, c.sideD); speck(p, 0, 0, 16, 16, c.sideL, 8, 280); };
    TILE_DRAW["floor-office"] = function (p, c) { p.r(0, 0, 16, 16, c.slate); p.r(0, 0, 16, 16, c.steel, 0.25); speck(p, 0, 0, 16, 16, c.steel, 24, 290); speck(p, 0, 0, 16, 16, c.slate, 10, 291); p.r(0, 15, 16, 1, c.steel, 0.4); p.r(15, 0, 1, 16, c.steel, 0.4); };
    TILE_DRAW["mat-k13"] = function (p, c) { var i; p.r(0, 0, 16, 16, c.orange); for (i = 0; i < 16; i += 2) { p.r(0, i, 16, 1, c.dorange, 0.5); } p.r(3, 4, 10, 8, c.graphite, 0.0); p.txt("13", 4, 5, c.cream, 2, 0); };
    TILE_DRAW["wall-plain"] = function (p, c) { p.r(0, 0, 16, 16, c.stucco); p.r(0, 0, 16, 2, "#000000", 0.14); speck(p, 0, 2, 16, 14, c.stuccoD, 8, 300, 0.8); p.r(0, 10, 16, 1, "#000000", 0.12); p.r(0, 11, 16, 1, c.lwood); p.r(0, 12, 16, 3, c.wood); p.r(0, 15, 16, 1, c.dwood); };
    TILE_DRAW["wall-plain-up"] = function (p, c) { p.r(0, 0, 16, 16, c.stucco); p.r(0, 0, 16, 2, "#000000", 0.14); speck(p, 0, 2, 16, 14, c.stuccoD, 8, 301, 0.8); };
    TILE_DRAW["wall-green"] = function (p, c) { p.r(0, 0, 16, 16, c.green); p.r(0, 0, 16, 2, "#000000", 0.16); p.r(0, 3, 1, 13, c.greenD, 0.8); p.r(8, 3, 1, 13, c.greenD, 0.8); p.r(0, 10, 16, 1, "#000000", 0.14); p.r(0, 11, 16, 1, c.cream); p.r(0, 12, 16, 3, c.stucco); p.r(0, 15, 16, 1, c.stuccoD); };
    TILE_DRAW["wall-green-up"] = function (p, c) { p.r(0, 0, 16, 16, c.green); p.r(0, 0, 16, 2, "#000000", 0.16); p.r(0, 3, 1, 13, c.greenD, 0.8); p.r(8, 3, 1, 13, c.greenD, 0.8); };
    TILE_DRAW["wall-lime"] = function (p, c) { p.r(0, 0, 16, 16, c.lime); p.r(0, 0, 16, 2, "#000000", 0.1); speck(p, 0, 2, 16, 14, c.limeD, 14, 310, 0.9); speck(p, 0, 2, 16, 14, c.limeL, 8, 311); p.r(0, 10, 16, 1, "#000000", 0.1); p.r(0, 11, 16, 4, c.limeD); p.r(0, 15, 16, 1, c.slate); };
    TILE_DRAW["wall-lime-up"] = function (p, c) { p.r(0, 0, 16, 16, c.lime); p.r(0, 0, 16, 2, "#000000", 0.1); speck(p, 0, 2, 16, 14, c.limeD, 14, 312, 0.9); speck(p, 0, 2, 16, 14, c.limeL, 8, 313); };
    TILE_DRAW["wall-brick"] = function (p, c) { var y, x; p.r(0, 0, 16, 16, c.brick); for (y = 0; y < 16; y += 4) { p.r(0, y + 3, 16, 1, c.brickD, 0.8); for (x = (y / 4 % 2) * 4; x < 16; x += 8) { p.r(x, y, 1, 4, c.brickD, 0.8); } } p.r(0, 0, 16, 2, "#000000", 0.16); p.r(0, 11, 16, 1, "#000000", 0.14); p.r(0, 12, 16, 3, c.dwood); p.r(0, 15, 16, 1, c.ol); };
    TILE_DRAW["wall-brick-up"] = function (p, c) { var y, x; p.r(0, 0, 16, 16, c.brick); for (y = 0; y < 16; y += 4) { p.r(0, y + 3, 16, 1, c.brickD, 0.8); for (x = (y / 4 % 2) * 4; x < 16; x += 8) { p.r(x, y, 1, 4, c.brickD, 0.8); } } p.r(0, 0, 16, 2, "#000000", 0.16); };
    TILE_DRAW["wall-black"] = function (p, c) { p.r(0, 0, 16, 16, c.ink); p.r(0, 0, 16, 2, "#000000", 0.25); p.r(0, 5, 16, 1, c.steel, 0.4); p.r(0, 10, 16, 1, "#000000", 0.2); p.r(0, 11, 16, 1, c.steel); p.r(0, 12, 16, 3, c.graphite); p.r(0, 15, 16, 1, c.dark); };
    TILE_DRAW["wall-black-up"] = function (p, c) { p.r(0, 0, 16, 16, c.ink); p.r(0, 0, 16, 2, "#000000", 0.25); p.r(0, 5, 16, 1, c.steel, 0.4); };
    TILE_DRAW["wall-cap"] = function (p, c) { p.r(0, 0, 16, 16, "#4A3023"); p.r(0, 0, 16, 2, "#6B4A36"); p.r(0, 14, 16, 2, "#33201A"); p.r(0, 7, 16, 1, "#3C281D", 0.6); p.px(3, 4, "#6B4A36"); p.px(11, 10, "#6B4A36"); };
  })();


  /* =====================================================================================
     ROAD KIT: streets (road-<mask>), freeways (fwy-*), the coast road (pch-*), ramps, overpasses
     Masks are 4-bit connections: N=1 E=2 S=4 W=8.
     Evaluators return a colour for source pixel (x,y) or null (transparent), so every piece can be mirrored.
     ===================================================================================== */
  function clampPx(v) { return v < 0 ? 0 : (v > 15 ? 15 : v); }
  function polyDist(px, py, pts) {
    var best = null, i, ax, ay, bx, by, vx, vy, L2, len, t, tc, qx, qy, d, sg, acc = 0;
    for (i = 0; i < pts.length - 1; i++) {
      ax = pts[i][0]; ay = pts[i][1]; bx = pts[i + 1][0]; by = pts[i + 1][1]; vx = bx - ax; vy = by - ay; L2 = vx * vx + vy * vy; len = Math.sqrt(L2);
      t = L2 > 0 ? ((px - ax) * vx + (py - ay) * vy) / L2 : 0; tc = t < 0 ? 0 : (t > 1 ? 1 : t);
      qx = ax + vx * tc; qy = ay + vy * tc; d = Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy));
      sg = (vx * (py - ay) - vy * (px - ax)) >= 0 ? 1 : -1;
      if (!best || d < best.d) { best = { d: d, s: d * sg, along: acc + tc * len }; }
      acc += len;
    }
    return best;
  }
  function bandFn(pts, W, pad, xsec) {
    return function (x, y, c) {
      var r = polyDist(x + 0.5, y + 0.5, pts), i = Math.floor(r.s + W / 2);
      if (i < -pad || i >= W + pad) { return null; }
      return xsec(i, r.along, c, x, y);
    };
  }
  function arcPts(cx, cy, a0, a1) {
    var pts = [], k;
    for (k = 0; k <= 10; k++) { pts.push([cx + 8 * Math.cos(a0 + (a1 - a0) * k / 10), cy + 8 * Math.sin(a0 + (a1 - a0) * k / 10)]); }
    return pts;
  }
  function dashOn(a) { return ((a % 8) + 8) % 8 < 5; }
  function laneCol(c, x, y) { return hash(x, y, 91) > 0.93 ? c.asphD : c.asph; }
  function fwyX(i, a, c, x, y) {
    if (i === 0 || i === 15) { return c.asphL; }
    if (i === 1 || i === 14) { return c.lineW; }
    if (i === 4 || i === 11) { return dashOn(a) ? c.lineW : laneCol(c, x, y); }
    if (i === 7) { return c.curbL; }
    if (i === 8) { return c.curb; }
    return laneCol(c, x, y);
  }
  function pchX(i, a, c, x, y) {
    if (i < 0 || i > 11) { return hash(x, y, 92) > 0.7 ? c.dirt : c.dirtL; }
    if (i === 0 || i === 11) { return c.lineW; }
    if (i === 5 || i === 6) { return c.lineY; }
    return laneCol(c, x, y);
  }
  function rampX(i, a, c, x, y) { return (i === 0 || i === 4) ? c.lineW : laneCol(c, x, y); }
  function ramp6X(i, a, c, x, y) { if (i < 0 || i > 5) { return hash(x, y, 93) > 0.7 ? c.dirt : c.dirtL; } return (i === 0 || i === 5) ? c.lineW : laneCol(c, x, y); }

  var ARMS = { 1: [8, 0], 2: [16, 8], 4: [8, 16], 8: [0, 8] };
  var BENDS = { 3: [16, 0, Math.PI, Math.PI / 2], 6: [16, 16, -Math.PI / 2, -Math.PI], 12: [0, 16, 0, -Math.PI / 2], 9: [0, 0, Math.PI / 2, 0] };
  function bits(m) { return (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1); }
  function kitMask(mask, W, pad, xsec, full) {
    var n = bits(mask), k, fns = [], b, pts, edgeOnly;
    if (mask === 5) { return bandFn([[8, 0], [8, 16]], W, pad, xsec); }
    if (mask === 10) { return bandFn([[0, 8], [16, 8]], W, pad, xsec); }
    if (BENDS[mask]) { b = BENDS[mask]; return bandFn(arcPts(b[0], b[1], b[2], b[3]), W, pad, xsec); }
    if (n <= 1) {
      pts = [[8, 8], [8, 8]]; for (k in ARMS) { if (ARMS.hasOwnProperty(k) && (mask & parseInt(k, 10))) { pts = [[8, 8], ARMS[k]]; } }
      return bandFn(pts, W, pad, xsec);
    }
    /* three and four way: the centre square is all asphalt, the arms carry the markings, missing sides get an edge line */
    for (k in ARMS) { if (ARMS.hasOwnProperty(k) && (mask & parseInt(k, 10))) { fns.push(bandFn([[8, 8], ARMS[k]], W, pad, xsec)); } }
    return function (x, y, c) {
      var i, col = null, d;
      if (full) {
        col = laneCol(c, x, y);
        if (!(mask & 1)) { if (y === 1) { col = c.lineW; } if (y === 0) { col = c.asphL; } }
        if (!(mask & 4)) { if (y === 14) { col = c.lineW; } if (y === 15) { col = c.asphL; } }
        if (!(mask & 8)) { if (x === 1) { col = c.lineW; } if (x === 0) { col = c.asphL; } }
        if (!(mask & 2)) { if (x === 14) { col = c.lineW; } if (x === 15) { col = c.asphL; } }
        return col;
      }
      d = Math.max(Math.abs(x + 0.5 - 8), Math.abs(y + 0.5 - 8));
      if (d <= W / 2) { return laneCol(c, x, y); }
      for (i = 0; i < fns.length; i++) { col = fns[i](x, y, c); if (col) { return col; } }
      return null;
    };
  }
  /* streets: opaque, sidewalk and curb on every unconnected side */
  function streetFn(mask, nox) {
    var N = mask & 1, E = mask & 2, S = mask & 4, Wm = mask & 8, n = bits(mask);
    function road(px, py) {
      px = clampPx(px); py = clampPx(py);
      if (px >= 3 && px <= 12 && py >= 3 && py <= 12) {
        if (!Wm && !S && (px - 3) + (12 - py) < 2) { return false; }
        if (!Wm && !N && (px - 3) + (py - 3) < 2) { return false; }
        if (!E && !N && (12 - px) + (py - 3) < 2) { return false; }
        if (!E && !S && (12 - px) + (12 - py) < 2) { return false; }
        return true;
      }
      if (N && py < 3 && px >= 3 && px <= 12) { return true; }
      if (S && py > 12 && px >= 3 && px <= 12) { return true; }
      if (E && px > 12 && py >= 3 && py <= 12) { return true; }
      if (Wm && px < 3 && py >= 3 && py <= 12) { return true; }
      return false;
    }
    return function (x, y, c) {
      var r = road(x, y), nb = !road(x - 1, y) || !road(x + 1, y) || !road(x, y - 1) || !road(x, y + 1);
      if (r) {
        if (mask === 5 && (x === 7 || x === 8) && dashOn(y)) { return c.lineY; }
        if (mask === 10 && (y === 7 || y === 8) && dashOn(x)) { return c.lineY; }
        if (n >= 3 && !nox) {
          if (N && y <= 2 && x % 2 === 0) { return c.lineW; }
          if (S && y >= 13 && x % 2 === 0) { return c.lineW; }
          if (E && x >= 13 && y % 2 === 0) { return c.lineW; }
          if (Wm && x <= 2 && y % 2 === 0) { return c.lineW; }
        }
        if (nb) { return c.asphD; }
        return laneCol(c, x, y);
      }
      if (nb) { return c.curb; }
      if (y === 7 || y === 15 || (y < 7 && x === 7) || (y > 7 && (x === 3 || x === 11))) { return c.sideD; }
      if (y === 0 || y === 8) { return c.sideL; }
      return hash(x, y, 94) > 0.92 ? c.sideL : c.side;
    };
  }
  /* diagonal body and straight/diagonal transitions. Centre lines run through tile corners and the tile centre. */
  var DIAG = { "ne": [[-32, 48], [48, -32]], "nw": [[-32, -32], [48, 48]] };
  /* flank tiles: a 16 wide diagonal band also covers the four edge neighbours of each body tile (as a corner triangle) */
  var FLANK = { "ne-lr": [16, 0], "ne-ul": [-16, 0], "nw-ur": [16, 0], "nw-ll": [-16, 0] };
  var TRANS = {
    "n-ne": [[8, 16], [8, 8], [16, 0]], "n-nw": [[8, 16], [8, 8], [0, 0]], "s-se": [[8, 0], [8, 8], [16, 16]], "s-sw": [[8, 0], [8, 8], [0, 16]],
    "e-ne": [[0, 8], [8, 8], [16, 0]], "e-se": [[0, 8], [8, 8], [16, 16]], "w-nw": [[16, 8], [8, 8], [0, 0]], "w-sw": [[16, 8], [8, 8], [0, 16]]
  };
  function overFn(ns) {
    return function (x, y, c) {
      var i = ns ? x : y, a = ns ? y : x;
      if (i <= 1 || i >= 14) { return (i === 0 || i === 15) ? c.curbL : c.curb; }
      if (i === 7) { return c.curbL; } if (i === 8) { return c.curb; }
      if (i === 4 || i === 11) { return dashOn(a) ? c.lineW : laneCol(c, x, y); }
      if (a === 0 || a === 15) { return c.asphL; }
      return laneCol(c, x, y);
    };
  }
  function underFn(ns) {
    var base = streetFn(ns ? 5 : 10, true);
    return function (x, y, c) {
      var col = base(x, y, c), a = ns ? y : x, i = ns ? x : y;
      if (i < 2 || i > 13) { return c.slate; }
      if (a < 2 || a > 13) { return i % 5 === 0 ? c.curbL : c.steel; }
      return col;
    };
  }
  function rampFn(flip) {
    var fw = bandFn([[8, 0], [8, 16]], 16, 0, fwyX), rp = bandFn([[15, -1], [14.5, 4], [17.5, 12]], 5, 0, rampX);
    return function (x, y, c) { return rp(x, y, c) || fw(x, y, c); };
  }
  function xf(fn, o) {
    return function (x, y, c) {
      var u = x, v = y, t;
      if (o.tr) { t = u; u = v; v = t; }
      if (o.fx) { u = 15 - u; }
      if (o.fy) { v = 15 - v; }
      return fn(u, v, c);
    };
  }
  function rast(p, c, fn) { var x, y, col; for (y = 0; y < 16; y++) { for (x = 0; x < 16; x++) { col = fn(x, y, c); if (col) { p.px(x, y, col); } } } }
  (function () {
    var m, k, nm;
    for (m = 0; m < 16; m++) {
      (function (mm) {
        TILE_DRAW["road-" + mm] = function (p, c) { rast(p, c, streetFn(mm, false)); };
        if (bits(mm) >= 3) { TILE_DRAW["road-" + mm + "-nx"] = function (p, c) { rast(p, c, streetFn(mm, true)); }; }
        TILE_DRAW["fwy-" + mm] = function (p, c) { rast(p, c, kitMask(mm, 16, 0, fwyX, true)); };
        TILE_DRAW["pch-" + mm] = function (p, c) { rast(p, c, kitMask(mm, 12, 2, pchX, false)); };
      })(m);
    }
    for (k in DIAG) { if (DIAG.hasOwnProperty(k)) { (function (key) {
      TILE_DRAW["fwy-d-" + key] = function (p, c) { rast(p, c, bandFn(DIAG[key], 16, 0, fwyX)); };
      TILE_DRAW["pch-d-" + key] = function (p, c) { rast(p, c, bandFn(DIAG[key], 12, 2, pchX)); };
    })(k); } }
    for (k in FLANK) { if (FLANK.hasOwnProperty(k)) { (function (key) {
      var dg = key.slice(0, 2), ox = FLANK[key][0];
      TILE_DRAW["fwy-d-" + key] = function (p, c) { var f = bandFn(DIAG[dg], 16, 0, fwyX); rast(p, c, function (x, y, cc) { return f(x + ox, y, cc); }); };
      TILE_DRAW["pch-d-" + key] = function (p, c) { var f = bandFn(DIAG[dg], 12, 2, pchX); rast(p, c, function (x, y, cc) { return f(x + ox, y, cc); }); };
    })(k); } }
    for (k in TRANS) { if (TRANS.hasOwnProperty(k)) { (function (key) {
      TILE_DRAW["fwy-t-" + key] = function (p, c) { rast(p, c, bandFn(TRANS[key], 16, 0, fwyX)); };
      TILE_DRAW["pch-t-" + key] = function (p, c) { rast(p, c, bandFn(TRANS[key], 12, 2, pchX)); };
    })(k); } }
    TILE_DRAW["fwy-over-ns"] = function (p, c) { rast(p, c, overFn(true)); };
    TILE_DRAW["fwy-over-ew"] = function (p, c) { rast(p, c, overFn(false)); };
    TILE_DRAW["fwy-under-ns"] = function (p, c) { rast(p, c, underFn(false)); };
    TILE_DRAW["fwy-under-ew"] = function (p, c) { rast(p, c, underFn(true)); };
    var RAMPS = { "ns-e-a": {}, "ns-e-b": { fy: 1 }, "ns-w-a": { fx: 1 }, "ns-w-b": { fx: 1, fy: 1 }, "ew-s-a": { tr: 1 }, "ew-s-b": { tr: 1, fy: 1 }, "ew-n-a": { tr: 1, fx: 1 }, "ew-n-b": { tr: 1, fx: 1, fy: 1 } };
    for (k in RAMPS) { if (RAMPS.hasOwnProperty(k)) { (function (key) { TILE_DRAW["ramp-" + key] = function (p, c) { rast(p, c, xf(rampFn(), RAMPS[key])); }; })(k); } }
    TILE_DRAW["ramp-v"] = function (p, c) { rast(p, c, bandFn([[8, 0], [8, 16]], 6, 1, ramp6X)); };
    TILE_DRAW["ramp-h"] = function (p, c) { rast(p, c, bandFn([[0, 8], [16, 8]], 6, 1, ramp6X)); };
  })();
  var TILE_ALIAS = { "water": "ocean", "sea": "ocean", "shore": "surf-w", "surf": "surf-w", "beach": "sand", "wet": "wet-sand", "grass": "grass-a", "hill": "hill-1", "hills": "hill-1", "asphalt": "road", "street": "road", "freeway": "freeway-h", "highway": "freeway-h", "walk": "sidewalk", "paving": "plaza", "harbor": "harbour", "ground": "ground-sd", "wood-pier": "pier" };
  var tileNames = [];
  (function () { var k; for (k in TILE_DRAW) { if (TILE_DRAW.hasOwnProperty(k)) { tileNames.push(k); } } })();

  function frameOf(t) { return still() ? 0 : (Math.floor((t || 0) * 1.5) % 4 + 4) % 4; }
  function tile(ctx, name, x, y, s, t, light) {
    var n = String(name || "").toLowerCase().replace(/[\s_]+/g, "-"), mode = modeOf(light), f, key, fn, dec;
    if (TILE_ALIAS[n]) { n = TILE_ALIAS[n]; }
    fn = TILE_DRAW[n];
    if (!fn) {
      dec = K.decor;
      if (dec && dec.tile) { dec.tile(ctx, name, x, y, s); return; }
      fn = function (p, c) { p.r(0, 0, 16, 16, c.dark); };
      n = "void";
    }
    f = ANIM_TILES[n] ? frameOf(t) : 0;
    key = "t:" + n + ":" + mode + ":" + f;
    blit(ctx, sprite(key, 16, 16, function (p) { fn(p, pal(mode), f); }), x, y, s);
  }

  /* =====================================================================================
     OUTDOOR OBJECTS
     ===================================================================================== */
  var DEG = Math.PI / 180;
  function frond(p, cx, cy, ang, len, droop, hi, mid, lo, th) {
    var i, x, y, a = ang * DEG, k;
    for (i = 1; i <= len; i++) {
      x = Math.round(cx + Math.cos(a) * i); y = Math.round(cy - Math.sin(a) * i * 0.6 + (i * i / len) * droop * 0.34);
      p.px(x, y - 1, hi);
      for (k = 0; k < th; k++) { p.px(x, y + k, k === th - 1 ? lo : mid); }
      if (i > 2 && i % 3 === 0) { p.px(x, y + th, lo, 0.9); }
    }
  }
  function palmDraw(p, W, H, c, o, sway, cfg) {
    var cx = W >> 1, base = H - 3, top = cfg.top, y, t, x, k, lean, tw = cfg.tw, i, cxc, cyc, L = cfg.L, order;
    p.ell(cx, H - 3, cfg.sh, 2, "#000000", 0.22);
    for (y = base; y >= top; y--) {
      t = (base - y) / (base - top); lean = Math.round(cfg.lean * t * t + sway * t * t);
      x = cx + lean - Math.floor(tw / 2);
      p.r(x, y, tw, 1, c.trunk); p.px(x, y, c.trunkL); p.px(x + tw - 1, y, c.trunkD);
      if (y % 3 === 0) { p.r(x, y, tw, 1, c.trunkD, 0.6); }
    }
    p.r(cx - 3, base - 1, 7, 2, c.trunkD, 0.6);
    cxc = cx + Math.round(cfg.lean + sway); cyc = top;
    order = [[95, 0.3], [70, 0.7], [120, 0.7], [45, 1.1], [145, 1.1], [15, 1.5], [165, 1.5], [-15, 2.0], [195, 2.0], [-40, 2.4], [220, 2.4], [85, 0.4]];
    for (i = 0; i < order.length; i++) {
      k = order[i];
      frond(p, cxc, cyc, k[0] + (sway * 3) * (k[0] > 90 ? -1 : 1) * 0.5, Math.round(L * (0.85 + 0.2 * hash(i, cfg.top, 7))), k[1] * (cfg.droop || 1), c.palmL, i < 3 ? c.palmD : c.palmG, c.palmD, cfg.th || 2);
    }
    p.ell(cxc, cyc + 1, 3, 2, c.palmD); p.px(cxc - 1, cyc + 3, c.trunkD); p.px(cxc + 1, cyc + 3, c.trunkD); p.px(cxc, cyc + 4, c.trunkD);
  }
  var PALMS = {
    "palm-1": { w: 1, h: 2, cfg: { top: 13, tw: 2, lean: 1, L: 8, sh: 4, th: 2 } },
    "palm-2": { w: 1, h: 3, cfg: { top: 17, tw: 2, lean: -1, L: 9, sh: 4, th: 2 } },
    "palm-3": { w: 2, h: 4, cfg: { top: 24, tw: 3, lean: 2, L: 16, sh: 8, droop: 1.0, th: 3 } },
    "palm-4": { w: 1, h: 5, cfg: { top: 18, tw: 2, lean: 1, L: 10, sh: 4, th: 2 } }
  };
  function swayV(t, o, amp) { var ph = hash((o && o.x) || 0, (o && o.y) || 0, 3) * 6; return still() ? 0 : Math.round(Math.sin((t || 0) * 1.3 + ph) * amp); }

  function coralDraw(p, W, H, c, o, sway) {
    var i, x, y, bl = [], cx = W >> 1;
    p.ell(cx, H - 3, 9, 2, "#000000", 0.22);
    for (y = H - 4; y > 24; y--) { p.r(cx - 2 - (y > H - 9 ? 1 : 0), y, 5 + (y > H - 9 ? 2 : 0), 1, c.trunkD); p.px(cx - 1, y, c.trunk); if (y % 4 === 0) { p.px(cx + 1, y, c.trunkL); } }
    p.r(cx - 6, 29, 5, 1, c.trunkD); p.r(cx + 2, 28, 5, 1, c.trunkD);
    p.ell(cx + sway, 15, 13, 10, c.dplant); p.ell(8 + sway, 22, 7, 6, c.dplant); p.ell(24 + sway, 21, 7, 6, c.dplant);
    p.ell(cx + sway - 1, 13, 11, 8, c.plant); p.ell(9 + sway, 20, 5, 4, c.plant); p.ell(23 + sway, 19, 5, 4, c.plant);
    speck(p, 4 + sway, 4, 24, 22, c.dplant, 16, 320, 0.9);
    for (i = 0; i < 38; i++) {
      x = 4 + Math.floor(hash(i, 1, 321) * 24); y = 3 + Math.floor(hash(i, 2, 322) * 22);
      if (Math.abs(x - 16) * 0.8 + Math.abs(y - 14) * 1.2 > 17) { continue; }
      p.r(x + sway, y, 2, 2, c.coral); p.px(x + sway, y - 1, c.coralL); p.px(x + sway + 1, y - 1, c.coral); p.px(x + sway, y, c.coralL);
    }
    for (i = 0; i < 12; i++) { p.px(8 + Math.floor(hash(i, 4, 323) * 18) + sway, 22 + Math.floor(hash(i, 5, 323) * 7), c.coral, 0.9); }
  }
  function eucDraw(p, W, H, c, o, sway) {
    var cx = W >> 1, y, i, x, ln, j, cl;
    p.ell(cx, H - 3, 7, 2, "#000000", 0.22);
    for (y = H - 4; y > 20; y--) { x = cx + Math.round((H - y) * 0.03) - 1; p.r(x, y, 3, 1, c.eucT); p.px(x + 2, y, c.trunkL); if (hash(y, 2, 330) > 0.7) { p.px(x + 1, y, c.trunk); } }
    p.r(cx - 3, H - 5, 8, 2, c.eucT, 0.8);
    cl = [[16, 14], [9, 20], [23, 19], [13, 26], [20, 27], [16, 8], [6, 12], [26, 12], [16, 21]];
    for (i = 0; i < cl.length; i++) {
      p.ell(cl[i][0] + (cl[i][1] < 18 ? sway : Math.round(sway * 0.6)), cl[i][1] + 1, 6, 3, c.eucD, 0.55);
      for (j = 0; j < 14; j++) {
        x = cl[i][0] + Math.round((hash(i, j, 331) - 0.5) * 13) + (cl[i][1] < 18 ? sway : Math.round(sway * 0.6));
        ln = 5 + Math.floor(hash(i, j, 332) * 7);
        p.r(x, cl[i][1] - 2 + Math.floor(hash(i, j, 333) * 3), 1, ln, (j % 5 === 0) ? c.eucL : ((j % 5 < 3) ? c.euc : c.eucD));
      }
    }
  }
  function bushDraw(p, W, H, c) {
    p.ell(8, 13, 7, 2, "#000000", 0.2); p.ell(8, 9, 7, 5, c.dplant); p.ell(7, 8, 5, 4, c.plant); p.px(5, 6, c.palmL); p.px(9, 7, c.palmL); speck(p, 2, 4, 12, 8, c.dplant, 6, 340);
  }
  function agaveDraw(p, W, H, c) {
    var i, a, k;
    p.ell(8, 13, 6, 2, "#000000", 0.2);
    for (i = 0; i < 9; i++) { a = (-20 + i * 25) * DEG; for (k = 2; k < 7; k++) { p.px(Math.round(8 + Math.cos(a) * k), Math.round(11 - Math.sin(a) * k * 0.9), i % 2 ? c.euc : c.eucD); } p.px(Math.round(8 + Math.cos(a) * 7), Math.round(11 - Math.sin(a) * 6.3), c.eucL); }
    p.ell(8, 10, 1, 1, c.eucL);
  }
  function flowerbedDraw(p, W, H, c) {
    var i, cols = [c.fo, c.fy, c.fr, c.fw, c.fpk];
    p.r(1, 6, 14, 8, c.dirtD); p.r(1, 6, 14, 1, c.dirt); p.ol(1, 6, 14, 8, c.ol);
    for (i = 0; i < 9; i++) { p.px(2 + Math.floor(hash(i, 1, 350) * 12), 7 + Math.floor(hash(i, 2, 350) * 5), c.plant); p.px(2 + Math.floor(hash(i, 3, 350) * 12), 7 + Math.floor(hash(i, 4, 350) * 5), cols[i % 5]); }
  }
  function rockDraw(p, W, H, c) { p.ell(8, 13, 6, 2, "#000000", 0.2); p.ell(8, 10, 6, 4, c.rock); p.ell(7, 9, 4, 2, c.rockL); p.r(5, 13, 7, 1, c.rockD); tuft(p, 12, 7, c.grassD, c.grassL); }

  function lampDraw(p, W, H, c, o, v, mode) {
    var on = lampsOn(mode);
    p.ell(8, H - 3, 5, 2, "#000000", 0.22);
    p.r(6, H - 6, 4, 3, c.steel); p.r(7, 8, 2, H - 14, c.graphite); p.px(7, 8, c.slate); p.r(6, 20, 4, 1, c.steel);
    p.r(4, 4, 8, 4, c.graphite); p.r(5, 3, 6, 1, c.steel); p.r(5, 7, 6, 2, on ? LIT.cream : c.glass); p.r(6, 7, 4, 1, on ? LIT.white : c.white, 0.8);
    p.r(11, 8, 3, 1, c.graphite); p.px(13, 9, c.graphite);
  }
  function parkBenchDraw(p, W, H, c) {
    var i;
    p.r(2, 14, W - 4, 2, "#000000", 0.2);
    p.r(2, 3, W - 4, 4, c.dwood); p.r(3, 4, W - 6, 1, c.lwood); p.r(3, 6, W - 6, 1, c.wood);
    p.r(2, 8, W - 4, 4, c.wood); p.r(2, 8, W - 4, 1, c.lwood); p.r(2, 11, W - 4, 1, c.dwood);
    p.r(3, 12, 2, 3, c.graphite); p.r(W - 5, 12, 2, 3, c.graphite);
    for (i = 8; i < W - 4; i += 8) { p.px(i, 9, c.dwood, 0.6); }
  }
  function busStopDraw(p, W, H, c, o, v, mode) {
    var on = lampsOn(mode);
    p.r(1, 28, W - 2, 3, "#000000", 0.2);
    p.r(1, 8, 22, 3, c.graphite); p.r(0, 6, 24, 3, c.orange); p.r(0, 6, 24, 1, LIT.orange, 0.6); p.r(0, 9, 24, 1, c.dorange);
    p.r(2, 11, 2, 17, c.steel); p.r(20, 11, 2, 17, c.steel); p.r(4, 11, 16, 14, c.glass, on ? 0.18 : 0.3); p.r(4, 11, 1, 14, c.white, 0.25);
    p.r(5, 21, 14, 2, c.wood); p.r(5, 20, 14, 1, c.lwood); p.r(6, 23, 2, 5, c.graphite); p.r(16, 23, 2, 5, c.graphite);
    p.r(27, 4, 2, 24, c.graphite); p.r(26, 27, 4, 2, c.steel);
    p.r(23, 3, 10, 15, c.orange); p.ol(23, 3, 10, 15, c.dorange); p.txt("VAN", 24, 5, c.cream, 1, 0);
    p.r(24, 11, 8, 4, c.cream); p.r(24, 10, 6, 1, c.cream); p.r(29, 10, 2, 1, c.glass); p.px(25, 15, c.graphite); p.px(30, 15, c.graphite); p.txt("13", 24, 11, c.orange, 1, 0);
  }

  /* vehicles. dir: down up left right. kind: van or car */
  function vehicle(p, W, H, c, dir, body, kind, mode) {
    var van = kind === "van", on = lampsOn(mode), dk = mix(body, "#000000", 0.28), lt = mix(body, "#FFFFFF", 0.3), L = dir === "left", x, y, X;
    if (dir === "down" || dir === "up") {
      var top = van ? 3 : 8, bot = 29, w = van ? 14 : 12, x0 = (16 - w) >> 1, roofH = van ? 12 : 6, front = dir === "down";
      p.ell(8, 29, w / 2 + 1, 2, "#000000", 0.25);
      p.r(x0 - 1, bot - 7, 2, 6, c.graphite); p.r(x0 + w - 1, bot - 7, 2, 6, c.graphite);
      p.r(x0, top, w, bot - top, body); p.r(x0, top, w, 1, lt); p.r(x0, top, 1, bot - top, lt, 0.6); p.r(x0 + w - 1, top + 1, 1, bot - top - 1, dk);
      p.px(x0, top, body, 0); p.r(x0 + 1, top + 1, w - 2, roofH, lt, 0.35);
      if (van) { p.r(x0 + 2, top + 2, w - 4, roofH - 2, body); p.txt("13", x0 + 3, top + 4, c.cream, 1, 1); p.r(x0 + 2, top + roofH, w - 4, 1, dk); }
      else { p.r(x0 + 1, top + 1, w - 2, 1, lt); }
      var gy = top + roofH + 1;
      if (front) {
        p.r(x0 + 1, gy, w - 2, 5, c.glass); p.r(x0 + 1, gy, w - 2, 1, c.white, 0.5); p.r(x0 + 3, gy + 1, 3, 1, c.white, 0.5); p.r(x0 + w / 2 - 1, gy, 1, 5, dk, 0.5);
        p.r(x0 + 1, gy + 6, w - 2, 4, lt, 0.25); p.r(x0 + 2, bot - 5, w - 4, 3, c.slate); p.r(x0 + 3, bot - 4, w - 6, 1, c.steel);
        p.r(x0 + 1, bot - 5, 2, 2, on ? LIT.cream : c.cream); p.r(x0 + w - 3, bot - 5, 2, 2, on ? LIT.cream : c.cream);
        p.r(x0, bot - 1, w, 2, c.graphite); p.r(x0 - 1, gy + 1, 1, 2, dk); p.r(x0 + w, gy + 1, 1, 2, dk);
      } else {
        p.r(x0 + 2, gy, w - 4, 4, c.glass); p.r(x0 + 2, gy, w - 4, 1, c.white, 0.4); p.r(x0 + 1, gy + 5, w - 2, 1, dk);
        if (van) { p.txt("13", x0 + 3, gy + 7, c.cream, 1, 1); }
        p.r(x0 + w / 2, gy + 5, 1, 9, dk, 0.6);
        p.r(x0 + 1, bot - 5, 2, 2, on ? LIT.red : c.red); p.r(x0 + w - 3, bot - 5, 2, 2, on ? LIT.red : c.red); p.r(x0, bot - 1, w, 2, c.graphite);
      }
      return;
    }
    /* side views */
    var bx = 2, bw = 28, by = van ? 2 : 5, bh = van ? 10 : 7;
    function XX(px, pw) { return L ? W - px - pw : px; }
    p.ell(16, 13, 14, 2, "#000000", 0.25, 0.25);
    p.r(XX(bx, bw), by, bw, bh, body); p.r(XX(bx, bw), by, bw, 1, lt);
    p.r(XX(bx, bw), by + bh - 2, bw, 2, dk); p.r(XX(bx + 1, bw - 2), by + bh, bw - 2, 1, dk, 0.8);
    if (!van) { p.r(XX(9, 14), 2, 14, 4, body); p.r(XX(9, 14), 2, 14, 1, lt); p.r(XX(10, 5), 3, 5, 3, c.glass); p.r(XX(16, 6), 3, 6, 3, c.glass); p.r(XX(15, 1), 3, 1, 3, dk); p.r(XX(10, 4), 3, 1, 1, c.white, 0.6); }
    else {
      p.r(XX(20, 8), by + 1, 8, 4, c.glass); p.r(XX(20, 8), by + 1, 8, 1, c.white, 0.5); p.r(XX(19, 1), by + 1, 1, 4, dk);
      p.r(XX(bx, 17), by + 7, 17, 1, c.cream); p.r(XX(bx, 17), by + 8, 17, 1, c.cream, 0.5);
      p.txt("13", L ? 13 : 8, by + 1, c.cream, 1, 1);
    }
    p.r(XX(29, 2), by + 3, 2, 2, on ? LIT.cream : c.cream); p.r(XX(1, 2), by + 3, 2, 2, on ? LIT.red : c.red);
    X = [8, 22];
    for (x = 0; x < 2; x++) { p.ell(XX(X[x] - 2, 5) + 2, by + bh, 3, 3, c.graphite); p.ell(XX(X[x] - 2, 5) + 2, by + bh, 1, 1, c.silver); }
  }
  var CAR_COLORS = { red: "#C8402B", blue: "#2E6FA8", white: "#F3F5FA", yellow: "#E7B93A", green: "#4F9E92", black: "#2E3035", silver: "#B9BEC8", orange: "#F08A3C" };
  var CAR_NAMES = ["red", "blue", "white", "yellow", "green", "black", "silver", "orange"];

  function lifeguardDraw(p, W, H, c, o, v, mode) {
    p.ell(16, H - 3, 12, 2, "#000000", 0.22);
    p.r(6, 28, 3, 17, c.dwood); p.r(23, 28, 3, 17, c.dwood); p.r(6, 38, 20, 1, c.wood); p.r(9, 32, 14, 1, c.wood, 0.7);
    p.r(14, 33, 4, 12, c.lwood); p.r(14, 36, 4, 1, c.dwood); p.r(14, 40, 4, 1, c.dwood);
    p.r(3, 25, 26, 4, c.wood); p.r(3, 25, 26, 1, c.lwood); p.r(3, 28, 26, 1, c.dwood);
    p.r(5, 12, 22, 13, c.white); p.r(5, 12, 22, 1, c.cream); p.r(5, 24, 22, 1, c.stuccoD);
    p.r(8, 15, 16, 7, c.glass); p.r(8, 15, 16, 1, c.white, 0.6); p.r(15, 15, 2, 7, c.white); p.r(11, 17, 3, 1, c.white, 0.5);
    p.r(5, 12, 22, 3, c.red, 0.0); p.r(3, 8, 26, 5, c.red); p.r(3, 8, 26, 1, c.coralL); p.r(3, 12, 26, 1, c.dred);
    p.r(15, 0, 1, 9, c.slate); p.r(16, 1, 6, 4, c.red); p.r(16, 1, 6, 1, c.coralL);
    p.txt("13", 11, 25, c.orange, 1, 1, 0); p.r(10, 25, 12, 1, c.white, 0.0);
  }
  function surfRackDraw(p, W, H, c) {
    var cols = [c.cream, c.orange, c.jade, c.yolk, c.blue], i, x, tp, bd;
    p.ell(8, H - 3, 7, 2, "#000000", 0.22);
    p.r(1, 16, 14, 2, c.dwood); p.r(1, 22, 14, 2, c.dwood); p.r(2, 16, 2, 14, c.wood); p.r(12, 16, 2, 14, c.wood);
    for (i = 0; i < 4; i++) {
      x = 3 + i * 3; tp = 3 + (i % 2) * 3; bd = cols[(i + 1) % 5];
      p.r(x, tp + 1, 2, 24 - tp, bd); p.px(x, tp, bd); p.r(x, tp + 1, 1, 22 - tp, mix(bd, "#FFFFFF", 0.35)); p.r(x, 20, 2, 1, c.graphite, 0.5);
    }
  }
  function surfboardDraw(p, W, H, c, o) {
    var bd = [c.orange, c.jade, c.cream, c.yolk][(((o && o.x) || 0) + ((o && o.y) || 0)) % 4];
    p.ell(8, 13, 4, 1, "#000000", 0.2); p.r(7, 3, 3, 10, bd); p.r(8, 2, 1, 1, bd); p.r(7, 3, 1, 9, mix(bd, "#FFFFFF", 0.4)); p.r(8, 4, 1, 8, c.graphite, 0.25); p.ell(8, 13, 2, 1, c.sandD, 0.9);
  }
  function umbrellaDraw(p, W, H, c) {
    var i;
    p.ell(16, H - 3, 12, 2, "#000000", 0.2);
    p.r(5, 21, 22, 8, c.cream); p.r(5, 21, 22, 1, c.white); for (i = 0; i < 22; i += 6) { p.r(5 + i, 21, 3, 8, c.coral); }
    p.r(15, 8, 2, 18, c.dwood);
    p.ell(16, 8, 14, 7, c.cream);
    for (i = -14; i <= 14; i += 7) { p.r(16 + i - 1, 2, 3, 12, c.coral, 0.0); }
    p.r(2, 8, 28, 2, c.orange); p.r(2, 10, 28, 1, c.dorange); p.r(8, 3, 4, 5, c.orange); p.r(20, 3, 4, 5, c.orange); p.r(14, 1, 4, 6, c.orange); p.px(15, 1, c.white);
    p.r(2, 10, 3, 2, c.cream); p.r(10, 10, 3, 2, c.cream); p.r(19, 10, 3, 2, c.cream); p.r(27, 10, 3, 2, c.cream);
  }

  /* pier, parametric: w >= h runs east-west, otherwise north-south */
  function pierDraw(p, W, H, c, o, v, mode) {
    var horiz = W >= H, i, n = horiz ? W : H, post;
    if (horiz) {
      p.r(0, 3, W, H - 6, c.pier);
      for (i = 0; i < H - 6; i += 4) { p.r(0, 3 + i + 3, W, 1, c.pierD); p.r(0, 3 + i, W, 1, c.pierL, 0.4); }
      for (i = 0; i < W; i += 7) { p.px(i + 2, 4 + (i % 3) * 4, c.pierD, 0.7); }
      p.r(0, 0, W, 3, c.pierD); p.r(0, 0, W, 1, c.pierL); p.r(0, H - 3, W, 3, c.pierD); p.r(0, H - 3, W, 1, c.pierL, 0.8);
      for (i = 2; i < W; i += 16) { p.r(i, 0, 2, 3, c.dwood); p.r(i, H - 3, 2, 3, c.dwood); }
      p.r(0, H - 1, W, 1, c.ol, 0.5);
    } else {
      p.r(3, 0, W - 6, H, c.pier);
      for (i = 0; i < W - 6; i += 4) { p.r(3 + i + 3, 0, 1, H, c.pierD); p.r(3 + i, 0, 1, H, c.pierL, 0.4); }
      p.r(0, 0, 3, H, c.pierD); p.r(0, 0, 1, H, c.pierL); p.r(W - 3, 0, 3, H, c.pierD);
      for (i = 2; i < H; i += 16) { p.r(0, i, 3, 2, c.dwood); p.r(W - 3, i, 3, 2, c.dwood); }
    }
  }
  function pierAnim(p, W, H, c, o, t, mode) {
    var horiz = W >= H, i, s = p.s, ctx = p.ctx, on = lampsOn(mode);
    if (!on) { return; }
    for (i = 24; i < (horiz ? W : H); i += 48) {
      p.r(horiz ? i : 1, horiz ? 1 : i, 2, 2, LIT.cream);
      glowAt(ctx, p.ox + (horiz ? i + 1 : 2) * s, p.oy + (horiz ? 2 : i + 1) * s, 22 * s, LIT.gold, 0.28);
    }
  }

  function lighthouseDraw(p, W, H, c, o, v, mode) {
    var y, hw;
    p.ell(24, H - 4, 20, 3, "#000000", 0.22);
    p.r(2, 70, 18, 22, c.stucco); p.r(2, 70, 18, 2, c.terra); p.r(2, 72, 18, 1, c.terraD); p.r(0, 66, 22, 5, c.terra); p.r(0, 66, 22, 1, c.terraL); p.r(2, 66, 2, 1, c.terra);
    p.r(5, 76, 4, 6, c.glass); p.r(13, 76, 4, 6, c.glass); p.r(2, 91, 18, 1, c.stuccoD);
    p.r(10, 84, 4, 8, c.dwood);
    for (y = 22; y < 92; y++) { hw = 6 + Math.round((y - 22) * 0.07); p.r(33 - hw, y, hw * 2, 1, c.white); p.r(33 - hw, y, 2, 1, c.stucco); p.r(33 + hw - 3, y, 3, 1, c.silver); }
    p.r(26, 50, 2, 4, c.glass, 0.8); p.r(28, 70, 2, 4, c.glass, 0.8); p.r(37, 36, 2, 4, c.glass, 0.8);
    p.r(26, 16, 14, 7, c.graphite); p.r(28, 12, 10, 4, c.graphite); p.r(30, 8, 6, 4, c.steel); p.r(32, 5, 2, 3, c.graphite);
    p.r(28, 17, 10, 5, mode === "night" ? LIT.gold : c.glass); p.r(28, 17, 10, 1, c.white, 0.5);
    p.r(24, 22, 18, 2, c.steel); p.r(24, 23, 18, 1, c.graphite); for (y = 0; y < 18; y += 3) { p.r(24 + y, 20, 1, 3, c.steel); }
  }
  function lighthouseAnim(p, W, H, c, o, t, mode) {
    var s = p.s, ctx = p.ctx, cx = p.ox + 33 * s, cy = p.oy + 19 * s, ang, len = 54 * s, a;
    if (mode !== "night" && mode !== "dusk") { return; }
    ang = still() ? 0.2 : Math.sin((t || 0) * 0.9);
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    a = ctx.createLinearGradient(cx, cy, cx + ang * len * 1.3, cy);
    a.addColorStop(0, "rgba(255,240,190,0.55)"); a.addColorStop(1, "rgba(255,240,190,0)");
    ctx.fillStyle = a; ctx.beginPath(); ctx.moveTo(cx, cy - 3 * s); ctx.lineTo(cx + ang * len * 1.3, cy - 9 * s); ctx.lineTo(cx + ang * len * 1.3, cy + 9 * s); ctx.lineTo(cx, cy + 3 * s); ctx.closePath(); ctx.fill();
    ctx.restore();
    glowAt(ctx, cx, cy, 18 * s, LIT.cream, 0.45);
  }

  function craneDraw(p, W, H, c, o) {
    var i, y, cols = [c.red, c.blue, c.jade, c.cream, c.orange, c.yolk, c.silver];
    p.ell(32, H - 3, 28, 3, "#000000", 0.22);
    for (i = 0; i < 6; i++) { p.r(4 + (i % 3) * 20, H - 12 + Math.floor(i / 3) * -10 + 0, 18, 9, cols[i % 7]); p.r(4 + (i % 3) * 20, H - 12 + Math.floor(i / 3) * -10, 18, 1, mix(cols[i % 7], "#FFFFFF", 0.3)); for (y = 4; y < 18; y += 3) { p.r(4 + (i % 3) * 20 + y, H - 11 + Math.floor(i / 3) * -10, 1, 7, mix(cols[i % 7], "#000000", 0.25)); } }
    p.r(34, 24, 3, 70, c.orange); p.r(54, 24, 3, 70, c.orange); p.r(34, 24, 1, 70, LIT.orange);
    for (y = 30; y < 90; y += 12) { p.r(37, y, 17, 1, c.dorange); for (i = 0; i < 8; i++) { p.px(37 + i * 2, y + i + 1 > y + 11 ? y + 11 : y + i + 1, c.dorange); } }
    p.r(30, 12, 30, 8, c.orange); p.r(30, 12, 30, 1, LIT.orange); p.r(30, 19, 30, 1, c.dorange);
    p.r(0, 14, 66, 4, c.orange); p.r(0, 14, 66, 1, LIT.orange); for (i = 0; i < 64; i += 4) { p.px(i, 18, c.dorange); }
    p.r(30, 4, 2, 10, c.dorange); p.r(58, 4, 2, 10, c.dorange); p.r(30, 4, 30, 1, c.dorange);
    p.r(6, 18, 6, 4, c.graphite); p.r(8, 22, 1, 12, c.graphite); p.r(10, 34, 4, 3, c.steel);
    p.r(40, 20, 8, 5, c.graphite); p.r(41, 21, 6, 2, c.glass);
  }
  function craneAnim(p, W, H, c, o, t, mode) {
    var x = still() ? 8 : Math.round(8 + (Math.sin((t || 0) * 0.4) + 1) * 12);
    p.r(x, 18, 6, 4, c.graphite); p.r(x + 2, 22, 1, 10 + (still() ? 0 : Math.round(Math.sin((t || 0) * 0.8) * 2)), c.graphite); p.r(x, 33 + (still() ? 0 : Math.round(Math.sin((t || 0) * 0.8) * 2)), 5, 3, c.steel);
    if (mode === "night") { p.r(31, 3, 2, 2, LIT.red); p.r(58, 3, 2, 2, LIT.red); }
  }

  function bellDraw(p, W, H, c) {
    var y, i;
    p.ell(16, H - 3, 14, 2, "#000000", 0.22);
    p.r(4, 14, 24, 33, c.stucco); p.r(4, 14, 3, 33, c.white, 0.5); p.r(25, 14, 3, 33, c.stuccoD); p.r(4, 46, 24, 1, c.stuccoD);
    p.r(2, 8, 28, 7, c.terra); p.r(2, 8, 28, 1, c.terraL); p.r(2, 14, 28, 1, c.terraD); for (i = 2; i < 30; i += 4) { p.r(i, 9, 1, 5, c.terraD, 0.8); }
    p.r(13, 3, 6, 6, c.terra); p.r(13, 3, 6, 1, c.terraL); p.r(14, 1, 4, 3, c.terra);
    for (y = 20; y < 40; y++) { var hw = y < 25 ? Math.round(Math.sqrt(Math.max(0, 36 - (25 - y) * (25 - y)))) : 6; p.r(16 - hw, y, hw * 2, 1, c.stuccoD, 0.9); }
    p.r(11, 22, 10, 18, c.dwood, 0.5);
    p.r(15, 20, 2, 5, c.graphite); p.r(12, 25, 8, 2, c.brass); p.ell(16, 31, 4, 5, c.brass); p.r(12, 34, 8, 2, c.brass); p.px(14, 29, "#FFE9A0"); p.px(14, 30, "#FFE9A0"); p.px(16, 38, c.graphite);
    p.r(5, 41, 22, 1, c.stuccoD); p.r(4, 38, 24, 9, c.stucco, 0.0);
    p.txt("1769", 7, 42, c.terraD, 1, 0);
  }

  function letterSignDraw(p, W, H, c, o, v, mode, text, pitch, col) {
    var i, x0 = Math.round((W - (text.length * pitch - 1)) / 2), dy, ch;
    p.ell(W >> 1, H - 2, W / 2 - 2, 2, "#000000", 0.2);
    for (i = 0; i < text.length; i++) {
      ch = text.charAt(i); if (ch === " ") { continue; }
      dy = Math.floor(hash(i, text.length, 360) * 3);
      p.r(x0 + i * pitch + 2, 17 + dy, 2, H - 19 - dy, c.steel);
      p.txt(ch, x0 + i * pitch + 1, 8 + dy + 1, "#000000", 2, 0); p.txt(ch, x0 + i * pitch, 7 + dy, col, 2, 0);
      p.txt(ch, x0 + i * pitch, 8 + dy, col, 2, 0);
    }
  }
  function ocSignDraw(p, W, H, c) {
    var i;
    p.ell(W >> 1, H - 2, W / 2 - 4, 2, "#000000", 0.2);
    p.r(4, 14, 10, 32, c.stucco); p.r(4, 14, 10, 4, c.terra); p.r(W - 14, 14, 10, 32, c.stucco); p.r(W - 14, 14, 10, 4, c.terra);
    p.r(4, 14, 2, 32, c.white, 0.5); p.r(W - 14, 14, 2, 32, c.white, 0.5); p.r(12, 14, 2, 32, c.stuccoD); p.r(W - 6, 14, 2, 32, c.stuccoD);
    p.box(10, 8, W - 20, 30, c.cream, c.white, c.stuccoD); p.ol(10, 8, W - 20, 30, c.dwood);
    fit(p, "WELCOME TO", W >> 1, 13, W - 28, c.dwood, 1);
    fit(p, "ORANGE", W >> 1, 21, W - 28, c.orange, 2);
    fit(p, "COUNTY", W >> 1, 30, W - 28, c.dorange, 1);
    p.ell(18, 33, 3, 3, c.fo); p.ell(17, 32, 1, 1, c.coralL); p.px(19, 29, c.plant); p.px(20, 30, c.plant); p.px(18, 29, c.dplant);
    for (i = 0; i < 4; i++) { p.px(8 + i * 2, 6 - (i % 2), c.plant); }
  }
  function sdSignDraw(p, W, H, c) {
    var i;
    p.ell(W >> 1, H - 2, W / 2 - 4, 2, "#000000", 0.2);
    p.r(6, 12, 3, 34, c.steel); p.r(W - 9, 12, 3, 34, c.steel); p.r(6, 12, 1, 34, c.slate);
    p.box(3, 6, W - 6, 32, c.blue, c.oceanL, c.blueD); p.ol(3, 6, W - 6, 32, c.graphite);
    p.r(4, 28, W - 8, 9, c.ocean2, 0.0); p.r(4, 31, W - 8, 6, c.blueD);
    for (i = 4; i < W - 6; i += 6) { p.r(i, 31, 3, 1, c.oceanL); p.r(i + 3, 34, 3, 1, c.oceanL, 0.7); }
    p.ell(W - 12, 13, 4, 4, c.gold); p.ell(W - 13, 12, 2, 2, "#FFE08A");
    fit(p, "WELCOME TO", (W >> 1) - 3, 9, W - 24, c.cream, 1);
    fit(p, "SAN DIEGO", W >> 1, 18, W - 12, c.white, 2);
    p.r(14, 28, 3, 1, c.sandL); p.ell(W >> 1, 29, 5, 1, c.sandL, 0.0);
  }
  function trolleyDraw(p, W, H, c, o, v, mode) {
    var on = lampsOn(mode), i;
    p.r(0, 27, W, 5, c.curb); p.r(0, 27, W, 1, c.curbL); p.r(2, 29, W - 4, 1, c.slate); p.r(2, 31, W - 4, 1, c.slate);
    for (i = 4; i < W - 3; i += 6) { p.r(i, 29, 2, 3, c.dwood, 0.6); }
    p.r(2, 7, W - 4, 4, c.red); p.r(2, 7, W - 4, 1, c.coralL); p.r(2, 10, W - 4, 1, c.dred);
    p.r(3, 11, 2, 15, c.steel); p.r(W - 5, 11, 2, 15, c.steel);
    p.r(5, 11, W - 10, 11, c.glass, 0.28);
    p.r(8, 19, W - 16, 2, c.wood); p.r(8, 18, W - 16, 1, c.lwood);
    p.r(W - 10, 1, 2, 24, c.graphite); p.r(W - 14, 0, 10, 8, c.white); p.ol(W - 14, 0, 10, 8, c.red);
    p.r(W - 13, 1, 8, 2, c.red); p.r(W - 12, 4, 2, 3, c.red); p.r(W - 9, 4, 2, 3, c.red);
    p.txt("TROLLEY", 3, 12, c.white, 1, 0); p.r(3, 12, 0, 0, c.white);
    if (on) { p.r(5, 11, W - 10, 11, LIT.gold, 0.12); }
  }

  /* the Worldwide pier: planks, flag poles, a signpost of distances */
  var FLAGS = [
    ["US", ["#C8402B", "#FFFFFF", "#C8402B", "#FFFFFF", "#C8402B", "#FFFFFF"], "#2A5C8A"],
    ["BE", null, ["#1F2023", "#F0B429", "#C8402B"]],
    ["TR", "#C8402B", "moon"],
    ["IT", null, ["#4F9E92", "#FFFFFF", "#C8402B"]],
    ["JP", "#FFFFFF", "disc"],
    ["MX", null, ["#3C8A5E", "#FFFFFF", "#C8402B"]],
    ["FR", null, ["#2A5C8A", "#FFFFFF", "#C8402B"]]
  ];
  function flagDraw(p, x, y, fl, t, c) {
    var i, j, wv, w = 10, h = 7, col, k;
    for (i = 0; i < w; i++) {
      wv = still() ? 0 : Math.round(Math.sin((t || 0) * 3 + i * 0.7 + x) * (i > 2 ? 1 : 0));
      for (j = 0; j < h; j++) {
        if (fl[0] === "US") { col = fl[1][Math.floor(j * 6 / h)]; if (i < 4 && j < 4) { col = fl[2]; } }
        else if (fl[1] === null) { col = fl[2][Math.floor(i * 3 / w)]; }
        else { col = fl[1]; }
        p.px(x + i, y + j + wv, col);
        if (j === 0) { p.px(x + i, y + wv - 1, c.ol, 0.35); }
      }
      if (fl[2] === "disc" && i > 3 && i < 7) { p.r(x + i, y + 2 + wv, 1, 3, c.red); }
      if (fl[2] === "moon" && i > 2 && i < 7) { p.r(x + i, y + 2 + wv, 1, 3, c.white); }
    }
    if (fl[2] === "moon") { p.px(x + 4, y + 3, fl[1]); }
  }
  function worldPierDraw(p, W, H, c, o, v, mode) {
    var i, y0 = 26;
    p.r(0, y0 + 3, W, H - y0 - 6, c.pier);
    for (i = 0; i < H - y0 - 6; i += 4) { p.r(0, y0 + 3 + i + 3, W, 1, c.pierD); p.r(0, y0 + 3 + i, W, 1, c.pierL, 0.4); }
    p.r(0, y0, W, 3, c.pierD); p.r(0, y0, W, 1, c.pierL); p.r(0, H - 3, W, 3, c.pierD); p.r(0, H - 3, W, 1, c.pierL, 0.8);
    for (i = 2; i < W; i += 16) { p.r(i, y0, 2, 3, c.dwood); p.r(i, H - 3, 2, 3, c.dwood); }
    for (i = 0; i < 7; i++) { p.r(70 + i * 13, 4, 1, y0 - 2, c.silver); p.px(70 + i * 13, 3, c.gold); }
    /* signpost */
    p.r(5, 8, 2, y0 + 4, c.dwood); p.r(4, y0 + 8, 4, 2, c.wood);
    var rows = [["BRUSSELS 5800", c.red], ["ISTANBUL 6900", c.orange], ["ROME 6200", c.jade], ["TOKYO 5500", c.blue]], j;
    for (j = 0; j < 4; j++) {
      p.r(0, 2 + j * 6, textW(rows[j][0], 1) + 4, 6, c.cream); p.r(0, 2 + j * 6, 2, 6, rows[j][1]); p.r(0, 2 + j * 6 + 5, textW(rows[j][0], 1) + 4, 1, c.stuccoD);
      p.txt(rows[j][0], 3, 2 + j * 6, c.graphite, 1);
    }
    p.r(0, 0, 0, 0, c.white);
  }
  function worldPierAnim(p, W, H, c, o, t, mode) {
    var i, s = p.s;
    for (i = 0; i < 7; i++) { flagDraw(p, 71 + i * 13, 4, FLAGS[i], t, c); }
    if (lampsOn(mode)) { for (i = 0; i < 5; i++) { glowAt(p.ctx, p.ox + (30 + i * 32) * s, p.oy + 30 * s, 20 * s, LIT.gold, 0.2); } }
  }

  function newsstandDraw(p, W, H, c, o, v, mode) {
    var i;
    p.r(1, H - 3, W - 2, 3, "#000000", 0.22);
    p.r(3, 14, W - 6, 15, c.wood); p.r(3, 14, W - 6, 1, c.lwood); p.r(3, 28, W - 6, 1, c.dwood);
    p.r(5, 17, W - 10, 8, c.dwood); p.r(5, 17, W - 10, 1, c.ol);
    for (i = 0; i < 4; i++) { p.r(6 + i * 5, 18, 4, 6, i % 2 ? c.cream : c.white); p.r(6 + i * 5, 18, 4, 1, c.stuccoD); p.px(7 + i * 5, 20, c.graphite); p.px(8 + i * 5, 20, c.graphite); p.r(6 + i * 5, 22, 3, 1, c.orange); }
    p.r(1, 6, W - 2, 9, c.orange); for (i = 1; i < W - 2; i += 6) { p.r(i + 3, 6, 3, 9, c.cream); }
    p.r(1, 14, W - 2, 1, c.dorange); p.r(1, 6, W - 2, 1, LIT.orange, 0.6);
    p.r(3, 0, W - 6, 6, c.graphite); p.ol(3, 0, W - 6, 6, c.ol); fit(p, "K13 DAILY", W >> 1, 1, W - 8, c.cream, 1);
    p.r(0, 28, 2, 4, c.dwood); p.r(W - 2, 28, 2, 4, c.dwood);
  }
  function mailboxDraw(p, W, H, c) {
    p.ell(8, 14, 5, 1, "#000000", 0.25); p.r(7, 10, 2, 5, c.graphite);
    p.r(3, 3, 10, 8, c.mail); p.r(4, 2, 8, 1, c.mail); p.r(4, 2, 8, 1, mix(c.mail, "#FFFFFF", 0.3)); p.r(3, 10, 10, 1, c.mailD); p.r(12, 4, 1, 6, c.mailD);
    p.r(5, 6, 5, 1, c.graphite); p.r(5, 8, 1, 1, c.cream); p.px(11, 5, c.red); p.r(10, 3, 3, 1, c.mailD, 0.0);
  }
  function hydrantDraw(p, W, H, c) {
    p.ell(8, 14, 5, 1, "#000000", 0.25); p.r(5, 12, 6, 2, c.dred); p.r(6, 6, 4, 6, c.red); p.r(5, 5, 6, 2, c.red); p.r(6, 3, 4, 3, c.red); p.r(7, 2, 2, 1, c.gold);
    p.r(3, 8, 3, 2, c.red); p.r(10, 8, 3, 2, c.red); p.px(3, 8, c.gold); p.px(12, 8, c.gold); p.r(6, 6, 1, 6, c.coralL, 0.5); p.r(9, 6, 1, 6, c.dred);
  }
  function bikeRackDraw(p, W, H, c) {
    var i;
    p.ell(8, 14, 7, 1, "#000000", 0.22);
    for (i = 0; i < 3; i++) { p.r(2 + i * 5, 7, 1, 7, c.silver); p.r(2 + i * 5, 6, 2, 1, c.silver); p.r(3 + i * 5, 7, 1, 1, c.silverD); }
    p.ell(5, 11, 3, 3, c.graphite, 0.0);
    p.r(3, 10, 6, 1, c.red); p.ol(2, 9, 4, 4, c.graphite); p.ol(8, 9, 4, 4, c.graphite); p.r(5, 8, 5, 1, c.red); p.r(6, 7, 1, 2, c.red); p.r(10, 7, 2, 1, c.graphite);
  }
  function foodTruckDraw(p, W, H, c, o, v, mode) {
    var i, on = lampsOn(mode);
    p.ell(24, H - 3, 22, 2, "#000000", 0.25);
    p.r(2, 4, 36, 21, c.cream); p.r(2, 4, 36, 1, c.white); p.r(2, 24, 36, 2, c.dorange);
    p.r(38, 11, 9, 14, c.orange); p.r(38, 11, 9, 1, LIT.orange); p.r(40, 13, 5, 5, c.glass); p.r(40, 13, 5, 1, c.white, 0.6); p.r(46, 20, 2, 3, on ? LIT.cream : c.cream); p.r(1, 20, 2, 3, c.red);
    p.r(2, 18, 36, 1, c.orange); p.r(2, 19, 36, 5, c.orange, 0.0);
    p.r(8, 9, 20, 9, c.graphite); p.r(8, 9, 20, 1, c.steel); p.r(9, 10, 18, 7, on ? LIT.amber : c.dwood); p.r(9, 16, 18, 1, c.lwood);
    p.r(6, 5, 24, 4, c.orange); for (i = 6; i < 30; i += 6) { p.r(i + 3, 5, 3, 4, c.cream); } p.r(6, 9, 24, 1, c.dorange);
    p.r(31, 9, 6, 8, c.graphite); p.r(32, 10, 4, 1, c.cream); p.r(32, 12, 4, 1, c.cream); p.r(32, 14, 3, 1, c.cream);
    p.txt("EATS", 6, 20, c.cream, 1, 1);
    for (i = 0; i < 2; i++) { p.ell(10 + i * 26, 26, 4, 4, c.graphite); p.ell(10 + i * 26, 26, 1, 1, c.silver); }
  }
  function fountainDraw(p, W, H, c) {
    p.ell(16, 22, 15, 8, c.curb); p.ell(16, 21, 14, 7, c.curbL); p.ell(16, 21, 12, 6, c.oceanL); p.ell(16, 21, 10, 5, c.ocean2);
    p.ell(16, 19, 4, 3, c.curbL); p.r(14, 11, 4, 8, c.curb); p.r(14, 11, 1, 8, c.curbL); p.ell(16, 11, 5, 2, c.curbL); p.ell(16, 11, 4, 1, c.oceanL);
  }
  function fountainAnim(p, W, H, c, o, t) {
    var i, ph = still() ? 0 : Math.floor((t || 0) * 5) % 4, j;
    for (i = 0; i < 4; i++) { p.px(15 + (i % 2) * 2, 5 + ((i + ph) % 4) * 1, c.white, 0.9); }
    p.r(15, 6, 2, 5, c.oceanL, 0.7);
    for (j = 0; j < 5; j++) { p.px(8 + j * 4 + ((j + ph) % 2), 22 + ((j + ph) % 3 - 1), c.white, 0.6); }
  }
  function scaffoldDraw(p, W, H, c) {
    var x, y;
    p.r(1, H - 3, W - 2, 3, "#000000", 0.2);
    for (x = 2; x < W - 1; x += 14) { p.r(x, 2, 2, H - 4, c.silverD); p.r(x, 2, 1, H - 4, c.silver); }
    for (y = 6; y < H - 4; y += 14) { p.r(1, y, W - 2, 3, c.lwood); p.r(1, y, W - 2, 1, c.wood); p.r(1, y + 2, W - 2, 1, c.dwood); }
    for (y = 9; y < H - 8; y += 14) { for (x = 4; x < W - 14; x += 14) { var i; for (i = 0; i < 12; i++) { p.px(x + i, y + Math.round(i * 10 / 12), c.silverD); } } }
    p.r(2, H - 5, W - 4, 3, c.graphite); p.r(4, 2, W - 8, 2, c.orange);
  }
  function coneDraw(p, W, H, c) {
    p.ell(8, 14, 5, 1, "#000000", 0.25); p.r(4, 12, 8, 2, c.graphite); p.r(6, 4, 4, 8, c.orange); p.r(5, 8, 6, 2, c.orange); p.r(6, 7, 4, 2, c.white); p.r(7, 3, 2, 2, c.orange); p.r(6, 5, 1, 7, LIT.orange, 0.6);
  }

  /* ---------- object registry ---------- */
  var OBJ = {
    "bush": { w: 1, h: 1, layer: "object", draw: bushDraw },
    "agave": { w: 1, h: 1, layer: "object", draw: agaveDraw },
    "flowerbed": { w: 1, h: 1, layer: "floor", draw: flowerbedDraw },
    "rock": { w: 1, h: 1, layer: "object", draw: rockDraw },
    "coral-tree": { w: 2, h: 3, layer: "object", sway: 1, draw: function (p, W, H, c, o, v) { coralDraw(p, W, H, c, o, v); } },
    "eucalyptus": { w: 2, h: 4, layer: "object", sway: 1, draw: function (p, W, H, c, o, v) { eucDraw(p, W, H, c, o, v); } },
    "lamp": { w: 1, h: 2, layer: "object", draw: lampDraw, glow: { color: "#FFC83D", r: 3.6, ox: 0.5, oy: 0.2, a: 0.3 } },
    "parkbench": { w: 2, h: 1, layer: "object", draw: parkBenchDraw },
    "busstop": { w: 2, h: 2, layer: "object", draw: busStopDraw },
    "lifeguard": { w: 2, h: 3, layer: "object", draw: lifeguardDraw },
    "surfrack": { w: 1, h: 2, layer: "object", draw: surfRackDraw },
    "surfboard": { w: 1, h: 1, layer: "object", draw: surfboardDraw },
    "umbrella": { w: 2, h: 2, layer: "object", draw: umbrellaDraw },
    "pier": { w: 8, h: 2, layer: "floor", draw: pierDraw, anim: pierAnim },
    "pier-v": { w: 2, h: 8, layer: "floor", draw: pierDraw, anim: pierAnim },
    "lighthouse": { w: 3, h: 6, layer: "object", draw: lighthouseDraw, anim: lighthouseAnim },
    "crane": { w: 4, h: 6, layer: "object", draw: craneDraw, anim: craneAnim },
    "missionbell": { w: 2, h: 3, layer: "object", draw: bellDraw },
    "sign-la": { w: 6, h: 2, layer: "object", draw: function (p, W, H, c, o, v, m) { letterSignDraw(p, W, H, c, o, v, m, "LOS ANGELES", 8, c.white); } },
    "sign-oc": { w: 5, h: 3, layer: "object", draw: ocSignDraw },
    "sign-sd": { w: 5, h: 3, layer: "object", draw: sdSignDraw },
    "trolleystop": { w: 3, h: 2, layer: "object", draw: trolleyDraw },
    "worldpier": { w: 10, h: 4, layer: "floor", draw: worldPierDraw, anim: worldPierAnim },
    "newsstand": { w: 3, h: 2, layer: "object", draw: newsstandDraw },
    "mailbox": { w: 1, h: 1, layer: "object", draw: mailboxDraw },
    "hydrant": { w: 1, h: 1, layer: "object", draw: hydrantDraw },
    "bikerack": { w: 1, h: 1, layer: "object", draw: bikeRackDraw },
    "foodtruck": { w: 3, h: 2, layer: "object", draw: foodTruckDraw, glow: { color: "#FFB347", r: 2.2, ox: 0.4, oy: 0.4, a: 0.2 } },
    "fountain": { w: 2, h: 2, layer: "object", draw: fountainDraw, anim: fountainAnim },
    "scaffold": { w: 2, h: 3, layer: "object", draw: scaffoldDraw },
    "cone": { w: 1, h: 1, layer: "object", draw: coneDraw }
  };
  (function () {
    var k;
    for (k in PALMS) { if (PALMS.hasOwnProperty(k)) { (function (key) { OBJ[key] = { w: PALMS[key].w, h: PALMS[key].h, layer: "object", sway: 2, draw: function (p, W, H, c, o, v) { palmDraw(p, W, H, c, o, v, PALMS[key].cfg); } }; })(k); } }
  })();
  var objectNames = [];
  (function () { var k; for (k in OBJ) { if (OBJ.hasOwnProperty(k)) { objectNames.push(k); } } })();
  var DIRS = ["down", "up", "left", "right"];
  function vehSize(dir) { return (dir === "down" || dir === "up") ? { w: 1, h: 2 } : { w: 2, h: 1 }; }

  /* =====================================================================================
     CITY FILL: houses, apartments, shop strips, parking, lawns, gas station, school, church, park, medians
     ===================================================================================== */
  function sub(p, dx, dy) { return mkP(p.ctx, p.ox + dx, p.oy + dy, p.s); }
  function tileRoof(p, x, y, w, h, c, col, dk, lt) {
    var i, j;
    p.r(x, y, w, h, col);
    for (j = 0; j < h - 1; j += 3) { for (i = ((j / 3) % 2) * 3; i < w; i += 6) { p.r(x + i, y + j, 5, 2, lt, 0.5); } p.r(x, y + j + 2, w, 1, dk, 0.9); }
    p.r(x, y, w, 1, lt); p.r(x, y + h - 1, w, 1, dk);
  }
  function winLit(p, x, y, w, h, c, lit, seed) {
    var on = lit && hash(x, y, seed) > 0.35;
    p.r(x - 1, y - 1, w + 2, h + 2, c.ol); p.r(x, y, w, h, on ? LIT.amber : mix(c.oceanL, c.glass, 0.5));
    if (!on) { p.r(x, y, 1, h, c.white, 0.4); } else { p.r(x, y, w, 1, LIT.cream, 0.6); }
  }
  var HOUSES = [
    { w: 3, h: 3, wall: "stucco", roof: "terra", ch: 1, garage: 0, tree: 1 },
    { w: 3, h: 3, wall: "white", roof: "terraD", ch: 0, garage: 1, tree: 0 },
    { w: 3, h: 3, wall: "sandy", roof: "terraL", ch: 1, garage: 0, tree: 2 },
    { w: 4, h: 3, wall: "peach", roof: "terra", ch: 1, garage: 1, tree: 0 },
    { w: 4, h: 3, wall: "stucco", roof: "brickD", ch: 0, garage: 1, tree: 1 },
    { w: 4, h: 3, wall: "white", roof: "terraL", ch: 1, garage: 0, tree: 2 }
  ];
  function houseDraw(p, W, H, c, o, v, mode, n) {
    var S = HOUSES[n], lit = lampsOn(mode), wall = S.wall === "sandy" ? mix(c.sand, c.stucco, 0.5) : (S.wall === "peach" ? mix(c.stucco, c.terraL, 0.28) : c[S.wall]), wd = mix(wall, "#000000", 0.14), rc = c[S.roof], rd = mix(rc, "#000000", 0.28), rl = mix(rc, "#FFFFFF", 0.22), fy = H - 21, i, gx = 0;
    p.ell(W >> 1, H - 2, (W >> 1) - 3, 2, "#000000", 0.2);
    p.r(3, fy, W - 6, 18, wall); p.r(3, fy, W - 6, 1, mix(wall, "#FFFFFF", 0.3)); p.r(W - 4, fy, 1, 18, wd); p.r(3, H - 4, W - 6, 3, wd);
    tileRoof(p, 1, 4, W - 2, fy - 2, c, rc, rd, rl);
    p.r(1, fy - 2, W - 2, 2, rd); p.r(1, fy - 3, W - 2, 1, rl);
    p.r(Math.floor(W / 2) - 1, 5, 2, fy - 8, rd, 0.5);
    if (S.ch) { p.r(W - 14, 0, 6, 8, c.brick); p.r(W - 14, 0, 6, 2, c.brickD); p.px(W - 12, 3, c.brickD); p.px(W - 10, 5, c.brickD); }
    if (S.garage) { gx = W - 22; p.r(gx, fy + 5, 16, 13, c.white); p.ol(gx, fy + 5, 16, 13, wd); for (i = 0; i < 4; i++) { p.r(gx + 1, fy + 7 + i * 3, 14, 1, c.silverD, 0.7); } }
    else { p.r(W - 17, fy + 4, 9, 7, c.dwood); p.r(W - 16, fy + 5, 7, 5, lit ? LIT.amber : c.glass); }
    p.r(8, fy + 3, 9, 8, c.dwood); winLit(p, 9, fy + 4, 7, 6, c, lit, 20 + n);
    p.r(Math.floor(W / 2) - 4, fy + 5, 8, 13, c.dwood); p.r(Math.floor(W / 2) - 3, fy + 6, 6, 11, c.lwood); p.px(Math.floor(W / 2) + 1, fy + 12, c.brass); p.r(Math.floor(W / 2) - 5, fy + 3, 10, 2, rd);
    if (S.tree === 1) { p.ell(5, H - 9, 4, 5, c.dplant); p.ell(5, H - 10, 3, 4, c.plant); p.px(4, H - 12, c.coral); p.px(6, H - 9, c.coral); }
    if (S.tree === 2) { p.r(4, H - 20, 2, 12, c.trunkD); p.ell(5, H - 22, 6, 3, c.palmG); p.ell(5, H - 22, 3, 1, c.palmL); }
    p.ell(W - 6, H - 5, 4, 2, c.plant); p.px(W - 7, H - 7, c.fo); p.px(W - 5, H - 7, c.fy);
  }
  var APTS = [
    { w: 4, h: 4, wall: "stucco", acc: "terra", cols: 3, bal: 1 },
    { w: 5, h: 4, wall: "mixPeach", acc: "jade", cols: 4, bal: 0 },
    { w: 3, h: 5, wall: "mixSage", acc: "orange", cols: 2, bal: 1 }
  ];
  function aptDraw(p, W, H, c, o, v, mode, n) {
    var S = APTS[n], lit = lampsOn(mode), wall = S.wall === "mixPeach" ? mix(c.stucco, c.terraL, 0.3) : (S.wall === "mixSage" ? mix(c.stucco, c.grass, 0.2) : c.stucco), wd = mix(wall, "#000000", 0.14), ac = c[S.acc], r, i, cw = Math.floor((W - 8) / S.cols), rows = Math.floor((H - 30) / 14);
    p.ell(W >> 1, H - 2, (W >> 1) - 2, 2, "#000000", 0.2);
    p.r(0, 2, W, 12, c.sideD); p.r(0, 2, W, 2, c.sideL); p.r(0, 12, W, 2, c.sideD); speck(p, 2, 5, W - 4, 6, c.sideD, 8, 600 + n); p.r(W - 14, 4, 10, 6, c.silver); p.r(W - 14, 4, 10, 1, c.white, 0.6);
    if (n === 2) { p.r(4, 5, 14, 6, c.sideD); p.r(5, 6, 12, 4, c.glass, 0.6); }
    p.r(2, 14, W - 4, H - 17, wall); p.r(W - 4, 14, 2, H - 17, wd); p.r(2, 14, W - 4, 1, mix(wall, "#FFFFFF", 0.3)); p.r(2, 14, 2, H - 17, mix(wall, "#FFFFFF", 0.18));
    for (r = 0; r < rows; r++) {
      for (i = 0; i < S.cols; i++) {
        var wx = 6 + i * cw + 1, wy = 18 + r * 14;
        winLit(p, wx, wy, cw - 5, 8, c, lit, 40 + n * 7 + r);
        if (S.bal && r > 0) { p.r(wx - 2, wy + 9, cw - 1, 1, ac); p.r(wx - 2, wy + 10, cw - 1, 1, mix(ac, "#000000", 0.3), 0.8); for (var q = 0; q < cw - 1; q += 3) { p.r(wx - 2 + q, wy + 9, 1, 3, ac, 0.8); } }
      }
      p.r(2, 14 + (r + 1) * 14 - 2, W - 4, 1, wd, 0.5);
    }
    p.r(2, H - 15, W - 4, 12, wd, 0.6); p.r(2, H - 15, W - 4, 1, ac);
    var dx = (W >> 1) - 5; p.r(dx - 1, H - 17, 12, 15, c.ol); p.r(dx, H - 16, 10, 14, c.dwood); p.r(dx + 1, H - 15, 8, 8, lit ? LIT.amber : c.glass); p.px(dx + 8, H - 9, c.brass);
    p.r(dx - 3, H - 20, 16, 3, ac); p.r(dx - 3, H - 20, 16, 1, mix(ac, "#FFFFFF", 0.3));
    p.ell(7, H - 6, 4, 4, c.plant); p.ell(W - 8, H - 6, 4, 4, c.plant); p.px(7, H - 9, c.fo); p.px(W - 8, H - 9, c.fpk);
  }
  var STRIPS = [
    { w: 6, h: 3, shops: [["CAFE", "red", "cream"], ["NAILS", "jade", "cream"], ["PIZZA", "orange", "cream"]] },
    { w: 7, h: 3, shops: [["DELI", "plant", "cream"], ["BOOKS", "blue", "cream"], ["SURF", "gold", "graphite"]] },
    { w: 5, h: 3, shops: [["TACOS", "coral", "cream"], ["BANK", "mail", "white"]] }
  ];
  function stripDraw(p, W, H, c, o, v, mode, n) {
    var S = STRIPS[n], k = S.shops.length, sw = Math.floor((W - 2) / k), lit = lampsOn(mode), i, x, sh, ac, bg;
    p.r(0, H - 3, W, 3, "#000000", 0.2);
    p.r(0, 2, W, 9, c.sideD); p.r(0, 2, W, 2, c.sideL); p.r(0, 9, W, 2, c.sideD); p.r(3, 4, 8, 5, c.silver); p.r(W - 14, 4, 8, 5, c.silver);
    p.r(0, 11, W, H - 14, c.stucco); p.r(0, 11, W, 1, c.white, 0.5); p.r(W - 2, 11, 2, H - 14, c.stuccoD);
    for (i = 0; i < k; i++) {
      sh = S.shops[i]; x = 1 + i * sw; ac = c[sh[1]]; bg = mix(c[sh[1]], "#000000", 0.25);
      p.r(x + 1, 12, sw - 2, 7, bg); p.r(x + 1, 12, sw - 2, 1, mix(ac, "#FFFFFF", 0.3)); fit(p, sh[0], x + (sw >> 1), 13, sw - 6, c[sh[2]], 1);
      p.r(x + 2, 24, sw - 4, 10, lit ? mix(LIT.amber, c.dwood, 0.3) : mix(c.oceanL, c.glass, 0.5)); p.ol(x + 1, 23, sw - 2, 12, c.ol);
      p.r(x + 3, 25, 1, 7, c.white, lit ? 0.0 : 0.4); p.r(x + sw - 12, 26, 8, 8, c.dwood); p.r(x + sw - 11, 27, 6, 6, lit ? LIT.amber : c.glass);
      var j; for (j = 0; j < sw - 2; j++) { p.r(x + 1 + j, 19, 1, 3 + ((j % 6 === 0 || j % 6 === 5) ? 0 : 1), (Math.floor(j / 6) % 2) ? c.cream : ac); }
      p.r(x + 1, 34, sw - 2, 2, c.curb);
    }
    p.r(0, H - 8, W, 5, c.sideD, 0.0);
  }
  function parkingDraw(p, W, H, c, o, v, mode, n) {
    var i, j, cols = ["red", "blue", "white", "yellow", "green", "silver", "black", "orange"], st = Math.floor((W - 8) / 16), row, k = 0;
    p.r(0, 0, W, H, c.asph); speck(p, 0, 0, W, H, c.asphD, 40, 700 + n); speck(p, 0, 0, W, H, c.asphL, 16, 701 + n);
    p.ol(0, 0, W, H, c.curb); p.r(1, 1, W - 2, 1, c.curbL);
    for (row = 0; row < 2; row++) {
      var ry = row === 0 ? 4 : H - 36;
      for (i = 0; i <= st; i++) { p.r(4 + i * 16, ry, 1, 30, c.lineW, 0.9); }
      for (i = 0; i < st; i++) {
        if (hash(i, row, 710 + n) > 0.4) {
          var s2 = sub(p, 4 + i * 16 + 1, ry + (row === 0 ? 2 : 0));
          vehicle(s2, 16, 32, c, row === 0 ? "up" : "down", mixPal(c, CAR_COLORS[cols[k++ % 8]]), "car", mode);
        }
      }
    }
    p.r(W - 6, H - 20, 3, 6, c.curb); p.ell(6, H >> 1, 3, 3, c.plant); p.ell(W - 6, H >> 1, 3, 3, c.plant);
    p.r(W / 2 - 3, (H >> 1) - 1, 6, 2, c.lineY, 0.0);
  }
  function lawnDraw(p, W, H, c, o, v, mode, n) {
    var i, cols = [c.fo, c.fy, c.fr, c.fw, c.fpk];
    p.r(0, 0, W, H, c.park); p.r(0, 0, W, H >> 1, c.parkL, 0.4); speck(p, 0, 0, W, H, c.grassD, 20, 720 + n, 0.7);
    for (i = 0; i < W; i += 10) { p.r(i, 0, 1, 2, c.grassD, 0.4); }
    p.r(0, 0, W, 2, c.plant); p.r(0, H - 2, W, 2, c.plant); p.r(0, 0, 2, H, c.plant); p.r(W - 2, 0, 2, H, c.plant);
    if (n === 1) { p.r(W / 2 - 3, 2, 6, H - 4, c.dirtL); p.r(W / 2 - 3, 2, 1, H - 4, c.dirt); p.r(W / 2 + 2, 2, 1, H - 4, c.dirt); }
    if (n === 2) { for (i = 0; i < 14; i++) { var fx = 5 + Math.floor(hash(i, 1, 721) * (W - 10)), fy = 5 + Math.floor(hash(i, 2, 721) * (H - 10)); p.px(fx, fy, cols[i % 5]); p.px(fx, fy + 1, c.grassD); } }
    if (n === 0) { p.ell(W >> 1, H >> 1, 3, 3, c.plant); p.px((W >> 1) - 1, (H >> 1) - 2, c.palmL); p.ell((W >> 1), H - 6, 2, 1, c.dirtD, 0.5); p.px(W - 8, 7, c.silver); p.px(8, H - 8, c.silver); }
  }
  function gasDraw(p, W, H, c, o, v, mode) {
    var lit = lampsOn(mode), i;
    p.r(0, 14, W, H - 14, c.side); p.r(0, 14, W, 1, c.sideL); p.ol(0, 14, W, H - 14, c.curb); speck(p, 2, 16, W - 4, H - 20, c.sideD, 14, 730);
    p.r(W - 30, 4, 28, 20, c.stucco); p.r(W - 30, 4, 28, 3, c.terra); p.r(W - 30, 6, 28, 1, c.terraD); p.r(W - 28, 10, 24, 9, lit ? LIT.amber : c.glass); p.ol(W - 29, 9, 26, 11, c.ol); p.r(W - 17, 12, 4, 7, c.dwood); p.r(W - 30, 23, 28, 1, c.stuccoD);
    p.r(2, 20, 48, 3, "#000000", 0.14);
    p.r(4, 24, 3, 20, c.steel); p.r(43, 24, 3, 20, c.steel);
    p.r(0, 14, 52, 10, c.white); p.r(0, 14, 52, 2, c.orange); p.r(0, 22, 52, 2, c.orange); p.r(0, 24, 52, 1, c.silverD);
    p.txt("GAS", 21, 17, c.orange, 1, 1);
    for (i = 0; i < 2; i++) { var px = 12 + i * 20; p.ell(px + 4, H - 7, 6, 2, "#000000", 0.2); p.r(px, 34, 8, 18, c.red); p.r(px, 34, 8, 1, c.coralL); p.r(px + 1, 37, 6, 5, c.glass); p.r(px + 2, 38, 4, 2, LIT.jade, lit ? 0.9 : 0.6); p.r(px + 8, 40, 2, 8, c.graphite); p.r(px - 1, 52, 10, 3, c.steel); }
    p.r(W - 4, 2, 2, 36, c.steel); p.r(W - 12, 2, 10, 9, c.graphite); p.ol(W - 12, 2, 10, 9, c.orange); p.txt("GAS", W - 11, 4, lit ? LIT.orange : c.orange, 1, 0);
  }
  function schoolDraw(p, W, H, c, o, v, mode) {
    var lit = lampsOn(mode), cx = W >> 1, i;
    p.ell(cx, H - 2, cx - 3, 2, "#000000", 0.2);
    p.r(2, 14, W - 4, H - 17, c.brick); p.r(2, 14, W - 4, 1, c.brickL); p.r(W - 4, 14, 2, H - 17, c.brickD);
    for (i = 14; i < H - 4; i += 4) { p.r(2, i + 3, W - 4, 1, c.brickD, 0.8); }
    p.r(0, 8, W, 8, c.stuccoD); p.r(0, 8, W, 2, c.cream); p.r(0, 15, W, 1, c.stuccoD);
    for (i = 0; i < 3; i++) { p.r(8 + i * 8, 19, 6, 9, c.ol); p.r(9 + i * 8, 20, 4, 7, lit ? LIT.amber : c.glass); }
    for (i = 0; i < 3; i++) { p.r(W - 34 + i * 8, 19, 6, 9, c.ol); p.r(W - 33 + i * 8, 20, 4, 7, lit ? LIT.amber : c.glass); }
    p.r(cx - 12, 4, 24, 14, c.stucco); p.r(cx - 12, 4, 24, 2, c.terraD); p.r(cx - 14, 2, 28, 3, c.terra); p.r(cx - 7, 24, 14, 20, c.ol); p.r(cx - 6, 25, 12, 18, c.lwood); p.r(cx, 25, 1, 18, c.dwood); p.r(cx - 6, 25, 12, 2, c.dwood);
    p.r(cx - 6, 8, 12, 5, c.white); p.txt("SCHOOL", cx - 11, 8, c.graphite, 1, 0);
    p.r(cx - 5, -0, 10, 0, c.white);
    p.r(8, H - 6, 8, 4, c.dplant); p.ell(10, H - 8, 5, 4, c.plant); p.ell(W - 12, H - 8, 5, 4, c.plant);
    p.r(W - 6, 2, 1, 24, c.silver); p.r(W - 5, 3, 8, 5, c.orange); p.r(W - 5, 3, 8, 1, c.gold);
  }
  function churchDraw(p, W, H, c, o, v, mode) {
    var lit = lampsOn(mode), i;
    p.ell(W >> 1, H - 2, (W >> 1) - 2, 2, "#000000", 0.2);
    p.r(4, 22, 40, H - 25, c.stucco); p.r(4, 22, 3, H - 25, c.white, 0.5); p.r(42, 22, 2, H - 25, c.stuccoD);
    tileRoof(p, 2, 14, 44, 10, c, c.terra, c.terraD, c.terraL); p.r(2, 23, 44, 2, c.terraD);
    for (i = 0; i < 2; i++) { p.r(12 + i * 18, 32, 6, 12, c.ol); p.r(13 + i * 18, 33, 4, 10, lit ? LIT.amber : c.glass); }
    p.r(18, 44, 12, H - 47, c.ol); p.r(19, 45, 10, H - 48, c.dwood); p.ell(24, 45, 5, 3, c.dwood); p.ell(24, 36, 3, 3, c.ol); p.ell(24, 36, 2, 2, lit ? LIT.amber : c.glass);
    p.r(46, 12, 16, H - 15, c.stucco); p.r(46, 12, 3, H - 15, c.white, 0.5); p.r(60, 12, 2, H - 15, c.stuccoD);
    p.r(44, 8, 20, 6, c.terra); p.r(44, 8, 20, 1, c.terraL); p.r(46, 4, 16, 5, c.terra); p.r(50, 0, 8, 5, c.terraD); p.r(51, 0, 6, 1, c.terraL);
    p.r(50, 16, 8, 14, c.ol); p.ell(54, 16, 4, 3, c.ol); p.r(51, 17, 6, 12, c.dark); p.ell(54, 24, 2, 3, c.brass); p.r(52, 21, 4, 1, c.brass); p.r(53, 17, 2, 3, c.graphite);
    p.r(48, 36, 12, 8, c.ol, 0.0); p.ell(54, 38, 3, 3, c.stuccoD);
    p.ell(8, H - 6, 5, 4, c.plant); p.ell(40, H - 6, 5, 4, c.plant); p.px(7, H - 9, c.fo); p.px(41, H - 9, c.fy);
  }
  function parkDraw(p, W, H, c, o, v, mode) {
    var i, cols = [c.fo, c.fy, c.fr, c.fw, c.fpk], cx = W >> 1, cy = H >> 1;
    p.r(0, 0, W, H, c.park); p.r(0, 0, W, H >> 1, c.parkL, 0.35); speck(p, 0, 0, W, H, c.grassD, 40, 740, 0.7);
    p.r(cx - 3, 0, 6, H, c.dirtL); p.r(0, cy - 3, W, 6, c.dirtL); speck(p, cx - 3, 0, 6, H, c.dirt, 24, 741); speck(p, 0, cy - 3, W, 6, c.dirt, 24, 742);
    p.ell(cx, cy, 14, 14, c.plaza); p.ell(cx, cy, 14, 14, c.plazaD, 0.0); p.ell(cx, cy, 12, 12, c.plazaL);
    var f = sub(p, cx - 16, cy - 16); fountainDraw(f, 32, 32, c);
    for (i = 0; i < 10; i++) { p.px(4 + Math.floor(hash(i, 1, 743) * (W - 8)), 4 + Math.floor(hash(i, 2, 743) * 14), cols[i % 5]); p.px(4 + Math.floor(hash(i, 3, 743) * (W - 8)), H - 4 - Math.floor(hash(i, 4, 743) * 12), cols[(i + 2) % 5]); }
    [[10, 12], [W - 16, 14], [12, H - 14], [W - 18, H - 12]].forEach(function (q, k) { var s2 = sub(p, q[0] - 8, q[1] - 12); if (k % 2) { palmDraw(s2, 16, 32, c, {}, 0, PALMS["palm-1"].cfg); } else { p.ell(q[0], q[1], 6, 6, c.dplant); p.ell(q[0] - 1, q[1] - 1, 5, 5, c.plant); p.px(q[0] - 2, q[1] - 2, c.palmL); } });
    p.r(cx - 22, cy - 2, 7, 4, c.wood); p.r(cx - 22, cy - 2, 7, 1, c.lwood); p.r(cx + 15, cy - 2, 7, 4, c.wood); p.r(cx + 15, cy - 2, 7, 1, c.lwood);
    p.ol(0, 0, W, H, c.plant);
  }
  function medianDraw(p, W, H, c, o, v, mode, horiz) {
    var i, n = horiz ? (W >> 4) : (H >> 4);
    if (horiz) { p.r(0, H - 14, W, 10, c.curb); p.r(0, H - 13, W, 8, c.park); p.r(0, H - 14, W, 1, c.curbL); p.r(0, H - 5, W, 1, c.curb); speck(p, 1, H - 12, W - 2, 6, c.grassD, 8, 750); }
    else { p.r(3, 0, 10, H, c.curb); p.r(4, 0, 8, H, c.park); p.r(3, 0, 1, H, c.curbL); p.r(12, 0, 1, H, c.curb); speck(p, 4, 1, 6, H - 2, c.grassD, 8, 751); }
    for (i = 0; i < n; i++) {
      var s2 = horiz ? sub(p, i * 16, H - 44) : sub(p, 0, i * 16 - 8);
      if (i % 2 === 0) { palmDraw(s2, 16, 48, c, {}, 0, PALMS["palm-2"].cfg); }
      else { if (horiz) { p.ell(i * 16 + 8, H - 10, 6, 4, c.dplant); p.ell(i * 16 + 8, H - 11, 5, 3, c.plant); p.px(i * 16 + 6, H - 13, c.coral); p.px(i * 16 + 10, H - 12, c.fy); } else { p.ell(8, i * 16 + 8, 3, 6, c.dplant); p.px(8, i * 16 + 5, c.palmL); } }
    }
  }
  (function () {
    var i;
    for (i = 0; i < 6; i++) { (function (n) { OBJ["house-" + (n + 1)] = { w: HOUSES[n].w, h: HOUSES[n].h, layer: "object", draw: function (p, W, H, c, o, v, m) { houseDraw(p, W, H, c, o, v, m, n); } }; })(i); }
    for (i = 0; i < 3; i++) {
      (function (n) {
        OBJ["apt-" + (n + 1)] = { w: APTS[n].w, h: APTS[n].h, layer: "object", draw: function (p, W, H, c, o, v, m) { aptDraw(p, W, H, c, o, v, m, n); } };
        OBJ["strip-" + (n + 1)] = { w: STRIPS[n].w, h: STRIPS[n].h, layer: "object", draw: function (p, W, H, c, o, v, m) { stripDraw(p, W, H, c, o, v, m, n); } };
      })(i);
    }
    OBJ["lawn-1"] = { w: 2, h: 2, layer: "floor", draw: function (p, W, H, c, o, v, m) { lawnDraw(p, W, H, c, o, v, m, 0); } };
    OBJ["lawn-2"] = { w: 3, h: 2, layer: "floor", draw: function (p, W, H, c, o, v, m) { lawnDraw(p, W, H, c, o, v, m, 1); } };
    OBJ["lawn-3"] = { w: 2, h: 2, layer: "floor", draw: function (p, W, H, c, o, v, m) { lawnDraw(p, W, H, c, o, v, m, 2); } };
    OBJ["parking"] = { w: 6, h: 4, layer: "floor", draw: function (p, W, H, c, o, v, m) { parkingDraw(p, W, H, c, o, v, m, 0); } };
    OBJ["parking-s"] = { w: 4, h: 3, layer: "floor", draw: function (p, W, H, c, o, v, m) { parkingDraw(p, W, H, c, o, v, m, 1); } };
    OBJ["gasstation"] = { w: 5, h: 4, layer: "object", draw: gasDraw, glow: { color: "#FF8A3D", r: 3.4, ox: 0.4, oy: 0.4, a: 0.22 } };
    OBJ["school"] = { w: 7, h: 4, layer: "object", draw: schoolDraw };
    OBJ["church"] = { w: 4, h: 5, layer: "object", draw: churchDraw };
    OBJ["park-small"] = { w: 5, h: 5, layer: "floor", draw: parkDraw };
    OBJ["median-h"] = { w: 4, h: 3, layer: "object", draw: function (p, W, H, c, o, v, m) { medianDraw(p, W, H, c, o, v, m, true); } };
    OBJ["median-v"] = { w: 1, h: 4, layer: "object", draw: function (p, W, H, c, o, v, m) { medianDraw(p, W, H, c, o, v, m, false); } };
    ["house-1", "house-2", "house-3", "house-4", "house-5", "house-6", "apt-1", "apt-2", "apt-3", "strip-1", "strip-2", "strip-3", "lawn-1", "lawn-2", "lawn-3", "parking", "parking-s", "gasstation", "school", "church", "park-small", "median-h", "median-v"].forEach(function (k) { objectNames.push(k); });
  })();

  /* =====================================================================================
     STOREFRONTS
     ===================================================================================== */
  function wallFill(p, x, y, w, h, kind, col, shade, c) {
    var i, j, k;
    p.r(x, y, w, h, col);
    if (kind === "boards") { for (i = 0; i < w; i += 5) { p.r(x + i, y, 1, h, shade); p.r(x + i + 1, y, 1, h, mix(col, "#FFFFFF", 0.1), 0.6); } speck(p, x, y, w, h, shade, 10, 400, 0.6); }
    else if (kind === "brick") { for (j = 0; j < h; j += 4) { p.r(x, y + j + 3, w, 1, shade, 0.85); for (i = (j / 4 % 2) * 4; i < w; i += 8) { p.r(x + i, y + j, 1, 4, shade, 0.85); } } speck(p, x, y, w, h, c.brickL, 12, 401, 0.7); }
    else if (kind === "clap") { for (j = 3; j < h; j += 4) { p.r(x, y + j, w, 1, shade); p.r(x, y + j + 1, w, 1, "#FFFFFF", 0.12); } }
    else if (kind === "lime") { for (k = 0; k < 40; k++) { p.r(x + Math.floor(hash(k, 1, 402) * (w - 3)), y + Math.floor(hash(k, 2, 402) * (h - 2)), 2 + Math.floor(hash(k, 3, 402) * 3), 1 + Math.floor(hash(k, 4, 402) * 2), hash(k, 5, 402) > 0.5 ? shade : c.limeL, 0.7); } }
    else if (kind === "panel") { for (i = 0; i < w; i += 16) { p.r(x + i, y, 1, h, shade); p.r(x + i + 1, y, 1, h, c.steel, 0.4); } p.r(x, y + 1, w, 1, c.steel, 0.5); }
    else { speck(p, x, y, w, h, shade, Math.floor(w * h / 60), 403, 0.8); }
  }
  function roofFlat(p, W, R, main, trim, under, c) {
    var i, ux;
    p.r(0, 0, W, R, main); p.r(0, 0, W, 2, trim); p.r(0, 2, W, 1, "#000000", 0.12);
    p.r(0, R - 5, W, 5, under); p.r(0, R - 5, W, 1, trim, 0.8); p.r(0, R - 1, W, 1, "#000000", 0.25);
    speck(p, 2, 4, W - 4, R - 11, mix(main, "#000000", 0.18), Math.floor(W / 6), 410);
    for (i = 0; i < 2; i++) { ux = 8 + Math.floor(hash(i, W, 411) * (W - 30)); p.r(ux, 6, 8, 5, c.silver); p.r(ux, 6, 8, 1, c.white, 0.7); p.r(ux, 10, 8, 1, c.silverD); p.r(ux + 1, 8, 6, 1, c.silverD, 0.6); }
  }
  function roofTile(p, W, R, c) {
    var x, y;
    p.r(0, 0, W, R, c.terra);
    for (y = 2; y < R - 4; y += 4) { for (x = ((y / 4) % 2) * 3; x < W; x += 6) { p.r(x, y, 5, 3, c.terraL, 0.55); p.r(x, y + 3, 6, 1, c.terraD); } }
    p.r(0, 0, W, 2, c.terraD); p.r(0, R - 5, W, 5, c.terraD); p.r(0, R - 5, W, 1, c.terraL); p.r(0, R - 1, W, 1, "#000000", 0.28);
  }
  function awning(p, x, y, w, h, A, B, mode, c) {
    var i, col, sw = 6, n;
    for (i = 0; i < w; i++) {
      if (mode === "tiger") { col = ((i + (x % 8)) % 12 < 6) ? A : B; }
      else if (mode === "tri") { col = [A, B, c.red][Math.floor(i / sw) % 3]; }
      else { col = (Math.floor(i / sw) % 2 === 0) ? A : B; }
      n = (i % sw === 0 || i % sw === sw - 1) ? 0 : 1;
      p.r(x + i, y, 1, h + n, col);
      if (mode === "tiger") { var yy; for (yy = 0; yy < h + n; yy++) { p.px(x + i, y + yy, (((i + yy) + x % 8) % 12 < 6) ? A : B); } }
    }
    p.r(x, y, w, 1, "#FFFFFF", 0.3); p.r(x, y + h - 1, w, 1, "#000000", 0.14);
    p.r(x + 1, y + h + 1, w - 2, 2, "#000000", 0.16);
  }
  /* views painted inside window panes, alpha a: 1 lit, lower by day */
  function viewTables(p, x, y, w, h, i, a, c) {
    p.r(x, y, w, h, c.dwood, 0.55 * a); p.r(x + 1, y + h - 8, w - 2, 2, c.lwood, a); p.r(x + 2, y + h - 6, 1, 6, c.dwood, a); p.r(x + w - 3, y + h - 6, 1, 6, c.dwood, a);
    p.r(x + 2, y + 3, 2, 2, LIT.gold, a); p.r(x + w - 4, y + 3, 2, 2, LIT.gold, a); p.r(x + 3, y + h - 12, 3, 4, c.ol, 0.7 * a); p.r(x + w - 7, y + h - 12, 3, 4, c.ol, 0.7 * a);
  }
  function viewBottles(p, x, y, w, h, i, a, c) {
    var j, k, cols = [c.gold, c.orange, c.jade, c.cream, c.red];
    p.r(x, y, w, h, c.ol, 0.7 * a);
    for (j = 0; j < 3; j++) { p.r(x, y + 4 + j * 7, w, 1, c.lwood, a); for (k = 0; k < w - 2; k += 3) { p.r(x + 1 + k, y + 1 + j * 7, 2, 3, cols[(k + j + i) % 5], a); p.px(x + 1 + k, y + j * 7, cols[(k + j + i) % 5], a); } }
  }
  function viewGreens(p, x, y, w, h, i, a, c) {
    var k; p.r(x, y, w, h, c.stucco, 0.5 * a);
    for (k = 0; k < w - 2; k += 4) { p.ell(x + 3 + k, y + h - 6 - (k % 3), 3, 4, c.plant, a); p.px(x + 3 + k, y + h - 8, c.palmL, a); }
    p.r(x, y + h - 3, w, 3, c.dwood, a);
  }
  function viewGallery(p, x, y, w, h, i, a, c) {
    var cl = [c.coral, c.gold, c.orange, c.red];
    p.r(x, y, w, h, c.white, 0.8 * a); p.r(x + 2, y + 3, w - 4, h - 10, c.djade, a); p.r(x + 3, y + h - 12, w - 6, 2, cl[i % 4], a); p.r(x + 4, y + 5, 3, 4, cl[(i + 1) % 4], a); p.r(x + w - 8, y + 6, 3, 4, cl[(i + 2) % 4], a); p.px(x + w / 2, y + 4, c.gold, a);
  }
  function viewScreens(p, x, y, w, h, i, a, c) {
    var k; p.r(x, y, w, h, c.ink, 0.9);
    for (k = 0; k < 3; k++) { p.r(x + 2 + k * 6, y + 3, 5, 4, c.graphite, 1); p.r(x + 3 + k * 6, y + 4, 3, 1, k === 1 ? LIT.red : LIT.jade, a); p.r(x + 3 + k * 6, y + 6, 2, 1, LIT.yellow, a); }
    p.r(x, y + h - 6, w, 6, c.graphite);
  }
  function viewFood(p, x, y, w, h, i, a, c) {
    var k; p.r(x, y, w, h, c.cream, 0.6 * a); p.r(x, y + h - 7, w, 7, c.lwood, a); p.r(x, y + h - 7, w, 1, c.white, a);
    for (k = 0; k < w - 4; k += 5) { p.r(x + 2 + k, y + h - 11, 4, 3, c.coralL, a); p.r(x + 2 + k, y + h - 12, 4, 1, c.yolk, a); p.r(x + 2 + k, y + h - 8, 4, 1, c.dwood, a); }
    p.r(x + 2, y + 2, 2, 2, LIT.gold, a); p.r(x + w - 4, y + 2, 2, 2, LIT.gold, a);
  }
  function viewDJ(p, x, y, w, h, i, a, c) {
    p.r(x, y, w, h, c.dark, 0.95);
    if (i === 0) { p.ell(x + 6, y + 9, 2, 2, c.skin, a * 0.6); p.r(x + 4, y + 11, 5, 6, c.graphite, 1); p.r(x + 3, y + 8, 7, 1, c.graphite, 1); p.r(x + 2, y + 19, 12, 3, c.steel, 1); p.r(x + 4, y + 18, 3, 1, LIT.red, a); p.r(x + 9, y + 18, 3, 1, LIT.jade, a); }
    else { p.ell(x + w / 2, y + 17, 3, 3, c.steel); p.ell(x + w / 2, y + 17, 1, 1, c.graphite); p.px(x + 2, y + 3, LIT.red, a); p.px(x + w - 3, y + 5, LIT.gold, a); }
  }
  function pane(p, c, x, y, w, h, st, view, idx, trim) {
    var j, lit = st.lit, a = lit ? 1 : 0.5, g0, g1;
    p.r(x - 1, y - 1, w + 2, h + 2, trim || c.ol); p.ol(x - 1, y - 1, w + 2, h + 2, c.ol);
    if (lit) { g0 = mix(LIT.amber, c.dwood, 0.45); g1 = mix(LIT.gold, c.dwood, 0.55); }
    else { g0 = mix(c.oceanL, c.white, 0.55); g1 = c.glass; }
    for (j = 0; j < h; j++) { p.r(x, y + j, w, 1, mix(g0, g1, j / Math.max(1, h - 1))); }
    if (view) { view(p, x, y, w, h, idx, a, c); }
    if (!lit) { p.r(x + 2, y + 2, 1, Math.max(2, h - 6), c.white, 0.5); p.r(x + 4, y + 2, 1, Math.max(2, h - 9), c.white, 0.35); }
    else { p.r(x, y, w, 1, LIT.cream, 0.5); }
    p.r(x - 2, y + h + 1, w + 4, 2, trim || c.lwood); p.r(x - 2, y + h + 1, w + 4, 1, c.white, 0.25);
  }
  function windowsRow(p, c, S, st, x0, x1, y, h) {
    var rw = x1 - x0, n = Math.max(1, Math.round(rw / (S.winW || 18))), pw = Math.floor((rw - (n - 1) * 4) / n), i;
    if (rw < 6) { return; }
    for (i = 0; i < n; i++) {
      if (st.state === "construction") { boarded(p, c, x0 + i * (pw + 4), y, pw, h); }
      else { pane(p, c, x0 + i * (pw + 4), y, pw, h, st, S.view, i, S.trim); }
    }
  }
  function boarded(p, c, x, y, w, h) {
    var i; p.r(x - 1, y - 1, w + 2, h + 2, c.ol); p.r(x, y, w, h, c.lwood);
    for (i = 0; i < h; i += 6) { p.r(x, y + i + 5, w, 1, c.dwood); }
    for (i = 0; i < w - 2; i += 2) { p.px(x + i, y + Math.round(i * (h - 1) / Math.max(1, w - 2)), c.dwood, 0.6); }
    p.px(x + 2, y + 3, c.graphite); p.px(x + w - 3, y + h - 4, c.graphite);
  }
  function doorDraw(p, c, S, st, x, H) {
    var y = H - 26, col = S.doorCol || c.wood, dk = mix(col, "#000000", 0.3), lit = st.lit;
    p.r(x - 1, y - 2, 18, 28, S.trim || c.ol); p.ol(x - 1, y - 2, 18, 28, c.ol);
    if (st.state === "construction") { p.r(x + 1, y, 14, 26, c.lwood); p.r(x + 1, y + 12, 14, 1, c.dwood); p.r(x + 1, y + 4, 14, 1, c.dwood); p.r(x + 1, y + 20, 14, 1, c.dwood); p.px(x + 4, y + 8, c.graphite); p.px(x + 11, y + 16, c.graphite); return; }
    p.r(x + 1, y, 14, 26, col); p.r(x + 1, y, 14, 1, mix(col, "#FFFFFF", 0.25)); p.r(x + 1, y, 1, 26, mix(col, "#FFFFFF", 0.15)); p.r(x + 14, y, 1, 26, dk);
    p.r(x + 3, y + 2, 10, 11, lit ? mix(LIT.gold, c.dwood, 0.3) : mix(c.oceanL, c.glass, 0.5)); p.r(x + 3, y + 2, 10, 1, c.white, 0.35); p.r(x + 7, y + 2, 2, 11, col);
    if (!lit) { p.r(x + 4, y + 3, 1, 6, c.white, 0.45); }
    p.r(x + 3, y + 15, 10, 8, dk, 0.55); p.ol(x + 3, y + 15, 10, 8, dk);
    p.r(x + 12, y + 14, 2, 2, c.brass); p.r(x + 12, y + 14, 1, 1, "#FFE9A0");
    p.r(x, H - 3, 16, 3, c.curb); p.r(x, H - 3, 16, 1, c.curbL);
  }
  function openSign(p, c, x, y) { p.r(x, y, 15, 7, c.graphite); p.ol(x, y, 15, 7, c.ol); p.txt("OPEN", x + 0, y + 1, c.jade, 1, 1); }
  function plate(p, x, y, w, h, bg, edge, c) { p.r(x, y, w, h, bg); p.r(x, y, w, 1, mix(bg, "#FFFFFF", 0.25)); p.r(x, y + h - 1, w, 1, mix(bg, "#000000", 0.3)); p.ol(x - 1, y - 1, w + 2, h + 2, edge || c.ol); }
  function star(p, x, y, col) { p.px(x, y, col); p.px(x - 1, y, col, 0.8); p.px(x + 1, y, col, 0.8); p.px(x, y - 1, col, 0.8); p.px(x, y + 1, col, 0.8); }
  function planter(p, c, x, y, w, plantCol) {
    var i; p.r(x, y + 3, w, 5, c.terra); p.r(x, y + 3, w, 1, c.terraL); p.r(x, y + 7, w, 1, c.terraD);
    for (i = 0; i < w - 1; i += 3) { p.ell(x + 2 + i, y + 1, 2, 3, plantCol || c.plant); p.px(x + 2 + i, y - 1, c.palmL); }
  }
  function bulbs(p, x, y, w, step, col, a) { var i; for (i = 0; i < w; i += step) { p.px(x + i, y, col, a); } }

  /* ---- lights: [{x,y (px in sprite), r (tiles), color, a}] ---- */
  function winLights(S, W, H, color) {
    var out = [], dx16 = S.dx * 16, yy = H - 38;
    out.push({ x: dx16 * 0.5, y: yy, r: 2.2, color: color || LIT.amber, a: 0.22 });
    out.push({ x: (W + dx16 + 16) * 0.5, y: yy, r: 2.2, color: color || LIT.amber, a: 0.22 });
    out.push({ x: dx16 + 8, y: H - 14, r: 1.6, color: LIT.cream, a: 0.24 });
    return out;
  }

  /* ---- the specs ---- */
  var SHOPS = {};
  function addShop(S) { SHOPS[S.key] = S; }

  /* Tiger Hospitality: a group's office, tiger stripe awning */
  addShop({ key: "TigerHospitality_Website_01", name: "Tiger Hospitality", w: 7, h: 5, R: 28, dx: 3, cat: "office", winW: 24, doorCol: "#5E3B26",
    wall: ["boards", "dwood", "ol"], view: viewTables, trim: "dwood",
    roof: function (p, W, R, c) { roofFlat(p, W, R, c.graphite, c.orange, c.ink, c); },
    sign: function (p, W, R, c) { plate(p, 6, R + 1, W - 12, 11, c.graphite, c.brass, c); p.box(9, R + 3, 8, 8, c.cream, c.white, c.stuccoD); p.txt("TH", 10, R + 4, c.graphite, 1, 1); fit(p, "TIGER HOSPITALITY", (W >> 1) + 6, R + 4, W - 40, c.cream, 1); },
    awning: { a: "orange", b: "graphite", mode: "tiger", y: 12, h: 9 },
    extra: function (p, W, H, c) { planter(p, c, 3, H - 16, 14, c.plant); planter(p, c, W - 17, H - 16, 14, c.plant); },
    lights: function (S, W, H) { return winLights(S, W, H); } });

  /* La Vida: healthy kitchen, olive green and cream, pink bar, palm logo */
  addShop({ key: "LaVida", name: "La Vida", w: 5, h: 5, R: 28, dx: 2, cat: "kitchen", winW: 22, doorCol: "#8C9A3A",
    wall: ["plain", "stucco", "stuccoD"], view: viewGreens, trim: "olive",
    roof: function (p, W, R, c) { roofFlat(p, W, R, c.cream, c.olive, c.pink, c); p.r(0, R - 5, W, 5, c.pink); p.r(0, R - 5, W, 1, c.olive); p.r(0, R - 1, W, 1, "#000000", 0.2); },
    sign: function (p, W, R, c) {
      p.r(0, R, W, 12, c.pink); p.r(0, R, W, 1, c.olive); p.r(0, R + 11, W, 1, c.olive, 0.7);
      p.ell(W >> 1, R, 13, 13, c.cream); p.ell(W >> 1, R, 12, 12, c.olive); p.ell(W >> 1, R + 1, 10, 10, c.oliveD, 0.45);
      p.r((W >> 1) - 1, R - 9, 2, 5, c.dwood); p.r((W >> 1) - 4, R - 10, 3, 1, c.palmL); p.r((W >> 1) + 1, R - 10, 3, 1, c.palmL); p.r((W >> 1) - 3, R - 9, 2, 1, c.palmG); p.r((W >> 1) + 1, R - 9, 2, 1, c.palmG); p.px((W >> 1), R - 11, c.palmL);
      p.txt("LA", (W >> 1) - 3, R - 3, c.cream, 1, 1); p.txt("VIDA", (W >> 1) - 7, R + 4, c.cream, 1, 1);
    },
    awning: { a: "olive", b: "cream", mode: "stripe", y: 13, h: 8 },
    extra: function (p, W, H, c) { planter(p, c, 3, H - 16, 12, c.plant); planter(p, c, W - 15, H - 16, 12, c.plant); p.px(6, H - 19, c.fo); p.px(9, H - 18, c.fy); p.px(W - 12, H - 19, c.fpk); p.px(W - 9, H - 18, c.fo); },
    lights: function (S, W, H) { return winLights(S, W, H); } });

  /* Miramar: 1938 theatre food hall, marquee with bulbs */
  addShop({ key: "Miramar", name: "Miramar Food Hall", w: 7, h: 5, R: 28, dx: 3, cat: "foodhall", winW: 22, doorCol: "#C9A24A",
    wall: ["plain", "greenD", "green"], view: viewGallery, trim: "brass",
    roof: function (p, W, R, c) {
      var cx = W >> 1;
      p.r(0, 8, W, R - 8, c.green); p.r(0, R - 5, W, 5, c.cream); p.r(0, R - 5, W, 1, c.white); p.r(0, R - 1, W, 1, "#000000", 0.25);
      p.r(cx - 22, 3, 44, R - 3, c.green); p.r(cx - 22, 3, 44, 2, c.cream); p.r(cx - 22, 5, 44, 1, c.brass); p.r(cx - 18, 0, 36, 4, c.green); p.r(cx - 18, 0, 36, 1, c.cream);
      p.r(0, 8, W, 2, c.cream); p.r(0, 10, W, 1, c.brass); p.r(cx - 22, 7, 1, R - 12, c.greenD); p.r(cx + 21, 7, 1, R - 12, c.greenD);
      p.r(cx - 12, 12, 24, 9, c.greenD); p.txt("FOOD HALL", cx - 17, 14, c.cream, 1, 1); p.r(cx - 17, 21, 34, 1, c.brass, 0.0);
      var i; for (i = 6; i < W - 6; i += 12) { if (i < cx - 24 || i > cx + 20) { p.r(i, 14, 4, 8, c.greenD); p.r(i + 1, 15, 2, 6, c.green); } }
    },
    sign: function (p, W, R, c, st, S) {
      var cx = (S.dx * 16) + 8, x = cx - 31;
      p.r(x - 2, R + 3, 66, 17, c.brass); p.r(x - 2, R + 3, 66, 1, "#FFE9A0"); p.r(x, R + 5, 62, 13, c.greenD); p.ol(x, R + 5, 62, 13, c.ol);
      fit(p, "MIRAMAR", cx, R + 8, 58, c.cream, 2);
      p.r(cx - 3, R + 20, 6, 2, c.brass); p.r(x + 4, R + 20, 2, 5, c.dwood, 0.5); p.r(x + 54, R + 20, 2, 5, c.dwood, 0.5);
      bulbs(p, x - 1, R + 4, 64, 4, c.cream, 0.6); bulbs(p, x - 1, R + 18, 64, 4, c.cream, 0.6);
    },
    awning: null,
    extra: function (p, W, H, c) { p.r(0, H - 10, W, 10, c.greenD); var i; for (i = 0; i < W; i += 8) { p.r(i, H - 10, 1, 10, c.green, 0.7); } p.r(0, H - 10, W, 1, c.brass); },
    lights: function (S, W, H) { var l = winLights(S, W, H, LIT.gold); l.push({ x: S.dx * 16 + 8, y: 40, r: 3.4, color: LIT.gold, a: 0.28 }); return l; } });

  /* CENGO: night club, neon CENGO with the red O */
  addShop({ key: "CENGO", name: "CENGO", w: 5, h: 5, R: 28, dx: 2, cat: "club", winW: 20, doorCol: "#26272B",
    wall: ["panel", "ink", "graphite"], view: viewDJ, trim: "steel",
    roof: function (p, W, R, c) { roofFlat(p, W, R, c.dark, c.steel, c.graphite, c); p.r(6, 6, 10, 9, c.ink); p.ell(11, 10, 3, 3, c.steel); p.ell(11, 10, 1, 1, c.graphite); p.r(W - 16, 6, 10, 9, c.ink); p.ell(W - 11, 10, 3, 3, c.steel); p.ell(W - 11, 10, 1, 1, c.graphite); },
    sign: function (p, W, R, c) {
      p.r(4, R, W - 8, 12, c.dark); p.ol(3, R - 1, W - 6, 14, c.steel);
      p.txt("C", 18, R + 1, c.slate, 2, 0); p.txt("E", 26, R + 1, c.slate, 2, 0); p.txt("N", 34, R + 1, c.slate, 2, 0); p.txt("G", 42, R + 1, c.slate, 2, 0); p.txt("O", 50, R + 1, mix(c.red, "#000000", 0.4), 2, 0);
    },
    awning: null,
    extra: function (p, W, H, c, st, S) {
      var x = S.dx * 16;
      p.r(x - 7, H - 12, 2, 12, c.silver); p.ell(x - 6, H - 13, 2, 1, c.silver); p.r(x + 21, H - 12, 2, 12, c.silver); p.ell(x + 22, H - 13, 2, 1, c.silver);
      p.r(x - 5, H - 11, 26, 1, c.red); p.px(x - 4, H - 10, c.red); p.px(x + 10, H - 9, c.red); p.px(x + 11, H - 9, c.red); p.px(x + 20, H - 10, c.red);
      p.r(x + 1, H - 30, 14, 2, c.red);
    },
    anim: function (p, W, H, c, t, st) {
      var R = 28, f = still() ? 1 : (Math.sin((t || 0) * 11) > 0.92 ? 0.55 : 1), s = p.s;
      p.txt("C", 18, R + 1, LIT.white, 2, 0); p.txt("E", 26, R + 1, LIT.white, 2, 0); p.txt("N", 34, R + 1, LIT.white, 2, 0);
      p.txt("G", 42, R + 1, LIT.white, 2, 0); p.txt("O", 50, R + 1, LIT.red, 2, 0);
      if (st.lit) { glowAt(p.ctx, p.ox + 40 * s, p.oy + (R + 6) * s, 34 * s, LIT.white, 0.12 * f); glowAt(p.ctx, p.ox + 54 * s, p.oy + (R + 6) * s, 14 * s, LIT.red, 0.3 * f); }
      p.r(36, H - 30, 8, 2, LIT.red, 0.9 * f);
    },
    lights: function (S, W, H) { var l = winLights(S, W, H, LIT.red); return l; } });

  /* STATION8: a big public market hall */
  addShop({ key: "STATION8", name: "STATION8", w: 8, h: 5, R: 30, dx: 3, cat: "market", winW: 26, doorCol: "#6E7B2A",
    wall: ["plain", "tan", "gOCD"], view: viewFood, trim: "brownD",
    roof: function (p, W, R, c) {
      var x, y, h;
      p.r(0, R - 6, W, 6, c.oliveD); p.r(0, R - 6, W, 1, c.olive); p.r(0, R - 1, W, 1, "#000000", 0.25);
      for (x = 0; x < W; x++) { h = Math.round(7 + Math.sin(((x + 0.5) / W) * Math.PI) * 15); p.r(x, R - 6 - h, 1, h, (x % 6 < 1) ? c.slate : c.silver); p.px(x, R - 6 - h, c.white); }
      for (x = 8; x < W - 8; x += 12) { p.r(x, R - 17, 7, 5, c.dwood); p.r(x + 1, R - 16, 5, 3, c.glass); }
      p.r(0, R - 6, 0, 0, c.white);
    },
    sign: function (p, W, R, c, st, S) {
      var cx = W >> 1;
      p.r(0, R, W, 13, c.olive); p.r(0, R, W, 1, c.oliveD); p.r(0, R + 12, W, 1, c.oliveD);
      p.ell(cx, R + 5, 9, 9, c.cream); p.ell(cx, R + 5, 8, 8, c.oliveD); p.txt("8", cx - 1, R + 3, c.cream, 1, 0);
      p.r(cx - 3, R + 3, 7, 1, c.cream, 0.0);
      p.r(8, R + 2, cx - 20, 9, c.tan); p.txt("STATION8", 10, R + 4, c.brownD, 1, 1);
      p.r(cx + 12, R + 2, cx - 20, 9, c.tan); p.txt("MARKET", cx + 15, R + 4, c.brownD, 1, 1);
    },
    awning: { a: "orange", b: "cream", mode: "stripe", y: 15, h: 8 },
    extra: function (p, W, H, c, st, S) {
      var x = S.dx * 16, i;
      p.r(x - 14, H - 34, 44, 34, c.brownD); p.r(x - 12, H - 32, 40, 32, c.dwood); p.ell(x + 8, H - 32, 20, 6, c.brownD); p.ell(x + 8, H - 31, 18, 5, c.dwood);
      p.r(x - 11, H - 30, 38, 4, c.olive); p.txt("OPEN HALL", x - 3, H - 29, c.cream, 1, 0); p.r(x - 11, H - 25, 38, 25, c.dwood, 0.0);
      for (i = 0; i < 3; i++) { p.r(x - 10 + i * 13, H - 22, 12, 8, [c.red, c.jade, c.gold][i]); p.r(x - 10 + i * 13, H - 22, 12, 1, "#FFFFFF", 0.3); }
      for (i = 6; i < W - 6; i += 24) { if (i < x - 16 || i > x + 32) { p.r(i, R0(S) + 14, 3, 6, [c.red, c.jade, c.gold][(i / 24 | 0) % 3]); } }
    },
    lights: function (S, W, H) { var l = winLights(S, W, H, LIT.amber); l.push({ x: S.dx * 16 + 8, y: H - 18, r: 2.6, color: LIT.amber, a: 0.3 }); return l; } });
  function R0(S) { return S.R; }

  /* Global Fork: Little Italy food hall, tricolour awnings, a round seal */
  addShop({ key: "GlobalFork", name: "Global Fork", w: 7, h: 5, R: 28, dx: 3, cat: "foodhall", winW: 22, doorCol: "#3C8A5E",
    wall: ["brick", "brick", "brickD"], view: viewTables, trim: "cream",
    roof: function (p, W, R, c) { roofTile(p, W, R, c); },
    sign: function (p, W, R, c) {
      var cx = W >> 1;
      p.r(0, R, W, 12, c.tan); p.r(0, R, W, 1, c.cream); p.r(0, R + 11, W, 1, c.brickD);
      p.ell(cx, R - 1, 13, 13, c.cream); p.ell(cx, R - 1, 12, 12, c.graphite); p.ell(cx, R - 1, 10, 10, c.cream); p.ell(cx, R - 1, 9, 9, c.tan);
      p.r(cx - 1, R - 6, 1, 8, c.graphite); p.r(cx - 3, R - 6, 1, 4, c.graphite); p.r(cx + 1, R - 6, 1, 4, c.graphite); p.r(cx - 3, R - 3, 5, 1, c.graphite); p.r(cx - 1, R - 6, 1, 0, c.graphite); p.r(cx, R + 1, 1, 4, c.graphite);
      p.txt("GLOBAL", 8, R + 4, c.graphite, 1, 1); p.txt("FORK", W - 8 - textW("FORK", 1), R + 4, c.graphite, 1, 1);

    },
    awning: { a: "plant", b: "cream", mode: "tri", y: 14, h: 8 },
    extra: function (p, W, H, c) { var i; for (i = 0; i < 4; i++) { p.r(2 + i * 4, H - 16, 2, 6, c.dwood); } planter(p, c, W - 18, H - 16, 14, c.plant); bulbs(p, 2, R1() + 12, W - 4, 5, c.cream, 0.5); },
    lights: function (S, W, H) { return winLights(S, W, H, LIT.amber); } });
  function R1() { return 28; }

  /* Egg & Out: egg-yellow diner under a fried egg */
  addShop({ key: "EggOut", name: "Egg & Out", w: 5, h: 5, R: 28, dx: 2, cat: "kitchen", winW: 22, doorCol: "#EA5E14",
    wall: ["plain", "yolk", "yolkD"], view: viewFood, trim: "white",
    roof: function (p, W, R, c) {
      var cx = W >> 1; roofFlat(p, W, R, c.orange, c.dorange, c.dorange, c);
      p.ell(cx, 11, 15, 8, c.white); p.ell(cx - 6, 14, 6, 4, c.white); p.ell(cx + 8, 13, 6, 4, c.white); p.ell(cx - 1, 10, 6, 5, c.yolk); p.ell(cx - 3, 8, 2, 2, "#FFE9A0"); p.ol(cx - 20, 0, 0, 0, c.ol);
    },
    sign: function (p, W, R, c) { plate(p, 3, R + 1, W - 6, 11, c.orange, c.dorange, c); fit(p, "EGG & OUT", W >> 1, R + 4, W - 10, c.cream, 2); },
    awning: { a: "orange", b: "cream", mode: "stripe", y: 13, h: 8 },
    extra: function (p, W, H, c) { var i; p.r(0, H - 10, W, 10, c.orange); for (i = 0; i < W; i += 4) { p.r(i, H - 10 + (i / 4 % 2) * 4, 4, 4, c.dorange); p.r(i + 1, H - 9 + (i / 4 % 2) * 4, 2, 2, c.orange); } p.r(0, H - 10, W, 1, c.cream); },
    lights: function (S, W, H) { return winLights(S, W, H); } });

  /* Trust Me Bro: a sports-bet ticker window */
  addShop({ key: "TrustMeBro", name: "Trust Me Bro", flagX: 6, w: 5, h: 5, R: 28, dx: 2, cat: "office", winW: 24, doorCol: "#26272B",
    wall: ["plain", "ink", "graphite"], view: viewScreens, trim: "yolk",
    roof: function (p, W, R, c) {
      p.r(0, 0, W, R, c.dark); p.ol(0, 0, W, R - 1, c.gold); p.ol(2, 2, W - 4, R - 5, c.gold); p.r(0, R - 1, W, 1, "#000000", 0.25);
      p.ell(15, 13, 8, 8, c.gold); p.r(8, 9, 14, 4, c.dark); p.r(18, 11, 6, 2, c.dark); p.px(12, 15, c.dark); p.px(17, 15, c.dark); p.r(12, 18, 6, 1, c.dark); p.r(9, 22, 12, 2, c.gold, 0.0);
      p.txt("TRUST", 26, 3, c.gold, 2, 1); p.txt("ME BRO", 26, 14, c.gold, 2, 1);
    },
    sign: function (p, W, R, c) { p.r(3, R, W - 6, 12, c.dark); p.ol(3, R, W - 6, 12, c.gold); },
    awning: null,
    extra: function (p, W, H, c, st, S) { var x = S.dx * 16; p.r(x - 18, H - 12, 17, 2, c.gold); p.r(x + 17, H - 12, 17, 2, c.gold); p.r(0, H - 10, W, 10, c.graphite); p.r(0, H - 10, W, 1, c.gold); },
    anim: function (p, W, H, c, t) {
      var msg = "WIN 43%  STREAK 1W  PICKS  +1.0  BRO  ", off = still() ? 0 : Math.floor((t || 0) * 12) % (msg.length * 4), s = p.s;
      p.ctx.save(); p.ctx.beginPath(); p.ctx.rect(p.ox + 5 * s, p.oy + 29 * s, (W - 10) * s, 8 * s); p.ctx.clip();
      p.txt(msg + msg, 5 - off, 31, LIT.yellow, 1, 1);
      p.ctx.restore();
    },
    lights: function (S, W, H) { return winLights(S, W, H, LIT.jade); } });

  /* baa atelier: a finishing studio, limewash */
  addShop({ key: "baa_atelier", name: "baa atelier", w: 5, h: 5, R: 28, dx: 2, cat: "studio", winW: 12, doorCol: "#5E3B26",
    wall: ["lime", "lime", "limeD"], view: viewBottles, trim: "ink",
    roof: function (p, W, R, c) { p.r(0, 0, W, R, c.lime); p.r(0, 0, W, 3, c.limeL); p.r(0, R - 6, W, 6, c.limeD); p.r(0, R - 6, W, 1, c.limeL); p.r(0, R - 1, W, 1, "#000000", 0.2); wallFill(p, 0, 3, W, R - 9, "lime", c.lime, c.limeD, c); p.r(W - 24, 6, 16, 9, c.dark, 0.9); p.r(W - 23, 7, 14, 7, c.glass, 0.7); },
    sign: function (p, W, R, c) { plate(p, 14, R + 2, W - 28, 8, c.graphite, c.ol, c); fit(p, "BAA ATELIER", W >> 1, R + 4, W - 34, c.limeL, 1); },
    awning: null,
    extra: function (p, W, H, c, st, S) {
      var x = S.dx * 16 + 21, i, cols = [c.limeL, c.terra, c.slate];
      for (i = 0; i < 3; i++) { p.r(x + i * 0, H - 36 + i * 9, 8, 7, cols[i]); p.ol(x - 1, H - 37 + i * 9, 10, 9, c.ol); speck(p, x, H - 36 + i * 9, 8, 7, mix(cols[i], "#000000", 0.2), 5, 420 + i, 0.8); }
      p.r(0, H - 8, W, 8, c.slate); p.r(0, H - 8, W, 1, c.steel);
    },
    lights: function (S, W, H) { return winLights(S, W, H, LIT.gold); } });

  /* BarFix: a bar with a scale */
  addShop({ key: "BarFix", name: "BarFix", w: 5, h: 5, R: 28, dx: 2, cat: "bar", winW: 22, doorCol: "#3E2A1F",
    wall: ["boards", "graphite", "ink"], view: viewBottles, trim: "brass",
    roof: function (p, W, R, c) { roofFlat(p, W, R, c.ink, c.brass, c.graphite, c); },
    sign: function (p, W, R, c) { p.r(3, R, W - 6, 12, c.dark); p.ol(3, R, W - 6, 12, c.brass); p.txt("BARFIX", 17, R + 1, c.dwood, 2, 1); },
    awning: null,
    extra: function (p, W, H, c, st, S) {
      var x = W - 14, wx = S.dx * 16 + 22;
      p.r(x + 5, 12, 2, 18, c.brass); p.r(x - 2, 14, 16, 1, c.brass); p.r(x - 3, 15, 4, 1, c.brass); p.r(x + 11, 15, 4, 1, c.brass); p.r(x - 4, 16, 6, 1, c.brass, 0.7); p.r(x + 10, 16, 6, 1, c.brass, 0.7);
      p.r(x + 1, 3, 10, 2, c.brass); p.r(x + 5, 3, 2, 12, c.brass);
      p.r(wx, H - 33, 17, 9, c.dark); p.ol(wx, H - 33, 17, 9, c.brass); p.txt("523", wx + 3, H - 31, c.jade, 1, 1);
      p.r(0, H - 8, W, 8, c.ink); p.r(0, H - 8, W, 1, c.brass);
    },
    anim: function (p, W, H, c, t, st) {
      var R = 28, f = still() ? 1 : (Math.sin((t || 0) * 7) > 0.95 ? 0.7 : 1), s = p.s;
      p.txt("BARFIX", 17, R + 1, LIT.amber, 2, 1);
      if (st.lit) { glowAt(p.ctx, p.ox + 40 * s, p.oy + (R + 6) * s, 30 * s, LIT.amber, 0.22 * f); }
    },
    lights: function (S, W, H) { return winLights(S, W, H, LIT.amber); } });

  /* Lobster Lab: a seafood shack with a lobster on the roof */
  addShop({ key: "LobsterLab", name: "Lobster Lab", w: 6, h: 5, R: 28, dx: 2, cat: "kitchen", winW: 22, doorCol: "#1E5A8C",
    wall: ["clap", "white", "limeD"], view: viewGreens, trim: "blue",
    roof: function (p, W, R, c) {
      var i, cx = W >> 1;
      p.r(0, 0, W, R, c.silver); for (i = 0; i < W; i += 4) { p.r(i, 0, 1, R, c.silverD, 0.7); p.r(i + 1, 0, 1, R, c.white, 0.3); } p.r(0, R - 5, W, 5, c.slate); p.r(0, R - 5, W, 1, c.silver); p.r(0, R - 1, W, 1, "#000000", 0.25);
      p.r(cx - 8, 2, 1, 7, c.dred); p.r(cx + 7, 2, 1, 7, c.dred); p.px(cx - 9, 1, c.dred); p.px(cx + 8, 1, c.dred);
      p.ell(cx - 13, 7, 4, 3, c.red); p.ell(cx + 13, 7, 4, 3, c.red); p.r(cx - 12, 6, 3, 2, c.dred, 0.0); p.r(cx - 16, 3, 2, 3, c.red); p.r(cx - 12, 3, 2, 3, c.red); p.r(cx + 11, 3, 2, 3, c.red); p.r(cx + 15, 3, 2, 3, c.red);
      p.r(cx - 10, 9, 5, 2, c.red); p.r(cx + 6, 9, 5, 2, c.red); p.r(cx - 7, 9, 2, 3, c.dred); p.r(cx + 6, 9, 2, 3, c.dred);
      p.ell(cx, 11, 6, 5, c.red); p.ell(cx - 1, 9, 3, 2, c.coralL); p.r(cx - 3, 8, 1, 1, c.white); p.r(cx + 2, 8, 1, 1, c.white); p.r(cx, 14, 1, 2, c.dred, 0.0);
      p.ell(cx, 18, 4, 2, c.red); p.ell(cx, 21, 3, 2, c.dred); p.r(cx - 4, 22, 3, 2, c.red); p.r(cx + 2, 22, 3, 2, c.red); p.r(cx - 1, 22, 2, 3, c.red);
      p.r(cx - 6, 14, 1, 2, c.dred); p.r(cx + 6, 14, 1, 2, c.dred); p.r(cx - 7, 17, 1, 2, c.dred); p.r(cx + 7, 17, 1, 2, c.dred);
    },
    sign: function (p, W, R, c) { plate(p, 3, R + 1, W - 6, 11, c.cream, c.blue, c); fit(p, "LOBSTER LAB", W >> 1, R + 4, W - 8, c.blue, 2); },
    awning: { a: "orange", b: "white", mode: "stripe", y: 13, h: 8 },
    extra: function (p, W, H, c, st, S) {
      var x = W - 24, i, bx = S.dx * 16 + 20;
      for (i = 0; i < 2; i++) { p.r(x, H - 20 + i * 8, 14, 8, c.lwood); p.ol(x, H - 20 + i * 8, 14, 8, c.dwood); p.r(x + 4, H - 20 + i * 8, 1, 8, c.dwood); p.r(x + 9, H - 20 + i * 8, 1, 8, c.dwood); }
      p.ell(bx + 2, H - 28, 3, 3, c.red); p.ell(bx + 2, H - 28, 1, 1, c.white); p.r(bx + 2, H - 36, 1, 5, c.cream); p.ell(bx + 9, H - 25, 3, 3, c.white); p.r(bx + 7, H - 26, 5, 1, c.red); p.r(bx + 9, H - 33, 1, 5, c.cream);
      p.r(0, H - 8, W, 8, c.blue); p.r(0, H - 8, W, 1, c.blueD);
    },
    lights: function (S, W, H) { return winLights(S, W, H); } });

  /* Cosmos: a burger joint, orange red cream, a burger on the roof */
  addShop({ key: "Cosmos", name: "Cosmos Burger", w: 5, h: 5, R: 28, dx: 2, cat: "kitchen", winW: 22, doorCol: "#C8402B",
    wall: ["plain", "cream", "stuccoD"], view: viewFood, trim: "red",
    roof: function (p, W, R, c) {
      var cx = W >> 1, i;
      roofFlat(p, W, R, c.red, c.coralL, c.dred, c);
      p.ell(cx, 7, 12, 5, c.coralL); p.ell(cx, 6, 12, 4, c.orange); p.ell(cx - 3, 4, 5, 2, c.coralL); for (i = 0; i < 6; i++) { p.px(cx - 8 + i * 3, 5 + (i % 2), c.cream); }
      p.r(cx - 12, 12, 24, 2, c.plant); p.r(cx - 12, 14, 24, 2, c.gold); p.r(cx - 12, 16, 24, 3, c.dwood); p.ell(cx, 20, 12, 3, c.coralL); p.ell(cx, 21, 12, 2, c.orange);
      p.r(cx - 12, 12, 24, 1, c.palmL);
    },
    sign: function (p, W, R, c) {
      plate(p, 3, R + 1, W - 6, 11, c.fy, c.red, c); fit(p, "COSMOS BURGER", W >> 1, R + 4, W - 12, c.red, 1); star(p, 8, R + 6, c.orange); star(p, W - 9, R + 6, c.orange);
    },
    awning: { a: "red", b: "cream", mode: "stripe", y: 13, h: 8 },
    extra: function (p, W, H, c) { star(p, 8, H - 14, c.gold); star(p, W - 9, H - 14, c.gold); star(p, 5, H - 22, c.orange); p.r(0, H - 8, W, 8, c.red); p.r(0, H - 8, W, 1, c.cream); var i; for (i = 0; i < W; i += 8) { p.r(i, H - 7, 4, 7, c.dred, 0.6); } },
    lights: function (S, W, H) { var l = winLights(S, W, H); l.push({ x: W >> 1, y: 10, r: 2.6, color: LIT.orange, a: 0.2 }); return l; } });

  /* Carlos Almaraz: a small gallery with a fire palette mural */
  addShop({ key: "CarlosAlmaraz", name: "Carlos Almaraz", w: 5, h: 5, R: 28, dx: 2, cat: "gallery", winW: 24, doorCol: "#26272B",
    wall: ["plain", "white", "stuccoD"], view: viewGallery, trim: "graphite",
    roof: function (p, W, R, c) { p.r(0, 0, W, R, c.stucco); p.r(0, 0, W, 3, c.white); p.r(0, R - 6, W, 6, c.stuccoD); p.r(0, R - 6, W, 1, c.white); p.r(0, R - 1, W, 1, "#000000", 0.2); speck(p, 2, 4, W - 4, R - 12, c.stuccoD, 14, 430); p.r(W - 22, 5, 14, 8, c.glass, 0.8); p.ol(W - 22, 5, 14, 8, c.stuccoD); },
    sign: function (p, W, R, c) { p.r(0, R, W, 12, c.stucco); plate(p, 10, R + 2, W - 20, 8, c.graphite, c.ol, c); fit(p, "CARLOS ALMARAZ", W >> 1, R + 4, W - 24, c.cream, 1); },
    awning: null,
    extra: function (p, W, H, c, st, S) {
      var x = S.dx * 16 + 19, mw = W - x - 3, my = 41, mh = H - my - 12, i, j, hh;
      p.r(x, my, mw, mh, c.djade); p.ol(x - 1, my - 1, mw + 2, mh + 2, c.ol);
      for (i = 0; i < mw; i++) { hh = Math.round(4 + Math.abs(Math.sin(i * 0.7)) * (mh * 0.6)); for (j = 0; j < hh; j++) { p.px(x + i, my + mh - 1 - j, j > hh * 0.7 ? c.gold : (j > hh * 0.35 ? c.orange : c.red)); } }
      p.r(x + 5, my + 2, 2, mh - 4, c.graphite); p.ell(x + 6, my + 3, 4, 2, c.graphite); p.px(x + 2, my + 5, c.gold); p.px(x + mw - 4, my + 3, c.gold);
      p.r(0, H - 8, W, 8, c.stuccoD); p.r(0, H - 8, W, 1, c.white);
      p.r(S.dx * 16 - 10, 38, 3, 2, c.silver); p.r(S.dx * 16 + 23, 38, 3, 2, c.silver);
    },
    lights: function (S, W, H) { return winLights(S, W, H, LIT.amber); } });

  /* K13 HQ: the studio building with the K13 neon */
  addShop({ key: "K13HQ", name: "K13 HQ, San Diego", w: 8, h: 6, R: 40, dx: 3, cat: "office", winW: 30, doorCol: "#EA5E14",
    wall: ["panel", "graphite", "ink"], view: viewTables, trim: "orange",
    roof: function (p, W, R, c) {
      roofFlat(p, W, R, c.ink, c.orange, c.graphite, c); p.r(10, 4, W - 20, 26, c.dark); p.ol(10, 4, W - 20, 26, c.orange); p.ol(12, 6, W - 24, 22, c.steel);
      p.txt("K13", 42, 7, c.slate, 4, 1);
    },
    sign: function (p, W, R, c) { p.r(0, R, W, 12, c.graphite); p.r(0, R, W, 1, c.orange); fit(p, "K13 SOFTWARE STUDIO", W >> 1, R + 3, W - 12, c.cream, 1); p.r(0, R + 11, W, 1, c.orange, 0.6); },
    awning: { a: "orange", b: "cream", mode: "stripe", y: 14, h: 9 },
    extra: function (p, W, H, c, st, S) { var x = S.dx * 16; planter(p, c, 4, H - 16, 14, c.plant); planter(p, c, W - 18, H - 16, 14, c.plant); p.r(x - 2, H - 3, 20, 3, c.orange); p.r(0, H - 9, W, 9, c.steel); p.r(0, H - 9, W, 1, c.orange); },
    anim: function (p, W, H, c, t, st) {
      var f = still() ? 1 : (Math.sin((t || 0) * 9) > 0.96 ? 0.6 : 1), s = p.s;
      p.txt("K13", 42, 7, LIT.orange, 4, 1);
      if (st.lit) { glowAt(p.ctx, p.ox + 56 * s, p.oy + 18 * s, 44 * s, LIT.orange, 0.3 * f); } else { p.r(36, 8, 44, 20, LIT.orange, 0.0); }
    },
    lights: function (S, W, H) { var l = winLights(S, W, H, LIT.gold); l.push({ x: W >> 1, y: 18, r: 4, color: LIT.orange, a: 0.3 }); return l; } });

  var SHOP_ALIASES = { "tigerhospitality": "TigerHospitality_Website_01", "tigerhospitality-website-01": "TigerHospitality_Website_01", "tiger": "TigerHospitality_Website_01", "thg": "TigerHospitality_Website_01",
    "lavida": "LaVida", "la-vida": "LaVida", "miramar": "Miramar", "cengo": "CENGO", "station8": "STATION8", "globalfork": "GlobalFork", "global-fork": "GlobalFork", "eggout": "EggOut", "egg-out": "EggOut",
    "trustmebro": "TrustMeBro", "baa": "baa_atelier", "baa-atelier": "baa_atelier", "baaatelier": "baa_atelier", "barfix": "BarFix", "lobsterlab": "LobsterLab", "lobster-lab": "LobsterLab",
    "cosmos": "Cosmos", "carlosalmaraz": "CarlosAlmaraz", "carlos": "CarlosAlmaraz", "hq": "K13HQ", "k13hq": "K13HQ", "k13-hq": "K13HQ", "k13": "K13HQ" };
  function shopKey(key) {
    var k = String(key || ""), n;
    if (SHOPS[k]) { return k; }
    n = k.toLowerCase().replace(/[\s_]+/g, "-");
    if (SHOP_ALIASES[n]) { return SHOP_ALIASES[n]; }
    n = n.replace(/-/g, "");
    return SHOP_ALIASES[n] || null;
  }
  /* a plain storefront for any new public project the data file adds before it gets its own art */
  var GENERIC = { key: "generic", name: "Shop", w: 5, h: 5, R: 28, dx: 2, cat: "office", winW: 22, doorCol: "#EA5E14",
    wall: ["plain", "stucco", "stuccoD"], view: viewTables, trim: "graphite",
    roof: function (p, W, R, c) { roofFlat(p, W, R, c.graphite, c.orange, c.ink, c); },
    sign: function (p, W, R, c, st) { plate(p, 3, R + 1, W - 6, 11, c.graphite, c.orange, c); fit(p, st.label, W >> 1, R + 4, W - 10, c.cream, 2); },
    awning: { a: "orange", b: "cream", mode: "stripe", y: 13, h: 8 },
    extra: function (p, W, H, c) { planter(p, c, 3, H - 16, 12, c.plant); planter(p, c, W - 15, H - 16, 12, c.plant); },
    lights: function (S, W, H) { return winLights(S, W, H); } };

  function shopSpec(key) { var k = shopKey(key); return k ? SHOPS[k] : GENERIC; }
  function labelOf(key) { return String(key || "SHOP").replace(/[_\-]+/g, " ").replace(/[a-z]([A-Z])/g, function (m) { return m.charAt(0) + " " + m.charAt(1); }).toUpperCase().slice(0, 16); }

  function colorOf(c, v) { return c[v] || v; }

  function shopDraw(p, W, H, c, S, st) {
    var R = S.R, x0 = 3, dx16 = S.dx * 16, wy = R + (S.awning ? 22 : 16), wh = (H - 10) - wy, w = S.wall, aw = S.awning, i;
    wallFill(p, 0, R, W, H - R, w[0], colorOf(c, w[1]), colorOf(c, w[2]), c);
    p.r(0, R, W, 1, "#000000", 0.15);
    windowsRow(p, c, S, st, x0, dx16 - 3, wy, wh);
    windowsRow(p, c, S, st, dx16 + 19, W - 3, wy, wh);
    S.roof(p, W, R, c, st);
    if (st.state !== "construction") { S.sign(p, W, R, c, st, S); }
    if (S.extra) { S.extra(p, W, H, c, st, S); }
    /* extra may paint the skirt over windows' lower edge; redraw door and awning on top */
    doorDraw(p, c, S, st, dx16, H);
    if (aw && st.state !== "construction") { awning(p, 3, R + aw.y, W - 6, aw.h, colorOf(c, aw.a), colorOf(c, aw.b), aw.mode, c); }
    p.r(0, H - 2, W, 2, "#000000", 0.28);
    p.r(0, R + 1, 1, H - R - 1, "#000000", 0.12); p.r(W - 1, R + 1, 1, H - R - 1, "#000000", 0.18);
    if (st.state === "live" || st.state === "new") { if (S.key !== "CENGO") { openSign(p, c, dx16 + 1, H - 22); } }
    if (st.state === "new") { ribbon(p, c, dx16, H); }
    if (st.state === "construction") { construct(p, W, H, c, S); }
  }
  function ribbon(p, c, x, H) {
    var y = H - 14;
    p.r(x - 3, y, 22, 3, c.red); p.r(x - 3, y, 22, 1, c.coralL); p.r(x - 3, y + 2, 22, 1, c.dred);
    p.r(x + 4, y - 3, 3, 3, c.red); p.r(x + 9, y - 3, 3, 3, c.red); p.r(x + 7, y - 1, 2, 4, c.gold); p.r(x + 3, y + 3, 2, 5, c.red); p.r(x + 11, y + 3, 2, 5, c.red); p.px(x + 3, y + 7, c.dred);
  }
  function construct(p, W, H, c, S) {
    var R = S.R, dx16 = S.dx * 16, x, y, lv, i, bx;
    p.r(0, R, W, H - R, c.rock, 0.3);
    /* tarp over the sign band */
    p.r(3, R, W - 6, 13, c.slate); p.r(3, R, W - 6, 1, c.silver, 0.5); for (i = 6; i < W - 6; i += 12) { p.r(i, R + 1, 1, 11, c.steel, 0.7); p.px(i, R + 6, c.silver); }
    p.r(3, R + 12, W - 6, 1, c.graphite, 0.6);
    for (x = 2; x < W - 1; x += 18) {
      if (x > dx16 - 4 && x < dx16 + 20) { continue; }
      p.r(x, R + 12, 2, H - R - 14, c.silverD); p.r(x, R + 12, 1, H - R - 14, c.silver);
    }
    for (lv = 0; lv < 2; lv++) {
      y = R + 22 + lv * 20;
      for (x = 2; x < W - 18; x += 18) {
        if (x + 18 > dx16 - 4 && x < dx16 + 20) { continue; }
        p.r(x, y, 20, 3, c.lwood); p.r(x, y, 20, 1, c.wood); p.r(x, y + 2, 20, 1, c.dwood);
        for (i = 0; i < 16; i++) { p.px(x + 2 + i, y - 1 - Math.round(i * 16 / 16 * 0.9) + 0, c.silverD, 0.0); }
        for (i = 0; i < 13; i++) { p.px(x + 2 + i, y + 3 + i, c.silverD, 0.9); }
      }
    }
    bx = Math.max(3, dx16 - 30);
    p.r(bx + 14, H - 24, 2, 24, c.silverD);
    p.r(bx - 2, H - 33, 34, 18, c.graphite); p.ol(bx - 2, H - 33, 34, 18, c.orange);
    p.txt("COMING", bx + 5, H - 30, c.orange, 1, 1); p.txt("SOON", bx + 9, H - 23, c.cream, 1, 1); p.r(bx + 3, H - 17, 24, 1, c.gold, 0.8);
    p.r(dx16 + 20, H - 12, 8, 2, c.graphite); p.r(dx16 + 21, H - 17, 6, 5, c.orange); p.r(dx16 + 22, H - 15, 4, 1, c.white); p.r(dx16 + 20, H - 18, 2, 2, c.orange, 0.0);
    p.r(W - 20, H - 12, 8, 2, c.graphite); p.r(W - 19, H - 17, 6, 5, c.orange); p.r(W - 18, H - 15, 4, 1, c.white);
  }

  function modeFlags(light, state) {
    var mode = modeOf(light);
    return { mode: mode, lit: lampsOn(mode) && state !== "construction", state: state };
  }
  function normState(s) { return (s === "new" || s === "construction") ? s : "live"; }

  function storefront(ctx, key, state, px, py, s, t, light) {
    var S = shopSpec(key), stt = normState(state), fl = modeFlags(light, stt), W = S.w * TS, H = S.h * TS, c = pal(fl.mode), cv, tt = still() ? STILL_T : (t || 0), lights, i, L, flag;
    fl.label = S === GENERIC ? labelOf(key) : S.name.toUpperCase();
    cv = sprite("s:" + S.key + (S === GENERIC ? ":" + fl.label : "") + ":" + stt + ":" + fl.mode, W, H, function (p) { shopDraw(p, W, H, c, S, fl); });
    blit(ctx, cv, px, py, s);
    var pp = mkP(ctx, px, py, s);
    if (stt !== "construction") {
      if (S.anim) { S.anim(pp, W, H, c, tt, fl, S); }
      if (S.key === "Miramar") { marqueeBulbs(pp, c, S, H, tt, fl); }
      if (S.key === "GlobalFork" && fl.lit) { stringLights(pp, W, 40, tt); }
      if (S.key !== "CENGO" && fl.lit) { pp.txt("OPEN", S.dx * 16 + 1, H - 21, LIT.jade, 1, 1); }
      if (S.key !== "CENGO" && stt !== "construction" && fl.lit) { glowAt(ctx, px + (S.dx * 16 + 8) * s, py + (H - 36) * s, 9 * s, LIT.jade, 0.25); }
    }
    if (stt === "new") {
      var fx = S.flagX ? W - S.flagX : W - 12;
      pp.r(fx, S.R - 20, 1, 20, c.silver); pp.px(fx, S.R - 21, c.gold);
      newFlag(pp, fx + 1, S.R - 20, tt, c);
    }
    if (fl.lit) {
      lights = S.lights ? S.lights(S, W, H) : [];
      for (i = 0; i < lights.length; i++) { L = lights[i]; glowAt(ctx, px + L.x * s, py + L.y * s, L.r * TS * s, L.color, (L.a === undefined ? 0.22 : L.a) * (fl.mode === "dusk" ? 0.7 : 1)); }
    }
  }
  function marqueeBulbs(p, c, S, H, t, fl) {
    var cx = (S.dx * 16) + 8, x = cx - 33, R = S.R, i, n = 0, on, ph = still() ? 0 : Math.floor((t || 0) * 5), col;
    for (i = 0; i < 64; i += 4) {
      on = ((n + ph) % 3) !== 0; col = on ? (fl.lit ? LIT.gold : "#FFF0B8") : c.brass;
      p.r(x + i, R + 4, 2, 2, col); p.r(x + i, R + 18, 2, 2, col); n++;
    }
    p.r(x - 1, R + 8, 2, 2, (ph % 2) ? LIT.gold : c.brass); p.r(x - 1, R + 14, 2, 2, (ph % 2) ? c.brass : LIT.gold); p.r(x + 63, R + 8, 2, 2, (ph % 2) ? LIT.gold : c.brass); p.r(x + 63, R + 14, 2, 2, (ph % 2) ? c.brass : LIT.gold);
  }
  function stringLights(p, W, y, t) {
    var i, ph = still() ? 0 : Math.floor((t || 0) * 2);
    for (i = 3; i < W - 3; i += 5) { p.r(i, y + Math.round(Math.sin(i * 0.4) * 1.2) + 1, 2, 2, ((i / 5 | 0) + ph) % 2 ? LIT.gold : LIT.cream); }
  }
  function newFlag(p, x, y, t, c) {
    var i, j, wv;
    for (i = 0; i < 15; i++) {
      wv = still() ? 0 : Math.round(Math.sin((t || 0) * 4 + i * 0.5) * (i > 3 ? 1 : 0));
      for (j = 0; j < 9; j++) { if (j - Math.floor(i * 0.25) >= 0 && j + Math.floor(i * 0.25) < 9) { p.px(x + i, y + j + wv, j === 0 || j === 8 ? c.dorange : c.orange); } }
    }
    p.txt("NEW", x + 1, y + 2, c.cream, 1, 0);
  }
  function shopInfo(key) {
    var S = shopSpec(key);
    return { w: S.w, h: S.h, layer: "object", kind: "storefront", key: S === GENERIC ? String(key) : S.key, name: S === GENERIC ? labelOf(key) : S.name, category: S.cat, door: { dx: S.dx, dy: S.h - 1 }, glow: null };
  }
  function shopLights(key, state, light) {
    var S = shopSpec(key), out = [], L, i, ls = S.lights ? S.lights(S, S.w * TS, S.h * TS) : [];
    if (normState(state) === "construction") { return []; }
    for (i = 0; i < ls.length; i++) { L = ls[i]; out.push({ x: L.x / TS, y: L.y / TS, r: L.r, color: L.color }); }
    return out;
  }

  /* =====================================================================================
     INTERIOR OBJECTS
     ===================================================================================== */
  var TONES = { wood: ["#8A5A3B", "#A97650", "#5E3B26"], steel: ["#B9BEC8", "#E3E6EC", "#8E939D"], dark: ["#3E2A1F", "#5E3B26", "#2B1D16"], green: ["#2F6F65", "#4F9E92", "#1F4F48"],
    cream: ["#E9D8B4", "#F6EEDC", "#C9B88E"], red: ["#C8402B", "#E86A4E", "#9A2F20"], orange: ["#EA5E14", "#FF8A3D", "#B94612"], olive: ["#8C9A3A", "#A5B452", "#6E7B2A"], blue: ["#2E6FA8", "#5C94C4", "#245A89"], ink: ["#2E3035", "#5D5F65", "#1F2023"] };
  function tone(c, name) { var t = TONES[name] || TONES.wood; return { m: mixPal(c, t[0]), h: mixPal(c, t[1]), d: mixPal(c, t[2]) }; }
  /* tones are written in day colours; carry the current light onto them */
  var curMode = "day";
  function mixPal(c, hex) {
    if (curMode === "night") { return dim(hex, NF); }
    if (curMode === "dusk") { return dim(mix(hex, "#F2A15A", 0.18), [0.92, 0.88, 0.88]); }
    if (curMode === "indoor" || curMode === "indoor-night") { return mix(hex, "#FFD9A8", 0.07); }
    if (curMode === "dawn") { return dim(mix(hex, "#F6C9A0", 0.16), [0.96, 0.94, 0.94]); }
    return hex;
  }

  function counterDraw(p, W, H, c, o) {
    var t = tone(c, o.tone || "wood"), i, n = Math.floor(W / 16), sd = o.tone === "dark";
    p.r(1, H - 3, W - 2, 3, "#000000", 0.22);
    p.r(0, 10, W, H - 13, t.m); p.r(0, 10, W, 1, t.h); for (i = 16; i < W; i += 16) { p.r(i, 12, 1, H - 17, t.d, 0.6); p.r(i + 1, 12, 1, H - 17, t.h, 0.25); }
    p.r(0, H - 5, W, 2, t.d);
    p.r(0, 2, W, 9, t.h); p.r(0, 2, W, 1, mix(t.h, "#FFFFFF", 0.4)); p.r(0, 10, W, 1, t.d);
    if (sd) { p.r(1, H - 12, W - 2, 2, c.brass); p.r(1, H - 12, W - 2, 1, "#FFE9A0", 0.5); for (i = 10; i < W - 10; i += 18) { p.r(i, 0, 2, 4, c.silver); p.r(i - 1, 0, 4, 1, c.silverD); p.r(i, 4, 2, 2, c.gold); } }
    for (i = 0; i < n; i++) {
      var k = Math.floor(hash(i, W, 510) * 4), x = i * 16 + 3;
      if (sd && i % 2) { continue; }
      if (k === 0) { p.r(x, 0, 8, 5, c.graphite); p.r(x + 1, 1, 6, 2, LIT.jade, 0.8); p.r(x, 5, 8, 1, c.steel); }
      else if (k === 1) { p.ell(x + 4, 5, 4, 2, c.white); p.r(x + 2, 3, 3, 1, c.coralL); p.r(x + 5, 3, 2, 1, c.palmL); }
      else if (k === 2) { p.r(x + 1, 2, 4, 4, c.cream); p.r(x + 1, 2, 4, 1, c.white); p.px(x + 5, 3, c.cream); p.r(x + 6, 4, 3, 2, c.brass); }
      else { p.ell(x + 3, 4, 2, 1, c.brass); p.r(x + 2, 2, 3, 2, c.brass); p.px(x + 3, 1, "#FFE9A0"); }
    }
  }
  function tableLongDraw(p, W, H, c) {
    var i;
    p.r(2, H - 3, W - 4, 3, "#000000", 0.2);
    p.r(1, 6, W - 2, H - 12, c.lwood); p.r(1, 6, W - 2, 1, c.cream, 0.5); p.r(1, H - 7, W - 2, 3, c.dwood);
    for (i = 0; i < W - 2; i += 12) { p.r(1 + i, 8, 1, H - 17, c.wood, 0.5); }
    p.r(3, H - 5, 2, 4, c.dwood); p.r(W - 5, H - 5, 2, 4, c.dwood);
    for (i = 6; i < W - 10; i += 14) { p.ell(i + 4, 14, 3, 2, c.white); p.px(i + 3, 13, c.coralL); p.px(i + 5, 13, c.palmL); p.r(i + 9, 12, 2, 3, c.cream); }
  }
  function tableDraw(p, W, H, c, o) {
    var cl = [c.red, c.jade, c.orange, c.blue][((o.x || 0) + (o.y || 0)) % 4];
    p.ell(16, H - 6, 13, 4, "#000000", 0.2);
    p.r(2, 15, 4, 8, c.dwood); p.r(26, 15, 4, 8, c.dwood); p.ell(3, 14, 2, 3, c.wood); p.ell(29, 14, 2, 3, c.wood);
    p.r(15, 17, 2, 9, c.graphite); p.ell(16, 12, 11, 7, c.lwood); p.ell(16, 11, 10, 6, cl); p.ell(16, 11, 7, 4, c.cream); p.ell(16, 10, 3, 2, c.white); p.px(14, 10, c.coralL); p.px(18, 10, c.palmL);
  }
  function stoolDraw(p, W, H, c, o) {
    var cl = [c.red, c.orange, c.jade, c.blue][((o.x || 0) * 3 + (o.y || 0)) % 4];
    p.ell(8, 14, 5, 2, "#000000", 0.22); p.r(5, 8, 1, 6, c.graphite); p.r(10, 8, 1, 6, c.graphite); p.r(4, 12, 8, 1, c.steel);
    p.ell(8, 7, 5, 3, c.graphite); p.ell(8, 6, 5, 3, cl); p.ell(7, 5, 2, 1, mix(cl, "#FFFFFF", 0.35));
  }
  function stallDraw(p, W, H, c, o) {
    var t = tone(c, o.tone || "red"), i, sw = 6;
    p.r(1, H - 3, W - 2, 3, "#000000", 0.22);
    p.r(2, 9, W - 4, 12, c.dwood, 0.9); for (i = 0; i < 3; i++) { p.r(4, 12 + 0, W - 8, 1, c.lwood, 0.0); }
    p.r(4, 14, W - 8, 1, c.lwood); p.r(4, 10, W - 8, 1, c.lwood);
    for (i = 0; i < W - 12; i += 6) { p.r(6 + i, 11, 3, 3, [c.coralL, c.palmL, c.yolk, c.cream][(i / 6 | 0) % 4]); p.r(6 + i, 15, 3, 4, [c.glass, c.gold, c.red][(i / 6 | 0) % 3]); }
    for (i = 0; i < W; i++) { p.r(i, 0, 1, 7 + ((i % sw === 0 || i % sw === sw - 1) ? 0 : 1), (Math.floor(i / sw) % 2 === 0) ? t.m : c.cream); }
    p.r(0, 0, W, 1, "#FFFFFF", 0.3); p.r(1, 8, W - 2, 2, "#000000", 0.18);
    p.r(1, 21, W - 2, 8, c.wood); p.r(1, 21, W - 2, 2, c.lwood); p.r(1, 28, W - 2, 1, c.dwood);
    p.ell(10, 21, 4, 2, c.white); p.px(9, 20, c.coralL); p.r(W - 14, 19, 3, 3, c.cream); p.r(W - 9, 18, 4, 4, c.graphite); p.r(W - 8, 19, 2, 1, LIT.jade, 0.8);
  }
  function shelfDraw(p, W, H, c, o) {
    var i, j, st = o.stock || "jars", cols = [c.gold, c.orange, c.jade, c.cream, c.red, c.palmL];
    p.r(0, 0, W, H, c.dwood); p.r(1, 1, W - 2, H - 2, c.ol); p.r(0, H - 3, W, 3, "#000000", 0.2);
    for (j = 0; j < 2; j++) {
      p.r(1, 14 + j * 14, W - 2, 2, c.lwood); p.r(1, 14 + j * 14, W - 2, 1, c.cream, 0.4);
      for (i = 0; i < W - 4; i += 5) {
        if (st === "books") { p.r(2 + i, 3 + j * 14, 4, 11, cols[(i + j) % 6]); p.r(2 + i, 3 + j * 14, 1, 11, "#FFFFFF", 0.3); }
        else if (st === "produce") { p.ell(4 + i, 11 + j * 14, 2, 2, cols[(i + j * 2) % 6]); p.px(4 + i, 9 + j * 14, c.palmL); }
        else if (st === "bottles") { p.r(3 + i, 6 + j * 14, 3, 8, cols[(i + j) % 6]); p.r(4 + i, 3 + j * 14, 1, 3, cols[(i + j) % 6]); p.px(3 + i, 7 + j * 14, "#FFFFFF", 0.0); }
        else { p.r(2 + i, 7 + j * 14, 4, 7, c.glass); p.r(2 + i, 6 + j * 14, 4, 2, cols[(i + j) % 6]); }
      }
    }
  }
  function cratesDraw(p, W, H, c) {
    var i;
    p.ell(8, 14, 7, 2, "#000000", 0.2); p.r(2, 7, 12, 7, c.lwood); p.ol(2, 7, 12, 7, c.dwood); p.r(2, 10, 12, 1, c.dwood);
    for (i = 0; i < 4; i++) { p.ell(4 + i * 3, 6, 2, 2, [c.fo, c.palmL, c.fr, c.fo][i]); }
    p.px(5, 4, c.palmL); p.px(11, 4, c.palmD);
  }
  function cartDraw(p, W, H, c) {
    var i;
    p.ell(16, 14, 14, 2, "#000000", 0.2); p.r(3, 8, 26, 5, c.wood); p.r(3, 8, 26, 1, c.lwood); p.r(2, 2, 28, 2, c.orange); for (i = 2; i < 30; i += 6) { p.r(i + 3, 2, 3, 2, c.cream); }
    p.r(4, 3, 1, 6, c.dwood); p.r(27, 3, 1, 6, c.dwood);
    for (i = 0; i < 6; i++) { p.ell(7 + i * 4, 7, 2, 2, [c.fo, c.palmL, c.fr, c.yolk, c.palmL, c.fo][i]); }
    p.ell(7, 14, 2, 2, c.graphite); p.ell(25, 14, 2, 2, c.graphite);
  }
  function stoveDraw(p, W, H, c) {
    var i;
    p.r(1, H - 3, W - 2, 3, "#000000", 0.22);
    p.r(1, 8, W - 2, H - 11, c.silver); p.r(1, 8, W - 2, 1, c.white); p.r(1, 8, W - 2, 10, c.silverD); p.r(1, 8, W - 2, 1, c.white);
    for (i = 0; i < 4; i++) { p.ell(9 + (i % 2) * 14, 11 + (i >> 1) * 4, 4, 2, c.graphite); p.ell(9 + (i % 2) * 14, 11 + (i >> 1) * 4, 2, 1, c.red, 0.9); }
    p.r(3, 19, W - 6, 9, c.steel); p.r(5, 21, W - 10, 5, c.dark); p.r(5, 21, W - 10, 1, c.slate, 0.6); p.r(4, 18, W - 8, 1, c.silver);
    p.r(7, 3, 8, 6, c.graphite); p.r(6, 3, 10, 1, c.steel); p.r(15, 5, 4, 1, c.steel);
  }
  function stoveAnim(p, W, H, c, o, t) { var f = still() ? 0 : Math.floor((t || 0) * 3) % 3; p.px(10 + f, 1, c.white, 0.7); p.px(11 - f, 0, c.white, 0.5); p.px(10, -1 + f, c.white, 0.35); }
  function prepDraw(p, W, H, c) {
    p.r(1, H - 3, W - 2, 3, "#000000", 0.22); p.r(0, 6, W, 6, c.silver); p.r(0, 6, W, 1, c.white); p.r(0, 11, W, 1, c.silverD); p.r(1, 12, W - 2, 3, c.silverD);
    p.r(3, 7, 10, 4, c.lwood); p.r(3, 7, 10, 1, c.cream, 0.6); p.r(5, 8, 2, 2, c.palmG); p.r(8, 8, 3, 2, c.fr); p.r(W - 10, 7, 6, 1, c.silver); p.r(W - 10, 8, 2, 2, c.dwood);
  }
  function fridgeDraw(p, W, H, c) {
    p.r(1, H - 3, W - 2, 3, "#000000", 0.22); p.r(1, 2, 14, H - 5, c.white); p.r(1, 2, 14, 1, c.paper); p.r(1, 2, 1, H - 5, c.paper); p.r(14, 2, 1, H - 5, c.silverD);
    p.r(2, 14, 12, 1, c.silverD); p.r(3, 6, 1, 6, c.silver); p.r(3, 18, 1, 8, c.silver); p.r(6, 5, 2, 2, c.orange); p.r(9, 8, 3, 3, c.cream); p.px(10, 9, c.red);
  }
  function djDraw(p, W, H, c) {
    var i;
    p.r(1, H - 3, W - 2, 3, "#000000", 0.22);
    p.r(0, 12, W, H - 15, c.graphite); p.r(0, 12, W, 1, c.steel); p.r(0, 2, W, 11, c.ink); p.r(0, 2, W, 1, c.slate);
    p.ell(14, 8, 6, 3, c.dark); p.ell(14, 8, 2, 1, c.silver); p.ell(W - 15, 8, 6, 3, c.dark); p.ell(W - 15, 8, 2, 1, c.silver);
    p.r(W / 2 - 6, 4, 12, 7, c.steel); for (i = 0; i < 4; i++) { p.r(W / 2 - 5 + i * 3, 5, 1, 4, c.dark); p.px(W / 2 - 5 + i * 3, 5 + (i % 2) * 2, LIT.jade); }
    p.r(W / 2 - 4, 0, 8, 3, c.silver); p.r(W / 2 - 3, 1, 6, 1, c.dark);
    p.r(3, 22, W - 6, 2, c.dark);
  }
  function djAnim(p, W, H, c, o, t) {
    var i, cols = [LIT.red, LIT.gold, LIT.jade, LIT.orange], f = still() ? 0 : Math.floor((t || 0) * 5);
    for (i = 0; i < Math.floor((W - 8) / 4); i++) { p.r(4 + i * 4, 21, 3, 2, cols[(i + f) % 4]); }
  }
  function speakerDraw(p, W, H, c) {
    p.r(1, H - 3, W - 2, 3, "#000000", 0.22); p.r(2, 2, 12, H - 5, c.dark); p.ol(2, 2, 12, H - 5, c.steel);
    p.ell(8, 11, 4, 4, c.graphite); p.ell(8, 11, 2, 2, c.steel); p.ell(8, 22, 3, 3, c.graphite); p.ell(8, 22, 1, 1, c.steel); p.px(4, 4, c.red);
  }
  function neonDraw(p, W, H, c, o) { p.r(1, 1, W - 2, H - 2, c.dark); p.ol(0, 0, W, H, c.steel); fit(p, o.text || "K13", W >> 1, (H - 10 > 0 ? Math.floor((H - 10) / 2) : 1), W - 6, mix(colorLit(o.color), "#000000", 0.55), 2); }
  function colorLit(n) { return LIT[n] || n || LIT.orange; }
  function neonAnim(p, W, H, c, o, t, mode) {
    var f = still() ? 1 : (Math.sin((t || 0) * 8) > 0.95 ? 0.6 : 1), col = colorLit(o.color), s = p.s;
    fit(p, o.text || "K13", W >> 1, (H - 10 > 0 ? Math.floor((H - 10) / 2) : 1), W - 6, col, 2);
    glowAt(p.ctx, p.ox + (W >> 1) * s, p.oy + (H >> 1) * s, Math.max(W, 24) * s * 0.8, col, 0.2 * f * (lampsOn(mode) ? 1.4 : 0.8));
  }
  function discoDraw(p, W, H, c) {
    var i, j;
    p.r(7, 0, 2, 4, c.steel); p.ell(8, 9, 6, 6, c.silver);
    for (i = -5; i <= 5; i += 2) { for (j = -5; j <= 5; j += 2) { if (i * i + j * j <= 30) { p.px(8 + i, 9 + j, ((i + j) / 2) % 2 ? c.white : c.silverD); } } }
  }
  function discoAnim(p, W, H, c, o, t) {
    var f = still() ? 0 : Math.floor((t || 0) * 4), i, cols = [LIT.white, LIT.gold, LIT.jade, LIT.orange];
    for (i = 0; i < 4; i++) { p.px(2 + ((i * 5 + f * 3) % 13), 3 + ((i * 3 + f) % 9), cols[(i + f) % 4], 0.9); }
  }
  function danceDraw(p, W, H, c) {
    var i, j; p.r(0, 0, W, H, c.dark);
    for (i = 0; i < W; i += 16) { for (j = 0; j < H; j += 16) { p.r(i + 1, j + 1, 14, 14, ((i + j) / 16) % 2 ? c.ink : c.graphite); } }
  }
  function danceAnim(p, W, H, c, o, t, mode) {
    var i, j, cols = [LIT.red, LIT.gold, LIT.jade, LIT.orange], f = still() ? 0 : Math.floor((t || 0) * 2.5);
    for (i = 0; i < W; i += 16) { for (j = 0; j < H; j += 16) { p.r(i + 3, j + 3, 10, 10, cols[((i + j) / 16 + f) % 4], 0.5); p.r(i + 4, j + 4, 4, 2, "#FFFFFF", 0.25); } }
  }
  function officeDeskDraw(p, W, H, c, o) {
    p.r(2, H - 3, W - 4, 3, "#000000", 0.2); p.r(1, 12, W - 2, 12, c.lwood); p.r(1, 12, W - 2, 1, c.cream, 0.5); p.r(1, 23, W - 2, 2, c.dwood); p.r(3, 25, 2, 4, c.dwood); p.r(W - 5, 25, 2, 4, c.dwood);
    p.r(8, 2, 16, 10, c.graphite); p.r(9, 3, 14, 7, c.jade); p.r(9, 3, 14, 1, LIT.jade, 0.6); p.r(10, 5, 8, 1, c.cream, 0.8); p.r(10, 7, 6, 1, c.cream, 0.6); p.r(14, 12, 4, 1, c.steel);
    p.r(8, 16, 14, 3, c.steel); p.r(9, 17, 12, 1, c.slate); p.r(W - 9, 14, 4, 5, c.cream); p.px(W - 4, 16, c.cream); p.r(W - 9, 14, 4, 1, c.brass, 0.0);
  }
  function sofaDraw(p, W, H, c) {
    p.ell(W >> 1, H - 4, W / 2 - 2, 3, "#000000", 0.2); p.r(2, 4, W - 4, 12, c.djade); p.r(2, 4, W - 4, 2, c.jade); p.r(0, 10, 5, 14, c.djade); p.r(W - 5, 10, 5, 14, c.djade); p.r(0, 10, 5, 2, c.jade); p.r(W - 5, 10, 5, 2, c.jade);
    p.r(5, 14, W - 10, 11, c.jade); p.r(5, 14, W - 10, 1, mix(c.jade, "#FFFFFF", 0.3)); p.r(W / 2, 15, 1, 10, c.djade); p.r(6, 12, 8, 6, c.orange); p.r(6, 12, 8, 1, LIT.orange, 0.6); p.r(2, 25, 3, 3, c.dwood); p.r(W - 5, 25, 3, 3, c.dwood);
  }
  function potDraw(p, W, H, c) {
    p.ell(8, H - 3, 6, 2, "#000000", 0.22); p.r(4, 22, 8, 7, c.terra); p.r(3, 21, 10, 2, c.terraL); p.r(4, 28, 8, 1, c.terraD);
    p.ell(8, 14, 6, 7, c.dplant); p.ell(7, 13, 4, 5, c.plant); p.px(6, 10, c.palmL); p.px(10, 14, c.palmL); p.px(4, 17, c.palmD);
  }
  function easelDraw(p, W, H, c) {
    p.ell(8, H - 3, 6, 2, "#000000", 0.2); p.r(3, 6, 1, 24, c.dwood); p.r(12, 6, 1, 24, c.dwood); p.r(7, 12, 1, 18, c.wood); p.r(2, 22, 12, 1, c.wood);
    p.r(2, 3, 12, 14, c.white); p.ol(2, 3, 12, 14, c.dwood); p.r(3, 4, 10, 12, c.djade); p.r(4, 11, 3, 4, c.orange); p.r(7, 8, 3, 7, c.red); p.r(10, 6, 2, 5, c.gold);
  }
  function plinthDraw(p, W, H, c) {
    p.ell(8, H - 3, 6, 2, "#000000", 0.2); p.r(3, 14, 10, 15, c.white); p.r(3, 14, 10, 1, c.paper); p.r(12, 14, 1, 15, c.stuccoD); p.r(2, 13, 12, 2, c.paper);
    p.ell(8, 7, 3, 5, c.orange); p.ell(8, 6, 1, 3, LIT.orange); p.r(5, 11, 6, 2, c.dorange); p.px(10, 4, c.red);
  }
  function paintingDraw(p, W, H, c, o) {
    var art = o.art || "fire", i, j;
    p.r(2, 2, W - 4, H - 4, c.dwood); p.ol(2, 2, W - 4, H - 4, c.ol); p.r(4, 4, W - 8, H - 8, c.gold, 0.0);
    p.r(4, 4, W - 8, H - 8, art === "sea" ? c.ocean : c.djade);
    if (art === "fire") { for (i = 0; i < W - 8; i++) { var hh = 4 + Math.round(Math.abs(Math.sin(i * 0.6)) * (H - 16)); for (j = 0; j < hh; j++) { p.px(4 + i, H - 5 - j, j > hh * 0.7 ? c.gold : (j > hh * 0.35 ? c.orange : c.red)); } } p.r(W / 2 - 1, 6, 2, H - 14, c.graphite); p.ell(W / 2, 6, 4, 2, c.graphite); }
    else if (art === "sea") { for (j = 0; j < H - 8; j += 4) { p.r(4, 4 + j, W - 8, 2, j % 8 ? c.oceanL : c.ocean2, 0.8); } p.ell(W - 10, 10, 3, 3, c.gold); }
    else { p.r(4, 4, W - 8, H - 8, c.stucco); p.r(6, 8, W - 12, 6, c.terra); p.r(W / 2 - 2, 14, 5, H - 22, c.plant); }
  }
  function viewBenchDraw(p, W, H, c) {
    p.ell(W >> 1, H - 3, W / 2 - 2, 2, "#000000", 0.2); p.r(2, 4, W - 4, 7, c.graphite); p.r(2, 4, W - 4, 1, c.steel); p.r(2, 8, W - 4, 1, c.ink); p.r(4, 11, 2, 4, c.steel); p.r(W - 6, 11, 2, 4, c.steel);
  }
  function barBackDraw(p, W, H, c) {
    var i, j, cols = [c.gold, c.orange, c.jade, c.cream, c.red];
    p.r(0, 0, W, H, c.dwood); p.r(1, 1, W - 2, H - 2, c.ol); p.r(3, 3, W - 6, H - 8, c.silver, 0.0);
    for (j = 0; j < 2; j++) { p.r(2, 14 + j * 14, W - 4, 2, c.brass); p.r(2, 14 + j * 14, W - 4, 1, "#FFE9A0", 0.5); for (i = 4; i < W - 8; i += 6) { p.r(i, 5 + j * 14, 3, 9, cols[(i + j) % 5]); p.r(i + 1, 2 + j * 14, 1, 3, cols[(i + j) % 5]); p.px(i, 6 + j * 14, "#FFFFFF", 0.4); } }
  }
  function scaleDraw(p, W, H, c) {
    p.ell(8, H - 3, 6, 2, "#000000", 0.22); p.r(3, 24, 10, 5, c.graphite); p.r(3, 24, 10, 1, c.steel); p.r(4, 25, 8, 2, c.dark); p.txt("523", 4, 25, LIT.jade, 1, 0);
    p.r(7, 14, 2, 10, c.silver); p.ell(8, 12, 6, 2, c.silver); p.ell(8, 11, 6, 2, c.silverD); p.ell(8, 11, 4, 1, c.white); p.r(6, 3, 4, 8, c.cream); p.r(6, 3, 4, 1, c.white); p.r(6, 4, 4, 2, c.glass); p.px(8, 2, c.cream);
  }
  function chalkDraw(p, W, H, c, o) { p.r(0, 0, W, H, c.dwood); p.r(2, 2, W - 4, H - 4, c.djade); p.r(2, 2, W - 4, H - 4, c.dark, 0.35); fit(p, o.text || "TODAY", W >> 1, 3, W - 8, c.cream, 1); p.r(5, H - 7, W - 10, 1, c.cream, 0.6); p.r(5, H - 5, W - 14, 1, c.cream, 0.4); }
  function frameDraw(p, W, H, c) {
    p.r(0, 0, W, H, c.dwood); p.ol(0, 0, W, H, c.ol); p.r(1, 1, W - 2, 1, c.lwood); p.r(3, 3, W - 6, H - 6, c.ink);
    p.r(3, 3, W - 6, 4, c.steel); p.px(5, 5, c.red); p.px(7, 5, c.gold); p.px(9, 5, c.jade); p.r(12, 4, W - 18, 2, c.graphite);
    p.r(5, 9, 14, 2, c.cream, 0.7); p.r(5, 12, 20, 1, c.slate); p.r(5, 14, 17, 1, c.slate); p.r(W - 16, 9, 11, 9, c.orange, 0.85);
  }
  function toyBenchDraw(p, W, H, c) {
    p.r(2, H - 3, W - 4, 3, "#000000", 0.22); p.r(1, 10, W - 2, 14, c.wood); p.r(1, 10, W - 2, 2, c.lwood); p.r(1, 23, W - 2, 2, c.dwood); p.r(3, 25, 3, 4, c.dwood); p.r(W - 6, 25, 3, 4, c.dwood);
    p.r(W - 8, 10, 6, 3, c.red); p.r(W - 8, 7, 2, 3, c.steel); p.r(W - 8, 7, 5, 1, c.steel); p.r(4, 8, 4, 2, c.silver); p.r(5, 6, 2, 2, c.dwood);
    p.ol(10, 7, 12, 8, c.gold); p.r(11, 8, 10, 6, c.ink, 0.5);
  }
  function toyBenchAnim(p, W, H, c, o, t) { var a = still() ? 0.5 : 0.35 + 0.35 * (Math.sin((t || 0) * 3) * 0.5 + 0.5); p.ol(10, 7, 12, 8, LIT.gold); p.r(11, 8, 10, 6, LIT.gold, a * 0.35); }
  function rugDraw(p, W, H, c, o) {
    var t = tone(c, o.tone || "red"), i;
    p.r(0, 0, W, H, t.d); p.r(2, 2, W - 4, H - 4, t.m); p.r(4, 4, W - 8, H - 8, t.h, 0.35);
    for (i = 6; i < W - 6; i += 8) { p.r(i, 6, 3, H - 12, c.cream, 0.18); }
    p.ol(5, 5, W - 10, H - 10, c.cream);
  }
  function intWindowDraw(p, W, H, c, o, v, mode) {
    var y, col;
    p.r(0, 0, W, H, c.dwood); p.r(2, 2, W - 4, H - 8, c.wood);
    for (y = 0; y < H - 12; y++) { col = (mode === "night" || mode === "indoor-night") ? mix("#0E1822", "#1B3340", y / (H - 12)) : mix("#8EC5D6", "#F6C58B", y / (H - 12)); p.r(4, 4 + y, W - 8, 1, col); }
    if (mode === "night" || mode === "indoor-night") { p.px(8, 8, LIT.gold); p.px(W - 10, 7, LIT.cream); } else { p.r(7, 14, 8, 1, c.white, 0.6); p.r(W - 16, 9, 6, 1, c.white, 0.5); }
    p.r(W / 2 - 1, 4, 2, H - 12, c.wood); p.r(4, H / 2 - 4, W - 8, 2, c.wood); p.r(0, H - 6, W, 3, c.lwood); p.r(0, H - 3, W, 1, c.dwood);
    p.ell(7, H - 8, 3, 3, c.plant); p.px(7, H - 12, c.palmL);
  }
  function buntingDraw(p, W, H, c) {
    var i, cols = [c.orange, c.cream, c.jade, c.gold, c.red];
    p.r(0, 2, W, 1, c.dwood, 0.7);
    for (i = 2; i < W - 5; i += 7) { var col = cols[(i / 7 | 0) % 5]; p.r(i, 3, 5, 1, col); p.r(i + 1, 4, 3, 1, col); p.r(i + 2, 5, 1, 1, col); }
  }
  var INT_OBJ = {
    "counter": { w: 4, h: 2, layer: "object", draw: counterDraw },
    "tablelong": { w: 4, h: 2, layer: "object", draw: tableLongDraw },
    "table": { w: 2, h: 2, layer: "object", draw: tableDraw },
    "stool": { w: 1, h: 1, layer: "object", draw: stoolDraw },
    "stall": { w: 3, h: 2, layer: "object", draw: stallDraw },
    "shelf": { w: 2, h: 2, layer: "object", draw: shelfDraw },
    "crates": { w: 1, h: 1, layer: "object", draw: cratesDraw },
    "cart": { w: 2, h: 1, layer: "object", draw: cartDraw },
    "stove": { w: 2, h: 2, layer: "object", draw: stoveDraw, anim: stoveAnim },
    "prep": { w: 2, h: 1, layer: "object", draw: prepDraw },
    "fridge": { w: 1, h: 2, layer: "object", draw: fridgeDraw },
    "djbooth": { w: 4, h: 2, layer: "object", draw: djDraw, anim: djAnim, glow: { color: "#5FD1BE", r: 3, ox: 0.5, oy: 0.4, a: 0.25 } },
    "speaker": { w: 1, h: 2, layer: "object", draw: speakerDraw },
    "neonsign": { w: 3, h: 1, layer: "wall", draw: neonDraw, anim: neonAnim },
    "discoball": { w: 1, h: 1, layer: "wall", draw: discoDraw, anim: discoAnim, glow: { color: "#FFFFFF", r: 2.4, ox: 0.5, oy: 0.6, a: 0.2 } },
    "dancefloor": { w: 6, h: 3, layer: "floor", draw: danceDraw, anim: danceAnim },
    "officedesk": { w: 2, h: 2, layer: "object", draw: officeDeskDraw, glow: { color: "#5FD1BE", r: 1.6, ox: 0.5, oy: 0.3, a: 0.18 } },
    "sofa": { w: 3, h: 2, layer: "object", draw: sofaDraw },
    "pot": { w: 1, h: 2, layer: "object", draw: potDraw },
    "easel": { w: 1, h: 2, layer: "object", draw: easelDraw },
    "plinth": { w: 1, h: 2, layer: "object", draw: plinthDraw },
    "painting": { w: 2, h: 2, layer: "wall", draw: paintingDraw },
    "viewbench": { w: 3, h: 1, layer: "object", draw: viewBenchDraw },
    "barback": { w: 6, h: 2, layer: "wall", draw: barBackDraw, glow: { color: "#FFB347", r: 4, ox: 0.5, oy: 0.5, a: 0.2 } },
    "scale": { w: 1, h: 2, layer: "object", draw: scaleDraw },
    "chalkboard": { w: 2, h: 1, layer: "wall", draw: chalkDraw },
    "frame": { w: 3, h: 2, layer: "wall", draw: frameDraw },
    "toybench": { w: 2, h: 2, layer: "object", draw: toyBenchDraw, anim: toyBenchAnim },
    "rug": { w: 6, h: 3, layer: "floor", draw: rugDraw },
    "intwindow": { w: 2, h: 2, layer: "wall", draw: intWindowDraw },
    "bunting": { w: 6, h: 1, layer: "wall", draw: buntingDraw }
  };
  (function () { var k; for (k in INT_OBJ) { if (INT_OBJ.hasOwnProperty(k)) { OBJ[k] = INT_OBJ[k]; objectNames.push(k); } } })();
  var FRAME_INNER = { dx: 0.2, dy: 0.2, w: 2.6, h: 1.6 };

  /* =====================================================================================
     INTERIORS
     ===================================================================================== */
  var INT_STYLE = {
    foodhall: { w: 16, floor: "floor-brick", floor2: "floor-brick", wall: "wall-green", name: "Food hall" },
    kitchen: { w: 14, floor: "floor-tile", floor2: "floor-green", wall: "wall-green", name: "Kitchen" },
    market: { w: 16, floor: "floor-hall", floor2: "floor-hall", wall: "wall-plain", name: "Market hall" },
    club: { w: 14, floor: "floor-club", floor2: "floor-club", wall: "wall-black", name: "Club" },
    studio: { w: 14, floor: "floor-pale", floor2: "floor-pale", wall: "wall-lime", name: "Studio" },
    gallery: { w: 14, floor: "floor-pale", floor2: "floor-pale", wall: "wall-plain", name: "Gallery" },
    office: { w: 14, floor: "floor-office", floor2: "floor-office", wall: "wall-black", name: "Office" },
    bar: { w: 14, floor: "floor-dark", floor2: "floor-dark", wall: "wall-brick", name: "Bar" }
  };
  var intCategories = ["foodhall", "kitchen", "market", "club", "studio", "gallery", "office", "bar"];
  function wallUp(name) { return name + "-up"; }

  function frameX(cat, cx) { return cat === "club" ? cx + 4 : ((cat === "bar" || cat === "kitchen") ? cx + 3 : cx); }
  function interior(category) {
    var cat = INT_STYLE[category] ? category : "office", S = INT_STYLE[cat], w = S.w, h = 10, rows = [], x, y, row, objs = [], n = 0, dx = (w >> 1) - 1, ex = w - 14, host = null, st;
    for (y = 0; y < h; y++) {
      row = "";
      for (x = 0; x < w; x++) {
        if (y === 0) { row += (x === 0 || x === w - 1) ? "#" : "U"; }
        else if (y === 1) { row += (x === 0 || x === w - 1) ? "#" : "W"; }
        else if (y === h - 1) { row += (x === dx || x === dx + 1) ? "d" : "#"; }
        else if (x === 0 || x === w - 1) { row += "#"; }
        else { row += ((x + y) % 2 === 0 || S.floor === S.floor2) ? "f" : "g"; }
      }
      rows.push(row);
    }
    function O(kind, x0, y0, ow, oh, opt) {
      var o = { id: "int-" + kind + "-" + (++n), kind: kind, x: x0, y: y0, w: ow || OBJ[kind].w, h: oh || OBJ[kind].h, solid: true, layer: OBJ[kind].layer };
      var k; opt = opt || {};
      if (o.layer === "floor" || o.layer === "wall") { o.solid = false; }
      for (k in opt) { if (opt.hasOwnProperty(k)) { o[k] = opt[k]; } }
      objs.push(o); return o;
    }
    var cx = Math.floor(w / 2 - 1.5);
    /* the three slots every interior has */
    O("frame", frameX(cat, cx), 0, 3, 2, { slot: "frame", label: "Look at the live site", inner: FRAME_INNER, solid: false });
    O("toybench", 1, 6, 2, 2, { slot: "toy", label: "Try the toy", solid: true, fh: 1 });
    if (cat !== "club") { O("intwindow", 1, 0, 2, 2, { solid: false, label: "Look outside" }); }
    if (cat === "foodhall") {
      O("stall", 1, 2, 3, 2, { tone: "red", fh: 1 }); O("stall", w - 4, 2, 3, 2, { tone: "green", fh: 1, slot: "host", label: "Talk to the host" }); host = { x: w - 2.5, y: 2.9 };
      O("bunting", 4, 2, w - 8, 1, { solid: false });
      O("tablelong", cx + 0, 4, 4, 2, {}); O("stool", cx, 6, 1, 1); O("stool", cx + 3, 6, 1, 1); O("stool", cx, 3, 1, 1); O("stool", cx + 3, 3, 1, 1);
      O("table", w - 4, 6, 2, 2, {}); O("rug", 4, 7, 5, 2, { tone: "orange" }); O("pot", w - 2, 7, 1, 2, {}); O("pot", 4, 2, 1, 2, {});
    } else if (cat === "kitchen") {
      O("fridge", 3, 1, 1, 2, { fh: 1 }); O("stove", 4, 1, 2, 2, { fh: 1 }); O("prep", 6, 2, 2, 1, {}); O("shelf", 11, 0, 2, 2, { stock: "jars", solid: false, layer: "wall" });
      O("counter", 5, 5, 6, 2, { tone: "green", slot: "host", label: "Talk to the host", fh: 1 }); host = { x: 7.5, y: 5.0 };
      O("table", 11, 3, 2, 2, {}); O("table", 11, 7, 2, 2, {}); O("pot", 1, 3, 1, 2, {}); O("rug", 4, 7, 5, 2, { tone: "olive" }); O("stool", 5, 7, 1, 1); O("stool", 7, 7, 1, 1);
    } else if (cat === "market") {
      O("shelf", 3, 0, 2, 2, { stock: "produce", solid: false, layer: "wall" }); O("shelf", w - 5, 0, 2, 2, { stock: "jars", solid: false, layer: "wall" });
      O("bunting", 4, 2, w - 8, 1, { solid: false });
      O("cart", 4, 4, 2, 1, {}); O("cart", 7, 4, 2, 1, {}); O("crates", 4, 6, 1, 1); O("crates", 5, 6, 1, 1); O("crates", 8, 6, 1, 1);
      O("counter", w - 6, 3, 4, 2, { tone: "olive", slot: "host", label: "Talk to the host", fh: 1 }); host = { x: w - 4, y: 3.0 };
      O("tablelong", 5, 7, 4, 2, {}); O("pot", w - 2, 7, 1, 2, {}); O("rug", 10, 6, 4, 3, { tone: "olive" });
    } else if (cat === "club") {
      O("neonsign", 1, 1, 3, 1, { text: "CENGO", color: "red", solid: false, layer: "wall" });
      O("discoball", cx + 1, 1, 1, 1, { solid: false }); O("djbooth", cx - 0, 2, 4, 2, { slot: "host", label: "Talk to the DJ", fh: 1 }); host = { x: cx + 2, y: 2.9 };
      O("speaker", 1, 3, 1, 2, { fh: 1 }); O("speaker", w - 2, 3, 1, 2, { fh: 1 }); O("dancefloor", 4, 5, 6, 3, {}); O("sofa", w - 4, 6, 3, 2, {});
    } else if (cat === "studio") {
      O("shelf", 3, 0, 2, 2, { stock: "jars", solid: false, layer: "wall" }); O("shelf", 9, 0, 2, 2, { stock: "bottles", solid: false, layer: "wall" });
      O("tablelong", 4, 4, 4, 2, {}); O("easel", 4, 7, 1, 2, {}); O("easel", 9, 6, 1, 2, {}); O("plinth", 12, 6, 1, 2, {});
      O("counter", 9, 3, 4, 2, { tone: "cream", slot: "host", label: "Talk to the host", fh: 1 }); host = { x: 11, y: 3.0 }; O("rug", 4, 7, 5, 2, { tone: "cream" }); O("pot", 1, 3, 1, 2, {});
    } else if (cat === "gallery") {
      O("painting", 3, 0, 2, 2, { art: "fire", solid: false }); O("painting", 8, 0, 2, 2, { art: "fire", solid: false }); O("painting", 10, 0, 2, 2, { art: "sea", solid: false });
      O("plinth", 4, 3, 1, 2, {}); O("plinth", 6, 3, 1, 2, {}); O("viewbench", 4, 6, 3, 1, {}); O("easel", 12, 6, 1, 2, {});
      O("counter", 9, 3, 4, 2, { tone: "ink", slot: "host", label: "Talk to the host", fh: 1 }); host = { x: 11, y: 3.0 }; O("rug", 8, 6, 4, 2, { tone: "red" }); O("pot", 1, 3, 1, 2, {});
    } else if (cat === "office") {
      O("chalkboard", cx - 2, 1, 2, 1, { text: "TODAY", solid: false, layer: "wall" }); O("chalkboard", cx + 4, 1, 2, 1, { text: "SHIP IT", solid: false, layer: "wall" });
      O("officedesk", 4, 3, 2, 2, {}); O("officedesk", 6, 3, 2, 2, {}); O("officedesk", 4, 6, 2, 2, {}); O("officedesk", 7, 6, 2, 2, {});
      O("counter", 9, 3, 4, 2, { tone: "orange", slot: "host", label: "Talk to the host", fh: 1 }); host = { x: 11, y: 3.0 }; O("sofa", 1, 3, 3, 2, {}); O("rug", 4, 5, 6, 3, { tone: "ink" }); O("pot", 12, 6, 1, 2, {});
    } else {
      O("barback", 3, 0, 5, 2, { solid: false });
      O("counter", 3, 3, 7, 2, { tone: "dark", slot: "host", label: "Talk to the barkeep", fh: 1 }); host = { x: 6.5, y: 3.0 };
      O("stool", 4, 5, 1, 1); O("stool", 5, 5, 1, 1); O("stool", 7, 5, 1, 1); O("stool", 8, 5, 1, 1); O("scale", 11, 3, 1, 2, { fh: 1 });
      O("table", 10, 6, 2, 2, {}); O("rug", 4, 7, 5, 2, { tone: "dark" }); O("pot", 12, 2, 1, 2, {});
    }
    st = INT_STYLE[cat];
    return {
      id: "interior-" + cat, category: cat, name: st.name, w: w, h: h, tiles: rows,
      legend: {
        " ": { solid: true, tile: "void" }, "#": { wall: true, tile: "wall-cap" }, "U": { wall: true, tile: wallUp(st.wall) }, "W": { wall: true, tile: st.wall },
        "f": { floor: true, tile: st.floor }, "g": { floor: true, tile: st.floor2 }, "d": { floor: true, tile: "mat-k13", door: true }
      },
      objects: objs, spawn: { x: dx + 1, y: h - 1.7 }, door: { x: dx, y: h - 1, w: 2 }, host: host,
      slots: { toy: { x: 1, y: 6, w: 2, h: 2 }, frame: { x: frameX(cat, cx), y: 0, w: 3, h: 2, inner: FRAME_INNER }, host: host }
    };
  }

  /* =====================================================================================
     RESOLVE + PUBLIC API
     ===================================================================================== */
  function vehInfo(obj) {
    var id = String(obj && obj.id || ""), kind = String(obj && obj.kind || ""), m, dir, kd, col;
    m = /^van-(down|up|left|right)$/.exec(id);
    if (m) { return { kind: "van", dir: m[1], color: "orange" }; }
    m = /^car-([a-z]+)-(down|up|left|right)$/.exec(id);
    if (m) { return { kind: "car", dir: m[2], color: CAR_COLORS[m[1]] ? m[1] : "red" }; }
    if (kind === "van" || kind === "car") {
      dir = DIRS.indexOf(obj.dir) >= 0 ? obj.dir : "down"; col = CAR_COLORS[obj.color] ? obj.color : "red"; kd = kind;
      return { kind: kd, dir: dir, color: kd === "van" ? "orange" : col };
    }
    return null;
  }
  function resolve(obj) {
    var id = String(obj && obj.id || ""), kind = String(obj && obj.kind || ""), v = vehInfo(obj), z, d, base;
    if (v) {
      z = vehSize(v.dir);
      return { key: "veh:" + v.kind + ":" + v.dir + ":" + v.color, w: z.w, h: z.h, layer: "object", sway: 0, glow: null,
        draw: function (p, W, H, c, o, vv, mode) { vehicle(p, W, H, c, v.dir, v.kind === "van" ? c.orange : mixPal(c, CAR_COLORS[v.color]), v.kind, mode); } };
    }
    d = OBJ[kind] || OBJ[id];
    if (!d) { base = id.replace(/-\d+$/, ""); d = OBJ[base]; if (d) { id = base; } else { id = OBJ[kind] ? kind : id; } }
    else { id = OBJ[kind] ? kind : id; }
    if (d) { return { key: id, w: d.w, h: d.h, layer: d.layer, sway: d.sway || 0, glow: d.glow || null, draw: d.draw, anim: d.anim || null }; }
    return { key: "unknown", w: 1, h: 1, layer: "object", sway: 0, glow: null, anim: null, draw: function (p, W, H, c) { shadow(p, W, H, 1); p.r(1, 3, W - 2, H - 5, c.ol); p.r(2, 4, W - 4, H - 7, c.lwood); p.txt("?", (W >> 1) - 1, (H >> 1) - 3, c.dwood, 1, 1); } };
  }
  var CAR_PAL = {};
  function sizeOf(obj, d) { return { w: Math.round(((obj && obj.w) || d.w) * TS), h: Math.round(((obj && obj.h) || d.h) * TS) }; }

  function objectAt(ctx, obj, px, py, s, t, light) {
    var d = resolve(obj || {}), z = sizeOf(obj, d), mode = modeOf(light), c = pal(mode), st = still(), tt = st ? STILL_T : (t || 0), v = 0, cv, g, o = obj || {}, key, a, amt;
    if (d.sway) { v = swayV(tt, o, d.sway); }
    key = "o:" + d.key + ":" + z.w + "x" + z.h + ":" + mode + ":" + v + ":" + (o.tone || "") + "|" + (o.text || "") + "|" + (o.color || "") + "|" + (o.art || "") + "|" + (o.stock || "");
    cv = sprite(key, z.w, z.h, function (p, W, H) { curMode = mode; d.draw(p, W, H, c, o, v, mode); });
    blit(ctx, cv, px, py, s);
    if (d.anim) { curMode = mode; d.anim(mkP(ctx, px, py, s), z.w, z.h, c, o, tt, mode); }
    if (lampsOn(mode) && d.glow) {
      g = d.glow; amt = (g.a === undefined ? 0.3 : g.a) * (mode === "dusk" ? 0.6 : 1);
      glowAt(ctx, px + z.w * s * (g.ox === undefined ? 0.5 : g.ox), py + z.h * s * (g.oy === undefined ? 0.5 : g.oy), g.r * TS * s, g.color, amt);
    }
  }
  function object(ctx, obj, s, t, light) { objectAt(ctx, obj, Math.round(obj.x * TS * s), Math.round(obj.y * TS * s), s, t, light); }

  function info(id) {
    var o = (typeof id === "string") ? { id: id } : (id || {}), name = String(o.id || o.key || ""), forced = (o.kind === "storefront" || o.kind === "shop"), sk = (typeof id === "string" || forced) ? shopKey(name) : null, d, r;
    if (sk) { return shopInfo(sk); }
    if (forced) { return shopInfo(name); }
    d = resolve(o);
    r = { w: d.w, h: d.h, layer: d.layer, glow: d.glow ? { color: d.glow.color, r: d.glow.r } : null };
    if (d.key === "frame") { r.inner = FRAME_INNER; }
    return r;
  }
  function lights(obj) {
    var d = resolve(obj || {}), w = (obj && obj.w) || d.w, h = (obj && obj.h) || d.h, g = d.glow;
    if (!g) { return []; }
    return [{ x: (obj.x || 0) + w * (g.ox === undefined ? 0.5 : g.ox), y: (obj.y || 0) + h * (g.oy === undefined ? 0.5 : g.oy), r: g.r, color: g.color }];
  }

  /* the tiles of a diagonal run: body tiles plus their flanks. kit 'fwy' | 'pch', dir 'ne' (x+k, y-k) | 'nw' (x+k, y+k),
     (x,y) = first body tile. Returns [{name,x,y}], flanks never overwrite a body tile. Place the straight/diagonal
     transition tiles yourself at the two ends (see the header). */
  function diagRun(kit, dir, x, y, len) {
    var out = [], seen = {}, k, bx, by, nb, i, side = dir === "ne" ? [["lr", 1, 0], ["lr", 0, 1], ["ul", -1, 0], ["ul", 0, -1]] : [["ur", 0, -1], ["ur", 1, 0], ["ll", 0, 1], ["ll", -1, 0]];
    function put(name, px, py, force) { var key = px + "," + py; if (seen[key] !== undefined && !force) { return; } if (seen[key] !== undefined) { out[seen[key]] = { name: name, x: px, y: py }; return; } seen[key] = out.length; out.push({ name: name, x: px, y: py }); }
    for (k = 0; k < len; k++) { bx = x + k; by = dir === "ne" ? y - k : y + k; put(kit + "-d-" + dir, bx, by, true); }
    for (k = 0; k < len; k++) { bx = x + k; by = dir === "ne" ? y - k : y + k; for (i = 0; i < 4; i++) { put(kit + "-d-" + dir + "-" + side[i][0], bx + side[i][1], by + side[i][2], false); } }
    return out;
  }
  var shopList = [];
  (function () { var k, i = 0; for (k in SHOPS) { if (SHOPS.hasOwnProperty(k)) { shopList.push(shopInfo(k)); } } })();
  var shopKeys = shopList.map(function (s) { return s.key; });

  K.town = {
    version: "2026-10-06", tileSize: TS, tileNames: tileNames, objectNames: objectNames, shopKeys: shopKeys, shops: shopList, categories: intCategories,
    carColors: CAR_NAMES, directions: DIRS.slice(), frameInner: FRAME_INNER,
    tile: tile, object: object, objectAt: objectAt, info: info, lights: lights,
    diagRun: diagRun, storefront: storefront, storefrontInfo: shopInfo, storefrontLights: shopLights, interior: interior, shopKey: shopKey
  };
})();
