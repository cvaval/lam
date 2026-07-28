#!/usr/bin/env python3
# Parseur de la VAGUE 2 fiscale (édition Joseph Paillant du Code Fiscal, 2018) :
#   1. CFGDCT — Loi du 20 août 1996 (Moniteur n° 64-A du 2 septembre 1996),
#      consolidée LF 2013-2014 et 2014-2015 — 8 articles, Livre I, 3ᵉ partie ;
#   2. CFPB — Contribution foncière des propriétés bâties, Décret du 5 avril 1979
#      (Moniteur n° 32-A du 19 avril 1979), modifié par le Décret du 23 décembre
#      1981, consolidé LF 2015-2016 et 2017-2018 — 37 articles, 6 chapitres,
#      19 passages barrés ;
#   3. ENREGISTREMENT — Décret du 28 septembre 1977 (Moniteur # 67 D - 1977),
#      Première partie « De l'enregistrement » — 112 articles, TITRES I à IX
#      COMPLETS (le TITRE IV, intitulé long de 146 caractères, avait été rejeté
#      par un filtre de longueur : constat d'audit BLOQUANT, corrigé — sentinelle
#      exigée sur les 9 têtes de titre).
#
# Conventions communes (leçons IR/patente) : runs BARRÉS retirés du corps vif et
# restitués en annotations repliables + pastille « modifié » ; lignes « Article N
# Loi de Finances … » préfixées « — » ; front matter (rubrique + références de
# consolidation) écarté du corps et REVERSÉ VERBATIM dans la note de tête.
from __future__ import annotations

import html
import json
import os
import re
import zipfile

D = os.path.expanduser("~/Downloads")
OUT = os.path.dirname(os.path.abspath(__file__))
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


def segs_of(path: str) -> list[tuple[str, str, str]]:
    xml = zipfile.ZipFile(path).read("word/document.xml").decode("utf-8", "replace")
    body = re.search(r"<w:body>(.*)</w:body>", xml, re.S).group(1)
    out = []
    for m in re.finditer(r"<w:tbl>.*?</w:tbl>|<w:p\b[^>]*(?:/>|>.*?</w:p>)", body, re.S):
        frag = m.group(0)
        if frag.startswith("<w:tbl>"):
            for tr in re.findall(r"<w:tr\b.*?</w:tr>", frag, re.S):
                cells = []
                for tc in re.findall(r"<w:tc\b.*?</w:tc>", tr, re.S):
                    ps = [para_parts(p)[0] for p in re.findall(r"<w:p\b[^>]*(?:/>|>.*?</w:p>)", tc, re.S)]
                    cells.append(" ".join(x for x in ps if x))
                cells = [c for c in cells if c]
                if cells:
                    out.append(("TBL", " — ".join(cells), ""))
        else:
            live, struck = para_parts(frag)
            if live or struck:
                out.append(("P", live, struck))
    return out


ART = re.compile(r"^Article\s+(\d{1,3})\s*\.\-")
LF = re.compile(r"^Article\s+\d{1,3}\s+\(?Loi de Finances")


def build(slug: str, sl: list, n_front: int, front_req: list[str], head_re, n_arts: int,
          title: str, note: str, sentinels: list[str], mod_note: str,
          note_in_commentaire: bool = False) -> dict:
    """Pipeline commun : front matter → corps + toc + barrés + LF ; sorties par texte."""
    front = [t for _, t, _ in sl[:n_front]]
    for req in front_req:
        assert any(req in t for t in front), f"{slug} : référence absente du front matter : {req}"
    rows = sl[n_front:]

    body_lines, toc, labels, anchors = [], [], {}, []
    commentaires: dict[str, list[str]] = {}
    status: dict[str, str] = {}
    sec = 0
    cur_anchor = cur_section = None
    for k, live, struck in rows:
        # limite anti-faux-positif LARGE : le TITRE IV de l'Enregistrement fait
        # 146 caractères — un filtre à 100 l'avait silencieusement rejeté du
        # sommaire (constat d'audit bloquant). Les motifs de tête sont précis ;
        # la limite ne sert qu'à écarter un alinéa qui COMMENCERAIT par le motif.
        if k == "P" and head_re and head_re.match(live) and len(live) < 170:
            sec += 1
            toc.append({"level": 1, "label": live, "anchor": f"sec-{sec}", "kind": "code"})
            body_lines.append(live)
            cur_section, cur_anchor = f"sec-{sec}", None
            continue
        if k == "P" and LF.match(live):
            body_lines.append(f"— {live}")
            continue
        m = ART.match(live) if k == "P" else None
        if m:
            anchor = f"art-{m.group(1)}"
            assert anchor not in labels, f"{slug} : tête en double {live[:50]}"
            anchors.append(anchor)
            labels[anchor] = f"Article {m.group(1)}"
            cur_anchor = anchor
        if live:
            body_lines.append(live)
        if struck:
            key = f"{cur_section or 'sec-0'}|{cur_anchor or 'art-0'}"
            commentaires.setdefault(key, []).append(f"{mod_note} : « {struck} »")
            if cur_anchor:
                status[cur_anchor] = "modifié"

    nums = sorted(int(a[4:]) for a in anchors)
    assert nums == list(range(1, n_arts + 1)), f"{slug} : articles 1..{n_arts} attendus, écart {set(range(1,n_arts+1)) ^ set(nums)}"
    body = "\n".join(body_lines) + "\n"
    for s in sentinels:
        assert s in body, f"{slug} : SENTINELLE ABSENTE : {s[:60]}"

    navToc = [{"label": e["label"], "anchor": e["anchor"], "children": [{"label": e["label"], "anchor": e["anchor"]}]} for e in toc] or [
        {"label": title, "anchor": "sec-0", "children": [{"label": title, "anchor": "sec-0"}]}
    ]
    # Un texte SANS section de tête (CFGDCT) n'a nulle part où afficher un renvoi de
    # section : la note de consolidation part alors en annotation repliable sous
    # l'article 1 (constat d'audit : note invisible sinon).
    if note_in_commentaire:
        commentaires.setdefault("sec-0|art-1", []).insert(0, note)
        crossRefs = []
    else:
        crossRefs = [{"anchor": toc[0]["anchor"] if toc else "sec-1", "articles": [], "note": note}]
    ann = {
        "title": title, "annotationAuthor": "", "navToc": navToc if toc else [], "toc": toc,
        "connexes": [], "jurisprudence": {}, "indexEntries": [],
        "crossRefs": crossRefs,
        "labels": labels, "commentaires": commentaires, "status": status,
    }
    os.makedirs(f"{OUT}/{slug}", exist_ok=True)
    open(f"{OUT}/{slug}/bodyOriginal.txt", "w").write(body)
    json.dump(ann, open(f"{OUT}/{slug}/annotations.json", "w"), ensure_ascii=False, indent=1)
    print(f"✓ {slug} : {len(body_lines)} lignes · {len(anchors)} articles · toc {len(toc)} · {sum(len(v) for v in commentaires.values())} barrés → {sorted(status) or '—'}")
    return ann


# ── 1+2. Livre I, 3ᵉ partie : CFGDCT + CFPB ─────────────────────────────────────
segs = segs_of(f"{D}/Code_Fiscal_2018_Livre_I_Troisieme_Partie_RECONSTITUE.docx")


def portion(startpat: str, endpat: str):
    starts = [i for i, (k, t, _) in enumerate(segs) if k == "P" and t.startswith(startpat)]
    a = starts[-1]
    b = next(i for i, (k, t, _) in enumerate(segs) if i > a and k == "P" and t.startswith(endpat))
    return segs[a:b]


build(
    "cfgdct", portion("1.- Contributions au Fonds", "2.- Patente"), 7,
    ["Loi du 20 août 1996", "Moniteur n° 64-A du 2 septembre 1996", "Loi de Finances 2013-2014", "Loi de Finances 2014-2015"],
    re.compile(r"^Dispositions transitoires$"), 8,
    "Loi du 20 août 1996 — Contributions au Fonds de Gestion et de Développement des Collectivités Territoriales (consolidée)",
    "Texte CONSOLIDÉ : Loi du 20 août 1996 portant Contributions au Fonds de Gestion et de Développement des "
    "Collectivités Territoriales — CFGDCT (Le Moniteur n° 64-A du 2 septembre 1996), telle que modifiée par les "
    "Lois de Finances 2013-2014 (Moniteur n° 2 du 10 juin 2014) et 2014-2015 (Moniteur spécial n° 3 du 1er octobre "
    "2014) — reproduction de l'édition Joseph Paillant du Code Fiscal d'Haïti (2018), Livre I, Troisième partie.",
    ["Article 1.- Il est établi, en complément des recettes communales", "Article 8.-", "Dispositions transitoires"],
    "Ancienne rédaction abrogée (barrée dans l'édition Paillant 2018)",
    note_in_commentaire=True,
)

build(
    "cfpb", portion("3.- Contribution foncière", "4.- Droit d'alignement"), 9,
    ["Décret du 5 avril 1979", "Moniteur n° 32-A du 19 avril 1979", "Décret du 23 décembre 1981", "Loi de Finances 2015-2016", "Loi de Finances 2017-2018"],
    re.compile(r"^Chapitre\s+[IVX]+\.\-\s"), 37,
    "Contribution foncière des propriétés bâties — Décret du 5 avril 1979 (texte consolidé)",
    "Texte CONSOLIDÉ : Décret du 5 avril 1979 sur la Contribution Foncière des Propriétés Bâties — CFPB, dite "
    "« impôt locatif » (Le Moniteur n° 32-A du 19 avril 1979), modifié par le Décret du 23 décembre 1981 (Moniteur "
    "n° 2 du 7 janvier 1982) et les Lois de Finances 2015-2016 (Moniteur spécial n° 4 du 1er octobre 2015) et "
    "2017-2018 (Moniteur spécial n° 27 du 19 septembre 2017) — reproduction de l'édition Joseph Paillant du Code "
    "Fiscal d'Haïti (2018), Livre I, Troisième partie. Les anciennes rédactions (barrées dans l'édition) sont "
    "restituées en annotation sous l'article concerné.",
    ["Chapitre I.- Définition", "Article 37.-"],
    "Ancienne rédaction abrogée (barrée dans l'édition Paillant 2018 — consolidation 1981/Lois de Finances)",
)

# ── 3. Livre II : Enregistrement (décret du 28 septembre 1977, 1ʳᵉ partie) ──────
segs2 = segs_of(f"{D}/Code_Fiscal_LivreII_Enregistrement_Conservation_Fonciere_RECONSTITUE.docx")
first = next(i for i, (k, t, _) in enumerate(segs2) if k == "P" and t.startswith("TITRE I"))
front2 = [t for _, t, _ in segs2[:first]]
assert any("[Le présent extrait couvre la rubrique 1" in t for t in front2), front2
assert any("Décret du 28 septembre 1977" in t for t in front2)
enr = build(
    "enregistrement", segs2[first - 0:], 0,
    [], re.compile(r"^TITRE\s+[IVX]+\s+—\s"), 112,
    "De l'enregistrement — Décret du 28 septembre 1977 (première partie)",
    "Décret du 28 septembre 1977 (Le Moniteur # 67 D - 1977), Première partie « De l'enregistrement », "
    "titres I à IX, articles 1 à 112 — reproduction de l'édition Joseph Paillant du Code Fiscal d'Haïti "
    "(2018), Livre II, Troisième partie, rubrique 1 « Enregistrement et conservation foncière ». La suite "
    "de la rubrique (conservation foncière, tarif du domaine privé) fera l'objet d'une prochaine vague.",
    ["TITRE I — Définition, nature & effets de l’enregistrement", "Article 112.- La date des actes sous signature privée"],
    "Ancienne rédaction abrogée (barrée dans l'édition Paillant 2018)",
)
# garde : les NEUF titres, I à IX, sont au sommaire — dont le TITRE IV à l'intitulé
# long (146 car.), qu'un filtre de longueur avait rejeté (audit : bloquant, corrigé).
labels_t = [e["label"] for e in enr["toc"]]
assert len(labels_t) == 9, f"9 TITRES attendus : {len(labels_t)}"
assert any(l.startswith("TITRE IV — Des actes qui doivent être enregistrés en débet") for l in labels_t), \
    "TITRE IV manquant au sommaire (filtre de longueur ?)"
print("✓ vague 2 : 3 corps écrits (index à joindre par texte)")
