# K13 email signatures

`email/index.html` shows all five signatures (K13SS new, compact, inline, mini, text) on a light
and a dark inbox. Two switches at the top: the mail app (Gmail, Apple Mail, Outlook), which picks
the version Copy puts on the clipboard and the set-up steps shown, and the address on the email
line (`ADDRS` in `build.py`: projects.k13@gmail.com or kazim@k13projects.com). The pictures it
points at live beside it in `email/` and are what every mail app fetches.

- Change a signature: edit `build.py`, then `cd email/src && python3 build.py`. The War Room's
  Brand Kit copies this page (`K13-WarRoom/.k13/brandkit_sync.py`): ship here first, then re-sync.
- Gmail and Apple Mail take the same code. Outlook's version (`outlook()` in `build.py`) adds what
  Word needs: exact line heights, the orange rule as a bgcolor cell with a 2px font, middle-aligned
  icons, and no exact line height on a cell holding a picture (Word clips it).
- Re-render the 3D logo: `blender -b -P k13_3d.py -- -14 k13_3d.png` (needs Fraunces 600 as a static
  TTF; the composite into `k13-signature-logo.png` and the mark is in the session history).
- Rules this obeys: tables and inline styles only, web-safe fonts, PNG at 3x with fixed width and
  height, absolute https image URLs, no SVG, no background images, no em dashes.
