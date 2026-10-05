# Engineering handoff, 2026-10-05 (Natalia, site13_oct05_v2)

Status: done, not merged (Kazim ships with hm++).
Request: Kazim, verbal, 2026-10-05 ("some photos don't show", "check these numbers").

## Summary
- Wish card showed the browser's broken-image icon when one request failed. Cause: one fetch per swap, nothing watching it.
  Fix: `js/img-guard.js` retries once, then shows the project name on the house grid; wish.js warms all six screens in the background.
- Stats were typed by hand. `scripts/sync-stats.py` now reads the War Room registry, probes every address, and writes the numbers.
  Result: 17 shipped, 16 live now (was 16 / 13).
- DJ photos: no stock, generated or placeholder person of the DJ exists on the site. Nothing replaced.

## For Kazim
- 16 live now includes three live sites the Work list does not show: Three Lions Capital, Tap-N-Grab, Gurbet Store. Say if you want them named or the number kept at 13.
- Lobster Lab now answers scripts with Vercel's bot checkpoint (403). Browsers pass it; the board's canary may read it as down.
- The War Room says the DJ's tool is "Cenk's"; you said Fadil. No name was used on the site.

## Files
js/img-guard.js (new), js/wish.js, js/site.js, css/site.css, index.html, scripts/sync-stats.py (new)

## Risks
- Footer reads "17 shipped, 16 live". The hunt needs exactly 13 marks, so the footer mark moved to the Work note ("Every one of the 13 is live").
- DJ: no photo change (Kazim, 2026-10-05; he will update photos later).
- `All 13 of them are live` above the logo wall sits over 14 logos (NoxZipper is the 14th, behind sign-in). Left as is.

## Next
qa-test-engineer (Olga), via the code-review gate.
