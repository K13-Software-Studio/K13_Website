/* js/world/decor.js  -  K13 Workbench World: tiles, objects, marquees (pixel art drawn in code)
   Owner: decor builder. Plain ES5, no libraries, no fetches, no console output.

   PUBLIC API  (window.K13World.decor)
     tile(ctx, name, x, y, s)      draws one 16x16 logical tile. x,y = DESTINATION PIXELS of the top-left
                                   corner (already scaled), s = integer scale. Never smooths.
     object(ctx, obj, s, t)        draws one object with its top-left at (obj.x*16*s, obj.y*16*s) in the
                                   ctx's CURRENT transform (translate the camera first). Size is obj.w x obj.h
                                   tiles; when missing, the default from info(id) is used. t = seconds (animation).
     objectAt(ctx, obj, px, py, s, t)   same, but top-left at explicit destination pixels.
     marquee(gameId)               returns a cached 160x40 <canvas>: lit sign with the game's name and icon.
                                   Accepts 'hardest13', 'cab-hardest13', a toy ('bench-carlos'), 'secret16'.
     info(id)                      {w,h,layer,glow} defaults for an object id (w,h in tiles).
                                   layer: 'floor' (draw first, flat), 'wall' (hangs on the wall), 'object' (y-sorted).
     lights(obj)                   [{x,y,r,color}] glow sources in TILE units (for the engine's night overlay).
     tileNames, games, toys        lists / metadata.

   OBJECT FLAGS the engine may set:  obj.open (door-back ajar), obj.revealed (cab-secret uncovered),
     obj.you (scoreboard shows a YOU row).
   TILE NAMES: wood-a wood-b checker concrete lounge studio backroom wall-top wall-front wall-front-up
     wall-front-jade wall-front-jade-up wall-front-dark wall-front-dark-up wall-window-day wall-window-night
     wall-window (follows the theme) doorway mat void.  Aliases are resolved (wood, floor, carpet, wall...).
   NIGHT: <html data-theme="dark"> darkens everything; neon, lamps and screens stay lit.
   MOTION: every animation reads matchMedia('(prefers-reduced-motion: reduce)'); reduced shows one still frame. */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : (typeof global !== "undefined" ? global : {});
  var K = root.K13World = root.K13World || {};
  var TS = 16;

  /* ---------- palette ---------- */
  var BASE = {
    graphite: "#1F2023", ink: "#26272B", steel: "#414347", slate: "#5D5F65", paper: "#F3F5FA", cream: "#F6EEDC",
    white: "#FFFFFF", orange: "#EA5E14", dorange: "#B94612", gold: "#F0B429", jade: "#4F9E92", djade: "#2F6F65",
    wood: "#8A5A3B", dwood: "#5E3B26", floorW: "#D8C4A6", floorD: "#B9A07E", plant: "#3C8A5E", dplant: "#2A6644",
    floorM: "#CDB592", floorS: "#A48862", ol: "#2B1D16", lwood: "#A97650", red: "#C8402B", skin: "#F1C7A0",
    plaster: "#E9D8B4", plasterS: "#D4C096", conc: "#74777D", conc2: "#686B71", conc3: "#85888E",
    tweed: "#55575D", tweed2: "#6A6C73", tweed3: "#46484D", sky: "#8EC5D6", sky2: "#F6C58B", glass: "#BFE3E0",
    brass: "#C9A24A", sheet: "#D9D2C2", sheetS: "#B8B09E", water: "#3F8FA0", waterL: "#6FB9C4", sand: "#D8C28A",
    dark: "#101214", jwall: "#3E7F75", jwallS: "#336B63", dwall: "#2E3035", dwallS: "#25262A", rug1: "#2F6F65"
  };
  var LIT = { orange: "#FF8A3D", gold: "#FFC83D", jade: "#5FD1BE", plant: "#6BD08A", cream: "#FFF3D6", white: "#FFFFFF", red: "#FF6A4A" };
  var NF = [0.5, 0.56, 0.68];

  function hex2rgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgb2hex(r, g, b) { return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); }
  function dim(h, f) { var c = hex2rgb(h); return rgb2hex(Math.round(c[0] * f[0]), Math.round(c[1] * f[1]), Math.round(c[2] * f[2])); }
  function mix(a, b, t) { var A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(Math.round(A[0] + (B[0] - A[0]) * t), Math.round(A[1] + (B[1] - A[1]) * t), Math.round(A[2] + (B[2] - A[2]) * t)); }
  function rgba(h, a) { var c = hex2rgb(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  var PAL_DAY = BASE, PAL_NIGHT = {}, k0;
  for (k0 in BASE) { if (BASE.hasOwnProperty(k0)) { PAL_NIGHT[k0] = dim(BASE[k0], NF); } }

  function isNight() { try { return root.document.documentElement.getAttribute("data-theme") === "dark"; } catch (e) { return false; } }
  function pal(n) { return n ? PAL_NIGHT : PAL_DAY; }
  function still() { try { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  var STILL_T = 2.3;
  function hash(x, y, k) { var n = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return n - Math.floor(n); }

  /* ---------- painter ---------- */
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
    p.clip = function (x, y, w, h) { ctx.save(); ctx.beginPath(); ctx.rect(ox + x * s, oy + y * s, w * s, h * s); ctx.clip(); };
    p.unclip = function () { ctx.restore(); };
    return p;
  }

  /* 3x5 pixel font, rows concatenated */
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
    " ": "000000000000000"
  };
  function textW(str, sz, gap) { gap = (gap === undefined) ? 1 : gap; sz = sz || 1; return str.length ? (str.length * (3 + gap) - gap) * sz : 0; }

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
  function shadow(p, W, H, inset) { inset = inset || 1; p.r(inset, H - 3, W - inset * 2, 3, "#000000", 0.22); }

  /* =====================================================================================
     TILES
     ===================================================================================== */
  function tWood(p, c, tone) {
    var base = tone ? c.floorM : c.floorW, seam = tone ? c.floorS : c.floorD, hi = tone ? c.floorW : c.cream, i, hx;
    p.r(0, 0, 16, 16, base);
    p.r(0, 0, 16, 1, hi, 0.45); p.r(0, 8, 16, 1, hi, 0.45);
    p.r(0, 7, 16, 1, seam); p.r(0, 15, 16, 1, seam);
    hx = tone ? 10 : 4; p.r(hx, 0, 1, 7, seam); p.r((hx + 7) % 16, 8, 1, 7, seam);
    p.px(hx + 2, 2, seam, 0.8); p.px(hx + 2, 4, seam, 0.8); p.px((hx + 9) % 16, 10, seam, 0.8); p.px((hx + 9) % 16, 12, seam, 0.8);
    for (i = 0; i < 5; i++) { p.r(Math.floor(hash(i, tone, 1) * 12) + 1, Math.floor(hash(i, tone, 2) * 14), 2, 1, seam, 0.45); }
  }
  function tChecker(p, c) {
    var A = c.steel, B = c.graphite, i;
    p.r(0, 0, 16, 16, B); p.r(0, 0, 8, 8, A); p.r(8, 8, 8, 8, A);
    p.r(0, 0, 16, 1, "#000000", 0.18); p.r(0, 0, 1, 16, "#000000", 0.18);
    /* arcade carpet confetti */
    p.px(10, 2, c.orange, 0.85); p.px(11, 2, c.orange, 0.85); p.px(11, 3, c.orange, 0.85);
    p.px(3, 12, c.gold, 0.85); p.px(4, 11, c.gold, 0.85); p.px(4, 13, c.gold, 0.85);
    p.px(3, 3, c.jade, 0.85); p.px(4, 4, c.jade, 0.85); p.px(2, 4, c.jade, 0.85);
    p.px(12, 11, c.cream, 0.7); p.px(13, 12, c.cream, 0.7);
    p.px(6, 7, c.orange, 0.6); p.px(14, 6, c.jade, 0.6); p.px(1, 9, c.gold, 0.6);
    for (i = 0; i < 6; i++) { p.px(Math.floor(hash(i, 1, 3) * 16), Math.floor(hash(i, 2, 3) * 16), c.slate, 0.35); }
  }
  function tConcrete(p, c) {
    var i;
    p.r(0, 0, 16, 16, c.conc);
    for (i = 0; i < 22; i++) { p.px(Math.floor(hash(i, 3, 5) * 16), Math.floor(hash(i, 4, 5) * 16), hash(i, 5, 5) > 0.5 ? c.conc2 : c.conc3); }
    p.r(15, 0, 1, 16, "#000000", 0.16); p.r(0, 15, 16, 1, "#000000", 0.16);
    p.px(4, 5, c.floorD, 0.7); p.px(11, 9, c.floorD, 0.7); p.px(7, 13, c.floorW, 0.6);
    p.px(9, 3, c.conc2); p.px(10, 4, c.conc2); p.px(10, 5, c.conc2);
  }
  function tLounge(p, c) {
    var d, i;
    p.r(0, 0, 16, 16, c.djade);
    for (i = 0; i < 16; i += 2) { p.r(i, 0, 1, 16, c.jade, 0.08); }
    d = [[4, 4], [12, 12]];
    for (i = 0; i < 2; i++) {
      p.r(d[i][0], d[i][1] - 3, 1, 7, c.jade); p.r(d[i][0] - 3, d[i][1], 7, 1, c.jade);
      p.r(d[i][0] - 1, d[i][1] - 1, 3, 3, c.cream); p.px(d[i][0], d[i][1], c.gold);
      p.px(d[i][0] - 2, d[i][1] - 2, c.jade); p.px(d[i][0] + 2, d[i][1] + 2, c.jade); p.px(d[i][0] - 2, d[i][1] + 2, c.jade); p.px(d[i][0] + 2, d[i][1] - 2, c.jade);
    }
    p.px(12, 4, c.cream, 0.8); p.px(4, 12, c.cream, 0.8); p.px(12, 3, c.orange, 0.8); p.px(4, 11, c.orange, 0.8);
  }
  function tStudio(p, c) {
    var i, h;
    p.r(0, 0, 16, 16, c.tweed);
    for (i = 0; i < 46; i++) {
      h = hash(i, 7, 9);
      p.px(Math.floor(hash(i, 8, 9) * 16), Math.floor(hash(i, 9, 9) * 16), h > 0.55 ? c.tweed2 : (h > 0.12 ? c.tweed3 : c.orange), h > 0.12 ? 1 : 0.7);
    }
  }
  function tBack(p, c) {
    p.r(0, 0, 16, 16, c.ink);
    p.r(0, 0, 16, 1, c.steel); p.r(0, 0, 1, 16, c.steel);
    p.r(1, 1, 14, 14, c.graphite);
    p.r(2, 2, 12, 1, "#000000", 0.25);
    p.r(1, 8, 14, 1, c.steel, 0.35); p.r(8, 1, 1, 14, c.steel, 0.35);
    p.px(2, 2, LIT.jade, 0.8); p.px(13, 13, LIT.jade, 0.8);
  }
  function tWallTop(p, c) {
    p.r(0, 0, 16, 16, "#4A3023");
    p.r(0, 0, 16, 2, "#6B4A36"); p.r(0, 14, 16, 2, "#33201A");
    p.r(0, 7, 16, 1, "#3C281D", 0.6);
    p.px(3, 4, "#6B4A36"); p.px(11, 10, "#6B4A36"); p.px(7, 5, "#33201A");
  }
  function tWallFront(p, c, kind, skirt) {
    var base, shade, i;
    if (kind === "jade") { base = c.jwall; shade = c.jwallS; } else if (kind === "dark") { base = c.dwall; shade = c.dwallS; } else { base = c.plaster; shade = c.plasterS; }
    p.r(0, 0, 16, 16, base);
    p.r(0, 0, 16, 2, "#000000", 0.16); p.r(0, 2, 16, 1, "#000000", 0.07);
    if (kind === "jade") { p.r(0, 3, 1, 13, shade); p.r(8, 3, 1, 13, shade); p.r(1, 3, 1, 13, "#FFFFFF", 0.07); p.r(9, 3, 1, 13, "#FFFFFF", 0.07); }
    else if (kind === "dark") { p.r(0, 5, 16, 1, shade); p.r(0, 10, 16, 1, shade); p.r(0, 6, 16, 1, "#FFFFFF", 0.04); }
    else { for (i = 0; i < 9; i++) { p.px(Math.floor(hash(i, 1, 11) * 16), 3 + Math.floor(hash(i, 2, 11) * 9), shade, 0.8); } }
    if (skirt) {
      p.r(0, 10, 16, 1, "#000000", 0.14);
      p.r(0, 11, 16, 1, kind === "dark" ? c.slate : c.lwood);
      p.r(0, 12, 16, 3, kind === "dark" ? c.steel : c.wood);
      p.r(0, 15, 16, 1, kind === "dark" ? c.graphite : c.dwood);
    }
  }
  function tWindow(p, c, night) {
    var i, y, col;
    tWallFront(p, c, "plain", false);
    p.r(1, 0, 14, 14, c.dwood); p.r(2, 1, 12, 12, c.wood);
    for (y = 0; y < 10; y++) {
      if (night) { col = mix("#0E1822", "#1B3340", y / 9); } else { col = mix("#8EC5D6", "#F6C58B", y / 9); }
      p.r(3, 2 + y, 10, 1, col);
    }
    if (night) { p.px(5, 4, LIT.gold); p.px(10, 3, LIT.cream); p.px(11, 7, LIT.gold, 0.7); p.px(4, 8, LIT.cream, 0.7); p.r(10, 4, 2, 2, LIT.cream, 0.0); }
    else { p.r(4, 8, 4, 1, "#FFFFFF", 0.55); p.r(9, 5, 3, 1, "#FFFFFF", 0.5); p.px(11, 3, LIT.gold); p.px(11, 4, LIT.gold, 0.6); }
    p.r(7, 2, 2, 10, c.wood); p.r(3, 6, 10, 1, c.wood);
    p.r(7, 2, 1, 10, c.lwood, 0.6);
    p.r(0, 13, 16, 2, c.lwood); p.r(0, 15, 16, 1, c.dwood);
  }
  function tDoorway(p, c) {
    tWood(p, c, 1);
    p.r(0, 6, 16, 4, c.dwood); p.r(0, 7, 16, 2, c.brass); p.r(0, 7, 16, 1, "#FFFFFF", 0.35);
    p.r(0, 10, 16, 2, "#000000", 0.12);
  }
  function tMat(p, c) {
    var i;
    p.r(0, 0, 16, 16, c.orange);
    for (i = 0; i < 16; i += 2) { p.r(0, i, 16, 1, c.dorange, 0.55); }
    for (i = 0; i < 12; i++) { p.px(Math.floor(hash(i, 1, 21) * 16), Math.floor(hash(i, 2, 21) * 16), c.gold, 0.7); }
  }
  function tVoid(p, c) { p.r(0, 0, 16, 16, "#131417"); p.px(4, 4, c.steel, 0.4); p.px(12, 11, c.steel, 0.4); }

  var TILE_DRAW = {
    "wood-a": function (p, c) { tWood(p, c, 0); }, "wood-b": function (p, c) { tWood(p, c, 1); },
    "checker": tChecker, "concrete": tConcrete, "lounge": tLounge, "studio": tStudio, "backroom": tBack,
    "wall-top": tWallTop,
    "wall-front": function (p, c) { tWallFront(p, c, "plain", true); }, "wall-front-up": function (p, c) { tWallFront(p, c, "plain", false); },
    "wall-front-jade": function (p, c) { tWallFront(p, c, "jade", true); }, "wall-front-jade-up": function (p, c) { tWallFront(p, c, "jade", false); },
    "wall-front-dark": function (p, c) { tWallFront(p, c, "dark", true); }, "wall-front-dark-up": function (p, c) { tWallFront(p, c, "dark", false); },
    "wall-window-day": function (p, c) { tWindow(p, c, false); }, "wall-window-night": function (p, c) { tWindow(p, c, true); },
    "doorway": tDoorway, "mat": tMat, "void": tVoid
  };
  var TILE_ALIAS = {
    "wood": "wood-a", "floor": "wood-a", "floor-wood": "wood-a", "wood-1": "wood-a", "wood-2": "wood-b", "wood1": "wood-a", "wood2": "wood-b",
    "arcade": "checker", "carpet": "checker", "arcade-carpet": "checker", "workshop": "concrete", "floor-concrete": "concrete",
    "rug": "lounge", "lounge-rug": "lounge", "studio-carpet": "studio", "back-room": "backroom", "back": "backroom", "war-room": "backroom",
    "wall": "wall-front", "wall-face": "wall-front", "wall-cap": "wall-top", "walltop": "wall-top", "wallfront": "wall-front",
    "window": "wall-window", "door": "doorway", "welcome": "mat", "welcome-mat": "mat", "empty": "void", "none": "void"
  };
  function resolveTile(name) {
    var n = String(name || "").toLowerCase().replace(/[\s_]+/g, "-");
    if (TILE_DRAW[n] || n === "wall-window") { return n; }
    if (TILE_ALIAS[n]) { return TILE_ALIAS[n]; }
    if (n.indexOf("window") >= 0) { return "wall-window"; }
    if (n.indexOf("wall") >= 0) { return n.indexOf("top") >= 0 ? "wall-top" : "wall-front"; }
    if (n.indexOf("wood") >= 0) { return "wood-a"; }
    if (n.indexOf("check") >= 0) { return "checker"; }
    if (n.indexOf("conc") >= 0) { return "concrete"; }
    if (n.indexOf("rug") >= 0 || n.indexOf("lounge") >= 0) { return "lounge"; }
    if (n.indexOf("stud") >= 0) { return "studio"; }
    if (n.indexOf("back") >= 0) { return "backroom"; }
    if (n.indexOf("door") >= 0) { return "doorway"; }
    return "void";
  }
  function tile(ctx, name, x, y, s) {
    var n = resolveTile(name), night = isNight(), key;
    if (n === "wall-window") { n = night ? "wall-window-night" : "wall-window-day"; }
    key = "t:" + n + (night ? ":n" : ":d");
    blit(ctx, sprite(key, 16, 16, function (p) { TILE_DRAW[n](p, pal(night)); }), x, y, s);
  }

  /* =====================================================================================
     GAMES (cabinets) and TOYS (benches)
     ===================================================================================== */
  var LG = { o: BASE.orange, O: BASE.dorange, g: BASE.gold, j: BASE.jade, J: BASE.djade, w: "#FFFFFF", c: BASE.cream, k: BASE.graphite,
    s: "#7A7D84", l: BASE.slate, b: BASE.wood, B: BASE.dwood, p: BASE.plant, P: BASE.dplant, R: BASE.red, a: BASE.sky, e: BASE.skin };

  var GAMES = {
    hardest13: { name: "THE HARDEST SHIP", l: ["HARDEST", "SHIP"], acc: "orange", pat: 0, bg: "#1B2A2E", icon: [
      "ssssssssss", "s.oo...R.s", "s.oo.sss.s", "s....s...s", "ssss.s.R.s", "s....s...s", "s.ssssss.s", "s......wws", "ssssssssss"] },
    platform13: { name: "SHIP RUN", l: ["SHIP", "RUN"], acc: "jade", pat: 5, bg: "#1E2F3A", icon: [
      "......wRR.", "......wR..", "..oo..w...", "..oo..w...", "..o.o.jjjj", "jjjjjjJJJJ", "JJJJJJ....", "..........", "bbbbbbbbbb"] },
    contra13: { name: "RUN & SHIP", l: ["RUN &", "SHIP"], acc: "gold", pat: 3, bg: "#2A2420", icon: [
      "...ee.....", "..oooo..R.", "..ooosss.R", "..oooo.g.R", "..o..o....", "..o..o....", ".kk..kk...", "pppppppppp", "PPPPPPPPPP"] },
    race13: { name: "FAST TRACK 13", l: ["FAST 13", "TRACK"], acc: "orange", pat: 2, bg: "#202428", icon: [
      "s........s", "s...cc...s", "s...cc...s", "s........s", "s...oo...s", "s..oooo..s", "s..owwo..s", "s..oooo..s", "s..o..o..s"] },
    paper13: { name: "BIN IT", l: ["BIN", "IT"], acc: "slate", pat: 4, bg: "#21292B", icon: [
      "....w.....", "..w...w...", ".w.w......", "..........", "..llllll..", "...llll...", "...llll...", "...llll...", "..llllll.."] },
    dx13: { name: "DEBT BREAKER", l: ["DEBT", "BREAKER"], acc: "gold", pat: 2, bg: "#1D2224", icon: [
      "RRRRRRRRRR", "oooooooooo", "gggggggggg", "jjjjjjjjjj", "..........", ".....w....", "..........", "....cccc..", ".........."] },
    rope13: { name: "CUT THE SCOPE", l: ["CUT THE", "SCOPE"], acc: "jade", pat: 1, bg: "#252B22", icon: [
      "....b.....", "....b.....", "....b.....", "....b.....", "...ggg....", "..gooog...", "..gooog...", "...ggg..ss", "......ss.s"] },
    haxball13: { name: "K13 KICKOFF", l: ["K13", "KICKOFF"], acc: "jade", pat: 0, bg: "#1F4A3B", icon: [
      "wwwwwwwwww", "w...ww...w", "ww..ww..ww", "w.o.ww.j.w", "w...wwc..w", "ww..ww..ww", "w.o.ww.j.w", "w...ww...w", "wwwwwwwwww"] },
    duo13: { name: "DESIGN & CODE", l: ["DESIGN", "& CODE"], acc: "orange", pat: 4, bg: "#222729", icon: [
      "..........", "jj......oo", "j.......o.", "j...w..oo.", "j....w..o.", "j...w...o.", "j......oo.", "jj.......o", ".........."] },
    bubble13: { name: "SCOPE POP", l: ["SCOPE", "POP"], acc: "jade", pat: 1, bg: "#1C2A33", icon: [
      "jjooggjjoo", ".jjooggjj.", "..ggjjoo..", "...oogg...", "....jj....", "..........", "....w.....", "....s.....", "...sss...."] },
    bloons13: { name: "POP 13", l: ["POP 13"], acc: "gold", pat: 3, bg: "#27333A", icon: [
      "..RR..gg..", ".RRRR.gggg", ".RRRR.gggg", "..RR..gg..", "..l...l...", "...l.l....", "........oo", "ssssssswoo", "........oo"] },
    worms13: { name: "TURF 13", l: ["TURF 13"], acc: "plant", pat: 5, bg: "#27363D", icon: [
      "..........", "..........", "......g...", "....ooo...", "...oeoo...", "..pooo.pp.", "ppppppPPpp", "PPPPPPPPPP", "bbbbbbbbbb"] },
    goldminer13: { name: "GOLD RUSH 13", l: ["GOLD", "RUSH 13"], acc: "gold", pat: 4, bg: "#2B2218", icon: [
      "....l.....", "....l.....", "...lll....", "....g.....", "bbbbbbbbbb", "bggbbbbggb", "bgggbbbgbb", "bbbbbgbbbb", "BBBBBBBBBB"] },
    volfied13: { name: "REVEAL 13", l: ["REVEAL", "13"], acc: "jade", pat: 2, bg: "#1E2528", icon: [
      "wwwwwwwwww", "wjjjjj...w", "wjjjjj...w", "wjjjjj...w", "wjjjjj...w", "wjjjjjoo.w", "w.....o..w", "w........w", "wwwwwwwwww"] },
    heli13: { name: "DEADLINE RUN", l: ["DEADLINE", "RUN"], acc: "orange", pat: 3, bg: "#2A2E31", icon: [
      "ssssssssss", "ss.ss..sss", "...sssss..", "..ssssss..", ".oooooss..", ".oowo.....", "..ooo.g...", "ss..ss.sss", "ssssssssss"] },
    secret16: { name: "MACHINE 16", l: ["MACHINE", "16"], acc: "gold", pat: 4, bg: "#1A1C1E", icon: [
      "..gggggg..", ".g......g.", ".g.oooo.g.", ".g.o..o.g.", ".g.o..o.g.", ".g.oooo.g.", ".g......g.", "..gggggg..", ".........."] }
  };
  var GAME_IDS = ["hardest13", "platform13", "contra13", "race13", "paper13", "dx13", "rope13", "haxball13", "duo13", "bubble13", "bloons13", "worms13", "goldminer13", "volfied13", "heli13"];

  var TOYS = {
    eggtoss: { title: "Sunny Side Up", from: "Egg&Out", name: "SUNNY SIDE UP" },
    carlos: { title: "Fire Palette", from: "Carlos Almaraz", name: "FIRE PALETTE" },
    miramar: { title: "Opening Night", from: "Miramar Food Hall", name: "OPENING NIGHT" },
    tide: { title: "Tide Line", from: "Lobster Lab", name: "TIDE LINE" },
    egg: { title: "Endless Spiral", from: "Egg&Out", name: "ENDLESS SPIRAL" },
    cengo: { title: "Night Shift Deck", from: "CENGO", name: "NIGHT SHIFT DECK" },
    stack: { title: "Stack Attack", from: "Cosmos Burger", name: "STACK ATTACK" },
    sandwich: { title: "Bacon Rush, built to order", from: "Egg&Out", name: "BACON RUSH" },
    goldenhour: { title: "Golden Hour", from: "La Vida San Diego", name: "GOLDEN HOUR" },
    roof: { title: "One Roof", from: "Tiger Hospitality", name: "ONE ROOF" },
    eggcursor: { title: "Runny Egg", from: "Egg&Out", name: "RUNNY EGG" },
    pours: { title: "Count the Pours", from: "BarFix", name: "COUNT THE POURS" },
    limewash: { title: "Limewash", from: "baa atelier", name: "LIMEWASH" },
    dumpling: { title: "Dumpling Drop", from: "Station8", name: "DUMPLING DROP" },
    angry13: { title: "Angry 13", from: "K13", name: "ANGRY 13" }
  };
  var TOY_IDS = ["eggtoss", "carlos", "miramar", "tide", "egg", "cengo", "stack", "sandwich", "goldenhour", "roof", "eggcursor", "pours", "limewash", "dumpling", "angry13"];

  function litOf(acc) { return LIT[acc] || (acc === "slate" ? "#B9BEC8" : LIT.orange); }

  function drawIcon(p, x, y, rows) { p.map(x, y, rows, LG); }

  /* ---------- marquee canvas (modal sign) ---------- */
  function wrapWords(str, max) {
    var words = str.split(" "), lines = [], cur = "", i;
    for (i = 0; i < words.length; i++) {
      if (!cur) { cur = words[i]; } else if ((cur + " " + words[i]).length <= max) { cur += " " + words[i]; } else { lines.push(cur); cur = words[i]; }
    }
    if (cur) { lines.push(cur); }
    return lines;
  }
  function marquee(gameId) {
    var id = String(gameId || "").replace(/^cab-/, ""), key = "mq:" + id, isToy = false, toyId, g, name, acc, bg, icon;
    if (id === "secret") { id = "mystery"; }
    if (cache[key]) { return cache[key]; }
    if (id.indexOf("bench-") === 0) { toyId = id.slice(6); isToy = true; }
    if (id === "mystery") { name = "???"; acc = "gold"; bg = "#1A1C1E"; icon = null; }
    else if (isToy && TOYS[toyId]) { name = TOYS[toyId].name; acc = "orange"; bg = "#241E18"; icon = null; }
    else { g = GAMES[id] || GAMES.hardest13; name = g.name; acc = g.acc; bg = g.bg; icon = g.icon; }
    return sprite(key, 160, 40, function (p) {
      var i, lines, tw, x0, y0, lit = litOf(acc), n, lh = 13;
      p.r(0, 0, 160, 40, "#0C0D0F"); p.r(1, 1, 158, 38, BASE.dwood); p.r(2, 2, 156, 36, "#0C0D0F");
      for (i = 0; i < 40; i++) { p.r(2 + i * 4, 1, 2, 2, (i % 2) ? LIT.cream : LIT.gold); p.r(2 + i * 4, 37, 2, 2, (i % 2) ? LIT.gold : LIT.cream); }
      for (i = 0; i < 9; i++) { p.r(1, 4 + i * 4, 2, 2, (i % 2) ? LIT.gold : LIT.cream); p.r(157, 4 + i * 4, 2, 2, (i % 2) ? LIT.cream : LIT.gold); }
      p.r(5, 5, 150, 30, bg);
      for (i = 0; i < 30; i += 2) { p.r(5, 5 + i, 150, 1, "#000000", 0.13); }
      p.r(5, 5, 150, 1, lit, 0.5); p.r(5, 34, 150, 1, lit, 0.5);
      x0 = 10;
      if (icon) {
        for (i = 0; i < icon.length; i++) { /* icon at 2x */ }
        p.r(9, 9, 24, 22, "#000000", 0.35);
        (function () {
          var j, k2, ch, col;
          for (j = 0; j < icon.length; j++) { for (k2 = 0; k2 < icon[j].length; k2++) { ch = icon[j].charAt(k2); col = LG[ch]; if (col) { p.r(11 + k2 * 2, 11 + j * 2, 2, 2, col); } } }
        })();
        x0 = 38;
      }
      lines = wrapWords(name, icon ? 14 : 17); n = lines.length;
      y0 = 5 + Math.floor((30 - (n * 10 + (n - 1) * 3)) / 2);
      for (i = 0; i < n; i++) {
        tw = textW(lines[i], 2, 1);
        p.txt(lines[i], x0 + Math.floor(((155 - x0) - tw) / 2), y0 + i * lh, i === 0 ? lit : LIT.cream, 2, 1);
      }
    });
  }

  /* ---------- cabinet ---------- */
  function sidePattern(p, x, y, w, h, kind, c, acc, flip) {
    var j, k2;
    p.r(x, y, w, h, acc);
    p.r(x, y, 1, h, "#FFFFFF", 0.18); p.r(x + w - 1, y, 1, h, "#000000", 0.25);
    for (j = 0; j < h; j++) {
      if (kind === 0) { if (((j + (flip ? 1 : 0)) >> 1) % 2 === 0) { p.r(x, y + j, w, 1, c.dorange, 0.55); } }
      else if (kind === 1) { if ((j + (flip ? 2 : 0)) % 4 === 1) { p.px(x + 1, y + j, c.gold); } }
      else if (kind === 2) { for (k2 = 0; k2 < w; k2++) { if ((j + k2) % 2 === 0) { p.px(x + k2, y + j, "#FFFFFF", 0.25); } } }
      else if (kind === 3) { k2 = [0, 1, 2, 1][(j + (flip ? 2 : 0)) % 4]; p.px(x + k2, y + j, c.gold); }
      else if (kind === 4) { if (j % 8 === 3) { p.px(x + 1, y + j, "#FFFFFF"); p.px(x, y + j + 1, "#FFFFFF", 0.7); p.px(x + 2, y + j + 1, "#FFFFFF", 0.7); p.px(x + 1, y + j + 2, "#FFFFFF", 0.7); } }
      else { k2 = Math.round(1 + Math.sin((j + (flip ? 3 : 0)) * 0.9)); p.px(x + k2, y + j, "#FFFFFF", 0.35); }
    }
  }
  function cabLayout(H) {
    var tall = H >= 44, cabH = tall ? 48 : 32;
    return tall ? { y0: H - cabH, hh: 14, bz: 16, bzh: 16, pad: 2, ctl: 33, ctlh: 7, coin: 40, coinh: 5, kick: 45, cabH: cabH } :
      { y0: H - cabH, hh: 10, bz: 11, bzh: 11, pad: 1, ctl: 22, ctlh: 5, coin: 27, coinh: 3, kick: 30, cabH: cabH };
  }
  function drawCab(p, W, H, c, o, gid) {
    var g = GAMES[gid] || GAMES.hardest13, acc = c[g.acc] || c.orange, L = cabLayout(H), x0 = (W - 32) >> 1, Y = function (n) { return L.y0 + n; };
    var lit = litOf(g.acc), lines = g.l, i, ty, sy = Y(L.bz + L.pad), sh = L.bzh - L.pad * 2;
    if (L.cabH > H) { return; }
    shadow(p, W, H, x0 + 1);
    /* body */
    p.r(x0 + 2, Y(L.hh), 28, L.cabH - L.hh - 1, c.ol);
    p.r(x0 + 3, Y(L.hh), 26, L.cabH - L.hh - 2, c.graphite);
    sidePattern(p, x0 + 2, Y(L.hh), 3, L.cabH - L.hh - 3, g.pat, c, acc, false);
    sidePattern(p, x0 + 27, Y(L.hh), 3, L.cabH - L.hh - 3, g.pat, c, acc, true);
    /* header (lit marquee) */
    p.r(x0, Y(0), 32, L.hh, c.ol); p.r(x0 + 1, Y(1), 30, L.hh - 2, "#0A0B0C");
    p.r(x0 + 1, Y(1), 30, 1, lit, 0.55); p.r(x0 + 1, Y(L.hh - 2), 30, 1, lit, 0.35);
    if (L.cabH >= 44) {
      ty = (lines.length === 2) ? 2 : 5;
      for (i = 0; i < lines.length; i++) {
        var ww = textW(lines[i], 1, 1), gap = 1;
        if (ww > 30) { gap = 0; ww = textW(lines[i], 1, 0); }
        p.txt(lines[i], x0 + Math.floor((32 - ww) / 2), Y(ty + i * 6), i === 0 ? lit : LIT.cream, 1, gap);
      }
    } else {
      drawIcon(p, x0 + 11, Y(1), g.icon.slice(0, 8)); p.r(x0 + 1, Y(1), 30, 1, lit, 0.55);
    }
    for (i = 0; i < 15; i++) { p.px(x0 + 1 + i * 2, Y(0), (i % 3 === 0) ? LIT.gold : c.brass); }
    /* screen */
    p.r(x0 + 5, Y(L.bz), 22, L.bzh, "#0E0F11");
    p.r(x0 + 7, sy, 18, sh, g.bg);
    drawIcon(p, x0 + 11, sy + Math.floor((sh - 9) / 2), g.icon);
    for (i = 0; i < sh; i += 2) { p.r(x0 + 7, sy + i, 18, 1, "#000000", 0.14); }
    p.r(x0 + 7, sy, 3, 1, "#FFFFFF", 0.35); p.r(x0 + 7, sy, 1, 3, "#FFFFFF", 0.35);
    /* controls */
    p.r(x0 + 5, Y(L.ctl), 22, L.ctlh, c.steel); p.r(x0 + 5, Y(L.ctl), 22, 1, c.slate); p.r(x0 + 5, Y(L.ctl + L.ctlh - 1), 22, 1, "#000000", 0.3);
    p.r(x0 + 10, Y(L.ctl + 2), 1, L.ctlh - 3, c.ink); p.r(x0 + 9, Y(L.ctl + 1), 3, 2, c.red); p.px(x0 + 9, Y(L.ctl + 1), "#FFFFFF", 0.5);
    p.r(x0 + 16, Y(L.ctl + 2), 2, 2, c.gold); p.r(x0 + 20, Y(L.ctl + 2), 2, 2, c.orange); p.r(x0 + 18, Y(L.ctl + L.ctlh - 2), 2, 1, c.jade);
    /* coin door */
    p.r(x0 + 10, Y(L.coin), 12, L.coinh, c.dark); p.r(x0 + 11, Y(L.coin + 1), 2, 1, LIT.gold, 0.8); p.r(x0 + 19, Y(L.coin + 1), 2, 1, LIT.gold, 0.8);
    p.r(x0 + 14, Y(L.coin + L.coinh - 1), 4, 1, c.slate);
    /* kick plate */
    p.r(x0 + 3, Y(L.kick), 26, L.cabH - L.kick - 1, c.dark);
    p.r(x0 + 3, Y(L.kick), 26, 1, c.ink);
  }
  function animCab(p, W, H, c, o, t, gid) {
    var g = GAMES[gid] || GAMES.hardest13, L = cabLayout(H), x0 = (W - 32) >> 1, i, sy = L.y0 + L.bz + L.pad, sh = L.bzh - L.pad * 2, ph = Math.floor(t * 5);
    var lit = litOf(g.acc);
    if (L.cabH > H) { return; }
    for (i = 0; i < 15; i++) { if ((i + ph) % 3 === 0) { p.px(x0 + 1 + i * 2, L.y0, LIT.cream); p.px(x0 + 2 + i * 2, L.y0, LIT.gold, 0.5); } }
    p.r(x0 + 7, sy + (Math.floor(t * 6) % sh), 18, 1, "#FFFFFF", 0.1);
    p.r(x0 + 1, L.y0 + 1, 30, 1, lit, 0.35 + 0.2 * Math.sin(t * 4));
  }
  function drawSecretCab(p, W, H, c, o) {
    var x0 = (W - 32) >> 1, Y = function (n) { return H - 48 + n; }, i, j, hw;
    if (o && o.revealed) {
      drawCab(p, W, H, c, o, "secret16");
      /* the folded sheet at its foot */
      p.r(x0 + 24, H - 6, 8, 5, c.sheet); p.r(x0 + 24, H - 6, 8, 1, "#FFFFFF", 0.4); p.r(x0 + 24, H - 2, 8, 1, c.sheetS); p.r(x0 + 26, H - 5, 1, 3, c.sheetS);
      return;
    }
    shadow(p, W, H, x0 + 1);
    /* cabinet-shaped cloth: lumpy silhouette */
    for (j = 0; j < 46; j++) {
      hw = 13 + Math.round(Math.sin(j * 0.55) * 0.8) + (j < 6 ? -(6 - j) : 0) + (j > 36 ? Math.round((j - 36) * 0.35) : 0);
      p.r(x0 + 16 - hw, Y(2 + j), hw * 2, 1, j % 9 === 0 ? c.sheetS : c.sheet);
      p.px(x0 + 16 - hw, Y(2 + j), c.sheetS); p.px(x0 + 15 + hw, Y(2 + j), c.sheetS);
    }
    for (i = 0; i < 4; i++) { p.r(x0 + 7 + i * 6, Y(10), 1, 33, c.sheetS, 0.8); p.r(x0 + 8 + i * 6, Y(12), 1, 28, "#FFFFFF", 0.22); }
    /* scalloped hem */
    for (i = 0; i < 28; i += 4) { p.r(x0 + 3 + i, Y(46), 3, 2, c.sheet); p.px(x0 + 3 + i, Y(47), c.sheetS); }
    /* gap in the cloth: a lit "???" peeks out */
    p.r(x0 + 6, Y(7), 20, 9, c.dark); p.r(x0 + 6, Y(7), 20, 1, c.sheetS);
    p.txt("???", x0 + 10, Y(9), LIT.gold, 1, 3);
    p.px(x0 + 6, Y(7), c.sheet); p.px(x0 + 25, Y(7), c.sheet);
    /* dust and a web */
    for (i = 0; i < 18; i++) { p.px(x0 + 4 + Math.floor(hash(i, 4, 31) * 24), Y(20 + Math.floor(hash(i, 5, 31) * 26)), "#FFFFFF", 0.35); }
    p.px(x0 + 4, Y(4), "#FFFFFF", 0.6); p.px(x0 + 5, Y(5), "#FFFFFF", 0.6); p.px(x0 + 6, Y(6), "#FFFFFF", 0.5); p.px(x0 + 4, Y(6), "#FFFFFF", 0.4); p.px(x0 + 6, Y(4), "#FFFFFF", 0.4);
    /* a coin slot gleam under the hem */
    p.px(x0 + 15, Y(45), LIT.gold, 0.9);
  }
  function animSecretCab(p, W, H, c, o, t) {
    var x0 = (W - 32) >> 1, Y = function (n) { return H - 48 + n; };
    if (o && o.revealed) { animCab(p, W, H, c, o, t, "secret16"); return; }
    var a = 0.55 + 0.35 * Math.sin(t * 2.2);
    p.txt("???", x0 + 10, Y(9), LIT.gold, 1, 3);
    p.r(x0 + 7, Y(8), 18, 7, LIT.gold, 0.12 * a);
    p.px(x0 + 15, Y(45), LIT.cream, a);
  }

  /* ---------- toys on the benches ---------- */
  function toyBase(p, c, id, cx, by) {
    var T = function (x, y, w, h, col, a) { p.r(cx + x, by + y, w, h, col, a); };
    if (id === "eggtoss") {
      p.ell(cx - 2, by - 3, 8, 2, c.graphite); p.ell(cx - 2, by - 3, 6, 1, c.steel); T(5, -4, 9, 2, c.dwood); T(5, -4, 9, 1, c.wood);
    } else if (id === "carlos") {
      p.ell(cx - 1, by - 6, 11, 5, c.dwood); p.ell(cx - 1, by - 6, 10, 4, c.lwood); p.ell(cx - 7, by - 4, 2, 1, c.dwood);
      T(-8, -10, 3, 2, LIT.orange); T(-3, -11, 3, 2, LIT.gold); T(2, -10, 3, 2, c.red); T(6, -8, 3, 2, c.jade); T(-1, -6, 3, 2, c.white); T(-7, -7, 2, 2, c.orange);
      T(6, -4, 9, 1, c.steel); T(12, -5, 3, 1, c.steel); T(14, -6, 2, 2, LIT.orange);
    } else if (id === "miramar") {
      p.r(cx - 15, by - 15, 30, 12, c.ol); p.r(cx - 14, by - 14, 28, 10, c.dark);
      p.txt("MIRAMAR", cx - 13, by - 12, LIT.gold, 1, 1);
      p.r(cx - 14, by - 6, 28, 1, c.dorange, 0.7);
    } else if (id === "tide") {
      p.ell(cx, by - 4, 12, 5, c.dwood); p.ell(cx, by - 5, 11, 4, c.wood); p.ell(cx, by - 5, 10, 3, c.water);
      T(-6, -7, 4, 1, c.waterL, 0.8); T(2, -4, 5, 1, c.waterL, 0.7);
      T(6, -7, 5, 4, c.steel, 0.9); T(6, -7, 5, 1, c.slate); T(8, -7, 1, 4, c.slate, 0.8);
    } else if (id === "egg") {
      p.r(cx - 3, by - 2, 7, 2, c.dwood); p.ell(cx, by - 8, 5, 6, c.cream); p.ell(cx, by - 8, 4, 5, "#FFFFFF", 0.35);
      p.px(cx - 2, by - 12, "#FFFFFF");
    } else if (id === "cengo") {
      p.box(cx - 14, by - 11, 28, 9, c.steel, c.slate, c.dark);
      p.ell(cx - 8, by - 7, 5, 3, c.graphite); p.ell(cx + 8, by - 7, 5, 3, c.graphite);
      p.ell(cx - 8, by - 7, 2, 1, LIT.orange); p.ell(cx + 8, by - 7, 2, 1, LIT.orange);
      T(-1, -10, 2, 6, c.ink); T(-1, -9, 2, 1, LIT.gold); T(-1, -6, 2, 1, LIT.jade);
    } else if (id === "stack") {
      p.ell(cx, by - 2, 10, 2, c.cream); p.ell(cx, by - 2, 8, 1, "#FFFFFF", 0.4);
      T(-7, -6, 14, 3, c.brass); T(-7, -6, 14, 1, c.gold);
      T(-6, -8, 13, 2, c.dwood); T(-7, -10, 14, 2, c.plant); T(-6, -12, 12, 2, c.gold); T(-7, -14, 14, 3, c.dorange); T(-6, -15, 12, 1, c.orange); T(-3, -14, 1, 1, c.cream);
    } else if (id === "sandwich") {
      T(-9, -3, 18, 3, c.lwood); T(-9, -3, 18, 1, c.floorW);
      T(-9, -5, 18, 2, c.red); T(-8, -5, 3, 1, "#FFFFFF", 0.3); T(-1, -5, 4, 1, "#FFFFFF", 0.3);
      T(-7, -7, 14, 2, c.cream); T(-3, -7, 5, 2, c.gold);
      T(-9, -11, 18, 4, c.lwood); T(-9, -11, 18, 1, c.floorW);
      T(1, -15, 1, 5, c.steel); T(2, -15, 3, 2, LIT.orange);
    } else if (id === "goldenhour") {
      p.r(cx - 10, by - 16, 20, 15, c.ol); p.r(cx - 9, by - 15, 18, 13, c.wood);
    } else if (id === "roof") {
      T(-14, -14, 2, 12, c.dwood); T(12, -14, 2, 12, c.dwood); T(-14, -14, 2, 1, c.wood); T(12, -14, 2, 1, c.wood);
      T(-12, -13, 24, 1, c.steel);
    } else if (id === "eggcursor") {
      p.ell(cx, by - 3, 10, 3, c.graphite); p.ell(cx, by - 4, 9, 2, c.steel);
      p.ell(cx - 1, by - 4, 6, 2, "#FFFFFF"); p.ell(cx + 1, by - 4, 2, 1, LIT.gold); T(-8, -5, 2, 1, "#FFFFFF");
    } else if (id === "pours") {
      T(-11, -2, 22, 2, c.steel);
      T(-10, -12, 4, 10, c.djade); T(-10, -12, 4, 1, c.jade); T(-9, -15, 2, 3, c.jade); T(-9, -16, 2, 1, c.gold); T(-9, -10, 1, 6, "#FFFFFF", 0.3);
      T(-2, -7, 6, 5, c.glass, 0.85); T(-1, -5, 4, 3, c.gold, 0.9); T(-2, -2, 6, 1, c.glass);
      T(7, -9, 6, 7, c.steel); T(7, -9, 6, 1, c.slate); T(8, -8, 4, 3, c.cream); T(9, -7, 1, 2, c.dorange);
    } else if (id === "limewash") {
      p.r(cx - 12, by - 14, 24, 12, c.ol);
      p.r(cx - 11, by - 13, 12, 10, c.conc); p.r(cx - 11, by - 13, 12, 10, c.floorD, 0.35);
      p.r(cx + 1, by - 13, 10, 10, c.cream); p.r(cx + 1, by - 13, 10, 1, "#FFFFFF", 0.5);
      p.px(cx - 8, by - 10, c.conc2); p.px(cx - 4, by - 7, c.conc2); p.px(cx - 6, by - 5, c.conc3);
      T(2, -11, 6, 1, c.floorW); T(3, -8, 7, 1, c.floorW); T(1, -5, 5, 1, c.floorW);
      T(4, -3, 9, 1, c.steel); T(11, -5, 3, 3, c.dwood);
    } else if (id === "dumpling") {
      p.ell(cx, by - 3, 12, 4, c.dwood); p.ell(cx, by - 4, 11, 3, c.lwood); p.r(cx - 11, by - 4, 22, 1, c.dwood, 0.5);
      p.ell(cx - 5, by - 6, 3, 2, c.cream); p.ell(cx + 1, by - 7, 3, 2, c.cream); p.ell(cx + 6, by - 6, 3, 2, c.cream);
      T(-6, -7, 2, 1, c.plasterS); T(0, -8, 2, 1, c.plasterS); T(5, -7, 2, 1, c.plasterS);
    } else if (id === "angry13") {
      T(-12, -3, 8, 3, c.dwood); T(-9, -10, 2, 8, c.wood); T(-7, -11, 1, 3, c.wood);
      T(-12, -11, 1, 3, c.wood); T(-12, -11, 3, 1, c.wood); T(-6, -11, 3, 1, c.wood);
      p.ell(cx - 8, by - 12, 2, 2, LIT.orange); T(-9, -13, 1, 1, "#FFFFFF"); T(-8, -13, 1, 1, "#FFFFFF");
      T(4, -3, 10, 3, c.wood); T(4, -3, 10, 1, c.lwood); T(5, -6, 3, 3, c.wood); T(10, -6, 3, 3, c.wood); T(5, -9, 8, 3, c.lwood);
      T(7, -12, 4, 3, c.plant); T(8, -11, 1, 1, "#FFFFFF"); T(10, -11, 1, 1, "#FFFFFF");
    }
  }
  function toyAnim(p, c, id, cx, by, t) {
    var T = function (x, y, w, h, col, a) { p.r(cx + x, by + y, w, h, col, a); }, i, ph, v;
    if (id === "eggtoss") {
      v = Math.abs(Math.sin(t * 2.6)); ph = Math.round(v * 6);
      p.ell(cx - 1, by - 9 - ph, 3, 2, "#FFFFFF"); p.ell(cx - 1, by - 9 - ph, 1, 1, LIT.gold);
      if (ph > 2) { T(-6, -8, 1, 2, "#FFFFFF", 0.4); T(4, -8, 1, 2, "#FFFFFF", 0.4); }
    } else if (id === "miramar") {
      ph = Math.floor(t * 6);
      for (i = 0; i < 14; i++) { p.px(cx - 14 + i * 2, by - 14, ((i + ph) % 2) ? LIT.gold : c.dorange); p.px(cx - 14 + i * 2, by - 4, ((i + ph + 1) % 2) ? LIT.gold : c.dorange); }
      p.r(cx - 14, by - 11, 28, 1, LIT.gold, 0.12);
    } else if (id === "tide") {
      v = Math.floor(t * 2) % 2; T(-6 + v, -7, 4, 1, c.waterL, 0.9); T(2 - v, -4, 5, 1, c.waterL, 0.8);
      T(-1, -6 + (v ? 0 : 0), 4, 2, LIT.orange); T(-2, -7, 1, 1, LIT.orange); T(3, -7, 1, 1, LIT.orange); T(0, -6, 1, 1, "#FFFFFF");
    } else if (id === "egg") {
      for (i = 0; i < 18; i++) {
        ph = i * 0.55 + t * 2.4;
        p.px(cx + Math.round(Math.cos(ph) * (1 + i * 0.17)), by - 8 + Math.round(Math.sin(ph) * (1 + i * 0.28)), LIT.gold);
      }
    } else if (id === "cengo") {
      ph = t * 4;
      p.px(cx - 8 + Math.round(Math.cos(ph) * 4), by - 7 + Math.round(Math.sin(ph) * 2), "#FFFFFF", 0.9);
      p.px(cx + 8 + Math.round(Math.cos(ph + 1.7) * 4), by - 7 + Math.round(Math.sin(ph + 1.7) * 2), "#FFFFFF", 0.9);
      T(-1, -8 + Math.round(Math.sin(t * 3) * 1.4), 2, 1, LIT.cream);
    } else if (id === "stack") {
      v = Math.round(Math.sin(t * 2) * 1.4); T(-7 + v, -14, 14, 3, c.dorange); T(-6 + v, -15, 12, 1, c.orange); T(-3 + v, -14, 1, 1, c.cream);
      T(-6, -12, 12, 2, c.gold); T(-7, -14, 0, 0, c.gold);
    } else if (id === "goldenhour") {
      var sun = (still() ? 0 : Math.sin(t * 0.9)) * 4, iy = by - 15, y2;
      p.clip(cx - 9, iy, 18, 13);
      for (y2 = 0; y2 < 13; y2++) { p.r(cx - 9, iy + y2, 18, 1, mix(c.sky, mix(c.sky2, LIT.orange, 0.5), y2 / 12)); }
      p.ell(cx, by - 8 - Math.round(sun), 3, 3, LIT.gold); p.ell(cx, by - 8 - Math.round(sun), 5, 5, LIT.gold, 0.2);
      p.r(cx - 9, by - 5, 18, 3, c.dwood); p.r(cx - 7, by - 7, 3, 2, c.dwood); p.r(cx + 3, by - 8, 4, 3, c.dwood);
      p.unclip();
    } else if (id === "roof") {
      for (i = 0; i < 5; i++) {
        var sw = Math.round(Math.sin(t * 1.6 + i * 0.7) * 1), on = ((Math.floor(t * 2) + i) % 5) !== 0 || still();
        T(-10 + i * 5 + sw, -12, 1, 3, c.dark); p.ell(cx - 10 + i * 5 + sw, by - 8, 1, 2, on ? LIT.gold : c.dorange);
        if (on) { T(-11 + i * 5 + sw, -9, 1, 1, LIT.cream); }
      }
    } else if (id === "eggcursor") {
      var ax = Math.round(Math.cos(t * 2.1) * 6), ay = Math.round(Math.sin(t * 2.1) * 2);
      T(ax - 1, -10 + ay, 1, 6, "#FFFFFF"); T(ax, -9 + ay, 1, 4, "#FFFFFF"); T(ax + 1, -8 + ay, 1, 2, "#FFFFFF"); T(ax + 2, -7 + ay, 1, 1, "#FFFFFF");
      T(ax - 2, -10 + ay, 1, 7, c.graphite, 0.9);
    } else if (id === "dumpling") {
      for (i = 0; i < 3; i++) {
        v = (t * 0.8 + i * 0.33) % 1;
        T(-5 + i * 5 + Math.round(Math.sin(t * 2 + i) * 1), -9 - Math.round(v * 6), 1, 2, "#FFFFFF", (1 - v) * 0.7);
      }
    } else if (id === "angry13") {
      v = Math.round(Math.sin(t * 5) * 0.6); p.ell(cx - 8, by - 12 + v, 2, 2, LIT.orange);
    } else if (id === "carlos") {
      if ((Math.floor(t * 2) % 2) === 0) { T(-4, -12, 1, 1, LIT.gold); }
    } else if (id === "limewash") {
      v = Math.round(Math.sin(t * 1.8) * 2); T(3 + v, -11, 3, 1, c.floorW);
    } else if (id === "pours") {
      v = (t * 1.2) % 1; T(-8, -15 + Math.round(v * 8), 1, 2, LIT.gold, 0.8 * (1 - v));
    }
  }
  function drawBench(p, W, H, c, o, tid) {
    var x0 = (W - 32) >> 1, yT = H - 17, i;
    shadow(p, W, H, x0 + 2);
    p.r(x0 + 3, yT + 9, 3, 8, c.dwood); p.r(x0 + 26, yT + 9, 3, 8, c.dwood);
    p.r(x0 + 3, yT + 9, 1, 8, c.wood);
    p.r(x0 + 1, yT + 5, 30, 5, c.wood); p.r(x0 + 1, yT + 5, 30, 1, c.lwood);
    p.r(x0 + 1, yT + 9, 30, 1, c.dwood);
    p.r(x0 + 11, yT + 6, 10, 3, c.dwood); p.r(x0 + 12, yT + 7, 8, 1, c.wood); p.r(x0 + 15, yT + 7, 2, 1, c.gold);
    p.r(x0, yT, 32, 5, c.lwood); p.r(x0, yT, 32, 1, c.floorW, 0.7); p.r(x0, yT + 4, 32, 1, c.wood);
    for (i = 0; i < 4; i++) { p.px(x0 + 3 + i * 8, yT + 2, c.wood, 0.7); p.px(x0 + 6 + i * 8, yT + 3, c.wood, 0.5); }
    toyBase(p, c, tid, x0 + 16, yT + 3);
    p.r(x0 + 1, yT + 5, 1, 5, "#FFFFFF", 0.12);
  }
  function animBench(p, W, H, c, o, t, tid) { var x0 = (W - 32) >> 1, yT = H - 17; toyAnim(p, c, tid, x0 + 16, yT + 3, t); }

  /* ---------- fixtures ---------- */
  function drawCounter(p, W, H, c) {
    var i, pw, x;
    shadow(p, W, H, 1);
    p.r(0, 10, W, 5, c.lwood); p.r(0, 10, W, 1, c.floorW); p.r(0, 14, W, 1, c.wood);
    p.r(0, 15, W, 13, c.wood); p.r(0, 15, W, 1, c.dwood, 0.7);
    for (i = 0; i < Math.floor(W / 16); i++) {
      x = i * 16 + 2; p.r(x, 17, 12, 9, c.dwood); p.r(x + 1, 18, 10, 7, c.wood); p.r(x + 1, 18, 10, 1, c.lwood, 0.6);
    }
    pw = W >> 1; p.r(pw - 14, 16, 28, 11, c.ol); p.r(pw - 13, 17, 26, 9, c.graphite);
    p.txt("K13", pw - 11, 18, c.orange, 2, 1);
    p.r(0, 28, W, 3, c.dwood); p.r(0, 28, W, 1, c.ol, 0.6);
    /* things on the counter */
    p.r(8, 5, 11, 7, c.steel); p.r(8, 5, 11, 1, c.slate); p.r(9, 6, 9, 4, c.dark); p.r(10, 7, 6, 1, LIT.jade); p.r(10, 9, 3, 1, LIT.gold, 0.8);
    p.ell(pw, 8, 3, 2, c.gold); p.r(pw - 3, 9, 7, 2, c.brass); p.px(pw, 5, c.white);
    p.r(pw + 14, 3, 1, 7, c.ink); p.r(pw + 11, 1, 7, 3, c.orange); p.r(pw + 11, 1, 7, 1, LIT.orange);
    p.r(W - 22, 6, 6, 4, c.cream); p.r(W - 22, 6, 6, 1, c.white); p.r(W - 21, 8, 4, 1, c.slate, 0.6);
    p.r(W - 12, 6, 5, 5, c.cream); p.r(W - 7, 7, 2, 3, c.cream); p.r(W - 11, 7, 3, 2, c.dwood);
    p.r(24, 8, 8, 2, c.jade); p.r(24, 8, 8, 1, LIT.jade, 0.6);
  }
  function drawNeonK13(p, W, H, c) {
    var K13 = ["oo....oo", "oo...oo.", "oo..oo..", "oo.oo...", "ooooo...", "oooo....", "ooooo...", "oo.oo...", "oo..oo..", "oo...oo.", "oo....oo"],
      ONE = ["..oo..", ".ooo..", "oooo..", "..oo..", "..oo..", "..oo..", "..oo..", "..oo..", "..oo..", ".oooo.", "oooooo"],
      THREE = [".oooooo.", "oo....oo", "......oo", "......oo", "...oooo.", "...oooo.", "......oo", "......oo", "......oo", "oo....oo", ".oooooo."],
      x = (W - 26) >> 1, y = Math.floor((H - 11) / 2), leg = { o: c.dorange };
    p.r(0, 0, W, H, c.ol); p.r(1, 1, W - 2, H - 2, c.graphite); p.r(1, 1, W - 2, 1, c.steel);
    p.px(2, 2, c.slate); p.px(W - 3, 2, c.slate); p.px(2, H - 3, c.slate); p.px(W - 3, H - 3, c.slate);
    p.map(x, y, K13, leg); p.map(x + 10, y, ONE, leg); p.map(x + 18, y, THREE, leg);
  }
  function animNeonK13(p, W, H, c, o, t) {
    var K13 = ["oo....oo", "oo...oo.", "oo..oo..", "oo.oo...", "ooooo...", "oooo....", "ooooo...", "oo.oo...", "oo..oo..", "oo...oo.", "oo....oo"],
      ONE = ["..oo..", ".ooo..", "oooo..", "..oo..", "..oo..", "..oo..", "..oo..", "..oo..", "..oo..", ".oooo.", "oooooo"],
      THREE = [".oooooo.", "oo....oo", "......oo", "......oo", "...oooo.", "...oooo.", "......oo", "......oo", "......oo", "oo....oo", ".oooooo."],
      x = (W - 26) >> 1, y = Math.floor((H - 11) / 2), f = 1, k = Math.floor(t * 7), v;
    if (!still()) { v = Math.sin(k * 12.9898) * 43758.5453; v = v - Math.floor(v); if ((Math.floor(t) % 5) === 3 && v > 0.45) { f = 0.3; } }
    p.ctx.globalAlpha = 1;
    p.map(x, y, K13, { o: LIT.orange }); p.map(x + 18, y, THREE, { o: LIT.orange });
    p.ctx.globalAlpha = f; p.map(x + 10, y, ONE, { o: LIT.orange }); p.ctx.globalAlpha = 1;
  }
  function drawNeonFree(p, W, H, c) {
    p.r(0, 0, W, H, c.ol); p.r(1, 1, W - 2, H - 2, c.graphite); p.r(1, 1, W - 2, 1, c.steel);
    p.txt("FREE PLAY", Math.floor((W - textW("FREE PLAY", 1, 1)) / 2), 5, c.djade, 1, 1);
  }
  function animNeonFree(p, W, H, c, o, t) { p.txt("FREE PLAY", Math.floor((W - textW("FREE PLAY", 1, 1)) / 2), 5, LIT.jade, 1, 1); p.r(3, 2, W - 6, 1, LIT.jade, 0.3 + 0.15 * Math.sin(t * 5)); }
  function drawGuestbook(p, W, H, c) {
    var x = (W - 16) >> 1;
    shadow(p, W, H, x + 2);
    p.r(x + 3, H - 9, 2, 8, c.dwood); p.r(x + 11, H - 9, 2, 8, c.dwood); p.r(x + 2, H - 10, 12, 2, c.wood);
    p.r(x + 1, H - 15, 14, 6, c.ol); p.r(x + 2, H - 14, 6, 4, c.cream); p.r(x + 8, H - 14, 6, 4, c.paper);
    p.r(x + 7, H - 14, 1, 4, c.floorD);
    p.r(x + 3, H - 13, 4, 1, c.slate, 0.7); p.r(x + 3, H - 11, 3, 1, c.slate, 0.7); p.r(x + 9, H - 13, 4, 1, c.slate, 0.7); p.r(x + 9, H - 11, 2, 1, c.orange);
    p.r(x + 13, H - 17, 1, 5, c.steel); p.px(x + 13, H - 18, c.orange); p.px(x + 14, H - 11, c.slate, 0.8);
  }
  function drawDoorFront(p, W, H, c) {
    var night = c === PAL_NIGHT, i;
    p.r(0, 0, W, H, c.ol); p.r(1, 1, W - 2, H - 2, c.dwood);
    p.r(2, 2, W - 4, H - 4, c.wood);
    p.r(4, 4, W - 8, 6, night ? "#14202A" : "#BFE3E0"); p.r(4, 4, W - 8, 1, "#FFFFFF", 0.35);
    p.r(4, 11, (W - 9) >> 1, H - 14, night ? "#1B2B36" : "#CFE9E4");
    p.r(4 + ((W - 9) >> 1) + 1, 11, (W - 9) >> 1, H - 14, night ? "#1B2B36" : "#CFE9E4");
    p.r((W >> 1) - 1, 4, 2, H - 6, c.dwood);
    for (i = 0; i < 3; i++) { p.r(5 + i * 2, 12 + i * 3, 3, 1, "#FFFFFF", night ? 0.1 : 0.45); }
    if (night) { p.r(5, H - 5, W - 10, 3, LIT.gold, 0.25); }
    p.r((W >> 1) - 5, 16, 2, 7, c.brass); p.r((W >> 1) + 3, 16, 2, 7, c.brass);
    p.r((W >> 1) - 4, 6, 8, 3, c.cream); p.txt("OPEN", (W >> 1) - 7, 10, c.jade, 1, 1);
    p.r(0, H - 2, W, 2, c.dwood);
  }
  function animDoorFront(p, W, H, c, o, t) { var cx = W >> 1; p.txt("OPEN", cx - 7, 10, LIT.jade, 1, 1); }
  function drawDoorBack(p, W, H, c, o) {
    var open = o && o.open, i;
    p.r(0, 0, W, H, c.ol); p.r(1, 1, W - 2, H - 2, c.steel);
    if (open) {
      p.r(3, 3, W - 6, H - 5, c.dark); p.r(3, 3, W - 6, 2, "#000000", 0.5);
      p.r(W - 9, 3, 6, H - 5, c.slate); p.r(W - 9, 3, 1, H - 5, c.ink);
      p.r(5, H - 6, W - 14, 3, LIT.jade, 0.18);
      return;
    }
    p.r(3, 3, W - 6, H - 5, c.slate); p.r(3, 3, W - 6, 1, "#FFFFFF", 0.2);
    for (i = 0; i < 4; i++) { p.px(5, 6 + i * 6, c.ink); p.px(W - 6, 6 + i * 6, c.ink); }
    p.r(6, 5, W - 12, 8, c.ink); p.txt("13", (W >> 1) - 3, 7, c.dorange, 1, 1);
    p.r(W - 9, 16, 3, 4, c.dark); p.r(W - 8, 17, 1, 2, c.brass);
    p.r(3, H - 3, W - 6, 1, "#000000", 0.35);
  }
  function animDoorBack(p, W, H, c, o, t) {
    if (o && o.open) { return; }
    p.px((W >> 1) + 5, 6, (Math.floor(t * 1.5) % 2) ? LIT.red : c.dorange);
    p.txt("13", (W >> 1) - 3, 7, LIT.orange, 1, 1); p.r(5, 5, W - 10, 1, LIT.orange, 0.12);
  }
  function drawKeypad(p, W, H, c) {
    var x = (W - 10) >> 1, y = (H - 14) >> 1, i, j;
    p.r(x - 1, y - 1, 12, 16, c.ol); p.r(x, y, 10, 14, c.graphite); p.r(x, y, 10, 1, c.steel);
    p.r(x + 1, y + 1, 8, 3, c.dark); p.r(x + 2, y + 2, 4, 1, c.dorange, 0.8);
    for (j = 0; j < 4; j++) { for (i = 0; i < 3; i++) { p.r(x + 1 + i * 3, y + 5 + j * 2, 2, 1, c.slate); } }
    p.px(x + 8, y + 2, c.dorange);
  }
  function animKeypad(p, W, H, c, o, t) {
    var x = (W - 10) >> 1, y = (H - 14) >> 1;
    p.px(x + 8, y + 2, (Math.floor(t * 1.3) % 2) ? LIT.red : c.dorange); p.r(x + 2, y + 2, 4, 1, LIT.orange, 0.8);
  }
  function drawChange(p, W, H, c) {
    var x = (W - 16) >> 1;
    shadow(p, W, H, x + 1);
    p.r(x + 1, 1, 14, H - 3, c.ol); p.r(x + 2, 2, 12, H - 5, c.slate); p.r(x + 2, 2, 12, 1, "#FFFFFF", 0.25); p.r(x + 13, 2, 1, H - 5, "#000000", 0.25);
    p.r(x + 3, 3, 10, 6, c.dorange); p.r(x + 3, 3, 10, 1, c.orange);
    p.ell(x + 8, 6, 3, 2, c.gold); p.px(x + 8, 6, c.dwood);
    p.r(x + 4, 11, 8, 4, c.dark); p.r(x + 5, 12, 6, 1, LIT.jade, 0.8);
    p.r(x + 4, 17, 8, 2, c.dark); p.r(x + 5, 18, 6, 1, c.steel);
    p.r(x + 4, H - 11, 8, 5, c.ink); p.r(x + 5, H - 10, 6, 3, c.dark); p.px(x + 6, H - 9, c.gold); p.px(x + 9, H - 10, c.gold);
    p.r(x + 3, H - 5, 10, 2, c.dark);
  }
  function animChange(p, W, H, c, o, t) { var x = (W - 16) >> 1; p.r(x + 5, 12, 6, 1, LIT.jade, 0.5 + 0.4 * Math.sin(t * 3)); }
  function drawScoreboard(p, W, H, c, o) {
    var rows = ["K13 9013", "EGG 8013", "BAR 7013"], i, tx = Math.floor((W - 31) / 2);
    p.r(0, 0, W, H, c.ol); p.r(1, 1, W - 2, H - 2, c.dwood); p.r(2, 2, W - 4, H - 4, c.dark);
    p.txt("HI-SCORE", Math.floor((W - textW("HI-SCORE", 1, 1)) / 2), 3, c.dorange, 1, 1);
    p.r(4, 9, W - 8, 1, c.dorange, 0.5);
    for (i = 0; i < 3; i++) { p.txt((o && o.you && i === 0) ? "YOU 0013" : rows[i], tx, 12 + i * 6, i === 0 ? c.gold : c.jade, 1, 1); }
    p.px(2, 2, c.steel); p.px(W - 3, 2, c.steel);
  }
  function animScoreboard(p, W, H, c, o, t) {
    var tx = Math.floor((W - 31) / 2);
    p.txt("HI-SCORE", Math.floor((W - textW("HI-SCORE", 1, 1)) / 2), 3, LIT.orange, 1, 1);
    if ((Math.floor(t * 2) % 2) === 0 || still()) { p.txt((o && o.you) ? "YOU 0013" : "K13 9013", tx, 12, LIT.gold, 1, 1); }
    p.txt("EGG 8013", tx, 18, LIT.jade, 1, 1); p.txt("BAR 7013", tx, 24, LIT.jade, 1, 1);
  }
  function drawClaw(p, W, H, c) {
    var x = (W - 32) >> 1, i;
    shadow(p, W, H, x + 1);
    p.r(x + 1, 1, 30, H - 3, c.ol); p.r(x + 2, 2, 28, 10, c.dorange); p.r(x + 2, 2, 28, 1, c.orange);
    p.txt("CLAW", x + 8, 5, c.gold, 1, 1);
    p.r(x + 3, 12, 26, 20, c.dark); p.r(x + 4, 13, 24, 18, "#9BD0CC", 0.12);
    p.r(x + 3, 12, 26, 1, c.steel); p.r(x + 3, 12, 1, 20, c.steel); p.r(x + 28, 12, 1, 20, c.steel);
    p.r(x + 4, 28, 24, 3, c.sand, 0.55);
    var cols = [c.orange, c.jade, c.gold, c.red, c.cream, c.plant], px = [6, 11, 16, 21, 8, 24], py = [26, 25, 26, 25, 22, 22];
    for (i = 0; i < 6; i++) { p.ell(x + px[i], py[i], 2, 2, cols[i]); p.px(x + px[i] - 1, py[i] - 1, "#FFFFFF", 0.5); p.px(x + px[i] - 1, py[i], c.ink); p.px(x + px[i] + 1, py[i], c.ink); }
    p.r(x + 4, 13, 24, 1, c.steel, 0.8);
    p.r(x + 2, 32, 28, H - 35, c.slate); p.r(x + 2, 32, 28, 1, c.steel);
    p.r(x + 7, 35, 2, 2, c.red); p.r(x + 6, 37, 4, 1, c.ink); p.r(x + 18, 35, 3, 3, c.gold); p.r(x + 23, 35, 3, 3, c.jade);
    p.r(x + 3, H - 8, 26, 6, c.dark); p.r(x + 12, H - 7, 8, 3, c.ink);
    p.r(x + 3, 12, 26, 20, c.glass, 0.08);
  }
  function animClaw(p, W, H, c, o, t) {
    var x = (W - 32) >> 1, cx = x + 16 + Math.round(Math.sin(t * 0.9) * 7), d = Math.round((Math.sin(t * 0.9 * 2) + 1) * 4), i;
    p.txt("CLAW", x + 8, 5, LIT.gold, 1, 1);
    p.r(x + 5, 14, 22, 1, c.slate); p.r(cx - 1, 14, 3, 2, c.steel);
    p.r(cx, 16, 1, 3 + d, c.slate);
    p.r(cx - 2, 19 + d, 5, 1, c.steel); p.px(cx - 3, 20 + d, c.steel); p.px(cx + 3, 20 + d, c.steel); p.px(cx - 3, 21 + d, c.steel); p.px(cx + 3, 21 + d, c.steel);
    for (i = 0; i < 3; i++) { p.px(x + 4 + i * 2, 3, (Math.floor(t * 4) + i) % 2 ? LIT.gold : c.dorange); }
  }
  function drawCouch(p, W, H, c) {
    var i, nc = Math.max(2, Math.floor((W - 12) / 16));
    shadow(p, W, H, 2);
    p.r(1, 2, W - 2, 14, c.ol); p.r(2, 3, W - 4, 12, c.djade); p.r(2, 3, W - 4, 2, c.jade);
    for (i = 0; i < nc; i++) { p.r(5 + i * ((W - 10) / nc), 6, Math.floor((W - 10) / nc) - 1, 8, c.djade); p.r(5 + i * ((W - 10) / nc), 6, Math.floor((W - 10) / nc) - 1, 1, c.jade, 0.7); }
    p.r(1, 12, W - 2, 12, c.ol); p.r(2, 13, W - 4, 10, c.jade); p.r(2, 13, W - 4, 1, "#FFFFFF", 0.25);
    for (i = 1; i < nc; i++) { p.r(4 + Math.round(i * ((W - 8) / nc)), 14, 1, 8, c.djade); }
    p.r(1, 9, 5, 16, c.ol); p.r(2, 10, 3, 14, c.djade); p.r(W - 6, 9, 5, 16, c.ol); p.r(W - 5, 10, 3, 14, c.djade);
    p.r(5, 16, 7, 6, c.orange); p.r(5, 16, 7, 1, LIT.orange, 0.8); p.r(6, 18, 5, 1, c.gold, 0.7); p.px(5, 16, c.dorange);
    p.r(W - 16, 17, 6, 5, c.cream); p.r(W - 16, 17, 6, 1, c.white);
    p.r(3, 25, 2, 3, c.dwood); p.r(W - 5, 25, 2, 3, c.dwood);
  }
  function drawBookshelf(p, W, H, c) {
    var sh = [Math.floor(H * 0.12), Math.floor(H * 0.45), Math.floor(H * 0.78)], i, j, x, cols = [c.orange, c.jade, c.gold, c.cream, c.steel, c.red, c.djade, c.lwood, c.slate], ht, row;
    shadow(p, W, H, 1);
    p.r(0, 0, W, H - 1, c.ol); p.r(1, 1, W - 2, H - 3, c.dwood); p.r(2, 2, W - 4, H - 5, c.ink);
    for (row = 0; row < 3; row++) {
      var top = (row === 0) ? 3 : sh[row] - 8, bot = (row === 2) ? H - 5 : (row === 0 ? sh[1] - 1 : sh[2] - 1);
      var ytop = 3 + row * Math.floor((H - 8) / 3), ybot = ytop + Math.floor((H - 8) / 3) - 1;
      x = 3;
      for (j = 0; x < W - 5; j++) {
        ht = 5 + Math.floor(hash(j, row, 41) * 4); var wd = 2 + Math.floor(hash(j, row, 42) * 2);
        if (x + wd > W - 4) { break; }
        var col = cols[Math.floor(hash(j, row, 43) * cols.length)];
        if (row === 1 && j === 3) { col = c.orange; ht = ybot - ytop; p.r(x, ybot - ht + 1, wd, ht, col); p.r(x, ybot - ht + 1, wd, 1, LIT.orange, 0.6); p.px(x, ybot - 2, c.gold); x += wd + 1; continue; }
        p.r(x, ybot - ht, wd, ht, col); p.r(x, ybot - ht, wd, 1, "#FFFFFF", 0.22); p.px(x, ybot - 2, c.cream, 0.55);
        x += wd + (hash(j, row, 44) > 0.8 ? 2 : 0);
      }
      p.r(2, ybot + 1, W - 4, 2, c.wood);
    }
    p.r(W - 8, 3, 5, 3, c.cream); p.r(W - 7, 1, 3, 2, c.plant);
  }
  function drawCoffee(p, W, H, c) {
    var x = (W - 16) >> 1;
    shadow(p, W, H, x + 1);
    p.r(x + 1, H - 14, 14, 13, c.ol); p.r(x + 2, H - 13, 12, 11, c.wood); p.r(x + 3, H - 11, 10, 8, c.dwood); p.px(x + 8, H - 9, c.gold);
    p.r(x + 1, H - 15, 14, 2, c.lwood);
    p.r(x + 2, H - 27, 12, 12, c.ol); p.r(x + 3, H - 26, 10, 10, c.steel); p.r(x + 3, H - 26, 10, 1, c.slate); p.r(x + 12, H - 26, 1, 10, c.ink);
    p.r(x + 4, H - 25, 5, 3, c.dark); p.r(x + 5, H - 24, 2, 1, LIT.jade);
    p.r(x + 10, H - 25, 2, 2, c.orange); p.px(x + 10, H - 25, LIT.orange);
    p.r(x + 5, H - 19, 6, 1, c.ink); p.r(x + 7, H - 20, 2, 2, c.ink);
    p.r(x + 6, H - 17, 4, 2, c.cream); p.r(x + 6, H - 17, 4, 1, c.white); p.px(x + 10, H - 16, c.cream);
  }
  function animCoffee(p, W, H, c, o, t) {
    var x = (W - 16) >> 1, i, v;
    p.px(x + 5, H - 24, LIT.jade);
    for (i = 0; i < 3; i++) { v = (t * 0.7 + i * 0.33) % 1; p.px(x + 7 + Math.round(Math.sin(t * 3 + i * 2)), H - 19 - Math.round(v * 6), "#FFFFFF", (1 - v) * 0.7); }
  }
  function drawPinball(p, W, H, c) {
    var x = (W - 32) >> 1, i;
    shadow(p, W, H, x + 1);
    p.r(x + 1, 0, 30, 15, c.ol); p.r(x + 2, 1, 28, 13, "#0B0C0E");
    p.r(x + 2, 1, 28, 1, c.orange, 0.6);
    p.txt("PINBALL", x + 3, 3, c.dorange, 1, 1);
    p.r(x + 4, 10, 24, 2, c.dorange, 0.6); p.r(x + 4, 9, 24, 1, c.gold, 0.5);
    p.r(x, 15, 32, 20, c.ol); p.r(x + 1, 16, 30, 18, c.orange); p.r(x + 1, 16, 30, 1, LIT.orange);
    p.r(x + 3, 18, 26, 14, c.djade); p.r(x + 3, 18, 26, 1, c.jade); p.r(x + 3, 18, 1, 14, c.jade, 0.6);
    p.ell(x + 15, 21, 2, 2, c.dark); p.ell(x + 9, 25, 2, 2, c.dark); p.ell(x + 21, 25, 2, 2, c.dark); p.r(x + 6, 19, 1, 4, c.jade, 0.6); p.r(x + 25, 19, 1, 4, c.jade, 0.6);
    p.r(x + 8, 30, 6, 1, c.orange); p.r(x + 18, 30, 6, 1, c.orange); p.r(x + 8, 29, 1, 1, c.orange); p.r(x + 23, 29, 1, 1, c.orange);
    p.r(x + 3, 18, 26, 14, c.glass, 0.1);
    p.r(x + 4, 35, 3, H - 38, c.steel); p.r(x + 25, 35, 3, H - 38, c.steel); p.r(x + 3, 35, 26, 3, c.dwood); p.r(x + 3, 35, 26, 1, c.wood);
    p.r(x + 12, 36, 8, 1, c.gold);
  }
  function animPinball(p, W, H, c, o, t) {
    var x = (W - 32) >> 1, ph = Math.floor(t * 3), bx = 15 + Math.round(Math.sin(t * 1.7) * 8), by = 21 + Math.round(Math.abs(Math.sin(t * 2.3)) * 7);
    p.txt("PINBALL", x + 3, 3, LIT.orange, 1, 1);
    p.ell(x + 15, 21, 1, 1, (ph % 3 === 0) ? LIT.gold : c.gold); p.ell(x + 9, 25, 1, 1, (ph % 3 === 1) ? LIT.gold : c.gold); p.ell(x + 21, 25, 1, 1, (ph % 3 === 2) ? LIT.gold : c.gold);
    p.px(x + bx, by, "#FFFFFF"); p.px(x + bx + 1, by, "#FFFFFF", 0.5);
  }
  function drawFishtank(p, W, H, c) {
    var x = (W - 32) >> 1, i;
    shadow(p, W, H, x + 1);
    p.r(x + 4, H - 10, 3, 9, c.dwood); p.r(x + 25, H - 10, 3, 9, c.dwood); p.r(x + 2, H - 12, 28, 3, c.wood); p.r(x + 2, H - 12, 28, 1, c.lwood);
    p.r(x + 1, 1, 30, H - 12, c.ol); p.r(x + 2, 2, 28, H - 14, c.water);
    for (i = 0; i < H - 14; i++) { p.r(x + 2, 2 + i, 28, 1, c.waterL, 0.22 * (1 - i / (H - 14))); }
    p.r(x + 2, H - 17, 28, 4, c.sand); p.px(x + 7, H - 17, c.floorD); p.px(x + 19, H - 16, c.floorD);
    p.r(x + 8, H - 24, 1, 8, c.plant); p.r(x + 9, H - 22, 1, 6, c.dplant); p.r(x + 7, H - 21, 1, 5, c.dplant); p.r(x + 9, H - 26, 1, 4, c.plant);
    p.r(x + 22, H - 22, 1, 6, c.plant); p.r(x + 23, H - 24, 1, 8, c.dplant); p.r(x + 21, H - 20, 1, 4, c.dplant);
    p.r(x + 13, H - 18, 4, 3, c.slate); p.r(x + 14, H - 18, 2, 1, c.conc3);
    p.r(x + 2, 2, 28, 1, "#FFFFFF", 0.3); p.r(x + 3, 3, 1, H - 16, "#FFFFFF", 0.2);
    p.r(x + 1, 1, 30, 2, c.steel);
  }
  function animFishtank(p, W, H, c, o, t) {
    var x = (W - 32) >> 1, i, rx, ry, dir, px, py, tt = still() ? STILL_T : t, col, cols = [c.orange, c.gold, c.jade, c.cream, c.white, c.red];
    function tri(v, r) { var m = ((v % (2 * r)) + 2 * r) % (2 * r); return m < r ? m : 2 * r - m; }
    for (i = 0; i < 13; i++) {
      rx = 18; ry = Math.max(6, H - 26);
      px = 4 + tri(hash(i, 1, 51) * 40 + tt * (1.2 + hash(i, 2, 51) * 2.2), rx);
      py = 4 + Math.round(hash(i, 3, 51) * (ry - 2) + Math.sin(tt * 1.3 + i) * 1.2);
      dir = (Math.floor((hash(i, 1, 51) * 40 + tt * (1.2 + hash(i, 2, 51) * 2.2)) / rx) % 2 === 0) ? 1 : -1;
      col = (i === 0) ? LIT.orange : cols[i % cols.length];
      p.r(x + px, py, 3, 2, col); p.px(x + px + (dir > 0 ? 3 : -1), py, col, 0.8); p.px(x + px + (dir > 0 ? 2 : 0), py, c.dark, 0.9);
      if (i === 0) { p.px(x + px + 1, py - 1, LIT.gold); p.px(x + px, py - 2, LIT.gold); p.px(x + px + 2, py - 2, LIT.gold); }
    }
    for (i = 0; i < 3; i++) { var bv = (tt * 0.5 + i * 0.3) % 1; p.px(x + 9 + i, H - 25 - Math.round(bv * 10), "#FFFFFF", (1 - bv) * 0.8); }
  }
  function drawRecords(p, W, H, c) {
    var x = (W - 16) >> 1;
    shadow(p, W, H, x + 1);
    p.r(x + 1, H - 9, 14, 8, c.ol); p.r(x + 2, H - 8, 12, 6, c.wood); p.r(x + 2, H - 8, 12, 1, c.lwood); p.r(x + 4, H - 5, 8, 2, c.dwood);
    p.r(x + 1, H - 13, 14, 5, c.ol); p.r(x + 2, H - 12, 12, 3, c.steel); p.r(x + 2, H - 12, 12, 1, c.slate);
    p.ell(x + 7, H - 11, 5, 2, c.graphite); p.ell(x + 7, H - 11, 1, 1, c.orange);
    p.r(x + 12, H - 14, 2, 1, c.slate); p.r(x + 13, H - 13, 1, 3, c.slate);
    p.r(x + 4, H - 6, 2, 1, c.gold);
  }
  function animRecords(p, W, H, c, o, t) {
    var x = (W - 16) >> 1, a = t * 5.4;
    p.ell(x + 7, H - 11, 1, 1, LIT.orange);
    p.px(x + 7 + Math.round(Math.cos(a) * 3.2), H - 11 + Math.round(Math.sin(a) * 1.3), "#FFFFFF", 0.85);
    if (isNight() && !still()) { p.px(x + 3 + Math.floor((t * 2) % 3) * 4, H - 16 - Math.floor((t * 2) % 3), LIT.gold, 0.8); }
  }
  function drawWhiteboard(p, W, H, c) {
    var i, bx = 4, bw = W - 8, bh = H - 10;
    shadow(p, W, H, 2);
    p.r(1, 0, W - 2, H - 5, c.ol); p.r(2, 1, W - 4, H - 7, c.steel); p.r(3, 2, W - 6, H - 9, c.paper); p.r(3, 2, W - 6, 1, "#FFFFFF");
    p.r(3, 2, 1, H - 9, c.cream, 0.0);
    /* sketch: WISH cloud -> arrow -> WORKS box */
    p.ell(14, 10, 8, 4, "#FFFFFF"); p.ell(14, 10, 8, 4, c.paper); p.r(6, 10, 17, 1, c.paper);
    p.ol(5, 6, 18, 9, c.orange); p.r(5, 6, 1, 1, c.paper); p.r(22, 6, 1, 1, c.paper); p.r(5, 14, 1, 1, c.paper); p.r(22, 14, 1, 1, c.paper);
    p.txt("WISH", 8, 8, c.dorange, 1, 1);
    p.r(25, 10, 6, 1, c.graphite); p.px(29, 9, c.graphite); p.px(29, 11, c.graphite); p.px(30, 10, c.graphite);
    p.ol(32, 6, 11, 9, c.jade); p.txt("OK", 34, 8, c.djade, 1, 1);
    /* four craft steps */
    var sx = 9, cols = [c.slate, c.jade, c.gold, c.orange];
    for (i = 0; i < 4; i++) { p.r(sx + i * 7, 22 - i * 2, 6, 3 + i * 2, cols[i]); p.r(sx + i * 7, 22 - i * 2, 6, 1, "#FFFFFF", 0.35); }
    p.px(sx + 21, 14, c.orange); p.px(sx + 22, 13, c.orange); p.px(sx + 23, 14, c.orange);
    p.r(5, H - 7, W - 10, 2, c.steel); p.r(8, H - 8, 3, 1, c.orange); p.r(12, H - 8, 3, 1, c.jade); p.r(16, H - 8, 3, 1, c.graphite);
    p.r(W - 16, 4, 8, 1, c.slate, 0.4); p.r(W - 16, 6, 6, 1, c.slate, 0.4);
  }
  function drawPrinter(p, W, H, c) {
    var x = (W - 16) >> 1;
    shadow(p, W, H, x + 1);
    p.r(x + 1, H - 9, 14, 8, c.ol); p.r(x + 2, H - 8, 12, 6, c.cream); p.r(x + 2, H - 8, 12, 1, c.white); p.r(x + 2, H - 4, 12, 2, c.slate);
    p.r(x + 4, H - 10, 8, 2, c.paper); p.r(x + 5, H - 12, 6, 3, c.white); p.r(x + 6, H - 11, 4, 1, c.orange, 0.8); p.r(x + 6, H - 13, 3, 1, c.white);
    p.r(x + 4, H - 6, 8, 1, c.dark); p.px(x + 12, H - 7, c.jade);
  }
  function animPrinter(p, W, H, c, o, t) { var x = (W - 16) >> 1; p.px(x + 12, H - 7, (Math.floor(t * 2) % 2) ? LIT.jade : c.djade); }
  function drawRadio(p, W, H, c) {
    var x = (W - 16) >> 1;
    shadow(p, W, H, x + 1);
    p.r(x + 1, H - 11, 14, 10, c.ol); p.r(x + 2, H - 10, 12, 8, c.wood); p.r(x + 2, H - 10, 12, 1, c.lwood);
    p.r(x + 3, H - 8, 5, 5, c.dark); p.px(x + 4, H - 7, c.steel); p.px(x + 6, H - 7, c.steel); p.px(x + 4, H - 5, c.steel); p.px(x + 6, H - 5, c.steel);
    p.r(x + 9, H - 8, 4, 2, c.cream); p.px(x + 10, H - 8, c.dorange); p.ell(x + 10, H - 4, 1, 1, c.gold); p.px(x + 13, H - 4, c.gold);
    p.r(x + 12, H - 16, 1, 5, c.steel); p.px(x + 13, H - 17, c.steel);
  }
  function animRadio(p, W, H, c, o, t) {
    var x = (W - 16) >> 1, d = Math.floor(t * 2) % 3;
    p.px(x + 10 + (d % 2), H - 8, LIT.gold);
    if (isNight() && !still()) { p.px(x + 14, H - 10 - d, LIT.cream, 0.7); p.px(x + 15, H - 11 - d, LIT.cream, 0.4); }
  }
  function drawPegboard(p, W, H, c) {
    var i, j;
    p.r(0, 0, W, H - 2, c.ol); p.r(1, 1, W - 2, H - 4, c.floorM);
    for (j = 0; j < Math.floor((H - 6) / 4); j++) { for (i = 0; i < Math.floor((W - 4) / 4); i++) { p.px(3 + i * 4, 4 + j * 4, c.floorS); } }
    /* hammer */
    p.r(5, 6, 1, 14, c.wood); p.r(3, 5, 6, 3, c.steel); p.r(3, 5, 6, 1, c.slate);
    /* wrench */
    p.r(15, 8, 2, 14, c.slate); p.r(13, 5, 6, 4, c.slate); p.r(15, 6, 2, 2, c.floorM);
    /* saw */
    p.r(24, 6, 10, 5, c.steel); p.r(24, 6, 10, 1, c.slate); p.r(33, 8, 3, 2, c.orange); for (i = 0; i < 5; i++) { p.px(24 + i * 2, 11, c.steel); }
    /* ruler */
    p.r(39, 5, 3, 17, c.gold); for (i = 0; i < 8; i++) { p.px(39, 6 + i * 2, c.dwood); }
    /* pliers */
    p.r(w2(W, 8), 8, 2, 10, c.orange); p.r(w2(W, 8) + 3, 8, 2, 10, c.orange); p.r(w2(W, 8) - 1, 6, 6, 3, c.steel);
    /* the missing tool: an outline of a key */
    p.ol(W - 6, H - 14, 3, 3, c.floorS); p.r(W - 5, H - 11, 1, 6, c.floorS); p.px(W - 4, H - 8, c.floorS); p.px(W - 4, H - 6, c.floorS);
    p.r(0, H - 4, W, 2, c.dwood);
  }
  function w2(W, n) { return W - 12 - n; }
  function plantPot(p, cx, yb, ph, col, rim) {
    p.r(cx - 4, yb - ph, 9, 2, rim); p.r(cx - 3, yb - ph + 2, 7, ph - 2, col); p.r(cx - 3, yb - ph + 2, 1, ph - 2, "#FFFFFF", 0.18); p.r(cx + 3, yb - ph + 2, 1, ph - 2, "#000000", 0.2);
    p.r(cx - 4, yb - ph, 9, 1, "#FFFFFF", 0.25);
  }
  function drawPlant(p, W, H, c, o, n) {
    var cx = W >> 1, ph = H >= 28 ? 8 : 6, yb = H - 1, top = H - ph - 1, i, pots = [c.dorange, c.cream, c.orange, c.wood, c.steel, c.djade], rims = [c.orange, c.white, c.gold, c.lwood, c.slate, c.jade];
    p.r(cx - 5, H - 3, 11, 3, "#000000", 0.2);
    var a = c.plant, b = c.dplant;
    if (n === 1) { /* monstera */
      p.r(cx, top - 10, 1, 11, b); p.r(cx - 3, top - 6, 1, 7, b); p.r(cx + 3, top - 8, 1, 9, b);
      p.ell(cx - 5, top - 5, 4, 3, a); p.ell(cx + 5, top - 8, 4, 3, a); p.ell(cx, top - 12, 4, 4, a); p.ell(cx - 3, top - 9, 3, 2, b); p.ell(cx + 2, top - 4, 4, 2, b);
      p.px(cx - 5, top - 5, c.dark); p.px(cx + 5, top - 8, c.dark); p.px(cx, top - 12, c.dark);
    } else if (n === 2) { /* snake plant */
      for (i = 0; i < 6; i++) { var hh = 8 + [3, 7, 5, 9, 4, 6][i]; p.r(cx - 5 + i * 2, top - hh + 2, 2, hh, i % 2 ? a : b); p.px(cx - 5 + i * 2, top - hh + 2, c.gold, 0.8); }
    } else if (n === 3) { /* succulent */
      for (i = 0; i < 6; i++) { p.ell(cx + [-4, -2, 0, 2, 4, 0][i], top - [2, 4, 5, 4, 2, 1][i], 2, 2, i % 2 ? c.jade : c.djade); }
      p.px(cx, top - 6, c.gold);
    } else if (n === 4) { /* fern */
      for (i = 0; i < 7; i++) { var ang = -1.2 + i * 0.4; for (var k2 = 1; k2 < 9; k2++) { p.px(cx + Math.round(Math.sin(ang) * k2 * 0.9), top - Math.round(Math.cos(ang) * k2 * 0.9) + Math.round(k2 * k2 * 0.04 * Math.abs(ang)), (k2 % 2) ? a : b); } }
    } else if (n === 5) { /* ficus */
      p.r(cx, top - 9, 2, 10, c.dwood); p.r(cx - 2, top - 5, 2, 1, c.dwood); p.r(cx + 2, top - 7, 2, 1, c.dwood);
      p.ell(cx - 4, top - 12, 4, 3, b); p.ell(cx + 4, top - 12, 4, 3, b); p.ell(cx, top - 15, 5, 3, a); p.ell(cx - 5, top - 8, 3, 2, a); p.ell(cx + 5, top - 8, 3, 2, a); p.ell(cx, top - 10, 4, 2, a);
      p.px(cx - 3, top - 16, "#FFFFFF", 0.25); p.px(cx + 3, top - 13, "#FFFFFF", 0.2);
    } else { /* cactus */
      p.r(cx - 2, top - 12, 5, 13, a); p.r(cx - 2, top - 12, 1, 13, "#FFFFFF", 0.15); p.r(cx + 2, top - 12, 1, 13, b);
      p.r(cx - 6, top - 8, 4, 2, a); p.r(cx - 6, top - 12, 2, 5, a); p.r(cx + 3, top - 6, 4, 2, a); p.r(cx + 5, top - 10, 2, 5, a);
      p.px(cx, top - 10, c.cream); p.px(cx, top - 6, c.cream); p.px(cx - 1, top - 3, c.cream);
      p.r(cx - 1, top - 15, 3, 3, c.gold); p.px(cx, top - 14, c.orange);
    }
    plantPot(p, cx, yb - 1, ph, pots[(n - 1) % 6], rims[(n - 1) % 6]);
  }
  function drawPoster(p, W, H, c) {
    var x = (W - 16) >> 1, y = H - 30 < 0 ? 0 : H - 30, ONE = [".oo", "ooo", ".oo", ".oo", ".oo", ".oo", ".oo", "oooo", "oooo"], THREE = ["oooooo", "o....o", ".....o", "..ooo.", "..ooo.", ".....o", ".....o", "o....o", ".oooo."];
    p.r(x + 1, y + 1, 14, 26, c.ol); p.r(x + 2, y + 2, 12, 24, c.cream); p.r(x + 2, y + 2, 12, 1, c.white);
    p.r(x + 3, y + 3, 10, 12, c.graphite);
    p.map(x + 4, y + 4, ONE, { o: c.dorange }); p.map(x + 4, y + 4, ONE, {}); p.map(x + 8, y + 4, THREE, { o: c.orange }); p.map(x + 4, y + 4, ONE, { o: c.orange });
    p.r(x + 3, y + 14, 10, 1, c.gold);
    p.r(x + 3, y + 17, 9, 1, c.slate); p.r(x + 3, y + 19, 7, 1, c.slate); p.r(x + 3, y + 21, 8, 1, c.slate, 0.7); p.r(x + 3, y + 23, 4, 1, c.dorange);
    p.r(x + 12, y + 24, 2, 2, c.plasterS, 0); p.px(x + 13, y + 25, c.plasterS); p.px(x + 12, y + 25, c.plasterS);
    p.r(x, y, 4, 2, c.gold, 0.8); p.r(x + 12, y, 4, 2, c.gold, 0.8);
  }
  function drawWindow(p, W, H, c, o) {
    var night = c === PAL_NIGHT, sh = H - 6, y, col, pw = Math.floor((W - 6) / 2), i;
    p.r(0, 0, W, H - 3, c.ol); p.r(1, 1, W - 2, H - 5, c.dwood); p.r(2, 2, W - 4, H - 7, c.wood);
    for (y = 0; y < sh - 3; y++) {
      col = night ? mix("#0E1822", "#1B3340", y / (sh - 4)) : mix("#8EC5D6", "#F6C58B", y / (sh - 4));
      p.r(3, 3 + y, W - 6, 1, col);
    }
    if (night) { for (i = 0; i < 8; i++) { p.px(4 + Math.floor(hash(i, 1, 61) * (W - 8)), 4 + Math.floor(hash(i, 2, 61) * (sh - 8)), LIT.cream, 0.7); } p.r(W - 10, 5, 3, 3, LIT.cream); p.px(W - 11, 6, LIT.cream, 0.4); p.r(W - 9, 5, 2, 2, "#1B3340"); }
    else { p.r(5, sh - 3, 8, 1, "#FFFFFF", 0.5); p.r(W - 14, 7, 6, 1, "#FFFFFF", 0.45); p.r(W - 12, 6, 3, 1, "#FFFFFF", 0.45); p.px(W - 6, 5, LIT.gold); p.px(W - 6, 6, LIT.gold, 0.6); p.px(W - 7, 5, LIT.gold, 0.6); }
    p.r((W >> 1) - 1, 3, 2, sh - 3, c.wood); p.r(3, 3 + ((sh - 4) >> 1), W - 6, 2, c.wood);
    p.r((W >> 1) - 1, 3, 1, sh - 3, c.lwood, 0.6);
    p.r(0, H - 5, W, 3, c.lwood); p.r(0, H - 5, W, 1, c.floorW); p.r(0, H - 3, W, 1, c.dwood);
    p.r(3, H - 9, 2, 4, c.plant); p.r(5, H - 8, 2, 3, c.dplant); p.r(2, H - 6, 6, 2, c.dorange);
    p.r(1, 2, 3, sh, c.cream, 0.0);
    p.r(0, 2, 3, sh + 2, c.cream); p.r(1, 2, 1, sh + 2, c.sheetS, 0.7); p.r(W - 3, 2, 3, sh + 2, c.cream); p.r(W - 2, 2, 1, sh + 2, c.sheetS, 0.7);
    p.r(0, 1, W, 1, c.brass);
  }
  function animWindow(p, W, H, c, o, t) {
    var night = c === PAL_NIGHT, sh = H - 6, i;
    if (night) { for (i = 0; i < 4; i++) { if (((Math.floor(t * 1.5) + i) % 3) === 0) { p.px(4 + Math.floor(hash(i + 20, 1, 61) * (W - 14)), 4 + Math.floor(hash(i + 20, 2, 61) * (sh - 8)), LIT.gold); } } }
    else { var cx = 4 + ((t * 0.8) % (W - 14)); p.clip(3, 3, W - 6, sh - 4); p.r(Math.round(cx), 8, 5, 1, "#FFFFFF", 0.6); p.r(Math.round(cx) + 1, 7, 3, 1, "#FFFFFF", 0.6); p.unclip(); }
  }
  function drawRug(p, W, H, c) {
    var x, y, i;
    p.r(0, 2, W, H - 4, c.ol); p.r(1, 3, W - 2, H - 6, c.orange);
    p.r(3, 5, W - 6, H - 10, c.cream); p.r(5, 7, W - 10, H - 14, c.djade);
    for (x = 3; x < W - 4; x += 4) { p.px(x, 4, c.dorange); p.px(x + 1, H - 5, c.dorange); }
    for (x = 8; x < W - 8; x += 2) { p.px(x, 9, c.jade); p.px(x + 1, H - 10, c.jade); }
    var cx = W >> 1, cy = H >> 1, r = Math.min((H - 14) >> 1, 12);
    for (i = -r; i <= r; i++) { var hw = r - Math.abs(i); p.r(cx - hw, cy + i, hw * 2 + 1, 1, (Math.abs(i) % 4 < 2) ? c.cream : c.gold); }
    for (i = -(r >> 1); i <= (r >> 1); i++) { var h2 = (r >> 1) - Math.abs(i); p.r(cx - h2, cy + i, h2 * 2 + 1, 1, c.orange); }
    p.px(cx, cy, c.gold);
    for (y = 3; y < H - 3; y += 2) { p.px(0, y, c.cream); p.px(W - 1, y, c.cream); }
    for (y = 3; y < H - 3; y += 3) { p.px(1, y, c.cream, 0.7); p.px(W - 2, y, c.cream, 0.7); }
  }
  function drawDesk(p, W, H, c, o, n) {
    var x = (W - 32) >> 1, y0 = H - 32, k2 = ((n - 1) % 4) + 1, i, sc = [c.dark, "#142029", "#1E2A24", "#10181C"][k2 - 1];
    shadow(p, W, H, x + 2);
    p.r(x + 3, y0 + 25, 3, 6, c.dwood); p.r(x + 26, y0 + 25, 3, 6, c.dwood);
    p.r(x + 1, y0 + 20, 30, 6, c.wood); p.r(x + 1, y0 + 25, 30, 1, c.dwood); p.r(x + 20, y0 + 21, 9, 4, c.dwood); p.r(x + 21, y0 + 22, 7, 2, c.wood); p.px(x + 24, y0 + 23, c.gold);
    p.r(x, y0 + 15, 32, 5, c.lwood); p.r(x, y0 + 15, 32, 1, c.floorW, 0.7); p.r(x, y0 + 19, 32, 1, c.wood);
    p.r(x + 14, y0 + 13, 4, 3, c.slate); p.r(x + 11, y0 + 15, 10, 1, c.steel);
    p.r(x + 7, y0 + 1, 18, 13, c.ol); p.r(x + 8, y0 + 2, 16, 11, c.steel); p.r(x + 9, y0 + 3, 14, 9, sc);
    if (k2 === 1) { for (i = 0; i < 5; i++) { p.r(x + 10 + (i % 2) * 2, y0 + 4 + i * 2, 3 + (i * 3) % 7, 1, i % 2 ? c.jade : c.cream); } }
    else if (k2 === 2) { p.r(x + 10, y0 + 4, 12, 2, c.orange); p.r(x + 10, y0 + 7, 5, 4, c.cream); p.r(x + 16, y0 + 7, 6, 4, c.jade); }
    else if (k2 === 3) { for (i = 0; i < 5; i++) { p.r(x + 11 + i * 2, y0 + 11 - (2 + (i * 2) % 6), 1, 2 + (i * 2) % 6, i % 2 ? c.gold : c.orange); } p.r(x + 10, y0 + 11, 12, 1, c.slate); }
    else { for (i = 0; i < 4; i++) { p.r(x + 10, y0 + 4 + i * 2, 2 + (i * 5) % 9, 1, i % 2 ? c.gold : c.plant); } }
    p.r(x + 9, y0 + 3, 14, 1, "#FFFFFF", 0.16);
    p.r(x + 10, y0 + 16, 12, 3, c.cream); p.r(x + 10, y0 + 16, 12, 1, c.white); for (i = 0; i < 5; i++) { p.px(x + 11 + i * 2, y0 + 17, c.slate, 0.7); }
    p.r(x + 25, y0 + 12, 4, 4, k2 % 2 ? c.orange : c.jade); p.r(x + 25, y0 + 12, 4, 1, "#FFFFFF", 0.35); p.px(x + 29, y0 + 13, c.slate);
    p.r(x + 3, y0 + 10, 4, 4, c.gold); p.r(x + 3, y0 + 10, 4, 1, LIT.gold, 0.8);
  }
  function animDesk(p, W, H, c, o, t, n) {
    var x = (W - 32) >> 1, y0 = H - 32, k2 = ((n - 1) % 4) + 1;
    p.r(x + 9, y0 + 3, 14, 9, c.jade, 0.04 + 0.03 * Math.sin(t * 2.3));
    if (Math.floor(t * 2) % 2 === 0) { p.r(x + 10 + (k2 * 3) % 8, y0 + 10 - (k2 === 3 ? 0 : 0), 2, 1, k2 === 4 ? LIT.gold : LIT.cream); }
  }
  function drawScreens(p, W, H, c) {
    var cols = Math.max(2, Math.floor(W / 31)), rows = Math.max(1, Math.floor((H - 2) / 23)), cw = Math.floor((W - 4) / cols), ch = Math.floor((H - 4) / rows), i, j, n = 0;
    p.r(0, 0, W, H, c.ol); p.r(1, 1, W - 2, H - 2, c.dwall);
    p.r(1, 1, W - 2, 1, c.steel);
    for (j = 0; j < rows; j++) { for (i = 0; i < cols; i++) { n++; p.r(2 + i * cw, 2 + j * ch, cw - 1, ch - 1, c.ol); p.r(3 + i * cw, 3 + j * ch, cw - 3, ch - 3, c.steel); p.r(4 + i * cw, 4 + j * ch, cw - 5, ch - 5, c.dark); } }
    p.r(2, H - 3, W - 4, 2, c.steel);
  }
  function screenContent(p, x, y, w, h, n, t) {
    var i, k2 = n % 6, ph = Math.floor(t * 2);
    if (k2 === 0) { for (i = 0; i < 3; i++) { p.r(x + 1 + i * Math.floor(w / 3), y + 1, Math.floor(w / 3) - 1, 2, [LIT.orange, LIT.gold, LIT.jade][i]); p.r(x + 1 + i * Math.floor(w / 3), y + 4, Math.floor(w / 3) - 1, 2, LIT.cream, 0.5); p.r(x + 1 + i * Math.floor(w / 3), y + 7 + (i === ph % 3 ? 0 : 1), Math.floor(w / 3) - 1, 2, LIT.cream, 0.3); } }
    else if (k2 === 1) { for (i = 0; i < w - 2; i++) { p.px(x + 1 + i, y + h - 3 - Math.round((Math.sin(i * 0.5 + t * 1.5) + 1.3) * (h - 6) / 3), LIT.jade); } p.r(x + 1, y + h - 2, w - 2, 1, LIT.cream, 0.3); }
    else if (k2 === 2) { for (i = 0; i < 6; i++) { var bh = 2 + ((i * 5 + ph) % (h - 5)); p.r(x + 2 + i * 3, y + h - 1 - bh, 2, bh, i % 2 ? LIT.gold : LIT.orange); } }
    else if (k2 === 3) { p.txt("13", x + Math.floor((w - 7) / 2), y + Math.floor((h - 5) / 2), LIT.orange, 1, 1); }
    else if (k2 === 4) { for (i = 0; i < 4; i++) { p.r(x + 1, y + 1 + i * 2, 3 + ((i * 7 + ph) % (w - 5)), 1, i % 2 ? LIT.jade : LIT.cream); } if (ph % 2) { p.r(x + 1, y + h - 2, 2, 1, LIT.cream); } }
    else { p.ell(x + (w >> 1), y + (h >> 1), 3, 3, LIT.jade, 0.35); p.px(x + (w >> 1) + Math.round(Math.cos(t * 1.4) * 3), y + (h >> 1) + Math.round(Math.sin(t * 1.4) * 3), LIT.cream); p.px(x + 2, y + 2, LIT.gold); }
  }
  function animScreens(p, W, H, c, o, t) {
    var cols = Math.max(2, Math.floor(W / 31)), rows = Math.max(1, Math.floor((H - 2) / 23)), cw = Math.floor((W - 4) / cols), ch = Math.floor((H - 4) / rows), i, j, n = 0;
    for (j = 0; j < rows; j++) { for (i = 0; i < cols; i++) { n++; screenContent(p, 4 + i * cw, 4 + j * ch, cw - 5, ch - 5, n, t); } }
  }
  function drawLathe(p, W, H, c) {
    shadow(p, W, H, 1);
    p.r(2, H - 12, 28, 10, c.ol); p.r(3, H - 11, 26, 8, c.steel); p.r(3, H - 11, 26, 1, c.slate);
    p.r(5, H - 17, 6, 6, c.ol); p.r(6, H - 16, 4, 4, c.orange); p.r(21, H - 15, 4, 4, c.slate);
    p.r(11, H - 14, 12, 3, c.wood); p.r(11, H - 14, 12, 1, c.lwood);
    p.r(4, H - 3, 3, 3, c.dark); p.r(25, H - 3, 3, 3, c.dark);
    p.px(4, H - 4, c.floorW, 0.7); p.px(9, H - 2, c.floorW, 0.7); p.px(14, H - 2, c.floorW, 0.7);
  }
  function drawSawdust(p, W, H, c) { var i; for (i = 0; i < W * H / 14; i++) { p.px(Math.floor(hash(i, 1, 71) * W), Math.floor(hash(i, 2, 71) * H), hash(i, 3, 71) > 0.5 ? c.floorW : c.floorD, 0.8); } }
  function drawWaitBench(p, W, H, c) {
    shadow(p, W, H, 1);
    p.r(1, H - 16, W - 2, 4, c.wood); p.r(1, H - 16, W - 2, 1, c.lwood);
    p.r(1, H - 20, W - 2, 4, c.dwood); p.r(1, H - 20, W - 2, 1, c.wood);
    p.r(3, H - 12, 2, 10, c.dwood); p.r(W - 5, H - 12, 2, 10, c.dwood);
  }

  /* ---------- registry ---------- */
  var FIXED = {
    "counter": { w: 6, h: 2, layer: "object", draw: drawCounter, glow: { color: "#FFC83D", r: 3.5, ox: 0.5, oy: 0.4 } },
    "neon-k13": { w: 3, h: 1, layer: "wall", draw: drawNeonK13, anim: animNeonK13, glow: { color: "#EA5E14", r: 4.5, ox: 0.5, oy: 0.5, a: 0.5 } },
    "neon-freeplay": { w: 3, h: 1, layer: "wall", draw: drawNeonFree, anim: animNeonFree, glow: { color: "#4F9E92", r: 3.5, ox: 0.5, oy: 0.5, a: 0.45 } },
    "guestbook": { w: 1, h: 1, layer: "object", draw: drawGuestbook },
    "door-front": { w: 2, h: 2, layer: "wall", draw: drawDoorFront, anim: animDoorFront },
    "door-back": { w: 2, h: 2, layer: "wall", draw: drawDoorBack, anim: animDoorBack, glow: { color: "#EA5E14", r: 1.8, ox: 0.5, oy: 0.3, a: 0.25 } },
    "keypad": { w: 1, h: 1, layer: "wall", draw: drawKeypad, anim: animKeypad, glow: { color: "#EA5E14", r: 1.2, ox: 0.5, oy: 0.4, a: 0.3 } },
    "change-machine": { w: 1, h: 2, layer: "object", draw: drawChange, anim: animChange, glow: { color: "#5FD1BE", r: 1.8, ox: 0.5, oy: 0.4, a: 0.25 } },
    "scoreboard": { w: 3, h: 2, layer: "wall", draw: drawScoreboard, anim: animScoreboard, glow: { color: "#FFC83D", r: 3.5, ox: 0.5, oy: 0.5, a: 0.3 } },
    "claw": { w: 2, h: 3, layer: "object", draw: drawClaw, anim: animClaw, glow: { color: "#FFC83D", r: 2.8, ox: 0.5, oy: 0.4, a: 0.3 } },
    "couch": { w: 3, h: 2, layer: "object", draw: drawCouch },
    "bookshelf": { w: 2, h: 2, layer: "object", draw: drawBookshelf },
    "coffee": { w: 1, h: 2, layer: "object", draw: drawCoffee, anim: animCoffee, glow: { color: "#5FD1BE", r: 1.2, ox: 0.5, oy: 0.4, a: 0.2 } },
    "pinball": { w: 2, h: 3, layer: "object", draw: drawPinball, anim: animPinball, glow: { color: "#FF8A3D", r: 2.8, ox: 0.5, oy: 0.4, a: 0.3 } },
    "fishtank": { w: 2, h: 2, layer: "object", draw: drawFishtank, anim: animFishtank, glow: { color: "#6FB9C4", r: 3, ox: 0.5, oy: 0.4, a: 0.35 } },
    "records": { w: 1, h: 1, layer: "object", draw: drawRecords, anim: animRecords },
    "whiteboard": { w: 3, h: 2, layer: "wall", draw: drawWhiteboard },
    "printer": { w: 1, h: 1, layer: "object", draw: drawPrinter, anim: animPrinter },
    "radio": { w: 1, h: 1, layer: "object", draw: drawRadio, anim: animRadio, glow: { color: "#FFC83D", r: 1.4, ox: 0.5, oy: 0.6, a: 0.2 } },
    "pegboard": { w: 3, h: 2, layer: "wall", draw: drawPegboard },
    "poster-13": { w: 1, h: 2, layer: "wall", draw: drawPoster },
    "rug": { w: 5, h: 3, layer: "floor", draw: drawRug },
    "screens": { w: 8, h: 3, layer: "wall", draw: drawScreens, anim: animScreens, glow: { color: "#5FD1BE", r: 7, ox: 0.5, oy: 0.6, a: 0.35 } },
    "lathe": { w: 2, h: 2, layer: "object", draw: drawLathe },
    "sawdust": { w: 2, h: 1, layer: "floor", draw: drawSawdust },
    "waitbench": { w: 2, h: 2, layer: "object", draw: drawWaitBench }
  };

  function resolve(obj) {
    var id = String(obj && obj.id || ""), kind = String(obj && obj.kind || ""), m, n, d;
    if (id === "cab-secret") { return { key: "cab-secret", w: 2, h: 3, layer: "object", draw: drawSecretCab, anim: animSecretCab, glow: { color: "#FFC83D", r: 2, ox: 0.5, oy: 0.2, a: 0.2 } }; }
    m = /^cab-(.+)$/.exec(id);
    if (m || kind === "cabinet" || kind === "cab") {
      n = m ? m[1] : (obj.game || "hardest13"); if (!GAMES[n]) { n = obj && obj.game && GAMES[obj.game] ? obj.game : "hardest13"; }
      return { key: "cab-" + n, w: 2, h: 3, layer: "object", draw: function (p, W, H, c, o) { drawCab(p, W, H, c, o, n); }, anim: function (p, W, H, c, o, t) { animCab(p, W, H, c, o, t, n); },
        glow: { color: GAMES[n].acc === "plant" ? "#6BD08A" : (GAMES[n].acc === "slate" ? "#B9BEC8" : litOf(GAMES[n].acc)), r: 2.8, ox: 0.5, oy: 0.55, a: 0.32 } };
    }
    m = /^bench-(.+)$/.exec(id);
    if (m || kind === "bench" || kind === "workbench") {
      n = m ? m[1] : (obj.toy || "egg"); if (!TOYS[n]) { n = TOYS[obj && obj.toy] ? obj.toy : "egg"; }
      return { key: "bench-" + n, w: 2, h: 2, layer: "object", draw: function (p, W, H, c, o) { drawBench(p, W, H, c, o, n); }, anim: function (p, W, H, c, o, t) { animBench(p, W, H, c, o, t, n); },
        glow: (n === "miramar" || n === "roof" || n === "goldenhour") ? { color: "#FFC83D", r: 2, ox: 0.5, oy: 0.3, a: 0.28 } : null };
    }
    m = /^plant-(\d+)$/.exec(id);
    if (m || kind === "plant") { n = m ? parseInt(m[1], 10) : 1; return { key: "plant-" + n, w: 1, h: 2, layer: "object", draw: function (p, W, H, c, o) { drawPlant(p, W, H, c, o, ((n - 1) % 6) + 1); } }; }
    m = /^window-(\d+)$/.exec(id);
    if (m || kind === "window") { return { key: "window", w: 2, h: 2, layer: "wall", draw: drawWindow, anim: animWindow, glow: null }; }
    m = /^desk-(\d+)$/.exec(id);
    if (m || kind === "desk") {
      n = m ? parseInt(m[1], 10) : 1;
      return { key: "desk-" + (((n - 1) % 4) + 1), w: 2, h: 2, layer: "object", draw: function (p, W, H, c, o) { drawDesk(p, W, H, c, o, n); }, anim: function (p, W, H, c, o, t) { animDesk(p, W, H, c, o, t, n); },
        glow: { color: "#5FD1BE", r: 1.8, ox: 0.5, oy: 0.4, a: 0.2 } };
    }
    d = FIXED[id];
    if (!d && kind && FIXED[kind]) { d = FIXED[kind]; id = kind; }
    if (d) { return { key: id, w: d.w, h: d.h, layer: d.layer, draw: d.draw, anim: d.anim || null, glow: d.glow || null }; }
    return { key: "unknown", w: 1, h: 1, layer: "object", draw: function (p, W, H, c) { shadow(p, W, H, 1); p.r(1, 3, W - 2, H - 5, c.ol); p.r(2, 4, W - 4, H - 7, c.lwood); p.txt("?", (W >> 1) - 1, (H >> 1) - 3, c.dwood, 1, 1); }, anim: null, glow: null };
  }

  function sizeOf(obj, d) { return { w: Math.round(((obj && obj.w) || d.w) * TS), h: Math.round(((obj && obj.h) || d.h) * TS) }; }

  function objectAt(ctx, obj, px, py, s, t) {
    var d = resolve(obj), z = sizeOf(obj, d), night = isNight(), c = pal(night), st = still(), tt = st ? STILL_T : (t || 0), cv, g, wpx, hpx;
    var flag = (obj && (obj.open ? "o" : "") + (obj && obj.revealed ? "r" : "") + (obj && obj.you ? "y" : "")) || "";
    cv = sprite("o:" + d.key + ":" + z.w + "x" + z.h + (night ? ":n" : ":d") + ":" + flag, z.w, z.h, function (p, W, H) { d.draw(p, W, H, c, obj || {}); });
    blit(ctx, cv, px, py, s);
    if (d.anim) { d.anim(mkP(ctx, px, py, s), z.w, z.h, c, obj || {}, tt); }
    if (night && d.glow) {
      g = d.glow; wpx = z.w * s; hpx = z.h * s;
      glowAt(ctx, px + wpx * (g.ox === undefined ? 0.5 : g.ox), py + hpx * (g.oy === undefined ? 0.5 : g.oy), g.r * TS * s, g.color, g.a === undefined ? 0.3 : g.a);
    }
  }
  function object(ctx, obj, s, t) { objectAt(ctx, obj, Math.round(obj.x * TS * s), Math.round(obj.y * TS * s), s, t); }

  function info(id) {
    var d = resolve(typeof id === "string" ? { id: id } : id);
    return { w: d.w, h: d.h, layer: d.layer, glow: d.glow ? { color: d.glow.color, r: d.glow.r } : null };
  }
  function lights(obj) {
    var d = resolve(obj), w = (obj && obj.w) || d.w, h = (obj && obj.h) || d.h, g = d.glow;
    if (!g) { return []; }
    return [{ x: (obj.x || 0) + w * (g.ox === undefined ? 0.5 : g.ox), y: (obj.y || 0) + h * (g.oy === undefined ? 0.5 : g.oy), r: g.r, color: g.color }];
  }

  var tileNames = [];
  (function () { var k; for (k in TILE_DRAW) { if (TILE_DRAW.hasOwnProperty(k)) { tileNames.push(k); } } tileNames.push("wall-window"); })();

  K.decor = {
    version: "2026-10-06", tileSize: TS, tileNames: tileNames,
    games: GAME_IDS.map(function (id) { return { id: id, name: GAMES[id].name }; }),
    toys: TOY_IDS.map(function (id) { return { id: id, title: TOYS[id].title, from: TOYS[id].from }; }),
    tile: tile, object: object, objectAt: objectAt, marquee: marquee, info: info, lights: lights
  };
})();
