# The Workbench World, round 3: characters and graphics first (2026-10-06)

Source: Kazim's answers to the K13 Dünya Anketi (artifact, 2026-10-06), recorded verbatim below. His pick
for "Önce hangisi?" was **Karakterler ve grafik**, so this round builds that, plus the one character item
from his own words: enter a name and make your own character.

## His answers (verbatim)
- **Hareket ve his:** Koşma, Scooter ya da bisiklet, Kendi arabanı sür, Telefonda sanal joystick, Kamera yakınlaştırma.
  Kendi cevabım: GTA nin ilk oyunlarindaki gibi silah ve arabaya binme inme etrafa farkli silahlarla ates etme gibi seylerde ekleyelim.
- **Ulaşım:** Pacific Surfliner, Otobüs hatları, Coronado vapuru, San Diego havaalanı, Taksi / araç çağırma.
  Kendi cevabım: bird scooters and city bikes can be added.
- **San Diego simge yerleri:** Balboa Park, Gaslamp Quarter, Petco Park, La Jolla Cove, Hotel del Coronado, USS Midway, Coronado Köprüsü.
- **Orange County simge yerleri:** Huntington Beach Pier, Laguna Beach, Newport limanı, San Clemente Pier, Bir tema parkı.
  Kendi cevabım: The Row at Red Hill (Row apartments), just add it as a living residents.
- **Los Angeles simge yerleri:** Santa Monica Pier, Venice Beach, Tepe yazısı, Union Station, Queen Mary, LACMA lambaları, Griffith Observatory.
  Kendi cevabım: Downtown buildings (especially US Bank building).
- **Dükkân içleri:** Gerçek menü tahtası, Çalışan ve müşteri karakterleri, Her mekâna imza obje, Her mekânda küçük bir görev, Mekâna özel mini oyun, Saate göre kalabalık, Canlı siteye giden kapı.
  Kendi cevabım: Canli site oyunun icinden scroll edilebilip etkilesime gecilebilsin, siteye gitmek icin ayri bir link konulabilir koseye ama amac oyunun icinden ulasip gorebilmek siteyi. Sitenin motifleri ve menunun itemleri falan etrafta bulunabilir, sitedeki resimlerden yararlanilabilir.
- **Oyunu derinleştiren şeyler:** Günlük görevler, K13 jetonu ve ekonomi, Rozetler ve başarımlar, Hikâye bölümleri, Kartpostal koleksiyonu, Balık tutma ve sörf, Hava durumu, Mevsimler ve özel günler, Diğer ziyaretçiler görünsün, Ekipten görevler, Kendi köşen.
  Kendi cevabım: Oyuna girerken isim yazdir. Karakter sectir, boylece her girem kendi karakterini olusturur ve eger kayit etmek isterse progresini google accountu ile girip sonradan gelip oynamaya devam edebilir, kazanimlari ve progresi kayitli kalir.
- **Karakterler ve grafik:** Daha büyük, detaylı karakterler, Yüz ifadeleri ve balonlar, Mevsime göre kıyafet, Büyük konuşma portreleri, Günlük rutin, Stüdyo kedisi ya da köpeği, Ses ve müzik, Işık ve gölge.
- **Önce hangisi?:** Karakterler ve grafik.

## Round order
1. **Round 3 (now): characters and graphics** + name entry and character creation (saved on the device).
2. Round 4: shop interiors (each one its real self, staff and customers, signature object, menu, task,
   mini game, the live site viewable inside the game) + food halls as one building per real address.
3. Round 5: transit and landmarks (his picks above) + scooters, bikes, cars.
4. Round 6: depth (daily tasks, coins, badges, story, postcards, fishing and surfing, weather, seasons,
   other visitors, crew tasks, your own corner) + accounts if approved.
Decisions that are Kazim's (asked 2026-10-06): weapons style, Google sign-in for saved progress, how the
live sites appear inside the game.

## Round 3 contract (two builders, one worktree)
**people.js (characters builder)** keeps every existing export working and adds:
- `size`: `{w:16, h:32}` for the new body (was 16x24). `draw(ctx,id,dir,frame,x,y,scale)` keeps its
  signature: x,y is still the TOP-LEFT of the sprite; feet sit on the bottom row (`h-1`). The engine reads
  `people.size` instead of assuming 24. Walk = frames 0-7 (8 frames), idle = 8 (breathes on its own),
  `frames:{walk:8, idle:8}` exported so the engine never hard-codes counts.
- `outfit(id, ctx)`: the engine passes `{season:'summer'|'autumn'|'winter'|'spring', hour:0-23}`; people.js
  picks the right look (shorts in summer, a jacket in the evening and in winter) inside draw(); a call
  `setContext({season, hour})` once a minute is enough.
- `emote(ctx, kind, x, y, scale, t)`: a speech-bubble icon above a head (kinds: `hi` wave, `heart`,
  `idea` bulb, `coffee`, `music` note, `laugh`, `surprise` !, `question` ?, `zzz`, `work` gear, `k13`), x,y =
  the bubble's bottom centre; a short pop-in by t (0-1), still under reduced motion.
- `portrait(ctx,id,x,y,scale,expr)`: big talking portrait 64x64 (was 32x32), `expr` = `neutral|happy|
  surprised|thinking`, with a 2-frame blink and mouth when `t` is passed via `portraitAt(ctx,id,x,y,scale,expr,t)`.
- **Character creator parts** for the visitor: `parts` = `{skin:[...], hairStyle:[...], hairColor:[...],
  top:[...], topColor:[...], bottom:[...], bottomColor:[...], accessory:[...]}` (each a list of
  `{id,label}`), `drawLook(ctx, look, dir, frame, x, y, scale)` and `portraitLook(ctx, look, x, y, scale,
  expr)` for a `look` object of chosen part ids, `randomLook(seed)`, `defaultLook`.
- **The studio pet**: `pet` = `{id:'pixel', name:'Pixel', kind:'cat'}`, `drawPet(ctx, dir, frame, x, y,
  scale, pose)` with poses `walk|sit|sleep|stretch`, 16x16.
- Light: every sprite also gets a soft ground shadow drawn by the engine; people.js exports `shadow(ctx,x,y,scale)`.

**engine.js / map.js / css/world.css / workbench/index.html (world builder)**:
- Reads `people.size`, `frames`, the new portrait size; larger, livelier dialogue box with the 64px portrait
  and its expression.
- **First visit: name and character.** A friendly "Who are you?" screen before the world starts: a name
  field and a character creator (live preview turning around; arrows through each part; Random; keyboard
  and touch), saved on this device (`k13_world.me`), shown over the visitor's head and used in dialogue
  ("Welcome back, <name>"). A small "Change look" in Help. Never blocks: "Skip" picks a random look.
- **Emotes**: crew show one when the visitor comes near (wave), when talked to (happy), at the coffee
  machine (coffee), while working (work), late at night (zzz); the visitor gets an emote wheel (key T,
  and a button on phones).
- **Daily routines** by the San Diego clock: morning coffee at the machine, standup at the whiteboard,
  lunch out (the commute to shops), afternoon at desks, Kazim and Gürkan at the counter, a quiet office
  at night with the lamps on.
- **Pixel the studio cat** wanders HQ, sits on the couch, sleeps in a sunny spot, follows the visitor for
  a bit; interact to pet it (heart).
- **Light and shadow**: soft ground shadows under everyone, warm sunset light through the windows at
  dusk, lamps and neon pools at night, gentle cloud shadows outdoors in the day (off under reduced motion).
- **Sound and music**: WebAudio only (no files), off until the visitor turns it on (a speaker button on the
  bar, remembered), gentle ambient loop per place (HQ lo-fi, beach surf, street), footsteps, UI blips.
- Keep everything that works: Go to, secrets, finale, van, shops, deep links, list mode, mobile.

## Kazim's decisions (2026-10-06)
- **Weapons:** only against bugs and bots. GTA feel (get in and out of cars, switch weapons, fire around),
  cartoon weapons whose only targets are bug monsters and template robots, like Run & Ship. Pedestrians and
  the crew can never be shot. (Round 5, with cars.)
- **Saved progress:** device first, Google later. Name, character and progress live on the visitor's own
  device (`k13_world`); Google sign-in comes in its own later round with a small server and an updated
  privacy text. No personal data is collected now.
- **Live sites in the game:** a scrollable full-page copy of each real site inside its shop, with the site's
  images, menu items and motifs around the room, and a corner button that opens the real site. No client
  site's security settings change. (Round 4.)
