# Motion brainstorm — new site intro film (ideas only, nothing rendered)

Source: `docs/prototypes/sculpt/statue.mp4` (10s, 1280x720, 24fps), playing inside
`docs/prototypes/sculpt/v6.html`. Contact sheet: `docs/prototypes/orbit_intro/src/old_statue_strip.png`.
Rejected attempt (AI 3D mesh orbit): `docs/prototypes/orbit_intro/K13_Orbit_Intro_13s.mp4`,
sheet `docs/prototypes/orbit_intro/src/check.png`. Kazim's verdict on the orbit: "very bad, it
didn't work at all" — flat mesh, invented back, rough close-ups. Both concepts below stay clear of
that failure mode: neither reconstructs unseen 3D geometry. Both build on the original 10s clip
rather than replacing it.

House motion vars already live in `v6.html`: `--ease: cubic-bezier(.22,1,.36,1)` (premium reveals),
`--pop: cubic-bezier(.34,1.56,.64,1)` (playful overshoot). Both concepts use only these two plus the
workhorse `cubic-bezier(.4,0,.2,1)` for cuts. K13 appears only as the typographic lockup (the
embossed cube/pedestal text already matches it — no mark is reintroduced). No em dashes in any
on-screen text.

---

## Concept A — "Depth Cut" (recommended)

**Idea:** Keep the original 10s build exactly as shot, then answer "zoom in / zoom out, epic" with
a fake dolly built from *layer separation on a single frame*, not a rebuilt mesh: rembg cuts the
figure off the background, the pedestal becomes its own plane, the code walls become a third,
looser plane, and the camera "pushes through" those three flat planes (2.5D parallax) instead of
orbiting a 3D object. This is the direct, low-risk answer to why the mesh orbit failed: it never
invents geometry the camera didn't actually see.

**Length:** 14s. Grid: 120 BPM, 0.5s beats, 28 beats.

| Beat | Time | Shot |
|---|---|---|
| 0–4 | 0:00–0:02 | Cold open, held on the dark room / single ember glow (existing first frame of the source, no new geometry). Amber code walls idle-breathe (`dotPulse`-style 3s loop, opacity 0.85↔1). |
| 4–8 | 0:02–0:04 | Slab rises → cube forms, orange wireframe traces on (source clip, 1x, untouched). |
| 8–13 | 0:04–0:06.5 | "K13 SOFTWARE STUDIO" embossed face reveal. Slight push-in (1.0→1.08x) timed to `--ease`, held a full beat so the lockup reads. |
| 13–18 | 0:06.5–0:09 | **THE CARVE.** Speed-ramped to 40% through the spark shower (source frame-blended at 120fps for clean motion blur, not just slowed). Signature moment. |
| 18–21 | 0:09–0:10.5 | Freeze on "figure complete." rembg splits the frame here: figure (fg), pedestal (mid), code walls (bg). |
| 21–25 | 0:10.5–0:12.5 | **Parallax push-through**: code wall plane slides past fast and slightly blurs, pedestal plane drifts slower, figure plane stays locked center and grows gently (Real-ESRGAN 4x applied only to the small, cleanly-segmented figure crop, not the whole frame). Reads as a dolly-in without ever inventing an unseen angle. |
| 25–27 | 0:12.5–0:13.5 | Salute holds, scan line sweeps once more. |
| 27–28 | 0:13.5–0:14 | Match cut: the cube's orange wireframe edges straight-cut into the page's own grid/nav underline as the film shrinks into `v6.html`'s existing `.proj.up` lift-out. |

**Signature moment:** the parallax push-through at 0:10.5–0:12.5 — depth from one frame, built
honestly from what the camera actually captured.

**Risk:** 720p softness — mitigated by upscaling only the small figure cutout (forgiving crop),
never the whole frame or an invented angle; the code-wall plane is generic texture so it can be
regenerated at higher native res via Gemini instead of upscaled. Layer-edge matting (rembg) on
frizzy hair needs a clean-up pass or a hairline halo shows during the push.

**Score: 8.5/10** — new tooling only where it's proven (rembg + ffmpeg + the 120fps compositor),
zero reconstruction risk, still delivers the "epic push" Kazim asked for.

**Reduced-motion fallback:** single static frame, the parallax hero pose (figure + pedestal,
sharp, no code-wall motion), same convention as the current `statue-first.jpg` poster. Page loads
straight past it with no animation, per `v6.html`'s existing `@media (prefers-reduced-motion:
reduce){.proj{display:none}}` pattern.

---

## Concept B — "Build Grid"

**Idea:** Open on a multi-panel grid playing the four build stages at once (slab, wireframe cube,
carve, salute — all from one static-camera source, so the panel edges already align pixel for
pixel with zero warping), let the panels match-cut merge into one full frame, then a rewind/
forward "heartbeat" replay of the carve before the epic close: a push-in with upscale on the
figure's face.

**Length:** 13s. Grid: 120 BPM, 0.5s beats, 26 beats.

| Beat | Time | Shot |
|---|---|---|
| 0–6 | 0:00–0:03 | 2x2 grid, four stages of the source clip playing in sync from t=0, amber code tiling the panel seams. |
| 6–11 | 0:03–0:05.5 | Panels match-cut merge into one frame (free alignment: same locked camera in the source). Reads as the grid "resolving" into the finished cube. |
| 11–16 | 0:05.5–0:08 | **THE CARVE**, played forward once, then rewound to spark-onset and replayed at 1.5x forward, landing back on sparks-complete — a heartbeat beat, sparks trail extended with matched 120fps motion blur. |
| 16–21 | 0:08–0:10.5 | Figure stands, scan line sweep, salute holds. |
| 21–24 | 0:10.5–0:12 | Push-in with 4x upscale on the face/glasses close-up. |
| 24–26 | 0:12–0:13 | Freeze, cross-fade/match-cut into the page hero. |

**Signature moment:** the grid-to-single-frame merge at 0:03–0:05.5 — more overtly "epic," reads
as a build montage collapsing into the finished piece.

**Risk:** the face push-in with 4x upscale (0:10.5–0:12) is the same shot class Kazim rejected on
the orbit render — a close, held facial portrait is exactly where 720p softness shows worst.
Mitigate with a moderate push (not extreme), a light grain/texture overlay to mask upscale
artifacts, and a hard ceiling on hold time. The grid panels themselves carry near-zero risk (static
source camera, no warping needed).

**Score: 7/10** — more spectacle, but the riskiest beat is a variant of the exact thing Kazim
already called bad once.

**Reduced-motion fallback:** static single frame of the final salute pose (post-merge, pre-push),
no grid, no rewind. Same "no motion, straight to content" pattern as Concept A.

---

## Comparison

Concept A is the safer, more honest answer to "why did the mesh fail and what do we do instead" —
it gets depth from real layers of the real footage. Concept B is showier but repeats the one shot
type (extreme close upscale) Kazim already rejected, just in 2D instead of 3D. Recommend building
a stills gate (per `motion-vid` house workflow) on Concept A first; only chase Concept B's grid-
merge idea as a secondary beat inside A if Kazim wants more spectacle, skipping its risky close-up.

---

## Status      NEEDS-REVIEW
## Summary     Two intro-film concepts proposed for the site's opening moment, both 12–15s, both built on the existing 10s clay-carving clip rather than replacing it. Concept A ("Depth Cut") uses 2.5D layer-separation parallax instead of 3D reconstruction, directly avoiding the failure mode of the rejected mesh orbit. Concept B ("Build Grid") is a multi-panel build montage with a rewind heartbeat and a risky face-upscale close. No rendering, no assets generated — proposal only.
## For Kazim   Camila looked at your old clip and the failed orbit video and came back with two new ideas that stay closer to the original film: one pushes the camera through flat layers of the real footage instead of a fake 3D model (the safer, recommended one), the other builds a montage grid with a bold close-up push-in (showier, but repeats the risky close-up type you already rejected once). Nothing has been built yet, this is just the pitch for you to pick from.
## Files       docs/handoffs/motion-intro_2026-09-29.md (this proposal); referenced only, not modified: docs/prototypes/sculpt/statue.mp4, docs/prototypes/sculpt/v6.html, docs/prototypes/orbit_intro/src/old_statue_strip.png, docs/prototypes/orbit_intro/K13_Orbit_Intro_13s.mp4, docs/prototypes/orbit_intro/src/check.png
## Risks       Concept A: hairline matting on rembg cutout needs cleanup or a halo shows during the parallax push. Concept B: the face push-in/4x-upscale beat is the same shot class Kazim already called "very bad" on the orbit render, softness risk is real there. Both: still 720p source, so any close crop needs the Real-ESRGAN pass scoped tight, never a full-frame upscale.
## Next        motion-vid (build a stills gate on Concept A first, per house workflow, before any full render)
## Human gate  Kazim picks a concept (or a hybrid) before anything renders. No render, no asset generation, no site change should happen without that pick.
