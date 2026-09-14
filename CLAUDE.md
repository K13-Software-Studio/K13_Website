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
Static HTML/CSS/JS — **no build step, no `package.json`**. One `index.html` carries its own inline
CSS and JS. Lenis for smooth scroll (jsDelivr, SRI-pinned). Google Fonts. Contact is a client-side
`mailto:` composer, not a backend form.

Because there is no bundler, **`index.html` is the whole application** — treat edits to it with the
care you'd give a source tree, and expect concurrent agents to collide there. Partition by file.

## Security & deploy
- `vercel.json` carries the CSP and 5 security headers. **The CSP allowlist is derived from captured
  network requests** (`fonts.googleapis.com`, `fonts.gstatic.com`, `cdn.jsdelivr.net`) — if you add
  an external resource you MUST update it, and prove it by serving locally with those exact headers
  and confirming zero CSP violations. A wrong CSP takes production down on the next deploy.
- `script-src` currently needs `'unsafe-inline'` because the JS is inline. Externalising that script
  would let it go — no build step required. Known follow-up.

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

This is also the *better* test: it lets you assert on the encoded subject and body, which no pass
has actually verified yet.

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
  (Fraunces "K" in ink `#141D35`, "13" in the orange accent, JetBrains Mono "SOFTWARE STUDIO"
  tag) and the Kazim-approved typographic `favicon.svg`. Never regenerate, reference, or
  recreate the square mark in any project.
- **2026-08-19 · Brand triage.** Kazim reviewed the full brand inventory card by card and ruled:
  keep the typographic identity, the root `favicon.svg`, `assets/kazim.jpg`, all ten Work shots,
  the 13 live color tokens, and the Fraunces/Inter/JetBrains Mono trio. Removed for good: the
  duplicate `brand/favicon.svg`, `assets/kazim 2.jpg`, the orphaned root `Kazim Image.png`,
  Space Grotesk (old README canon), and the entire quarantined mark family (purged, no restore).
  The `brand/` folder is gone; `README.md` was rewritten the same day to match this canon.

## Open decisions (do not decide these yourself)
1. **`pricing/tiger/`** — a named client's confidential pricing, untracked with no git backup.
   Verified not leaked (404 on production, never pushed). Whether it belongs in this repo is
   Kazim's call; it has been deliberately excluded from every commit so far.
2. **Branch protection on `main`** is not enabled, so the never-commit-to-main rule is honour-only.

## Known follow-ups
- ~2.5MB of oversized `assets/shots/*.jpg` with no WebP or `srcset`; plus an orphaned 1.9MB
  `Kazim Image.png` and an unused `assets/kazim 2.jpg`.
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

<!--K13_BROADCAST_END-->
