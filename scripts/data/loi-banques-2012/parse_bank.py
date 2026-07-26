#!/usr/bin/env python3
"""Loi du 14 mai 2012 portant sur les banques et autres institutions financières
(promulguée 17 juillet 2012, Le Moniteur Spécial n° 4 du vendredi 20 juillet 2012)
→ corps + annotations pour le lecteur annoté Lam (sommaire + index — demande cliente).

Décisions d'import (journalisées) :
  - bandeau du Moniteur (ligne 1) retiré — provenance dans Document.moniteurRef ;
  - en-têtes TITRE/CHAPITRE en paires JOINTES « — » (libellés toc = lignes verbatim) ;
  - SECTIONS déjà en une ligne (deux styles du docx conservés : « SECTION 1 – … » et
    « SECTION 1.- … ») ;
  - <w:pPr> retiré avant extraction (piège <w:tabs>).
Usage : python3 scripts/data/loi-banques-2012/parse_bank.py
"""
import zipfile, re, html, json, os
from collections import Counter

SRC = os.path.expanduser("~/Downloads/Loi_Banques_Institutions_Financieres_20juillet2012.docx")
OUT = os.path.dirname(os.path.abspath(__file__))

z = zipfile.ZipFile(SRC)
xml = z.read("word/document.xml").decode("utf-8", "replace")
paras = re.findall(r"<w:p\b.*?</w:p>", xml, re.S)
def text_of(p):
    p1 = re.sub(r"<w:pPr>.*?</w:pPr>", "", p, flags=re.S)
    p2 = re.sub(r"<w:tab\b[^>]*/?>", " ", p1)
    p2 = re.sub(r"<w:br\s*/?>", " ", p2)
    t = html.unescape("".join(re.findall(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", p2, re.S)))
    return re.sub(r"\s+", " ", t).strip()
rows = [t for t in (text_of(p) for p in paras) if t]

# ── 1) Bandeau du Moniteur retiré (1ʳᵉ ligne « 167ème Année – Spécial No. 4 … ») ──
assert rows[0].startswith("167ème Année"), f"bandeau inattendu : {rows[0][:50]}"
rows = rows[1:]

# ── 2) Jointure TITRE/CHAPITRE + sous-titre ──
out, i, joined = [], 0, 0
HEAD = re.compile(r"^(TITRE\s+(?:I{1,3}|IV|\d)|CHAPITRE\s+\d)$")
while i < len(rows):
    t = rows[i]
    if HEAD.match(t) and i + 1 < len(rows):
        out.append(f"{t} — {rows[i + 1]}"); joined += 1; i += 2; continue
    out.append(t); i += 1
assert joined == 4 + 14, f"attendu 18 jointures (4 TITRES + 14 CHAPITRES) : {joined}"
# Items d'énumération COLLÉS (« 1)fonds propres… », « a.le capital ») : espace après le
# marqueur — sinon le rendu ne reconnaît pas la liste et recoud les lignes minuscules
# au paragraphe précédent (même leçon que la Loi 002-2018).
def normalize(l):
    l = re.sub(r"^([ivx]{2,4}[.)])(?=\S)", r"\1 ", l)  # sous-items romains « ii.les… »
    l = re.sub(r"^([a-z][.)])(?=\S)", r"\1 ", l)
    l = re.sub(r"^(\d{1,2}[.)°]\)?)(?=\S)", r"\1 ", l)
    return l
body_lines = [normalize(l) for l in out]

# ── 3) TOC (lignes charnières verbatim) ──
def lvl(l):
    if l == "LOI": return None
    if l.startswith("PORTANT SUR LES BANQUES"): return 1          # titre officiel
    if l.startswith("Et le Corps Législatif a voté"): return 2    # préambule → dispositif
    if re.match(r"^TITRE\s+(?:I{1,3}|IV|\d) — ", l): return 2
    if re.match(r"^CHAPITRE\s+\d — ", l): return 3
    if re.match(r"^SECTION\s+\d", l): return 4
    if l.startswith("Donnée au Sénat"): return 4                  # clôt le dispositif
    if l == "AU NOM DE LA RÉPUBLIQUE": return 2
    return None
toc, k = [], 0
for l in body_lines:
    v = lvl(l)
    if v is not None:
        k += 1
        toc.append({"label": l, "level": v, "anchor": f"sec-{k}", "kind": "code"})
assert len(toc) == 1 + 1 + 4 + 14 + 8 + 1 + 1, f"attendu 30 : {len(toc)} — {[t['label'][:30] for t in toc]}"

# ── 4) Labels : 206 articles ──
labels, seq = {}, []
for l in body_lines:
    m = re.match(r"^Article\s+(\d{1,3})\s*\.\-", l)
    if m and f"art-{m.group(1)}" not in labels:
        labels[f"art-{m.group(1)}"] = f"Article {m.group(1)}"
        seq.append(int(m.group(1)))
assert seq == list(range(1, 207)), f"séquence 1..206 attendue : {len(seq)} arts, ruptures {[n for n in range(1,207) if n not in seq][:5]}"

# Sentinelles anti-circularité (lues dans le texte, hors extraction)
SENTINELS = ["soixante millions de gourdes", "1er octobre au 30 septembre",
             "Unité Centrale de Renseignements Financiers", "quarante-cinq (45) jours",
             "sociétés financières de développement", "déclaration de confidentialité"]
body_all = "\n".join(body_lines)
missing = [s for s in SENTINELS if s not in body_all]
assert not missing, f"sentinelles absentes : {missing}"

# ── 5) navToc (arbre TITRES → CHAPITRES → SECTIONS, libellés réels) ──
def entries():
    res, cur_t, cur_c = [], None, None
    for t in toc:
        if t["level"] == 2 and t["label"].startswith("TITRE"):
            cur_t = {"label": t["label"], "anchor": t["anchor"], "children": []}; res.append(cur_t); cur_c = None
        elif t["level"] == 3 and cur_t is not None:
            cur_c = {"label": t["label"], "anchor": t["anchor"], "children": []}; cur_t["children"].append(cur_c)
        elif t["level"] == 4 and t["label"].startswith("SECTION") and cur_c is not None:
            cur_c["children"].append({"label": t["label"], "anchor": t["anchor"]})
    for t_ in res:
        for c in t_["children"]:
            if not c["children"]: del c["children"]
    return res
navToc = [{"label": "Loi sur les banques et autres institutions financières", "anchor": toc[0]["anchor"],
           "children": [{"label": "Préambule (visas et considérants)", "anchor": toc[0]["anchor"]}] + entries()
           + [{"label": "Signatures et promulgation (17 juillet 2012)", "anchor": next(t["anchor"] for t in toc if t["label"].startswith("Donnée au Sénat"))}]}]

# ── 6) INDEX ALPHABÉTIQUE — curé depuis la lecture des 206 articles (couverture 206/206) ──
IDX = {
    "Champ d'application de la loi": [1, 6],
    "Institution financière (définition)": [2, 19],
    "Banque (définition, fonds du public)": [3, 7],
    "Opérations connexes des banques": [4],
    "Sociétés de promotion des investissements": [5, 155],
    "Opération de crédit (définition)": [8],
    "Filiale et entreprise mère": [9, 10],
    "Contrôle d'une entreprise (définition)": [11],
    "Participation (définition)": [12],
    "Groupe (définition)": [13, 14],
    "Apparenté (définition)": [15],
    "Groupe de contreparties liées": [16],
    "Groupe financier": [17, 95, 104, 105],
    "Conglomérat financier": [18, 95, 104, 105],
    "Agrément des banques": [20, 23, 24, 26, 27],
    "Banques étrangères (établissement en Haïti)": [21, 25, 202],
    "Forme de société anonyme (banques)": [22],
    "Honorabilité et compétence (administrateurs, actionnaires)": [27, 28, 29],
    "Agences, succursales et points de service": [30, 160],
    "Retrait de l'agrément": [31, 159],
    "Administrateurs (statut, devoirs)": [32, 33, 36, 37, 38],
    "Dirigeants (statut, devoirs)": [34, 35, 37],
    "Prêts et crédits aux administrateurs et apparentés": [39],
    "Responsabilité civile et pénale (administrateurs, dirigeants)": [40, 41],
    "Capital minimum": [42, 158],
    "Fonds propres (ratios, exigences)": [43, 44, 45, 46, 47, 94],
    "Compte de réserve de capital": [48, 49],
    "Distribution de bénéfices (conditions)": [50],
    "Information du public sur les risques": [51],
    "Concurrence dans le secteur bancaire": [52],
    "Plafonds de participation (20 % / 5 %)": [53, 54],
    "Participation qualifiée (acquisition, cession)": [55, 56, 57],
    "Vérificateur indépendant (expert-comptable)": [58, 59, 60, 61, 62, 63, 64, 65, 66, 69, 70, 71],
    "Accès des vérificateurs aux registres": [67, 68],
    "Banque électronique (accès à distance)": [72, 73, 75],
    "Déclaration de confidentialité": [74],
    "Documents et messages électroniques (preuve)": [76, 77],
    "Monopole bancaire (exercice illégal)": [78, 79, 80],
    "Dénominations protégées (« banque », « bancaire »)": [81],
    "Compagnies d'assurance (opérations permises)": [82],
    "Banque de la République d'Haïti (régulation)": [83, 97, 203],
    "Normes de gestion (liquidité, solvabilité)": [84],
    "Règles de conduite": [85],
    "Exercice financier et publication des états": [86, 162],
    "Documents et informations à transmettre à la BRH": [87, 96, 163],
    "Autorisations préalables de la BRH": [88, 89, 164, 165],
    "Modification des statuts": [90, 91],
    "Gros risques (limites)": [92, 93, 94],
    "Surveillance consolidée": [95, 101, 102, 103, 104, 105],
    "Contrôle et inspection des banques": [98, 99, 100, 106, 107],
    "Recommandations et injonctions de la BRH": [108, 116, 169],
    "Sanctions administratives et amendes": [109, 110],
    "Influence néfaste d'actionnaires": [111],
    "Secret du personnel de la BRH (protection)": [112, 113],
    "Sous-capitalisation (seuils)": [114, 115],
    "Mesures préventives": [116, 117],
    "Administration provisoire": [118, 119, 120, 132],
    "Régime spécial de supervision": [121, 122, 123, 124, 125, 126],
    "Intervention directe de la BRH": [127, 128, 129, 130],
    "Équipe technique (restructuration)": [130, 131, 132],
    "Liquidation volontaire": [133, 139],
    "Liquidation forcée": [134, 135, 136, 137, 141, 144, 148],
    "Obligations de la banque en liquidation": [138],
    "Coffres-forts (liquidation)": [140],
    "Liquidateur (pouvoirs)": [137, 141, 142, 143, 145, 150],
    "Ordre de paiement des créances (liquidation)": [146, 147],
    "Reliquat d'actif et clôture de la liquidation": [149, 154],
    "Nullités de la période suspecte": [151, 152, 153],
    "Faillite des institutions financières": [134, 152, 153, 170],
    "Agrément des institutions financières non bancaires": [155, 156, 157, 158],
    "Agents de change": [156],
    "Contrôle des institutions financières non bancaires": [161, 166, 167, 168],
    "Blanchiment de capitaux (prévention)": [171, 172],
    "Banques correspondantes": [173],
    "Identification des clients": [174],
    "Déclaration de transactions (espèces, soupçons)": [175, 176],
    "Secret professionnel bancaire": [177, 178, 179, 180],
    "Unité Centrale de Renseignements Financiers (UCREF)": [179],
    "Crédit immobilier et hypothécaire": [181, 185, 187, 188],
    "Réserves obligatoires (taux préférentiels)": [182],
    "Exonérations et avantages fiscaux (logement)": [183, 184, 185, 186],
    "Recouvrement des créances de construction résidentielle": [187, 188],
    "Dation en paiement et biens adjugés": [189, 190],
    "Acquisition de biens en recouvrement de dettes (banques étrangères — dérogation à la loi du 16 juin 1975)": [190],
    "Émission et placement de titres": [191],
    "Fonds et avoirs délaissés": [192, 193],
    "Dépôts bancaires (répartition, tirage, frais)": [194, 195, 196],
    "Relevé de compte": [197],
    "Reproduction et conservation des documents": [198, 199],
    "Décès du titulaire d'un compte": [200],
    "Retenue sur avoirs (réquisition)": [201],
    "Non-discrimination par nationalité": [202],
    "Instructions de la BRH (application)": [203],
    "Banques d'épargne et de logement (transition)": [204],
    "Lois maintenues en vigueur": [205],
    "Clause abrogatoire": [206],
}
for s, refs in IDX.items():
    for r in refs:
        assert f"art-{r}" in labels, f"index « {s} » → art-{r} absent"
covered = set(r for refs in IDX.values() for r in refs)
uncovered = [n for n in range(1, 207) if n not in covered]
assert not uncovered, f"articles NON couverts par l'index : {uncovered}"
indexEntries = [{"subject": s, "ctRefs": refs} for s, refs in sorted(IDX.items(), key=lambda kv: kv[0].lower())]

ann = {"title": "Loi sur les banques et autres institutions financières", "annotationAuthor": "",
       "navToc": navToc, "toc": toc, "connexes": [], "jurisprudence": {}, "indexEntries": indexEntries, "labels": labels}
open(f"{OUT}/bodyOriginal.txt", "w").write("\n".join(body_lines) + "\n")
json.dump(ann, open(f"{OUT}/annotations.json", "w"), ensure_ascii=False, indent=1)
print(f"✓ corps {len(body_lines)} lignes · toc {len(toc)} · 206 articles · index {len(indexEntries)} sujets · couverture 206/206")
