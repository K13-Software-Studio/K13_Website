# Art direction: the K13 opening film, take two (2026-09-29)

**From:** Baha, "Magi" (Art Director)
**Ask:** Kazim wants a 12 to 15 s "drone-style 360, epic, zoom ins and outs" opening film. The
TRELLIS mesh orbit was rejected ("hiç olmamış, çok kötü"). New brief: build on top of the old film
(`docs/prototypes/sculpt/statue.mp4`, 1280x720, 24 fps, 10 s), do not replace it.
**Request line:** Kazim, verbal, 2026-09-29.

---

## 0. The diagnosis in one paragraph

The old film is good because it is *made*: clay texture, warm light, a small story (block, carve,
salute). The mesh failed because it swapped the made thing for a guessed thing, and a guess looks
worst exactly where an orbit spends its time: the back, the hair, the close-up. So the rule for take
two is **the camera may move, the clay may not be re-invented.** Every frame the viewer studies
closely must be a real frame from the old film (or a small, honest variation of one). "Epic" comes
from **time and camera**, not from new geometry: speed ramps, freezes, push-ins, pull-outs, and short
arcs. A full 360 around this figure cannot be done honestly from front-only footage; below, one
concept fakes the feeling of it with short arcs, and one does a real 360 by making the imperfection
the style.

What the 2026 landscape says, briefly:
- **Craft is the luxury now.** Trend round-ups for 2026 all say the same thing: after a year of
  generative sameness, texture, stop-motion and hand-made motion read as premium (Envato, Renderforest).
  Our clay film is already on the right side of that line. Do not sand it into CG.
- **AI image-to-video can move a camera, but only a little, well.** Kling, Runway Gen-4 and Luma Ray3
  all do orbit/push/crane moves; the consistent advice is that identity holds on **partial, slow
  arcs** and breaks on a heavy 360 of a figure (it "fights the reference pixels"). Start/end-frame
  control (Kling, Veo 3.1) lets us pin both ends of a move to real frames. Kling 4.0 (announced
  2026-09-27, full release in October) extends that to up to 10 keyframes.
- **Bullet time is back**, now cheap: Seedance 2.0 and Higgsfield sell "time freeze, camera keeps
  moving" as a one-prompt effect. We do it better by hand, because our sparks are ours.
- **2.5D from a still is mature**: Depth Anything V2 depth maps plus layered parallax give a real
  dolly/push feel with zero invented surfaces, as long as the move is small.
- **Motion identity systems**: an intro that adapts to how long the wait really is (Renderforest
  2026). That is the "one step further" below.

---

## Concept A: "Bullet Time" (freeze the clay, keep the camera flying)

**One line:** the old film plays at its own pace, then time stops on three hero moments and the
camera keeps flying around the frozen clay, then time snaps back.

### Storyboard (14.0 s)

| t (s) | beat | source | camera |
|---|---|---|---|
| 0.0 to 1.2 | Cold open. Amber code wall, floor grid, nothing yet. | old 0.0 to 0.5 | slow 2.5D push in, focus racks from code to floor |
| 1.2 to 3.0 | Slab rises and builds the cube, **ramped to 2x**. Orange wireframe lines snap on the beat. | old 0.5 to 3.5 | continuing push, slight crane down to floor level |
| 3.0 to 4.6 | **Freeze 1.** Cube with the embossed K13 lockup, still. Camera arcs about 30 degrees to the left around it, low, like a drone skimming the floor. | frame at old 4.0 s + AI arc | arc, then hard stop |
| 4.6 to 6.2 | Time returns with a crack. Carving starts, **ramp down to 0.25x** as the sparks fly. Crash zoom into the spark burst. | old 5.0 to 5.8, frame-interpolated | crash zoom in |
| 6.2 to 8.4 | **Freeze 2, the big one.** Half-carved figure, sparks hanging in the air like stars. Camera orbits about 50 degrees right, sparks drift past the lens in parallax. | frame at old 6.0 s, cut-out + our own particle layer | slow orbit, sparks as foreground depth |
| 8.4 to 10.6 | Time resumes at 1x: hair forms, glasses glow, binary digits rain. Drone pull-back and rise reveals the K13 pedestal. | old 6.5 to 8.5 | 2.5D pull-out and crane up |
| 10.6 to 12.4 | Scan line sweeps. The salute plays at **real speed**, then a push-in to the orange glasses, ending on a glint. | old 8.5 to 10.0, upscaled | push-in to glasses |
| 12.4 to 14.0 | **Freeze 3 into pull-out:** the whole frame shrinks back into the projector screen of the paper room (v6), lens flares once, the typographic lockup settles, the site opens. | v6 room + last frame | fast pull-out, screen folds |

### Why it is current
Bullet time has had a 2026 revival through one-click AI presets (Seedance 2.0, Higgsfield "time
freeze"); a hand-made version with real clay reads as the premium original of a cheap trend.
Speed ramps plus crash zooms are the grammar of every current drone and product reel.

### How we build it
- **HTML frame-exact compositor at 120 fps**, blended to 60: owns every ramp, freeze, zoom and the
  final pull-out into the v6 room. The old film is seeked frame by frame inside it.
- **ffmpeg**: extract frames; `minterpolate` (or RIFE if we add it, free and local) for the 0.25x
  spark slow motion.
- **rembg**: cut the figure and cube out of the freeze frames so the sparks and the room can sit in
  front and behind with real parallax.
- **Depth Anything V2** (new, free, local pip install): depth maps of the freeze frames for the
  2.5D push/pull moves on the background.
- **Real-ESRGAN**: 2x to 4x the frames used for the glasses push-in and the freeze close-ups (the
  source is only 720p).
- **Our own particle layer**: sparks and binary digits redrawn in code, colour-picked from the
  film, so frozen sparks are crisp and orbit correctly. This is what makes Freeze 2 epic.
- **AI arcs (Freeze 1 and 2 only):** Kling image-to-video with start and end frame, prompt a
  30 to 50 degree slow arc. Needs a Kling account with paid credits (a few dollars for 8 to 12
  takes). Alternative: Veo 3.1 first/last frame via Google Flow's free daily credits (about 2
  clips a day) on **Kazim's own K13 Google login, never the algosift account**. Fallback with no
  AI at all: the arcs become 2.5D depth arcs (smaller, about 10 degrees, still reads as a move).

### Risk
The AI arcs are the only guessed pixels. The K13 lettering on the cube and the orange glasses are
exactly what AI video mangles first. Mitigation: arcs stay at or under 40 degrees, the K13 face of
the cube is re-composited from the real frame at both ends, 6 to 10 takes per arc and we keep only a
perfect one, grade and grain matched to the old film. If no take survives, the 2.5D fallback ships.

**Gut score: 8.5 / 10**

---

## Concept B: "Through the Screen" (zero AI, all real)

**One line:** the projection room is the drone's playground: we fly *into* the screen, the old film
becomes the world around us, and at the salute we fly back *out* and the screen becomes the site.

### Storyboard (13.0 s)

| t (s) | beat | camera |
|---|---|---|
| 0.0 to 1.5 | Paper room (#F3F5FA), orange projector lens wakes, beam hits the unfolding screen. | wide, still |
| 1.5 to 3.0 | Old film starts on the screen (slab rising). Camera dives toward the screen, the screen edge passes the lens. | fast dolly in, screen fills frame |
| 3.0 to 8.5 | Inside the film. The old footage split into 3 depth layers (code wall, floor, subject) drifts with gentle parallax so the frame feels like a real space. Cube, emboss, carving; one 0.5x ramp on the sparks. | slow 2.5D drift, one crash zoom on the sparks |
| 8.5 to 11.0 | Figure finished, scan line, salute. | push-in on the salute |
| 11.0 to 13.0 | Hard pull-out: back through the screen edge, the room reappears, the screen flattens and becomes the site's hero frame (a match cut from film to interface). | fast pull-out, screen to hero |

### Why it is current
Frame-within-frame and "film becomes the interface" match cuts are everywhere in 2025/26 site
intros; it also keeps the loading screen we already built (v6) as the stage instead of throwing it
away.

### How we build it
HTML compositor for the room and both dolly moves (the room is our own flat 3D planes, so the camera
can truly move in it); ffmpeg; rembg plus Depth Anything V2 for the three layers; Real-ESRGAN for
the push-in. No AI video, no accounts, no credits.

### Risk
Lowest of the three. The weakness is Kazim's own words: it is "zoom in and out", but it is not a
drone 360. He may feel we did not answer the orbit ask.

**Gut score: 7 / 10**

---

## Concept C: "Clay Turntable" (a real 360, made as stop-motion)

**One line:** after the salute, the finished statue turns a full 360 on its pedestal as a
deliberate 12 fps stop-motion turntable, the way a sculptor shows a maquette.

### Storyboard (14.0 s)
| t (s) | beat |
|---|---|
| 0.0 to 8.0 | Old film, lightly re-cut and ramped (slab, cube, carving compressed to 8 s). |
| 8.0 to 12.0 | The pedestal starts to turn: 24 hand-picked stills of the statue from 24 angles, played at 12 fps, with a tiny camera float between them. Warm key light stays fixed so the clay shading moves across the face like a real turntable. |
| 12.0 to 14.0 | Back at the front, he salutes (real frames), glint, lockup. |

### Why it is current
Stop-motion and "imperfect by hand" are named across every 2026 motion trend report as the answer to
AI sameness. The 12 fps stutter makes small differences between angles read as craft, not as error.

### How we build it
Gemini image generation (free, through GStack Browser) produces the 24 angles from the real front
frame as reference, one angle per prompt, same light, same background; rembg cut-outs; the HTML
compositor places each on the real pedestal and room plate.

### Risk
High. It is the same problem as the mesh (the back and hair are invented), just hidden by style.
Drift between angles (glasses shape, hair, sweater pocket) can make it look like 24 cousins. Needs a
strict stills gate: Kazim approves the 24 angles as a contact sheet before anything is animated.

**Gut score: 6 / 10**

---

## My pick: A, "Bullet Time", with B's ending and one more step

**Why A.** It is the only concept that answers all three words of the ask. *Epic*: frozen sparks
around a clay figure is the most cinematic image this footage can make. *Zoom in and out*: crash
zoom into the sparks, push to the glasses, pull-out through the screen. *Drone orbit*: three arcs
cut on the beat feel like one flying camera, while every close look lands on a real frame. It keeps
the clay untouched, which is the lesson of the mesh.

**One step further: a film that knows how long the site takes.** The loading screen should not play
a fixed 14 s clip and then make people wait (or cut them off). Build the film as three pieces:

1. **Intro** (0 to 8.4 s): cube, carving, Freeze 2.
2. **Hold loop** (seamless, 2 to 4 s): the finished statue, bullet time still active, sparks slowly
   orbiting him, scan line passing, the camera drifting in a slow arc. It can loop any number of
   times without a visible seam.
3. **Ready** (about 3.5 s): the salute, glint, pull-out through the screen into the site.

The salute becomes the *signal*: **Kazim salutes you the moment the site is ready.** Fast
connection: intro plays straight into the salute (about 12 s, as asked). Slow connection: the
statue holds in frozen time instead of a spinner. Returning visitor: a 3 s cut (salute plus
pull-out) so the film never becomes a tax. With `prefers-reduced-motion`: one still of the saluting
statue and the lockup, no movement.

Everything is a pure function of time, so the three pieces are rendered once by the same compositor
and the page only chooses which piece to play next. The score follows the same split: a pad under
the hold loop, the hits on the salute.

---

## Sources
- Envato, 11 Motion Design Trends for 2026: https://elements.envato.com/learn/motion-design-trends
- Renderforest, Logo Animation Trends 2026 (motion identity systems, wait-aware loaders): https://www.renderforest.com/blog/logo-animation-trends
- Renderforest, Design Trends 2026: https://www.renderforest.com/blog/design-trends-in-2026
- mstudio, Best Image-to-Video AI 2026 (Kling vs Runway vs Luma vs Veo): https://mstudio.ai/insights/best-image-to-video-ai-2026
- promptmake, camera movement prompts (orbit guidance, partial orbit holds identity): https://promptmake.net/blog/camera-movement-video-prompts
- Higgsfield camera controls and Orbit 360 preset: https://higgsfield.ai/camera-controls
- Kling start and end frames guide: https://kling.ai/quickstart/ai-video-start-end-frames
- Kling 4.0 (10 keyframes, announced 2026-09-27): https://morphic.com/resources/models/kling-4
- Veo 3.1 first and last frame (Gemini API): https://ai.google.dev/gemini-api/docs/veo
- Veo 3.1 free access limits (Flow, Gemini): https://moelueker.com/blog/google-veo-2-free-access-beat-rate-limits-with-3-platforms
- Bullet time with AI video (Seedance 2.0): https://morphic.com/ai-glossary/Bullet-Time
- Depth Anything V2 in the browser for 2.5D depth: https://dev.to/martindelophy/building-cinematic-depth-in-the-browser-with-depth-anything-v2-small-and-webgpu-1k07
- World Labs Marble (single image to Gaussian splat; considered and rejected here for the same reason the mesh failed: it invents the unseen side): https://radiancefields.com/platforms/world-labs

---

## Handoff

**Status:** Done (ideas only; nothing built or rendered).

**Summary:** Three concepts that keep the old clay film as the hero. A "Bullet Time" (8.5/10):
the film plays, freezes on three hero moments while the camera keeps flying, with speed ramps, a
crash zoom into the sparks, a push to the glasses and a pull-out through the projection screen.
B "Through the Screen" (7/10): zero AI, fly into and out of the v6 projection room. C "Clay
Turntable" (6/10): a real 360 as deliberate 12 fps stop-motion from Gemini stills. Pick: A, extended
into a wait-aware film (intro, seamless hold loop, salute on ready) so Kazim salutes the visitor the
moment the site has loaded.

**Files:** `/Users/k13/Desktop/PROJECTS/K13_Website/docs/handoffs/art-direction-intro_2026-09-29.md`

**Risks:**
- A's AI arcs can mangle the K13 lettering and the glasses; capped at 40 degrees, real frames
  re-composited at both ends, 2.5D fallback if no take is clean.
- None of the concepts is a literal, honest full-circle drone 360 of the real clay; C is the only
  full 360 and it re-invents the back, which is what failed last time.
- AI video grain and resolution will not match the 720p source by default; needs grade and grain
  matching, and Real-ESRGAN on the push-in frames.
- The wait-aware version touches the loading logic of the site, so it becomes a front-end task as
  well as a film.

**Next:** Kazim picks a concept. For A: a stills gate first (the three freeze frames with their
cut-outs, the particle layer, and one AI arc test), then the full render through the motion-vid
pipeline, then the Chrome QA gate.

**Human gate:**
1. Which concept (recommended: A with the wait-aware ending).
2. Spending on AI video credits: Kling paid credits (a few dollars) or Veo through Google Flow's
   free daily credits on Kazim's own K13 Google login. Without either, A ships with 2.5D arcs.
3. Whether the salute-on-ready loading behaviour should go on the live site or stay a film.
