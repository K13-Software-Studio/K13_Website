# Workbench upgrades: Limewash, Golden Hour, Night Shift Deck (2026-10-02)

**Status:** Done, verified locally. Not committed (James commits).
**Request source:** Kazim, verbal, 2026-10-02 (three asks, one per toy).

## Summary
- **Limewash:** a visible tool follows the pointer on a damped spring, tilts with stroke direction, presses down while painting and lifts when idle. Two real buttons pick Trowel (wide feathered band, burnished sheen, two edge ridges) or Brush (cloudy, crosshatched limewash streaks). The wall is worked where the tool really is. Keyboard painting shows the tool at the keyboard position. Native cursor is hidden over the wall only while the tool is drawn (mouse).
- **Golden Hour:** rebuilt as one canvas rendered at devicePixelRatio (cap 3). Six-key sky gradient, sun disc with glow and bloom, horizon glow, clouds, three hill layers with atmospheric haze, ground and walk, detailed cafe (striped scalloped awning, sign, windows and door that warm up at dusk, bistro tables), string lights, palm, stars and moon at night, cast shadows that lengthen and swing away from the sun. The scene eases toward the slider (no jumps). Real range input and aria-valuetext kept; canvas aria-label tracks the phase.
- **Night Shift Deck:** the loop (kick with pitch envelope, sub bass with sidechain duck, hats, clap, chord stabs, pad, 4 bars at 122 BPM) is rendered once offline into a buffer, the "record". Platter speed drives that buffer's playbackRate, with a reversed copy for backward motion, so scratching, holding the record, backspin and motor spin-up/spin-down (tape-stop pitch) are real audio. New: Tempo fader (110 to 134 BPM, drives motor speed and pitch), Filter sweep (low pass left, high pass right), Echo and Stutter pads (hold), Backspin button, live waveform strip plus VU from an AnalyserNode. Sound stays off until the switch; AudioContext is created on that click. Audio suspends when the card leaves the screen or the tab hides.

## Files
- `js/workbench.js`: only `limewash`, `goldenhour`, `cengo` (spliced by function boundary).
- `css/workbench.css`: removed dead rules of the old golden hour scene and the old trowel marker; appended one block `/* upgrades 2026-10-02: ... */` at the end.
- Instruction text changed for Limewash and Night Shift Deck (interaction changed). Footnotes, hunt marks and card anatomy untouched. No index.html edits, no new dependencies, no HTML inline script/style.

## Verification (Playwright, Chromium, local server with production CSP)
- Zero console errors/warnings and zero CSP violations (desktop 1440, mobile 390, and reduced-motion + touch pass).
- No horizontal overflow at 1440 and 390.
- Limewash: mouse trowel and brush strokes, keyboard painting (tool shown, strokes laid), tool class toggles on/down/lift.
- Golden Hour: slider at 4, 30, 58, 78, 92, 100 captured at deviceScaleFactor 2.
- Deck: an AnalyserNode tapped on the destination showed real audio (RMS about 0.05 to 0.34 playing, 0.25 while scratching, 0 while the record is held, 0 after pause, LP/HP filter changes level, echo and stutter pads hold and release by pointer and by Space), context state running, suspended off-screen, resumed on return, suspended on sound off. No AudioContext before the sound click.
- Screenshots: `/private/tmp/claude-501/-Users-k13-Desktop-PROJECTS-K13-Website/7f98e9f2-b9e9-443b-b8c6-74d3003f04ba/scratchpad/wb3/` (lime_*.png, gh_*.png, deck_*.png).

## Risks
- Deck audio is only verified in Chromium; Safari/Firefox untested (OfflineAudioContext promise API, negative-rate avoided by the reversed buffer).
- Stutter is a gate chop at about 8 Hz (audio only; no visual flashing). Echo tail rings after release by design.
- The record render takes a moment after the first sound click ("Pressing the record..." status).
- `will-change: transform` and a drop-shadow filter on the limewash tool; fine on desktop, worth a glance on low-end phones.
- Night-time palette on the cafe is dark by design; text on canvas (the "LA VIDA" sign) is decorative.
- fitcheck full nine-viewport pass not run, only 1440 and 390.

## Next
qa-test-engineer (Olga), via the Michael code-review gate: real-device audio check on iOS Safari, fitcheck, axe-core.

## Human gate
None. Kazim may want to eyeball the trowel and brush art and the deck's sound.
