#!/usr/bin/env python3
"""Circulaire BRH n° 105-2 — Transmission des informations de crédit au BIC (15 sept. 2025).

Produit :
  _body.txt   texte officiel (§02), tableaux APLATIS ligne à ligne
  _clean.txt  version d'affichage : en-têtes courants « ANNEXE 3 » répétés retirés
  _rich.json  20 tableaux structurés (richBlocksJson), ancrés sur le texte aplati
  _struct.json points/labels/toc/navToc

Le corps numérote en « N.- » (12 points, dont 9.1 à 9.5) : ce sont les divisions,
ancrées art-… par la liste blanche `pointAnchors`. Les annexes, elles, ont de vrais
en-têtes autonomes → `toc` (ancres sec-N).
"""
from __future__ import annotations

import html
import json
import os
import re
import zipfile

SRC = os.path.expanduser("~/Downloads/BRH-Circulaire-105-2-15sept2025.docx")
OUT = os.path.dirname(os.path.abspath(__file__))

POINTS = ["1", "2", "3", "4", "5", "6", "7", "8", "9",
          "9.1", "9.2", "9.3", "9.4", "9.5", "10", "11", "12"]
HEAD_RE = re.compile(r"^(\d{1,2}(?:\.\d{1,2})*)\s*\.?\s*-?\s+(\S.*)$")

# En-têtes des annexes, dans l'ordre du corps. Repris VERBATIM : `segmentAnnotated`
# apparie par égalité de ligne entière, en séquence.
ANNEX_TOC = [
    (1, "ANNEXE 1"), (2, "A) SPÉCIFICATIONS POUR LE TRANSFERT DES FICHIERS"),
    (3, "1. INTRODUCTION"), (3, "2. CONNECTIVITÉ SFTP"),
    (3, "3. PROCESSUS DE TRANSMISSION"), (3, "4. RÉPERTOIRES"),
    (1, "ANNEXE 2"), (2, "B) SPÉCIFICATIONS DES FICHIERS DE COLLECTE DE DONNÉES"),
    (3, "1. Entreprise/Responsable/Actionnaire/Crédit"),
    (3, "2. Individu/Emploi/Crédit"),
    (3, "3. Crédit/Garantie"),
    (3, "4. Crédit/Activité"),
    (3, "5. Entreprise/Chèques retournés pour insuffisance de fonds"),
    (3, "6. Individu/Chèques retournés pour insuffisance de fonds"),
    (1, "ANNEXE 3"),
    (3, "Tableau 1 – Secteur d’activités"), (3, "Tableau 2 – Liste des communes"),
    (3, "Tableau 3 – Liste des pays"), (3, "Tableau 4 – Forme juridique"),
    (3, "Tableau 5 – Type de sûreté"), (3, "Tableau 6 – Nature de la garantie"),
    (3, "Tableau 7 – Liste des codes postaux"), (3, "Tableau 8.- Liste des professions"),
    (3, "Tableau 9 – Liste des codes sur le statut des crédits"),
    (3, "Tableau 10 – Responsabilité envers le crédit"),
]


def para_text(p: str) -> str:
    p = re.sub(r"<w:pPr>.*?</w:pPr>", "", p, flags=re.S)
    # ⚠ La tabulation sépare deux <w:t> : seule l'injection d'un <w:t> </w:t> préserve
    # l'espace (une espace nue dans le XML serait perdue à l'extraction).
    p = re.sub(r"<w:tab\b[^>]*/?>", "<w:t> </w:t>", p)
    p = re.sub(r"<w:br\s*/?>", "<w:t> </w:t>", p)
    t = html.unescape("".join(re.findall(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", p, re.S)))
    return re.sub(r"\s+", " ", t).strip()


def read_docx(path: str):
    """Parcourt le corps DANS L'ORDRE : paragraphes et tableaux entremêlés."""
    xml = zipfile.ZipFile(path).read("word/document.xml").decode("utf-8", "replace")
    body = re.search(r"<w:body>(.*)</w:body>", xml, re.S).group(1)
    items = []
    for m in re.finditer(r"(<w:tbl>.*?</w:tbl>)|(<w:p\b[^>]*(?:/>|>.*?</w:p>))", body, re.S):
        if m.group(1):
            rows = []
            for r in re.finditer(r"<w:tr\b[^>]*>.*?</w:tr>", m.group(1), re.S):
                cells = []
                for c in re.finditer(r"<w:tc\b[^>]*>.*?</w:tc>", r.group(0), re.S):
                    # Une cellule peut contenir PLUSIEURS paragraphes : les joindre par une
                    # espace (leçon du décret minier : sinon « zinc ;Concentré » collés).
                    ps = [para_text(x.group(0)) for x in re.finditer(r"<w:p\b[^>]*(?:/>|>.*?</w:p>)", c.group(0), re.S)]
                    cells.append(" ".join(x for x in ps if x))
                if any(cells):
                    rows.append(cells)
            if rows:
                items.append(("table", rows))
        else:
            t = para_text(m.group(2))
            if t:
                items.append(("p", t))
    return items


def main() -> None:
    items = read_docx(SRC)
    tables = [rows for kind, rows in items if kind == "table"]
    assert len(tables) == 20, f"20 tableaux attendus, {len(tables)} lus"

    # ── Corps officiel : paragraphes + tableaux aplatis (une ligne par rangée) ──
    # `lines`       = texte officiel intégral (§02), en-têtes courants compris ;
    # `clean_lines` = texte AFFICHÉ, dont les 6 « ANNEXE 3 » répétés (en-têtes courants de
    #                 page du scan) sont retirés. Les ancres des tableaux sont calculées sur
    #                 le texte AFFICHÉ, seul auquel richBlocksJson s'applique.
    lines: list[str] = []
    clean_lines: list[str] = []
    tables_at: list[int] = []  # indice, dans clean_lines, de la 1ʳᵉ rangée de chaque tableau
    seen_annexe3 = False
    for kind, val in items:
        if kind == "p":
            lines.append(val)
            if val == "ANNEXE 3":
                if seen_annexe3:
                    continue  # en-tête courant répété : hors affichage
                seen_annexe3 = True
            clean_lines.append(val)
            continue
        tables_at.append(len(clean_lines))
        for row in val:
            flat = " | ".join(row)
            lines.append(flat)
            clean_lines.append(flat)

    body = "\n".join(lines)
    clean = "\n".join(clean_lines)
    removed = len(lines) - len(clean_lines)
    assert removed == 6, f"6 en-têtes courants « ANNEXE 3 » attendus, {removed} retirés"
    assert lines[2] == "No. 105-2", lines[2]
    assert "abroge la circulaire 105-1 en date du 3 avril 2017" in body
    assert "Port-au-Prince, le 15 septembre 2025." in lines

    # ── Ancrage des 20 tableaux sur le texte affiché ──
    rich: list[dict] = []
    for t, (rows, at) in enumerate(zip(tables, tables_at)):
        after = clean_lines[at - 1] if at else None
        end = at + len(rows)
        nxt = next((l for l in clean_lines[end:] if " | " not in l), None)
        assert after and len(after) >= 6, f"T{t + 1} : ancre de tête trop courte ({after!r})"
        assert nxt and len(nxt) >= 6, f"T{t + 1} : ancre de fin absente"
        rich.append({
            "type": "table",
            "rows": [[{"text": c, "header": (i == 0)} for c in row] for i, row in enumerate(rows)],
            "afterText": after,
            "untilText": nxt,
        })

    # ── Divisions du corps : liste blanche vérifiée dans l'ordre ──
    heads: list[tuple[str, str]] = []
    for l in lines:
        if len(heads) == len(POINTS):
            break
        m = HEAD_RE.match(l)
        if m and m.group(1) == POINTS[len(heads)]:
            heads.append((m.group(1), l))
    assert [d for d, _ in heads] == POINTS, f"plan du corps inattendu : {[d for d, _ in heads]}"

    # ── TOC des annexes : chaque libellé DOIT être une ligne entière du texte affiché ──
    toc, navannex, stack = [], [], []
    for i, (level, label) in enumerate(ANNEX_TOC, start=1):
        assert label in clean_lines, f"libellé TOC absent du corps : « {label} »"
        assert clean_lines.count(label) == 1, f"libellé TOC ambigu ({clean_lines.count(label)}×) : « {label} »"
        anchor = f"sec-{i}"
        toc.append({"level": level, "label": label, "anchor": anchor, "kind": "code"})
        node = {"label": label, "anchor": anchor, "children": []}
        while len(stack) >= level:
            stack.pop()
        (stack[-1]["children"] if stack else navannex).append(node)
        stack.append(node)

    # ── Sommaire du corps ──
    labels, navcorps, cur9 = {}, [], None
    for desig, line in heads:
        anchor = "art-" + desig.replace(".", "-")
        labels[anchor] = f"Point {desig}"
        title = HEAD_RE.match(line).group(2)
        short = re.split(r"(?<=[a-zà-ÿ])\s*[:;]|\.\s", title)[0][:74].rstrip(" ,")
        node = {"label": f"{desig}.- {short}", "anchor": anchor, "children": []}
        if "." in desig:
            cur9["children"].append(node)
        else:
            navcorps.append(node)
            if desig == "9":
                cur9 = node

    struct = {
        "points": POINTS,
        "labels": labels,
        "toc": toc,
        "navToc": [
            {"label": "Circulaire BRH n° 105-2", "anchor": "art-1", "children": navcorps},
            {"label": "Annexes", "anchor": "sec-1", "children": navannex},
        ],
    }
    open(f"{OUT}/_body.txt", "w", encoding="utf-8").write(body)
    open(f"{OUT}/_clean.txt", "w", encoding="utf-8").write(clean)
    json.dump(rich, open(f"{OUT}/_rich.json", "w", encoding="utf-8"), ensure_ascii=False)
    json.dump(struct, open(f"{OUT}/_struct.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"✓ 105-2 : {len(lines)} lignes · {len(body)} car. · {len(heads)} divisions · "
          f"{len(toc)} en-têtes d'annexe · {len(rich)} tableaux ({sum(len(t) for t in tables)} rangées)")


if __name__ == "__main__":
    main()
