#!/usr/bin/env python3
"""Build data/discography.json from Spotify (albums, tracks, covers) and YouTube (MV / audio links).

Run locally after a new release:  python3 scripts/build_discography.py
Edit the config blocks below to add member songs, title tracks or release labels.
No API keys needed: it borrows the anonymous token Spotify's public embed player uses.
"""
import json
import re
import subprocess
import sys
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "discography.json"
CACHE = ROOT / "scripts" / ".yt-cache.json"

NMIXX_SPOTIFY_ID = "28ot3wh4oNmoFOdVajibBl"
MEMBERS = ["LILY", "HAEWON", "SULLYOON", "BAE", "JIWOO", "KYUJIN"]

# Spotify album name -> release label. Releases not listed here are skipped
# (e.g. the pre-debut "Now is the time!" / "Special Message" clips, duplicate Korean OST listing).
ALBUM_LABELS = {
    "AD MARE": "싱글 앨범",
    "Kiss": "디지털 싱글",
    "ENTWURF": "싱글 앨범",
    "1st Intermixxion Single <Funky Glitter Christmas>": "디지털 싱글",
    "Young, Dumb, Stupid": "디지털 싱글",
    "expérgo": "1st EP",
    "Roller Coaster": "디지털 싱글",
    "A Midsummer NMIXX's Dream": "싱글 앨범",
    "Soñar (Breaker)": "디지털 싱글",
    "Fe3O4: BREAK": "2nd EP",
    "FEIFEI": "디지털 싱글",
    "Fe3O4: STICK OUT": "3rd EP",
    "Soñar (Spanish Ver.)": "디지털 싱글",
    "High Horse": "디지털 싱글",
    "Fe3O4: FORWARD": "4th EP",
    "Blue Valentine": "1st Album",
    "Blue Valentine (MIXX Ver.)": "디지털 싱글",
    "TIC TIC": "디지털 싱글",
    "Heavy Serenade": "5th EP",
    "Strange Muse": "6th EP",
}
COLLAB_LABELS = {
    "GABBY'S DOLLHOUSE X NMIXX (Original Soundtrack)": "OST",
    "Like Magic": "콜라보",
    "Come On": "콜라보",
    "MEXE": "콜라보",
    "MEXE (Remix)": "리믹스",
    "K-POPS! (Music from and inspired by K-POPS! Motion Picture)": "영화 「K-POPS!」 OST",
}
# For compilations NMIXX only appears on, keep just these tracks.
COLLAB_ONLY_TRACKS = {
    "K-POPS! (Music from and inspired by K-POPS! Motion Picture)": ["Caution"],
}

TITLE_TRACKS = {
    "O.O", "DICE", "Kiss", "Funky Glitter Christmas", "Young, Dumb, Stupid", "Love Me Like This",
    "Roller Coaster", "Party O'Clock", "Soñar (Breaker)", "DASH", "See that?", "High Horse",
    "KNOW ABOUT ME", "Blue Valentine", "TIC TIC", "Heavy Serenade", "Birthday Wish", "FEIFEI",
    "Soñar (Spanish Ver.)", "Hey Gabby!", "Like Magic", "Come On", "MEXE", "Caution",
    "Crescendo", "SPINNIN' ON IT", "SICKUHH",
}

# Songs by one or more members outside official NMIXX releases.
# (track query, artist query, short note)
# Spotify search text, word the track name must contain, a credited artist to confirm the match,
# the members who take part, and a short note. Credits on Spotify are inconsistent, so members are listed here.
MEMBER_SONGS = [
    ("The Moment LILY SULLYOON", "The Moment", "SULLYOON", ["LILY", "SULLYOON"], "넷플릭스 「연애대전」 OST"),
    ("Delete YAOCHEN LILY", "Delete", "YAOCHEN", ["LILY"], "YAOCHEN 피처링"),
    ("Maru is a Puppy HAEWON", "Maru is a Puppy", "HAEWON", ["HAEWON"], "「마루는 강쥐」 OST"),
    ("Is it still beautiful HAEWON", "Is it still beautiful", "HAEWON", ["HAEWON"], "「놀면 뭐하니?」 윈터송"),
    ("Butterfly Hang Out With YOO", "Butterfly", "Yoo Jae Seok", ["HAEWON"], "「놀면 뭐하니?」 윈터송"),
    ("Ridin LILY JIWOO KYUJIN", "Ridin", "KYUJIN", ["LILY", "JIWOO", "KYUJIN"], "「월드 오브 스트릿 우먼 파이터」"),
    ("54321 pH-1 HAEWON", "54321", "pH-1", ["HAEWON"], "pH-1 피처링"),
    ("Up & Down 제4차 사랑혁명", "Up & Down", "배이", ["BAE"], "「제4차 사랑혁명」 OST"),
    ("Always Parc Jae Jung SULLYOON", "Always", "SULLYOON", ["SULLYOON"], "박재정 X 설윤"),
    ("Take A Chance Jason Lee KYUJIN", "Take A Chance", "Jason Lee", ["KYUJIN"], "Jason Lee 피처링"),
]

# Hand-checked YouTube links for tracks the automatic search can't pin down (track name -> (video id, kind)).
YOUTUBE_OVERRIDES = {
    "Hey Gabby!": ("xBrrdxtyWHw", "mv"),
    "XOXO": ("FjMmFPLpScU", "audio"),
    "Caution": ("eJd4ii5avNw", "mv"),
    "Take A Chance (Feat. KYUJIN of NMIXX)": ("WVKaQL46c3c", "audio"),
}

INSTRUMENTAL = re.compile(r"\b(instrumental|inst\.?)\b", re.I)


def curl(url, headers=()):
    args = ["curl", "-sL", "--retry", "3", url]
    for h in headers:
        args += ["-H", h]
    return subprocess.run(args, capture_output=True, text=True, timeout=60).stdout


# ---------------- Spotify ----------------
def spotify_token():
    html = curl("https://open.spotify.com/embed/album/0QkOWJsNjhHQwhmhy4bstt")
    m = re.search(r'"accessToken":"([^"]+)"', html)
    if not m:
        sys.exit("Could not obtain Spotify embed token")
    return m.group(1)


class Spotify:
    def __init__(self):
        self.token = spotify_token()

    def get(self, path):
        url = path if path.startswith("http") else "https://api.spotify.com/v1" + path
        for _ in range(3):
            data = json.loads(curl(url, [f"Authorization: Bearer {self.token}"]) or "{}")
            if "error" not in data:
                return data
            time.sleep(2)
        raise RuntimeError(f"Spotify error for {url}: {data}")

    def all_items(self, path):
        items, url = [], path
        while url:
            page = self.get(url)
            items += page["items"]
            url = page.get("next")
        return items


def best_image(images):
    return max(images, key=lambda i: i.get("width") or 0)["url"] if images else None


def artists_str(artists):
    return ", ".join(a["name"] for a in artists)


def members_in(text):
    return [m for m in MEMBERS if re.search(rf"(?<![\w.]){m}(?![\w.])", text, re.I)]


# ---------------- YouTube ----------------
def yt_search(query):
    html = curl("https://www.youtube.com/results?search_query=" + urllib.parse.quote(query),
                ["Accept-Language: en-US"])
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", html, re.S)
    if not m:
        return []
    out = []

    def walk(o):
        if isinstance(o, dict):
            if "videoRenderer" in o:
                v = o["videoRenderer"]
                out.append({
                    "id": v["videoId"],
                    "title": "".join(r["text"] for r in v["title"]["runs"]),
                    "owner": "".join(r["text"] for r in v.get("ownerText", {}).get("runs", [])),
                })
            for x in o.values():
                walk(x)
        elif isinstance(o, list):
            for x in o:
                walk(x)

    walk(json.loads(m.group(1)))
    return out


def norm(s):
    return re.sub(r"[^0-9a-z가-힣]+", "", s.lower())


VERSION_RE = re.compile(r"ver\.?|version|remix|sped|cappella|english|spanish|japanese", re.I)
BAD_TITLE = re.compile(r"teaser|dance practice|reaction|cover|karaoke|lyrics|가사|fancam|직캠|1 hour|slowed|8d|"
                       r"behind|making|recording|stage|live|showcase|highlight|medley|shorts|#", re.I)
MV_RE = re.compile(r"M/?V\b|Music Video", re.I)
TRUSTED_OWNERS = re.compile(r"JYP Entertainment|^NMIXX$| - Topic$|KBS MEDIA MUSIC|1theK|Stone Music|genie|"
                            r"Kakao|MOSTCONTENTS|Netflix|wavve|Mnet|MBC|SBS|Republic Records", re.I)


def core_name(track):
    return re.sub(r"\s*[\(\[].*?[\)\]]", "", track).strip() or track


def name_parts(track):
    """Return (names that identify the song, version tokens that must also match)."""
    groups = re.findall(r"[\(\[](.*?)[\)\]]", track)
    names, version = [norm(re.sub(r"\s*[\(\[].*?[\)\]]", "", track))], []
    for g in groups:
        if re.match(r"feat|prod|with", g, re.I) or all(w.strip().upper() in MEMBERS for w in re.split(r"[,&]", g)):
            continue
        if VERSION_RE.search(g):
            version += [w for w in re.findall(r"[0-9a-z가-힣]+", g.lower()) if w not in ("ver", "version")]
        else:
            names.append(norm(g))
    return [n for n in names if n], version


def find_youtube(track, artist, is_title, cache):
    key = f"{artist}|{track}|{is_title}"
    if cache.get(key):
        return cache[key]
    names, version = name_parts(track)
    credited = [norm(a) for a in re.split(r",|&", artist) if norm(a)]
    first_artist = artist.split(",")[0].strip()
    base = re.sub(r"\s*\((feat|prod)[^)]*\)", "", track, flags=re.I)

    queries = ([f"{first_artist} {base} M/V"] if is_title else []) + [f"{first_artist} {base}"]
    best = None
    for q in queries:
        results = []
        for _ in range(3):
            results = yt_search(q)
            if results:
                break
            time.sleep(2)
        for v in results[:15]:
            t, owner = norm(v["title"]), v["owner"]
            if not any(n in t for n in names):
                continue
            if any(w not in t for w in version):
                continue
            if not version and BAD_TITLE.search(v["title"]):
                continue
            leftover = norm(owner)
            for c in credited:
                leftover = leftover.replace(c, "")
            trusted = TRUSTED_OWNERS.search(owner) or (leftover != norm(owner) and leftover in ("", "topic", "vevo", "official"))
            if not trusted:
                continue
            is_mv = bool(MV_RE.search(v["title"]))
            score = (3 if is_mv and is_title else 0) + (2 if re.search(r"JYP|^NMIXX$", owner) else 1)
            if not best or score > best[0]:
                best = (score, {"id": v["id"], "kind": "mv" if is_mv else "audio"})
        if best and (best[1]["kind"] == "mv" or not is_title):
            break
        time.sleep(0.6)
    cache[key] = best[1] if best else None
    return cache[key]


def yt_fields(track, artist, is_title, cache):
    if track in YOUTUBE_OVERRIDES:
        vid, kind = YOUTUBE_OVERRIDES[track]
        return {"youtube": f"https://www.youtube.com/watch?v={vid}", "youtubeKind": kind}
    yt = find_youtube(track, artist, is_title, cache)
    if yt:
        return {"youtube": f"https://www.youtube.com/watch?v={yt['id']}", "youtubeKind": yt["kind"]}
    q = urllib.parse.quote(f"{artist.split(',')[0]} {track}")
    return {"youtube": f"https://music.youtube.com/search?q={q}", "youtubeKind": "search"}


# ---------------- Build ----------------
def build_album(sp, album, label, cache, only=None):
    full = sp.get(f"/albums/{album['id']}?market=KR")
    tracks = []
    for t in full["tracks"]["items"]:
        if INSTRUMENTAL.search(t["name"]):
            continue
        if only and core_name(t["name"]) not in only:
            continue
        artist = artists_str(t["artists"])
        parts = {t["name"], core_name(t["name"]), *re.findall(r"\((.*?)\)", t["name"])}
        is_title = bool(parts & TITLE_TRACKS)
        tracks.append({
            "n": t["track_number"],
            "name": t["name"],
            "artists": artist,
            "duration": t["duration_ms"] // 1000,
            "title": is_title,
            "members": members_in(t["name"]),
            "spotify": t["external_urls"]["spotify"],
            **yt_fields(t["name"], artist, is_title, cache),
        })
        print("   ", t["name"], "->", tracks[-1]["youtubeKind"], flush=True)
    return {
        "id": album["id"],
        # For a compilation NMIXX only appears on, show the song itself rather than the compilation title.
        "name": " / ".join(t["name"] for t in tracks) if only else full["name"],
        "label": label,
        "date": full["release_date"],
        "artists": artists_str(full["artists"]),
        "cover": best_image(full["images"]),
        "spotify": full["external_urls"]["spotify"],
        "tracks": tracks,
    }


def main():
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    sp = Spotify()
    releases = sp.all_items(
        f"/artists/{NMIXX_SPOTIFY_ID}/albums?include_groups=album,single,appears_on&market=KR&limit=50")

    albums, collabs, seen = [], [], set()
    for a in sorted(releases, key=lambda a: a["release_date"]):
        name = a["name"]
        if name in seen:
            continue
        if name in ALBUM_LABELS:
            print(name, flush=True)
            albums.append(build_album(sp, a, ALBUM_LABELS[name], cache))
        elif name in COLLAB_LABELS:
            print(name, flush=True)
            collabs.append(build_album(sp, a, COLLAB_LABELS[name], cache, COLLAB_ONLY_TRACKS.get(name)))
        else:
            print("skip:", name)
            continue
        seen.add(name)
        CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1))

    members = []
    for query, must, hint, who, note in MEMBER_SONGS:
        q = urllib.parse.quote(query)
        items = sp.get(f"/search?q={q}&type=track&market=KR&limit=20")["tracks"]["items"]
        items = [t for t in items if norm(must) in norm(t["name"]) and norm(hint) in norm(artists_str(t["artists"]))
                 and not INSTRUMENTAL.search(t["name"])]
        if not items:
            print("!! member song not found:", query)
            continue
        t = sorted(items, key=lambda t: t["album"]["release_date"])[0]
        artist = artists_str(t["artists"])
        bracketed = re.search(r"<(.+?)>", t["name"])  # "Wintersong ... <Is it still beautiful>"
        members.append({
            "name": bracketed.group(1) if bracketed else t["name"],
            "artists": artist,
            "members": who,
            "note": note,
            "album": t["album"]["name"],
            "date": t["album"]["release_date"],
            "cover": best_image(t["album"]["images"]),
            "spotify": t["external_urls"]["spotify"],
            **yt_fields(t["name"], artist, False, cache),
        })
        print("member:", t["name"], "|", artist, "->", members[-1]["youtubeKind"], flush=True)
        CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1))

    by_date = lambda x: x["date"]
    OUT.write_text(json.dumps({
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "albums": sorted(albums, key=by_date, reverse=True),
        "collabs": sorted(collabs, key=by_date, reverse=True),
        "members": sorted(members, key=by_date, reverse=True),
    }, ensure_ascii=False, indent=1))
    print(f"\nwrote {OUT} — {len(albums)} albums, {len(collabs)} collabs, {len(members)} member songs")


if __name__ == "__main__":
    main()
