/* K13 Workbench World: the people (pixel characters, portraits, dialogue).
 *
 * K13World.people = {
 *   list, byId, size, palette,
 *   draw(ctx, id, dir, frame, x, y, scale)  x,y = top-left of the 16x24 sprite; feet sit on row 22 (bottom
 *                                           of the shoes, outline on row 23). dir: down|up|left|right.
 *                                           frame: 0..3 walk, 4 idle (breathes by itself), 5 idle exhale.
 *   portrait(ctx, id, x, y, scale)          32x32 bust for the dialogue box
 *   lines(id, state) -> [string, ...]       2 to 4 short lines; the last one is the secrets hint when one exists
 *   prewarm()                               optional: build every sprite sheet ahead of time
 * }
 * Everything is drawn in code, once, into offscreen canvases. No images, no fetches, no inline styles.
 * Plain ES5. Palette: K13 tokens, natural skin and hair tones. Never purple.
 */
(function () {
  'use strict';
  var NS = (window.K13World = window.K13World || {});

  var PAL = {
    graphite: '#1F2023', ink: '#26272B', steel: '#414347', slate: '#5D5F65', paper: '#F3F5FA',
    cream: '#F6EEDC', white: '#FFFFFF', orange: '#EA5E14', deepOrange: '#B94612', gold: '#F0B429',
    jade: '#4F9E92', deepJade: '#2F6F65', wood: '#8A5A3B', woodDark: '#5E3B26', floor: '#D8C4A6',
    floorDark: '#B9A07E', plant: '#3C8A5E', kazim: '#E4572E', gurkan: '#1F8A70', blueprint: '#3B6EA8',
    blueprintDark: '#2D5586', denim: '#3F5F8A', outline: '#26272B'
  };

  /* ---------- colour helpers ---------- */
  function hex(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  function toHex(a) {
    var s = '#', i, v;
    for (i = 0; i < 3; i++) { v = Math.max(0, Math.min(255, Math.round(a[i]))); s += (v < 16 ? '0' : '') + v.toString(16); }
    return s;
  }
  function shade(c, f) {
    var a = hex(c), i;
    for (i = 0; i < 3; i++) { a[i] = f < 1 ? a[i] * f : a[i] + (255 - a[i]) * (f - 1); }
    return toHex(a);
  }
  function mix(c1, c2, t) {
    var a = hex(c1), b = hex(c2);
    return toHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  }
  function lum(c) { var a = hex(c); return (a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11) / 255; }

  /* ---------- the roster ---------- */
  var DARK = '#26272B';
  var DATA = [
    // id, name, role, look
    ['james', 'James', 'General Manager', {
      skin: '#E8B896', hair: '#7A3F1F', style: 'curlylong', beard: ['stubble', '#8A4E2A'], glasses: ['rect', '#26272B'],
      top: { kind: 'shirt', col: '#F3F5FA', open: 1, logo: 1 }, bottom: { kind: 'pants', col: '#414347', belt: '#5E3B26' },
      shoes: '#5E3B26', acc: 'notebook', eye: '#4B4A2A' }],
    ['jessica', 'Jessica', 'Executive Assistant', {
      skin: '#D9A06F', hair: '#D9A441', style: 'wavy', top: { kind: 'dress', col: '#F6EEDC' },
      bottom: { kind: 'skirt', col: '#F6EEDC' }, shoes: '#C98F67', acc: 'clipboard', eye: '#5A3A22' }],
    ['natalia', 'Natalia', 'Frontend Engineer', {
      skin: '#F0C8A8', hair: '#E8B960', style: 'long', top: { kind: 'shirt', col: '#F3F5FA', logo: 1 },
      bottom: { kind: 'pants', col: '#26272B', belt: '#414347' }, shoes: '#26272B', acc: 'laptop', eye: '#4A8DB5' }],
    ['camila', 'Camila', 'UI Motion Designer', {
      skin: '#C98F67', hair: '#3A2418', style: 'wavy', top: { kind: 'shirt', col: '#F3F5FA', logo: 1 },
      bottom: { kind: 'skirt', col: '#26272B', belt: '#26272B' }, shoes: '#26272B', acc: 'feather', eye: '#3A2418' }],
    ['olga', 'Olga', 'QA Test Engineer', {
      skin: '#D49A6A', hair: '#1B1412', style: 'long', fringe: 'side', top: { kind: 'shirt', col: '#2E2F33', logo: 1 },
      bottom: { kind: 'pants', col: '#26272B', belt: '#414347' }, shoes: '#1F2023', acc: 'magnifier', eye: '#26272B' }],
    ['kate', 'Kate', 'Release Engineer', {
      skin: '#C98A5E', hair: '#7A4224', style: 'long', top: { kind: 'shirt', col: '#F3F5FA', logo: 1 },
      bottom: { kind: 'pants', col: '#414347', belt: '#26272B' }, shoes: '#F3F5FA', acc: 'rocket', eye: '#3A2418' }],
    ['valentina', 'Valentina', 'Brand DNA Designer', {
      skin: '#F0CBAE', hair: '#B8501C', style: 'wavy', top: { kind: 'shirt', col: '#F3F5FA', logo: 1 },
      bottom: { kind: 'skirt', col: '#26272B', belt: '#26272B' }, shoes: '#26272B', acc: 'swatches', eye: '#6FA0A0' }],
    ['mariana', 'Mariana', 'Backend Integrations Engineer', {
      skin: '#C48A60', hair: '#15100E', style: 'long', top: { kind: 'shirt', col: '#2F6F65', logo: 1 },
      bottom: { kind: 'pants', col: '#26272B', belt: '#414347' }, shoes: '#26272B', headset: 1, eye: '#26272B' }],
    ['leticia', 'Leticia', 'Marketing Specialist', {
      skin: '#E0B08A', hair: '#E6C488', roots: '#8A6A3A', style: 'long', glasses: ['avi', '#E9A93A'],
      top: { kind: 'shirt', col: '#F3F5FA', logo: 1 }, bottom: { kind: 'skirt', col: '#26272B', belt: '#26272B' },
      shoes: '#26272B', acc: 'megaphone', tat: 'armL', eye: '#6B7F5A' }],
    ['gabi', 'Gabi', 'Report Writer', {
      skin: '#C88A5C', hair: '#3B2418', style: 'wavy', top: { kind: 'shirt', col: '#F3F5FA', puff: 1, logo: 1 },
      bottom: { kind: 'skirt', col: '#26272B', belt: '#26272B' }, shoes: '#26272B', acc: 'pad', eye: '#4A2E1A' }],
    ['nastiya', 'Nastiya', 'Research Analyst', {
      skin: '#DBA77A', hair: '#C9964A', style: 'wavy', top: { kind: 'shirt', col: '#F3F5FA', logo: 1 },
      bottom: { kind: 'pants', col: '#26272B', belt: '#414347' }, shoes: '#5E3B26', acc: 'books', eye: '#6E9FB5' }],
    ['ana', 'Ana', 'Security Auditor', {
      skin: '#CC9570', hair: '#1A1210', style: 'wavy', glasses: ['tort', '#8A4B1F'],
      top: { kind: 'blazer', col: '#26272B' }, bottom: { kind: 'pants', col: '#26272B', belt: '#414347' },
      shoes: '#1F2023', badge: 'padlock', eye: '#3A2418' }],
    ['selma', 'Selma', 'Solutions Architect', {
      skin: '#B07448', hair: '#120D0B', style: 'curlylong', top: { kind: 'shirt', col: '#2E2F33', logo: 1 },
      bottom: { kind: 'pants', col: '#414347', belt: '#26272B' }, shoes: '#1F2023', acc: 'blueprint', eye: '#26272B' }],
    ['baha', 'Baha', 'Art Director', {
      skin: '#C99770', hair: '#1C1612', style: 'side', beard: ['full', '#2A1F1A'], broad: 1,
      top: { kind: 'shirt', col: '#2E2F33', logo: 1 }, bottom: { kind: 'pants', col: '#414347', belt: '#26272B' },
      shoes: '#1F2023', acc: 'brush', eye: '#26272B' }],
    ['fadil', 'Fadil', 'Technical Director', {
      skin: '#EDBF9B', hair: '#C8602A', style: 'quiff', top: { kind: 'shirt', col: '#2E2F33', open: 1, logo: 1 },
      bottom: { kind: 'pants', col: '#D8C4A6', belt: '#5E3B26' }, shoes: '#5E3B26', acc: 'wrench', eye: '#4B6A8A' }],
    ['memotti', 'Memotti', 'Creative Director', {
      skin: '#C58E66', hair: '#2A2623', style: 'buzz', beard: ['full', '#3A312B'], glasses: ['round', '#D8B04A'],
      top: { kind: 'shirt', col: '#2E2F33', open: 1, logo: 1 }, bottom: { kind: 'pants', col: '#414347', belt: '#26272B' },
      shoes: '#1F2023', acc: 'clapper', eye: '#26272B' }],
    ['emre', 'Emre', 'Client Success Director', {
      skin: '#C48A60', hair: '#17120F', style: 'curlyshort', beard: ['stubble', '#2A2018'], broad: 1,
      top: { kind: 'tee', col: '#2E2F33', logo: 1 }, bottom: { kind: 'pants', col: '#414347' }, shoes: '#F3F5FA',
      acc: 'phone', eye: '#26272B' }],
    ['chefito', 'Chefito', 'Business Development Director', {
      skin: '#D9A67E', hair: '#2A1E18', style: 'slick', beard: ['full', '#3A2418'], glasses: ['sun', '#C8402A'],
      hat: 'chef', broad: 1, tat: 'armL', top: { kind: 'tee', col: '#2E2F33', logo: 1 },
      bottom: { kind: 'pants', col: '#26272B' }, shoes: '#F3F5FA', eye: '#26272B' }],
    ['halodinho', 'Halodinho', 'Operations Director', {
      skin: '#C99068', hair: '#6E6A66', style: 'bald', beard: ['full', '#6E6A66'],
      top: { kind: 'shirt', col: '#2E2F33', open: 1, logo: 1 }, bottom: { kind: 'pants', col: '#26272B', belt: '#5E3B26' },
      shoes: '#5E3B26', acc: 'stopwatch', eye: '#26272B' }],
    ['tony', 'Tony (Gangaa)', 'Infrastructure Director', {
      skin: '#C99C74', hair: '#17120F', style: 'short', beard: ['full', '#1F1713', 'mus'], broad: 1,
      top: { kind: 'tee', col: '#2E2F33', logo: 1 }, bottom: { kind: 'pants', col: '#E8E0D0' }, shoes: '#B9A07E',
      acc: 'server', eye: '#26272B' }],
    ['kazim', 'Kazim', 'Mastermind', {
      skin: '#E8B896', hair: '#1F1A17', style: 'short', beard: ['stubble', '#2A2018'],
      top: { kind: 'tee', col: '#E4572E', col2: '#F3F5FA', logo: 1, white: 1 },
      bottom: { kind: 'pants', col: '#26272B', belt: '#414347' }, shoes: '#F3F5FA', acc: 'mug', eye: '#4B4A2A' }],
    ['gurkan', 'Gürkan', 'Mastermind', {
      skin: '#C99C74', hair: '#17120F', style: 'side', beard: ['full', '#1F1713'], broad: 1, neckphones: 1,
      top: { kind: 'jacket', col: '#1F8A70', col2: '#F6EEDC' }, bottom: { kind: 'pants', col: '#3A4252', belt: '#26272B' },
      shoes: '#F3F5FA', eye: '#26272B' }],
    ['player', 'Visitor', 'K13 intern, visiting', {
      skin: '#E3B08A', hair: '#6B4226', style: 'short', cowlick: 1, top: { kind: 'hoodie', col: '#EA5E14' },
      bottom: { kind: 'pants', col: '#3F5F8A' }, shoes: '#F3F5FA', badge: 'pass', eye: '#3A2418' }]
  ];

  var LOOK = {};
  var list = [];
  var byId = {};
  (function () {
    var i, d, o, L;
    for (i = 0; i < DATA.length; i++) {
      d = DATA[i]; L = d[3];
      L.eye = L.eye || DARK;
      L.hairSh = shade(L.hair, 0.72);
      L.hairHi = shade(L.hair, 1.35);
      L.skinSh = shade(L.skin, 0.84);
      L.skinHi = shade(L.skin, 1.12);
      L.mouth = mix(L.skin, '#9A3F35', 0.55);
      L.blush = mix(L.skin, '#E0705F', 0.35);
      L.long = (L.style === 'long' || L.style === 'wavy' || L.style === 'curlylong');
      LOOK[d[0]] = L;
      o = { id: d[0], name: d[1], role: d[2],
        colors: { skin: L.skin, hair: L.hair, top: L.top.col, bottom: L.bottom.col, shoes: L.shoes } };
      list.push(o); byId[d[0]] = o;
    }
  })();

  /* ---------- tiny canvas toolkit (coordinates in 16x24 grid units, fractions allowed at unit 2) ---------- */
  function mk(w, h, u) {
    var c = document.createElement('canvas');
    c.width = w * u; c.height = h * u;
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return { c: c, g: g, u: u };
  }
  function R(o, x, y, w, h, col) {
    if (!col) { return; }
    var u = o.u;
    o.g.fillStyle = col;
    o.g.fillRect(Math.round(x * u), Math.round(y * u), Math.max(1, Math.round(w * u)), Math.max(1, Math.round(h * u)));
  }
  function BM(o, x, y, rows, pal, flip) {
    var j, i, ch, w = rows[0].length;
    for (j = 0; j < rows.length; j++) {
      for (i = 0; i < w; i++) {
        ch = rows[j].charAt(i);
        if (ch !== '.' && pal[ch]) { R(o, x + (flip ? (w - 1 - i) : i), y + j, 1, 1, pal[ch]); }
      }
    }
  }
  function BOX(o, x, y, w, h, t, col, round) {
    R(o, x, y, w, t, col); R(o, x, y + h - t, w, t, col); R(o, x, y, t, h, col); R(o, x + w - t, y, t, h, col);
    if (round) { // knock the corners out so the frame reads round
      o.g.clearRect(Math.round(x * o.u), Math.round(y * o.u), Math.max(1, Math.round(t * o.u)), Math.max(1, Math.round(t * o.u)));
      o.g.clearRect(Math.round((x + w - t) * o.u), Math.round(y * o.u), Math.max(1, Math.round(t * o.u)), Math.max(1, Math.round(t * o.u)));
      o.g.clearRect(Math.round(x * o.u), Math.round((y + h - t) * o.u), Math.max(1, Math.round(t * o.u)), Math.max(1, Math.round(t * o.u)));
      o.g.clearRect(Math.round((x + w - t) * o.u), Math.round((y + h - t) * o.u), Math.max(1, Math.round(t * o.u)), Math.max(1, Math.round(t * o.u)));
    }
  }

  /* 1px outline round everything opaque (the Stardew look) */
  function outline(o, col) {
    var w = o.c.width, h = o.c.height, id = o.g.getImageData(0, 0, w, h), d = id.data, out = [], x, y, i, a, rgb = hex(col);
    function op(xx, yy) { return xx >= 0 && yy >= 0 && xx < w && yy < h && d[(yy * w + xx) * 4 + 3] > 0; }
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = (y * w + x) * 4;
        if (d[i + 3] === 0 && (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1))) { out.push(i); }
      }
    }
    for (a = 0; a < out.length; a++) { i = out[a]; d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255; }
    o.g.putImageData(id, 0, 0);
  }

  /* ---------- held and worn items ---------- */
  var ITEMS = {
    notebook: { rows: ['kkok', 'kkok', 'kkok', 'kkok', 'pppp'], pal: { k: '#414347', o: PAL.orange, p: PAL.cream } },
    clipboard: { rows: ['.ss.', 'bwwb', 'bgwb', 'bwgb', 'bgwb', 'bbbb'], pal: { b: PAL.wood, w: PAL.paper, s: '#9EA2AA', g: PAL.slate } },
    laptop: { rows: ['kkkk', 'koGk', 'kGok', 'bbbb'], pal: { k: '#26272B', o: PAL.orange, G: PAL.jade, b: '#9EA2AA' } },
    feather: { rows: ['..jj', '.jJj', '.jJ.', 'jJj.', 'jJ..', 'q...'], pal: { j: PAL.jade, J: PAL.deepJade, q: PAL.graphite } },
    magnifier: { rows: ['.ss.', 'sgws', 'sggs', '.ss.', '..hh', '...h'], pal: { s: '#9EA2AA', g: '#BFE3EA', w: '#FFFFFF', h: PAL.wood } },
    rocket: { rows: ['.o.', '.w.', 'wjw', '.w.', 'dwd', '.y.'], pal: { o: PAL.orange, w: '#F3F5FA', j: PAL.jade, d: PAL.deepJade, y: PAL.gold } },
    swatches: { rows: ['...c', '..gc', '.ogj', 'ogjk', 'kk..'], pal: { c: PAL.cream, g: PAL.gold, o: PAL.orange, j: PAL.jade, k: PAL.graphite } },
    megaphone: { rows: ['..ow', 'ooww', '..ow', '.k..'], pal: { o: PAL.orange, w: PAL.cream, k: PAL.graphite } },
    pad: { rows: ['cccg', 'clcg', 'cccg', 'clcg', 'cccg'], pal: { c: PAL.cream, l: PAL.slate, g: PAL.gold } },
    books: { rows: ['jjjj', 'pppp', 'oooo', 'pppp', 'kkkk', 'pppp'], pal: { j: PAL.jade, p: PAL.cream, o: PAL.orange, k: PAL.steel } },
    blueprint: { rows: ['cccc', 'bbbb', 'bwbw', 'bbbb', 'bwbw', 'cccc'], pal: { c: PAL.cream, b: PAL.blueprint, w: '#CFE0F2' } },
    brush: { rows: ['g.o', '..o', '..s', '..b', '..b', '..b'], pal: { g: PAL.gold, o: PAL.orange, s: '#9EA2AA', b: PAL.wood } },
    clapper: { rows: ['kwkw', 'kkkk', 'kwwk', 'kkkk', 'kwkk'], pal: { k: '#26272B', w: '#F3F5FA' } },
    wrench: { rows: ['s.s', 'sss', '.s.', '.s.', '.o.', '.o.'], pal: { s: '#9EA2AA', o: PAL.deepOrange } },
    phone: { rows: ['kkk', 'kjk', 'kjk', 'kok', 'kkk'], pal: { k: '#26272B', j: PAL.jade, o: PAL.orange } },
    stopwatch: { rows: ['..y.', '.yy.', 'ycky', 'yccy', '.yy.'], pal: { y: PAL.gold, c: PAL.cream, k: '#26272B' } },
    server: { rows: ['kkkk', 'kjsk', 'kkkk', 'kjsk', 'kkkk'], pal: { k: '#26272B', j: '#6FE3C0', s: '#9EA2AA' } },
    mug: { rows: ['kkk.', 'kook', 'kkk.', 'kkk.'], pal: { k: '#26272B', o: PAL.orange } }
  };

  /* ---------- poses ---------- */
  function pose(dir, f) {
    var P = { uo: 0, lL: 0, lR: 0, sw: 0, s: 0, sx: 0 };
    if (dir === 'down' || dir === 'up') {
      if (f === 1) { P.uo = -1; P.lL = 1; P.sw = 1; }
      if (f === 3) { P.uo = -1; P.lR = 1; P.sw = -1; }
    } else {
      if (f === 1) { P.uo = -1; P.s = 2; P.sx = -1; }
      if (f === 3) { P.uo = -1; P.s = -2; P.sx = 1; }
    }
    if (f === 5) { P.uo = 1; }
    return P;
  }

  /* ---------- body: front and back ---------- */
  function bounds(p) { return p.broad ? { x0: 3, x1: 12 } : { x0: 4, x1: 11 }; }

  function legsFV(o, p, P) {
    var b = p.bottom, bc = b.col, sh = shade(bc, 0.78), B = bounds(p), x0 = B.x0, x1 = B.x1, w = x1 - x0 + 1, lift, k;
    if (b.kind === 'skirt') {
      R(o, x0, 16, w, 1, bc); R(o, x0 - 1, 17, w + 2, 2, bc); R(o, x0 - 1, 18, w + 2, 1, shade(bc, 0.84));
      R(o, x1 + 1, 17, 1, 2, shade(bc, 0.84));
      for (k = 0; k < 2; k++) {
        lift = k === 0 ? P.lL : P.lR;
        R(o, k === 0 ? x0 + 1 : x1 - 2, 19, 2, 2 - lift, p.skinSh);
        R(o, k === 0 ? x0 : x1 - 3, 21 - lift, 4, 2, p.shoes);
      }
      return;
    }
    // trousers: hips 16..17, legs to 20, seam in the middle, shoes 21..22
    for (k = 0; k < 2; k++) {
      lift = k === 0 ? P.lL : P.lR;
      R(o, k === 0 ? x0 : 8, 16, k === 0 ? 4 + (p.broad ? 0 : 0) : (x1 - 8 + 1), 5 - lift, k === 0 ? bc : shade(bc, 0.9));
      R(o, k === 0 ? x0 : x1 - 3, 21 - lift, 4, 2, p.shoes);
      R(o, k === 0 ? x0 : x1 - 3, 21 - lift, 4, 1, shade(p.shoes, 1.18));
    }
    R(o, 7, 18, 2, 3, sh);
    R(o, 7, 16, 2, 2, bc);
    if (b.belt) { R(o, x0, 16, w, 1, b.belt); R(o, 7, 16, 2, 1, '#9EA2AA'); }
  }

  function armsFV(o, p, P, back) {
    var t = p.top, c = t.col, B = bounds(p), T = 11 + P.uo, short = (t.kind === 'tee' || t.kind === 'dress'),
      ax = [B.x0 - 1, B.x1 + 1], sw = [P.sw, -P.sw], k, bot, sc, sleeveEnd, y, ac;
    for (k = 0; k < 2; k++) {
      bot = 15 + sw[k]; sc = k === 0 ? c : shade(c, 0.86);
      if (t.kind === 'dress') { sleeveEnd = T; } else if (short) { sleeveEnd = T + 2; } else { sleeveEnd = bot - 1; }
      R(o, ax[k], T + 1, 1, bot - T, p.skin);
      if (sleeveEnd >= T + 1) { R(o, ax[k], T + 1, 1, sleeveEnd - T, sc); }
      if (t.kind === 'jacket' && sleeveEnd >= T + 2) { R(o, ax[k], sleeveEnd, 1, 1, shade(c, 0.7)); }
      R(o, ax[k], bot, 1, 1, p.skin);
      if (p.tat && ((p.tat === 'armL' && k === 0))) {
        for (y = Math.max(sleeveEnd + 1, T + 1); y <= bot; y++) { if ((y + k) % 2 === 0) { R(o, ax[k], y, 1, 1, '#3A3A40'); } }
      }
      if (t.puff) { R(o, ax[k], T, 1, 1, c); }
    }
  }

  function torsoFV(o, p, P, back) {
    var t = p.top, c = t.col, B = bounds(p), x0 = B.x0, x1 = B.x1, w = x1 - x0 + 1, T = 11 + P.uo, k = t.kind, col2, cx;
    R(o, x0, T, w, 16 - T, c);
    R(o, x1, T, 1, 16 - T, shade(c, 0.86));
    col2 = t.col2 || shade(c, lum(c) > 0.5 ? 0.86 : 1.5);
    if (back) {
      if (k === 'hoodie') { R(o, x0, T, w, 1, shade(c, 0.78)); R(o, x0 + 1, T + 1, w - 2, 2, shade(c, 0.9)); }
      if (k === 'blazer') { R(o, 7, T + 1, 2, 4, shade(c, 0.8)); }
      if (k === 'jacket') { R(o, x0, T, w, 1, shade(c, 0.78)); }
      if (k === 'shirt' || k === 'tee') { R(o, 6, T, 4, 1, shade(c, 0.86)); }
      return;
    }
    cx = 7;
    if (k === 'shirt') {
      R(o, cx, T, 2, t.open ? 2 : 1, p.skin);
      R(o, 6, T, 1, 2, col2); R(o, 9, T, 1, 2, col2);
      R(o, 8, T + 3, 1, 1, shade(c, 0.78)); if (T + 5 <= 15) { R(o, 8, T + 5, 1, 1, shade(c, 0.78)); }
    } else if (k === 'tee') {
      R(o, 6, T, 4, 1, p.skinSh); R(o, 7, T + 1, 2, 1, p.skinSh);
      R(o, 6, T + 1, 1, 1, col2); R(o, 9, T + 1, 1, 1, col2);
    } else if (k === 'blazer') {
      R(o, 6, T, 4, 1, PAL.paper); R(o, 7, T + 1, 2, 1, PAL.paper); R(o, 7, T, 2, 1, p.skinSh);
      R(o, 5, T, 1, 2, shade(c, 1.5)); R(o, 10, T, 1, 2, shade(c, 1.5)); R(o, 8, T + 3, 1, 1, shade(c, 0.7));
    } else if (k === 'hoodie') {
      R(o, x0, T, w, 1, shade(c, 0.78)); R(o, 7, T, 2, 1, p.skinSh); R(o, 6, T + 1, 1, 2, PAL.cream); R(o, 9, T + 1, 1, 2, PAL.cream);
      R(o, x0 + 1, 14, w - 2, 1, shade(c, 0.82));
    } else if (k === 'jacket') {
      R(o, 6, T, 4, 2, t.col2); R(o, 7, T, 2, 1, p.skinSh);
      R(o, 7, T + 2, 1, 16 - T - 2, shade(c, 0.7)); R(o, 5, T, 1, 1, shade(c, 0.7)); R(o, 10, T, 1, 1, shade(c, 0.7));
      R(o, x0, 15, w, 1, shade(c, 0.8));
    } else if (k === 'dress') {
      R(o, 6, T, 4, 1, p.skinSh); R(o, 5, T, 1, 1, c); R(o, 10, T, 1, 1, c);
      R(o, x0, T + 3, w, 1, PAL.deepOrange);
    }
    if (t.logo && k !== 'dress' && k !== 'hoodie' && k !== 'jacket' && k !== 'blazer') {
      R(o, 9, T + 2, 1, 1, t.white ? PAL.paper : PAL.paper); R(o, 10, T + 2, 1, 1, t.white ? PAL.paper : PAL.orange);
    }
  }

  /* worn extras on the torso */
  function wornFV(o, p, P, dir) {
    var T = 11 + P.uo, B = bounds(p);
    if (p.badge === 'padlock' && dir === 'down') {
      R(o, 6, T, 1, 1, PAL.paper); R(o, 9, T, 1, 1, PAL.paper); R(o, 7, T + 1, 2, 1, PAL.paper);
      BM(o, 6, T + 2, ['wssw', 'wddw', 'wddw'], { w: PAL.paper, s: '#9EA2AA', d: PAL.orange });
    }
    if (p.badge === 'pass' && dir === 'down') {
      R(o, 6, T, 1, 1, PAL.cream); R(o, 9, T, 1, 1, PAL.cream); R(o, 7, T + 1, 2, 1, PAL.cream);
      BM(o, 7, T + 2, ['cc', 'co'], { c: PAL.cream, o: PAL.orange });
    }
    if (p.neckphones && dir === 'down') {
      R(o, B.x0, T, B.x1 - B.x0 + 1, 1, '#9EA2AA');
      R(o, B.x0 - 1, T, 2, 3, PAL.steel); R(o, B.x1 - 0, T, 2, 3, PAL.steel);
      R(o, B.x0 - 1, T + 1, 1, 1, PAL.orange); R(o, B.x1 + 1, T + 1, 1, 1, PAL.orange);
    }
    if (p.neckphones && dir === 'up') {
      R(o, B.x0, T, B.x1 - B.x0 + 1, 1, '#9EA2AA'); R(o, B.x0 - 1, T, 2, 3, PAL.steel); R(o, B.x1, T, 2, 3, PAL.steel);
    }
  }

  /* ---------- head: front ---------- */
  function skinHead(o, p, y) {
    R(o, 5, 1 + y, 6, 1, p.skin); R(o, 4, 2 + y, 8, 1, p.skin); R(o, 3, 3 + y, 10, 7, p.skin); R(o, 4, 10 + y, 8, 1, p.skin);
    R(o, 12, 4 + y, 1, 6, p.skinSh);
  }

  function hairTopFront(o, p, y) {
    var c = p.hair, h = p.hairHi, s = p.style, i, lx, rx, yy, root = p.roots;
    function r(x, yy2, w, hh, col) { R(o, x, yy2 + y, w, hh, col); }
    if (s === 'bald') { r(6, 2, 2, 1, p.skinHi); return; }
    if (s === 'buzz') {
      var m = mix(p.skin, c, 0.6);
      r(5, 1, 6, 1, m); r(4, 2, 8, 1, m); r(3, 3, 10, 1, m); r(3, 4, 1, 1, m); r(12, 4, 1, 1, m); return;
    }
    if (s === 'slick') { r(3, 4, 1, 2, c); r(12, 4, 1, 2, c); return; }
    if (s === 'short' || s === 'side' || s === 'quiff' || s === 'curlyshort') {
      if (s === 'quiff') { r(6, 1, 6, 1, h); r(4, 2, 8, 1, c); r(3, 3, 10, 1, c); r(3, 4, 1, 1, c); r(12, 4, 1, 1, c); r(10, 2, 2, 1, h); return; }
      if (s === 'curlyshort') {
        r(5, 1, 2, 1, c); r(8, 1, 3, 1, c); r(4, 2, 8, 1, c); r(3, 3, 10, 1, c); r(3, 4, 2, 1, c); r(11, 4, 2, 1, c);
        r(6, 2, 1, 1, h); r(9, 2, 1, 1, h); r(4, 3, 1, 1, h); return;
      }
      r(5, 1, 6, 1, c); r(4, 2, 8, 1, c); r(3, 3, 10, 1, c); r(3, 4, 1, 2, c); r(12, 4, 1, 2, c); r(4, 4, 1, 1, c); r(11, 4, 1, 1, c);
      r(6, 1, 2, 1, h);
      if (s === 'side') { r(3, 4, 6, 1, c); r(4, 5, 1, 1, c); r(5, 3, 3, 1, h); }
      if (p.cowlick) { r(8, 0, 1, 1, c); r(9, 1, 1, 1, h); }
      return;
    }
    if (s === 'curlylong') {
      r(5, 1, 6, 1, c); r(4, 1, 1, 1, c); r(11, 1, 1, 1, c); r(3, 2, 10, 1, c); r(2, 3, 12, 1, c);
      for (yy = 4; yy <= 12; yy++) {
        lx = (yy % 2) ? 1 : 2; rx = 15 - lx;
        r(lx, yy, 4 - lx, 1, c); r(12, yy, rx - 11, 1, c);
        if (yy === 4 || yy === 5) { r(4, yy, 1, 1, c); r(11, yy, 1, 1, c); }
      }
      r(6, 1, 1, 1, h); r(9, 2, 2, 1, h); r(3, 4, 1, 1, h); r(2, 7, 1, 1, h); r(13, 6, 1, 1, h); r(1, 9, 1, 1, h);
      r(2, 12, 1, 1, h); r(5, 3, 2, 1, h);
      return;
    }
    // long / wavy
    r(5, 1, 6, 1, c); r(3, 2, 10, 1, c); r(2, 3, 12, 1, c);
    if (p.fringe === 'side') { r(3, 4, 6, 1, c); r(3, 5, 2, 1, c); r(2, 4, 1, 1, c); } else { r(3, 4, 2, 1, c); r(11, 4, 2, 1, c); }
    if (root) { r(3, 2, 10, 1, root); r(2, 3, 12, 1, root); r(5, 1, 6, 1, root); }
    R(o, 7, 3 + y, 2, 1, p.skin);
    if (p.fringe === 'side') { R(o, 9, 3 + y, 2, 1, c); }
    for (yy = 4; yy <= 14; yy++) {
      if (s === 'wavy') { lx = (Math.floor((yy - 4) / 2) % 2 === 0) ? 1 : 2; } else { lx = 2; }
      rx = 15 - lx;
      if (yy <= 10) { r(lx, yy, 4 - lx, 1, c); r(12, yy, rx - 11, 1, c); }
      else if (yy <= 13) { r(lx, yy, 3 - lx, 1, c); r(13, yy, rx - 12, 1, c); }
      else { r(2, yy, 1, 1, shade(c, 0.85)); r(13, yy, 1, 1, shade(c, 0.85)); }
    }
    r(6, 1, 1, 1, h); r(9, 2, 2, 1, h); r(3, 5, 1, 3, h); r(12, 6, 1, 2, h);
    if (s === 'wavy') { r(2, 9, 1, 1, h); r(13, 8, 1, 1, h); }
  }

  function faceFront(o, p, y, hi) {
    var ey = p.eye, light = (ey !== DARK && lum(ey) > 0.2), g = p.glasses, i, ex = [5, 10], hasG = !!g, sunny = g && (g[0] === 'sun' || g[0] === 'avi'),
      brow = mix(p.hair, p.skin, p.style === 'bald' ? 0.4 : 0.1);
    // eyes
    if (!sunny) {
      for (i = 0; i < 2; i++) {
        if (hi) {
          R(o, ex[i], 6 + y, 1, 1.5, DARK);
          if (light) { R(o, ex[i], 6.5 + y, 1, 1, ey); }
          R(o, ex[i] + 0.5, 6 + y, 0.5, 0.5, '#FFFFFF');
          if (!hasG) { R(o, ex[i] - 0.5, 5 + y, 2, 0.5, brow); }
        } else {
          if (hasG) { R(o, ex[i], 6 + y, 1, 1, '#E6EEF0'); R(o, ex[i], 7 + y, 1, 1, DARK); }
          else { R(o, ex[i], 6 + y, 1, 1, DARK); R(o, ex[i], 7 + y, 1, 1, light ? ey : DARK); }
        }
      }
    }
    // blush and mouth
    if (!p.beard || p.beard[0] === 'stubble') { R(o, 4, 8 + y, 1, 1, p.blush); R(o, 11, 8 + y, 1, 1, p.blush); }
    if (hi) {
      if (!(p.beard && p.beard[0] === 'full')) {
        R(o, 7, 9 + y, 2, 0.5, p.mouth); R(o, 6.5, 8.5 + y, 0.5, 0.5, p.mouth); R(o, 9, 8.5 + y, 0.5, 0.5, p.mouth);
      }
      R(o, 7.5, 7.5 + y, 1, 0.5, p.skinSh);
    } else if (!(p.beard && p.beard[0] === 'full')) {
      R(o, 7, 9 + y, 2, 1, p.mouth);
    }
    // beard
    if (p.beard) {
      var bc = p.beard[1], kind = p.beard[0], st = mix(p.skin, bc, 0.5);
      if (kind === 'stubble') {
        R(o, 3, 8 + y, 2, 2, st); R(o, 11, 8 + y, 2, 2, st); R(o, 5, 9 + y, 6, 1, st); R(o, 4, 10 + y, 8, 1, st); R(o, 6, 8 + y, 4, 1, st);
        R(o, 7, 9 + y, 2, 1, p.mouth);
      } else {
        R(o, 3, 7 + y, 1, 3, bc); R(o, 12, 7 + y, 1, 3, bc);
        R(o, 3, 9 + y, 4, 1, bc); R(o, 9, 9 + y, 4, 1, bc); R(o, 4, 10 + y, 8, 1, bc); R(o, 4, 8 + y, 1, 1, bc); R(o, 11, 8 + y, 1, 1, bc);
        R(o, 6, 8 + y, 4, 1, bc);
        R(o, 7, 9 + y, 2, 1, hi ? shade(p.mouth, 0.9) : p.mouth);
        if (p.beard[2] === 'mus') { R(o, 5, 8 + y, 6, 1, bc); }
        if (p.hair === bc || kind === 'full') { R(o, 4, 10 + y, 8, 1, shade(bc, 0.9)); }
      }
    }
    // glasses
    if (g) {
      var t = hi ? 0.5 : 1, gt = g[0], gc = g[1];
      if (gt === 'rect' || gt === 'tort' || gt === 'round') {
        BOX(o, 4, 5 + y, 3, 4, t, gc, gt === 'round'); BOX(o, 9, 5 + y, 3, 4, t, gc, gt === 'round');
        R(o, 7, 6 + y, 2, hi ? 0.5 : 1, gc);
        if (hi && gt === 'tort') { R(o, 4, 5 + y, 3, 0.5, shade(gc, 1.4)); R(o, 9, 5 + y, 3, 0.5, shade(gc, 1.4)); }
      } else if (gt === 'sun') {
        R(o, 4, 6 + y, 3, 2, gc); R(o, 9, 6 + y, 3, 2, gc); R(o, 7, 6 + y, 2, 1, '#DDDDDD'); R(o, 4, 6 + y, 1, 1, shade(gc, 1.5)); R(o, 9, 6 + y, 1, 1, shade(gc, 1.5));
        R(o, 3, 6 + y, 1, 1, '#DDDDDD'); R(o, 12, 6 + y, 1, 1, '#DDDDDD');
      } else if (gt === 'avi') {
        R(o, 4, 5 + y, 3, 3, gc); R(o, 9, 5 + y, 3, 3, gc); R(o, 7, 5 + y, 2, 1, '#D8B04A');
        R(o, 4, 7 + y, 1, 1, shade(gc, 1.3)); R(o, 11, 7 + y, 1, 1, shade(gc, 1.3)); R(o, 4, 5 + y, 3, 1, '#D8B04A'); R(o, 9, 5 + y, 3, 1, '#D8B04A');
      }
    }
  }

  function headExtras(o, p, y, dir) {
    if (p.hat === 'chef') {
      var w = '#FFFFFF', s = '#DADDE3';
      R(o, 5, 1 + y, 6, 1, w); R(o, 4, 2 + y, 8, 1, w); R(o, 3, 3 + y, 10, 1, '#F3F5FA');
      R(o, 4, 2 + y, 1, 1, s); R(o, 11, 2 + y, 1, 1, s); R(o, 3, 3 + y, 10, 1, '#F3F5FA'); R(o, 12, 3 + y, 1, 1, s);
      R(o, 7, 1 + y, 2, 1, s);
    }
    if (p.headset) {
      var st = '#9EA2AA';
      if (dir === 'down') {
        R(o, 4, 1 + y, 8, 1, st); R(o, 3, 2 + y, 1, 1, st); R(o, 12, 2 + y, 1, 1, st);
        R(o, 2, 5 + y, 2, 4, PAL.steel); R(o, 12, 5 + y, 2, 4, PAL.steel); R(o, 2, 6 + y, 1, 2, '#6B6E75'); R(o, 13, 6 + y, 1, 2, '#6B6E75');
        R(o, 3, 9 + y, 1, 1, PAL.steel); R(o, 4, 10 + y, 3, 1, PAL.steel); R(o, 7, 10 + y, 1, 1, PAL.orange);
      } else if (dir === 'up') {
        R(o, 4, 1 + y, 8, 1, st); R(o, 3, 2 + y, 1, 1, st); R(o, 12, 2 + y, 1, 1, st);
        R(o, 2, 5 + y, 2, 4, PAL.steel); R(o, 12, 5 + y, 2, 4, PAL.steel);
      }
    }
  }

  function headFront(o, p, P) {
    var y = P.uo;
    skinHead(o, p, y);
    if (p.style === 'bald') { R(o, 5, 1 + y, 6, 1, p.skin); }
    faceFront(o, p, y, o.u > 1);
    hairTopFront(o, p, y);
    if (p.hat === 'chef') { /* hat covers the top rows */ }
    headExtras(o, p, y, 'down');
    // the long-hair curtain must sit over the face edges, glasses on top of it
    if (p.glasses && p.long) { /* glasses already drawn before hair, redraw on top */ faceGlassesOnly(o, p, y); }
  }
  function faceGlassesOnly(o, p, y) {
    var g = p.glasses, t = o.u > 1 ? 0.5 : 1, gt = g[0], gc = g[1];
    if (gt === 'rect' || gt === 'tort' || gt === 'round') {
      BOX(o, 4, 5 + y, 3, 4, t, gc, gt === 'round'); BOX(o, 9, 5 + y, 3, 4, t, gc, gt === 'round'); R(o, 7, 6 + y, 2, o.u > 1 ? 0.5 : 1, gc);
    } else if (gt === 'avi') {
      R(o, 4, 5 + y, 3, 3, gc); R(o, 9, 5 + y, 3, 3, gc); R(o, 7, 5 + y, 2, 1, '#D8B04A'); R(o, 4, 5 + y, 3, 1, '#D8B04A'); R(o, 9, 5 + y, 3, 1, '#D8B04A');
    }
  }

  /* ---------- head: back ---------- */
  function headBack(o, p, P) {
    var y = P.uo, c = p.hair, h = p.hairHi, s = p.style, yy, lx, rx;
    function r(x, yy2, w, hh, col) { R(o, x, yy2 + y, w, hh, col); }
    skinHead(o, p, y);
    if (s === 'bald') { r(6, 2, 2, 1, p.skinHi); headExtras(o, p, y, 'up'); return; }
    if (s === 'buzz') {
      var m = mix(p.skin, c, 0.6); r(5, 1, 6, 1, m); r(4, 2, 8, 6, m); r(3, 3, 10, 5, m); r(4, 8, 8, 1, mix(p.skin, c, 0.35));
      headExtras(o, p, y, 'up'); return;
    }
    if (p.long || s === 'curlylong') {
      r(5, 1, 6, 1, c); r(3, 2, 10, 1, c); r(2, 3, 12, 11, c);
      if (s === 'curlylong') { r(1, 4, 14, 9, c); r(2, 13, 12, 1, c); }
      if (s === 'wavy') { for (yy = 5; yy <= 13; yy += 2) { r(1, yy, 1, 1, c); r(14, yy - 1, 1, 1, c); } }
      r(4, 14, 8, 1, shade(c, 0.85)); r(6, 3, 1, 8, h); r(9, 5, 1, 5, h); r(4, 2, 2, 1, h);
      if (p.roots) { r(3, 2, 10, 1, p.roots); r(2, 3, 12, 2, p.roots); }
    } else {
      r(5, 1, 6, 1, c); r(4, 2, 8, 1, c); r(3, 3, 10, 5, c); r(4, 8, 8, 1, c);
      r(5, 9, 6, 1, p.skinSh); r(6, 1, 2, 1, h); r(5, 4, 1, 2, h);
      if (p.cowlick) { r(8, 0, 1, 1, c); }
      if (s === 'slick') { r(4, 8, 8, 2, c); r(11, 9, 2, 3, c); r(12, 12, 1, 3, shade(c, 0.9)); }
    }
    if (p.beard && p.beard[0] === 'full') { /* nothing visible from behind */ }
    headExtras(o, p, y, 'up');
  }

  /* ---------- side view (facing right) ---------- */
  function sideBody(o, p, P) {
    var t = p.top, c = t.col, T = 11 + P.uo, x0 = p.broad ? 4 : 5, x1 = p.broad ? 11 : 10, w = x1 - x0 + 1, k = t.kind, b = p.bottom, bc = b.col,
      s = P.s, yy, short = (k === 'tee' || k === 'dress'), col2 = t.col2 || shade(c, lum(c) > 0.5 ? 0.86 : 1.5), ax;
    // legs
    function leg(xx, col, shoeCol, rise) {
      if (b.kind === 'skirt') {
        R(o, xx + 1, 19, 2, 2, p.skinSh);
      } else {
        R(o, xx, 17, 3, 4, col);
      }
      R(o, xx, 21 - rise, 4, 2, shoeCol); R(o, xx + 3, 21 - rise, 1, 2, shade(shoeCol, 1.2));
    }
    var back = shade(bc, 0.78), backShoe = shade(p.shoes, 0.8);
    leg(6 - s, back, backShoe, 0);
    leg(6 + s, bc, p.shoes, 0);
    if (b.kind === 'skirt') {
      R(o, x0 - 1, 16, w + 2, 3, bc); R(o, x0 - 1, 18, w + 2, 1, shade(bc, 0.84));
    } else {
      R(o, x0, 16, w, 2, bc);
      if (b.belt) { R(o, x0, 16, w, 1, b.belt); R(o, x1 - 1, 16, 1, 1, '#9EA2AA'); }
    }
    // torso
    R(o, x0, T, w, 16 - T, c); R(o, x0, T, 1, 16 - T, shade(c, 0.82));
    if (k === 'hoodie') { R(o, x0, T, w, 1, shade(c, 0.78)); R(o, x1 - 1, 14, 2, 1, shade(c, 0.82)); }
    if (k === 'blazer') { R(o, x1, T, 1, 3, PAL.paper); R(o, x1 - 1, T, 1, 1, shade(c, 1.5)); }
    if (k === 'jacket') { R(o, x1, T, 1, 2, t.col2); R(o, x0, 15, w, 1, shade(c, 0.8)); }
    if (k === 'dress') { R(o, x0, T + 3, w, 1, PAL.deepOrange); }
    if ((k === 'shirt' || k === 'tee') && t.logo) { R(o, x1 - 1, T + 2, 1, 1, PAL.paper); R(o, x1, T + 2, 1, 1, PAL.orange); }
    if (t.puff) { R(o, 7 + P.sx, T, 2, 1, c); }
    // near arm swings across the torso
    ax = 7 + P.sx;
    var ac = shade(c, 0.9), bot = 15, se = short ? T + 2 : bot - 1;
    if (k === 'dress') { se = T; }
    R(o, ax, T + 1, 2, bot - T, p.skin);
    if (se >= T + 1) { R(o, ax, T + 1, 2, se - T, ac); R(o, ax + 1, T + 1, 1, se - T, shade(c, 0.78)); }
    if (k === 'jacket') { R(o, ax, se, 2, 1, shade(c, 0.7)); }
    R(o, ax, bot, 2, 1, p.skin);
    if (p.tat === 'armL') { for (yy = Math.max(se + 1, T + 1); yy <= bot; yy++) { if (yy % 2 === 0) { R(o, ax, yy, 1, 1, '#3A3A40'); } } }
    if (p.neckphones) { R(o, x0, T, w, 1, '#9EA2AA'); R(o, 6, T, 3, 3, PAL.steel); R(o, 7, T + 1, 1, 1, PAL.orange); }
  }

  function sideHair(o, p, y, behind) {
    var c = p.hair, h = p.hairHi, s = p.style, yy, root = p.roots;
    function r(x, yy2, w, hh, col) { R(o, x, yy2 + y, w, hh, col); }
    if (behind) { // hair hanging behind the head and shoulders (drawn before the torso)
      if (p.long) {
        r(2, 3, 5, 11, c);
        if (s === 'wavy') { r(1, 6, 1, 2, c); r(1, 10, 1, 2, c); r(2, 14, 4, 1, shade(c, 0.85)); }
        else { r(3, 14, 3, 1, shade(c, 0.85)); }
        r(3, 5, 1, 7, h);
      }
      if (s === 'curlylong') { r(1, 3, 6, 11, c); r(0, 5, 1, 1, null); r(2, 14, 4, 1, shade(c, 0.85)); r(2, 6, 1, 1, h); r(3, 10, 1, 1, h); r(1, 12, 1, 1, h); }
      if (s === 'slick' && !p.hat) { r(3, 8, 3, 6, c); }
      if (s === 'slick') { r(2, 4, 4, 9, c); r(2, 13, 3, 2, shade(c, 0.85)); r(3, 6, 1, 4, p.hairHi); }
      return;
    }
    if (s === 'bald') { r(6, 2, 2, 1, p.skinHi); return; }
    if (s === 'buzz') {
      var m = mix(p.skin, c, 0.6);
      r(5, 1, 6, 1, m); r(4, 2, 8, 1, m); r(3, 3, 8, 3, m); r(3, 6, 2, 1, m); r(9, 3, 3, 1, m); return;
    }
    r(5, 1, 6, 1, c); r(4, 2, 8, 1, c); r(3, 3, 9, 1, c); r(3, 4, 4, 3, c); r(9, 4, 3, 1, c);
    if (root) { r(5, 1, 6, 1, root); r(4, 2, 8, 1, root); r(3, 3, 9, 1, root); }
    if (s === 'quiff') { r(6, 0, 1, 1, null); r(7, 1, 5, 1, h); r(10, 2, 2, 1, h); }
    if (s === 'curlyshort') { r(5, 1, 2, 1, h); r(8, 1, 1, 1, h); r(3, 4, 5, 3, c); r(9, 4, 3, 1, c); }
    if (s === 'curlylong') { r(4, 1, 1, 1, c); r(11, 1, 1, 1, c); r(3, 4, 4, 5, c); r(9, 4, 2, 2, c); r(6, 1, 1, 1, h); r(4, 3, 2, 1, h); }
    if (s === 'side') { r(9, 4, 3, 1, c); r(10, 5, 1, 1, c); r(5, 3, 3, 1, h); }
    if (s === 'short') { r(6, 1, 2, 1, h); if (p.cowlick) { r(8, 0, 1, 1, c); r(9, 1, 1, 1, h); } }
    if (p.long) { r(6, 1, 1, 1, h); r(9, 2, 2, 1, h); r(9, 4, 2, 1, c); r(11, 4, 1, 2, c); }
    if (s === 'slick') { r(6, 4, 2, 1, h); }
  }

  function sideHead(o, p, P) {
    var y = P.uo, g = p.glasses, light = (p.eye !== DARK && lum(p.eye) > 0.2);
    // skin: head x4..11, nose at x12
    R(o, 5, 1 + y, 6, 1, p.skin); R(o, 4, 2 + y, 8, 1, p.skin); R(o, 4, 3 + y, 8, 7, p.skin); R(o, 5, 10 + y, 6, 1, p.skin);
    R(o, 12, 7 + y, 1, 2, p.skin); R(o, 4, 4 + y, 1, 6, p.skinSh);
    // eye
    if (!(g && (g[0] === 'sun' || g[0] === 'avi'))) {
      if (g) { R(o, 9, 6 + y, 1, 1, '#E6EEF0'); R(o, 9, 7 + y, 1, 1, DARK); }
      else { R(o, 9, 6 + y, 1, 1, DARK); R(o, 9, 7 + y, 1, 1, light ? p.eye : DARK); }
    }
    R(o, 11, 9 + y, 1, 1, p.mouth); R(o, 10, 8 + y, 1, 1, p.blush);
    // ear
    if (!p.long || p.style === 'slick') { R(o, 6, 7 + y, 1, 2, p.skinSh); }
    // beard
    if (p.beard) {
      var bc = p.beard[1], kind = p.beard[0], st = mix(p.skin, bc, 0.5);
      if (kind === 'stubble') { R(o, 6, 8 + y, 5, 3, st); R(o, 11, 8 + y, 1, 1, st); R(o, 11, 9 + y, 1, 1, p.mouth); }
      else {
        R(o, 5, 7 + y, 2, 4, bc); R(o, 6, 9 + y, 6, 2, bc); R(o, 8, 8 + y, 4, 1, bc); R(o, 12, 8 + y, 1, 1, bc); R(o, 6, 10 + y, 5, 1, shade(bc, 0.9));
        R(o, 11, 9 + y, 1, 1, shade(bc, 1.4));
      }
    }
    sideHair(o, p, y, false);
    if (p.hat === 'chef') {
      R(o, 5, 1 + y, 6, 1, '#FFFFFF'); R(o, 4, 2 + y, 8, 1, '#FFFFFF'); R(o, 3, 3 + y, 9, 1, '#F3F5FA'); R(o, 4, 2 + y, 1, 1, '#DADDE3'); R(o, 11, 3 + y, 1, 1, '#DADDE3');
    }
    if (g) {
      var gt = g[0], gc = g[1];
      if (gt === 'rect' || gt === 'tort' || gt === 'round') { BOX(o, 8, 5 + y, 3, 4, 1, gc, gt === 'round'); R(o, 5, 6 + y, 3, 1, gc); }
      else if (gt === 'sun') { R(o, 8, 6 + y, 4, 2, gc); R(o, 8, 6 + y, 1, 1, shade(gc, 1.5)); R(o, 5, 6 + y, 3, 1, '#DDDDDD'); }
      else if (gt === 'avi') { R(o, 8, 5 + y, 4, 3, gc); R(o, 8, 5 + y, 4, 1, '#D8B04A'); R(o, 5, 6 + y, 3, 1, '#D8B04A'); }
    }
    if (p.headset) {
      R(o, 5, 1 + y, 6, 1, '#9EA2AA'); R(o, 6, 6 + y, 2, 4, PAL.steel); R(o, 6, 7 + y, 1, 2, '#6B6E75');
      R(o, 8, 10 + y, 3, 1, PAL.steel); R(o, 11, 10 + y, 1, 1, PAL.orange);
    }
  }

  /* ---------- held items ---------- */
  function heldItem(o, p, P, dir, behind) {
    var it = p.acc && ITEMS[p.acc], w, h, ax, ay;
    if (!it) { return; }
    w = it.rows[0].length; h = it.rows.length;
    ay = 17 - h + P.uo;
    if (dir === 'down') { ax = w >= 4 ? 11 : 12; if (p.broad && w >= 4) { ax = 11; } BM(o, ax, ay, it.rows, it.pal, false); }
    else if (dir === 'up' && behind) { ax = 16 - (w >= 4 ? 11 : 12) - w; BM(o, ax, ay, it.rows, it.pal, true); }
    else if (dir === 'right') { ax = 9 + P.sx + (w >= 4 ? 0 : 1); BM(o, ax, ay, it.rows, it.pal, false); }
  }

  /* ---------- assemble one frame ---------- */
  function drawFrame(o, p, dir, f) {
    var P = pose(dir, f), hi = o.u > 1;
    if (dir === 'down') {
      legsFV(o, p, P); torsoFV(o, p, P, false); armsFV(o, p, P, false); wornFV(o, p, P, dir); headFront(o, p, P); heldItem(o, p, P, 'down', false);
    } else if (dir === 'up') {
      heldItem(o, p, P, 'up', true); legsFV(o, p, P); torsoFV(o, p, P, true); armsFV(o, p, P, true); wornFV(o, p, P, dir); headBack(o, p, P);
    } else { // right (left is mirrored)
      sideHair(o, p, P.uo, true); sideBody(o, p, P); sideHead(o, p, P); heldItem(o, p, P, 'right', false);
    }
  }

  /* ---------- sprite sheets and portraits (cached) ---------- */
  var DIRS = ['down', 'up', 'left', 'right'];
  var sheets = {}, ports = {};

  function frameCanvas(p, dir, f) {
    var o, m;
    if (dir === 'left') {
      m = frameCanvas(p, 'right', f);
      o = mk(16, 24, 1);
      o.g.translate(16, 0); o.g.scale(-1, 1); o.g.drawImage(m, 0, 0);
      return o.c;
    }
    o = mk(16, 24, 1);
    drawFrame(o, p, dir, f);
    outline(o, PAL.outline);
    return o.c;
  }

  function sheet(id) {
    var s = sheets[id], p = LOOK[id], o, d, f;
    if (s || !p) { return s || null; }
    o = mk(96, 96, 1);
    for (d = 0; d < 4; d++) {
      for (f = 0; f < 6; f++) { o.g.drawImage(frameCanvas(p, DIRS[d], f), f * 16, d * 24); }
    }
    sheets[id] = o.c;
    return o.c;
  }

  function portraitCanvas(id) {
    var c = ports[id], p = LOOK[id], o, out;
    if (c || !p) { return c || null; }
    o = mk(16, 24, 2); // 32 x 48, then the top 32 rows are the bust
    drawFrame(o, p, 'down', 4);
    outline(o, PAL.outline);
    out = mk(32, 32, 1);
    out.g.drawImage(o.c, 0, 0, 32, 32, 0, 0, 32, 32);
    ports[id] = out.c;
    return out.c;
  }

  var reduced = false;
  try {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced = !!mq.matches;
    if (mq.addEventListener) { mq.addEventListener('change', function (e) { reduced = !!e.matches; }); }
  } catch (e0) { reduced = false; }

  function phase(id) { var n = 0, i; for (i = 0; i < id.length; i++) { n = (n * 31 + id.charCodeAt(i)) % 997; } return n; }

  function draw(ctx, id, dir, frame, x, y, scale) {
    var sh = sheet(id), d = DIRS.indexOf(dir), f, prev, s = scale || 1;
    if (!sh) { return false; }
    if (d < 0) { d = 0; }
    f = ((Math.floor(frame || 0) % 6) + 6) % 6;
    if (f === 4 && !reduced) { f = (Math.floor((Date.now() + phase(id) * 37) / 650) % 2) ? 5 : 4; }
    prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sh, f * 16, d * 24, 16, 24, Math.round(x), Math.round(y), 16 * s, 24 * s);
    ctx.imageSmoothingEnabled = prev;
    return true;
  }

  function portrait(ctx, id, x, y, scale) {
    var c = portraitCanvas(id), prev, s = scale || 1;
    if (!c) { return false; }
    prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, Math.round(x), Math.round(y), 32 * s, 32 * s);
    ctx.imageSmoothingEnabled = prev;
    return true;
  }

  function prewarm() { var i; for (i = 0; i < list.length; i++) { sheet(list[i].id); portraitCanvas(list[i].id); } }

  /* ---------- what they say ---------- */
  var SAY = {
    james: [
      'James. I run the day here: who does what, and in what order.',
      'Every decision goes in the notebook, dated, with the reason next to it.',
      'At the end of the day I close it. I write down what happened and nothing else.',
      'Take your time with the machines. Nobody here is on a deadline tonight.'],
    jessica: [
      'Hi, I am Jessica. Anything meant for Kazim passes my desk first.',
      'I keep the follow-ups. Nothing slips on my watch, and I take that personally.',
      'Looking for someone? Most of us are around, even after hours.'],
    natalia: [
      'Natalia. Frontend. I count clicks: one is good, three is a bug.',
      'One file at a time. The library already has it, most days.',
      'I count in here too: fifteen machines in the arcade, fifteen toys on the benches.'],
    camila: [
      'Camila. I make things move, and I know when to keep them still.',
      'Every animation I ship has a quiet version for people who want less motion.',
      'Watch the neon in the arcade. It flickers on purpose, and it stops if you ask it to.'],
    olga: [
      'Olga, QA. I assume it is broken until it proves otherwise.',
      'That is not an insult. It is the reason things ship calm.',
      'Noticed something odd in the room? Tell me. I will check it twice.'],
    kate: [
      'Kate, release. The rollback note is written before anything ships.',
      'Ship Control means I read the checklist twice and press the button once.',
      'The boxes by the wall are tomorrow\'s launches. Please do not shake them.'],
    valentina: [
      'Valentina. I read a brand\'s DNA from what it already is.',
      'I never invent a colour. I find the one the code was already using.',
      'Our orange is a real token. You can ask it its name.'],
    mariana: [
      'Mariana, backend. If a form submits and nobody notices, I did my job.',
      'Who sees what is decided in the database, not on the screen.',
      'The cables behind the counter are mine. Mind your step.'],
    leticia: [
      'Leticia, marketing. My work is counted in visits and in people who write back.',
      'Quiet job, loud numbers. I like both.',
      'Did you find us through a search? Then that was me. Hello.'],
    gabi: [
      'Gabi. I write the report a client reads at the end of a sprint.',
      'I tell it the way it happened. It reads better, and nobody has to fix it later.',
      'Every report gets a date and a file name. I am quietly proud of the file names.'],
    nastiya: [
      'Nastiya, research. I go deep somewhere quiet and come back with sources.',
      'You get a short answer with every source named, never a pile of links.',
      'Ask me anything. I will come back with something I can cite.'],
    ana: [
      'Ana, security. Everything is guilty until audited.',
      'My reports read like weather warnings. Today: clear, with a light breeze of questions.',
      'I like a locked door. There is one at the back of this place.'],
    selma: [
      'Selma, solutions architect. Every project starts on my desk.',
      'I get the intake right so the rest of the pipeline inherits a good plan.',
      'I like a good floor plan. This building has a decent one.'],
    baha: [
      'Baha, though the studio says Magi. I see the picture before there is a picture.',
      'I close every delivery with the Premiere: real pixels, every frame checked.',
      'Always one step further than asked. That is the whole trick.'],
    fadil: [
      'Fadil, technical director. Nothing reaches release without passing me.',
      'A deadline is a date. It is not a reason to wave something through.',
      'Cenk to old friends, CENGO to the internet. One of the toys uses the second name.'],
    memotti: [
      'Memotti, creative director. I keep the eye.',
      'Fifteen specialists, one brand. I make sure it holds, one component at a time.',
      'Not easily satisfied is the job description. If you like it, good. I will look again tomorrow.'],
    emre: [
      'Emre, client success. I read everything one last time before it leaves the building.',
      'Every money move here is a human decision. Nothing moves by itself.',
      'Mr. Kaplan reads markets the way I read reports: with one eyebrow up.'],
    chefito: [
      'Chefito, Sefito at home. I am the handshake outside the building.',
      'Not at a desk, on purpose. Somebody has to be out meeting people.',
      'The hat is a nickname. The cooking is optional, the introductions are not.'],
    halodinho: [
      'Halodinho, operations. If you did not notice me today, it went well.',
      'Branches, pull requests, archives: all in order. That is my kind of fun.',
      'I never lose the ball. Ask me where anything is.'],
    tony: [
      'Tony, Gangaa to everyone here. I keep it standing.',
      'Up, deployed, safe. Those are my three words.',
      'That hum you hear is a quiet night. Best sound there is.'],
    kazim: [
      'Welcome to K13. I am Kazim. Gurkan and I run this place, the Masterminds, if you like titles.',
      'Everything here is made in-house. Poke at anything, that is what it is for.',
      'There are thirteen hidden things in this building. Nobody finds them all on the first lap.',
      'Start with the details. The details are where we hide things.'],
    gurkan: [
      'Gurkan. Kazim and I built this place, and I like it best after hours.',
      'Play the arcade first. They are real games, and a few of them are hard.',
      'Thirteen things are hidden here. I know where. I will not say.'],
    player: [
      'Visiting intern. The hoodie is orange, the plans are bigger.',
      'Walk up to anything and press E. The crew like being talked to.']
  };
  SAY.gurkan[0] = 'Gürkan. Kazim and I built this place, and I like it best after hours.';
  SAY.gurkan[2] = 'Thirteen things are hidden here. I know where. I will not say.';
  SAY.chefito[0] = 'Chefito, Şefito at home. I am the handshake outside the building.';
  SAY.olga[1] = 'That is not an insult. It is the reason things ship calm.';

  function foundCount(state) {
    var f;
    if (!state) { return null; }
    f = state.found;
    if (f && typeof f.length === 'number') { return f.length; }
    if (typeof f === 'number') { return f; }
    if (typeof state.count === 'number') { return state.count; }
    return null;
  }

  function lines(id, state) {
    var base = SAY[id], out, n, hint;
    if (!base) { return ['...']; }
    out = base.slice(0, 3);
    n = foundCount(state);
    if (id === 'kazim' || id === 'gurkan') {
      if (n !== null && n >= 13) {
        out = [id === 'kazim' ? 'All thirteen. I did not think anyone would, not this soon.' : 'You found all thirteen. Go on, the back room is open.',
          'The Masterminds thank you. The coffee is on the house.'];
      } else if (n !== null && n > 0) {
        out = [base[0], n + ' of 13 found so far. ' + (id === 'kazim' ? 'Keep going, the rest are in the details.' : 'The quiet corners are worth a second look.')];
      }
    }
    try {
      if (NS.secrets && typeof NS.secrets.hintFor === 'function') {
        hint = NS.secrets.hintFor(id, state);
        if (hint && typeof hint === 'string') { if (out.length >= 4) { out.pop(); } out.push(hint); }
      }
    } catch (e1) { /* a hint is a bonus, never a failure */ }
    return out;
  }

  NS.people = {
    list: list, byId: byId, size: { w: 16, h: 24, portrait: 32 }, palette: PAL,
    draw: draw, portrait: portrait, lines: lines, prewarm: prewarm
  };
})();
