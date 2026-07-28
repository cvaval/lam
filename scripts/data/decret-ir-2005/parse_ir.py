#!/usr/bin/env python3
# Parseur du DÉCRET DU 29 SEPTEMBRE 2005 RELATIF À L'IMPÔT SUR LE REVENU, texte
# CONSOLIDÉ de l'édition Joseph Paillant du Code Fiscal d'Haïti (2018), Livre I,
# Première partie (articles 1 à 189, tel que modifié par les lois de finances).
#
# Source : ~/Downloads/Code_Fiscal_2018_Livre_I_Impot_sur_le_Revenu_RECONSTITUE.docx
# (transcription du fac-similé — la note d'édition du fichier décrit ses conventions).
#
# Particularités :
#  - EXCLUSIONS (pas du texte officiel) : bloc de titre d'édition, « Note d'édition »
#    (8 ¶), bloc « Table des matières » du livre — le corps commence à « TITRE I » ;
#  - passages BARRÉS (w:strike) = dispositions abrogées par lois de finances :
#    RETIRÉS du corps vif, conservés VERBATIM en annotations repliables
#    (`commentaires[sec|art]`) par article concerné ;
#  - articles INSÉRÉS par les lois de finances avec leur propre numérotation
#    (15, 31, 64, 65, 66 en double ; 63-1, 63-2) : conservés en place — seule la
#    1ʳᵉ occurrence d'un numéro porte l'ancre (garde seenArt de segmentAnnotated) ;
#  - 1 tableau Word (barème de l'impôt) émis ligne-par-ligne, cellules jointes « — »,
#    paragraphes d'une même cellule joints par espace (leçon Décret minier).
#
# Règle : INCLURE PAR DÉFAUT — seuls les blocs éditoriaux listés sont écartés ;
# sentinelles verbatim exigées aux quatre coins du texte.
from __future__ import annotations

import html
import json
import os
import re
import zipfile

F = os.path.expanduser("~/Downloads/Code_Fiscal_2018_Livre_I_Impot_sur_le_Revenu_RECONSTITUE.docx")
OUT = os.path.dirname(os.path.abspath(__file__))

xml = zipfile.ZipFile(F).read("word/document.xml").decode("utf-8", "replace")
body_xml = re.search(r"<w:body>(.*)</w:body>", xml, re.S).group(1)

STRIKE_RE = re.compile(r'<w:strike\s*/>|<w:strike\s+w:val="(?:1|true)"')


def para_parts(p: str) -> tuple[str, str]:
    """Texte (vif, barré) d'un paragraphe : les runs barrés séparés des runs vifs."""
    live, struck = [], []
    for r in re.findall(r"<w:r\b[^>]*>.*?</w:r>", p, re.S):
        t = html.unescape("".join(re.findall(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", r, re.S)))
        if not t:
            continue
        (struck if STRIKE_RE.search(r) else live).append(t)
    clean = lambda s: re.sub(r"\s+", " ", s).strip()
    return clean("".join(live)), clean(" ".join(struck))


rows: list[tuple[str, str, str]] = []  # (kind 'P'|'TBL', vif, barré)
for m in re.finditer(r"<w:tbl>.*?</w:tbl>|<w:p\b[^>]*(?:/>|>.*?</w:p>)", body_xml, re.S):
    frag = m.group(0)
    if frag.startswith("<w:tbl>"):
        for tr in re.findall(r"<w:tr\b.*?</w:tr>", frag, re.S):
            cells = []
            for tc in re.findall(r"<w:tc\b.*?</w:tc>", tr, re.S):
                paras = [para_parts(p)[0] for p in re.findall(r"<w:p\b[^>]*(?:/>|>.*?</w:p>)", tc, re.S)]
                cells.append(" ".join(x for x in paras if x))
            cells = [c for c in cells if c]
            if cells:
                rows.append(("TBL", " — ".join(cells), ""))
    else:
        live, struck = para_parts(frag)
        if live or struck:
            rows.append(("P", live, struck))

# ── 1. Bornage : écarter le front matter d'édition et la table des matières ──────
first_titre = next(i for i, (k, t, _) in enumerate(rows) if t == "TITRE I")
front = [t for _, t, _ in rows[:first_titre]]
assert any(t.startswith("Note d’édition") or t.startswith("Note d'édition") for t in front), "note d'édition attendue en tête"
assert any(t == "Table des matières" for t in front), "bloc TdM attendu en tête"
assert first_titre < 40, f"TITRE I trouvé trop loin (¶{first_titre})"
# Le front matter écarté comprend AUSSI (constat d'audit) : les étiquettes de
# compilation « PREMIÈRE PARTIE » / « 1. IMPÔT SUR LE REVENU » et le BLOC DE
# RÉFÉRENCES DE CONSOLIDATION — références d'AUTORITÉ reprises verbatim dans la
# note de tête (crossRefs sec-1), jamais perdues.
CONSOLIDATION_REFS = [
    ("Décret du 29 septembre 2005", "(Moniteur spécial # 10 du 5 octobre 2005)"),
    ("Modifiant celui du 29 septembre 1986", ""),
    ("Loi de Finances 2010-2011", "(Moniteur spécial # 1 du 14 janvier 2011)"),
    ("Loi de Finances 2013-2014", "(Moniteur spécial # 2 du 10 juin 2014)"),
    ("Loi de Finances 2014-2015", "(Moniteur spécial # 3 du 1er octobre 2014)"),
    ("Loi de Finances 2015-2016", "(Moniteur spécial # 4 du 1er octobre 2015)"),
    ("Loi de Finances 2017-2018", "(Moniteur spécial # 27 du 19 septembre 2017)"),
]
for a, b in CONSOLIDATION_REFS:
    assert any(a in t for t in front), f"référence de consolidation absente du front matter : {a}"
    if b:
        assert any(b.strip("()")[:25] in t for t in front), f"référence Moniteur absente : {b}"
rows = rows[first_titre:]

# ── 1 bis. Têtes transcrites SANS le « .- » (énumération collée) : rétablies, en
# liste blanche stricte — « Article 74.a) Entre le 1er… » → « Article 74.- a) … ».
DASHLESS = {"74"}
fixed = 0
for i, (k, live, struck) in enumerate(rows):
    m = re.match(r"^Article (\d{1,3})\.([a-z]\))", live)
    if k == "P" and m:
        assert m.group(1) in DASHLESS, f"tête sans « .- » imprévue : {live[:70]}"
        rows[i] = (k, f"Article {m.group(1)}.- {m.group(2)}" + live[len(m.group(0)):], struck)
        fixed += 1
assert fixed == len(DASHLESS), f"{fixed} têtes corrigées, {len(DASHLESS)} attendues"

# ── 2. Corps + annotations barrées ───────────────────────────────────────────────
ART = re.compile(r"^Article\s+(\d{1,3})(-\d)?\s*\.\-")
HEAD = re.compile(r"^(TITRE\s+[IVX]+|Chapitre\s+[IVX]+|Section\s+[IVX]+|PREMIÈRE PARTIE)", re.I)

body_lines: list[str] = []
toc: list[dict] = []
labels: dict[str, str] = {}
anchors: list[str] = []
commentaires: dict[str, list[str]] = {}
inserted_hosts: dict[str, str | None] = {}  # numéro inséré → ancre de l'article hôte
seen: set[str] = set()
sec = 0
cur_anchor: str | None = None
cur_section: str | None = None

for k, live, struck in rows:
    # limite anti-faux-positif : un TITRE peut être long (TITRE IV = 122 car.),
    # jamais un alinéa ne COMMENCE par « TITRE/Chapitre/Section [IVX] » suivi de peu.
    if k == "P" and HEAD.match(live) and len(live) < 140:
        sec += 1
        anchor = f"sec-{sec}"
        level = 1 if live.upper().startswith("TITRE") or live.upper().startswith("PREMIÈRE") else (2 if live.lower().startswith("chapitre") else 3)
        toc.append({"level": level, "label": live, "anchor": anchor, "kind": "code"})
        body_lines.append(live)
        cur_section = anchor
        cur_anchor = None
        continue
    m = ART.match(live)
    inserted_dup = False
    if m:
        num = m.group(1) + (m.group(2) or "")
        anchor = f"art-{num.replace('-', '-')}"
        if anchor not in seen:
            seen.add(anchor)
            anchors.append(anchor)
            labels[anchor] = f"Article {num}"
            cur_anchor = anchor
        else:
            # Occurrence INSÉRÉE par loi de finances répétant un numéro (2ᵉ Article
            # 15/31/64/65/66) : préfixée « — » pour rester du texte courant DANS le
            # bloc de l'article hôte — sans préfixe, elle volerait le badge et le
            # clic de l'index mènerait au 1ᵉʳ homonyme (constat d'audit).
            inserted_dup = True
            inserted_hosts.setdefault(num, cur_anchor)
    if live:
        body_lines.append(f"— {live}" if inserted_dup else live)
    if struck:
        # passage abrogé (barré chez Paillant) → annotation repliable de l'article courant
        key = f"{cur_section or 'sec-0'}|{cur_anchor or 'art-0'}"
        commentaires.setdefault(key, []).append(
            f"Passage abrogé (barré dans l'édition Paillant 2018) : « {struck} »"
        )

assert len(toc) >= 30, f"toc trop courte : {len(toc)}"
assert len(anchors) >= 185, f"ancres : {len(anchors)}"
base_nums = sorted({int(a.split('-')[1]) for a in anchors if re.fullmatch(r'art-\d+', a)})
assert base_nums == list(range(1, 190)), (
    f"articles 1..189 attendus : manquants {sorted(set(range(1,190)) - set(base_nums))}"
)
inserted = [a for a in anchors if not re.fullmatch(r"art-\d+", a)]
n_struck = sum(len(v) for v in commentaires.values())
print(f"✓ corps : {len(body_lines)} lignes · {len(anchors)} ancres (189 base + {inserted}) · toc {len(toc)} · {n_struck} passages barrés annotés")

# ── 3. Sentinelles ───────────────────────────────────────────────────────────────
body = "\n".join(body_lines) + "\n"
SENTINELS = [
    "TITRE I",
    "Article 1.-",
    "Article 15.- Sont exonérés de l’impôt sur le Revenu :",
    "(Loi de Finances 2013-2014, Moniteur# 2 spécial du 10 juin 2014)",  # insertion LF
    "Article 63-1.-",  # insertion à numéro tiret
    "Gde 1.00 à Gdes 60.000,00 — 0 %",  # barème (tableau)
    "À partir de 1.000.001,00 — 30%",
    "Article 188.- La loi du 5 Février 1995 instituant un acompte provisionnel",
    "Article 189.- Le présent décret abroge toutes lois ou dispositions de lois",
]
for s in SENTINELS:
    assert s in body, f"SENTINELLE ABSENTE : {s[:70]}"
for bad in ("Note d’édition", "Table des matières", "Avertissement — Ce document", "texte reconstitué à partir du fac-similé"):
    assert bad not in body, f"bloc éditorial resté dans le corps : {bad}"
# les 3 fragments barrés de l'art. 49 sont hors du corps vif ; l'UNIQUE occurrence
# restante est LÉGITIME (art. 187, seuils historiques des dispositions transitoires).
assert body.count("quinze millions") == 1, f"« quinze millions » ×{body.count('quinze millions')} dans le corps vif (1 attendu — art. 187)"
assert sum("quinze millions (15.000.000)" in c for v in commentaires.values() for c in v) == 3, "3 fragments barrés de l'art. 49 attendus en annotation"
print(f"✓ {len(SENTINELS)} sentinelles · blocs éditoriaux exclus · barrés hors corps mais annotés")

# ── 4. navToc : TITRES → chapitres/sections ─────────────────────────────────────
navToc = []
cur_g = None
cur_c = None
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
    "title": "Décret du 29 septembre 2005 relatif à l’Impôt sur le Revenu",
    "annotationAuthor": "",
    "navToc": navToc,
    "toc": toc,
    "connexes": [],
    "jurisprudence": {},
    "indexEntries": [],  # complété par _ir_index.json (curé séparément, assert à l'import)
    "crossRefs": [
        {
            "anchor": "sec-1",
            "articles": [],
            "note": "Texte CONSOLIDÉ : Décret du 29 septembre 2005 relatif à l'Impôt sur le Revenu "
            "(Le Moniteur spécial # 10 du 5 octobre 2005), modifiant celui du 29 septembre 1986, tel que "
            "modifié par les Lois de Finances 2010-2011 (Moniteur spécial # 1 du 14 janvier 2011), "
            "2013-2014 (Moniteur spécial # 2 du 10 juin 2014), 2014-2015 (Moniteur spécial # 3 du "
            "1er octobre 2014), 2015-2016 (Moniteur spécial # 4 du 1er octobre 2015) et 2017-2018 "
            "(Moniteur spécial # 27 du 19 septembre 2017) — reproduction de l'édition Joseph Paillant du "
            "Code Fiscal d'Haïti (2018), Livre I, Première partie. Les articles insérés par les lois de "
            "finances figurent à leur place de consolidation, précédés d'un tiret (« — Article 15.- (Loi "
            "de Finances 2013-2014…) ») sous l'article hôte ; les passages abrogés (barrés dans l'édition) "
            "sont restitués en annotation sous l'article concerné.",
        }
    ],
    "labels": labels,
    "commentaires": commentaires,
}
assert sorted(inserted_hosts) == ["15", "31", "64", "65", "66"], f"insertions homonymes : {sorted(inserted_hosts)}"
assert all(v for v in inserted_hosts.values()), f"insertion sans article hôte : {inserted_hosts}"
json.dump(inserted_hosts, open(f"{OUT}/_inserted_hosts.json", "w"), ensure_ascii=False, indent=1)
open(f"{OUT}/bodyOriginal.txt", "w").write(body)
json.dump(ann, open(f"{OUT}/annotations.json", "w"), ensure_ascii=False, indent=1)
print(
    f"✓ écrit : bodyOriginal.txt ({len(body_lines)} lignes) · annotations.json (toc {len(toc)}, labels {len(labels)}, "
    f"commentaires {len(commentaires)}) · hôtes des insertions : { {k: v for k, v in sorted(inserted_hosts.items())} }"
)
