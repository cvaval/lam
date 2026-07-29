#!/usr/bin/env python3
# Parseur de la LOI PORTANT ORGANISATION ET FONCTIONNEMENT DE L'UNITÉ CENTRALE DE
# RENSEIGNEMENTS FINANCIERS (UCREF) — votée le 4 mai 2017 (Chambre) et le 8 mai 2017
# (Sénat), promulguée le 12 mai 2017, publiée au Moniteur, 172ᵉ Année, Spécial N° 16
# du 25 mai 2017 (date confirmée par l'Index du Moniteur déjà en base).
#
# Source : ~/Downloads/Loi_UCREF_2017_Le_Moniteur_Special_16.docx (168 ¶, ni tableau
# ni passage barré). Cf. docs/prompt-loi-ucref-2017.md.
#
# Pièges traités :
#  - têtes d'articles COLLÉES « Article 1.-Il est créé » → « Article 1.- Il est créé » ;
#  - marqueurs d'énumération COLLÉS « a)Un Président » → « a) Un Président » ;
#  - COLONNES du J.O. aplaties par des tabulations (97 <w:tab/>) : sans conversion on
#    obtient « LIBERTÉÉGALITÉFRATERNITÉ », « Jean Willer JEANHermano EXINORD » →
#    tabulation remplacée par une espace AVANT extraction des <w:t> ;
#  - CHAPITRE + intitulé sur deux lignes → jointure « — » ; les 6 Sections sont déjà
#    sur une seule ligne et restent VERBATIM.
from __future__ import annotations

import html
import json
import os
import re
import zipfile

F = os.path.expanduser("~/Downloads/Loi_UCREF_2017_Le_Moniteur_Special_16.docx")
OUT = os.path.dirname(os.path.abspath(__file__))

xml = zipfile.ZipFile(F).read("word/document.xml").decode("utf-8", "replace")
assert xml.count("<w:tbl>") == 0, "tableau imprévu"
assert not re.search(r"<w:strike\s*/>", xml), "passage barré imprévu"
body_xml = re.search(r"<w:body>(.*)</w:body>", xml, re.S).group(1)

rows: list[str] = []
for m in re.finditer(r"<w:p\b[^>]*(?:/>|>.*?</w:p>)", body_xml, re.S):
    p = re.sub(r"<w:pPr>.*?</w:pPr>", "", m.group(0), flags=re.S)
    # ⚠ la tabulation sépare deux <w:t> : la remplacer par une simple espace dans le
    # XML ne sert à rien (seul le CONTENU des <w:t> est extrait, l'espace serait
    # jetée et les colonnes du J.O. resteraient collées). On injecte donc un vrai
    # élément texte.
    p = re.sub(r"<w:tab\b[^>]*/?>", "<w:t> </w:t>", p)
    p = re.sub(r"<w:br\s*/?>", "<w:t> </w:t>", p)
    t = html.unescape("".join(re.findall(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", p, re.S)))
    t = re.sub(r"\s+", " ", t).strip()
    if t:
        rows.append(t)

# ── 1. Filet de sécurité : plus AUCUN collage ne doit subsister ──────────────────
# Les têtes d'articles et les marqueurs d'énumération sont séparés de leur texte par
# une TABULATION dans le J.O. : restituée ci-dessus, elle rend toute normalisation
# inutile. Le filet reste, mais il ne doit jamais avoir à intervenir (assertion).
ART_GLUED = re.compile(r"^(Article\s+\d{1,3}\.-)(\S)")
MARK_GLUED = re.compile(r"^([a-z]\)|\d{1,2}\))(\S)")
glued = [t for t in rows if ART_GLUED.match(t) or MARK_GLUED.match(t)]
assert not glued, f"collages résiduels ({len(glued)}) : {glued[:3]}"
print(f"✓ aucun collage résiduel (tabulations du J.O. restituées)")

# ── 2. En-têtes : CHAPITRE (2 lignes → « — ») + Sections (verbatim) ──────────────
CHAP = re.compile(r"^CHAPITRE\s+(Ier|[IVX]+)$")
SECTION = re.compile(r"^Section\s+[IVX]+\.\-\s")
body_lines: list[str] = []
toc: list[dict] = []
i = sec = 0
while i < len(rows):
    t = rows[i]
    if CHAP.match(t):
        assert i + 1 < len(rows), f"CHAPITRE sans intitulé (¶{i})"
        titre = rows[i + 1]
        assert not re.search(r"[a-zà-öø-ÿ]", titre) or titre.isupper(), f"intitulé douteux : {titre[:60]}"
        label = f"{t} — {titre}"
        sec += 1
        toc.append({"level": 1, "label": label, "anchor": f"sec-{sec}", "kind": "code"})
        body_lines.append(label)
        i += 2
        continue
    if SECTION.match(t):
        sec += 1
        toc.append({"level": 2, "label": t, "anchor": f"sec-{sec}", "kind": "code"})
        body_lines.append(t)
        i += 1
        continue
    body_lines.append(t)
    i += 1

assert len(toc) == 10, f"10 en-têtes attendus (4 CHAPITRES + 6 Sections) : {len(toc)}"
assert [e["level"] for e in toc].count(1) == 4 and [e["level"] for e in toc].count(2) == 6

# ── 3. Articles ─────────────────────────────────────────────────────────────────
ART = re.compile(r"^Article\s+(\d{1,3})\.-(?:\s|$)")
labels: dict[str, str] = {}
order: list[int] = []
for ln in body_lines:
    if not ln.startswith("Article "):
        continue
    m = ART.match(ln)
    assert m, f"ligne « Article » non reconnue : {ln[:70]}"
    n = int(m.group(1))
    anchor = f"art-{n}"
    assert anchor not in labels, f"tête en double : {ln[:50]}"
    labels[anchor] = f"Article {n}"
    order.append(n)
assert order == list(range(1, 33)), f"articles 1..32 attendus : {order}"
print(f"✓ corps : {len(body_lines)} lignes · 32 articles · toc 10 (4 chapitres + 6 sections)")

# ── 4. Sentinelles (dont les trois colonnes décollées) ──────────────────────────
body = "\n".join(body_lines) + "\n"
SENTINELS = [
    "LOI PORTANT ORGANISATION ET FONCTIONNEMENT DE L'UNITÉ CENTRALE DE RENSEIGNEMENTS FINANCIERS (UCREF)",
    "Vu la Constitution du 29 mars amendée notamment les articles 111, 111-1, 136, 234 et 236 ;",
    "Le Pouvoir Exécutif a proposé et le Pouvoir Législatif a voté la loi suivante :",
    "CHAPITRE Ier — DE LA DÉNOMINATION",
    "Article 1.- Il est créé par la présente loi un organisme autonome",
    "a) Un Président désigné par la Banque de la République d'Haïti ;",   # marqueur décollé
    "Section V.- Du Comité National de Lutte contre le Blanchiment des Avoirs (CNLBA)",
    "Article 32.- La présente loi abroge",
    "Donnée à la Chambre des Députés, le jeudi 4 mai 2017, An 214è de l'Indépendance.",
    "Donnée au Sénat de la République, le lundi 8 mai 2017, An 214ème de l'Indépendance.",
    "Jean Willer JEAN Hermano EXINORD",          # colonnes décollées (tabulation)
    "Premier Secrétaire Deuxième Secrétaire",    # idem
    "LIBERTÉ ÉGALITÉ FRATERNITÉ",                # idem
    "Donné au Palais National, à Port-au-Prince, le 12 mai 2017, An 214è de l'Indépendance.",
]
for s in SENTINELS:
    assert s in body, f"SENTINELLE ABSENTE : {s[:70]}"
for bad in ("LIBERTÉÉGALITÉ", "JEANHermano", "SecrétaireDeuxième", "Note éditoriale"):
    assert bad not in body, f"artefact resté dans le corps : {bad}"
print(f"✓ {len(SENTINELS)} sentinelles · colonnes du J.O. décollées · aucune note éditoriale")

# ── 5. navToc + crossRefs (textes visés en ligne + note sur les dates) ───────────
navToc = []
cur = None
for e in toc:
    if e["level"] == 1:
        cur = {"label": e["label"], "anchor": e["anchor"], "children": []}
        navToc.append(cur)
    else:
        cur["children"].append({"label": e["label"], "anchor": e["anchor"]})
for g in navToc:
    if not g["children"]:
        g["children"] = [{"label": g["label"].split(" — ", 1)[-1], "anchor": g["anchor"]}]

CITED = [
    {"label": "Constitution de la République d'Haïti (art. 111, 111-1, 136, 234, 236)", "id": "cmr1it23a0000b4r0l6r1xp5l"},
    {"label": "Code pénal", "id": "cmrhdnzvm0000ywp2v4amq505"},
    {"label": "Loi du 17 août 1979 créant et organisant la Banque de la République d'Haïti", "id": "cmrtiw94r0001ue7edw6au9ca"},
]
ann = {
    "title": "Loi portant organisation et fonctionnement de l'Unité Centrale de Renseignements Financiers (UCREF)",
    "annotationAuthor": "",
    "navToc": navToc,
    "toc": toc,
    "connexes": [],
    "jurisprudence": {},
    "indexEntries": [],   # joint par _ucref_index.json à l'import
    "crossRefs": [
        {
            "anchor": "sec-1",
            "articles": [],
            "note": "Loi votée par la Chambre des Députés le 4 mai 2017 et par le Sénat le 8 mai 2017, "
            "promulguée le 12 mai 2017, publiée au Journal officiel « Le Moniteur », 172ᵉ Année, Spécial "
            "N° 16 du 25 mai 2017. Elle est citée « Loi du 8 mai 2017 » par le Décret du 5 juin 2020 sur "
            "les Institutions de Microfinance. Le sommaire et l'index qui accompagnent ce texte sur la "
            "plateforme sont des apparats ÉDITORIAUX reconstitués : ils ne figurent pas au Journal "
            "officiel. Textes visés au préambule et disponibles sur la plateforme :",
            "docs": CITED,
        }
    ],
    "labels": labels,
}
open(f"{OUT}/bodyOriginal.txt", "w").write(body)
json.dump(ann, open(f"{OUT}/annotations.json", "w"), ensure_ascii=False, indent=1)
print(f"✓ écrit : bodyOriginal.txt ({len(body_lines)} lignes) · annotations.json (toc {len(toc)}, labels {len(labels)}, crossRefs 1 avec {len(CITED)} liens)")
