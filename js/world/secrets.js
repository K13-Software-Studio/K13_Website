/* js/world/secrets.js  -  K13 Workbench World: the 13 secrets, every look-at line, the keypad, the finale
   Owner: decor builder. Plain ES5, no libraries, no console output. Works in a browser and in Node.

   STATE  (the engine keeps ONE object and persists it as JSON in localStorage "k13_world"; every function below
   reads and MUTATES it, the engine only has to save it afterwards)
     state.found   { secretId: true }      secrets found
     state.seen    { objectId: true }      objects looked at (the chain needs this)
     state.talked  { personId: true }      people talked to
     state.flags   { token: true, ... }    things taken
     state.played  number                  how many times a cabinet was opened
     state.night   boolean (optional)      true when <html data-theme="dark">; read from the document when absent
     state.input   undefined | null | str  keypad protocol, see below
   All of them are created on demand, so an empty {} is a valid state.

   CALL PROTOCOL
     onInteract(objId, state)  -> { say, found?, title?, give?, prompt?, reveal?, open?, denied? }
        Call it for EVERY interaction (cabinets and benches too, BEFORE opening the modal: it counts plays and
        its say is a nice toast). Always returns a say. When a secret is found now: found = secret id and
        title = its name (toast "Secret 3/13: The poster's promise"). Found is only present the first time.
        give: the engine may show "You took: <give>". reveal:true (cab-secret) -> set obj.revealed = true on
        that object. open:'door-back' -> set obj.open = true on that object.
     KEYPAD (objId 'keypad'):
        1. engine calls onInteract('keypad', state) with state.input undefined.
           Reply: { prompt:'code', say, label:'Door code', maxLength:4, placeholder:'4 digits' }.
        2. engine shows a text input; on submit it sets state.input = '<typed text>' (on cancel: null) and calls
           onInteract('keypad', state) AGAIN. The reply is the normal {say, found?, denied?}. The function
           deletes state.input itself; the engine does not need to.
     onTalk(personId, state)   -> null | { say, found?, title? }   call when a dialogue opens; say is an extra
        line shown after the person's own lines (only 'natalia' returns one, the first time).
     hintFor(personId, state)  -> string | null   one extra line this person says when asked, pointing at an
        unfound secret; null when they have nothing to add (or the thing is found).
     finale(state)             -> { title, open:'door-back', lines:[{who,name,say}], cta } once count(state) is 13.
     count(state)              -> number of secrets found (0..13).
     list                      -> the 13 secrets {id, title, where, how, clue}.

   THE 13 (ids, where, how)  see `list` below. Chain: printer -> bench-miramar -> keypad -> hatch (token) ->
   cab-secret (needs the token and 8 other secrets). Natalia is found by talking. The radio only sings at night.
   The scoreboard only answers after a game was opened. No outside knowledge needed; no em dashes in any text. */
(function () {
  "use strict";
  var root = (typeof window !== "undefined") ? window : (typeof global !== "undefined" ? global : {});
  var K = root.K13World = root.K13World || {};
  var TOTAL = 13, CODE = "1938", NEED_FOR_16 = 8;

  var LIST = [
    { id: "guestbook", title: "Visitor 13", where: "guestbook", how: "look", clue: "Sign the guestbook." },
    { id: "fishtank", title: "Count the fish", where: "fishtank", how: "look", clue: "Count what swims in the lounge." },
    { id: "poster", title: "The poster's promise", where: "poster-13", how: "look", clue: "Read the poster to the torn corner." },
    { id: "neon", title: "The steady three", where: "neon-k13", how: "look", clue: "Watch the K13 sign for a while." },
    { id: "change", title: "Exact change", where: "change-machine", how: "use", clue: "Press the change machine." },
    { id: "couch", title: "Pocket 13", where: "couch", how: "look", clue: "People lose things in couches." },
    { id: "book", title: "The orange book", where: "bookshelf", how: "take", clue: "One spine does not match the rest." },
    { id: "radio", title: "Night shift", where: "radio", how: "use", clue: "The radio waits for dark." },
    { id: "whiteboard", title: "Four levels", where: "whiteboard", how: "look", clue: "Read the whiteboard to the bottom." },
    { id: "hatch", title: "The service hatch", where: "keypad", how: "code", clue: "Printer, then the Miramar bench, then the keypad." },
    { id: "score", title: "On the board", where: "scoreboard", how: "use", clue: "Play a machine, then check the board." },
    { id: "natalia", title: "Ask the one who counts", where: "natalia", how: "talk", clue: "Natalia counts everything." },
    { id: "sixteenth", title: "Machine 16", where: "cab-secret", how: "use", clue: "Eight secrets and a token wake the dusty machine." }
  ];
  var BY_ID = {}, i0;
  for (i0 = 0; i0 < LIST.length; i0++) { BY_ID[LIST[i0].id] = LIST[i0]; }

  function S(state) {
    state = state || {};
    if (!state.found) { state.found = {}; }
    if (!state.seen) { state.seen = {}; }
    if (!state.talked) { state.talked = {}; }
    if (!state.flags) { state.flags = {}; }
    if (typeof state.played !== "number") { state.played = 0; }
    return state;
  }
  function count(state) { var n = 0, k; S(state); for (k in state.found) { if (state.found.hasOwnProperty(k) && state.found[k] && BY_ID[k]) { n++; } } return n; }
  function countOthers(state, id) { return count(state) - (state.found[id] ? 1 : 0); }
  function isNight(state) {
    if (state && typeof state.night === "boolean") { return state.night; }
    try { return root.document.documentElement.getAttribute("data-theme") === "dark"; } catch (e) { return false; }
  }
  function found(state, id, say, extra) {
    var r = { say: say }, k;
    if (extra) { for (k in extra) { if (extra.hasOwnProperty(k)) { r[k] = extra[k]; } } }
    if (!state.found[id]) { state.found[id] = true; r.found = id; r.title = BY_ID[id].title; }
    return r;
  }

  /* ---------- every object's look-at line (K13's wry voice) ---------- */
  var CAB = {
    hardest13: "The Hardest Ship. One orange square, one road from I wish to It works, and bugs that do not negotiate.",
    platform13: "Ship Run. Jump the gaps, reach the flag. The flag is a deadline in disguise.",
    contra13: "Run & Ship. Keep moving, keep shooting, keep shipping. In that order.",
    race13: "Fast Track 13. Racing, K13 style: the finish line is always a launch date.",
    paper13: "Bin It. Paper, meet bin. Somebody has to throw out the old process.",
    dx13: "Debt Breaker. Break the bricks, break the debt. Technical debt, mostly.",
    rope13: "Cut the Scope. A rope, a sweet and a very sharp pair of scissors. Scope creep never saw it coming.",
    haxball13: "K13 Kickoff. Small pitch, big grudges, tiny discs.",
    duo13: "Design & Code. Two players, one build. The pairing every project needs.",
    bubble13: "Scope Pop. Pop the bubbles before the ceiling lands. Same rules as a real scope.",
    bloons13: "Pop 13. Thirteen is the lucky number here. The balloons disagree.",
    worms13: "Turf 13. Take the ground, hold the ground, try not to fall off the map.",
    goldminer13: "Gold Rush 13. Swing, hook, haul. The heavy ones are worth it.",
    volfied13: "Reveal 13. Claim the board one rectangle at a time. Tidy work.",
    heli13: "Deadline Run. Hold the button, stay in the air. Deadlines are like that."
  };
  var BENCH = {
    eggtoss: "Sunny Side Up, from Egg&Out. Crack the egg into the pan, then flick the pan to flip it. Flip, do not fling.",
    carlos: "Fire Palette, from Carlos Almaraz. Paint anything and the mirror turns it into a composition.",
    miramar: "Opening Night, from Miramar Food Hall. The marquee bulbs chase each other round the sign. Under them, in small print: EST. 1938.",
    tide: "Tide Line, from Lobster Lab. Drop traps, haul them before the lobsters back out. The crate holds thirteen.",
    egg: "Endless Spiral, from Egg&Out. Their wordmark, spun by hand.",
    cengo: "Night Shift Deck, from CENGO. Two decks, a fader and a record you may scratch. The sound is made on the spot.",
    stack: "Stack Attack, from Cosmos Burger. Eleven layers on the plate. Bump the table if you dare.",
    sandwich: "Bacon Rush, built to order, from Egg&Out. Every layer drops in order. The last one is the real thing.",
    goldenhour: "Golden Hour, from La Vida San Diego. A pocket sunrise. The real site is warm from the first pixel.",
    roof: "One Roof, from Tiger Hospitality. Swing the string until every lamp lights.",
    eggcursor: "Runny Egg, from Egg&Out. Their cursor, kept in a pan.",
    pours: "Count the Pours, from BarFix. Pour a drink, ring it up. The scale knows what you forgot.",
    limewash: "Limewash, from baa atelier. A toy wall. The real finishes take days and a steady hand.",
    dumpling: "Dumpling Drop, from Station8. Land a dumpling in every basket.",
    angry13: "Angry 13, from K13. A slingshot and a tower. We made this one for ourselves."
  };
  var WINDOWS = [
    "Late afternoon over San Diego. The light works harder than most of us.",
    "A view of the street. Nobody is out; they are all inside, looking for the thirteenth thing.",
    "The sky does its orange trick. We charge nothing for it.",
    "A clean pane. Somebody here cleans windows and nobody knows who.",
    "The glass shows the room, a little ghosted, with you in it. A fine spot for a pep talk.",
    "Outside, the world. Inside, the arcade. The arcade is winning."
  ];
  var PLANTS = [
    "A monstera. Nobody waters it and it never complains.",
    "A snake plant. It has survived every deadline so far.",
    "A succulent. Thrives on neglect, like a good first draft.",
    "A fern. Fussy, but worth it.",
    "A ficus with firm opinions about the draught from the front door.",
    "A cactus with a tiny gold flower. It bloomed the day the last site shipped."
  ];
  var DESKS = [
    "A desk. Sticky note on the monitor: tokens, not hex.",
    "A mockup is open and one pixel has been nudged, then nudged back.",
    "A chart and half a snack. Numbers first, snack second.",
    "A terminal, all green. Somebody is having a good day.",
    "Sticky note: does it work at 390px?",
    "Two monitors, one of which only shows the clock.",
    "A coffee ring in the shape of a 13. Nobody admits to it.",
    "Headphones on the desk, still warm. Their owner went to look at the fish."
  ];

  function plainLine(id) {
    var m;
    if ((m = /^cab-(.+)$/.exec(id))) { return CAB[m[1]] || "A cabinet with a lit marquee and your name on its mind."; }
    if ((m = /^bench-(.+)$/.exec(id))) { return BENCH[m[1]] || "A workbench with a toy on it."; }
    if ((m = /^window-(\d+)$/.exec(id))) { return WINDOWS[(parseInt(m[1], 10) - 1) % WINDOWS.length]; }
    if ((m = /^plant-(\d+)$/.exec(id))) { return PLANTS[(parseInt(m[1], 10) - 1) % PLANTS.length]; }
    if ((m = /^desk-(\d+)$/.exec(id))) { return DESKS[(parseInt(m[1], 10) - 1) % DESKS.length]; }
    switch (id) {
      case "counter": return "The Masterminds' counter. Kazim and Gürkan keep the place from here. The bell is for show; nobody has needed to ring it yet.";
      case "neon-freeplay": return "FREE PLAY, in jade tubes. It means what it says. Nothing here takes a coin.";
      case "door-front": return "The front door, open after hours for anyone curious enough to push.";
      case "claw": return "A claw machine. Every plush is a toy of something we shipped. The claw is honest: it rarely holds on.";
      case "coffee": return "A coffee machine with one setting: yes.";
      case "pinball": return "A pinball table. Tilt is switched on. Tilt is always switched on.";
      case "records": return "The needle is down and the record turns. It sounds like someone working past midnight, which is the point.";
      case "pegboard": return "Tools on a pegboard, each hung inside its own outline. One outline holds nothing. Somebody has the key.";
      case "rug": return "A rug in jade and orange. It ties the lounge together and has been stepped on by everybody.";
      case "screens": return "The War Room wall: every project, live, on one board. Nothing here is a mockup.";
      case "lathe": return "A lathe, cold, with one pale curl of wood still on it. Sawdust, as promised.";
      case "sawdust": return "Sawdust. The workshop's way of saying something got made.";
      case "waitbench": return "A waiting bench. Nobody has ever waited on it for long; there is too much to touch.";
      default: return "Something worth a second look.";
    }
  }

  /* ---------- the interactions ---------- */
  function onInteract(objId, state) {
    var id = String(objId || ""), n, r, inp, others;
    S(state); state.seen[id] = true;
    if (/^cab-/.test(id) && id !== "cab-secret") { state.played = (state.played || 0) + 1; }

    switch (id) {
      case "guestbook":
        if (state.found.guestbook) { return { say: "Your name is on line 13. The pen is still on its string." }; }
        return found(state, "guestbook", "A pen on a string and a long list of names. The last line is blank, numbered 13, and already has a smudge where your name goes. You sign. Visitor 13. Nobody has ever been visitor 14.");
      case "fishtank":
        if (state.found.fishtank) { return { say: "Thirteen fish, one in a gold crown. Ship It is on the move." }; }
        return found(state, "fishtank", "You count the fish. Thirteen. You count again, and it is still thirteen. One is orange and wears a tiny gold crown. The label on the glass says SHIP IT.");
      case "poster-13":
        if (state.found.poster) { return { say: "FROM I WISH TO IT WORKS. Light all 13 to open the doors. The torn corner still has the rest of the sentence." }; }
        return found(state, "poster", "A poster. FROM I WISH TO IT WORKS, and a big 13 underneath. Small print: Light all 13 to open the doors. The corner is torn, as if someone took the rest of the sentence with them.");
      case "neon-k13":
        if (state.found.neon) { return { say: "The 1 flickers when it feels like it. The 3 never does." }; }
        return found(state, "neon", "The K13 sign hums. The 1 flickers now and then. The 3 never does. Whoever wired it was careful with that one.");
      case "change-machine":
        if (state.found.change) { return { say: "Thirteen coins again. It has never once been wrong." }; }
        return found(state, "change", "You press the lever. It counts to thirteen, hands you thirteen coins and a receipt: No refunds. Always exact change. Every coin is stamped 13.", { give: "13 coins" });
      case "couch":
        if (state.found.couch) { return { say: "A very good couch. The 13 in the seam is still there." }; }
        return found(state, "couch", "You lift a cushion. Under it: a guitar pick, a loose button, and a small 13 stitched into the seam. The site hides thirteen marks like this one. This one just got a better seat.");
      case "bookshelf":
        if (state.found.book) { return { say: "The orange spine is back in line. The card is in your pocket: up, up, down, down, left, right, left, right, B, A." }; }
        return found(state, "book", "One orange spine sticks out from the rest. You pull it: BLUEPRINTS. A card falls out: up, up, down, down, left, right, left, right, B, A. On the website that draws the whole page as a blueprint. In here it just feels like a handshake.", { give: "a card with arrows" });
      case "radio":
        if (!isNight(state)) { return { say: "Static, and a faint hum. The radio seems to wait for dark. The site has a Night shift of its own: switch the lights off and come back." }; }
        if (state.found.radio) { return { say: "The calm voice is back on its loop: From I wish, to it works. Please hold." }; }
        return found(state, "radio", "The radio clears its throat. A very calm voice, on a loop: This is the night shift. From I wish, to it works. Please hold. It is the studio's motto, read slowly, and only audible after dark.");
      case "whiteboard":
        if (state.found.whiteboard) { return { say: "WISH, arrow, OK. Four steps up: Essential, Signature, Tailored, Immersive. Restraint is a feature." }; }
        return found(state, "whiteboard", "A sketch: a cloud labelled WISH, an arrow, a box labelled OK. Under it, four steps going up: Essential, Signature, Tailored, Immersive. A note in the corner: Immersive, two or three per site at most. Restraint is a feature.");
      case "printer":
        return { say: "The tray holds one half-printed sheet: BACK DOOR PAD, four digits. The year the Miramar first lit its marquee. The bench will tell you." };
      case "door-back":
        n = count(state);
        if (n >= TOTAL) { return { say: "The door swings open on its own. Behind it, the War Room is lit and waiting.", open: "door-back" }; }
        return { say: "A steel door marked 13. A plate says: Light all 13 to open the doors. You have " + n + " of 13. The keypad beside it belongs to a smaller lock." };
      case "keypad":
        if (state.flags.hatch || state.found.hatch) { delete state.input; return { say: "The pad is dark. The hatch beside it is open and empty." }; }
        if (state.input === undefined) { return { prompt: "code", say: "A brass keypad. Four digits.", label: "Door code", maxLength: 4, placeholder: "4 digits" }; }
        inp = state.input; delete state.input;
        if (inp === null) { return { say: "You step back from the keypad." }; }
        inp = String(inp).replace(/\s+/g, "");
        if (inp === "") { return { say: "You press nothing. The pad waits.", denied: true }; }
        if (inp === CODE) {
          state.flags.hatch = true; state.flags.token = true;
          return found(state, "hatch", "The pad chirps. A small hatch beside the door swings open. Inside: a brass token stamped 13 and a card that says Machine 16 takes tokens, and a little patience.", { give: "a brass token" });
        }
        return { say: "Three low beeps. The pad forgets what you typed.", denied: true };
      case "scoreboard":
        if (state.found.score) { return { say: "Top row: YOU 0013. Underneath, in small letters: Every great score starts with someone pressing Start." }; }
        if (!state.played) { return { say: "The board lists K13, EGG and BAR. Under them, an empty row waits for initials. Play any machine first." }; }
        return found(state, "score", "The board shuffles and settles. Top row: YOU 0013. Underneath, in small letters: Every great score starts with someone pressing Start.");
      case "cab-secret":
        if (state.found.sixteenth || (state.flags && state.flags.sixteenthOpen)) {
          return { say: "Machine 16. The little figure on the screen is still standing at the little dusty machine. Credits: 13.", reveal: true };
        }
        others = countOthers(state, "sixteenth");
        if (others < NEED_FOR_16) {
          return { say: "A cabinet under a heavy dust sheet. A \"???\" glows through a gap. You have found " + others + " secrets. It stays asleep until you know the place better: eight." };
        }
        if (!state.flags.token) {
          return { say: "The sheet comes off one corner. A coin slot, and no coin. There is a small hatch somewhere in this building that might keep something for it." };
        }
        state.flags.sixteenthOpen = true; delete state.flags.token;
        return found(state, "sixteenth", "You feed the token into the slot and pull the sheet away. The marquee reads MACHINE 16. On its screen, a tiny room, this room, from above, and a tiny orange figure walking up to a tiny dusty machine. The figure is you. A line scrolls past: The sixteenth game is the one you are already in. Credits: 13.", { reveal: true });
      default:
        return { say: plainLine(id) };
    }
  }

  function onTalk(personId, state) {
    var id = String(personId || "").toLowerCase(), n;
    S(state);
    state.talked[id] = true;
    if (id !== "natalia") { return null; }
    n = count(state);
    if (!state.found.natalia) {
      return found(state, "natalia", "She taps a pencil twice. You have " + (n + 1) + " of 13. The dusty machine needs eight and a token from the back hatch. That is the whole rule.");
    }
    return { say: "You have " + n + " of 13. Eight and a token for the dusty machine. One file, one token." };
  }

  /* ---------- hints: each crew member points at one unfound thing ---------- */
  function hintFor(personId, state) {
    var id = String(personId || "").toLowerCase(), f;
    S(state); f = state.found;
    switch (id) {
      case "kazim": return f.guestbook ? null : "Before you leave, sign the guestbook. Line 13 is yours.";
      case "gurkan": return f.fishtank ? null : "The tank in the lounge has more going on than fish. Count them.";
      case "james": return f.score ? null : (state.played ? "You played. The scoreboard keeps track of who did." : "The scoreboard remembers whoever plays. Try a machine.");
      case "jessica": return f.hatch ? null : "Something is stuck in the printer. I would read it before the back door pad does.";
      case "olga": return f.hatch ? null : "I tested the back pad twice. It wants four digits and ignores everything else.";
      case "natalia": return null;
      case "tony": return f.natalia ? null : "Natalia counts everything here. Ask her what number she is on.";
      case "camila": return f.radio ? null : "The radio in the workshop only plays properly after dark.";
      case "valentina": return f.book ? null : "One book on the shelf does not match the rest. Orange. Pull it.";
      case "mariana": return f.couch ? null : "Check the couch. People lose things in it.";
      case "leticia": return f.sixteenth ? null : "The machine under the dust sheet is not as empty as it looks. It wants company.";
      case "gabi": return f.neon ? null : "Watch the K13 sign for a minute. One digit is steadier than the other.";
      case "nastiya": return f.change ? null : "Press the change machine. It is never wrong.";
      case "ana": return f.whiteboard ? null : "Read the whiteboard all the way to the bottom.";
      case "selma": return f.poster ? null : "Read the poster. All of it. Then look at the corner.";
      default: return null;
    }
  }

  /* ---------- the finale ---------- */
  function finale(state) {
    S(state);
    return {
      title: "Thirteen of thirteen",
      open: "door-back",
      lines: [
        { who: "kazim", name: "Kazim", say: "You found all thirteen. Most people leave by three." },
        { who: "gurkan", name: "Gürkan", say: "Thirteen looks, thirteen small questions. That is how we build too: look at the details until they give something up." },
        { who: "kazim", name: "Kazim", say: "This room started as a shelf of toys and grew into an arcade. Every machine in it is something we made to see if it was fun." },
        { who: "gurkan", name: "Gürkan", say: "If your business has an I wish in it, tell us. We will build it until it works." },
        { who: "kazim", name: "Kazim", say: "The War Room is open. Sit down. Tell us what you wish for." }
      ],
      cta: { label: "Start a project", href: "/#contact", subject: "Found all 13 in the Workbench world" }
    };
  }

  K.secrets = { total: TOTAL, list: LIST, count: count, onInteract: onInteract, onTalk: onTalk, hintFor: hintFor, finale: finale };
})();
