#!/usr/bin/env python3
"""Circulaire BRH n° 117-1 — Pratiques de gouvernance (20 novembre 2025).

Produit _body.txt (texte officiel, §02) et _struct.json (toc/navToc/labels/points).

Le texte n'a ni tableau ni note de bas de page (vérifié : word/footnotes.xml sans
contenu). Les 20 têtes sont des lignes AUTONOMES numérotées « N. » / « N.M. » /
« N.M.P » — reprises VERBATIM, ponctuation comprise (« 4.2.1 » n'a pas de point
final là où « 4.2.2. » en a un ; l'harmoniser casserait l'appariement).
"""
from __future__ import annotations

import html
import json
import os
import re
import zipfile

SRC = os.path.expanduser("~/Downloads/Circulaire-117-1.docx")
OUT = os.path.dirname(os.path.abspath(__file__))

# Tête de division : « 1. », « 4.2. », « 4.2.1 » — AUCUN filtre de longueur.
# (Leçon du TITRE IV de l'Enregistrement : un intitulé de 94 caractères avait été
# rejeté par un `len(...) < 100` et le texte publié affirmait à tort son absence.)
HEAD_RE = re.compile(r"^(\d{1,2}(?:\.\d{1,2})*)\.?\s+(\S.*)$")


def paragraphs(path: str) -> list[str]:
    xml = zipfile.ZipFile(path).read("word/document.xml").decode("utf-8", "replace")
    body = re.search(r"<w:body>(.*)</w:body>", xml, re.S).group(1)
    out: list[str] = []
    for m in re.finditer(r"<w:p\b[^>]*(?:/>|>.*?</w:p>)", body, re.S):
        # Puces du texte officiel : Word les code dans <w:numPr> (aucun caractère dans les
        # <w:t>). Sans restitution, les huit énumérations de la circulaire se lisent comme
        # une prose continue. Deux niveaux dans ce texte (ilvl 0 et 1).
        npr = re.search(r"<w:numPr>.*?</w:numPr>", m.group(0), re.S)
        lvl = 0
        if npr:
            il = re.search(r'<w:ilvl\s+w:val="(\d+)"', npr.group(0))
            lvl = int(il.group(1)) if il else 0
        p = re.sub(r"<w:pPr>.*?</w:pPr>", "", m.group(0), flags=re.S)
        # ⚠ La tabulation SÉPARE deux <w:t>. La remplacer par une espace nue dans le XML
        # ne sert à rien : seul le CONTENU des <w:t> est extrait, l'espace serait perdue
        # et les colonnes du Journal officiel se retrouveraient collées.
        p = re.sub(r"<w:tab\b[^>]*/?>", "<w:t> </w:t>", p)
        p = re.sub(r"<w:br\s*/?>", "<w:t> </w:t>", p)
        t = html.unescape("".join(re.findall(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", p, re.S)))
        t = re.sub(r"\s+", " ", t).strip()
        if t:
            out.append(("• " if lvl == 0 else "– ") + t if npr else t)
    return out


def main() -> None:
    lines = paragraphs(SRC)
    assert len(lines) == 142, f"142 paragraphes attendus, {len(lines)} lus"
    puces = [l for l in lines if l.startswith(("• ", "– "))]
    assert len(puces) == 8, f"8 énumérations attendues, {len(puces)} restituées"
    assert lines[1] == "No 117-1", lines[1]
    assert lines[-1] == "Gouverneur" and lines[-3].startswith("Port-au-Prince, le 20 novembre 2025")

    # Plan attendu, dans l'ordre. La détection consomme cette liste : une ligne n'est une
    # tête que si sa désignation est CELLE ATTENDUE À CE POINT du corps. Aucune heuristique
    # de longueur ni de ponctuation — donc rien à rejeter par erreur, et l'ordre est prouvé.
    expected = [
        "1", "2", "3", "4", "4.1", "4.2", "4.2.1", "4.2.2", "4.3",
        "5", "5.1", "5.2", "5.3", "6", "6.1", "6.2", "7", "8", "9", "10",
    ]
    heads: list[tuple[str, str]] = []  # (désignation, ligne verbatim)
    for l in lines:
        if len(heads) == len(expected):
            break
        m = HEAD_RE.match(l)
        if m and m.group(1) == expected[len(heads)]:
            heads.append((m.group(1), l))
    got = [d for d, _ in heads]
    assert got == expected, f"plan inattendu :\n  attendu {expected}\n  obtenu  {got}"
    # Aucune désignation du plan ne doit réapparaître ailleurs en tête de ligne : sinon
    # l'ancre serait ambiguë (la 2ᵉ occurrence resterait du texte, silencieusement).
    for desig, line in heads:
        dupes = [l for l in lines if l != line and (HEAD_RE.match(l) or [None]) and HEAD_RE.match(l) and HEAD_RE.match(l).group(1) == desig]
        assert not dupes, f"désignation {desig} répétée en tête de ligne : {dupes[:2]}"

    body = "\n".join(lines)
    labels = {}
    nav_children = []
    stack: list[dict] = []
    for desig, line in heads:
        anchor = "art-" + desig.replace(".", "-")
        title = HEAD_RE.match(line).group(2).rstrip()
        labels[anchor] = f"Point {desig}"
        depth = desig.count(".")
        node = {"label": f"{desig}. {title}", "anchor": anchor, "children": []}
        while len(stack) > depth:
            stack.pop()
        (stack[-1]["children"] if stack else nav_children).append(node)
        stack.append(node)

    struct = {
        "points": expected,
        "labels": labels,
        # Pas de `toc` : une circulaire n'a ni titre ni chapitre. Les divisions SONT les
        # points numérotés, ancrés art-… par la liste blanche `pointAnchors`.
        "toc": [],
        "navToc": [{"label": "Circulaire BRH n° 117-1 — Pratiques de gouvernance", "anchor": "art-1", "children": nav_children}],
    }
    open(f"{OUT}/_body.txt", "w", encoding="utf-8").write(body)
    json.dump(struct, open(f"{OUT}/_struct.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"✓ 117-1 : {len(lines)} ¶ · {len(heads)} divisions · {len(body)} car.")
    for d, l in heads:
        print(f"   art-{d.replace('.', '-'):<8} {l[:84]}")


if __name__ == "__main__":
    main()
