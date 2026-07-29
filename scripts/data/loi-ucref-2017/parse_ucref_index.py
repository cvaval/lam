#!/usr/bin/env python3
# Index de la Loi UCREF 2017 — DEUX apports combinés (docs/prompt-loi-ucref-2017.md §5) :
#  (a) l'index alphabétique fourni (autorité) : « Sujet Art. N », « Art. N a) »,
#      « Art. N, M », « Art. 5 e), 19 e) » — les LETTRES de sous-item ne sont jamais
#      des renvois : elles sont reportées en suffixe du libellé ;
#  (b) les 32 descriptions d'articles du sommaire analytique (« Composition et
#      nomination Article 5 ») — impossibles en toc (les libellés du sommaire doivent
#      être des lignes VERBATIM du corps), parfaites en index, une par article.
# Sortie : _ucref_index.json. Assertions : 0 renvoi mort, couverture 32/32.
from __future__ import annotations

import html
import json
import os
import re
import zipfile

D = os.path.expanduser("~/Downloads")
OUT = os.path.dirname(os.path.abspath(__file__))
VALID = set(range(1, 33))


def rows(path: str) -> list[str]:
    xml = zipfile.ZipFile(path).read("word/document.xml").decode("utf-8", "replace")
    out = []
    for m in re.finditer(r"<w:p\b[^>]*(?:/>|>.*?</w:p>)", xml, re.S):
        p = re.sub(r"<w:pPr>.*?</w:pPr>", "", m.group(0), flags=re.S)
        p = re.sub(r"<w:tab\b[^>]*/?>", "<w:t> </w:t>", p)
        t = html.unescape("".join(re.findall(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", p, re.S)))
        t = re.sub(r"\s+", " ", t).strip()
        if t:
            out.append(t)
    return out


entries: list[dict] = []

# ── (a) index alphabétique ───────────────────────────────────────────────────────
idx = rows(f"{D}/Index_Loi_UCREF_2017.docx")
assert idx[3] == "INDEX ALPHABÉTIQUE DES MATIÈRES", idx[3]
# Grammaire des renvois, en FIN de ligne après « Art. ». Un token vaut :
#   « N »                → article N
#   « N a) », « N b) c) » → article N + lettres de sous-item (JAMAIS dans ctRefs)
#   « N à M »            → plage d'articles, développée
#   « N i) à k) »        → article N, plage de lettres
# Les lignes « In fine » (formules d'adoption et de promulgation) ne renvoient à
# aucun article : écartées par liste blanche explicite.
REF = re.compile(
    r"\bArt\.\s*((?:\d{1,2}(?:\s*[a-z]\))*(?:\s*à\s*(?:\d{1,2}|[a-z]\)))?)"
    r"(?:\s*,\s*\d{1,2}(?:\s*[a-z]\))*(?:\s*à\s*(?:\d{1,2}|[a-z]\)))?)*)\s*$"
)
TOK = re.compile(r"^(\d{1,2})((?:\s*[a-z]\))*)(?:\s*à\s*(\d{1,2}|[a-z]\))\s*)?$")
IN_FINE = ("Formules d'adoption", "Promulgation")
n_letter = n_range = 0
for t in idx[4:]:
    if re.fullmatch(r"[A-Z]", t):          # lettre-repère
        continue
    if t.startswith("[Note éditoriale"):   # apparat de l'éditeur
        continue
    if t.rstrip().endswith("In fine"):
        assert t.startswith(IN_FINE), f"ligne « In fine » imprévue : {t[:70]}"
        continue
    m = REF.search(t)
    assert m, f"ligne d'index sans renvoi exploitable : {t[:80]}"
    subject = t[: m.start()].strip()
    ct: list[int] = []
    letters: list[str] = []
    for tok in re.split(r"\s*,\s*", m.group(1).strip()):
        mm = TOK.match(tok.strip())
        assert mm, f"token de renvoi illisible « {tok} » dans : {t[:70]}"
        n = int(mm.group(1))
        nums = [n]
        end = mm.group(3)
        if end and end.rstrip(")").isdigit():          # plage d'articles « N à M »
            hi = int(end.rstrip(")"))
            assert hi > n, f"plage inversée « {tok} »"
            nums = list(range(n, hi + 1))
            n_range += 1
        for x in nums:
            assert x in VALID, f"renvoi mort {x} dans : {t[:70]}"
            if x not in ct:
                ct.append(x)
        got = re.findall(r"([a-z])\)", mm.group(2) or "")
        if end and not end.rstrip(")").isdigit():      # plage de lettres « i) à k) »
            lo = got[-1] if got else None
            hi = end.rstrip(")")
            assert lo and lo < hi, f"plage de lettres illisible « {tok} »"
            got = got[:-1] + [chr(c) for c in range(ord(lo), ord(hi) + 1)]
            n_range += 1
        for g in got:
            if g not in letters:
                letters.append(g)
    if letters:
        # suffixe de sous-items : une seule parenthèse englobante — « (f) », « (i, j, k) »
        subject = f"{subject} ({', '.join(letters)})"
        n_letter += 1
    entries.append({"subject": subject, "ctRefs": [str(n) for n in ct]})
n_alpha = len(entries)

# ── (b) descriptions d'articles du sommaire analytique ──────────────────────────
som = rows(f"{D}/Sommaire_Loi_UCREF_2017.docx")
ART_TAIL = re.compile(r"^(.*?)\s+Article\s+(\d{1,2})\s*$")
seen: set[int] = set()
for t in som:
    if t.startswith("[Note éditoriale") or re.match(r"^(CHAPITRE|Section)\b", t):
        continue
    m = ART_TAIL.match(t)
    if not m:
        continue
    desc, n = m.group(1).strip(), int(m.group(2))
    assert n in VALID, f"description hors 1..32 : {t[:70]}"
    assert n not in seen, f"deux descriptions pour l'article {n}"
    seen.add(n)
    entries.append({"subject": desc, "ctRefs": [str(n)]})
assert seen == VALID, f"descriptions manquantes : {sorted(VALID - seen)}"
n_desc = len(seen)

# ── Assertions finales ──────────────────────────────────────────────────────────
covered = {int(r) for e in entries for r in e["ctRefs"]}
assert covered == VALID, f"couverture {len(covered)}/32 — manquants {sorted(VALID - covered)}"
# Recouvrement (a)/(b) : une description du sommaire peut coïncider mot pour mot avec
# un sujet de l'index pour le même article (« Attributions du Directeur Général »,
# « Ressources financières ») — on déduplique. Plafond : au-delà de 5, ce ne serait
# plus un recouvrement ponctuel mais un défaut de construction.
seen_sig: set[tuple] = set()
dedup: list[dict] = []
for e in entries:
    sig = (e["subject"], tuple(e["ctRefs"]))
    if sig in seen_sig:
        continue
    seen_sig.add(sig)
    dedup.append(e)
n_dup = len(entries) - len(dedup)
assert n_dup <= 5, f"{n_dup} doublons — recouvrement anormal entre index et sommaire"
entries = dedup

entries.sort(key=lambda e: e["subject"].lower())
json.dump(entries, open(f"{OUT}/_ucref_index.json", "w"), ensure_ascii=False, indent=1)
print(
    f"✓ index : {len(entries)} entrées = {n_alpha} de l'index alphabétique "
    f"({n_letter} avec sous-item lettré, {n_range} plages développées) + {n_desc} descriptions du sommaire · "
    f"couverture 32/32 · 0 renvoi mort"
)
