#!/usr/bin/env python3
"""sync-world: the Workbench World's data file, generated, never hand-edited.

READS
  data/world-places.json   hand-kept, sourced places and geography (the contract with the overworld builder)
  data/world-shops.json    hand-kept, public facts per shop (palette, menu, signature, task, toy, crowd) and the halls
                           (places sharing one address); image and full-page capture sizes are refreshed from
                           assets/world/sites/manifest.json (scripts/capture-sites.py)
  index.html               the 13 public Work rows (id wNN, name, address, one-liner): the list of what may appear
  War Room, READ-ONLY (/Users/k13/Desktop/PROJECTS/K13-WarRoom and the board mirror):
    .k13/agent-activity.js            who (current roster) touched which project, by date; agent name + project + date only
    /Users/k13/.k13/board/K13_War_Room.html   the LIVE block: confirms each Work row is live
  git log, READ-ONLY, of each of the 13 projects' repos (merge commits only, dates only)
WRITES
  js/world/world-data.js   window.K13World.data = {generated, places, activity, news, geo, shops, halls}, K13World.project()

PUBLIC-SAFE RULE (docs/WORKBENCH_WORLD_2.md): only the 13 Work rows and the site itself. Nothing is copied from commit
messages, handoff summaries, the journal, Our Story, money or any non-Work project (EDISYN, OKTO, TLC, ICP and the rest are
never read). From the records the script keeps three things only: a date, a count and a current-roster person id.
News lines are built from templates ("<name> shipped an update"), never from private text.

DETERMINISTIC: no wall clock. "generated" is the newest ship date found; the same inputs write the same file.

PROJECTION (also written at the top of world-data.js)
  equirectangular, longitude scaled by cos(33.4 deg). Tile = 650 m. West -118.55, north 34.15.
  x = (lng - west) * kx,  y = (north - lat) * ky,  kx = 111.32*cos(33.4)/0.65, ky = 110.95/0.65
  Map is 229 x 282 tiles (x 0..228, y 0..281). project() returns fractional tile coordinates; tile = floor().

SNAPPING (done here so the data is final; the engine just reads tx, ty)
  Buildings are placed in order (HQ, then the Work rows, row by row, place by place). Each takes its own tile
  floor(project(lat,lng)) when that tile's centre is on land and free; otherwise the nearest free land tile (ring search,
  ties broken top to bottom, left to right) whose centre is still in the place's own district.

  python3 scripts/sync-world.py            write js/world/world-data.js, print the report
  python3 scripts/sync-world.py --check    write nothing; exit 1 if the file on disk is out of date
  node scripts/check-world-data.js         verify the result
"""
import datetime
import json
import math
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLACES = os.path.join(ROOT, "data", "world-places.json")
SHOPS = os.path.join(ROOT, "data", "world-shops.json")
SITES_DIR = os.path.join(ROOT, "assets", "world", "sites")
PAGE = os.path.join(ROOT, "index.html")
OUT = os.path.join(ROOT, "js", "world", "world-data.js")
WARROOM = "/Users/k13/Desktop/PROJECTS/K13-WarRoom"
PROJECTS_DIR = "/Users/k13/Desktop/PROJECTS"
BOARD = ["/Users/k13/.k13/board/K13_War_Room.html", WARROOM + "/K13_War_Room.html"]
SITE_REPO = "K13_Website"

# current roster only (js/world/people.js ids). Former crew are not in this list, so they can never appear.
ROSTER = ["james", "jessica", "natalia", "camila", "olga", "kate", "valentina", "mariana", "leticia", "gabi", "nastiya",
          "ana", "selma", "baha", "fadil", "memotti", "emre", "chefito", "halodinho", "tony", "kazim", "gurkan"]
REFS = ["origin/main", "k13-origin/main", "main", "origin/master", "master"]
ACTIVITY_DAYS = 21   # how far back a crew member counts as having touched a project
NEWS_DAYS = 45
MAX_NEWS = 13

skipped = []


def say_skip(msg):
    skipped.append(msg)


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ---------- geometry ----------
def make_proj(p):
    cosr = math.cos(math.radians(p["refLat"]))
    kx = round(111.32 * cosr / p["tileKm"], 4)
    ky = round(110.95 / p["tileKm"], 4)
    w = int(math.ceil((p["east"] - p["west"]) * kx))
    h = int(math.ceil((p["north"] - p["south"]) * ky))
    return {"west": p["west"], "east": p["east"], "north": p["north"], "south": p["south"], "refLat": p["refLat"],
            "tileKm": p["tileKm"], "kx": kx, "ky": ky, "w": w, "h": h}


def project(pr, lat, lng):
    return (lng - pr["west"]) * pr["kx"], (pr["north"] - lat) * pr["ky"]


def unproject(pr, x, y):
    return pr["north"] - y / pr["ky"], pr["west"] + x / pr["kx"]


def pip(lat, lng, poly):
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        yi, xi = poly[i]
        yj, xj = poly[j]
        if (yi > lat) != (yj > lat) and lng < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def land_polygon(geo):
    c = [list(p) for p in geo["coast"]]
    return c + [[32.45, -116.8], [34.45, -116.8], [34.45, -118.6]]


def on_land(lat, lng, land, waters):
    if not pip(lat, lng, land):
        return False
    return not any(pip(lat, lng, w["poly"]) for w in waters)


def district_of(lat, lng, districts):
    for d in districts:
        if pip(lat, lng, d["poly"]):
            return d["id"]
    return None


# ---------- sources ----------
def read_work_rows():
    html = open(PAGE, encoding="utf-8").read()
    rows = {}
    for m in re.finditer(r'<a class="row[^"]*" id="(w\d\d)" href="([^"]+)"[^>]*>(.*?)</a>', html, re.S):
        rid, href, body = m.groups()
        name = re.search(r'<span class="rname">(.*?)</span>', body, re.S)
        desc = re.search(r'<span class="rdesc">(.*?)</span>', body, re.S)
        rows[rid] = {
            "url": href,
            "name": re.sub(r"\s+", " ", name.group(1)).replace("&amp;", "&").strip() if name else "",
            "line": re.sub(r"\s+", " ", desc.group(1)).replace("&amp;", "&").strip() if desc else "",
        }
    return rows


def read_live_block():
    for path in BOARD:
        if os.path.exists(path):
            t = open(path, encoding="utf-8", errors="ignore").read()
            m = re.search(r"/\*LIVE_START\*/(\{.*?\})/\*LIVE_END\*/", t, re.S)
            if m:
                try:
                    return json.loads(m.group(1))
                except ValueError:
                    pass
    return None


def read_agent_events():
    path = os.path.join(WARROOM, ".k13", "agent-activity.js")
    if not os.path.exists(path):
        say_skip("War Room agent-activity.js not found: crew left empty for every project (the engine assigns by role).")
        return []
    t = open(path, encoding="utf-8").read()
    try:
        j = json.loads(t[t.index("{"):t.rindex("}") + 1])
    except ValueError:
        say_skip("agent-activity.js did not parse: crew left empty for every project.")
        return []
    return j.get("events", [])


def git_dates(repo_dir):
    """Dates (YYYY-MM-DD) of merge commits on the best main ref; falls back to any commit. Returns (dates, ref)."""
    path = os.path.join(PROJECTS_DIR, repo_dir)
    if not os.path.isdir(path):
        return None, "missing"
    for ref in REFS:
        r = subprocess.run(["git", "-C", path, "log", ref, "--merges", "--format=%ad", "--date=short"],
                           capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.split(), ref
    for ref in REFS:
        r = subprocess.run(["git", "-C", path, "log", ref, "--format=%ad", "--date=short"], capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.split(), ref + " (no merges: any commit)"
    return None, "no readable ref"


def d(s):
    return datetime.date.fromisoformat(s)


# ---------- main ----------
def build():
    src = load_json(PLACES)
    pr = make_proj(src["proj"])
    geo = src["geo"]
    land = land_polygon(geo)
    waters = geo["waters"]
    districts = geo["districts"]

    rows = read_work_rows()
    live = read_live_block()
    report = []

    if len(rows) != 13:
        say_skip("index.html has %d Work rows, expected 13." % len(rows))

    # ---- confirm the projects against the site's rows and the board
    projects = []
    for p in src["projects"]:
        row = rows.get(p["workRow"])
        if not row:
            say_skip("%s: row %s is not on the site, so it is not on the map." % (p["key"], p["workRow"]))
            continue
        if row["url"].rstrip("/") != p["url"].rstrip("/"):
            say_skip("%s: site row url %s differs from the places file (%s); the site wins." % (p["key"], row["url"], p["url"]))
        if live is not None and p["warRoomKey"]:
            wr = live.get(p["warRoomKey"])
            if not wr or wr.get("status") != "live":
                say_skip("%s: the War Room does not list it live; it is drawn as under construction." % p["key"])
                p = dict(p, forceConstruction=True)
        projects.append((p, row))
    for rid in sorted(rows):
        if rid not in [p["workRow"] for p, _ in projects]:
            say_skip("%s (%s) is a Work row with no places entry: no building until data/world-places.json has it." % (rid, rows[rid]["name"]))

    # ---- places, resolved to coordinates, then snapped to tiles
    todo = []
    hq = src["hq"]
    todo.append({"id": "hq", "project": "hq", "name": "K13 HQ", "label": hq["label"], "address": "", "lat": hq["lat"],
                 "lng": hq["lng"], "status": "open", "symbolic": True, "category": "hq", "pier": False})
    pier = src["pier"]
    for p, row in projects:
        for pl in p["places"]:
            e = {"id": pl["id"], "project": p["key"], "name": row["name"], "label": pl["label"], "address": pl["address"],
                 "status": "construction" if p.get("forceConstruction") else pl.get("status", "open"),
                 "source": pl["source"], "method": pl["method"], "category": p["category"], "workRow": p["workRow"],
                 "url": row["url"], "line": row["line"], "pier": bool(pl.get("pier"))}
            if pl.get("pier"):
                e["lat"] = pier["lat"]
                e["lng"] = round(pier["lng"] + (pl["berth"] - 1.5) * 0.0095, 5)
                e["symbolic"] = True
            else:
                e["lat"] = pl["lat"]
                e["lng"] = pl["lng"]
                e["symbolic"] = False
            todo.append(e)

    taken = set()
    placed = []
    for e in todo:
        e["district"] = district_of(e["lat"], e["lng"], districts)
        if e["district"] is None:
            say_skip("%s: its point is in no district; left off the map." % e["id"])
            continue
        fx, fy = project(pr, e["lat"], e["lng"])
        cx, cy = int(math.floor(fx)), int(math.floor(fy))
        best = None
        for r in range(0, 8):
            cands = []
            for yy in range(cy - r, cy + r + 1):
                for xx in range(cx - r, cx + r + 1):
                    if max(abs(xx - cx), abs(yy - cy)) != r:
                        continue
                    if not (0 <= xx < pr["w"] and 0 <= yy < pr["h"]) or (xx, yy) in taken:
                        continue
                    lat, lng = unproject(pr, xx + 0.5, yy + 0.5)
                    if not on_land(lat, lng, land, waters):
                        continue
                    if district_of(lat, lng, districts) != e["district"]:
                        continue
                    cands.append(((xx + 0.5 - fx) ** 2 + (yy + 0.5 - fy) ** 2, yy, xx))
            if cands:
                best = sorted(cands)[0]
                break
        if not best:
            say_skip("%s: no free land tile within 7 tiles in %s; left off the map." % (e["id"], e["district"]))
            continue
        e["tx"], e["ty"] = best[2], best[1]
        e["x"], e["y"] = round(fx, 2), round(fy, 2)
        e["snap"] = round(math.sqrt(best[0]), 2)
        e["lat"] = round(e["lat"], 5)
        taken.add((best[2], best[1]))
        placed.append(e)

    # ---- activity (dates, counts, roster ids only)
    events = read_agent_events()
    ref_dates = {}
    last_ship = {}
    ships = {}
    keys = [(p["key"], p["repo"]) for p, _ in projects] + [("hq", SITE_REPO)]
    all_dates = {}
    for key, repo in keys:
        dates, ref = git_dates(repo)
        if not dates:
            say_skip("%s: repo %s unreadable (%s): no activity entry." % (key, repo, ref))
            continue
        all_dates[key] = dates
        report.append("  %-11s %-18s via %-30s newest %s" % (key, repo, ref, dates[0]))
    asof = max([max(v) for v in all_dates.values()] or ["1970-01-01"])
    asof_d = d(asof)
    agent_key = {p["key"]: p["agentKey"] for p, _ in projects}
    agent_key["hq"] = "K13_Website"

    activity = {}
    nocrew = []
    for key, dates in all_dates.items():
        within = [x for x in dates if 0 <= (asof_d - d(x)).days <= 30]
        counts = {}
        ak = agent_key.get(key)
        if ak:
            for ev in events:
                if ev.get("projectKey") != ak or not ev.get("date"):
                    continue
                try:
                    age = (asof_d - d(ev["date"])).days
                except ValueError:
                    continue
                if age < 0 or age > ACTIVITY_DAYS:
                    continue
                pid = str(ev.get("agent", "")).strip().lower()
                if pid in ROSTER:
                    counts[pid] = counts.get(pid, 0) + 1
        crew = [k for k, _ in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))][:3]
        activity[key] = {"lastShip": dates[0], "shipsLast30": len(within), "crew": crew}
        if not crew:
            nocrew.append(key)

    if nocrew:
        say_skip("no roster-attributable crew in the last %d days for: %s; crew left empty (the engine assigns by role)." % (ACTIVITY_DAYS, ", ".join(nocrew)))

    # ---- news: templates only, newest first
    news = []
    names = {p["key"]: row["name"] for p, row in projects}
    names["hq"] = "k13projects.com"
    for key, a in activity.items():
        age = (asof_d - d(a["lastShip"])).days
        if age > NEWS_DAYS:
            continue
        if key == "hq":
            text = "The K13 site was updated"
        elif a["shipsLast30"] >= 3:
            text = "%s got some new work this month" % names[key]
        else:
            text = "%s shipped an update" % names[key]
        news.append({"date": a["lastShip"], "project": key, "text": text})
    news.sort(key=lambda n: (n["date"], n["project"]), reverse=True)
    if len(news) > MAX_NEWS:
        say_skip("news capped at %d lines; %d older ones dropped." % (MAX_NEWS, len(news) - MAX_NEWS))
        news = news[:MAX_NEWS]

    out_places = []
    for e in placed:
        o = {k: e[k] for k in ("id", "project", "name", "label", "address", "lat", "lng", "tx", "ty", "x", "y", "snap",
                               "district", "status", "category", "symbolic", "pier") if k in e}
        for k in ("source", "method", "workRow", "url", "line"):
            if k in e:
                o[k] = e[k]
        out_places.append(o)

    data = {
        "generated": asof,
        "places": out_places,
        "activity": activity,
        "news": news,
        "geo": {
            "bbox": {"west": pr["west"], "east": pr["east"], "south": pr["south"], "north": pr["north"]},
            "proj": pr,
            "coast": geo["coast"],
            "waters": waters,
            "freeways": geo["freeways"],
            "roads": geo["roads"],
            "districts": districts,
            "cities": geo["cities"],
            "hq": {"label": hq["label"], "lat": hq["lat"], "lng": hq["lng"], "symbolic": True},
            "pier": {"label": pier["label"], "lat": pier["lat"], "lng": pier["lng"], "symbolic": True},
        },
    }
    for s in src.get("skips", []):
        report.append("  note: " + s)

    # ---- shops and halls (data/world-shops.json), checked against the places and the captured files
    shops_src = load_json(SHOPS) if os.path.exists(SHOPS) else {"shops": {}, "halls": []}
    manifest_path = os.path.join(SITES_DIR, "manifest.json")
    manifest = load_json(manifest_path) if os.path.exists(manifest_path) else {}
    keys = {p["key"] for p, _ in projects}
    place_ids = {e["id"] for e in placed}
    shops = {}
    for k, sh in shops_src.get("shops", {}).items():
        if k not in keys:
            say_skip("shop %s has no project on the map; left out." % k)
            continue
        sh = dict(sh)
        sh.pop("menuFrom", None)   # provenance stays in the json; the browser does not need it
        mf = manifest.get(k)
        if mf:
            sh["full"] = {"src": mf["full"]["src"], "w": mf["full"]["w"], "h": mf["full"]["h"]}
            imgs = []
            for i, im in enumerate(sh.get("images", [])):
                if i < len(mf["images"]):
                    imgs.append({"src": mf["images"][i]["src"], "w": mf["images"][i]["w"], "h": mf["images"][i]["h"], "alt": im.get("alt", "")})
            sh["images"] = imgs
        else:
            say_skip("shop %s: no capture in manifest.json; sizes kept as written." % k)
        shops[k] = sh
    for k in sorted(keys - set(shops)):
        say_skip("project %s has no shop entry in data/world-shops.json." % k)
    halls = []
    for h in shops_src.get("halls", []):
        bad = [c for c in h["counters"] if c not in place_ids]
        if h["host"] not in keys:
            bad.append(h["host"])
        if bad:
            say_skip("hall %s names place ids that are not on the map: %s" % (h["id"], ", ".join(bad)))
        halls.append(h)
    data["shops"] = shops
    data["halls"] = halls
    report.append("  shops: %d, halls: %d" % (len(shops), len(halls)))
    return data, pr, report


HEADER = """/* GENERATED by scripts/sync-world.py from data/world-places.json, the site's Work rows and the studio's public-safe
 * records. Never hand-edit. Rerun: python3 scripts/sync-world.py     Verify: node scripts/check-world-data.js
 *
 * PROJECTION  equirectangular, longitude scaled by cos(33.4 deg), tile = 650 m.
 *   x = (lng - west) * kx      y = (north - lat) * ky       (fractional tile coordinates, tile = floor)
 *   west -118.55, north 34.15, kx = %(kx)s, ky = %(ky)s, map %(w)d x %(h)d tiles (x 0..%(wm)d, y 0..%(hm)d)
 * SHAPE  K13World.data = {generated, places:[{id, project, name, label, address, lat, lng, tx, ty, x, y, snap, district,
 *   status:'open'|'coming-soon'|'construction', category, symbolic, pier, source, method, workRow, url, line}],
 *   activity:{key:{lastShip, shipsLast30, crew:[personId]}}, news:[{date, project, text}],
 *   geo:{bbox, proj, coast, waters, freeways, roads, districts, cities, hq, pier},\n *   shops:{projectKey:{name,url,palette,motifs,menu:[{item,price?}],signature:{kind,label},images:[{src,w,h,alt}],full:{src,w,h},\n *     task:{ask,item,give,thanks},toy,crowd:{morning,noon,evening,night,guess?}}},\n *   halls:[{id,name,address,lat,lng,host,counters:[placeId]}]}   (polylines are [lat,lng] pairs)
 *   places[].tx,ty is the final snapped tile (centre on land, one building per tile). hq = the K13 HQ place, pier = berths.
 * FUNCTIONS  K13World.project(lat,lng) -> {x,y}   K13World.unproject(x,y) -> {lat,lng}
 */
"""


def render(data, pr):
    head = HEADER % {"kx": pr["kx"], "ky": pr["ky"], "w": pr["w"], "h": pr["h"], "wm": pr["w"] - 1, "hm": pr["h"] - 1}
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"), sort_keys=False)
    fn = ("(function(){var P=K13World.data.geo.proj;"
          "K13World.project=function(lat,lng){return{x:(lng-P.west)*P.kx,y:(P.north-lat)*P.ky};};"
          "K13World.unproject=function(x,y){return{lat:P.north-y/P.ky,lng:P.west+x/P.kx};};})();\n")
    return head + "window.K13World=window.K13World||{};\nK13World.data=" + body + ";\n" + fn


def main():
    check = "--check" in sys.argv
    data, pr, report = build()
    text = render(data, pr)
    print("sync-world: as of %s, %d places, %d news lines" % (data["generated"], len(data["places"]), len(data["news"])))
    for line in report:
        print(line)
    if skipped:
        print("Skipped, and why:")
        for s in skipped:
            print("  - " + s)
    if check:
        cur = open(OUT, encoding="utf-8").read() if os.path.exists(OUT) else ""
        if cur != text:
            print("world-data.js is out of date")
            sys.exit(1)
        print("world-data.js is current")
        return
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(text)
    print("wrote " + os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
