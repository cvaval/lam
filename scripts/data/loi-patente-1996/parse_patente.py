#!/usr/bin/env python3
# Parseur de la PATENTE — Loi du 10 juin 1996 (Moniteur n° 52 du 18 juillet 1996),
# refonte du Décret du 28 septembre 1987 (Moniteur n° 79), texte CONSOLIDÉ par les
# Lois de Finances 2012-2013 et 2015-2016 — édition Joseph Paillant du Code Fiscal
# d'Haïti (2018), Livre I, Troisième partie, rubrique « 2.- Patente ».
#
# Source : ~/Downloads/Code_Fiscal_2018_Livre_I_Troisieme_Partie_RECONSTITUE.docx
# (portion « 2.- Patente » → avant « 3.- Contribution foncière »).
#
# Particularités :
#  - articles 1 à 30, chapitres I-V + 18 SOUS-TITRES numérotés (« 1) Personnes
#    imposables »…) en LISTE BLANCHE verbatim (une énumération d'article commence
#    aussi par « a) »/« 1) » — seule la liste blanche est promue au sommaire) ;
#  - 6 passages BARRÉS (anciennes rédactions des arts 6, 7, 8 ×2, 12, 29 remplacées
#    par la LF 2015-2016) : retirés du corps vif, conservés en annotations
#    repliables + pastille « modifié » ;
#  - les articles de la LF 2015-2016 cités en regard (« Article N Loi de Finances
#    2015-2016 : … se lit désormais… ») sont PRÉFIXÉS « — » pour rester du texte
#    courant (sans préfixe, « Article 4 … » serait pris pour une tête d'article) ;
#  - tarif de patente : tableau Word de 93 lignes émis ligne-par-ligne (« — »).
from __future__ import annotations

import html
import json
import os
import re
import zipfile

F = os.path.expanduser("~/Downloads/Code_Fiscal_2018_Livre_I_Troisieme_Partie_RECONSTITUE.docx")
OUT = os.path.dirname(os.path.abspath(__file__))

xml = zipfile.ZipFile(F).read("word/document.xml").decode("utf-8", "replace")
body_xml = re.search(r"<w:body>(.*)</w:body>", xml, re.S).group(1)
STRIKE_RE = re.compile(r'<w:strike\s*/>|<w:strike\s+w:val="(?:1|true)"')


def para_parts(p: str) -> tuple[str, str]:
    live, struck = [], []
    for r in re.findall(r"<w:r\b[^>]*>.*?</w:r>", p, re.S):
        t = html.unescape("".join(re.findall(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", r, re.S)))
        if not t:
            continue
        (struck if STRIKE_RE.search(r) else live).append(t)
    clean = lambda s: re.sub(r"\s+", " ", s).strip()
    return clean("".join(live)), clean(" ".join(struck))


segs: list[tuple[str, str, str]] = []
for m in re.finditer(r"<w:tbl>.*?</w:tbl>|<w:p\b[^>]*(?:/>|>.*?</w:p>)", body_xml, re.S):
    frag = m.group(0)
    if frag.startswith("<w:tbl>"):
        for tr in re.findall(r"<w:tr\b.*?</w:tr>", frag, re.S):
            cells = []
            for tc in re.findall(r"<w:tc\b.*?</w:tc>", tr, re.S):
                ps = [para_parts(p)[0] for p in re.findall(r"<w:p\b[^>]*(?:/>|>.*?</w:p>)", tc, re.S)]
                cells.append(" ".join(x for x in ps if x))
            cells = [c for c in cells if c]
            if cells:
                segs.append(("TBL", " — ".join(cells), ""))
    else:
        live, struck = para_parts(frag)
        if live or struck:
            segs.append(("P", live, struck))

starts = [i for i, (k, t, _) in enumerate(segs) if k == "P" and t == "2.- Patente"]
a = starts[-1]
b = next(i for i, (k, t, _) in enumerate(segs) if i > a and k == "P" and t.startswith("3.- Contribution foncière"))
sl = segs[a:b]
front = [t for k, t, _ in sl[:9]]
assert front[0] == "2.- Patente" and "Loi du 10 juin 1996" in front and "Décret du 28 septembre 1987" in front, front
sl = sl[9:]
assert sl[0][1] == "Chapitre I.- Définition", sl[0]

# 18 sous-titres promus au sommaire (VERBATIM — liste blanche stricte)
SUBHEADS = [
    "1) Personnes imposables", "2) Critères d'assujettissement", "3) Personnes exonérées",
    "1) Règle générale", "2) Répartition des bases", "3) Réduction en faveur des artisans",
    "1) Annualité", "2) Début d'activité", "3) Cessation d'activité", "4) Transfert de commune",
    "1) Déclaration et paiement de la patente", "2) Certificat de patente", "3) Obligations comptables",
    "a) Comptabilité des recettes", "b) Comptabilité des salaires",
    "4) Droit de contrôle de l'administration", "5) Sanctions", "6) Dispositions spéciales",
]
TARIF = "Tarif de patente — Nomenclature des secteurs d’activités"
CHAP = re.compile(r"^Chapitre\s+[IVX]+\.\-\s")
ART = re.compile(r"^Article\s+(\d{1,2})\s*\.\-")
LF = re.compile(r"^Article\s+\d{1,2}\s+Loi de Finances")

body_lines: list[str] = []
toc: list[dict] = []
labels: dict[str, str] = {}
anchors: list[str] = []
commentaires: dict[str, list[str]] = {}
status: dict[str, str] = {}
sec = 0
cur_anchor: str | None = None
cur_section: str | None = None
sub_seen = 0

norm = lambda s: s.replace("’", "'")
for k, live, struck in sl:
    if k == "P" and (CHAP.match(live) or norm(live) in [norm(x) for x in SUBHEADS] or live == TARIF):
        sec += 1
        level = 1 if CHAP.match(live) or live == TARIF else 2
        if level == 2:
            sub_seen += 1
        toc.append({"level": level, "label": live, "anchor": f"sec-{sec}", "kind": "code"})
        body_lines.append(live)
        cur_section = f"sec-{sec}"
        cur_anchor = None
        continue
    if k == "P" and LF.match(live):
        body_lines.append(f"— {live}")  # citation de la LF en regard — pas une tête
        continue
    m = ART.match(live) if k == "P" else None
    if m:
        num = m.group(1)
        anchor = f"art-{num}"
        assert anchor not in labels, f"tête en double : {live[:50]}"
        anchors.append(anchor)
        labels[anchor] = f"Article {num}"
        cur_anchor = anchor
    if live:
        body_lines.append(live)
    if struck:
        key = f"{cur_section or 'sec-0'}|{cur_anchor or 'art-0'}"
        commentaires.setdefault(key, []).append(
            f"Ancienne rédaction abrogée (barrée dans l'édition Paillant 2018 — remplacée par la Loi de Finances 2015-2016) : « {struck} »"
        )
        if cur_anchor:
            status[cur_anchor] = "modifié"

assert sub_seen == len(SUBHEADS), f"sous-titres promus : {sub_seen}/{len(SUBHEADS)}"
nums = sorted(int(x[4:]) for x in anchors)
assert nums == list(range(1, 31)), f"articles 1..30 attendus : {nums}"
assert len([e for e in toc if e["level"] == 1]) == 6, "5 chapitres + tarif attendus"
assert sorted(status) == ["art-12", "art-29", "art-6", "art-7", "art-8"], status
tbl = sum(1 for l in body_lines if " — " in l and not l.startswith(("Chapitre", "Tarif", "—")))
assert tbl >= 93, f"lignes de tarif : {tbl}"

body = "\n".join(body_lines) + "\n"
SENTINELS = [
    "Article 1.- La patente est un impôt dont les recettes sont réparties entre l'État et les communes.",
    "— Article 4 Loi de Finances 2015-2016 : le troisième paragraphe de l'article 6",
    "Le droit variable est obtenu en multipliant la base définie ci-après par le taux de quatre pour mille (4/1000).",
    "architectes, arpenteurs, avocats, comptables, ingénieurs, médecins et spécialistes médicaux",
    "1er groupe : Port-au-Prince, Pétion-Ville, Carrefour, Delmas",
    "trente mille (30 000,00) gourdes",
    "N.B. : Les codes secteurs 633 à 649 puis 822.1 à 833.3 sont ajoutés",
]
for s in SENTINELS:
    assert s in body, f"SENTINELLE ABSENTE : {s[:70]}"
assert "2.- Patente" not in body
assert "multipliant la base définie ci-après par le taux de deux pour mille" not in body, "barré resté vif"
assert any("deux pour mille" in c for v in commentaires.values() for c in v)

# index curé (30 articles, couverture intégrale — rédigé après lecture INTÉGRALE)
IDX: dict[str, list[int]] = {
    "Patente (définition ; répartition des recettes État/communes)": [1],
    "Personnes imposables (activité professionnelle non salariée)": [2],
    "Établissement (imposition par établissement ; siège social)": [3, 9],
    "Exonérations de la patente (État, salariés, agriculteurs, coopératives, artistes)": [4],
    "Professionnels à patente personnelle (architectes, avocats, médecins…)": [5],
    "Droit fixe et droit variable": [6, 28],
    "Taux du droit variable (quatre pour mille — LF 2015-2016)": [6],
    "Chiffre d'affaires (calcul de la patente)": [7, 9, 15],
    "Masse salariale déductible": [8],
    "Ventilation entre établissements et secteurs d'activité": [9],
    "Artisans (réduction de 75 % du droit fixe)": [10],
    "Annualité (patente due au 1er octobre)": [11],
    "Création d'établissement (droit fixe de 5 000 gourdes — LF 2015-2016)": [12, 16],
    "Cessation d'activité": [13, 17, 27],
    "Transfert d'établissement entre communes": [14, 17],
    "Déclaration de patente (1er octobre – 15 décembre)": [15, 16],
    "Taxation d'office": [15, 26],
    "Certificat de patente (affichage, duplicata, défaut)": [18, 19, 24],
    "Numéro de patente (validité des actes ; recevabilité en justice)": [20],
    "Institutions financières (justification de la patente — LF 2015-2016)": [20],
    "Obligations comptables (enregistrement des recettes, conservation six ans)": [21],
    "Livre des salaires": [22],
    "Vérification des déclarations": [23],
    "Sanctions, amendes et intérêts de retard": [24, 25, 26],
    "Groupes de communes (1er, 2ᵉ, 3ᵉ) et modulation du tarif": [28],
    "Tarif de patente (nomenclature des secteurs d'activités)": [28],
    "Code des investissements (droit fixe de 30 000 gourdes — LF 2015-2016)": [29],
    "Partis politiques, associations, fondations et ONG (droit fixe annuel)": [29],
    "Dispositions transitoires (exercice 1986-1987)": [30],
}
for s, refs in IDX.items():
    for r in refs:
        assert f"art-{r}" in labels, f"index « {s} » → art-{r} absent"
covered = {r for refs in IDX.values() for r in refs}
missing = [n for n in range(1, 31) if n not in covered]
assert not missing, f"articles non couverts : {missing}"
indexEntries = [{"subject": s, "ctRefs": [str(r) for r in refs]} for s, refs in sorted(IDX.items(), key=lambda kv: kv[0].lower())]

navToc = []
cur_g = None
for e in toc:
    if e["level"] == 1:
        cur_g = {"label": e["label"], "anchor": e["anchor"], "children": []}
        navToc.append(cur_g)
    else:
        cur_g["children"].append({"label": e["label"], "anchor": e["anchor"]})
for g in navToc:
    if not g["children"]:
        g["children"] = [{"label": g["label"], "anchor": g["anchor"]}]

ann = {
    "title": "Loi du 10 juin 1996 relative à la patente (texte consolidé)",
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
            "note": "Texte CONSOLIDÉ de la patente : Décret du 28 septembre 1987 (Le Moniteur n° 79 du 28 "
            "septembre 1987) refondu par la Loi du 10 juin 1996 (Le Moniteur n° 52 du 18 juillet 1996), tel "
            "que modifié par les Lois de Finances 2012-2013 et 2015-2016 — reproduction de l'édition Joseph "
            "Paillant du Code Fiscal d'Haïti (2018). Les articles modificateurs de la LF 2015-2016 sont cités "
            "en regard (« — Article N Loi de Finances 2015-2016 : … ») ; les anciennes rédactions (barrées "
            "dans l'édition) sont restituées en annotation sous l'article concerné. Le décret de 1987 "
            "d'origine figure aussi sur la plateforme dans le corpus du Code de commerce annoté.",
        }
    ],
    "labels": labels,
    "commentaires": commentaires,
    "status": status,
}
open(f"{OUT}/bodyOriginal.txt", "w").write(body)
json.dump(ann, open(f"{OUT}/annotations.json", "w"), ensure_ascii=False, indent=1)
print(
    f"✓ corps {len(body_lines)} lignes · 30 articles · toc {len(toc)} (6 niv.1 + {sub_seen} sous-titres) · "
    f"index {len(indexEntries)} sujets couverture 30/30 · {sum(len(v) for v in commentaires.values())} barrés annotés · statuts {sorted(status)}"
)
