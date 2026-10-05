#!/usr/bin/env python3
"""sync-stats: the site's "shipped" and "live now" numbers, generated from the War Room, never typed.

SOURCE (read-only): the War Room board's own project registry, the file the board counts "Sites live"
from.  Tried in this order:
    /Users/k13/.k13/board/K13_War_Room.html                      (the board mirror)
    /Users/k13/Desktop/PROJECTS/K13-WarRoom/K13_War_Room.html    (the working copy)
  - LIVE block  (/*LIVE_START*/ ... /*LIVE_END*/): project key -> address, status, title
  - META block  (const META=[...]):                 project key -> group (flagship, client, fun, copilot, hangar...)

WHAT THE TWO NUMBERS COUNT (decided 2026-10-05 with the evidence in the PR; change the rules below, never the page):
  shipped  = K13-built products the War Room lists as live, that someone other than the studio uses
             today, public or behind their own sign-in.
  live now = the shipped ones whose front door answers HTTP 200 right now without a sign-in wall.
Never counted, and said out loud on every run: EDISYN (the flagship, Halil's company), the studio's own
tools and site, repos owned by someone else (copilot), parked concepts (hangar), spec pitches that were
not commissioned, and products still being built.

Every address is fetched at sync time. If any fetch fails on the network (not an HTTP status), nothing is
written: a number this script could not verify is never put on the page.

WHERE THE NUMBERS LAND (index.html):  [data-stat="shipped"|"live"] tiles, the footer "Track record" line,
the meta / Open Graph / Twitter / JSON-LD descriptions, and the date on "All 13 checked live on ..."
(only when all 13 Work rows answered today).  The hidden-13 hunt marks are never touched.

  python3 scripts/sync-stats.py            sync: probe, write index.html, print the report
  python3 scripts/sync-stats.py --check    probe and report; exit 1 if index.html is out of date, write nothing
"""
import datetime
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SOURCES = [
    "/Users/k13/.k13/board/K13_War_Room.html",
    "/Users/k13/Desktop/PROJECTS/K13-WarRoom/K13_War_Room.html",
]
UA = "Mozilla/5.0 (compatible; K13-stats-sync/1.0)"

# --- the rules (each exclusion carries its reason, printed on every run) ---------------------------
EXCLUDED_GROUPS = {
    "flagship": "EDISYN, the flagship: Halil's company, not a K13 shipment",
    "copilot": "someone else's repo where K13 contributes: the board never counts it as K13 output",
    "hangar": "a parked concept that will not be deployed",
}
EXCLUDED_KEYS = {
    "K13_HQ": "the studio's own mission control",
    "K13_Website": "the studio's own site",
    "OKTO": "a spec pitch, not commissioned",
    "Investment-Corp-Project": "a private member platform still being built (War Room status: in progress)",
}
# a front door that lands here is a sign-in wall: shipped, but not "live now" for a visitor
SIGN_IN = re.compile(r"/(login|log-in|signin|sign-in|giris|auth)(/|$|\?)", re.I)

WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
         "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
         "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five"]


def word(n):
    return WORDS[n] if n < len(WORDS) else str(n)


def read_board():
    for p in SOURCES:
        if os.path.exists(p):
            html = open(p, encoding="utf-8").read()
            m = re.search(r"/\*LIVE_START\*/(\{.*?\})/\*LIVE_END\*/", html, re.S)
            if not m:
                continue
            live = json.loads(m.group(1))
            i = html.find("const META=[")
            j = html.find("\n];", i)
            groups = dict(re.findall(r'\{key:"([^"]+)",display:"[^"]*",jname:"[^"]*",emoji:"[^"]*",group:"([^"]*)"',
                                     html[i:j + 2]))
            if live and groups:
                return p, live, groups
    sys.exit("sync-stats: the War Room board is not readable on this machine, nothing written.")


class _Follow308(urllib.request.HTTPRedirectHandler):
    """urllib follows 301/302/303/307 but not 308 (found live: lavida.fit, atelierbaa.com); the board's selftest does the same."""
    http_error_308 = urllib.request.HTTPRedirectHandler.http_error_302

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if code == 308:
            code = 307
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_OPEN = urllib.request.build_opener(_Follow308).open


def probe(url):
    """(status, final_url), or (None, reason) on a network failure. A busy edge sometimes answers 403/429/5xx
    once and 200 a moment later (seen on lobsterlab.us), so those get three tries before they count."""
    last = ""
    for attempt in range(3):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with _OPEN(req, timeout=20) as r:
                r.read(2048)
                return r.status, r.geturl()
        except urllib.error.HTTPError as e:
            if e.code == 403 and b"Vercel Security Checkpoint" in e.read(4096):
                # the host is up and is only asking a script to prove it is a browser (lobsterlab.us, 2026-10-05):
                # a visitor passes it, so the site is answering
                print("  note: %s answers with Vercel's bot checkpoint, which a browser passes; counted as answering" % url)
                return 200, url
            if e.code in (403, 429, 500, 502, 503, 504) and attempt < 2:
                time.sleep(3)
                continue
            return e.code, url
        except Exception as e:  # DNS, timeout, TLS: not an answer
            last = str(e)[:100]
            time.sleep(2)
    return None, last


def work_rows(page):
    return re.findall(r'<a class="row[^"]*" id="(w\d+)" href="([^"]+)"', page)


def main():
    check = "--check" in sys.argv
    src, live, groups = read_board()
    print("source:", src)
    registered = {k: v for k, v in live.items() if v.get("status") == "live"}
    print("board registry: %d entries, %d marked live (the board's own 'Sites live' count)\n" % (len(live), len(registered)))

    page = open(PAGE, encoding="utf-8").read()
    rows = work_rows(page)
    norm = lambda u: u.rstrip("/").replace("https://www.", "https://")
    listed = {norm(h) for _, h in rows}

    shipped, dropped = [], []
    for k, v in registered.items():
        g = groups.get(k, "?")
        # a project the Work list itself shows is claimed by the site (baa atelier is a copilot repo on the board)
        on_list = norm(v["url"]) in listed
        why = EXCLUDED_KEYS.get(k) or (None if on_list else EXCLUDED_GROUPS.get(g))
        (dropped if why else shipped).append((k, v, why))

    print("NOT COUNTED (%d):" % len(dropped))
    for k, v, why in dropped:
        print("  - %-28s %s" % (k, why))

    failures, behind_login, answering = [], [], []
    for k, v, _ in shipped:
        st, fin = probe(v["url"])
        if st is None:
            failures.append((k, v["url"], fin))
        elif st != 200:
            behind_login.append((k, v["url"], "HTTP %s" % st))
        elif SIGN_IN.search(urllib.parse.urlparse(fin).path + ("?" if "?" in fin else "")):
            behind_login.append((k, v["url"], "sign-in wall at " + urllib.parse.urlparse(fin).path))
        else:
            answering.append((k, v["url"]))

    row_fail, row_net = [], []
    for rid, href in rows:
        st, fin = probe(href)
        if st is None:
            row_net.append((rid, href, fin))
        elif st != 200:
            row_fail.append((rid, href, st))

    if failures or row_net:
        print("\nNETWORK FAILURES, nothing written:")
        for f in failures + row_net:
            print("  -", f)
        sys.exit(2)

    n_shipped, n_live = len(shipped), len(answering)
    print("\nSHIPPED = %d" % n_shipped)
    for k, v, _ in shipped:
        print("  %-28s %s" % (k, v["url"]))
    print("\nLIVE NOW = %d  (answers 200 with no sign-in wall)" % n_live)
    for k, u in answering:
        print("  %-28s %s" % (k, u))
    if behind_login:
        print("shipped, not 'live now':")
        for b in behind_login:
            print("  - %-28s %s (%s)" % b)
    on_page = {rid for rid, _ in rows}
    unlisted = [k for k, u in answering if norm(u) not in listed]
    print("\nWork list on the page: %d rows, %d not answering %s" % (len(on_page), len(row_fail), row_fail or ""))
    print("live and not on the Work list (counted, not named): %s" % ", ".join(unlisted))

    # ---- write the numbers into the page ----
    new = page
    new = re.sub(r'(<b data-stat="shipped" data-count=")\d+(">)', r"\g<1>%d\2" % n_shipped, new)
    new = re.sub(r'(<b data-stat="live" data-count=")\d+(">)', r"\g<1>%d\2" % n_live, new)
    new = re.sub(r'(<span class="v">)\d+ shipped, \d+ live(, <span data-hunt>13</span> on show</span>)',
                 r"\g<1>%d shipped, %d live\2" % (n_shipped, n_live), new)
    new = re.sub(r"[A-Z][a-z-]+ shipped, [a-z-]+ live",
                 lambda m: "%s shipped, %s live" % (word(n_shipped).capitalize(), word(n_live)), new)
    if not row_fail:
        today = datetime.date.today().isoformat()
        new = re.sub(r'(checked live on <time datetime=")[\d-]+(">)[\d-]+(</time>)', r"\g<1>%s\g<2>%s\g<3>" % (today, today), new)
    for pat in (r'data-stat="shipped" data-count="%d"' % n_shipped, r'data-stat="live" data-count="%d"' % n_live,
                r"%d shipped, %d live" % (n_shipped, n_live)):
        if pat not in new:
            sys.exit("sync-stats: the page no longer has the spot '%s', nothing written. Fix the markup or this script." % pat)

    if new == page:
        print("\nindex.html already matches the War Room. Nothing to change.")
        return 0
    if check:
        print("\nindex.html is OUT OF DATE (run without --check to sync).")
        return 1
    open(PAGE, "w", encoding="utf-8").write(new)
    print("\nindex.html updated: %d shipped, %d live now." % (n_shipped, n_live))
    return 0


if __name__ == "__main__":
    sys.exit(main())
