#!/usr/bin/env python3
# Parseur du DÉCRET PORTANT ORGANISATION ET FONCTIONNEMENT DES INSTITUTIONS DE
# MICROFINANCE (IMF), donné au Palais National le 5 juin 2020, publié au
# Le Moniteur, Spécial N° 24 du 25 août 2020.
#
# Source : ~/Downloads/decret-imf-texte_1.docx (transcription du Journal officiel).
# Confronté au fac-similé (~/Library/CloudStorage/Dropbox/Moniteur/Microfinance.pdf,
# 24 pages) : 80 articles numérotés 1 à 81 SANS le 13 (lacune du J.O. lui-même,
# vérifiée p. 8), 32 en-têtes (5 TITRES + 18 CHAPITRES + 9 Sections).
#
# Conventions (docs/prompt-decret-imf-2020.md) :
#  - masthead + page de garde + visas + considérants + « DÉCRÈTE » CONSERVÉS (corps) ;
#  - en-têtes TITRE/CHAPITRE sur deux lignes → jointes « — » ; Sections verbatim ;
#  - têtes d'articles COLLÉES « Article 12.-L'agrément » → « Article 12.- L'agrément » ;
#    « Article 1ᵉʳ.- » → « Article 1er.- » ;
#  - marqueurs d'énumération COLLÉS « 1°)… », « a)… » → espace après le marqueur ;
#  - DEUX notes du transcripteur (lacune art. 13 ; structure de l'art. 35) : retirées
#    du corps — la 1ʳᵉ reversée en crossRefs (chap. 1, titre II), la 2ᵉ en commentaire
#    repliable sous l'art. 35 (rien n'est perdu) ;
#  - tableau final = signatures → « fonction — nom », ligne par ligne ;
#  - aucun passage barré.
from __future__ import annotations

import html
import json
import os
import re
import zipfile

F = os.path.expanduser("~/Downloads/decret-imf-texte_1.docx")
OUT = os.path.dirname(os.path.abspath(__file__))

xml = zipfile.ZipFile(F).read("word/document.xml").decode("utf-8", "replace")
body_xml = re.search(r"<w:body>(.*)</w:body>", xml, re.S).group(1)
assert not re.search(r"<w:strike\s*/>", xml), "passage barré imprévu"


def para_text(fragment: str) -> str:
    f = re.sub(r"<w:pPr>.*?</w:pPr>", "", fragment, flags=re.S)
    f = re.sub(r"<w:tab\b[^>]*/?>", " ", f)
    f = re.sub(r"<w:br\s*/?>", " ", f)
    t = html.unescape("".join(re.findall(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", f, re.S)))
    return re.sub(r"\s+", " ", t).strip()


rows: list[tuple[str, str]] = []  # ('P', texte) | ('TBL_ROW', 'fonction — nom')
for m in re.finditer(r"<w:tbl>.*?</w:tbl>|<w:p\b[^>]*(?:/>|>.*?</w:p>)", body_xml, re.S):
    frag = m.group(0)
    if frag.startswith("<w:tbl>"):
        for tr in re.findall(r"<w:tr\b.*?</w:tr>", frag, re.S):
            cells = []
            for tc in re.findall(r"<w:tc\b.*?</w:tc>", tr, re.S):
                paras = [para_text(p) for p in re.findall(r"<w:p\b[^>]*(?:/>|>.*?</w:p>)", tc, re.S)]
                cells.append(" ".join(x for x in paras if x))
            cells = [c for c in cells if c]
            if cells:
                rows.append(("TBL_ROW", " — ".join(cells)))
    else:
        t = para_text(frag)
        if t:
            rows.append(("P", t))

# ── 1. Normalisations (têtes collées, ordinal, marqueurs collés) ────────────────
NOTE = re.compile(r"^\[Note de transcription")
ART_GLUED = re.compile(r"^(Article\s+(?:1ᵉʳ|1er|\d{1,3})\.-)(\S)")
MARK_GLUED = re.compile(r"^(\d{1,3}°\)|[a-z]\)|\d{1,3}\))(\S)")
note_art13 = None
note_art35 = None
clean: list[tuple[str, str]] = []
for k, t in rows:
    if k == "P" and NOTE.match(t):
        if "article 13" in t or "à l’article 14" in t or "à l'article 14" in t:
            note_art13 = t
        else:
            note_art35 = t
        continue  # notes du transcripteur : hors corps
    if k == "P":
        t = t.replace("Article 1ᵉʳ.-", "Article 1er.-")
        m = ART_GLUED.match(t)
        if m:
            t = m.group(1) + " " + t[len(m.group(1)):]
        m = MARK_GLUED.match(t)
        if m:
            t = m.group(1) + " " + t[len(m.group(1)):]
    clean.append((k, t))
assert note_art13 and note_art35, "les deux notes du transcripteur doivent être présentes"
rows = clean

# ── 2. Jointure des en-têtes TITRE/CHAPITRE (intitulé sur la/les lignes suivantes) ──
HEAD = re.compile(r"^(TITRE|CHAPITRE)\s+(PREMIER|[IVX]+|\d{1,2})$")
SECTION = re.compile(r"^Section\s+\S")


def is_title_cont(t: str) -> bool:
    """Ligne d'intitulé (capitales) suivant un TITRE/CHAPITRE — ni en-tête ni article."""
    if HEAD.match(t) or SECTION.match(t) or t.startswith("Article "):
        return False
    return not re.search(r"[a-zà-öø-ÿ]", t)


body_lines: list[str] = []
toc: list[dict] = []
i = 0
sec = 0
while i < len(rows):
    k, t = rows[i]
    if k == "TBL_ROW":
        body_lines.append(t)
        i += 1
        continue
    m = HEAD.match(t)
    if m:
        parts = []
        j = i + 1
        while j < len(rows) and rows[j][0] == "P" and is_title_cont(rows[j][1]):
            parts.append(rows[j][1])
            j += 1
        assert parts, f"en-tête « {t} » sans intitulé (¶{i})"
        label = f"{t} — {' '.join(parts)}"
        sec += 1
        level = 1 if m.group(1) == "TITRE" else 2
        toc.append({"level": level, "label": label, "anchor": f"sec-{sec}", "kind": "code"})
        body_lines.append(label)
        i = j
        continue
    if SECTION.match(t):
        sec += 1
        toc.append({"level": 3, "label": t, "anchor": f"sec-{sec}", "kind": "code"})
        body_lines.append(t)
        i += 1
        continue
    body_lines.append(t)
    i += 1

assert len(toc) == 32, f"32 en-têtes attendus : {len(toc)} ({[e['level'] for e in toc]})"
assert [e["level"] for e in toc].count(1) == 5 and [e["level"] for e in toc].count(2) == 18 and [e["level"] for e in toc].count(3) == 9

# ── 3. Articles : ancres, labels, ordre ─────────────────────────────────────────
ART = re.compile(r"^Article\s+(1er|\d{1,3})\.-(?:\s|$)")
labels: dict[str, str] = {}
anchors: list[str] = []
order: list[int] = []
for ln in body_lines:
    if not ln.startswith("Article "):
        continue
    m = ART.match(ln)
    assert m, f"ligne « Article » non reconnue comme tête : {ln[:70]}"
    num = 1 if m.group(1) == "1er" else int(m.group(1))
    anchor = f"art-{num}"
    assert anchor not in labels, f"tête d'article en double : {ln[:50]}"
    labels[anchor] = "Article 1er" if num == 1 else f"Article {num}"
    anchors.append(anchor)
    order.append(num)

assert order == sorted(order), "numérotation non croissante"
assert order == [n for n in range(1, 82) if n != 13], (
    f"attendu 1..81 sauf 13 : manquants {sorted(set(range(1,82)) - {13} - set(order))}, "
    f"en trop {sorted(set(order) - (set(range(1,82)) - {13}))}"
)
# garde anti-circularité : aucune ligne « Article 13 » (toute forme) dans la SOURCE
assert not any(re.match(r"^Articles?\s+13\b", t) for k, t in rows if k == "P"), "un article 13 existe dans la source ?!"
print(f"✓ corps : {len(body_lines)} lignes · 80 articles (1→81 sans 13) · toc 32 (5+18+9)")

# ── 4. Annotations (art. 35 : note de structure) ────────────────────────────────
# clé sec|art : art. 35 relève du CHAPITRE 4 du TITRE II (Contrôle externe et
# supervision) → section « Section 2.- Supervision » (art. 34-35) ; on retrouve son
# ancre de section par segmentation logique (l'annotation est portée par l'article).
commentaires: dict[str, list[str]] = {}
# l'ancre de section de l'art. 35 sera calculée par segmentAnnotated ; on stocke la
# note sous une clé récupérée après coup (voir import). Ici on la garde par art seul,
# l'import la re-clé sur la vraie jurisKey.
commentaires_by_art = {"art-35": [note_art35.strip("[]").strip()]}

# ── 5. crossRefs : note art. 13 + table des textes cités (préambule) ────────────
chap1_t2 = next(e for e in toc if e["label"].startswith("CHAPITRE 1 — CATÉGORIES"))
CITED = [
    {"label": "Constitution de la République d’Haïti (art. 136, 159, 245)", "id": "cmr1it23a0000b4r0l6r1xp5l"},
    {"label": "Code civil", "id": "cmr4b6f3v0000iz56asjmwrlg"},
    {"label": "Code de commerce", "id": "cmrtnrxhu0000hg04ggz2lw0f"},
    {"label": "Loi du 3 août 1955 sur les sociétés anonymes", "id": "cmrtiwvt80000sa3z2kc7krwl"},
    {"label": "Loi du 13 juillet 1956 sur les compagnies d’assurance", "id": "cmrtix3ia0008sa3zg91rpcg3"},
    {"label": "Décret du 28 août 1960 (régime spécial des sociétés anonymes)", "id": "cmrtiwwuo0001sa3zovs1xgz4"},
    {"label": "Loi du 17 août 1979 créant la Banque de la République d’Haïti (BRH)", "id": "cmrtiw94r0001ue7edw6au9ca"},
    {"label": "Décret du 17 mai 1995 sur la libéralisation des taux d’intérêt", "id": "cmrtiwna3000hue7eew1lauci"},
    {"label": "Décret du 29 septembre 2005 sur l’Impôt sur le Revenu", "id": "cms43ptub00008lo8tv3y25kk"},
    {"label": "Loi du 14 mai 2012 sur les banques et autres institutions financières", "id": "cms18kwzl0002pt2kbk9kv39y"},
]
crossRefs = [
    {
        "anchor": "sec-1",
        "articles": [],
        "note": "Décret donné au Palais National le 5 juin 2020, publié au Journal officiel « Le Moniteur », "
        "Spécial N° 24 du 25 août 2020, et signé du Président Jovenel Moïse. Textes visés au préambule et "
        "déjà disponibles sur la plateforme :",
        "docs": CITED,
    },
    {
        "anchor": chap1_t2["anchor"],
        "articles": [],
        "note": "Le Journal officiel ne comporte pas d’article 13 : la numérotation passe directement de "
        "l’article 12 à l’article 14 (Le Moniteur, Spécial N° 24 du 25 août 2020, p. 8). La lacune est "
        "celle du texte publié ; le chapitre compte donc les articles 6 à 12 et 14 à 15.",
    },
]

# ── 6. connexe : circulaires d’application de la BRH sous l’art. 80 ──────────────
connexe = {
    "art-80": [
        {"label": "Circulaire BRH/IMF/2026/1 — Gestion du risque de crédit des institutions de microfinance",
         "text": "Mesure d’application prise par la BRH en vertu du présent article.", "docId": "cmqn0uy1q000013at67jc43f1"},
        {"label": "Circulaire BRH/IMF/2026/2 — Exigences minimales de liquidité des institutions de microfinance",
         "text": "Mesure d’application prise par la BRH en vertu du présent article.", "docId": "cmqn0v5eo000113atdcveup4j"},
        {"label": "Circulaire BRH/IMF/2026/3 — Exigences minimales de fonds propres des institutions de microfinance",
         "text": "Mesure d’application prise par la BRH en vertu du présent article.", "docId": "cmqn0vcqo000213atbxlip573"},
    ]
}

# ── 7. Sentinelles ───────────────────────────────────────────────────────────────
body = "\n".join(body_lines) + "\n"
SENTINELS = [
    "175ᵉ Année — Spécial N° 24 · PORT-AU-PRINCE · Mardi 25 Août 2020",
    "JOVENEL MOÏSE",
    "Vu la Constitution, notamment ses articles 136, 159 et 245 ;",
    "DÉCRÈTE",
    "Article 1er.- Le présent Décret régit l’organisation et le fonctionnement",
    "13°) Microcrédit : prêt ayant un montant inférieur à un seuil fixé",  # marqueur 13°) décollé
    "Article 12.- L’agrément ne peut être accordé",
    "Article 14.- La BRH tient à jour une liste publique des IMF agréées.",
    "Article 48.- Les dispositions du présent titre sont applicables :",  # article sous le TITRE III
    "Article 80.- La BRH est chargée de l’exécution du présent Décret",
    "Article 81.- Le présent Décret abroge",
    "Donné au Palais National, à Port-au-Prince, le 5 juin 2020, An 217ᵉ de l’Indépendance.",
    "Le Ministre de la Culture et de la Communication — Pradel HENRIQUEZ",  # dernière signature
]
for s in SENTINELS:
    assert s in body, f"SENTINELLE ABSENTE : {s[:70]}"
for bad in ("Note de transcription", "Aucun article numéroté 13 ne figure"):
    assert bad not in body, f"note de transcription restée dans le corps : {bad}"
print(f"✓ {len(SENTINELS)} sentinelles présentes · 2 notes de transcription exclues")

# ── 8. navToc : TITRES → chapitres → sections ────────────────────────────────────
navToc = []
cur_g = cur_c = None
for e in toc:
    if e["level"] == 1:
        cur_g = {"label": e["label"], "anchor": e["anchor"], "children": []}
        navToc.append(cur_g)
        cur_c = None
    elif e["level"] == 2:
        cur_c = {"label": e["label"], "anchor": e["anchor"], "children": []}
        cur_g["children"].append(cur_c)
    else:
        (cur_c["children"] if cur_c else cur_g["children"]).append({"label": e["label"], "anchor": e["anchor"]})
for g in navToc:
    if not g["children"]:
        g["children"] = [{"label": g["label"], "anchor": g["anchor"]}]

ann = {
    "title": "Décret portant organisation et fonctionnement des Institutions de Microfinance (IMF)",
    "annotationAuthor": "",
    "navToc": navToc,
    "toc": toc,
    "connexes": [],
    "jurisprudence": {},
    "indexEntries": [],  # joint par _imf_index.json à l'import (assert de couverture)
    "crossRefs": crossRefs,
    "labels": labels,
    "connexe": connexe,
    "commentaires": {},  # re-clé par l'import (art-35 → sec|art)
    "_commentaires_by_art": commentaires_by_art,
}
open(f"{OUT}/bodyOriginal.txt", "w").write(body)
json.dump(ann, open(f"{OUT}/annotations.json", "w"), ensure_ascii=False, indent=1)
print(f"✓ écrit : bodyOriginal.txt ({len(body_lines)} lignes) · annotations.json "
      f"(toc {len(toc)}, labels {len(labels)}, crossRefs {len(crossRefs)}, connexe art-80)")
