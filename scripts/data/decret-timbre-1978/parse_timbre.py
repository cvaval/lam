#!/usr/bin/env python3
# Parseur du DÉCRET DU 29 NOVEMBRE 1978 SUR LE DROIT DE TIMBRE (Moniteur n° 89 du
# 18 décembre 1978), texte CONSOLIDÉ par les Lois de Finances 2011-2012 (Moniteur
# Spécial n° 2 du 5 juin 2012) et 2013-2014 (Moniteur Spécial n° 2 du 10 juin 2014)
# — reproduction de l'édition Joseph Paillant du Code Fiscal d'Haïti (2018).
#
# Source : ~/Downloads/Code_Fiscal_Droit_de_Timbre_RECONSTITUE.docx — fichier propre :
# 9 chapitres, articles 1er à 42, ni tableau ni passage barré. Le front matter
# (rubrique « 3.- DROIT DE TIMBRE » du livre + références de consolidation) est
# écarté du corps et repris en note de section.
from __future__ import annotations

import html
import json
import os
import re
import zipfile

F = os.path.expanduser("~/Downloads/Code_Fiscal_Droit_de_Timbre_RECONSTITUE.docx")
OUT = os.path.dirname(os.path.abspath(__file__))

xml = zipfile.ZipFile(F).read("word/document.xml").decode("utf-8", "replace")
assert xml.count("<w:tbl>") == 0, "tableau imprévu"
assert not re.search(r"<w:strike\s*/>", xml), "passage barré imprévu"
rows = []
for p in re.findall(r"<w:p\b[^>]*(?:/>|>.*?</w:p>)", re.search(r"<w:body>(.*)</w:body>", xml, re.S).group(1), re.S):
    p1 = re.sub(r"<w:pPr>.*?</w:pPr>", "", p, flags=re.S)
    p1 = re.sub(r"<w:tab\b[^>]*/?>", " ", p1)
    p1 = re.sub(r"<w:br\s*/?>", " ", p1)
    t = html.unescape("".join(re.findall(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", p1, re.S)))
    t = re.sub(r"\s+", " ", t).strip()
    if t:
        rows.append(t)

# front matter : rubrique du livre + 3 paires « source (Moniteur …) » → écarté
first = next(i for i, t in enumerate(rows) if t.startswith("Chapitre I"))
front = rows[:first]
assert front[0] == "3.- DROIT DE TIMBRE" and "Décret du 29 novembre 1978" in front, front
assert first <= 8, front
rows = rows[first:]

HEAD = re.compile(r"^Chapitre\s+[IVX]+\s*-\s")
ART = re.compile(r"^Article\s+(1er|\d{1,2})\s*\.\-")
body_lines: list[str] = []
toc: list[dict] = []
labels: dict[str, str] = {}
anchors: list[str] = []
sec = 0
for t in rows:
    if HEAD.match(t) and len(t) < 90:
        sec += 1
        toc.append({"level": 1, "label": t, "anchor": f"sec-{sec}", "kind": "code"})
        body_lines.append(t)
        continue
    m = ART.match(t)
    if m:
        num = m.group(1)
        anchor = "art-" + ("1" if num == "1er" else num)
        assert anchor not in labels, f"tête en double : {t[:50]}"
        anchors.append(anchor)
        labels[anchor] = f"Article {num}"
    body_lines.append(t)

nums = sorted(int(a[4:]) for a in anchors)
assert nums == list(range(1, 43)), f"articles 1..42 attendus : {nums}"
assert len(toc) == 9, f"9 chapitres attendus : {len(toc)}"

body = "\n".join(body_lines) + "\n"
SENTINELS = [
    "Article 1er.- Le timbre est un impôt acquitté par le contribuable",
    "Chapitre VI - Quotité des droits de timbre",
    "Article 41.- Conformément au Décret du 26 septembre 1977",
    "Article 42.- Conformément à la Loi du 30 août 1978 sur le Budget",
]
for s in SENTINELS:
    assert s in body, f"SENTINELLE ABSENTE : {s[:60]}"
assert "3.- DROIT DE TIMBRE" not in body

# index compact curé (42 articles, couverture intégrale — assert), VÉRIFIÉ sur la
# première ligne et le chapitre de CHAQUE article (leçon Loi banques : jamais de
# sujet sans lecture ; premier jet chapitre-par-chapitre corrigé après lecture).
IDX: dict[str, list[int]] = {
    "Timbre (définition de l'impôt ; vignettes, papiers timbrés, estampilles)": [1],
    "Droit fixe et droit proportionnel": [2, 22, 23],
    "Nullité des actes non timbrés": [2, 35],
    "Matières imposables (commerciale, civile, judiciaire)": [3],
    "Papiers et documents commerciaux (assujettissement)": [4],
    "États financiers déposés à la DGI et aux banques (timbre)": [4],
    "Actes des officiers ministériels (notaires, arpenteurs)": [5, 22, 26, 30],
    "Actes judiciaires (huissiers, tribunaux, juges de paix)": [6, 25, 29],
    "Bordereaux, récépissés et quittances de l'Administration": [7],
    "Apposition du timbre (actes créés en Haïti ou à l'étranger)": [8],
    "Chèques tirés sur les banques (perception du timbre)": [9, 19],
    "Banques commises à la perception (compte « timbre », versements)": [10, 11, 12, 37],
    "Oblitération des timbres mobiles": [13, 14, 16],
    "Protêt d'effets commerciaux venus de l'étranger": [15],
    "Griffe d'oblitération (sociétés, compagnies, banques)": [17],
    "Prescription (deux ans)": [18],
    "Exemptions du droit de timbre": [19, 20, 21],
    "Billets à ordre souscrits aux banques (exemption)": [20],
    "Affiches, placards et panneaux": [21, 40],
    "Droit de timbre fixe (actes, enregistrement)": [22],
    "Droit de timbre proportionnel (obligations, billets, effets)": [23],
    "Timbres spéciaux des douanes": [24, 27],
    "Timbre Commerce et Industrie (G. 5.00)": [28],
    "Timbre Justice (décret du 25 janvier 1968)": [29],
    "Certificats et permis administratifs (timbre spécial de 1968)": [31],
    "Timbre sur charbon, bois, planches et pieux (décret de 1972)": [32],
    "Timbre Santé (abrogé par le décret du 14 octobre 1988)": [33],
    "Communication des registres aux agents fiscaux": [34],
    "Contraventions et amendes": [35, 36, 38, 39],
    "Timbres et papiers timbrés déjà servis (interdictions)": [38],
    "Altération de papier timbré ou de timbres mobiles": [39],
    "Banques et institutions de crédit (sanctions — renvoi au décret IR de 1977)": [41],
    "Valeurs du Trésor (Budget et Comptabilité Publique)": [42],
}
for s, refs in IDX.items():
    for r in refs:
        assert f"art-{r}" in labels, f"index « {s} » → art-{r} absent"
covered = {r for refs in IDX.values() for r in refs}
missing = [n for n in range(1, 43) if n not in covered]
assert not missing, f"articles non couverts : {missing}"
indexEntries = [{"subject": s, "ctRefs": [str(r) for r in refs]} for s, refs in sorted(IDX.items(), key=lambda kv: kv[0].lower())]

navToc = [{"label": e["label"], "anchor": e["anchor"], "children": [{"label": e["label"].split(" - ", 1)[1] if " - " in e["label"] else e["label"], "anchor": e["anchor"]}]} for e in toc]
ann = {
    "title": "Décret du 29 novembre 1978 sur le droit de timbre",
    "annotationAuthor": "",
    "navToc": navToc,
    "toc": toc,
    "connexes": [],
    "jurisprudence": {},
    "indexEntries": indexEntries,
    "crossRefs": [
        {
            "anchor": "sec-1",
            "articles": [],
            "note": "Texte CONSOLIDÉ : Décret du 29 novembre 1978 sur le droit de timbre (Le Moniteur n° 89 du "
            "18 décembre 1978), tel que modifié par les Lois de Finances 2011-2012 (Moniteur Spécial n° 2 du "
            "5 juin 2012) et 2013-2014 (Moniteur Spécial n° 2 du 10 juin 2014) — reproduction de l'édition "
            "Joseph Paillant du Code Fiscal d'Haïti (2018). Le texte d'origine de 1978 figure aussi sur la "
            "plateforme dans le corpus du Code de commerce annoté (série fiscale).",
        }
    ],
    "labels": labels,
    # art. 33 : « (Abrogé par le Décret du 14 octobre 1988 - Moniteur n° 95 - 1988) » — pastille.
    "status": {"art-33": "abrogé"},
}
assert body.count("(Abrogé par le Décret du 14 octobre 1988") == 1
open(f"{OUT}/bodyOriginal.txt", "w").write(body)
json.dump(ann, open(f"{OUT}/annotations.json", "w"), ensure_ascii=False, indent=1)
print(f"✓ corps {len(body_lines)} lignes · 42 articles · toc 9 · index {len(indexEntries)} sujets couverture 42/42")
