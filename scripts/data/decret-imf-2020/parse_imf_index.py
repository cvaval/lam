#!/usr/bin/env python3
# Index alphabétique du Décret IMF 2020 (autorité : decret-imf-index_1.docx).
# Produit scripts/data/decret-imf-2020/_imf_index.json — entrées {subject, ctRefs}.
#
# Grammaire des renvois (balayage ARRIÈRE, jamais la ligne entière — pièges §6 :
# « (90 jours) », « (1/1000) », « (article 323) » sont dans le LIBELLÉ) :
#  - tokens séparés par « ; » ;
#  - « N »            → article N ;
#  - « 1ᵉʳ »          → article 1 ;
#  - « N, K° [, L°…] » → article N + alinéas K°/L° (ici toujours l'art. 2, définitions) ;
#    l'alinéa est reporté en suffixe du libellé « (K°) », jamais dans ctRefs.
# Sous-entrées « – description » : libellé « Sujet — description » (patron Code civil).
# Assertions : 0 renvoi mort (art. 13 exclu), couverture 80/80.
from __future__ import annotations

import json
import os
import re
import zipfile
import html

F = os.path.expanduser("~/Downloads/decret-imf-index_1.docx")
OUT = os.path.dirname(os.path.abspath(__file__))
VALID = {n for n in range(1, 82)} - {13}


def rows_of(path):
    xml = zipfile.ZipFile(path).read("word/document.xml").decode("utf-8", "replace")
    out = []
    for p in re.findall(r"<w:p\b[^>]*(?:/>|>.*?</w:p>)", xml, re.S):
        p1 = re.sub(r"<w:pPr>.*?</w:pPr>", "", p, flags=re.S)
        t = html.unescape("".join(re.findall(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", p1, re.S)))
        t = re.sub(r"\s+", " ", t).strip()
        if t:
            out.append(t)
    return out


# bloc de renvois en fin de ligne : tokens « ; » de forme N / 1ᵉʳ / N, K°…
REF_BLOCK = re.compile(
    r"\s+((?:\d{1,3}(?:ᵉʳ)?(?:\s*,\s*\d{1,3}°)*)(?:\s*;\s*\d{1,3}(?:ᵉʳ)?(?:\s*,\s*\d{1,3}°)*)*)\s*$"
)
TOKEN = re.compile(r"^(\d{1,3})(ᵉʳ)?((?:\s*,\s*\d{1,3}°)*)$")


def parse_refs(block: str):
    """(ctRefs uniques ordonnés, suffixe d'alinéas). Renvoie None si un token invalide."""
    ct: list[int] = []
    alineas: list[str] = []
    for tok in re.split(r"\s*;\s*", block.strip()):
        m = TOKEN.match(tok.strip())
        if not m:
            return None
        n = int(m.group(1))
        if n not in ct:
            ct.append(n)
        for a in re.findall(r"\d{1,3}°", m.group(3) or ""):
            if a not in alineas:
                alineas.append(a)
    return ct, alineas


rows = rows_of(F)
assert rows[0] == "INDEX ALPHABÉTIQUE DES MATIÈRES", rows[0]
entries: list[dict] = []
parent: str | None = None
n_sub = 0
n_alinea = 0
for t in rows[1:]:
    if re.fullmatch(r"[A-Z]", t):  # lettre-repère
        continue
    is_sub = t.startswith("–") or t.startswith("-")
    line = t.lstrip("–- ").strip() if is_sub else t
    m = REF_BLOCK.search(line)
    if not m:
        # sujet parent SANS renvoi (grouping header) — ses sous-entrées portent les refs
        assert not is_sub, f"sous-entrée sans renvoi : {t}"
        parent = line
        continue
    label = line[: m.start()].strip()
    parsed = parse_refs(m.group(1))
    assert parsed is not None, f"bloc de renvois illisible : {t}"
    ct, alineas = parsed
    dead = [n for n in ct if n not in VALID]
    assert not dead, f"renvoi mort {dead} dans : {t}"
    subject = f"{parent} — {label}" if is_sub else label
    if is_sub:
        n_sub += 1
    else:
        parent = label  # un parent AVEC renvoi reste le parent de ses sous-entrées
    if alineas:
        subject = f"{subject} ({', '.join(alineas)})"
        n_alinea += 1
    entries.append({"subject": subject, "ctRefs": [str(n) for n in ct]})

covered = {int(r) for e in entries for r in e["ctRefs"]}
missing = sorted(VALID - covered)
assert not missing, f"articles non couverts par l'index : {missing}"
beyond = sorted(covered - VALID)
assert not beyond, f"renvois hors 1..81\\{{13}} : {beyond}"

# ordre alphabétique (le lecteur regroupe par article ; l'ordre du fichier est A→V)
entries.sort(key=lambda e: e["subject"].lower())
json.dump(entries, open(f"{OUT}/_imf_index.json", "w"), ensure_ascii=False, indent=1)
print(
    f"✓ index : {len(entries)} entrées ({n_sub} sous-entrées, {n_alinea} avec alinéas) · "
    f"couverture {len(covered)}/{len(VALID)} · 0 renvoi mort"
)
