# CLAUDE.md — K13 Software Studio (the shopfront site)

> House rules for this repo. Full org conventions live in the War Room
> (`/Users/k13/Desktop/PROJECTS/K13-WarRoom/starter-kit/CONVENTIONS.md`); Kazim's full operating
> character is one read away in `K13-WarRoom/K13_GENOME.md` — start there on a fresh session.

## Identity
- **Author/owner:** Kazim (K13 / Kazimiro). This is Kazim's own project — the studio's shopfront.
- Collaborators Halil, Memo (MCS), Volkan are **EDISYN-only** — not involved here.

## Project
- **What:** K13 Software Studio's marketing site — a single-page pitch plus a per-client pricing
  subpage. It is the studio's front door, so its own quality is the argument.
- **For:** K13 itself (self-marketing).
- **Shortcode:** `site13`   ·   **Deploy:** Vercel (live at **k13projects.com**)
- **Repo:** https://github.com/k13-projects/K13_Website

> Note: the port registry in `CONVENTIONS.md` records the shortcode as `site`, but every branch in
> this repo's history uses **`site13`** (`site13_jul03_v4`, `site13_aug10_v1`). The repo's own
> precedent wins; the registry row is the thing that's drifted.

## Run locally
- **Assigned dev port: `9130`** (K13 dev-port registry — one fixed port per project, for life).
  Static site, no build step:
  ```sh
  python3 -m http.server 9130 --bind 127.0.0.1
  ```
- Open: **http://localhost:9130/** · macOS: never use 5000/7000 (AirPlay squats them).

## Stack
Static HTML/CSS/JS — **no build step, no `package.json`**. Since 2026-09-25 (beta_v8 "The
Workbench") the files are: `index.html` (markup only), `css/site.css`, `css/workbench.css`,
`css/404.css`, `css/sketch.css` + `js/sketch-switch.js` (the sketch loader: the switch runs in `<head>` before first paint, the loader itself lives in `js/site.js`), `js/site.js` (nav, reveals, feed, doors, showroom,
stepper), `js/workbench.js` (the two workbench pieces, Fire Palette and Opening Night, and the hidden layer). Lenis for smooth scroll
(jsDelivr, SRI-pinned). Google Fonts. Contact is a client-side `mailto:` composer with "Open in
Gmail" and "Copy the message" beside it, not a backend form. Design prototypes live in the gitignored `docs/prototypes/` and in
`generatedAssets/K13_Website_sculpt-intro/`.

**No inline `style=""` attributes and no inline `<script>` blocks**: the CSP no longer allows
either (see below). Set styles from JS through the CSSOM (`el.style.x = ...`), never through
`setAttribute("style")`. The games mount into `<div data-game="...">` and inject their own markup,
so page work and game work never touch the same file. The build spec and the final copy are in
`docs/BUILD_SPEC_2026-09-25.md` and `docs/copy_2026-09-25.md`.

## Security & deploy
- `vercel.json` carries the CSP and 5 security headers. **The CSP allowlist is derived from captured
  network requests** (`fonts.googleapis.com`, `fonts.gstatic.com`, `cdn.jsdelivr.net`) — if you add
  an external resource you MUST update it, and prove it by serving locally with those exact headers
  and confirming zero CSP violations. A wrong CSP takes production down on the next deploy.
- `script-src` and `style-src` dropped `'unsafe-inline'` on 2026-09-25. Any inline style attribute or
  inline script you add will be blocked in production and pass silently on a plain local server:
  always prove a change with the header-serving local server (`docs/handoffs/build_2026-09-25.md`
  has the snippet) before shipping.

## Accessibility — this one is not optional here
The site **markets "WCAG · 508" as a paid capability**, so shipping a11y failures is a credibility
problem, not just a defect. As of 2026-08-11 it passes axe-core with zero violations. Keep it there:
- Inactive contact-stepper steps must be genuinely `inert` — `opacity:0; pointer-events:none` does
  **not** remove elements from the tab order, and that exact mistake shipped a form that told
  visitors their message was sent when nothing had been.
- Never claim an action succeeded unless you can verify it did.
- Contrast floors: 4.5:1 body text, 3:1 large text and non-text boundaries. Several pairs sit near
  4.5 — recompute before changing any colour token.
- Gate all motion behind `prefers-reduced-motion` (currently the page's strongest area).

## ⚠️ Testing the contact stepper — stub `mailto:` first

The stepper ends by handing a `mailto:` to the OS. **Chromium delegates that to the real mail
client even in headless mode**, so every end-to-end walk-through opens a Mail compose window on
Kazim's Mac. A QA pass on 2026-08-11 walked it repeatedly and buried his desktop in identical
drafts.

Before testing this flow, intercept the navigation instead of letting it reach the OS:

```js
// Playwright — capture the attempt, assert on it, never hand it to macOS
const mailtos = []
await page.route('mailto:**', r => { mailtos.push(r.request().url()); r.abort() })
await page.evaluate(() => { window.__mailto = []
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="mailto:"]')
    if (a) { e.preventDefault(); window.__mailto.push(a.href) }
  }, true)
})
```

**Correction (2026-09-25):** neither stub catches "Send it", because it navigates with
`window.location.href = mailto…`, which Chromium neither routes through the network layer nor lets
a page override, so a scripted click on "Send it" still opens Mail on Kazim's Mac. Never click
"Send it" in an automated test. Verify the message through **"Open in Gmail"** instead: stub
`window.open`, click it, and assert on the URL it builds; both buttons use the same `compose()`,
so the subject and body encoding is proven for the mailto path too.

## How Claude/Cursor should work here
- Plan mode for non-trivial tasks; use subagents liberally, one task each.
- **Never commit directly to `main`** — every change goes branch → PR → real merge
  (`gh pr merge --merge`, keep branches). Data refreshes included.
- Branch naming: `site13_<monDD>_v<N>` (e.g. `site13_aug11_v1`).
- **Hail Mary:** `hm` → new branch + documented grouped-bullet commit + `git push -u`;
  `hm-1` commits on the current feature branch; `hm++` also PRs and merges.
- **No em dashes in visitor-facing copy** (house rule) — that includes OG/Twitter meta, which shows
  up in share cards. Rewrite with commas, colons or periods. House docs like this one are exempt.
- Verify before done: build, logs, diffs, and actually run it in a browser.
- Delivery-pipeline work goes to its named agent (see `K13-WarRoom/starter-kit/ORG.md`);
  handoff artifacts land in `docs/handoffs/<stage>_<YYYY-MM-DD>.md` and feed the War Room Org tab.

## Settled decisions (dated — do not re-litigate)
- **2026-08-18 · Brand canon is the shipped site, and the square mark is dead.** Kazim saw the
  rounded-square glyph mark (dark tile, cream "1" stem, `#FF4F00` angular "3" — `k13-mark.svg`
  and friends) surface in a client deliverable, did not recognize it as his logo, and ordered it
  destroyed. All `brand/logo/` mark/glyph/lockup files and the mark-based `brand/print/`
  collateral (business card, letterhead, previews) were removed from the working tree that day.
  **The official K13 identity is what `index.html` ships:** the typographic nav lockup
  (Fraunces "K" in ink `#1F2023`, "13" in the orange accent, JetBrains Mono "SOFTWARE STUDIO"
  tag) and the Kazim-approved typographic `favicon.svg`. Never regenerate, reference, or
  recreate the square mark in any project.
- **2026-08-19 · Brand triage.** Kazim reviewed the full brand inventory card by card and ruled:
  keep the typographic identity, the root `favicon.svg`, `assets/kazim.jpg`, all ten Work shots,
  the 13 live color tokens, and the Fraunces/Inter/JetBrains Mono trio. Removed for good: the
  duplicate `brand/favicon.svg`, `assets/kazim 2.jpg`, the orphaned root `Kazim Image.png`,
  Space Grotesk (old README canon), and the entire quarantined mark family (purged, no restore).
  The `brand/` folder is gone; `README.md` was rewritten the same day to match this canon.

- **2026-09-30 · The opening is the page itself, never a video.** After four film directions
  (orbit, bullet time, clay hero, 3 s concepts) Kazim chose a live loader: a skeleton measured from
  the real header and hero masks the page, an orange pen draws the box outlines (logo first), every
  letter is swept in and settles on the real letter's spot, and the mask lifts so nothing moves
  afterwards. Rules that came with it: **no sound** on a loading screen, **super fast** (about a
  second), **logo first**, skipped for reduced motion, deep links and any input. It plays on **every** load,
  reloads included (Kazim, 2026-10-01: "Cmd+R yapınca tekrar oynasın"); it was once per session until then.
  Films belong in reels and case pieces, not in front of the site. Sources of the rejected films:
  `docs/prototypes/INTRO_FILMS.md`.
- **2026-10-01 · The wall's moving screens live behind the hero.** Kazim asked for the sliding
  screens to sit in the hero's background with depth: three rows on a tilted plane, the far one
  blurred, a paper veil so the copy always sits on a quiet ground, a "Pause the screens" control
  (WCAG 2.2.2). The logo wall stays where it was.
- **2026-10-02 · The hero leads with the motto "From 'I wish' to 'it works'."** It replaced
  "Software with an edge." the same day: it tells people right away that we get it done. The hero
  performs it: a wish machine turns real client wishes (from the Work rows) into their live screens.
  The same day he also ruled that the
  site stops leaning on "two people" ("I don't know why you are stuck with two people phrases"):
  headcount is not the pitch, so no "two people" lines in headings, hero, stats, footer, meta or the
  share card. The Studio still shows the portrait; the small photo frames sit beside the contact form.
- **2026-10-02 · Never draw on top of text.** No pencil circles, rings, scribbled underlines or
  strike strokes over headings or copy: not on idle, not on hover, not as an easter egg, not in a
  loader. The Workbench's "idle pencil" (circled the nearest heading after 10 s of no input) did
  exactly that to the hero and was removed. Kazim: "no circles on the text like this, take this as a
  rule and lesson." Hand-drawn marks only on decoration that carries no words. QA note: leave the
  page idle 15 s before a screenshot, so timed effects show up.
- **2026-10-01 · `docs/` is never deployed** (`.vercelignore`). Until that day every handoff and
  report under `docs/` was publicly reachable on k13projects.com.
- **2026-09-26 · The client's name is written `Egg&Out`, no spaces.** Kazim: "call Egg&Out
  without the spaces from now on, everywhere." In HTML that is `Egg&amp;Out`; in capitals
  `EGG&OUT`. Never "Egg & Out" in copy, alt text, labels, captions or commit messages.

## Open decisions (do not decide these yourself)
1. **`pricing/tiger/`** — a named client's confidential pricing, untracked with no git backup.
   Verified not leaked (404 on production, never pushed). Whether it belongs in this repo is
   Kazim's call; it has been deliberately excluded from every commit so far.
2. **Branch protection on `main`** is not enabled, so the never-commit-to-main rule is honour-only.

## Known follow-ups
- The 13 work shots now ship as WebP (`assets/shots/webp/*-750.webp` and `*-1500.webp`); the
  original JPEGs stay in `assets/shots/` as the source of truth. Add both sizes when adding a row.
- `scripts/` has never been committed — `hm.sh`/`ship.sh` exist only on Kazim's Mac.
- Self-XSS `innerHTML` sink in the stepper summary chips (confirmed non-exploitable: no backend,
  no URL-param feed).


---

<!--K13_BROADCAST_START · managed by War Room — do not hand-edit-->
## 📡 War Room Broadcasts (org-wide rules)
> Synced from the K13 War Room. Each entry is a house rule that applies to every K13 project. Managed automatically — edit the rule in the War Room, not here.

<!--bc:2026-06-29-agent-agency-org-->
### 2026-08-13 · Team K13: named departments, the handoff contract & the autonomy contract
**K13 runs as team K13 — a controlled delivery pipeline, not a swarm.** Each AI specialist owns one repeatable stage, emits a predictable artifact, and hands off cleanly to the next. The **main Claude session is the GM (James)** — the only layer that sequences work (the hierarchy is flat: subagents don't spawn subagents, so agents never hand off to each other directly). **Jessica** runs Kazim's desk.

- **Roster + status legend:** `starter-kit/ORG.md` (War Room). Lean 7 to build first: Selma (`solutions-architect`) → Valentina (`brand-dna-designer`) → Natalia (`frontend-engineer`) → Olga (`qa-test-engineer`) → Irina (`security-auditor`) → Kate (`release-engineer`) → Gabi (`report-writer`). Human names are display labels; the functional `name:` is the routing key.
- **Handoff contract + Definition of Done:** `starter-kit/AGENT_HANDOFF_PROTOCOL.md`. Every delivery agent ends with the handoff block (Status / Summary / Files / Risks / Next / Human gate) and writes its artifact to `docs/handoffs/<stage>_<YYYY-MM-DD>.md` (same-day re-run → `_v2`, never overwrite).
- **Delegation is not optional.** James does not do a pipeline stage's work himself and call it done — every stage gets its named agent actually invoked (Task tool, `subagent_type` matching the agent file), even on a small project. **No artifact = the work never happened**: the War Room Org tab reads only `docs/handoffs/`, so skipping the artifact makes team K13 invisible on the board.
- **Autonomy contract — don't drip questions at Kazim.** Agents proceed by default. Only `Human gate` items come back to him: irreversible/destructive steps, money, real scope changes, anything that leaves for a client. Every other decision gets made, then **recorded in the handoff** instead of asked. Questions that genuinely survive are batched at the end of a run — never one at a time.
- **Parallel work:** sequential by default; James may fan out several agents **concurrently for independent work** (QA dimensions, security + a11y, research) and relay findings between them — each still writes its own handoff.
- **Agent vs skill:** token-heavy + isolatable → agent; in-context checklist/workflow → skill (compliance-checklist, media-generation).

<!--bc:2026-08-25-fitcheck-house-word-->
### 2026-08-25 · fitcheck: run the responsive-readiness pass after any layout, breakpoint or nav change
**Run `fitcheck` after any layout, breakpoint or nav change** — those are exactly the edits that regress one screen size while fixing another. `fitcheck` (alias `fit`) is the K13 responsive-readiness house pass: nine viewports (320 → 1920, including the two landscape sizes everyone forgets), a shared measurement harness with a trust gate, and the bug classes that only appear at one size — horizontal leaks, tap targets under the WCAG 2.5.8 AA floor, panels that are invisible but still in the tab order, scroll containers that strand their own header, and heroes that exactly fill a short viewport so nothing signals the page continues. It measures, looks, fixes at the source, and re-measures. It is also part of the P5 "done" checklist (`starter-kit/CONVENTIONS.md`). Skill: `~/.claude/skills/fitcheck/SKILL.md`.

<!--bc:2026-08-28-cc-commit-check-->
### 2026-08-28 · CC? — the pre-close commit check
**Ask `CC?` before closing a tab.** It means: "is anything lost if I close right now?" The session audits itself, read-only, and answers in one of two shapes: `✅ CC: safe to close` (one line of why), or `⚠️ CC: save these first` listing each unsaved item with a proposed save action, then waits for your pick. The sweep, in order: (1) git — uncommitted session work, unpushed commits, feature branches without a PR, open unmerged PRs (a repo's own known auto-refresh churn is excluded, not every dirty tree); (2) unwritten rules — corrections, decisions, or coined commands from the conversation not yet in this repo's `CLAUDE.md`/`Lessons.md`/memory; (3) deferrals not parked in a tracking ledger if this repo has one; (4) deliverables stranded in scratchpad/temp or outside any repo; (5) end of a working day — offer a journal/changelog entry if this repo keeps one, never auto-write it. `CC?` itself never saves anything — saving only happens after you choose.

<!--bc:2026-08-28-gstack-berths-->
### 2026-08-28 · GStack Berths: one browser slot per project
**Claim a `berth` for GStack Browser, do not share it blind.** GStack Browser is one shared Chromium instance for the whole machine by default (one profile directory, one fixed port 34567), not per project. Two Claude Code sessions in two different projects that both touch it (`/qa`, `/design-review`, `/browse`, `connect-chrome`, sidebar chat) end up driving the exact same window, stealing each other's active tab. The fix uses gstack's own supported per-workspace knobs: pin `CHROMIUM_PROFILE` and `BROWSE_PORT` in this project's `.claude/settings.json` under "env", derived from the dev port already claimed in `CONVENTIONS.md` so there is never a second table to drift: `BROWSE_PORT = <dev port> + 30000` (e.g. 9137 to 39137), `CHROMIUM_PROFILE = ~/.gstack/berths/<shortcode>`. Claim it once, the next time you are actively working in this project with GStack Browser alongside another active session; until claimed, nothing changes (opt-in, additive, no breakage). Never reach for `browse --force-restart` as a shortcut instead: it destroys the other session's tabs, cookies, and logins. Full spec + root cause: `K13-WarRoom/starter-kit/GSTACK_BERTHS.md`.

<!--bc:2026-09-02-merged-means-deployed-->
### 2026-09-02 · Merged means deployed: verify the live deploy from the host, never from a note
**On a project with a live address, `hm++` is finished when the production deployment made from the merge commit is READY and the URL was actually fetched, not at the merge.** Report "merged and live", or say exactly which of the two is missing. Underneath it: (1) **Deploy state is verified from the host (Vercel: `vercel projects ls`, or the REST API for a project linked to this repo), never from a `CLAUDE.md` line.** Those notes go stale: Lobster Lab's said "Vercel (planned)" for weeks while lobsterlab.us was live and auto-deploying, and trusting it led a session on 2026-09-02 to declare a live site "not wired", create a duplicate Vercel project, and briefly flip the real site to `noindex`. The Vercel project name may not equal the shortcode (`lobster-lab` vs `lobster`). (2) **A project that is not auto-deploying from `main` is a broken setup, not a state to report**: wire it (`Deploy Preview <shortcode>` adopts an existing project by its GitHub link and never touches Production's `NEXT_PUBLIC_SITE_URL` when the project serves another domain), then record the Vercel project, production branch, domains and the production site URL in this file's Deploy section, and keep that section true. Golden rule (Kazim, 2026-09-02): we learn from our mistakes once; the same one never gets a second session.

<!--bc:account-check-json-not-context-2026-09-14-->
### 2026-09-14 · Verify the logged-in account from ~/.claude.json, never from the session context line
**`~/.claude.json` → `oauthAccount.emailAddress` is the only source of truth for which account a terminal holds.** The session's injected context line ("The user's email address is …") is **not** — the two can disagree. On 2026-09-14 the context line said `algosift@gmail.com` while the real login was `eren@tigerhospitalitygroup.com`; a session took the context line at face value, declared a K13 Vercel verification blocked by the Gold Rule, and shipped that phantom caveat inside a delivered audit report. Kazim caught it.

Run the check **before** stating which account is active, and **before** declining any work on account grounds:

```
python3 -c "import json;print(json.load(open('/Users/k13/.claude.json'))['oauthAccount']['emailAddress'])"
```

**Brief subagents with the verified account.** A subagent inherits the same context line and will repeat the same wrong inference in its own handoff — which is exactly how the phantom caveat reached a delivered artifact instead of dying in one session's scratch.

**Wrong is wrong in both directions.** The Gold Rule guards against touching Halil's EDISYN accounts, but the opposite failure is just as real: falsely blocking legitimate K13 work, leaving a verification undone, and burying an untrue blocker in a deliverable. Neither counts as the safe side.

<!--bc:name-the-request-2026-09-18-->
### 2026-09-18 · Every change names the request that caused it
**Every change names the request that caused it.** When you ship a change that a person can see,
record where the ask actually came from: a line in the project's scope, an item in `tasks/todo.md`,
a dated email or call note, or `Kazim, verbal, <date>`. If the change was ours (our own QA fix, our
own improvement), say `K13 initiated`, honestly. Never leave it blank and never invent one.

**If the ask has no home yet, writing it into the project's scope or `tasks/todo.md` is the first
step, before the work ships.** That is the whole point: the rule exists to catch asks that were
never written down anywhere.

**Why:** the Cosmos intake audit on 2026-09-16 found four of Lorena's requests that had survived two
full feedback rounds and several QA gates without existing in any list, any handoff or any todo. They
did not slip past a bad process; they slipped past because nothing in the process was obliged to
point back at them. A request nobody wrote down is a request that evaporates, and no QA gate can
catch what was never recorded.

This became a house rule on 2026-09-18, alongside the studio's new **Before & After** visual change
log in the War Room, which carries the request line on every capture. The rule is not limited to
that feature: it applies to every shipping agent in every project, whether or not a screenshot is
involved.

Full record: `K13-WarRoom/docs/BEFORE_AND_AFTER.md`.

<!--bc:before-after-capture-2026-09-22-->
### 2026-09-22 · Before & After: capturing the visual change is part of hm++
**When a merge changes something a person can see, `hm++` is not finished until Before & After
has it.** The studio records what shipped in five places and what it **looked like** in none; this
is the one that keeps the picture. Two commands, from the War Room:

```
python3 .k13/beforeafter before --key <KEY> --url <live url> --sel "<css of the section>" \
        --section "<recurring category, e.g. Hero>" --label "<this capture's title>" \
        --desc "<one or two plain sentences>" --who "<who shipped it>" \
        --request "<where the ask lives>" --pr <n> --apply        # BEFORE you merge
python3 .k13/beforeafter after --key <KEY> --commit <merge sha> --apply   # after the merge
```

The `after` step verifies the production deployment on Vercel itself, on that merge commit, then
shoots the same URL again. **`hm` and `hm-1` never capture**: nothing reaches production, so there
is no "after".

**What it refuses on its own:** EDISYN is never photographed, and a pair with no real difference is
filed as `no_visible_change` rather than as a picture of nothing.

**Every capture names its request** (a scope line, a `tasks/todo.md` item, a dated note, or
`Kazim, verbal, <date>`); our own idea is honestly `K13 initiated`. If the ask has no home yet,
writing it into the project's scope or todo is the first step, before the capture.

**A site that opens with an intro overlay** needs a longer settle than the 2.5s default, or every
shot is a picture of the intro: prefix the command with `BEFOREAFTER_SETTLE=9`.

**Why:** Kazim asked on 2026-09-22 why Before & After had nothing from that day's Egg&Out work.
It had nothing because nobody ran it: seven `hm++` merges went out and not one was captured. The
rule existed only in the War Room's own `CLAUDE.md`, so a session onboarded from the genome dropped
a journal note on every one of those merges, because the journal ritual is in the genome, and
captured none, because this one was not. The step is now in the genome (section 3) and here, so a
fresh agent in any project meets it where it works.

Full spec and decision record: War Room `CLAUDE.md` section "Before & After" and
`docs/BEFORE_AND_AFTER.md`.

<!--bc:write-once-no-shared-file-2026-09-22-->
### 2026-09-22 · Write a rule once, and never into a file many sessions edit by hand
**Write a rule once, and never into a file many sessions edit by hand.**

Two rules, both from the 2026-09-22 session where Claude's memory index turned out to be full
and the cause turned out to be the same one behind the journal erasing itself.

**1. Write it once.** A correction or a standing rule goes to this project's
`.claude/Lessons.md`, or to its `CLAUDE.md` when it is a standing rule. Write a Claude memory
note **only when the fact has no browsable home**: a tool's trap, or something about a person.
The old rule said "both, not either", so every correction was written twice. `CLAUDE.md` has no
size limit and the memory index has a hard one, so the double writing broke memory first: 56 of
121 notes were a second copy of a rule already written elsewhere, and the index quietly stopped
loading the newest notes.

**2. No shared file that many sessions write by hand.** This is the shape behind the journal
erasing itself, the shared checkout losing another tab's edits, and the memory index silently
dropping notes: one file, many writers, and the loser is never told. A document more than one
session writes must be either **split**, so each writer owns its own file, or **generated** from
something that already exists. And whatever assembles the shared view must **say out loud what it
dropped**: silent loss is the failure, not the dropping.

**What this changed for you: `.claude/Lessons.md` is generated now.** Each lesson is its own file
under `.claude/lessons/`. Do not append to `Lessons.md`; it will be overwritten, deliberately.

    k13-lesson --new "the rule you just learned"    # creates the file, correctly numbered
    k13-lesson --write                              # regenerates Lessons.md

The generator refuses to overwrite a `Lessons.md` whose headings are not all backed by a file, so
a lesson appended by hand stops the run and is never lost. The migration itself was verified byte
for byte in every repo before anything was written.

<!--bc:2026-06-26-imagegen-global-->
### 2026-06-26 · Image generation: free, via /imagegen (Gemini Nano Banana) + central pool
**Need an image? Generate it free with `/imagegen`.** Run `/imagegen <subject, style, aspect>` (or read `/Users/k13/Desktop/PROJECTS/K13-WarRoom/starter-kit/IMAGEGEN.md` and follow it). Engine: GStack Browser → Google Gemini (Nano Banana), free / no credits; fallback Bing Image Creator. The agent never types your password, it asks you to log in if prompted.

**Central pool, zero duplicates.** Every generated image lands first in the shared pool `/Users/k13/Desktop/PROJECTS/generatedAssets/` with a raw name (`gen_<proj>_<topic>_<n>.png`) and is **never committed**. On your approval the used image is **moved** (not copied) into this project's correct folder with a proper name; unused variants stay in the pool. Only the final relocated, renamed asset enters the repo, under this project's own git rules (branch → PR → merge).

<!--bc:2026-06-26-reports-archive-and-qa-->
### 2026-06-26 · Reports: archive every version + pass two-agent Chrome QA before "done"
**Archive every report, never overwrite.** Each report is written to `docs/reports/<Project>_<Type>_<YYYY-MM-DD>.html` (e.g. `Miramar_Development-Report_2026-06-25.html`). Same-day re-run → append `_v2`, `_v3`. The dated file is **permanent**, if the site links a "latest", copy/symlink to it, but never delete or overwrite an older dated report. Filenames are client-facing, so they carry the project name + type + date and explain themselves in an email. Types: `Development-Report`, `Security-Audit`, `Legal-Compliance`.

**No report is "done" until it passes the two-agent Chrome QA gate.** One agent **builds** the report; a second **tests** it, opens it in Chrome, screenshots desktop + mobile like a real user, and runs the design-review checklist (spacing, hierarchy, AI-slop, palette match, motion + `prefers-reduced-motion`, broken assets/links, Gmail-safe base64). Loop: fail → fix → re-review, until **design approval**. Only on PASS does the report take its final archived name and ship. Record the approval in a sidecar `docs/reports/<same-name>.qa.json` (date, screenshots, verdict) so "design signed off" is provable. Applies to **all** reports, dev, security, legal.

<!--bc:2026-07-07-icloud-eviction-materialize-->
### 2026-07-07 · iCloud eviction: check/materialize local files before running builds & dev servers
**Projects live under `~/Desktop/PROJECTS`, inside macOS iCloud "Desktop & Documents" sync.** iCloud silently evicts files that sit unused for a few days into dataless placeholders. An evicted `node_modules` (or any local dependency/asset) makes a process **hang with no error and no output**, e.g. `npm run dev` starts, the process stays alive but never binds its port and prints nothing, because `require()` is blocking on the iCloud download. This is **not** a code, port, or sandbox bug.

**Fallback protocol, before ANY build / dev / test / install that reads local files:**
1. **Check** files are materialized, not evicted: `find node_modules -flags dataless` (non-zero = evicted), or look for `*.icloud` placeholders.
2. **If evicted, download them yourself:** `brctl download <path>` (e.g. `brctl download node_modules`), or read/touch the files to trigger it; wait until the dataless count is 0.
3. **If you can't materialize them** (download stalls, offline, permissions): **ask Kazim to download the folder from iCloud**, wait for confirmation, then run.
4. **Then run**, and give the first run extra time; materialization during `require()` can exceed a short poll window, so don't call it failed too early.

Never silently second-guess a hanging dev server as a code/sandbox issue again, check iCloud eviction first.

<!--bc:reports-archive-outside-git-2026-09-03-->
### 2026-09-03 · Reports: superseded versions archive outside git, finals live in the delivery bundle
**Superseded reports and delivery files move out of git, not into it.** The 2026-06-26 rule stands exactly as written: every report is dated, archived, never overwritten, and gated by the two-agent Chrome QA pass. What's new: only the current report of each type stays tracked in `docs/reports/` (and `docs/delivery/` for the pre-launch delivery kit); the moment a newer dated version exists, or the file has been copied into the project's `<Project> Delivery Bundle by K13/` under its stakeholder-facing name, the older file is superseded and moves (plain `mv`, not `git mv`) into a gitignored `docs/reports/archive/` or `docs/delivery/archive/` folder beside it. Nothing is lost: git history already holds every version that was ever committed, so a superseded file stays retrievable with `git show <commit>:<path>` even after it leaves the working tree. The one real risk is that the archive folder lives only on this machine; the mitigation is that its path is fixed and known (list it in `CC?`/`CCC?` sweeps) plus a periodic external copy once the archive grows large enough to matter, never iCloud (known `.git` eviction problems in this house) and never a second git repo. Full convention, naming grammar, and the apply-to-an-existing-project checklist: `starter-kit/REPORTS.md`. First applied to TLC, 2026-09-03.

<!--bc:design-gold-rules-2026-10-15-->
### 2026-10-15 · Design gold rules: what every new K13 screen must and must never do
**These hold in everything newly built in this project.** Each one is Kazim's own rule, with its reason in one line so it can be applied to a case it does not name. Shipped palettes and live pages stay as they are unless he asks.

- **Never purple.** No violet, indigo, lavender, periwinkle or purple gradient, in a UI, report, deck, doc, chart, artifact or image prompt. A palette that reads lavender counts as purple whatever its token is called. Why: Kazim reads it as the default AI palette.
- **No coloured line on any edge of a container.** No stripe or bar down the left, across the top or along the bottom of a card, panel, list row, tile, quote or nav item, not even 1px. Show a category or a state with a pill or label colour, or a tint of the whole surface. A border that runs all the way round (a state, a selection, focus) is fine. Why: he reads the edge stripe as "the effect AI puts on everything", and it kept coming back.
- **K13's own dark is graphite `#1F2023`.** Surfaces in K13's own brand (film end cards, decks, artifacts, reports) use graphite where they used navy. A client's palette stays the client's: this never recolours their tokens. Why: navy belongs to another brand's palette, not K13's.
- **The footer year sets itself.** Keep the current year in the HTML as the no-JavaScript fallback and fill it from `new Date().getFullYear()` (a `[data-current-year]` span and a tiny script), or the framework's equivalent at render time. Grep the page for the attribute first: Miramar's story chapters carry `data-year="1920"`, and a `[data-year]` script would have overwritten that history with this year. Why: a hand-typed year makes a live site look abandoned the day the calendar turns.
- **The UI leads the eye.** A screen is done when nobody is left deciding where to look next. Where attention scatters (a change appears away from where it was caused, the next step sits below the fold, something new lands), add a small, quiet motion that makes the connection, with a static equivalent under `prefers-reduced-motion`. Record each lost point and its fix as a lesson. Worked example: `OKTO-Atlas/docs/design/EYE_LEADING.md`.
- **Nothing breathes with its content.** A container whose content changes over time (an animation, a live feed, a loading or status label, rotating text) holds its largest size from the first frame, so nothing around it moves. Reserve the space for every state: invisible placeholders instead of elements that appear and disappear, fixed heights for feeds, one shared grid cell for labels that swap, `whitespace-nowrap` on a line that wraps only in some states; cards side by side share one height. Prove it: measure each container through one full cycle, on desktop and on a phone, in the longest language; one height each. Why: a layout that grows and shrinks tires the eye.
- **Fit the screen.** A section's title and its main graphic fit on one screen together on a 13, 14 and 16 inch MacBook, a 1080p monitor and an iPad; on a phone, the title and the top of its graphic show together. Size it dynamically, never with per-screen numbers: headlines `clamp(min, min(vw, vh), max)`, section spacing and title-to-graphic gaps in `vh`/`svh`, and a graphic that takes the height left under its title. Trap: Chrome reads `100cqh` as 0 inside a column that has only a `min-height`. Prove it with a script that measures title top to graphic bottom per section on the standard screens and also fails on a graphic drawn at zero size. Why: sizing by width alone gives a 14 inch laptop the headline and padding of a 1080p monitor.

<!--bc:shipping-safety-2026-10-15-->
### 2026-10-15 · Shipping and safety: npm audit, DMARC, the analytics standard, one tab one tree one branch, redact
**Five habits that apply to every ship from this project.** Each with its reason in one line.

- **`npm audit` is part of done.** On any Node project, run `npm audit` before calling a ship done, and fix or record every high or critical advisory. Trap: `npm audit fix --omit=dev` strips dev dependencies out of `node_modules`, so the next build fails and looks like the upgrade broke it; a plain `npm install` restores it. After any dependency bump, re-read the built HTML, not just the build log. Why: nothing reports a CVE on a live site by itself; Lobster Lab sat on two critical unauthenticated RCE advisories until a sweep looked.
- **DMARC on every domain we look after, as part of `polish`.** Without it anyone can send mail as the domain, because the From line is just text. Phase it, never switch it on blind: a domain with mailboxes starts at `p=none` with reports, then `quarantine`, then `reject` once the reports show only known senders. A domain with no mailboxes goes straight to `v=spf1 -all` plus `p=reject`. Website form mail always sends from a `notify.<domain>` subdomain, DKIM-signed, so it passes either way. A client's or friend's self-run domain is theirs: advise, do not change it. Why: for a client like an investment firm, a spoofed domain is the classic "wire to this new account" scam.
- **Analytics follow the house standard**, `K13-WarRoom/starter-kit/ANALYTICS.md`: GA4 behind a consent banner and nothing loads before an explicit opt-in, inert without an ID, one property per site in the client's own Google account, `gtag` pushing the real `arguments` object, the GA4 collect hosts in the CSP, and a real-hit test before calling it working. Why: California's CIPA suits target ordinary trackers that fire before consent.
- **One tab, one tree, one branch.** A branch belongs to the tab that created it or first committed on it. When another live tab shares this checkout, do not commit from it: make your own worktree with `k13-cabin` (it starts from your own unmerged branch, or from `main`) and work only there; `k13-cabin --done` closes it after the merge. Run `k13-tabguard status` before every ship, and again before `gh pr create` and `gh pr merge`, which git cannot hook. Never run `git reset --hard`, `git checkout -- <file>` or `git stash` in a checkout another tab is in: they act on every tab's uncommitted work at once. Why: on 2026-09-21 a tab's commit landed on another tab's already merged branch and never reached a PR.
- **Redact before anything naming a person ships.** Commit messages, PR bodies, docs, reports and handoffs are read by the people they describe. Take out what they would not be glad to read about themselves, never narrate a correction about a person ("X was placed here and then moved"), and state what someone owns, never what they are not or who they are not level with. A decision's reason belongs in the record; a comparison of people does not. Do the pass before the commit. Why: a PR body can be edited afterwards, a merged commit message cannot.

<!--K13_BROADCAST_END-->
