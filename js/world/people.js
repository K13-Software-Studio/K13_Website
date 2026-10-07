/* K13 Workbench World: the people (pixel characters, portraits, emotes, the visitor's creator, the studio cat).
 *
 * K13World.people = {
 *   list, byId, palette, lines(id, state), prewarm(),
 *   size:   { w:16, h:32, portrait:64, pet:16 }
 *   frames: { walk:8, idle:8 }          walk = frames 0..7, idle = 8 (breathes and blinks by itself)
 *   anchor: { cx:8, head:1, feet:31 }   in sprite pixels: horizontal centre, top of the hair, bottom row (outline)
 *   draw(ctx, id, dir, frame, x, y, scale)   x,y = TOP-LEFT of the 16x32 sprite; feet on row 31. dir: down|up|left|right
 *   setContext({season, hour}) / outfit(id, ctx)   seasonal and evening outfits, picked inside draw()
 *   emote(ctx, kind, x, y, scale, t)         bubble above a head, x,y = bottom centre of the bubble tail; emotes = [kinds]
 *   portrait(ctx, id, x, y, scale, expr)     64x64 bust; expr: neutral|happy|surprised|thinking
 *   portraitAt(ctx, id, x, y, scale, expr, t, talking)   same, with blink and mouth movement (t in seconds)
 *   parts, defaultLook, randomLook(seed), drawLook(ctx, look, dir, frame, x, y, scale), portraitLook(ctx, look, x, y, scale, expr)
 *   pet {id:'pixel', name:'Pixel', kind:'cat'}, drawPet(ctx, dir, frame, x, y, scale, pose)   16x16; poses walk|sit|sleep|stretch
 *   shadow(ctx, x, y, scale, w)              soft ground shadow, x = centre, y = the ground line
 * }
 * Everything is drawn in code, once per outfit, into offscreen canvases. No images, no fetches, no inline styles.
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
  function lift(c, f) { var a = hex(c), i; for (i = 0; i < 3; i++) { a[i] = a[i] * f + 14; } return toHex(a); }
  function hiOf(c) { return lum(c) > 0.5 ? shade(c, 1.16) : lift(c, 1.9); }
  function lum(c) { var a = hex(c); return (a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11) / 255; }
  function hash(s) { var n = 7, i; s = String(s); for (i = 0; i < s.length; i++) { n = (n * 31 + s.charCodeAt(i)) % 100003; } return n; }
  function pick(arr, s) { return arr[hash(s) % arr.length]; }

  var DARK = '#26272B';

  /* ---------- the roster (looks as in round 2, current crew only) ---------- */
  var DATA = [
    // id, name, role, look
    ['james', 'James', 'General Manager', {
      skin: '#E8B896', hair: '#7A3F1F', style: 'curlylong', beard: ['stubble', '#8A4E2A'], glasses: ['rect', '#26272B'],
      top: { kind: 'shirt', col: '#F3F5FA', open: 1, logo: 1 }, bottom: { kind: 'pants', col: '#414347', belt: '#5E3B26' },
      shoes: '#5E3B26', acc: 'notebook', eye: '#4B4A2A', coat: '#8A6A4A', scarf: '#EA5E14' }],
    ['jessica', 'Jessica', 'Executive Assistant', {
      skin: '#D9A06F', hair: '#D9A441', style: 'wavy', top: { kind: 'dress', col: '#F6EEDC' },
      bottom: { kind: 'skirt', col: '#F6EEDC' }, shoes: '#C98F67', acc: 'clipboard', eye: '#5A3A22', coat: '#B94612', scarf: '#F6EEDC' }],
    ['natalia', 'Natalia', 'Frontend Engineer', {
      skin: '#F0C8A8', hair: '#E8B960', style: 'long', top: { kind: 'shirt', col: '#F3F5FA', logo: 1 },
      bottom: { kind: 'pants', col: '#26272B', belt: '#414347' }, shoes: '#26272B', acc: 'laptop', eye: '#4A8DB5', coat: '#3F5F8A', scarf: '#EA5E14' }],
    ['camila', 'Camila', 'UI Motion Designer', {
      skin: '#C98F67', hair: '#3A2418', style: 'wavy', top: { kind: 'shirt', col: '#F3F5FA', logo: 1 },
      bottom: { kind: 'skirt', col: '#26272B', belt: '#26272B' }, shoes: '#26272B', acc: 'feather', eye: '#3A2418', coat: '#2F6F65', scarf: '#F0B429' }],
    ['olga', 'Olga', 'QA Test Engineer', {
      skin: '#D49A6A', hair: '#1B1412', style: 'long', fringe: 'side', top: { kind: 'shirt', col: '#2E2F33', logo: 1 },
      bottom: { kind: 'pants', col: '#26272B', belt: '#414347' }, shoes: '#1F2023', acc: 'magnifier', eye: '#26272B', coat: '#7A3B2E', scarf: '#F6EEDC' }],
    ['kate', 'Kate', 'Release Engineer', {
      skin: '#C98A5E', hair: '#7A4224', style: 'long', top: { kind: 'shirt', col: '#F3F5FA', logo: 1 },
      bottom: { kind: 'pants', col: '#414347', belt: '#26272B' }, shoes: '#F3F5FA', acc: 'rocket', eye: '#3A2418', coat: '#414347', scarf: '#EA5E14' }],
    ['valentina', 'Valentina', 'Brand DNA Designer', {
      skin: '#F0CBAE', hair: '#B8501C', style: 'wavy', top: { kind: 'shirt', col: '#F3F5FA', logo: 1 },
      bottom: { kind: 'skirt', col: '#26272B', belt: '#26272B' }, shoes: '#26272B', acc: 'swatches', eye: '#6FA0A0', coat: '#C9B28A', scarf: '#2F6F65' }],
    ['mariana', 'Mariana', 'Backend Integrations Engineer', {
      skin: '#C48A60', hair: '#15100E', style: 'long', top: { kind: 'shirt', col: '#2F6F65', logo: 1 },
      bottom: { kind: 'pants', col: '#26272B', belt: '#414347' }, shoes: '#26272B', headset: 1, eye: '#26272B', coat: '#414347', scarf: '#F0B429' }],
    ['leticia', 'Leticia', 'Marketing Specialist', {
      skin: '#E0B08A', hair: '#E6C488', roots: '#8A6A3A', style: 'long', glasses: ['avi', '#E9A93A'],
      top: { kind: 'shirt', col: '#F3F5FA', logo: 1 }, bottom: { kind: 'skirt', col: '#26272B', belt: '#26272B' },
      shoes: '#26272B', acc: 'megaphone', tat: 'armL', eye: '#6B7F5A', coat: '#EA5E14', scarf: '#F6EEDC' }],
    ['gabi', 'Gabi', 'Report Writer', {
      skin: '#C88A5C', hair: '#3B2418', style: 'wavy', top: { kind: 'shirt', col: '#F3F5FA', puff: 1, logo: 1 },
      bottom: { kind: 'skirt', col: '#26272B', belt: '#26272B' }, shoes: '#26272B', acc: 'pad', eye: '#4A2E1A', coat: '#5D6B3C', scarf: '#F6EEDC' }],
    ['nastiya', 'Nastiya', 'Research Analyst', {
      skin: '#DBA77A', hair: '#C9964A', style: 'wavy', top: { kind: 'shirt', col: '#F3F5FA', logo: 1 },
      bottom: { kind: 'pants', col: '#26272B', belt: '#414347' }, shoes: '#5E3B26', acc: 'books', eye: '#6E9FB5', coat: '#3F5F8A', scarf: '#F6EEDC' }],
    ['ana', 'Ana', 'Security Auditor', {
      skin: '#CC9570', hair: '#1A1210', style: 'wavy', glasses: ['tort', '#8A4B1F'],
      top: { kind: 'blazer', col: '#26272B' }, bottom: { kind: 'pants', col: '#26272B', belt: '#414347' },
      shoes: '#1F2023', badge: 'padlock', eye: '#3A2418', coat: '#26272B', scarf: '#EA5E14' }],
    ['selma', 'Selma', 'Solutions Architect', {
      skin: '#B07448', hair: '#120D0B', style: 'curlylong', top: { kind: 'shirt', col: '#2E2F33', logo: 1 },
      bottom: { kind: 'pants', col: '#414347', belt: '#26272B' }, shoes: '#1F2023', acc: 'blueprint', eye: '#26272B', coat: '#B94612', scarf: '#F6EEDC' }],
    ['baha', 'Baha', 'Art Director', {
      skin: '#C99770', hair: '#1C1612', style: 'side', beard: ['full', '#2A1F1A'], broad: 1,
      top: { kind: 'shirt', col: '#2E2F33', logo: 1 }, bottom: { kind: 'pants', col: '#414347', belt: '#26272B' },
      shoes: '#1F2023', acc: 'brush', eye: '#26272B', coat: '#414347', scarf: '#F0B429' }],
    ['fadil', 'Fadil', 'Technical Director', {
      skin: '#EDBF9B', hair: '#C8602A', style: 'quiff', top: { kind: 'shirt', col: '#2E2F33', open: 1, logo: 1 },
      bottom: { kind: 'pants', col: '#D8C4A6', belt: '#5E3B26' }, shoes: '#5E3B26', acc: 'wrench', eye: '#4B6A8A', coat: '#5D6B3C', scarf: '#F6EEDC' }],
    ['memotti', 'Memotti', 'Creative Director', {
      skin: '#C58E66', hair: '#2A2623', style: 'buzz', beard: ['full', '#3A312B'], glasses: ['round', '#D8B04A'],
      top: { kind: 'shirt', col: '#2E2F33', open: 1, logo: 1 }, bottom: { kind: 'pants', col: '#414347', belt: '#26272B' },
      shoes: '#1F2023', acc: 'clapper', eye: '#26272B', coat: '#7A5A3C', scarf: '#EA5E14' }],
    ['emre', 'Emre', 'Client Success Director', {
      skin: '#C48A60', hair: '#17120F', style: 'curlyshort', beard: ['stubble', '#2A2018'], broad: 1,
      top: { kind: 'tee', col: '#2E2F33', logo: 1 }, bottom: { kind: 'pants', col: '#414347' }, shoes: '#F3F5FA',
      acc: 'phone', eye: '#26272B', coat: '#3F5F8A', scarf: '#F6EEDC' }],
    ['chefito', 'Chefito', 'Business Development Director', {
      skin: '#D9A67E', hair: '#2A1E18', style: 'slick', beard: ['full', '#3A2418'], glasses: ['sun', '#C8402A'],
      hat: 'chef', broad: 1, tat: 'armL', top: { kind: 'tee', col: '#2E2F33', logo: 1 },
      bottom: { kind: 'pants', col: '#26272B' }, shoes: '#F3F5FA', eye: '#26272B', coat: '#414347', scarf: '#C8402A' }],
    ['halodinho', 'Halodinho', 'Operations Director', {
      skin: '#C99068', hair: '#6E6A66', style: 'bald', beard: ['full', '#6E6A66'],
      top: { kind: 'shirt', col: '#2E2F33', open: 1, logo: 1 }, bottom: { kind: 'pants', col: '#26272B', belt: '#5E3B26' },
      shoes: '#5E3B26', acc: 'stopwatch', eye: '#26272B', coat: '#5D6B3C', scarf: '#F0B429' }],
    ['tony', 'Tony (Gangaa)', 'Infrastructure Director', {
      skin: '#C99C74', hair: '#17120F', style: 'short', beard: ['full', '#1F1713', 'mus'], broad: 1,
      top: { kind: 'tee', col: '#2E2F33', logo: 1 }, bottom: { kind: 'pants', col: '#E8E0D0' }, shoes: '#B9A07E',
      acc: 'server', eye: '#26272B', coat: '#414347', scarf: '#EA5E14' }],
    ['kazim', 'Kazim', 'Mastermind', {
      skin: '#E8B896', hair: '#1F1A17', style: 'short', beard: ['stubble', '#2A2018'],
      top: { kind: 'tee', col: '#E4572E', col2: '#F3F5FA', logo: 1, white: 1 },
      bottom: { kind: 'pants', col: '#26272B', belt: '#414347' }, shoes: '#F3F5FA', acc: 'mug', eye: '#4B4A2A', coat: '#C94A1E', scarf: '#F6EEDC' }],
    ['gurkan', 'Gürkan', 'Mastermind', {
      skin: '#C99C74', hair: '#17120F', style: 'side', beard: ['full', '#1F1713'], broad: 1, neckphones: 1,
      top: { kind: 'jacket', col: '#1F8A70', col2: '#F6EEDC' }, bottom: { kind: 'pants', col: '#3A4252', belt: '#26272B' },
      shoes: '#F3F5FA', eye: '#26272B', coat: '#1F8A70', scarf: '#F6EEDC' }],
    ['player', 'Visitor', 'K13 intern, visiting', {
      skin: '#E3B08A', hair: '#6B4226', style: 'short', cowlick: 1, top: { kind: 'hoodie', col: '#EA5E14' },
      bottom: { kind: 'pants', col: '#3F5F8A' }, shoes: '#F3F5FA', badge: 'pass', eye: '#3A2418', coat: '#3F5F8A', scarf: '#F6EEDC' }]
  ];

  /* fill in every derived colour a look needs (roster and creator share this) */
  function finish(L) {
    L.eye = L.eye || DARK;
    L.hairSh = shade(L.hair, 0.72);
    L.hairHi = hiOf(L.hair);
    L.buzz = mix(L.skin, L.hair, 0.6);
    L.skinSh = shade(L.skin, 0.84);
    L.skinDk = shade(L.skin, 0.7);
    L.skinHi = shade(L.skin, 1.12);
    L.mouth = mix(L.skin, '#9A3F35', 0.55);
    L.lip = mix(L.skin, '#B8483C', 0.5);
    L.blush = mix(L.skin, '#E0705F', 0.35);
    L.brow = mix(L.hair, L.skin, L.style === 'bald' ? 0.45 : 0.12);
    L.tall = (L.style === 'long' || L.style === 'wavy' || L.style === 'curlylong' || L.style === 'braids');
    L.top.col2 = L.top.col2 || shade(L.top.col, lum(L.top.col) > 0.5 ? 0.86 : 1.5);
    return L;
  }

  var LOOK = {};
  var list = [];
  var byId = {};
  (function () {
    var i, d, o, L;
    for (i = 0; i < DATA.length; i++) {
      d = DATA[i]; L = d[3];
      L.vest = L.vest || pick(['#B94612', '#C99A3A', '#5D6B3C', '#8A4B2A', '#2F6F65', '#414347'], d[0]);
      L.jack = L.jack || (lum(L.top.col) > 0.55 ? pick(['#4C6D96', '#7A5A3C', '#4F6B4A'], d[0]) : pick(['#6B6E75', '#4C6D96', '#7A5A3C'], d[0]));
      if (d[0] === 'gurkan') { L.jack = '#1F8A70'; L.vest = '#2F6F65'; }
      if (d[0] === 'kazim') { L.jack = '#3A3B40'; L.vest = '#F3F5FA'; }
      LOOK[d[0]] = finish(L);
      o = { id: d[0], name: d[1], role: d[2],
        colors: { skin: L.skin, hair: L.hair, top: L.top.col, bottom: L.bottom.col, shoes: L.shoes } };
      list.push(o); byId[d[0]] = o;
    }
  })();

  /* ---------- the visitor's character creator ---------- */
  var SKINS = [
    ['porcelain', 'Porcelain', '#F6D9C4'], ['fair', 'Fair', '#F0C8A8'], ['light', 'Light', '#E8B896'], ['sand', 'Sand', '#DDA77A'],
    ['golden', 'Golden', '#D49A6A'], ['tan', 'Tan', '#C98F67'], ['caramel', 'Caramel', '#B87A52'], ['brown', 'Brown', '#9A6440'],
    ['deep', 'Deep', '#774A30'], ['ebony', 'Ebony', '#5A3624']
  ];
  var HAIRS = [
    ['black', 'Black', '#17120F'], ['darkbrown', 'Dark brown', '#2B1D15'], ['brown', 'Brown', '#4A2C1A'], ['chestnut', 'Chestnut', '#6B4226'],
    ['auburn', 'Auburn', '#8A3F22'], ['ginger', 'Ginger', '#C8602A'], ['honey', 'Honey blonde', '#D9A441'], ['blonde', 'Blonde', '#E6C488'],
    ['grey', 'Grey', '#8E8E92'], ['white', 'Silver', '#E3E3E6'], ['orange', 'K13 orange', '#EA5E14'], ['blue', 'Blueprint blue', '#3B6EA8'],
    ['jade', 'Jade', '#2F9E8A']
  ];
  var STYLES = [
    ['short', 'Short'], ['side', 'Side part'], ['quiff', 'Quiff'], ['buzz', 'Buzz cut'], ['curly', 'Curly'], ['afro', 'Afro'],
    ['long', 'Long'], ['wavy', 'Wavy'], ['curlylong', 'Long curls'], ['braids', 'Braids'], ['ponytail', 'Ponytail'], ['bun', 'Bun'],
    ['hijab', 'Hijab'], ['slick', 'Slicked back'], ['bald', 'Bald']
  ];
  var TOPS = [['hoodie', 'Hoodie'], ['tee', 'T-shirt'], ['shirt', 'Shirt'], ['blazer', 'Blazer'], ['jacket', 'Jacket'], ['dress', 'Dress']];
  var TOPCOLS = [
    ['orange', 'K13 orange', '#EA5E14'], ['kazim', 'Signal orange', '#E4572E'], ['gold', 'Gold', '#F0B429'], ['cream', 'Cream', '#F6EEDC'],
    ['paper', 'White', '#F3F5FA'], ['graphite', 'Graphite', '#2E2F33'], ['slate', 'Slate', '#5D6B7A'], ['denim', 'Denim', '#3F5F8A'],
    ['sky', 'Sky', '#7FB0D6'], ['jade', 'Jade', '#1F8A70'], ['deepjade', 'Deep jade', '#2F6F65'], ['olive', 'Olive', '#6B7A3A'],
    ['brick', 'Brick', '#B8442E']
  ];
  var BOTTOMS = [['jeans', 'Jeans'], ['joggers', 'Joggers'], ['shorts', 'Shorts'], ['skirt', 'Skirt']];
  var BOTCOLS = [
    ['denim', 'Denim', '#3F5F8A'], ['graphite', 'Graphite', '#26272B'], ['steel', 'Steel', '#414347'], ['khaki', 'Khaki', '#D8C4A6'],
    ['cream', 'Cream', '#E8E0D0'], ['olive', 'Olive', '#5D6B3C'], ['brick', 'Brick', '#8A4B2A'], ['deepjade', 'Deep jade', '#2F6F65'],
    ['orange', 'K13 orange', '#EA5E14']
  ];
  var ACCS = [['none', 'None'], ['glasses', 'Glasses'], ['cap', 'Cap'], ['headphones', 'Headphones'], ['beanie', 'Beanie'], ['earrings', 'Earrings']];

  function swatch(a) { var i, o = []; for (i = 0; i < a.length; i++) { o.push({ id: a[i][0], label: a[i][1], color: a[i][2] }); } return o; }
  function plain(a) { var i, o = []; for (i = 0; i < a.length; i++) { o.push({ id: a[i][0], label: a[i][1] }); } return o; }
  var parts = {
    skin: swatch(SKINS), hairStyle: plain(STYLES), hairColor: swatch(HAIRS), top: plain(TOPS), topColor: swatch(TOPCOLS),
    bottom: plain(BOTTOMS), bottomColor: swatch(BOTCOLS), accessory: plain(ACCS)
  };
  var defaultLook = { skin: 'light', hairStyle: 'short', hairColor: 'chestnut', top: 'hoodie', topColor: 'orange', bottom: 'jeans', bottomColor: 'denim', accessory: 'none' };

  function find(a, id, dflt) { var i; for (i = 0; i < a.length; i++) { if (a[i][0] === id) { return a[i]; } } return dflt || a[0]; }
  function lookKey(k) {
    k = k || defaultLook;
    return [k.skin, k.hairStyle, k.hairColor, k.top, k.topColor, k.bottom, k.bottomColor, k.accessory].join('/');
  }

  var lookCache = {}, lookCount = 0;
  function fromLook(k) {
    var key = lookKey(k), L, sk, hc, tc, bc, tp, st, bt, acc, col;
    if (lookCache[key]) { return lookCache[key]; }
    k = k || defaultLook;
    sk = find(SKINS, k.skin, SKINS[2]); hc = find(HAIRS, k.hairColor, HAIRS[3]); tc = find(TOPCOLS, k.topColor, TOPCOLS[0]); bc = find(BOTCOLS, k.bottomColor, BOTCOLS[0]);
    tp = find(TOPS, k.top, TOPS[0])[0]; st = find(STYLES, k.hairStyle, STYLES[0])[0]; bt = find(BOTTOMS, k.bottom, BOTTOMS[0])[0]; acc = k.accessory || 'none';
    L = { skin: sk[2], hair: hc[2], style: st === 'curly' ? 'curlyshort' : st, cowlick: (st === 'short' && hash(key) % 3 === 0) ? 1 : 0,
      top: { kind: tp, col: tc[2], logo: 0 }, bottom: { kind: bt === 'skirt' ? 'skirt' : 'pants', col: bc[2] },
      shoes: lum(bc[2]) < 0.3 ? '#F3F5FA' : '#26272B', item: null };
    if (st === 'hijab') { L.hair = tc[2]; L.style = 'hijab'; if (acc === 'cap' || acc === 'beanie' || acc === 'headphones') { acc = 'none'; } }
    if (st === 'braids') { L.tie = '#EA5E14'; }
    if (bt === 'shorts') { L.bottom.kind = 'shorts'; L.bottomFixed = 1; }
    if (bt === 'joggers') { L.bottom.cuff = 1; }
    if (tp === 'dress') { L.bottom = { kind: 'skirt', col: tc[2] }; }
    if (tp === 'shirt') { L.top.open = 0; }
    if (tp === 'jacket') { L.top.col2 = lum(tc[2]) > 0.55 ? '#2E2F33' : '#F6EEDC'; }
    if (tp === 'blazer') { L.top.col2 = '#F3F5FA'; }
    col = tc[2];
    if (acc === 'glasses') { L.glasses = [hash(key) % 2 ? 'round' : 'rect', '#26272B']; }
    if (acc === 'cap') { L.hat = 'cap'; L.hatCol = lum(col) > 0.6 ? '#2E2F33' : col; }
    if (acc === 'beanie') { L.hat = 'beanie'; L.hatCol = lum(col) > 0.6 ? '#EA5E14' : col; }
    if (acc === 'headphones') { L.headphones = 1; }
    if (acc === 'earrings') { L.earrings = '#F0B429'; }
    L.eye = lum(sk[2]) < 0.45 ? '#2B1D15' : pick(['#3A2418', '#4B4A2A', '#4A8DB5', '#6B7F5A', '#26272B'], key);
    L.vest = pick(['#B94612', '#C99A3A', '#5D6B3C', '#8A4B2A', '#2F6F65'], key);
    L.jack = lum(col) > 0.55 ? pick(['#4C6D96', '#7A5A3C', '#4F6B4A'], key) : pick(['#6B6E75', '#4C6D96', '#7A5A3C'], key);
    L.coat = pick(['#8A6A4A', '#3F5F8A', '#5D6B3C', '#B94612', '#414347', '#2F6F65'], key);
    L.scarf = pick(['#EA5E14', '#F6EEDC', '#F0B429', '#4F9E92'], key);
    finish(L);
    if (st === 'hijab') { L.hairHi = shade(L.hair, 1.15); }
    if (lookCount > 80) { lookCache = {}; lookCount = 0; sheetsLook = {}; portsLook = {}; }
    lookCache[key] = L; lookCount++;
    return L;
  }
  var sheetsLook = {}, portsLook = {};

  function randomLook(seed) {
    var s = (typeof seed === 'number' ? seed : hash(seed === undefined ? Math.random() : seed)), r;
    function next(n) { s = (s * 1103515245 + 12345) % 2147483648; return Math.floor((s / 2147483648) * n); }
    next(7);
    function one(a) { return a[next(a.length)].id; }
    r = { skin: one(parts.skin), hairStyle: one(parts.hairStyle), hairColor: one(parts.hairColor), top: one(parts.top), topColor: one(parts.topColor),
      bottom: one(parts.bottom), bottomColor: one(parts.bottomColor), accessory: one(parts.accessory) };
    if (r.top === 'dress') { r.bottom = 'skirt'; }
    return r;
  }

  /* ---------- outfits: the season and the hour decide the variant ---------- */
  var ctxState = null;
  function seasonNow() { var m = new Date().getMonth(); return (m === 11 || m < 2) ? 'winter' : (m < 5 ? 'spring' : (m < 8 ? 'summer' : 'autumn')); }
  function setContext(c) {
    c = c || {};
    ctxState = { season: c.season || (ctxState && ctxState.season) || seasonNow(), hour: (typeof c.hour === 'number') ? c.hour : (ctxState ? ctxState.hour : new Date().getHours()) };
  }
  function variantFor(c) {
    var s, h, night, evening;
    c = c || ctxState; if (!c) { setContext(); c = ctxState; }
    s = c.season; h = c.hour;
    night = (h >= 21 || h < 6); evening = (h >= 18 || h < 7);
    if (s === 'winter') { return 'coat'; }
    if (s === 'autumn') { return night ? 'coat' : (evening ? 'jacket' : 'layer'); }
    if (s === 'summer') { return evening ? 'jacket' : 'summer'; }
    return evening ? 'jacket' : 'base';
  }
  var varCache = {};
  function variantLook(L, key, ck) {
    var V, t, k, vk = ck + '|' + key;
    if (key === 'base') { return L; }
    if (varCache[vk]) { return varCache[vk]; }
    V = {}; for (k in L) { if (L.hasOwnProperty(k)) { V[k] = L[k]; } }
    t = {}; for (k in L.top) { if (L.top.hasOwnProperty(k)) { t[k] = L.top[k]; } } V.top = t;
    V.bottom = {}; for (k in L.bottom) { if (L.bottom.hasOwnProperty(k)) { V.bottom[k] = L.bottom[k]; } }
    k = L.top.kind;
    if (key === 'summer') {
      if (k === 'hoodie' || k === 'jacket' || k === 'blazer') { t.kind = 'tee'; t.col2 = shade(t.col, lum(t.col) > 0.5 ? 0.86 : 1.4); }
      if (k === 'shirt') { t.short = 1; }
      if (L.bottom.kind === 'pants' && !L.bottomFixed) { V.bottom.kind = 'shorts'; }
      V.hat = (L.hat === 'beanie') ? null : L.hat;
    } else if (key === 'layer') {
      if (k !== 'dress' && k !== 'jacket' && k !== 'blazer') { t.vest = L.vest; }
      if (k === 'dress') { t.vest = L.vest; }
    } else if (key === 'jacket') {
      if (k === 'shirt' || k === 'tee' || k === 'dress' || k === 'hoodie') {
        t.under = t.col; t.under2 = t.col2; t.kind = 'jacket'; t.col = L.jack; t.col2 = (k === 'dress') ? t.under : t.under;
        t.logo = 0; t.under3 = k;
      }
    } else if (key === 'coat') {
      t.under = t.col; t.under3 = k; t.kind = 'coat'; t.col = L.coat; t.col2 = shade(L.coat, 1.25); t.logo = 0;
      V.scarfOn = 1;
    }
    varCache[vk] = V;
    return V;
  }
  function outfit(id, c) {
    var key = variantFor(c || ctxState), L = LOOK[id];
    return { id: id, variant: key, season: (c || ctxState || { season: seasonNow() }).season, top: L ? variantLook(L, key, id).top.kind : null };
  }

  /* ---------- tiny canvas toolkit (integer pixels) ---------- */
  function mk(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return { c: c, g: g, w: w, h: h };
  }
  function R(o, x, y, w, h, col) {
    if (!col || w <= 0 || h <= 0) { return; }
    o.g.fillStyle = col;
    o.g.fillRect(x, y, w, h);
  }
  function PX(o, x, y, col) { if (col) { o.g.fillStyle = col; o.g.fillRect(x, y, 1, 1); } }
  function CL(o, x, y, w, h) { o.g.clearRect(x, y, w, h); }
  /* ascii rows: 8 chars = left half mirrored to 16, otherwise drawn as written */
  function MAPS(o, rows, y0, pal, x0) {
    var j, i, ch, s, col, n;
    for (j = 0; j < rows.length; j++) {
      s = rows[j];
      for (i = 0; i < s.length; i++) {
        ch = s.charAt(i); col = pal[ch];
        if (ch === '.' || !col) { continue; }
        if (s.length === 8 && !x0) { PX(o, i, y0 + j, col); PX(o, 15 - i, y0 + j, col); } else { PX(o, (x0 || 0) + i, y0 + j, col); }
      }
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
  function hp(L) { return { h: L.hair, H: L.hairHi, d: L.hairSh, b: L.buzz, S: L.skinHi, r: L.roots || L.hair, o: L.tie || '#EA5E14', k: shade(L.hair, 0.55) }; }

  /* ---------- held and worn items (signature things) ---------- */
  var ITEMS = {
    notebook: { rows: ['kkok', 'kkok', 'kkok', 'kkok', 'kkok', 'pppp'], pal: { k: '#414347', o: PAL.orange, p: PAL.cream } },
    clipboard: { rows: ['.ss.', 'bwwb', 'bgwb', 'bwgb', 'bgwb', 'bwwb', 'bbbb'], pal: { b: PAL.wood, w: PAL.paper, s: '#9EA2AA', g: PAL.slate } },
    laptop: { rows: ['kkkkk', 'koGGk', 'kGoGk', 'kkkkk', 'bbbbb'], pal: { k: '#26272B', o: PAL.orange, G: PAL.jade, b: '#9EA2AA' } },
    feather: { rows: ['..jj', '.jJj', '.jJ.', 'jJj.', 'jJ..', 'jq..', 'q...'], pal: { j: PAL.jade, J: PAL.deepJade, q: PAL.graphite } },
    magnifier: { rows: ['.ss.', 'sgws', 'sggs', '.ss.', '..hh', '...h'], pal: { s: '#9EA2AA', g: '#BFE3EA', w: '#FFFFFF', h: PAL.wood } },
    rocket: { rows: ['.o.', 'oWo', '.w.', 'wjw', '.w.', 'dwd', 'yoy', '.y.'], pal: { o: PAL.orange, W: '#FFFFFF', w: '#F3F5FA', j: PAL.jade, d: PAL.deepJade, y: PAL.gold } },
    swatches: { rows: ['...c', '..gc', '.ogj', 'ogjk', 'ogjk', 'kk..'], pal: { c: PAL.cream, g: PAL.gold, o: PAL.orange, j: PAL.jade, k: PAL.graphite } },
    megaphone: { rows: ['..ow', '.oow', 'ooww', '.oow', '..ow', '.k..'], pal: { o: PAL.orange, w: PAL.cream, k: PAL.graphite } },
    pad: { rows: ['cccg', 'clcg', 'cccg', 'clcg', 'cccg', 'clcg'], pal: { c: PAL.cream, l: PAL.slate, g: PAL.gold } },
    books: { rows: ['jjjj', 'pppp', 'oooo', 'pppp', 'kkkk', 'pppp'], pal: { j: PAL.jade, p: PAL.cream, o: PAL.orange, k: PAL.steel } },
    blueprint: { rows: ['cccc', 'bbbb', 'bwbw', 'bbbb', 'bwbw', 'bbbb', 'cccc'], pal: { c: PAL.cream, b: PAL.blueprint, w: '#CFE0F2' } },
    brush: { rows: ['g.o', 'go.', '.os', '..s', '..b', '..b', '..b'], pal: { g: PAL.gold, o: PAL.orange, s: '#9EA2AA', b: PAL.wood } },
    clapper: { rows: ['kwkw', 'kkkk', 'kwwk', 'kkkk', 'kwkk', 'kkkk'], pal: { k: '#26272B', w: '#F3F5FA' } },
    wrench: { rows: ['s.s', 'sss', '.s.', '.s.', '.s.', '.o.', '.o.'], pal: { s: '#9EA2AA', o: PAL.deepOrange } },
    phone: { rows: ['kkk', 'kjk', 'kjk', 'kjk', 'kok', 'kkk'], pal: { k: '#26272B', j: PAL.jade, o: PAL.orange } },
    stopwatch: { rows: ['..y.', '.yy.', 'ycky', 'yccy', 'yccy', '.yy.'], pal: { y: PAL.gold, c: PAL.cream, k: '#26272B' } },
    server: { rows: ['kkkk', 'kjsk', 'kkkk', 'kjsk', 'kkkk', 'kjsk'], pal: { k: '#26272B', j: '#6FE3C0', s: '#9EA2AA' } },
    mug: { rows: ['.s.', 'kkk.', 'kook', 'kkk.', 'kkk.'], pal: { k: '#E8E0D0', o: PAL.orange, s: '#CFCFCF' } }
  };

  /* ---------- poses: walk 0..7, idle 8 (A), 9 (B, exhale), 10/11 = the same with a blink ---------- */
  var LIFT_L = [0, 1, 2, 1, 0, 0, 0, 0], LIFT_R = [0, 0, 0, 0, 0, 1, 2, 1];
  var BOB = [-1, 0, 0, 0, -1, 0, 0, 0], ARM = [0, 1, 1, 0, 0, -1, -1, 0];
  var SPREAD = [0, 2, 3, 2, 0, -2, -3, -2], SL_N = [0, 1, 1, 0, 0, 0, 0, 0], SL_F = [0, 0, 0, 0, 0, 1, 1, 0];
  function pose(dir, c) {
    var P = { uo: 0, lL: 0, lR: 0, aL: 0, aR: 0, s: 0, ln: 0, lf: 0, sx: 0, blink: false };
    if (c >= 8) { P.uo = (c === 9 || c === 11) ? 1 : 0; P.blink = (c >= 10); return P; }
    P.uo = BOB[c];
    if (dir === 'down' || dir === 'up') { P.lL = LIFT_L[c]; P.lR = LIFT_R[c]; P.aL = ARM[c]; P.aR = -ARM[c]; }
    else { P.s = SPREAD[c]; P.ln = SL_N[c]; P.lf = SL_F[c]; P.sx = -Math.round(SPREAD[c] * 0.66); }
    return P;
  }

  /* ---------- clothes ---------- */
  function bnd(L) { return L.broad ? { x0: 3, x1: 12 } : { x0: 4, x1: 11 }; }
  function sleeveKind(L) {
    var t = L.top;
    if (t.kind === 'dress') { return 'none'; }
    if (t.kind === 'tee' || t.short) { return 'short'; }
    return 'long';
  }

  function legsFront(o, L, P) {
    var b = L.bottom, bc = b.col, B = bnd(L), x0, k, lift, col, sh, kind = b.kind, so, soleC, topC, w, y0;
    soleC = shade(L.shoes, 0.6); topC = shade(L.shoes, 1.18);
    if (L.top.kind === 'coat') { kind = (kind === 'skirt') ? 'skirt' : 'pants'; }
    for (k = 0; k < 2; k++) {
      lift = k === 0 ? P.lL : P.lR; x0 = k === 0 ? 4 : 8; col = k === 0 ? bc : shade(bc, 0.9);
      if (kind === 'skirt') {
        R(o, x0 + 1, 27 - lift, 2, 2 + lift, k === 0 ? L.skin : L.skinSh);
        R(o, x0 + 1, 28, 2, 1, L.skinSh);
      } else if (kind === 'shorts') {
        R(o, x0, 23, 4, 3 - lift, col);
        R(o, x0, 25 - lift, 4, 1, shade(col, 0.8));
        R(o, x0 + 1, 26 - lift, 2, 3 + lift, k === 0 ? L.skin : L.skinSh);
        PX(o, x0 + 1, 28, '#F3F5FA'); PX(o, x0 + 2, 28, '#F3F5FA');
      } else {
        R(o, x0, 23, 4, 6 - lift, col);
        if (k === 0) { R(o, 7, 24, 1, 5 - lift, shade(bc, 0.8)); } else { R(o, 8, 24, 1, 5 - lift, shade(bc, 0.8)); }
        R(o, x0 + 1, 25 - lift, 2, 1, shade(col, 0.88));
        if (b.cuff) { R(o, x0, 28 - lift, 4, 1, shade(col, 0.72)); }
      }
      R(o, x0, 29 - lift, 4, 1, topC); R(o, x0, 30 - lift, 4, 1, L.shoes);
      R(o, x0, 30 - lift, 4, 1, soleC);
      PX(o, k === 0 ? x0 : x0 + 3, 29 - lift, L.shoes);
    }
    if (kind === 'skirt' || L.top.kind === 'dress') { /* skirt body drawn with the torso */ }
    if (kind === 'skirt') {
      w = 10; y0 = 23;
      R(o, 4, y0, 8, 1, bc); R(o, 3, y0 + 1, w, 2, bc); R(o, 3, y0 + 3, w, 2, bc);
      R(o, 3, y0 + 4, w, 1, shade(bc, 0.84)); R(o, 12, y0 + 1, 1, 4, shade(bc, 0.86)); R(o, 6, y0 + 1, 1, 3, shade(bc, 0.92));
      R(o, 9, y0 + 2, 1, 3, shade(bc, 0.92));
      R(o, 3, y0 + 4, 1, 1, shade(bc, 1.12));
      if (b.belt && b.belt !== bc) { R(o, 4, 22, 8, 1, b.belt); }
    } else if (b.belt) {
      R(o, 4, 22, 8, 1, b.belt); R(o, 7, 22, 2, 1, '#C9CDD2'); PX(o, 8, 22, '#9EA2AA');
      R(o, 4, 23, 8, 1, shade(bc, 0.92));
    } else { R(o, 4, 22, 8, 1, shade(bc, 0.92)); R(o, 4, 23, 8, 1, shade(bc, 0.92)); }
  }

  function torsoFront(o, L, P, back) {
    var t = L.top, c = t.col, B = bnd(L), x0 = B.x0, x1 = B.x1, w = x1 - x0 + 1, T = 14 + P.uo, k = t.kind, c2 = t.col2, sh = shade(c, 0.84), dk = shade(c, 0.7), hi = shade(c, 1.15), cx, j, under = t.under;
    R(o, x0, T, w, 23 - T, c);
    R(o, x1, T, 1, 23 - T, sh); R(o, x0, T, 1, 23 - T, shade(c, 1.06));
    /* soft folds */
    R(o, 6, T + 3, 1, 2, shade(c, 0.9)); R(o, 9, T + 4, 1, 3, shade(c, 0.9)); R(o, x0 + 1, 22, w - 2, 1, shade(c, 0.88));
    if (back) {
      R(o, 6, T, 4, 1, shade(c, 0.86));
      if (k === 'hoodie') { R(o, x0, T, w, 2, shade(c, 0.8)); R(o, 6, T + 2, 4, 2, shade(c, 0.9)); R(o, 7, T + 3, 2, 1, shade(c, 0.78)); }
      if (k === 'blazer' || k === 'jacket') { R(o, 7, T + 1, 2, 8, shade(c, 0.78)); R(o, x0, T, w, 1, shade(c, 0.78)); }
      if (k === 'coat') { R(o, 7, T + 1, 2, 8, shade(c, 0.78)); R(o, 4, T + 9, 8, 1, shade(c, 0.85)); }
      if (t.vest && k !== 'coat') { R(o, x0, T, w, 9, t.vest); R(o, 7, T + 1, 2, 8, shade(t.vest, 0.82)); }
      if (t.logo && (k === 'shirt' || k === 'tee')) { R(o, 6, T + 3, 4, 2, shade(c, 0.9)); PX(o, 7, T + 3, PAL.orange); PX(o, 8, T + 3, PAL.paper); }
      return;
    }
    cx = 7;
    if (k === 'shirt') {
      R(o, cx, T, 2, t.open ? 3 : 2, L.skin); R(o, cx, T, 2, 1, L.skinSh);
      R(o, 5, T, 2, 1, c2); R(o, 9, T, 2, 1, c2); R(o, 6, T + 1, 1, 1, c2); R(o, 9, T + 1, 1, 1, c2);
      if (t.open) { PX(o, 6, T + 2, c2); PX(o, 9, T + 2, c2); }
      for (j = T + 3; j < 22; j += 2) { PX(o, 8, j, shade(c, 0.74)); }
      R(o, 7, T + 2, 1, 7, hi); if (!t.open) { R(o, 7, T + 2, 2, 1, shade(c, 0.8)); }
    } else if (k === 'tee') {
      R(o, 6, T, 4, 1, L.skinSh); R(o, 7, T + 1, 2, 1, L.skinSh); PX(o, 6, T + 1, c2); PX(o, 9, T + 1, c2); R(o, 5, T, 1, 1, c2); R(o, 10, T, 1, 1, c2);
      R(o, 7, T, 2, 1, L.skin);
    } else if (k === 'hoodie') {
      R(o, x0, T, w, 1, shade(c, 0.76)); R(o, 5, T, 6, 2, shade(c, 0.86)); R(o, 7, T, 2, 2, L.skinSh); R(o, 7, T, 2, 1, L.skin);
      R(o, 6, T + 2, 1, 3, PAL.cream); R(o, 9, T + 2, 1, 3, PAL.cream); PX(o, 6, T + 5, shade(PAL.cream, 0.8)); PX(o, 9, T + 5, shade(PAL.cream, 0.8));
      R(o, 5, 19 + P.uo, 6, 3, shade(c, 0.88)); R(o, 5, 19 + P.uo, 6, 1, shade(c, 0.76)); PX(o, 8, 20 + P.uo, shade(c, 0.76));
      R(o, 4, 22, 8, 1, shade(c, 0.74));
    } else if (k === 'jacket') {
      R(o, 7, T, 2, 23 - T, under || c2); R(o, 7, T, 2, 1, L.skinSh);
      R(o, 6, T, 1, 23 - T, shade(c, 0.74)); R(o, 9, T, 1, 23 - T, shade(c, 0.74));
      R(o, 5, T, 2, 2, hi); R(o, 9, T, 2, 2, hi); R(o, 5, T + 1, 1, 1, c); R(o, 10, T + 1, 1, 1, c);
      R(o, 4, 21, 8, 2, shade(c, 0.8)); R(o, 5, T + 5, 1, 2, shade(c, 0.76)); R(o, 10, T + 5, 1, 2, shade(c, 0.76));
      PX(o, 7, T + 2, '#C9CDD2'); PX(o, 7, T + 4, '#C9CDD2');
    } else if (k === 'blazer') {
      R(o, 6, T, 4, 1, PAL.paper); R(o, 7, T + 1, 2, 3, PAL.paper); R(o, 7, T, 2, 1, L.skinSh);
      R(o, 5, T, 1, 3, shade(c, 1.55)); R(o, 10, T, 1, 3, shade(c, 1.55)); R(o, 6, T + 1, 1, 3, shade(c, 1.3)); R(o, 9, T + 1, 1, 3, shade(c, 1.3));
      R(o, 7, T + 4, 2, 5, shade(c, 0.78)); PX(o, 8, T + 5, '#9EA2AA'); R(o, 5, T + 6, 2, 1, shade(c, 0.7)); R(o, 4, 21, 8, 2, shade(c, 0.8));
    } else if (k === 'dress') {
      R(o, 6, T, 4, 1, L.skinSh); R(o, 7, T + 1, 2, 1, L.skinSh); R(o, 5, T, 1, 1, c); R(o, 10, T, 1, 1, c);
      R(o, x0, T + 4, w, 1, shade(c, 0.78)); R(o, x0, T + 5, w, 1, shade(c, 1.1));
      PX(o, 8, T + 4, PAL.gold);
    } else if (k === 'coat') {
      R(o, 7, T, 2, 23 - T, under || c2); R(o, 7, T, 2, 2, L.skinSh);
      R(o, 7, T + 2, 2, 1, shade(c, 0.7));
      R(o, 4, T, 3, 8, c); R(o, 9, T, 3, 8, shade(c, 0.9)); R(o, 6, T, 1, 8, shade(c, 0.7)); R(o, 9, T, 1, 8, shade(c, 0.7));
      R(o, 4, T, 2, 2, hi); R(o, 10, T, 2, 2, hi);
      for (j = T + 3; j < 23; j += 3) { PX(o, 5, j, PAL.gold); PX(o, 10, j, PAL.gold); }
    }
    if (t.vest && k !== 'coat') {
      R(o, x0, T, 2, 23 - T, t.vest); R(o, x1 - 1, T, 2, 23 - T, shade(t.vest, 0.86));
      R(o, x0 + 1, T, 1, 3, shade(t.vest, 1.2)); R(o, x1 - 1, T, 1, 3, shade(t.vest, 1.1)); R(o, x0, 21, w, 2, shade(t.vest, 0.88));
      PX(o, x0 + 1, T + 4, shade(t.vest, 0.7)); PX(o, x1 - 1, T + 4, shade(t.vest, 0.7));
    }
    if (t.logo && (k === 'shirt' || k === 'tee') && !t.vest) {
      R(o, 9, T + 3, 2, 2, t.white ? PAL.paper : PAL.paper); PX(o, 10, T + 3, PAL.orange); PX(o, 9, T + 4, PAL.orange);
    }
    if (k === 'coat') { /* the coat's lower skirt is drawn by coatSkirt() */ }
  }

  function coatSkirt(o, L, P) {
    var t = L.top, c = t.col, T = 14 + P.uo;
    if (t.kind !== 'coat') { return; }
    R(o, 3, 23, 10, 5, c); R(o, 12, 23, 1, 5, shade(c, 0.84)); R(o, 3, 27, 10, 1, shade(c, 0.78));
    R(o, 7, 23, 2, 5, shade(t.col2 || c, 0.9)); R(o, 7, 23, 1, 5, shade(c, 0.7));
    R(o, 6, 24, 1, 3, shade(c, 0.9)); R(o, 10, 24, 1, 3, shade(c, 0.9)); R(o, 3, 23, 1, 4, shade(c, 1.08));
    PX(o, 5, 24, PAL.gold); PX(o, 10, 24, PAL.gold); PX(o, 5, 26, PAL.gold); PX(o, 10, 26, PAL.gold);
  }

  function armsFront(o, L, P, back) {
    var t = L.top, c = t.col, B = bnd(L), T = 14 + P.uo, sk = sleeveKind(L), ax = [B.x0 - 1, B.x1 + 1], sw = [P.aL, P.aR], k, hy, se, sc, y, cuff;
    for (k = 0; k < 2; k++) {
      hy = T + 8 + sw[k]; sc = k === 0 ? shade(c, 1.04) : shade(c, 0.84);
      if (sk === 'none') { se = T; } else if (sk === 'short') { se = T + 3; } else { se = hy - 1; }
      if (t.kind === 'coat' && sk === 'long') { sc = k === 0 ? shade(c, 0.96) : shade(c, 0.8); }
      R(o, ax[k], T + 1, 1, hy - T - 1 + 2, k === 0 ? L.skin : L.skinSh);
      if (se >= T + 1) { R(o, ax[k], T + 1, 1, se - T, sc); }
      if (sk === 'long') {
        cuff = (t.kind === 'hoodie') ? shade(c, 0.74) : (t.kind === 'jacket' || t.kind === 'blazer' || t.kind === 'coat') ? shade(c, 0.72) : shade(c, 0.86);
        R(o, ax[k], hy - 1, 1, 1, cuff);
        if (t.kind === 'blazer') { PX(o, ax[k], hy - 2, PAL.paper); }
      }
      if (sk === 'short') { PX(o, ax[k], se, shade(c, 0.78)); }
      PX(o, ax[k], hy + 1, L.skinSh);
      if (t.vest && sk !== 'none' && t.kind !== 'dress') { /* the vest is sleeveless */ }
      if (L.tat && L.tat === 'armL' && k === 0) { for (y = Math.max(se + 1, T + 1); y <= hy; y++) { if ((y) % 2 === 0) { PX(o, ax[k], y, '#3A3A40'); } } }
      if (t.puff) { PX(o, ax[k], T, c); }
      if (t.kind === 'dress' && k >= 0) { PX(o, ax[k], T + 1, shade(c, 0.9)); }
    }
    if (P.blink && false) { return; }
  }

  function worn(o, L, P, dir) {
    var T = 14 + P.uo, B = bnd(L);
    if (L.badge === 'padlock' && dir === 'down') {
      BM(o, 9, T + 3, ['sss', 'ddd', 'ddd'], { s: '#9EA2AA', d: PAL.orange });
      PX(o, 9, T + 3, '#C9CDD2'); PX(o, 11, T + 3, '#C9CDD2'); PX(o, 10, T + 3, null); PX(o, 10, T + 4, PAL.paper);
    }
    if (L.badge === 'pass' && dir === 'down') {
      R(o, 6, T, 1, 3, PAL.cream); R(o, 9, T, 1, 3, PAL.cream);
      BM(o, 5, T + 3, ['cccc', 'cOOc', 'cccc'], { c: PAL.cream, O: PAL.orange });
    }
    if (L.neckphones) {
      if (dir === 'down') {
        R(o, B.x0, T, B.x1 - B.x0 + 1, 1, '#9EA2AA'); R(o, B.x0 + 1, T + 1, 2, 1, '#9EA2AA'); R(o, B.x1 - 2, T + 1, 2, 1, '#9EA2AA');
        R(o, B.x0 - 1, T, 2, 4, PAL.steel); R(o, B.x1, T, 2, 4, PAL.steel);
        PX(o, B.x0 - 1, T + 1, PAL.orange); PX(o, B.x1 + 1, T + 1, PAL.orange); R(o, B.x0, T + 3, 1, 1, '#2E2F33'); R(o, B.x1, T + 3, 1, 1, '#2E2F33');
      } else if (dir === 'up') {
        R(o, B.x0, T, B.x1 - B.x0 + 1, 1, '#9EA2AA'); R(o, B.x0 - 1, T, 2, 4, PAL.steel); R(o, B.x1, T, 2, 4, PAL.steel);
      }
    }
  }
  function BM(o, x, y, rows, pal, flip) {
    var j, i, ch, w = rows[0].length;
    for (j = 0; j < rows.length; j++) {
      for (i = 0; i < w; i++) {
        ch = rows[j].charAt(i);
        if (ch !== '.' && pal[ch]) { PX(o, x + (flip ? (w - 1 - i) : i), y + j, pal[ch]); }
      }
    }
  }
  function scarfFront(o, L, P, dir) {
    var T = 14 + P.uo, sc = L.scarf || PAL.orange;
    if (!L.scarfOn) { return; }
    if (dir === 'down') {
      R(o, 5, T, 6, 2, sc); R(o, 4, T, 1, 1, sc); R(o, 11, T, 1, 1, sc); R(o, 5, T + 1, 6, 1, shade(sc, 0.84));
      R(o, 9, T + 2, 2, 4, sc); R(o, 9, T + 3, 2, 1, shade(sc, 0.8)); R(o, 9, T + 5, 2, 1, shade(sc, 0.84)); PX(o, 6, T, shade(sc, 1.2));
    } else {
      R(o, 5, T, 6, 2, sc); R(o, 4, T, 1, 1, sc); R(o, 11, T, 1, 1, sc); R(o, 5, T + 1, 6, 1, shade(sc, 0.84));
    }
  }

  /* ---------- head: front ---------- */
  function skinFront(o, L, y) {
    R(o, 5, 3 + y, 6, 1, L.skin); R(o, 4, 4 + y, 8, 1, L.skin); R(o, 3, 5 + y, 10, 7, L.skin); R(o, 4, 12 + y, 8, 1, L.skin); R(o, 5, 13 + y, 6, 1, L.skin);
    R(o, 12, 6 + y, 1, 6, L.skinSh); R(o, 11, 12 + y, 1, 1, L.skinSh); R(o, 5, 13 + y, 6, 1, L.skinSh);
    R(o, 6, 13 + y, 4, 1, L.skin);
    R(o, 2, 8 + y, 1, 2, L.skin); R(o, 13, 8 + y, 1, 2, L.skinSh); PX(o, 2, 9 + y, L.skinSh);
    R(o, 6, 5 + y, 3, 1, L.skinHi);
  }

  var HF = {
    short:      ['........', '.....hhh', '....hHhh', '...hhhhh', '...hhhhh', '...hd.hh', '...h....'],
    side:       ['........', '.....hhh', '....hHhh', '...hhhhh', '...hhhhh', '...hd.hh', '...h....'],
    quiff:      ['......hh', '....hHHh', '...hhHhh', '...hhhhh', '...hhhhh', '...h....'],
    buzz:       ['........', '.....bbb', '....bbbb', '...bbbbb', '...bb.bb', '...b....'],
    bald:       ['........', '........', '......SS'],
    slick:      ['........', '.....hhh', '....hHHh', '...hhhhh', '...hd...', '...h....'],
    curlyshort: ['....h.hh', '...hhhhh', '..hHhhHh', '..hhhhhh', '..hhhhhh', '..hh..h.', '..h.....'],
    afro:       ['....hhhh', '..hhhhhh', '.hhHhhHh', '.hhhhhhh', '.hhhhhhh', '.hhh....', '.hhh....', '.hh.....', '.h......'],
    curlylong:  ['....h.hh', '...hhhhh', '..hHhhHh', '.hhhhhhh', '.hhhhhhh', '.hhh..hh', '.hhh....', '.hh.....'],
    long:       ['........', '.....hhh', '...hhHhh', '..hhhhhh', '..hhhhhh', '..hh..hh', '..hh....', '..hh....'],
    wavy:       ['........', '.....hhh', '...hhHhh', '..hhhhhh', '..hhhhhh', '..hh..hh', '..hhh...', '..hh....'],
    ponytail:   ['........', '.....hhh', '....hHhh', '...hhhhh', '...hhhhh', '...hd.hh', '...h....'],
    bun:        ['......hh', '.....hHh', '....hhhh', '...hhhhh', '...hhhhh', '...h....'],
    braids:     ['........', '.....hhh', '...hhHhh', '..hhhhhh', '..hhhhhh', '..hh.hhh', '..hh....', '..hh....'],
    hijab:      ['....hhhh', '..hHhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhh...', '..hh....', '..hh....', '..hh....', '..hhh...', '..hhhh..', '..hhhhh.', '..hhhhhh']
  };
  /* long hair seen from the front: strands that fall over the shoulders (drawn after the torso) */
  var FALL = {
    long:      { y: 8, rows: ['..hh....', '..hh....', '..hh....', '..hh....', '..hh....', '..hh....', '..hh....', '..hh....', '..hh....', '..dh....', '..dd....'] },
    wavy:      { y: 8, rows: ['..hh....', '..hhh...', '..hh....', '..hhh...', '..hh....', '..hhh...', '..hh....', '..hhh...', '..hh....', '..dd....'] },
    curlylong: { y: 8, rows: ['.hhh....', '.hh.....', '.hhh....', '.hhh....', '.hh.....', '.hhh....', '.hhh....', '.hh.....', '.hhh....', '.dd.....'] },
    braids:    { y: 13, rows: ['..hh....', '..Hh....', '..hh....', '..Hh....', '..hh....', '..Hh....', '..hh....', '..oo....'] },
    hijab:     { y: 14, rows: ['..dddddd', '..hHhhhh', '..hhhhhh', '...hhhhh', '....hhhh', '.....hhh'] }
  };
  /* behind the head and shoulders (drawn before the body) */
  var BACKH = {
    long:      { y: 3, rows: ['...hhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..dddddd'] },
    wavy:      { y: 3, rows: ['...hhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '.hhhhhhh', '.hhhhhhh', '.hhhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '.hhhhhhh', '.hhhhhhh', '.hhhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '.hhhhhhh', '..dddddd'] },
    curlylong: { y: 3, rows: ['..hhhhhh', '.hhhhhhh', '.hhhhhhh', '.hhhhhhh', '.hhhhhhh', '.hhhhhhh', '.hhhhhhh', '.hhhhhhh', '.hhhhhhh', '.hhhhhhh', '.hhhhhhh', '.hhhhhhh', '.hhhhhhh', '.hhhhhhh', '..hhhhhh', '.hhhhhhh', '..dddddd'] },
    braids:    { y: 3, rows: ['...hhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh'] },
    hijab:     { y: 3, rows: ['...hhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '...hhhhh', '....hhhh'] }
  };

  function hatFront(o, L, y) {
    var h = L.hat, c = L.hatCol, sh;
    if (h === 'chef') {
      R(o, 5, 1 + y, 6, 1, '#FFFFFF'); R(o, 4, 2 + y, 8, 1, '#FFFFFF'); R(o, 3, 3 + y, 10, 1, '#F3F5FA');
      R(o, 3, 4 + y, 10, 2, '#EEF0F4'); R(o, 3, 5 + y, 10, 1, '#DADDE3');
      R(o, 7, 1 + y, 2, 1, '#DADDE3'); PX(o, 4, 2 + y, '#DADDE3'); PX(o, 11, 2 + y, '#DADDE3'); PX(o, 12, 3 + y, '#DADDE3'); PX(o, 6, 3 + y, '#DADDE3'); PX(o, 9, 3 + y, '#DADDE3');
    } else if (h === 'cap') {
      sh = shade(c, 0.78);
      R(o, 5, 2 + y, 6, 1, c); R(o, 4, 3 + y, 8, 1, c); R(o, 3, 4 + y, 10, 2, c); R(o, 3, 5 + y, 10, 1, sh); R(o, 4, 6 + y, 8, 1, sh);
      R(o, 5, 3 + y, 3, 1, shade(c, 1.2)); PX(o, 8, 2 + y, shade(c, 0.7));
    } else if (h === 'beanie') {
      sh = shade(c, 0.8);
      R(o, 5, 1 + y, 6, 1, c); R(o, 4, 2 + y, 8, 1, c); R(o, 3, 3 + y, 10, 2, c); R(o, 3, 5 + y, 10, 1, sh);
      R(o, 7, 0 + y + 1, 2, 1, shade(c, 1.3)); PX(o, 5, 3 + y, shade(c, 1.2)); PX(o, 7, 3 + y, sh); PX(o, 9, 3 + y, sh); PX(o, 11, 4 + y, sh);
      PX(o, 4, 5 + y, shade(c, 0.7)); PX(o, 6, 5 + y, shade(c, 0.7)); PX(o, 8, 5 + y, shade(c, 0.7)); PX(o, 10, 5 + y, shade(c, 0.7));
    }
    if (L.headset || L.headphones) {
      var st = L.headphones ? '#2E2F33' : '#9EA2AA', cup = L.headphones ? PAL.orange : PAL.steel;
      R(o, 4, 1 + y + (L.hat ? 1 : 0), 8, 1, st); R(o, 3, 2 + y + (L.hat ? 1 : 0), 1, 3, st); R(o, 12, 2 + y + (L.hat ? 1 : 0), 1, 3, st);
      R(o, 2, 6 + y, 2, 4, cup); R(o, 12, 6 + y, 2, 4, cup); R(o, 2, 6 + y, 2, 1, shade(cup, 1.25)); R(o, 2, 9 + y, 2, 1, shade(cup, 0.7));
      if (L.headset) { R(o, 3, 10 + y, 1, 1, PAL.steel); R(o, 4, 11 + y, 3, 1, PAL.steel); R(o, 7, 11 + y, 1, 1, PAL.orange); }
    }
  }

  var PALE = '#E6F1F5';
  function glassesFront(o, L, y) {
    var g = L.glasses, gt, gc;
    if (!g) { return; }
    gt = g[0]; gc = g[1];
    if (gt === 'rect' || gt === 'tort') {
      var lensC = mix(L.skin, PALE, 0.6), lowC = mix(gc, L.skin, 0.35);
      R(o, 4, 8 + y, 4, 2, lensC); R(o, 8, 8 + y, 4, 2, lensC);
      R(o, 4, 7 + y, 8, 1, gc); R(o, 4, 10 + y, 4, 1, lowC); R(o, 8, 10 + y, 4, 1, lowC);
      PX(o, 3, 8 + y, gc); PX(o, 12, 8 + y, gc); PX(o, 7, 8 + y, mix(gc, L.skin, 0.5)); PX(o, 8, 8 + y, mix(gc, L.skin, 0.5));
      PX(o, 6, 8 + y, '#FFFFFF'); PX(o, 11, 8 + y, '#FFFFFF');
      if (!L._blinkNow) { PX(o, 5, 8 + y, DARK); PX(o, 5, 9 + y, (L.eye !== DARK && lum(L.eye) > 0.2) ? L.eye : DARK); PX(o, 10, 8 + y, DARK); PX(o, 10, 9 + y, (L.eye !== DARK && lum(L.eye) > 0.2) ? L.eye : DARK); } else { PX(o, 5, 9 + y, L.hairSh); PX(o, 10, 9 + y, L.hairSh); }
      if (gt === 'tort') { PX(o, 4, 7 + y, shade(gc, 1.5)); PX(o, 5, 7 + y, shade(gc, 1.3)); PX(o, 9, 7 + y, shade(gc, 1.5)); PX(o, 10, 7 + y, shade(gc, 1.3)); }
    } else if (gt === 'round') {
      R(o, 5, 7 + y, 1, 1, gc); R(o, 5, 9 + y, 1, 1, gc); PX(o, 4, 8 + y, gc); PX(o, 6, 8 + y, gc);
      R(o, 10, 7 + y, 1, 1, gc); R(o, 10, 9 + y, 1, 1, gc); PX(o, 9, 8 + y, gc); PX(o, 11, 8 + y, gc);
      PX(o, 4, 7 + y, gc); PX(o, 6, 7 + y, gc); PX(o, 4, 9 + y, gc); PX(o, 6, 9 + y, gc); PX(o, 9, 7 + y, gc); PX(o, 11, 7 + y, gc); PX(o, 9, 9 + y, gc); PX(o, 11, 9 + y, gc);
      R(o, 7, 8 + y, 2, 1, gc); PX(o, 3, 8 + y, gc); PX(o, 12, 8 + y, gc);
    } else if (gt === 'sun') {
      R(o, 4, 7 + y, 3, 3, gc); R(o, 9, 7 + y, 3, 3, gc); R(o, 7, 8 + y, 2, 1, '#DDDDDD'); PX(o, 3, 8 + y, '#DDDDDD'); PX(o, 12, 8 + y, '#DDDDDD');
      PX(o, 4, 7 + y, shade(gc, 1.6)); PX(o, 9, 7 + y, shade(gc, 1.6)); R(o, 4, 9 + y, 3, 1, shade(gc, 0.8)); R(o, 9, 9 + y, 3, 1, shade(gc, 0.8));
    } else if (gt === 'avi') {
      R(o, 4, 7 + y, 3, 3, gc); R(o, 9, 7 + y, 3, 3, gc); R(o, 4, 7 + y, 3, 1, '#D8B04A'); R(o, 9, 7 + y, 3, 1, '#D8B04A'); R(o, 7, 7 + y, 2, 1, '#D8B04A');
      PX(o, 3, 8 + y, '#D8B04A'); PX(o, 12, 8 + y, '#D8B04A'); PX(o, 4, 9 + y, shade(gc, 1.4)); PX(o, 9, 9 + y, shade(gc, 1.4)); PX(o, 5, 8 + y, shade(gc, 1.25));
    }
  }

  function faceFront(o, L, y, blink) {
    L._blinkNow = blink;
    var ex = [5, 10], i, g = L.glasses, sunny = g && (g[0] === 'sun' || g[0] === 'avi'), light = (L.eye !== DARK && lum(L.eye) > 0.2), bd = L.beard, full = bd && bd[0] === 'full', bc, kind, st;
    if (!sunny) {
      for (i = 0; i < 2; i++) {
        if (blink) { R(o, ex[i], (g && g[0] === 'round') ? 8 + y : 9 + y, 1, 1, L.hairSh); }
        else {
          R(o, ex[i], 8 + y, 1, 1, DARK);
          if (!(g && g[0] === 'round')) { R(o, ex[i], 9 + y, 1, 1, light ? L.eye : DARK); PX(o, ex[i] + (i ? 1 : -1), 9 + y, shade(L.skin, 1.05)); }
        }
        if (!g || g[0] === 'sun' || g[0] === 'avi') { R(o, ex[i] + (i ? 0 : -1), 7 + y, 2, 1, L.brow); }
      }
    }
    if (!bd || bd[0] === 'stubble') { PX(o, 4, 10 + y, L.blush); PX(o, 11, 10 + y, L.blush); }
    PX(o, 8, 10 + y, L.skinSh); PX(o, 7, 10 + y, L.skinHi);
    if (!full) { R(o, 7, 11 + y, 2, 1, L.mouth); PX(o, 6, 10 + y, mix(L.skin, L.mouth, 0.3)); PX(o, 9, 10 + y, mix(L.skin, L.mouth, 0.3)); }
    if (bd) {
      bc = bd[1]; kind = bd[0]; st = mix(L.skin, bc, 0.5);
      if (kind === 'stubble') {
        R(o, 3, 9 + y, 2, 3, st); R(o, 11, 9 + y, 2, 3, st); R(o, 5, 11 + y, 6, 1, st); R(o, 4, 12 + y, 8, 1, st); R(o, 5, 13 + y, 6, 1, st);
        R(o, 6, 10 + y, 4, 1, mix(L.skin, bc, 0.3)); R(o, 7, 11 + y, 2, 1, L.mouth);
      } else {
        R(o, 3, 8 + y, 1, 4, bc); R(o, 12, 8 + y, 1, 4, bc); R(o, 3, 9 + y, 3, 3, bc); R(o, 10, 9 + y, 3, 3, bc);
        R(o, 4, 12 + y, 8, 1, bc); R(o, 5, 13 + y, 6, 1, shade(bc, 0.85)); R(o, 6, 10 + y, 4, 1, bc); R(o, 6, 11 + y, 1, 1, bc); R(o, 9, 11 + y, 1, 1, bc);
        R(o, 7, 11 + y, 2, 1, L.lip); R(o, 6, 12 + y, 4, 1, shade(bc, 1.2));
        if (bd[2] === 'mus') { R(o, 5, 10 + y, 6, 1, bc); }
        PX(o, 4, 10 + y, null); PX(o, 11, 10 + y, null);
        PX(o, 4, 10 + y, bc); PX(o, 11, 10 + y, bc);
      }
    }
    if (L.earrings) { PX(o, 2, 10 + y, L.earrings); PX(o, 13, 10 + y, L.earrings); }
  }

  function headFront(o, L, P) {
    var y = P.uo, st = L.style, key = HF[st] || HF.short, pal = hp(L);
    skinFront(o, L, y);
    faceFront(o, L, y, P.blink);
    if (st !== 'bald' || true) { MAPS(o, key, 1 + y, pal); }
    if (st === 'side') { R(o, 4, 6 + y, 6, 1, L.hair); PX(o, 5, 5 + y, L.hairHi); R(o, 6, 5 + y, 1, 2, L.hairSh); }
    if (st === 'quiff') { R(o, 9, 1 + y, 3, 1, L.hairHi); }
    if (st === 'curlyshort' || st === 'afro' || st === 'curlylong') { PX(o, 3, 5 + y, L.hairSh); PX(o, 12, 6 + y, L.hairSh); }
    if (st === 'hijab') { R(o, 4, 5 + y, 8, 1, L.hairSh); R(o, 3, 6 + y, 1, 5, L.hairSh); R(o, 12, 6 + y, 1, 5, L.hairSh); }
    if (L.roots) { R(o, 5, 2 + y, 6, 1, L.roots); R(o, 4, 3 + y, 8, 1, L.roots); }
    if (st === 'ponytail') { R(o, 12, 4 + y, 2, 3, L.hair); R(o, 13, 7 + y, 2, 6, L.hair); R(o, 13, 4 + y, 2, 1, L.tie || PAL.orange); PX(o, 14, 8 + y, L.hairHi); R(o, 13, 13 + y, 1, 1, L.hairSh); }
    if (st === 'bun') { R(o, 6, 1 + y, 4, 2, L.hair); PX(o, 7, 1 + y, L.hairHi); }
    if (L.cowlick) { PX(o, 8, 1 + y, L.hair); PX(o, 9, 1 + y, L.hairHi); }
    if (st === 'braids') { R(o, 3, 5 + y, 1, 5, L.hair); R(o, 12, 5 + y, 1, 5, L.hair); }
    hatFront(o, L, y);
    glassesFront(o, L, y);
    if (L.hat === 'cap') { /* the visor shades the brow row */ }
  }

  /* ---------- head: back ---------- */
  var BACKCAP = ['.....hhh', '....hhhh', '...hhhhh', '...hhHhh', '...hhhhh', '...hhhhh', '...hhhhh', '...hhhhh', '...hhhhh', '....hhhh'];
  function headBack(o, L, P) {
    var y = P.uo, st = L.style, pal = hp(L), rows, i;
    R(o, 5, 3 + y, 6, 1, L.skin); R(o, 4, 4 + y, 8, 1, L.skin); R(o, 3, 5 + y, 10, 7, L.skin); R(o, 4, 12 + y, 8, 1, L.skin); R(o, 5, 13 + y, 6, 1, L.skinSh);
    R(o, 2, 8 + y, 1, 2, L.skin); R(o, 13, 8 + y, 1, 2, L.skinSh);
    if (st === 'bald') { R(o, 6, 4 + y, 3, 1, L.skinHi); }
    else if (st === 'afro') {
      MAPS(o, ['....hhhh', '..hhhhhh', '.hhhhhhh', '.hhHhhhh', '.hhhhhhh', '.hhhhhhh', '.hhhhhhh', '.hhhhhhh', '.hhhhhhh', '.hhhhhhh', '..hhhhhh', '....hhhh'], 1 + y, pal);
    } else if (st === 'hijab') {
      MAPS(o, ['....hhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhHhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh'], 1 + y, pal);
    } else {
      MAPS(o, BACKCAP, 2 + y, pal);
      if (st === 'quiff') { MAPS(o, ['......hh'], 1 + y, pal); }
      if (st === 'curlyshort') { MAPS(o, ['....h.hh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hhhhhh', '..hh..hh'], 1 + y, pal); R(o, 4, 10 + y, 8, 1, L.hair); R(o, 5, 11 + y, 6, 1, L.hairSh); }
      if (st === 'slick') { R(o, 5, 12 + y, 6, 1, L.hair); }
      if (st === 'buzz') { R(o, 5, 12 + y, 6, 1, mix(L.skin, L.hair, 0.35)); }
      if (st === 'bun') { R(o, 6, 1 + y, 4, 2, L.hair); PX(o, 7, 1 + y, L.hairHi); R(o, 6, 3 + y, 4, 1, L.hairSh); }
      if (st === 'ponytail') { R(o, 6, 5 + y, 4, 1, L.tie || PAL.orange); R(o, 7, 6 + y, 2, 9, L.hair); R(o, 7, 7 + y, 1, 6, L.hairHi); R(o, 7, 15 + y, 2, 1, L.hairSh); }
      if (st === 'braids') { R(o, 4, 11 + y, 8, 1, L.hairSh); }
      if (L.roots) { R(o, 5, 2 + y, 6, 1, L.roots); R(o, 4, 3 + y, 8, 1, L.roots); }
      if (L.cowlick) { PX(o, 8, 1 + y, L.hair); }
    }
    if (L.hat === 'chef') {
      R(o, 5, 1 + y, 6, 1, '#FFFFFF'); R(o, 4, 2 + y, 8, 1, '#FFFFFF'); R(o, 3, 3 + y, 10, 1, '#F3F5FA'); R(o, 3, 4 + y, 10, 2, '#EEF0F4'); R(o, 3, 5 + y, 10, 1, '#DADDE3');
      PX(o, 6, 3 + y, '#DADDE3'); PX(o, 9, 3 + y, '#DADDE3');
    } else if (L.hat === 'cap') {
      R(o, 5, 2 + y, 6, 1, L.hatCol); R(o, 4, 3 + y, 8, 1, L.hatCol); R(o, 3, 4 + y, 10, 3, L.hatCol); R(o, 3, 7 + y, 10, 1, shade(L.hatCol, 0.78));
      PX(o, 8, 2 + y, shade(L.hatCol, 0.7)); R(o, 6, 4 + y, 3, 1, shade(L.hatCol, 1.2)); R(o, 6, 8 + y, 4, 1, shade(L.hatCol, 0.85));
    } else if (L.hat === 'beanie') {
      R(o, 5, 1 + y, 6, 1, L.hatCol); R(o, 4, 2 + y, 8, 1, L.hatCol); R(o, 3, 3 + y, 10, 3, L.hatCol); R(o, 3, 6 + y, 10, 1, shade(L.hatCol, 0.8));
      R(o, 7, 1 + y, 2, 1, shade(L.hatCol, 1.3));
    }
    if (L.headset || L.headphones) {
      var st2 = L.headphones ? '#2E2F33' : '#9EA2AA', cup = L.headphones ? PAL.orange : PAL.steel, hy = L.hat ? 1 : 0;
      R(o, 4, 1 + y + hy, 8, 1, st2); R(o, 3, 2 + y + hy, 1, 3, st2); R(o, 12, 2 + y + hy, 1, 3, st2);
      R(o, 2, 6 + y, 2, 4, cup); R(o, 12, 6 + y, 2, 4, cup); R(o, 2, 6 + y, 2, 1, shade(cup, 1.25));
    }
    if (L.earrings) { PX(o, 2, 10 + y, L.earrings); PX(o, 13, 10 + y, L.earrings); }
  }

  /* ---------- side view (facing right; left is the mirror) ---------- */
  var STY = {
    short: { rise: 0, fw: 4, fr: 5, nape: 9, bw: 4 }, side: { rise: 0, fw: 6, fr: 6, nape: 9, bw: 4 }, quiff: { rise: 1, fw: 4, fr: 4, nape: 9, bw: 4 },
    buzz: { rise: 0, fw: 3, fr: 4, nape: 8, bw: 4, buzz: 1 }, slick: { rise: 0, fw: 2, fr: 4, nape: 11, bw: 5 }, curlyshort: { rise: 1, fw: 5, fr: 5, nape: 10, bw: 5, wide: 1 },
    ponytail: { rise: 0, fw: 4, fr: 5, nape: 8, bw: 3 }, bun: { rise: 0, fw: 3, fr: 4, nape: 7, bw: 3 }, braids: { rise: 0, fw: 5, fr: 6, nape: 10, bw: 4 },
    long: { rise: 0, fw: 5, fr: 6, nape: 10, bw: 4 }, wavy: { rise: 0, fw: 5, fr: 6, nape: 10, bw: 4 }, curlylong: { rise: 1, fw: 5, fr: 6, nape: 11, bw: 5, wide: 1 },
    bald: null, afro: null, hijab: null
  };
  function sideHair(o, L, y, behind) {
    var st = L.style, S = STY[st], c = L.buzz && S && S.buzz ? L.buzz : L.hair, hi = L.hairHi, sh = L.hairSh, r, wd;
    if (behind) {
      if (st === 'long' || st === 'wavy' || st === 'braids') { R(o, 2, 4 + y, 6, 15, c); R(o, 3, 4 + y, 1, 12, hi); R(o, 2, 17 + y, 6, 1, sh); if (st === 'wavy') { PX(o, 1, 8 + y, c); PX(o, 1, 13 + y, c); PX(o, 2, 19 + y, sh); } }
      if (st === 'curlylong') { R(o, 1, 4 + y, 7, 15, c); R(o, 2, 5 + y, 1, 4, hi); R(o, 3, 11 + y, 1, 3, hi); R(o, 1, 18 + y, 6, 1, sh); PX(o, 0, 8 + y, c); PX(o, 0, 14 + y, c); }
      if (st === 'ponytail') { R(o, 1, 6 + y, 4, 3, c); R(o, 1, 9 + y, 3, 8, c); R(o, 2, 9 + y, 1, 5, hi); R(o, 1, 17 + y, 3, 1, sh); R(o, 4, 5 + y, 1, 2, L.tie || PAL.orange); }
      if (st === 'hijab') { R(o, 2, 3 + y, 7, 16, c); R(o, 3, 5 + y, 1, 8, hi); R(o, 2, 17 + y, 6, 1, sh); }
      if (st === 'slick') { R(o, 2, 7 + y, 3, 7, c); R(o, 3, 8 + y, 1, 3, hi); R(o, 2, 13 + y, 3, 1, sh); }
      return;
    }
    if (st === 'bald') { R(o, 6, 3 + y, 3, 1, L.skinHi); return; }
    if (st === 'afro') {
      R(o, 5, 1 + y, 7, 1, c); R(o, 3, 2 + y, 9, 1, c); R(o, 1, 3 + y, 12, 1, c); R(o, 1, 4 + y, 12, 6, c); R(o, 2, 10 + y, 5, 2, c); R(o, 9, 5 + y, 4, 2, c);
      R(o, 4, 3 + y, 3, 1, hi); R(o, 8, 2 + y, 2, 1, hi); R(o, 2, 6 + y, 1, 2, hi); PX(o, 1, 11 + y, sh); R(o, 11, 10 + y, 1, 1, c);
      return;
    }
    if (st === 'hijab') {
      R(o, 4, 1 + y, 7, 1, c); R(o, 3, 2 + y, 9, 1, c); R(o, 2, 3 + y, 11, 1, c); R(o, 2, 4 + y, 11, 6, c); R(o, 2, 10 + y, 8, 3, c); R(o, 3, 13 + y, 8, 2, c);
      R(o, 10, 6 + y, 3, 6, null); R(o, 4, 3 + y, 4, 1, hi); R(o, 3, 6 + y, 1, 4, hi); R(o, 4, 14 + y, 8, 1, sh); R(o, 3, 15 + y, 6, 3, c);
      R(o, 11, 4 + y, 2, 2, c); R(o, 12, 5 + y, 1, 1, sh); R(o, 10, 6 + y, 1, 1, sh);
      return;
    }
    S = S || STY.short; r = S.rise;
    wd = S.wide ? 1 : 0;
    R(o, 5 - wd, 2 - r + y, 6 + wd, 1, c); R(o, 4 - wd, 3 - r + y, 8 + wd, 1, c); R(o, 3 - wd, 4 + y, 10 + wd, 1, c);
    R(o, 3 - wd, 5 + y, S.bw + wd, S.nape - 4, c);
    R(o, 13 - S.fw, 5 + y, S.fw, 1, c);
    if (S.fr > 5) { R(o, 13 - S.fw + 1, 6 + y, S.fw - 2, 1, c); }
    R(o, 6, 3 + y, 3, 1, hi); R(o, 3 - wd, 5 + y, 1, 2, sh);
    if (r) { R(o, 6, 1 + y, 4, 1, c); PX(o, 7, 1 + y, hi); if (st === 'curlyshort' || st === 'curlylong') { PX(o, 9, 1 + y, c); PX(o, 4, 2 + y, c); PX(o, 11, 2 + y, c); } }
    if (st === 'curlyshort' || st === 'curlylong') { PX(o, 3 - wd, 7 + y, sh); PX(o, 11, 5 + y, c); }
    if (st === 'buzz') { R(o, 5, 9 + y, 1, 1, c); }
    if (st === 'bun') { R(o, 4, 1 + y, 4, 2, c); PX(o, 5, 1 + y, hi); R(o, 3, 3 + y, 2, 2, c); }
    if (st === 'side') { R(o, 9, 5 + y, 3, 1, hi); }
    if (st === 'quiff') { R(o, 9, 2 + y, 3, 1, hi); R(o, 10, 1 + y, 2, 1, c); }
    if (L.roots) { R(o, 5, 2 + y, 6, 1, L.roots); R(o, 4, 3 + y, 8, 1, L.roots); }
    if (L.cowlick) { PX(o, 7, 1 + y, c); PX(o, 8, 0 + y + 1, hi); }
  }

  function sideHead(o, L, P) {
    var y = P.uo, g = L.glasses, light = (L.eye !== DARK && lum(L.eye) > 0.2), bd = L.beard, bc, kind, st, S = L.style, hy;
    R(o, 5, 3 + y, 6, 1, L.skin); R(o, 4, 4 + y, 8, 1, L.skin); R(o, 3, 5 + y, 10, 7, L.skin); R(o, 4, 12 + y, 8, 1, L.skin); R(o, 6, 13 + y, 5, 1, L.skin);
    R(o, 3, 6 + y, 1, 5, L.skinSh); PX(o, 13, 9 + y, L.skin); PX(o, 13, 10 + y, L.skinSh); R(o, 6, 13 + y, 5, 1, L.skinSh);
    if (!(g && (g[0] === 'sun' || g[0] === 'avi'))) {
      if (P.blink) { PX(o, 10, (g && g[0] === 'round') ? 8 + y : 9 + y, L.hairSh); }
      else { PX(o, 10, 8 + y, DARK); if (!(g && g[0] === 'round')) { PX(o, 10, 9 + y, light ? L.eye : DARK); } }
      if (!g || g[0] === 'sun' || g[0] === 'avi') { R(o, 9, 7 + y, 3, 1, L.brow); }
    }
    PX(o, 10, 10 + y, L.blush); R(o, 11, 11 + y, 2, 1, L.mouth); PX(o, 12, 10 + y, L.skinHi);
    R(o, 6, 8 + y, 2, 2, L.skinSh); PX(o, 6, 8 + y, L.skin);
    if (bd) {
      bc = bd[1]; kind = bd[0]; st = mix(L.skin, bc, 0.5);
      if (kind === 'stubble') { R(o, 5, 9 + y, 6, 4, st); R(o, 11, 10 + y, 2, 2, st); R(o, 11, 11 + y, 2, 1, L.mouth); }
      else {
        R(o, 4, 8 + y, 3, 5, bc); R(o, 7, 10 + y, 6, 3, bc); R(o, 7, 9 + y, 3, 1, bc); PX(o, 13, 10 + y, bc); R(o, 6, 12 + y, 6, 1, shade(bc, 0.85));
        R(o, 11, 11 + y, 2, 1, L.lip); if (bd[2] === 'mus') { R(o, 10, 10 + y, 3, 1, bc); }
        PX(o, 12, 12 + y, shade(bc, 1.25));
      }
    }
    if (L.earrings) { PX(o, 6, 10 + y, L.earrings); }
    sideHair(o, L, y, false);
    if (L.hat === 'chef') {
      R(o, 5, 1 + y, 6, 1, '#FFFFFF'); R(o, 4, 2 + y, 8, 1, '#FFFFFF'); R(o, 3, 3 + y, 9, 1, '#F3F5FA'); R(o, 3, 4 + y, 10, 2, '#EEF0F4'); R(o, 3, 5 + y, 10, 1, '#DADDE3');
      PX(o, 6, 3 + y, '#DADDE3'); PX(o, 9, 3 + y, '#DADDE3');
    } else if (L.hat === 'cap') {
      R(o, 4, 2 + y, 7, 1, L.hatCol); R(o, 3, 3 + y, 9, 2, L.hatCol); R(o, 3, 5 + y, 10, 1, shade(L.hatCol, 0.78)); R(o, 11, 5 + y, 4, 1, shade(L.hatCol, 0.7));
      R(o, 5, 3 + y, 3, 1, shade(L.hatCol, 1.2));
    } else if (L.hat === 'beanie') {
      R(o, 5, 1 + y, 6, 1, L.hatCol); R(o, 3, 2 + y, 9, 1, L.hatCol); R(o, 3, 3 + y, 10, 2, L.hatCol); R(o, 3, 5 + y, 10, 1, shade(L.hatCol, 0.8));
      PX(o, 8, 0 + y + 1, shade(L.hatCol, 1.3)); PX(o, 5, 3 + y, shade(L.hatCol, 1.2));
    }
    if (g) {
      if (g[0] === 'rect' || g[0] === 'tort') { R(o, 9, 7 + y, 4, 1, g[1]); PX(o, 9, 8 + y, g[1]); PX(o, 12, 8 + y, g[1]); PX(o, 9, 9 + y, g[1]); PX(o, 12, 9 + y, g[1]); PX(o, 11, 8 + y, PALE); PX(o, 11, 9 + y, PALE); R(o, 6, 8 + y, 3, 1, g[1]); if (g[0] === 'tort') { PX(o, 9, 7 + y, shade(g[1], 1.5)); PX(o, 10, 7 + y, shade(g[1], 1.3)); } }
      else if (g[0] === 'round') { R(o, 10, 7 + y, 2, 1, g[1]); R(o, 10, 9 + y, 2, 1, g[1]); PX(o, 9, 8 + y, g[1]); PX(o, 12, 8 + y, g[1]); PX(o, 11, 8 + y, PALE); R(o, 6, 8 + y, 3, 1, g[1]); }
      else if (g[0] === 'sun') { R(o, 9, 7 + y, 4, 3, g[1]); R(o, 6, 8 + y, 3, 1, '#DDDDDD'); PX(o, 9, 7 + y, shade(g[1], 1.6)); }
      else if (g[0] === 'avi') { R(o, 9, 7 + y, 4, 3, g[1]); R(o, 9, 7 + y, 4, 1, '#D8B04A'); R(o, 6, 8 + y, 3, 1, '#D8B04A'); }
    }
    if (L.headset || L.headphones) {
      hy = L.hat ? 1 : 0;
      var st2 = L.headphones ? '#2E2F33' : '#9EA2AA', cup = L.headphones ? PAL.orange : PAL.steel;
      R(o, 4, 1 + y + hy, 7, 1, st2); R(o, 4, 2 + y + hy, 1, 3, st2); R(o, 5, 6 + y, 4, 4, cup); R(o, 5, 6 + y, 4, 1, shade(cup, 1.25)); R(o, 5, 9 + y, 4, 1, shade(cup, 0.7));
      if (L.headset) { R(o, 8, 10 + y, 1, 1, PAL.steel); R(o, 9, 11 + y, 3, 1, PAL.steel); PX(o, 12, 11 + y, PAL.orange); }
    }
  }

  function sideBody(o, L, P) {
    var t = L.top, c = t.col, T = 14 + P.uo, x0 = L.broad ? 4 : 5, x1 = L.broad ? 11 : 10, w = x1 - x0 + 1, k = t.kind, b = L.bottom, bc = b.col, s = P.s, kind = b.kind,
      sk = sleeveKind(L), ax, se, hy, sc, y, soleC = shade(L.shoes, 0.6), topC = shade(L.shoes, 1.18), cuff;
    function leg(xx, col, shoeCol, lift, near) {
      if (kind === 'skirt') { R(o, xx + 1, 27 - lift, 2, 2 + lift, near ? L.skin : L.skinSh); }
      else if (kind === 'shorts') {
        R(o, xx, 23, 3, 3 - lift, col); R(o, xx, 25 - lift, 3, 1, shade(col, 0.8)); R(o, xx, 26 - lift, 2, 3 + lift, near ? L.skin : L.skinSh); PX(o, xx, 28, '#F3F5FA'); PX(o, xx + 1, 28, '#F3F5FA');
      } else {
        R(o, xx, 23, 3, 6 - lift, col); if (near) { R(o, xx, 25, 1, 3 - lift, shade(col, 1.08)); }
        if (b.cuff) { R(o, xx, 28 - lift, 3, 1, shade(col, 0.72)); }
      }
      R(o, xx, 29 - lift, 4, 1, shade(shoeCol, near ? 1.18 : 1)); R(o, xx, 30 - lift, 4, 1, near ? soleC : shade(soleC, 0.85)); PX(o, xx + 3, 29 - lift, shoeCol);
    }
    leg(6 - s, shade(bc, 0.74), shade(L.shoes, 0.82), P.lf, false);
    leg(6 + s, bc, L.shoes, P.ln, true);
    if (kind === 'skirt' || k === 'coat') {
      R(o, x0 - 1, 23, w + 2, 5, k === 'coat' ? c : bc); R(o, x0 - 1, 27, w + 2, 1, shade(k === 'coat' ? c : bc, 0.78)); R(o, x0, 24, 1, 3, shade(k === 'coat' ? c : bc, 0.9));
      R(o, x1, 23, 1, 4, shade(k === 'coat' ? c : bc, 1.08));
      if (k === 'coat') { PX(o, x1, 24, PAL.gold); PX(o, x1, 26, PAL.gold); }
    } else { R(o, x0, 23, w, 1, shade(bc, 0.92)); if (b.belt) { R(o, x0, 22, w, 1, b.belt); R(o, x1 - 1, 22, 1, 1, '#C9CDD2'); } }
    R(o, x0, T, w, 23 - T, c); R(o, x0, T, 1, 23 - T, shade(c, 0.8)); R(o, x1, T, 1, 23 - T, shade(c, 1.1));
    R(o, x0 + 1, 22, w - 2, 1, shade(c, 0.86)); R(o, x0 + 1, T + 4, 1, 3, shade(c, 0.88));
    if (k === 'hoodie') { R(o, x0, T, w, 2, shade(c, 0.78)); R(o, x1 - 1, 19 + P.uo, 2, 3, shade(c, 0.86)); R(o, x1, T + 2, 1, 4, PAL.cream); }
    if (k === 'blazer') { R(o, x1, T, 1, 4, PAL.paper); R(o, x1 - 1, T, 1, 2, shade(c, 1.55)); R(o, x0, 21, w, 2, shade(c, 0.8)); }
    if (k === 'jacket' || k === 'coat') { R(o, x1, T, 1, 23 - T, t.under || t.col2); R(o, x1 - 1, T, 1, 23 - T, shade(c, 0.74)); R(o, x0, T, w, 2, shade(c, 1.15)); R(o, x0, 21, w, 2, shade(c, 0.8)); }
    if (k === 'dress') { R(o, x0, T + 4, w, 1, shade(c, 0.78)); R(o, x0, T + 5, w, 1, shade(c, 1.1)); PX(o, x1, T + 4, PAL.gold); }
    if ((k === 'shirt' || k === 'tee') && t.logo) { PX(o, x1 - 1, T + 3, PAL.paper); PX(o, x1, T + 3, PAL.orange); }
    if (k === 'shirt' || k === 'tee') { R(o, x1 - 1, T, 2, 1, t.col2); }
    if (t.vest && k !== 'coat') { R(o, x0, T, w, 23 - T, t.vest); R(o, x0, T, 1, 23 - T, shade(t.vest, 0.8)); R(o, x1, T, 1, 3, shade(t.vest, 1.2)); R(o, x0, 21, w, 2, shade(t.vest, 0.88)); }
    if (L.scarfOn) { R(o, x0, T, w, 2, L.scarf || PAL.orange); R(o, x0, T + 1, w, 1, shade(L.scarf || PAL.orange, 0.84)); R(o, x0 - 1, T + 1, 2, 5, L.scarf || PAL.orange); R(o, x0 - 1, T + 4, 2, 1, shade(L.scarf || PAL.orange, 0.8)); }
    if (L.neckphones) { R(o, x0, T, w, 1, '#9EA2AA'); R(o, 6, T, 3, 4, PAL.steel); R(o, 7, T + 1, 1, 1, PAL.orange); }
    if (t.puff) { R(o, 7 + P.sx, T, 2, 1, c); }
    ax = 7 + P.sx; hy = T + 8;
    if (sk === 'none') { se = T; } else if (sk === 'short') { se = T + 3; } else { se = hy - 1; }
    sc = shade(c, 0.9);
    R(o, ax, T + 1, 2, hy - T + 1, L.skin);
    if (se >= T + 1) { R(o, ax, T + 1, 2, se - T, k === 'coat' ? shade(c, 0.94) : sc); R(o, ax + 1, T + 1, 1, se - T, shade(c, 0.76)); }
    if (sk === 'long') { cuff = shade(c, 0.7); R(o, ax, hy - 1, 2, 1, cuff); }
    R(o, ax, hy + 1, 2, 1, L.skinSh);
    if (L.tat === 'armL') { for (y = Math.max(se + 1, T + 1); y <= hy; y++) { if (y % 2 === 0) { PX(o, ax, y, '#3A3A40'); } } }
    if (L.vest && k === 'dress') { /* vest over a dress stays on the torso */ }
  }

  /* ---------- held items ---------- */
  function heldItem(o, L, P, dir) {
    var it = L.acc && ITEMS[L.acc], w, h, ax, ay;
    if (!it) { return; }
    w = it.rows[0].length; h = it.rows.length;
    if (dir === 'down') { ay = 24 - h + P.uo; ax = 15 - w; BM(o, ax, ay, it.rows, it.pal, false); }
    else if (dir === 'up') { ay = 24 - h + P.uo; ax = 1; BM(o, ax, ay, it.rows, it.pal, true); }
    else if (dir === 'right') { ay = 23 - h + P.uo; ax = Math.min(15 - w, 9 + P.sx); BM(o, ax, ay, it.rows, it.pal, false); }
  }

  /* ---------- assemble one frame ---------- */
  function drawFrame(o, L, dir, c) {
    var P = pose(dir, c), st = L.style, bk = BACKH[st], fl = FALL[st];
    if (dir === 'down') {
      if (bk) { MAPS(o, bk.rows, bk.y + P.uo, hp(L)); }
      legsFront(o, L, P); torsoFront(o, L, P, false); coatSkirt(o, L, P); armsFront(o, L, P, false); worn(o, L, P, dir); scarfFront(o, L, P, dir);
      headFront(o, L, P);
      if (fl) { MAPS(o, fl.rows, fl.y + P.uo, hp(L)); }
      heldItem(o, L, P, 'down');
    } else if (dir === 'up') {
      heldItem(o, L, P, 'up');
      legsFront(o, L, P); torsoFront(o, L, P, true); coatSkirt(o, L, P); armsFront(o, L, P, true); worn(o, L, P, dir); scarfFront(o, L, P, dir);
      headBack(o, L, P);
      if (bk) { MAPS(o, bk.rows, bk.y + P.uo, hp(L)); }
      if (st === 'braids') { MAPS(o, FALL.braids.rows, 12 + P.uo, hp(L)); }
      if (st === 'ponytail') { /* drawn inside headBack */ }
    } else {
      sideHair(o, L, P.uo, true);
      sideBody(o, L, P); sideHead(o, L, P);
      if (st === 'braids') { R(o, 6, 13 + P.uo, 2, 8, L.hair); R(o, 6, 14 + P.uo, 1, 6, L.hairHi); R(o, 6, 20 + P.uo, 2, 1, L.tie || PAL.orange); }
      if (st === 'hijab') { R(o, 4, 15 + P.uo, 6, 4, L.hair); R(o, 5, 16 + P.uo, 1, 2, L.hairHi); }
      heldItem(o, L, P, 'right');
    }
  }

  /* ---------- sprite sheets: 12 columns x 4 rows of 16x32, lazily, per look and outfit ---------- */
  var DIRS = ['down', 'up', 'left', 'right'];
  var COLS = 12;
  var sheets = {};

  function frameCanvas(L, dir, c) {
    var o, m;
    if (dir === 'left') {
      m = frameCanvas(L, 'right', c);
      o = mk(16, 32);
      o.g.translate(16, 0); o.g.scale(-1, 1); o.g.drawImage(m, 0, 0);
      return o.c;
    }
    o = mk(16, 32);
    drawFrame(o, L, dir, c);
    outline(o, PAL.outline);
    return o.c;
  }
  function buildSheet(L) {
    var o = mk(16 * COLS, 32 * 4), d, f;
    for (d = 0; d < 4; d++) { for (f = 0; f < COLS; f++) { o.g.drawImage(frameCanvas(L, DIRS[d], f), f * 16, d * 32); } }
    return o.c;
  }
  function sheetFor(id, vk) {
    var key = id + '|' + vk, s = sheets[key], L = LOOK[id];
    if (s || !L) { return s || null; }
    s = buildSheet(variantLook(L, vk, id));
    sheets[key] = s;
    return s;
  }
  function sheetForLook(look, vk) {
    var lk = lookKey(look), L = fromLook(look), key = lk + '|' + vk, s = sheetsLook[key];
    if (s) { return s; }
    s = buildSheet(variantLook(L, vk, 'L' + lk));
    sheetsLook[key] = s;
    return s;
  }

  var reduced = false;
  try {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced = !!mq.matches;
    if (mq.addEventListener) { mq.addEventListener('change', function (e) { reduced = !!e.matches; }); }
  } catch (e0) { reduced = false; }

  function phase(id) { return hash(id) % 997; }
  function colFor(frame, id) {
    var f = Math.floor(frame || 0), t, c;
    if (f < 0) { f = 0; }
    if (f < 8) { return f; }
    t = Date.now() + phase(id) * 37;
    c = 8 + ((Math.floor(t / 700) % 2) ? 1 : 0);
    if (((t + phase(id) * 131) % 3800) < 150) { c += 2; }
    return c;
  }
  function blit(ctx, sh, col, d, x, y, s) {
    var prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sh, col * 16, d * 32, 16, 32, Math.round(x), Math.round(y), 16 * s, 32 * s);
    ctx.imageSmoothingEnabled = prev;
  }
  function draw(ctx, id, dir, frame, x, y, scale) {
    var sh = sheetFor(id, variantFor()), d = DIRS.indexOf(dir);
    if (!sh) { return false; }
    if (d < 0) { d = 0; }
    blit(ctx, sh, colFor(frame, id), d, x, y, scale || 1);
    return true;
  }
  function drawLook(ctx, look, dir, frame, x, y, scale) {
    var sh = sheetForLook(look, variantFor()), d = DIRS.indexOf(dir);
    if (d < 0) { d = 0; }
    blit(ctx, sh, colFor(frame, lookKey(look)), d, x, y, scale || 1);
    return true;
  }

  /* =====================================================================================
     Portraits: 64x64 busts, drawn at their own resolution (finer than the sprites).
     ===================================================================================== */
  var CX = 32;
  function EL(o, cx, cy, rx, ry, col) {
    var y, t, dx, x0, x1, x, c;
    for (y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      t = (y + 0.5 - cy) / ry;
      if (t < -1 || t > 1) { continue; }
      dx = rx * Math.sqrt(1 - t * t);
      x0 = Math.round(cx - dx); x1 = Math.round(cx + dx) - 1;
      if (typeof col === 'function') { for (x = x0; x <= x1; x++) { c = col(x, y); if (c) { PX(o, x, y, c); } } }
      else { R(o, x0, y, x1 - x0 + 1, 1, col); }
    }
  }
  function rnd(x, y) {
    var n = Math.imul(x + 101, 374761393) ^ Math.imul(y + 57, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) % 100;
  }
  function hairFn(L, base) {
    var b = base || L.hair, sh = shade(b, 0.8), hi = hiOf(b);
    return function (x, y) {
      var r = rnd(x, y);
      if (r < 9) { return sh; }
      if (r > 94) { return hi; }
      return b;
    };
  }
  function arcHi(o, cx, cy, rx, ry, col, a0, a1, th) {
    var a, x, y;
    for (a = a0; a <= a1; a += 0.03) { x = Math.round(cx + rx * Math.cos(a)); y = Math.round(cy + ry * Math.sin(a)); R(o, x, y, th || 2, 1, col); }
  }
  function clipFn(f, hl) { return function (x, y) { return y < hl(x) ? f(x, y) : null; }; }
  /* a bumpy ring of circles (curls) */
  function curls(o, cx, cy, rx, ry, r, col, n, from, to) {
    var i, a, x, y;
    for (i = 0; i < n; i++) {
      a = from + (to - from) * (i / (n - 1));
      x = cx + rx * Math.cos(a); y = cy + ry * Math.sin(a);
      EL(o, x, y, r, r, col);
    }
  }
  function headEdge(y) { var t = (y + 0.5 - 27) / 17; if (t < -1 || t > 1) { return null; } var dx = 14 * Math.sqrt(1 - t * t); return [Math.round(CX - dx), Math.round(CX + dx) - 1]; }

  /* ----- hair: back layer (behind the head and the shoulders) ----- */
  function hairBackP(o, L) {
    var st = L.style, hf = hairFn(L), i, y, w, c = L.hair;
    if (st === 'afro') { EL(o, CX, 24, 23, 22, hf); curls(o, CX, 24, 22, 21, 4, hf, 18, Math.PI * 0.55, Math.PI * 2.45); return; }
    if (st === 'curlylong') {
      EL(o, CX, 28, 20, 21, hf); R(o, 12, 30, 40, 40, c); curls(o, CX, 28, 20, 20, 4, hf, 16, Math.PI * 0.7, Math.PI * 2.3);
      for (y = 34; y < 64; y += 6) { EL(o, 12, y, 4, 4, hf); EL(o, 52, y, 4, 4, hf); }
      return;
    }
    if (st === 'long' || st === 'wavy' || st === 'braids') {
      EL(o, CX, 27, 19, 19, hf); R(o, 13, 28, 38, 36, c);
      if (st === 'wavy') { for (y = 32; y < 64; y += 8) { EL(o, 12, y, 3, 4, hf); EL(o, 52, y + 3, 3, 4, hf); } }
      return;
    }
    if (st === 'ponytail') { EL(o, 47, 30, 5, 8, hf); EL(o, 49, 40, 4, 8, hf); EL(o, 48, 49, 3, 4, shade(c, 0.8)); EL(o, 45, 24, 3, 3, L.tie || PAL.orange); return; }
    if (st === 'hijab') {
      EL(o, CX, 28, 21, 23, c); R(o, 11, 36, 42, 30, c);
      for (i = 0; i < 6; i++) { PX(o, 12 + i * 2, 36 + i, shade(c, 1.2)); }
      return;
    }
    if (st === 'slick' && !L.hat) { EL(o, CX, 22, 16, 15, hf); }
  }

  /* ----- hair: front layer (over the face edge, the fringe) ----- */
  function hairFrontP(o, L) {
    var st = L.style, hf = hairFn(L), c = L.hair, cap, hl, i, x, y, bz = L.buzz, dx, f;
    function capEl(cx, cy, rx, ry, hlf, fn) { EL(o, cx, cy, rx, ry, clipFn(fn || hf, hlf)); }
    if (st === 'bald') { EL(o, 28, 14, 5, 2, L.skinHi); EL(o, 36, 16, 3, 1, L.skinHi); return; }
    if (st === 'buzz') {
      capEl(CX, 24, 15.5, 17.5, function (x) { dx = Math.abs(x - 32); return dx >= 13 ? 29 : (dx >= 11.5 ? 25 : 20 + dx * 0.25); }, function (x, y) { return ((x + y) % 3 === 0) ? shade(bz, 0.85) : bz; });
      return;
    }
    if (st === 'short' || st === 'side' || st === 'ponytail') {
      capEl(CX, 25, 16.5, 18, function (x) {
        dx = Math.abs(x - 32);
        if (st === 'side') { return dx >= 14 ? 31 : (x < 26 ? 20 + (26 - x) * 0.45 : (dx >= 11.5 ? 27 : 24 - (x - 26) * 0.12 + (dx > 8 ? (dx - 8) : 0))); }
        return dx >= 14 ? 31 : (dx >= 11.5 ? 27 : 21.5 + dx * 0.32 + (x > 28 && x < 38 ? 1 : 0));
      });
      arcHi(o, CX, 25, 14, 15, hiOf(c), Math.PI * 1.12, Math.PI * 1.55, 2);
      if (st === 'side') { for (i = 0; i < 6; i++) { PX(o, 26 + (i % 2), 11 + i, shade(c, 0.6)); } }
      if (L.cowlick) { EL(o, 33, 9, 2, 3, hf); }
    } else if (st === 'quiff') {
      capEl(CX, 25, 16.5, 18, function (x) { dx = Math.abs(x - 32); return dx >= 14 ? 31 : (dx >= 11.5 ? 26 : 19 + dx * 0.25); });
      EL(o, 38, 10, 11, 7, hf); EL(o, 42, 7, 7, 4, hf); EL(o, 40, 8, 3, 1.5, shade(c, 1.45));
    } else if (st === 'slick') {
      capEl(CX, 24, 15.5, 17, function (x) { dx = Math.abs(x - 32); return dx >= 13 ? 33 : (dx >= 11 ? 24 : 17 + dx * 0.15); });
      for (i = 0; i < 5; i++) { R(o, 24 + i * 4, 11 + (i % 2), 1, 5, shade(c, 1.3)); }
    } else if (st === 'bun') {
      capEl(CX, 25, 16, 17.5, function (x) { dx = Math.abs(x - 32); return dx >= 13.5 ? 30 : (dx >= 11.5 ? 25 : 20 + dx * 0.3); });
      EL(o, CX, 6, 7, 6, hf); EL(o, 30, 4, 2.5, 2, shade(c, 1.4)); R(o, 26, 11, 12, 2, shade(c, 0.7));
    } else if (st === 'curlyshort') {
      capEl(CX, 23, 17, 17, function (x) { dx = Math.abs(x - 32); return dx >= 14 ? 31 : (dx >= 11.5 ? 26 : 21.5 + dx * 0.2); });
      curls(o, CX, 22, 15.5, 14.5, 4.2, hf, 13, Math.PI * 0.95, Math.PI * 2.05);
      EL(o, 20, 28, 3, 4, hf); EL(o, 44, 28, 3, 4, hf);
      for (i = 0; i < 4; i++) { EL(o, 24 + i * 5, 21 + (i % 2), 3, 2.4, hf); }
    } else if (st === 'afro') {
      capEl(CX, 22, 19, 17, function (x) { dx = Math.abs(x - 32); return dx >= 14 ? 36 : (dx >= 11.5 ? 26 : 19.5 + dx * 0.25); });
      curls(o, CX, 20, 18, 14, 4.5, hf, 12, Math.PI * 1.0, Math.PI * 2.0);
    } else if (st === 'long' || st === 'wavy' || st === 'braids' || st === 'curlylong') {
      capEl(CX, 25, 17, 18, function (x) {
        dx = Math.abs(x - 32);
        if (st === 'curlylong') { return dx >= 12.5 ? 40 : (dx >= 10 ? 26 : 21 + dx * 0.25); }
        return dx >= 14 ? 40 : (dx >= 11.5 ? 25 : 18 + dx * 0.55);
      });
      if (st === 'curlylong') { curls(o, CX, 22, 17, 15, 4.3, hf, 13, Math.PI * 0.95, Math.PI * 2.05); }
      if (L.roots) { capEl(CX, 25, 17, 18, function (x) { return 17; }, function () { return L.roots; }); }
    } else if (st === 'hijab') {
      f = function (x, y) {
        var u = (x + 0.5 - CX) / 11.2, v = (y + 0.5 - 31) / 13.6;
        if (u * u + v * v < 1) { return null; }
        return ((x + y) % 7 === 0) ? shade(c, 0.88) : ((x * 2 + y) % 11 === 0 ? shade(c, 1.12) : c);
      };
      EL(o, CX, 28, 19.5, 21.5, f);
      R(o, 20, 44, 24, 3, c);
      for (i = 0; i < 4; i++) { PX(o, 18 + i, 20 + i * 2, shade(c, 0.7)); PX(o, 45 - i, 20 + i * 2, shade(c, 0.7)); }
      EL(o, 26, 15, 6, 2, shade(c, 1.22));
    }
    if (L.roots && st !== 'long') { /* roots shown on the long styles only */ }
  }

  /* ----- hair that falls over the shoulders (drawn after the clothes) ----- */
  function hairFallP(o, L) {
    var st = L.style, hf = hairFn(L), c = L.hair, y, i;
    if (st === 'long' || st === 'wavy' || st === 'curlylong') {
      for (i = 0; i < 2; i++) {
        var x0 = i ? 45 : 12;
        if (st === 'wavy') { for (y = 34; y < 62; y += 4) { EL(o, x0 + 3.5 + ((y / 4) % 2 ? 1 : -1), y + 2, 4.5, 3.4, hf); } }
        else if (st === 'curlylong') { for (y = 34; y < 64; y += 5) { EL(o, x0 + 3.5 + ((y / 5) % 2 ? 1.2 : -0.5), y + 2, 5.3, 4.2, hf); } }
        else { R(o, x0, 34, 8, 30, c); R(o, x0 + 1, 36, 1, 20, shade(c, 1.3)); R(o, x0 + 5, 40, 1, 20, shade(c, 0.8)); }
      }
    } else if (st === 'braids') {
      for (i = 0; i < 2; i++) {
        for (y = 38; y < 60; y += 4) { EL(o, i ? 46 : 18, y + 2, 3.4, 3, (y / 4) % 2 ? hf : shade(c, 1.2)); }
        EL(o, i ? 46 : 18, 61, 3, 2.5, L.tie || PAL.orange);
      }
    } else if (st === 'hijab') {
      var tt = c, s2 = shade(c, 0.78), h2 = shade(c, 1.18), x, w;
      for (y = 44; y < 64; y++) {
        w = 18 + (y - 44) * 1.35; if (w > 28) { w = 28; }
        for (x = Math.round(CX - w); x < Math.round(CX + w); x++) {
          if (Math.abs(x - CX) < 5 && y < 52) { continue; }
          PX(o, x, y, ((x + y * 2) % 9 === 0) ? s2 : (((x * 3 + y) % 13 === 0) ? h2 : tt));
        }
      }
      R(o, 22, 46, 20, 2, s2); R(o, 26, 50, 12, 1, s2);
      for (i = 0; i < 8; i++) { PX(o, 14 + i * 2, 52 + (i % 3) * 3, h2); PX(o, 38 + i * 2, 54 + (i % 3) * 3, s2); }
    }
  }

  /* ----- clothes and neck ----- */
  function torsoP(o, L) {
    var t = L.top, c = t.col, k = t.kind, sh = shade(c, 0.82), hi = shade(c, 1.15), c2 = t.col2, y, w, x, u, W, under = t.under;
    // neck
    R(o, 27, 40, 10, 10, L.skin); R(o, 34, 40, 3, 10, L.skinSh); EL(o, CX, 46, 9, 3.4, L.skinSh);
    // shoulders
    for (y = 47; y < 64; y++) {
      W = 9 + (y - 47) * 1.7; if (W > 27) { W = 27; }
      for (x = Math.round(CX - W); x < Math.round(CX + W); x++) {
        PX(o, x, y, x >= 42 ? sh : (x <= 22 && y < 52 ? hi : c));
      }
    }
    for (y = 52; y < 64; y += 3) { R(o, 12 + (y - 52), y, 3, 1, shade(c, 0.9)); R(o, 46 - (y - 52), y + 1, 3, 1, shade(c, 0.72)); }
    if (k === 'shirt') {
      for (y = 46; y < 56; y++) { w = 6 - (y - 46) * 0.62; if (w < 0) { w = 0; } R(o, Math.round(CX - w), y, Math.round(w * 2), 1, L.skin); }
      for (y = 46; y < 56; y++) { w = 6 - (y - 46) * 0.62; if (w < 0) { w = 0; } R(o, Math.round(CX - w) - 5, y, 5, 1, c2); R(o, Math.round(CX + w), y, 5, 1, shade(c2, 0.9)); }
      for (y = 46; y < 56; y++) { w = 6 - (y - 46) * 0.62; if (w < 0) { w = 0; } PX(o, Math.round(CX - w) - 5, y, shade(c2, 0.78)); PX(o, Math.round(CX + w) + 4, y, shade(c2, 0.7)); }
      R(o, 31, 56, 2, 8, shade(c, 0.88)); for (y = 58; y < 64; y += 4) { EL(o, CX, y, 1.4, 1.4, shade(c, 0.6)); }
      if (t.open) { R(o, 29, 47, 6, 8, L.skin); }
    } else if (k === 'tee') {
      EL(o, CX, 47, 8, 5, c2); EL(o, CX, 47, 6.5, 4, L.skinSh); EL(o, CX, 46.4, 6.5, 3.4, L.skin);
    } else if (k === 'hoodie') {
      EL(o, CX, 50, 14, 6.5, shade(c, 0.78)); EL(o, CX, 49, 12, 5.2, shade(c, 0.92)); EL(o, CX, 48, 8, 4, L.skinSh); EL(o, CX, 47, 7.5, 3, L.skin);
      R(o, 26, 52, 2, 9, PAL.cream); R(o, 36, 52, 2, 8, PAL.cream); EL(o, 27, 62, 1.8, 1.8, shade(PAL.cream, 0.8)); EL(o, 37, 61, 1.8, 1.8, shade(PAL.cream, 0.8));
    } else if (k === 'jacket') {
      R(o, 27, 47, 10, 17, under || c2); R(o, 31, 47, 2, 17, shade(under || c2, 0.8));
      for (y = 49; y < 64; y += 3) { PX(o, 31, y, '#C9CDD2'); PX(o, 32, y + 1, '#9EA2AA'); }
      for (y = 46; y < 52; y++) { R(o, 20 + (y - 46), y, 8, 1, hi); R(o, 36 - (y - 46), y, 8, 1, shade(c, 1.05)); }
      R(o, 26, 47, 2, 17, shade(c, 0.7)); R(o, 36, 47, 2, 17, shade(c, 0.7));
      EL(o, CX, 46, 6.5, 3, L.skinSh);
    } else if (k === 'blazer') {
      for (y = 46; y < 64; y++) { w = 8 - (y - 46) * 0.3; R(o, Math.round(CX - w), y, Math.round(w * 2), 1, PAL.paper); }
      for (y = 46; y < 56; y++) { w = 5 - (y - 46) * 0.4; if (w < 0) { w = 0; } R(o, Math.round(CX - w), y, Math.round(w * 2), 1, L.skin); }
      for (y = 46; y < 64; y++) {
        u = 9 - (y - 46) * 0.32; R(o, Math.round(CX - u) - 5, y, 5, 1, shade(c, 1.45)); R(o, Math.round(CX + u), y, 5, 1, shade(c, 1.45));
        R(o, Math.round(CX - u) - 8, y, 3, 1, shade(c, 0.78)); R(o, Math.round(CX + u) + 5, y, 3, 1, shade(c, 0.72));
      }
      R(o, 39, 57, 5, 1, PAL.cream);
    } else if (k === 'dress') {
      for (y = 47; y < 64; y++) {
        W = 27; for (x = Math.round(CX - W); x < Math.round(CX + W); x++) { if (Math.abs(x - CX) > 12 + (y - 47) * 0.1) { PX(o, x, y, y < 52 ? L.skin : (x > CX ? L.skinSh : L.skin)); } }
      }
      for (y = 47; y < 64; y++) { w = 12 + (y - 47) * 0.1; R(o, Math.round(CX - w), y, Math.round(w * 2), 1, c); }
      EL(o, CX, 47, 10, 7, L.skin); EL(o, CX, 46, 10, 5.5, L.skinHi);
      R(o, 20, 47, 3, 17, c); R(o, 41, 47, 3, 17, sh); R(o, 20, 56, 24, 2, shade(c, 0.8)); EL(o, CX, 57, 1.6, 1.6, PAL.gold);
    } else if (k === 'coat') {
      EL(o, 22, 50, 8, 8, hi); EL(o, 42, 50, 8, 8, shade(c, 1.05)); R(o, 28, 49, 8, 15, under || c2); R(o, 28, 49, 1, 15, shade(c, 0.6)); R(o, 35, 49, 1, 15, shade(c, 0.6));
      for (y = 56; y < 64; y += 4) { EL(o, 24, y, 1.5, 1.5, PAL.gold); EL(o, 40, y, 1.5, 1.5, PAL.gold); }
    }
    if (t.vest && k !== 'coat') {
      for (y = 47; y < 64; y++) { w = 8 + (y - 47) * 0.35; R(o, 5, y, Math.round(CX - w - 5), 1, t.vest); R(o, Math.round(CX + w), y, Math.round(CX - w - 5), 1, shade(t.vest, 0.84)); }
      for (y = 47; y < 56; y++) { w = 8 + (y - 47) * 0.35; PX(o, Math.round(CX - w), y, shade(t.vest, 1.3)); PX(o, Math.round(CX + w) - 1, y, shade(t.vest, 1.2)); }
    }
    if (t.logo && (k === 'shirt' || k === 'tee') && !t.vest) { R(o, 41, 55, 5, 5, t.white ? PAL.paper : PAL.paper); R(o, 43, 55, 3, 3, PAL.orange); R(o, 41, 58, 2, 2, PAL.orange); }
    if (L.badge === 'pass') { R(o, 27, 47, 2, 8, PAL.cream); R(o, 35, 47, 2, 8, PAL.cream); R(o, 26, 55, 12, 8, PAL.cream); R(o, 26, 55, 12, 1, shade(PAL.cream, 0.8)); R(o, 28, 57, 4, 4, PAL.orange); R(o, 33, 58, 3, 1, PAL.slate); R(o, 33, 60, 3, 1, PAL.slate); }
    if (L.badge === 'padlock') { R(o, 40, 54, 8, 7, PAL.orange); R(o, 42, 51, 4, 4, '#9EA2AA'); R(o, 43, 52, 2, 3, PAL.orange); R(o, 43, 57, 2, 2, PAL.cream); R(o, 40, 54, 8, 1, shade(PAL.orange, 1.3)); }
    if (L.scarfOn) {
      var sc = L.scarf || PAL.orange;
      EL(o, CX, 49, 13, 6.5, shade(sc, 0.85)); EL(o, CX, 48, 12, 5.2, sc); EL(o, CX, 47, 7.5, 3.5, L.skinSh);
      R(o, 36, 52, 8, 12, sc); R(o, 36, 58, 8, 2, shade(sc, 0.8)); R(o, 37, 54, 1, 8, shade(sc, 1.2)); R(o, 20, 50, 3, 2, shade(sc, 1.15));
    }
    if (L.neckphones) {
      EL(o, CX, 46, 15, 7, '#9EA2AA'); EL(o, CX, 46, 12, 5, L.skin); R(o, 27, 40, 10, 6, L.skin); EL(o, CX, 46, 8, 3.2, L.skinSh);
      R(o, 14, 46, 7, 11, PAL.steel); R(o, 43, 46, 7, 11, PAL.steel); R(o, 14, 46, 7, 2, '#6B6E75'); R(o, 43, 46, 7, 2, '#6B6E75'); R(o, 14, 50, 2, 3, PAL.orange); R(o, 48, 50, 2, 3, PAL.orange);
    }
  }

  /* ----- face ----- */
  function headP(o, L) {
    var sh = L.skinSh, hi = L.skinHi;
    // ears
    EL(o, 18.5, 30, 2.6, 4.2, L.skin); EL(o, 45.5, 30, 2.6, 4.2, sh); PX(o, 18, 30, sh); PX(o, 18, 31, sh); PX(o, 45, 30, L.skinDk); PX(o, 45, 31, L.skinDk);
    EL(o, CX, 27, 14, 17, function (x, y) {
      if (x >= 41) { return sh; }
      if (y >= 42) { return sh; }
      if (x <= 23 && y > 19 && y < 31) { return hi; }
      return L.skin;
    });
    R(o, 29, 15, 6, 1, hi);
  }

  function irisCol(L) { return lum(L.eye) < 0.2 ? shade(L.eye, 2.1) : L.eye; }
  function eyeP(o, L, cx, expr, blink, side) {
    var dk = '#1F1A17', ic = irisCol(L), wy = 27, ox = 0, oy = 0, i, glassesSun = L.glasses && (L.glasses[0] === 'sun' || L.glasses[0] === 'avi');
    if (glassesSun) { return; }
    if (expr === 'happy') {
      R(o, cx - 3, 30, 2, 2, dk); R(o, cx - 2, 28, 2, 2, dk); R(o, cx - 1, 27, 4, 2, dk); R(o, cx + 1, 28, 2, 2, dk); R(o, cx + 2, 30, 2, 2, dk);
      PX(o, cx - 1, 27, shade(dk, 1.6));
      return;
    }
    if (blink) { R(o, cx - 3, 30, 7, 2, dk); R(o, cx - 4, 29, 1, 1, dk); R(o, cx + 3, 29, 1, 1, dk); R(o, cx - 2, 32, 5, 1, L.skinSh); return; }
    if (expr === 'surprised') {
      EL(o, cx, 29, 4.2, 5, '#F4F4F2');
      R(o, cx - 3, 26, 7, 1, dk); R(o, cx - 4, 27, 1, 1, dk); R(o, cx + 3, 27, 1, 1, dk);
      EL(o, cx, 29, 2.2, 2.4, ic); EL(o, cx, 29, 1.2, 1.4, dk); PX(o, cx + 1, 28, '#FFFFFF');
      R(o, cx - 3, 32, 7, 1, shade(L.skin, 0.9));
      return;
    }
    if (expr === 'thinking') { ox = -1; oy = -1; }
    R(o, cx - 2, 28, 5, 4, '#F4F4F2'); R(o, cx - 3, 29, 1, 2, '#F4F4F2'); R(o, cx + 3, 29, 1, 2, '#F4F4F2');
    R(o, cx - 2, 28, 5, 1, shade('#F4F4F2', 0.8));
    R(o, cx - 1 + ox, 28 + oy + 1, 3, 3, ic); R(o, cx + ox, 29 + oy + 1, 2, 2, dk); PX(o, cx + 1 + ox, 29 + oy, '#FFFFFF');
    R(o, cx - 3, 27, 7, 1, dk); R(o, cx - 4, 28, 1, 1, dk); R(o, cx + 4, 28, 1, 1, dk); PX(o, cx - 3, 28, dk);
    PX(o, cx - 2, 32, L.skinSh); PX(o, cx + 2, 32, L.skinSh);
  }
  function browP(o, L, cx, expr, side) {
    var b = L.brow, y = 22, i, dy;
    if (L.glasses && (L.glasses[0] === 'rect' || L.glasses[0] === 'tort') && expr === 'neutral') { y = 22; }
    if (expr === 'happy') {
      R(o, cx - 3, y - 1, 7, 2, b); R(o, cx - 4, y, 1, 1, b); PX(o, cx + 4, y + 1, b);
    } else if (expr === 'surprised') {
      R(o, cx - 3, y - 4, 7, 2, b); R(o, cx - 4, y - 3, 1, 2, b); R(o, cx + 4, y - 3, 1, 2, b);
    } else if (expr === 'thinking') {
      if (side === 0) { R(o, cx - 3, y + 1, 7, 2, b); PX(o, cx + 4, y, b); }
      else { R(o, cx - 3, y - 2, 7, 2, b); R(o, cx - 4, y - 1, 1, 2, b); R(o, cx + 3, y - 3, 1, 1, b); }
    } else {
      R(o, cx - 3, y, 7, 2, b); R(o, cx - 4, y + 1, 1, 1, b); PX(o, cx + 4, y, b);
    }
  }
  function mouthP(o, L, expr, open) {
    var m = L.mouth, lp = L.lip, dk = '#5A2A28', full = L.beard && L.beard[0] === 'full', y, w, tc = '#C9605A';
    if (expr === 'happy') {
      var rows = open === 0 ? 3 : (open === 1 ? 4 : 5), W0 = open === 2 ? 12 : 10;
      R(o, 32 - W0 / 2, 37, W0, 1, dk);
      R(o, 32 - W0 / 2 + 1, 38, W0 - 2, 1, '#F6F2EA');
      for (y = 0; y < rows - 1; y++) { w = W0 - 2 - y * 2; if (w < 2) { w = 2; } R(o, 32 - w / 2, 39 + y, w, 1, dk); }
      if (rows > 3) { R(o, 30, 39 + rows - 2, 4, 1, tc); }
      R(o, 32 - W0 / 2 - 1, 36, 1, 1, dk); R(o, 32 + W0 / 2, 36, 1, 1, dk);
      PX(o, 32 - W0 / 2 - 2, 35, L.skinSh); PX(o, 32 + W0 / 2 + 1, 35, L.skinSh);
      return;
    }
    if (expr === 'surprised') {
      var ry = open === 0 ? 2.5 : (open === 1 ? 3.5 : 4.5);
      EL(o, CX, 40, 4.6, ry + 1, lp); EL(o, CX, 40, 3.4, ry, dk); if (ry > 3) { EL(o, CX, 42, 2, 1, tc); }
      return;
    }
    if (open > 0) {
      var hh = open === 1 ? 2 : 4;
      R(o, 28, 38, 9, 1, lp); EL(o, CX, 39 + hh / 2, 4, hh / 2 + 1, dk); R(o, 29, 38, 7, 1, '#F1ECE2');
      if (hh > 2) { R(o, 30, 41, 4, 1, tc); }
      if (expr === 'thinking') { PX(o, 36, 38, L.skinSh); }
      return;
    }
    if (expr === 'thinking') {
      R(o, 29, 39, 6, 1, m); R(o, 35, 38, 2, 1, m); R(o, 30, 40, 4, 1, lp); PX(o, 28, 39, L.skinSh);
      return;
    }
    R(o, 29, 39, 7, 1, m); R(o, 28, 38, 1, 1, m); R(o, 36, 38, 1, 1, m); R(o, 30, 40, 5, 1, lp); PX(o, 27, 37, L.skinSh); PX(o, 37, 37, L.skinSh);
  }

  function faceP(o, L, expr, blink, open) {
    var i;
    // blush and nose
    if (!(L.beard && L.beard[0] === 'full')) { EL(o, 22.5, 35, 2.5, 1.6, L.blush); EL(o, 41.5, 35, 2.5, 1.6, L.blush); }
    if (expr === 'happy') { EL(o, 22.5, 34.5, 3, 2, L.blush); EL(o, 41.5, 34.5, 3, 2, L.blush); }
    R(o, 31, 31, 1, 4, L.skinHi); R(o, 33, 33, 2, 3, L.skinSh); R(o, 31, 35, 4, 1, shade(L.skin, 0.72)); R(o, 32, 36, 2, 1, L.skinSh);
    eyeP(o, L, 26, expr, blink, 0); eyeP(o, L, 38, expr, blink, 1);
    browP(o, L, 26, expr, 0); browP(o, L, 38, expr, 1);
    if (L.beard) {
      var bc = L.beard[1], kind = L.beard[0], y, e, st = mix(L.skin, bc, 0.38), x;
      for (y = 33; y <= 46; y++) {
        e = headEdge(y); if (!e) { continue; }
        for (x = e[0]; x <= e[1]; x++) {
          if (kind === 'stubble') {
            if (y >= 36 && rnd(x, y) < 34 && (Math.abs(x - 32) > 4 || y > 38)) { PX(o, x, y, rnd(y, x) < 30 ? shade(st, 0.88) : st); }
            else if (y < 36 && (x <= e[0] + 2 || x >= e[1] - 2)) { PX(o, x, y, st); }
          } else {
            if (y < 36) { if (x <= e[0] + 3 || x >= e[1] - 3) { PX(o, x, y, bc); } }
            else { PX(o, x, y, ((x * 7 + y * 3) % 8 === 0) ? shade(bc, 1.35) : (((x + y) % 6 === 0) ? shade(bc, 0.8) : bc)); }
          }
        }
      }
      if (kind === 'full') {
        if (L.beard[2] === 'mus') { R(o, 26, 35, 12, 3, bc); }
        R(o, 29, 37, 7, 5, bc);
      }
    }
    mouthP(o, L, expr, open);
    if (L.beard && L.beard[0] === 'full' && L.beard[2] !== 'mus') { R(o, 27, 36, 4, 2, L.beard[1]); R(o, 34, 36, 4, 2, L.beard[1]); }
    if (L.earrings) { EL(o, 18, 35, 1.4, 1.8, L.earrings); EL(o, 46, 35, 1.4, 1.8, L.earrings); }
    if (L.tat && false) { return; }
  }

  function hatP(o, L) {
    var c = L.hatCol, h = L.hat, sh, i;
    if (h === 'chef') {
      EL(o, 23, 12, 8, 7, '#FFFFFF'); EL(o, 32, 8, 10, 8, '#FFFFFF'); EL(o, 41, 12, 8, 7, '#FFFFFF');
      R(o, 19, 14, 26, 8, '#F3F5FA'); R(o, 19, 20, 26, 2, '#DADDE3'); R(o, 18, 21, 28, 2, '#CFD3DA');
      for (i = 0; i < 4; i++) { R(o, 24 + i * 5, 6 + (i % 2) * 3, 1, 10, '#E6E8EE'); }
      EL(o, 28, 6, 3, 2, '#FFFFFF');
    } else if (h === 'cap') {
      sh = shade(c, 0.78);
      EL(o, CX, 22, 16.5, 14, function (x, y) { return y < 23 ? ((x < 26 && y < 14) ? shade(c, 1.2) : c) : null; });
      R(o, 15, 20, 34, 3, sh); R(o, 22, 23, 28, 4, shade(c, 0.7)); R(o, 22, 23, 28, 1, shade(c, 0.9)); EL(o, CX, 8, 1.6, 1.6, shade(c, 0.7));
      R(o, 24, 12, 10, 1, shade(c, 1.35));
    } else if (h === 'beanie') {
      sh = shade(c, 0.8);
      EL(o, CX, 23, 16.5, 15, function (x, y) { return y < 24 ? (((x + y) % 4 === 0) ? sh : c) : null; });
      R(o, 15, 19, 34, 6, shade(c, 0.88)); for (i = 0; i < 17; i++) { R(o, 16 + i * 2, 19, 1, 6, shade(c, 0.72)); } EL(o, CX, 8, 4, 3, shade(c, 1.25));
    }
    if (L.headphones || L.headset) {
      var st = L.headphones ? '#2E2F33' : '#9EA2AA', cup = L.headphones ? PAL.orange : PAL.steel, top = L.hat ? 6 : 8;
      var yy, a, x, y;
      for (a = Math.PI * 1.02; a < Math.PI * 1.98; a += 0.02) { x = Math.round(CX + 17 * Math.cos(a)); y = Math.round(top + 19 + 17.5 * Math.sin(a)); R(o, x, y, 2, 2, st); }
      R(o, 12, 24, 6, 13, cup); R(o, 46, 24, 6, 13, cup); R(o, 12, 24, 6, 2, shade(cup, 1.3)); R(o, 46, 24, 6, 2, shade(cup, 1.3)); R(o, 12, 35, 6, 2, shade(cup, 0.7)); R(o, 46, 35, 6, 2, shade(cup, 0.7));
      if (L.headset) { R(o, 14, 37, 2, 4, PAL.steel); R(o, 15, 40, 11, 2, PAL.steel); EL(o, 27, 41, 2.4, 2, PAL.orange); }
    }
  }

  function glassesP(o, L) {
    var g = L.glasses, gt, gc, i, cx, W = ['#000'], x0;
    if (!g) { return; }
    gt = g[0]; gc = g[1];
    function lens(cx, kind) {
      var y;
      if (kind === 'rect' || kind === 'tort') {
        R(o, cx - 6, 25, 13, 1, gc); R(o, cx - 6, 33, 13, 1, gc); R(o, cx - 6, 25, 1, 9, gc); R(o, cx + 6, 25, 1, 9, gc);
        o.g.globalAlpha = 0.16; R(o, cx - 5, 26, 11, 7, '#FFFFFF'); o.g.globalAlpha = 1;
        R(o, cx + 2, 27, 1, 2, '#FFFFFF'); PX(o, cx + 3, 28, '#FFFFFF');
        if (kind === 'tort') { R(o, cx - 6, 25, 5, 1, shade(gc, 1.6)); R(o, cx + 3, 33, 4, 1, shade(gc, 1.4)); R(o, cx - 6, 30, 1, 3, shade(gc, 1.3)); R(o, cx - 6, 24, 13, 1, shade(gc, 0.85)); }
      } else if (kind === 'round') {
        EL(o, cx, 29, 6.6, 5.8, function (x, y) { var u = (x + 0.5 - cx) / 5.6, v = (y + 0.5 - 29) / 4.8; return (u * u + v * v < 1) ? null : gc; });
        o.g.globalAlpha = 0.16; EL(o, cx, 29, 5.4, 4.6, '#FFFFFF'); o.g.globalAlpha = 1;
        R(o, cx + 2, 27, 1, 2, '#FFFFFF');
      } else if (kind === 'sun') {
        R(o, cx - 6, 25, 13, 9, gc); R(o, cx - 6, 24, 13, 1, shade(gc, 0.8)); R(o, cx - 5, 26, 3, 1, shade(gc, 1.7)); R(o, cx - 4, 27, 2, 1, shade(gc, 1.7)); R(o, cx + 3, 31, 3, 1, shade(gc, 0.75));
      } else if (kind === 'avi') {
        for (y = 25; y < 35; y++) { var w = y < 31 ? 6.5 : 6.5 - (y - 30) * 0.9; R(o, Math.round(cx - w), y, Math.round(w * 2), 1, gc); }
        R(o, cx - 7, 24, 15, 2, '#D8B04A'); R(o, cx - 5, 27, 3, 1, shade(gc, 1.5)); R(o, cx - 4, 28, 2, 1, shade(gc, 1.5));
      }
    }
    lens(26, gt); lens(38, gt);
    R(o, 32, 27, 0, 0, gc);
    R(o, 31, 27, 2, 2, gt === 'sun' || gt === 'avi' ? '#DDDDDD' : gc);
    R(o, 18, 27, 3, 2, gt === 'sun' ? '#DDDDDD' : (gt === 'avi' ? '#D8B04A' : gc)); R(o, 44, 27, 3, 2, gt === 'sun' ? '#DDDDDD' : (gt === 'avi' ? '#D8B04A' : gc));
  }

  function bustCanvas(L, expr, blink, open) {
    var o = mk(64, 64);
    hairBackP(o, L);
    torsoP(o, L);
    headP(o, L);
    faceP(o, L, expr, blink, open);
    hairFrontP(o, L);
    hairFallP(o, L);
    hatP(o, L);
    glassesP(o, L);
    outline(o, PAL.outline);
    return o.c;
  }
  var EXPRS = { neutral: 1, happy: 1, surprised: 1, thinking: 1 };
  var ports = {};
  function portKey(k, expr, blink, open, vk) { return k + '|' + vk + '|' + expr + (blink ? 'b' : '') + open; }
  function portCanvas(cacheKey, L, expr, blink, open) {
    var c = ports[cacheKey];
    if (c) { return c; }
    c = bustCanvas(L, expr, blink, open);
    ports[cacheKey] = c;
    return c;
  }
  function putPort(ctx, c, x, y, s) {
    var prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, Math.round(x), Math.round(y), 64 * s, 64 * s);
    ctx.imageSmoothingEnabled = prev;
  }
  function portrait(ctx, id, x, y, scale, expr) {
    var L = LOOK[id], vk = variantFor(), e = EXPRS[expr] ? expr : 'neutral';
    if (!L) { return false; }
    putPort(ctx, portCanvas(portKey(id, e, false, 0, vk), variantLook(L, vk, id), e, false, 0), x, y, scale || 1);
    return true;
  }
  function talkState(t, talking, expr, seedKey) {
    var tt = t + phase(seedKey) * 0.37, blink = (tt % 3.6) < 0.13, open = 0, m;
    if (talking !== false) {
      m = Math.sin(tt * 15.3) + Math.sin(tt * 6.1 + 1.2);
      open = m > 0.9 ? 2 : (m > -0.4 ? 1 : 0);
    }
    if (reduced && talking !== false) { open = (Math.floor(tt * 4) % 2) ? 1 : 0; }
    return { blink: blink, open: open };
  }
  function portraitAt(ctx, id, x, y, scale, expr, t, talking) {
    var L = LOOK[id], vk = variantFor(), e = EXPRS[expr] ? expr : 'neutral', st;
    if (!L) { return false; }
    st = talkState(typeof t === 'number' ? t : Date.now() / 1000, talking, e, id);
    putPort(ctx, portCanvas(portKey(id, e, st.blink, st.open, vk), variantLook(L, vk, id), e, st.blink, st.open), x, y, scale || 1);
    return true;
  }
  function portraitLook(ctx, look, x, y, scale, expr, t, talking) {
    var L = fromLook(look), vk = variantFor(), e = EXPRS[expr] ? expr : 'neutral', lk = lookKey(look), st = { blink: false, open: 0 };
    if (typeof t === 'number') { st = talkState(t, talking, e, lk); }
    putPort(ctx, portCanvas(portKey('L' + lk, e, st.blink, st.open, vk), variantLook(L, vk, 'L' + lk), e, st.blink, st.open), x, y, scale || 1);
    return true;
  }

  /* =====================================================================================
     Emotes: speech-bubble icons above a head (16x16 art, tail at the bottom centre)
     ===================================================================================== */
  var SKINTONE = '#F1C27D', SKD = '#C98F4A';
  var ICONS = {
    hi: { rows: ['..s.s.s..', '..s.s.s.s', '..s.s.s.s', '.ssssssss', '.ssssssss', '.sssssssd', '..ssssssd', '...sssdd.', '....ddd..'], pal: { s: SKINTONE, d: SKD } },
    heart: { rows: ['.........', '.rrr.rrr.', 'rrRRrrrrr', 'rRRrrrrrr', 'rrrrrrrrr', '.rrrrrrr.', '..rrrrr..', '...rrr...', '....r....'], pal: { r: '#E5483A', R: '#FFA395' } },
    idea: { rows: ['..yyyyy..', '.yyYYyyy.', '.yYyyyyy.', '.yyyyyyy.', '..yyyyy..', '...ggg...', '...kkk...', '....k....', '.........'], pal: { y: '#F0B429', Y: '#FFE48A', g: '#9EA2AA', k: '#414347' } },
    coffee: { rows: ['..s..s...', '...s..s..', '.........', 'wwwwwww..', 'wbbbbbwww', 'wbbbbbw.w', 'wbbbbbwww', '.wbbbbw..', '..wwww...'], pal: { w: '#F6EEDC', b: '#8A5A3B', s: '#B8BCC4' } },
    music: { rows: ['...kkkkk.', '...kkkkk.', '...k...k.', '...k...k.', '...k...k.', '.kkk.kkk.', 'kkkk.kkkk', '.kk...kk.', '.........'], pal: { k: '#EA5E14' } },
    laugh: { rows: ['..yyyyy..', '.yyyyyyy.', 'ykkyyykky', 'yyyyyyyyy', 'ykkkkkkky', 'yykwwwkyy', '.yykkkyy.', '..yyyyy..', '.........'], pal: { y: '#F0B429', k: '#414347', w: '#FFFFFF' } },
    surprise: { rows: ['...ooo...', '...ooo...', '...ooo...', '...ooo...', '...ooo...', '.........', '...ooo...', '...ooo...', '.........'], pal: { o: '#EA5E14' } },
    question: { rows: ['..jjjjj..', '.jjjjjjj.', '.jj...jj.', '......jj.', '....jjj..', '...jj....', '.........', '...jj....', '.........'], pal: { j: '#2F6F65' } },
    zzz: { rows: ['....zzzz.', '.....zz..', '....zzzz.', '.........', '.zzzz....', '..zz.....', '.zzzz....', '.........', '.........'], pal: { z: '#3B6EA8' } },
    work: { rows: ['...ooo...', '.o.ooo.o.', '..ooooo..', 'ooo...ooo', 'ooo...ooo', 'ooo...ooo', '..ooooo..', '.o.ooo.o.', '...ooo...'], pal: { o: '#5D5F65' } },
    k13: { rows: ['.........', '.w..www..', 'ww....w..', '.w..www..', '.w....w..', 'www.www..', '.........', '.........', '.........'], pal: { w: '#F3F5FA' } }
  };
  var EMOTE_KINDS = ['hi', 'heart', 'idea', 'coffee', 'music', 'laugh', 'surprise', 'question', 'zzz', 'work', 'k13'];
  var emoteCache = {};
  function emoteCanvas(kind) {
    var c = emoteCache[kind], ic, o, fill;
    if (c) { return c; }
    ic = ICONS[kind] || ICONS.question;
    o = mk(16, 16);
    fill = (kind === 'k13') ? '#EA5E14' : '#FBF8F0';
    R(o, 2, 1, 12, 11, fill); R(o, 1, 2, 14, 9, fill);
    R(o, 7, 12, 2, 1, fill); PX(o, 7, 13, fill);
    R(o, 2, 11, 12, 1, shade(fill, 0.9)); PX(o, 14, 10, shade(fill, 0.9));
    BM(o, 3, 2, ic.rows, ic.pal, false);
    if (kind === 'k13') { R(o, 6, 3, 1, 1, null); }
    outline(o, PAL.outline);
    emoteCache[kind] = o.c;
    return o.c;
  }
  function emote(ctx, kind, x, y, scale, t) {
    var c = emoteCanvas(kind), s = scale || 1, k = 1, w, h, prev;
    if (!reduced && typeof t === 'number' && t < 1) { k = (t < 0.6) ? 0.3 + 0.95 * (Math.max(0, t) / 0.6) : 1.25 - 0.25 * ((t - 0.6) / 0.4); }
    w = 16 * s * k; h = 16 * s * k;
    prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, Math.round(x - w / 2), Math.round(y - h), Math.round(w), Math.round(h));
    ctx.imageSmoothingEnabled = prev;
    return true;
  }

  /* =====================================================================================
     Pixel, the studio cat: 16x16, poses walk | sit | sleep | stretch
     ===================================================================================== */
  var CAT = { fur: '#E08A3C', dk: '#B94612', lt: '#F2B572', cr: '#F6EEDC', nose: '#E58A8A', eye: '#2E5F59', collar: '#2F6F65', tag: '#F0B429' };
  var PET_FRAMES = { walk: 4, sit: 2, sleep: 2, stretch: 2 };

  function catSideWalk(o, f) {
    var off = [-1, 0, 1, 0][f], lift = [0, 1, 0, 0], lift2 = [0, 0, 0, 1];
    // legs (far pair darker)
    R(o, 3 + off, 11, 1, 3 - lift2[f], CAT.dk); R(o, 9 - off, 11, 1, 3 - lift[f], CAT.dk);
    R(o, 5 - off, 11, 2, 3 - lift[f], CAT.fur); R(o, 10 + off, 11, 2, 3 - lift2[f], CAT.fur);
    R(o, 5 - off, 13 - lift[f], 2, 1, CAT.cr); R(o, 10 + off, 13 - lift2[f], 2, 1, CAT.cr);
    // tail
    R(o, 2, 6, 1, 1, CAT.fur); R(o, 1, 5, 1, 1, CAT.fur);
    if (f % 2 === 0) { R(o, 1, 2, 1, 4, CAT.fur); PX(o, 1, 2, CAT.dk); R(o, 1, 4, 1, 1, CAT.dk); } else { R(o, 0, 3, 1, 3, CAT.fur); PX(o, 0, 3, CAT.dk); PX(o, 1, 5, CAT.fur); }
    // body
    R(o, 3, 6, 9, 5, CAT.fur); R(o, 4, 6, 7, 1, CAT.lt); R(o, 4, 10, 7, 1, CAT.cr);
    R(o, 5, 7, 1, 2, CAT.dk); R(o, 7, 7, 1, 3, CAT.dk); R(o, 9, 7, 1, 2, CAT.dk); PX(o, 3, 6, null);
    // head
    R(o, 10, 3, 5, 5, CAT.fur); R(o, 10, 2, 1, 1, CAT.fur); R(o, 13, 2, 1, 1, CAT.fur); PX(o, 14, 2, null); PX(o, 11, 3, CAT.lt);
    R(o, 13, 6, 2, 2, CAT.cr); PX(o, 14, 6, CAT.nose); PX(o, 13, 4, CAT.eye); PX(o, 12, 4, CAT.fur);
    R(o, 9, 7, 2, 1, CAT.collar); PX(o, 10, 8, CAT.tag);
  }
  function catFront(o, f, back) {
    var lt = [1, 0, 0, 0][f], rt = [0, 0, 1, 0][f];
    R(o, 5, 12, 2, 2 - lt, CAT.fur); R(o, 9, 12, 2, 2 - rt, CAT.fur); R(o, 5, 13 - lt, 2, 1, CAT.cr); R(o, 9, 13 - rt, 2, 1, CAT.cr);
    R(o, 4, 8, 8, 4, CAT.fur); R(o, 5, 8, 6, 1, CAT.lt);
    if (back) {
      R(o, 5, 3, 6, 5, CAT.fur); R(o, 5, 2, 1, 1, CAT.fur); R(o, 10, 2, 1, 1, CAT.fur); R(o, 6, 4, 4, 1, CAT.dk);
      R(o, 7, 8, 2, 4, CAT.dk); R(o, 11, 6, 2, 1, CAT.fur); R(o, 12, 4, 1, 3, CAT.fur); PX(o, 12, 3, CAT.dk);
      R(o, 5, 8, 1, 3, CAT.dk); R(o, 10, 8, 1, 3, CAT.dk);
    } else {
      R(o, 6, 8, 4, 3, CAT.cr); R(o, 5, 3, 6, 5, CAT.fur); R(o, 5, 2, 1, 1, CAT.fur); R(o, 10, 2, 1, 1, CAT.fur); PX(o, 6, 3, CAT.lt);
      PX(o, 6, 5, CAT.eye); PX(o, 9, 5, CAT.eye); R(o, 7, 6, 2, 1, CAT.nose); R(o, 7, 7, 2, 1, CAT.cr); R(o, 6, 7, 1, 1, CAT.cr); R(o, 9, 7, 1, 1, CAT.cr);
      R(o, 6, 8, 4, 1, CAT.collar); PX(o, 8, 9, CAT.tag); R(o, 7, 3, 2, 1, CAT.dk); PX(o, 5, 4, CAT.dk); PX(o, 10, 4, CAT.dk);
    }
  }
  function catSitSide(o, f) {
    R(o, 3, 9, 6, 5, CAT.fur); R(o, 4, 9, 4, 1, CAT.lt); R(o, 8, 7, 4, 7, CAT.fur); R(o, 11, 10, 1, 4, CAT.cr); R(o, 10, 13, 2, 1, CAT.cr);
    R(o, 8, 3, 5, 5, CAT.fur); R(o, 8, 2, 1, 1, CAT.fur); R(o, 11, 2, 1, 1, CAT.fur); R(o, 11, 6, 2, 2, CAT.cr); PX(o, 12, 6, CAT.nose); PX(o, 11, 4, CAT.eye); PX(o, 9, 3, CAT.lt);
    R(o, 8, 8, 3, 1, CAT.collar); PX(o, 10, 9, CAT.tag); R(o, 5, 10, 1, 2, CAT.dk); R(o, 7, 10, 1, 2, CAT.dk);
    if (f === 0) { R(o, 1, 13, 3, 1, CAT.fur); R(o, 0, 12, 1, 2, CAT.fur); PX(o, 0, 12, CAT.dk); } else { R(o, 1, 13, 3, 1, CAT.fur); R(o, 1, 11, 1, 2, CAT.fur); PX(o, 1, 11, CAT.dk); }
  }
  function catSleep(o, f) {
    var top = f === 0 ? 8 : 7;
    R(o, 2, top, 12, 13 - top, CAT.fur); R(o, 3, top, 10, 1, CAT.lt);
    PX(o, 2, top, null); PX(o, 13, top, null); PX(o, 2, 12, null); PX(o, 13, 12, null);
    R(o, 5, top + 1, 1, 3, CAT.dk); R(o, 7, top + 1, 1, 4, CAT.dk); R(o, 9, top + 1, 1, 3, CAT.dk);
    R(o, 2, 11, 7, 2, CAT.cr); R(o, 2, 12, 2, 1, CAT.dk);
    R(o, 9, 9, 5, 4, CAT.fur); R(o, 10, 8, 1, 1, CAT.fur); R(o, 13, 8, 1, 1, CAT.fur); R(o, 12, 11, 2, 2, CAT.cr); PX(o, 13, 11, CAT.nose);
    R(o, 11, 10, 2, 1, CAT.eye); R(o, 9, 9, 1, 3, CAT.collar);
  }
  function catStretch(o, f) {
    var up = f === 0 ? 0 : 1;
    R(o, 2, 5 + up, 4, 4, CAT.fur); R(o, 5, 7, 5, 3, CAT.fur); R(o, 8, 9, 4, 3, CAT.fur); R(o, 3, 5 + up, 3, 1, CAT.lt);
    R(o, 2, 9, 1, 4, CAT.dk); R(o, 4, 9, 1, 4, CAT.fur); R(o, 2, 13, 3, 1, CAT.cr);
    R(o, 1, 2 + up, 1, 4, CAT.fur); PX(o, 1, 2 + up, CAT.dk);
    R(o, 10, 12, 5, 1, CAT.cr); R(o, 10, 11, 4, 1, CAT.fur);
    R(o, 11, 9, 4, 4, CAT.fur); R(o, 11, 8, 1, 1, CAT.fur); R(o, 14, 8, 1, 1, CAT.fur); R(o, 13, 11, 2, 2, CAT.cr); PX(o, 14, 11, CAT.nose); R(o, 12, 10, 2, 1, CAT.eye);
    R(o, 6, 8, 1, 2, CAT.dk); R(o, 8, 8, 1, 2, CAT.dk); R(o, 10, 9, 1, 2, CAT.collar);
  }
  var petCache = {};
  function petCanvas(pose, dir, f) {
    var key = pose + '|' + dir + '|' + f, o, m;
    if (petCache[key]) { return petCache[key]; }
    if (dir === 'left') {
      m = petCanvas(pose, 'right', f);
      o = mk(16, 16); o.g.translate(16, 0); o.g.scale(-1, 1); o.g.drawImage(m, 0, 0);
      petCache[key] = o.c; return o.c;
    }
    o = mk(16, 16);
    if (pose === 'sleep') { catSleep(o, f); }
    else if (pose === 'stretch') { catStretch(o, f); }
    else if (pose === 'sit') {
      if (dir === 'down') {
        R(o, 4, 7, 8, 7, CAT.fur); R(o, 6, 8, 4, 5, CAT.cr); R(o, 5, 12, 2, 2, CAT.cr); R(o, 9, 12, 2, 2, CAT.cr); R(o, 5, 2, 6, 5, CAT.fur); R(o, 5, 1, 1, 1, CAT.fur); R(o, 10, 1, 1, 1, CAT.fur);
        if (f === 1) { R(o, 6, 4, 1, 1, CAT.dk); R(o, 9, 4, 1, 1, CAT.dk); } else { PX(o, 6, 4, CAT.eye); PX(o, 9, 4, CAT.eye); PX(o, 6, 3, CAT.fur); }
        R(o, 7, 5, 2, 1, CAT.nose); R(o, 7, 6, 2, 1, CAT.cr); R(o, 6, 7, 4, 1, CAT.collar); PX(o, 8, 8, CAT.tag); R(o, 7, 2, 2, 1, CAT.dk); R(o, 12, 11, 2, 3, CAT.fur); PX(o, 13, 11, CAT.dk); R(o, 4, 7, 1, 4, CAT.dk);
      } else if (dir === 'up') {
        R(o, 4, 7, 8, 7, CAT.fur); R(o, 5, 2, 6, 5, CAT.fur); R(o, 5, 1, 1, 1, CAT.fur); R(o, 10, 1, 1, 1, CAT.fur); R(o, 6, 3, 4, 1, CAT.dk); R(o, 7, 8, 2, 5, CAT.dk);
        R(o, 5, 8, 1, 4, CAT.dk); R(o, 10, 8, 1, 4, CAT.dk); R(o, 12, 11, 2, 3, CAT.fur); R(o, 12, 9, 1, 3, CAT.fur); PX(o, 12, 9, CAT.dk);
      } else { catSitSide(o, f); }
    } else {
      if (dir === 'down') { catFront(o, f, false); } else if (dir === 'up') { catFront(o, f, true); } else { catSideWalk(o, f); }
    }
    outline(o, PAL.outline);
    petCache[key] = o.c;
    return o.c;
  }
  function drawPet(ctx, dir, frame, x, y, scale, pose) {
    var p = PET_FRAMES[pose] ? pose : 'walk', n = PET_FRAMES[p], f = ((Math.floor(frame || 0) % n) + n) % n, prev, s = scale || 1;
    if (dir !== 'down' && dir !== 'up' && dir !== 'left' && dir !== 'right') { dir = 'right'; }
    if (p === 'sit' && !reduced && f === 1 && (Date.now() % 4000) > 300) { f = 0; }
    prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(petCanvas(p, dir, f), Math.round(x), Math.round(y), 16 * s, 16 * s);
    ctx.imageSmoothingEnabled = prev;
    return true;
  }

  /* ---------- a soft ground shadow (x = centre, y = the ground line under the feet) ---------- */
  function shadow(ctx, x, y, scale, w) {
    var s = scale || 1, ww = (w || 11) * s, prev = ctx.globalAlpha, cx = Math.round(x), yy = Math.round(y);
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.10;
    ctx.fillRect(Math.round(cx - ww * 0.42), yy - 3 * s, Math.round(ww * 0.84), s);
    ctx.fillRect(Math.round(cx - ww * 0.5), yy - 2 * s, Math.round(ww), s);
    ctx.fillRect(Math.round(cx - ww * 0.42), yy - s, Math.round(ww * 0.84), s);
    ctx.globalAlpha = 0.13;
    ctx.fillRect(Math.round(cx - ww * 0.32), yy - 2 * s, Math.round(ww * 0.64), s);
    ctx.fillRect(Math.round(cx - ww * 0.4), yy - 2 * s, Math.round(ww * 0.8), s);
    ctx.globalAlpha = prev;
  }

  function prewarm(ids) {
    var i, a = ids || list, vk = variantFor();
    for (i = 0; i < a.length; i++) { sheetFor(a[i].id || a[i], vk); }
    for (i = 0; i < EMOTE_KINDS.length; i++) { emoteCanvas(EMOTE_KINDS[i]); }
    petCanvas('walk', 'right', 0);
  }
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
    list: list, byId: byId, palette: PAL,
    size: { w: 16, h: 32, portrait: 64, pet: 16 },
    frames: { walk: 8, idle: 8 },
    anchor: { cx: 8, head: 1, feet: 31 },
    draw: draw, setContext: setContext, outfit: outfit,
    emote: emote, emotes: EMOTE_KINDS,
    portrait: portrait, portraitAt: portraitAt,
    parts: parts, defaultLook: defaultLook, randomLook: randomLook, drawLook: drawLook, portraitLook: portraitLook,
    pet: { id: 'pixel', name: 'Pixel', kind: 'cat' }, drawPet: drawPet, petFrames: PET_FRAMES,
    shadow: shadow, lines: lines, prewarm: prewarm
  };
})();
