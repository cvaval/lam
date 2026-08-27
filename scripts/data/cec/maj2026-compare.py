# -*- coding: utf-8 -*-
"""Confrontation transcription cliente <-> corps en base, loi CEC 2002.
Lecture seule. Sorties: articles.json (ratios+diffs), stats affichees."""
import json, re, unicodedata
from difflib import SequenceMatcher
from statistics import median

CEC = "/private/tmp/claude-501/-Users-cvaval-Library-CloudStorage-Dropbox-Lam-Veritab/b86c8ab9-626b-4ed6-9e9c-f6e8779c5980/scratchpad/cec"
base_raw = open(f"{CEC}/base-body.txt", encoding="utf-8").read()
cli_raw = open(f"{CEC}/Loi_du_26_juin_2002_sur_les_CEC_1.txt", encoding="utf-8").read()

# ── conventions d'apostrophe, mesurees ──
def apos_stats(s, name):
    print(f"{name}: U+2019={s.count(chr(0x2019))}  U+0027={s.count(chr(0x27))}  U+02BC={s.count(chr(0x2BC))}  NBSP={s.count(chr(0xA0))}  NNBSP={s.count(chr(0x202F))}  U+0009={s.count(chr(9))}")
apos_stats(base_raw, "base")
apos_stats(cli_raw, "cliente")

HEAD_STRUCT = re.compile(r"^(TITRE|CHAPITRE|SECTION)\b", re.I)

def parse_base(text):
    """Tetes d'article inline: 'Article N.-' / 'Article 1er.-'"""
    lines = text.split("\n")
    arts, cur, curnum = {}, None, None
    pre, post, headings = [], [], []
    art_re = re.compile(r"^Article\s+(\d+)(?:er)?\s*\.\-\s*(.*)$")
    ended = False
    prev_heading = False
    for i, ln in enumerate(lines):
        m = art_re.match(ln)
        if m:
            curnum = int(m.group(1)); arts[curnum] = [m.group(2)]
            prev_heading = False
            continue
        # suite d'un en-tete coupe sur deux lignes (tout en capitales, apres TITRE/CHAPITRE/SECTION)
        stripped = ln.strip()
        if HEAD_STRUCT.match(stripped) or (prev_heading and stripped and stripped == stripped.upper() and not stripped.startswith("«")):
            if HEAD_STRUCT.match(stripped):
                headings.append((curnum, stripped))
            else:
                n0, h0 = headings[-1]; headings[-1] = (n0, h0 + " " + stripped)
            prev_heading = True
            continue
        prev_heading = False
        # bloc parlementaire: apres l'article 151, tout ce qui suit 'Donnée au Sénat'
        if curnum == 151 and (ended or ln.startswith("Donnée au Sénat")):
            ended = True; post.append(ln); continue
        if curnum is None:
            pre.append(ln)
        else:
            arts[curnum].append(ln)
    return arts, pre, post, headings

def parse_cli(text):
    """Tetes d'article sur leur propre ligne: 'Article N'"""
    lines = text.split("\n")
    arts, curnum = {}, None
    pre, post, headings = [], [], []
    art_re = re.compile(r"^Article\s+(\d+)\s*$")
    ended = False
    for ln in lines:
        m = art_re.match(ln)
        if m:
            curnum = int(m.group(1)); arts[curnum] = []
            continue
        if HEAD_STRUCT.match(ln.strip()) and not ended:
            headings.append((curnum, ln.strip()))
            continue
        if curnum == 151 and (ended or ln.startswith("Donnée au Sénat")):
            ended = True; post.append(ln); continue
        if curnum is None:
            pre.append(ln)
        else:
            arts[curnum].append(ln)
    return arts, pre, post, headings

base_arts, base_pre, base_post, base_heads = parse_base(base_raw)
cli_arts, cli_pre, cli_post, cli_heads = parse_cli(cli_raw)
print(f"\nbase: {len(base_arts)} articles, nums {min(base_arts)}-{max(base_arts)}, manquants: {sorted(set(range(1,152))-set(base_arts))}")
print(f"cliente: {len(cli_arts)} articles, nums {min(cli_arts)}-{max(cli_arts)}, manquants: {sorted(set(range(1,152))-set(cli_arts))}")
print(f"base pre={len(base_pre)} post={len(base_post)} headings={len(base_heads)}")
print(f"cliente pre={len(cli_pre)} post={len(cli_post)} headings={len(cli_heads)}")

# ── tokenisation au mot ──
APOS = dict.fromkeys([0x2019, 0x02BC, 0x2018], "'")
def words(s, fold=True):
    s = s.translate(APOS).replace(" ", " ").replace(" ", " ")
    toks = re.findall(r"[0-9]+(?:[.,][0-9]+)*|[^\W\d_]+(?:['\-][^\W\d_]+)*", s, re.UNICODE)
    if fold:
        toks = [t.casefold() for t in toks]
    return toks

def art_text(d, n):
    return "\n".join(x for x in d.get(n, []) if x.strip())

results = []
for n in range(1, 152):
    a = art_text(base_arts, n); b = art_text(cli_arts, n)
    wa, wb = words(a), words(b)
    sm = SequenceMatcher(None, wa, wb, autojunk=False)
    ratio = sm.ratio()
    # ratio strict (casse conservee)
    was, wbs = words(a, fold=False), words(b, fold=False)
    ratio_strict = SequenceMatcher(None, was, wbs, autojunk=False).ratio()
    diffs = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        diffs.append({
            "op": tag,
            "base": " ".join(was[i1:i2])[:300],
            "cli": " ".join(wbs[j1:j2])[:300],
            "ctx_avant": " ".join(was[max(0, i1-5):i1]),
        })
    results.append({
        "article": n, "ratio_mots": round(ratio, 4), "ratio_strict": round(ratio_strict, 4),
        "mots_base": len(wa), "mots_cli": len(wb), "n_ecarts": len(diffs), "ecarts": diffs,
    })

ratios = [r["ratio_mots"] for r in results]
print(f"\nmediane ratio (mots, casse pliee): {median(ratios):.4f}")
for seuil in [1.0, 0.999, 0.99, 0.98, 0.95, 0.90]:
    print(f"  ratio >= {seuil}: {sum(1 for r in ratios if r >= seuil)}/151")
print(f"  ratio < 0.90: {sum(1 for r in ratios if r < 0.90)}")
worst = sorted(results, key=lambda r: r["ratio_mots"])[:15]
print("\n15 pires articles:", [(r["article"], r["ratio_mots"]) for r in worst])
identiques = [r["article"] for r in results if r["n_ecarts"] == 0]
print(f"\narticles identiques au mot (casse pliee): {len(identiques)}")

# ── preambule & bloc parlementaire ──
def blob(lines): return "\n".join(x for x in lines if x.strip())
pre_sm = SequenceMatcher(None, words(blob(base_pre)), words(blob(cli_pre)), autojunk=False)
post_sm = SequenceMatcher(None, words(blob(base_post)), words(blob(cli_post)), autojunk=False)
print(f"\npreambule: ratio mots = {pre_sm.ratio():.4f}  (base {len(words(blob(base_pre)))} mots / cli {len(words(blob(cli_pre)))} mots)")
print(f"bloc parlementaire: ratio mots = {post_sm.ratio():.4f}  (base {len(words(blob(base_post)))} mots / cli {len(words(blob(cli_post)))} mots)")

def dump_diff(sm, wa, wb, label):
    out = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal": continue
        out.append({"op": tag, "base": " ".join(wa[i1:i2])[:200], "cli": " ".join(wb[j1:j2])[:200]})
    return out

pre_wa, pre_wb = words(blob(base_pre), fold=False), words(blob(cli_pre), fold=False)
post_wa, post_wb = words(blob(base_post), fold=False), words(blob(cli_post), fold=False)
pre_diffs = dump_diff(SequenceMatcher(None, pre_wa, pre_wb, autojunk=False), pre_wa, pre_wb, "pre")
post_diffs = dump_diff(SequenceMatcher(None, post_wa, post_wb, autojunk=False), post_wa, post_wb, "post")

json.dump({
    "articles": results,
    "preambule": {"ratio": round(pre_sm.ratio(), 4), "ecarts": pre_diffs,
                  "base_lignes": [x for x in base_pre if x.strip()], "cli_lignes": [x for x in cli_pre if x.strip()]},
    "bloc_parlementaire": {"ratio": round(post_sm.ratio(), 4), "ecarts": post_diffs,
                           "base_lignes": [x for x in base_post if x.strip()], "cli_lignes": [x for x in cli_post if x.strip()]},
    "headings_base": [f"[apres art. {n}] {h}" for n, h in base_heads],
    "headings_cli": [f"[apres art. {n}] {h}" for n, h in cli_heads],
}, open(f"{CEC}/articles.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("\n-> articles.json ecrit")
