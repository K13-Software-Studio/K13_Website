# K13 Gmail signatures

`email/index.html` shows all five signatures (K13SS new, compact, inline, mini, text) on a light
and a dark inbox, each with a Copy button for Gmail. The pictures it points at live beside it in
`email/` and are what Gmail fetches.

- Change a signature: edit `build.py`, then `cd email/src && python3 build.py`.
- Re-render the 3D logo: `blender -b -P k13_3d.py -- -14 k13_3d.png` (needs Fraunces 600 as a static
  TTF; the composite into `k13-signature-logo.png` and the mark is in the session history).
- Gmail rules this obeys: tables and inline styles only, web-safe fonts, PNG at 3x with fixed
  width and height, absolute https image URLs, no SVG, no background images, no em dashes.
