#!/usr/bin/env python3
"""Décret réformant le Droit des Sûretés (9 avril 2020, Le Moniteur Spécial n° 7 du
14 mai 2020) → corps + annotations pour le lecteur annoté Lam (patron Décret régimes
matrimoniaux). Produit : bodyOriginal.txt + annotations.json.

Décisions d'import (journalisées) :
  - bandeau du Moniteur (8 lignes) non repris — provenance dans Document.moniteurRef ;
  - intitulés en gras multi-lignes JOINTS en une ligne (« TITRE PREMIER — DISPOSITIONS
    MODIFIANT LE CODE CIVIL ») — libellés toc = lignes du corps VERBATIM ;
  - guillemet ouvrant « retiré des seules TÊTES d'article citées (sinon l'ancre est perdue).
Usage : python3 scripts/data/decret-suretes/parse_ds.py
"""
import zipfile, re, html, json, os

SRC = os.path.expanduser("~/Downloads/Officiel_Decret_Reformant_le_Droit_des_Suretes_2020-04-09.docx")
OUT = os.path.dirname(os.path.abspath(__file__))

z = zipfile.ZipFile(SRC)
xml = z.read("word/document.xml").decode("utf-8", "replace")
paras = re.findall(r"<w:p\b.*?</w:p>", xml, re.S)
def text_of(p):
    # Retirer d'abord les propriétés de paragraphe : un <w:tabs> dans le pPr (taquets des
    # 2 paragraphes de signature) ferait capturer du XML par le motif <w:t[^>]*> et perdre
    # le paragraphe entier (constat d'audit adversarial — bloc exécutoire manquant).
    p1 = re.sub(r"<w:pPr>.*?</w:pPr>", "", p, flags=re.S)
    p2 = re.sub(r"<w:tab\b[^>]*/?>", " ", p1)
    t = html.unescape("".join(re.findall(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", p2, re.S)))
    return re.sub(r"\s+", " ", t).strip()
def bold(p):
    pr = re.search(r"<w:pPr>.*?</w:pPr>", p, re.S)
    body = p[pr.end():] if pr else p
    runs = re.findall(r"<w:r\b.*?</w:r>", body, re.S)
    withtext = [r for r in runs if re.search(r"<w:t[^>]*>[^<]", r)]
    return bool(withtext) and all("<w:b/>" in r or "<w:b " in r for r in withtext)
rows = [(bold(p), text_of(p)) for p in paras]
rows = [r for r in rows if r[1] and not r[1].startswith("</w:")]  # scories XML de fin

# ── 1) Bandeau du Moniteur retiré ──
i0 = next(i for i, (_, t) in enumerate(rows) if t.startswith("LIBERTÉ"))
assert i0 <= 10, f"bandeau inattendu ({i0})"
rows = rows[i0:]

# ── 2) Jointure des intitulés GRAS multi-lignes (TITRE/CHAPITRE + leur sous-titre) ──
out, i, joined = [], 0, []
HEAD1 = re.compile(r"^(TITRE|CHAPITRE)\b", re.I)
while i < len(rows):
    b, t = rows[i]
    if b and HEAD1.match(t) and i + 1 < len(rows) and rows[i + 1][0] and not HEAD1.match(rows[i + 1][1]) and not rows[i + 1][1].startswith("Section"):
        out.append(f"{t} — {rows[i + 1][1]}")
        joined.append(out[-1])
        i += 2
    else:
        out.append(t)
        i += 1
# Guillemets de CITATION du Moniteur retirés (comme dans le Code civil) : chaque alinéa
# d'un texte cité ouvre par « et le bloc se ferme par » — à l'écran, le 1er alinéa (tête
# dont le « est retiré) dépareillait des suivants, et le lecteur voyait des « orphelins
# (constat cliente). Les guillemets INTERNES (« Sur les sûretés en général », « Caisses
# populaires ») sont préservés : seuls le « en tête de ligne et le » en fin de ligne
# (des mêmes lignes citées) tombent.
def strip_quotes(l):
    had = l.startswith("«")
    l2 = re.sub(r"^«\s*", "", l)
    if had or re.match(r"^(?:Article\s|\d+\)\s|[a-z]\)\s)", l2):
        # Un » final n'est retiré que s'il est ORPHELIN (aucun « restant dans la ligne) :
        # « Il est créé une Loi… intitulée : « Sur les sûretés en général ». » garde ses
        # guillemets internes ; « …souscrite par le débiteur ». » perd sa fermeture de bloc.
        if "«" not in l2:
            l2 = re.sub(r"\s*»\s*(\.)\s*$", r"\1", l2)   # « … ».  → ….
            l2 = re.sub(r"\s*»\s*;?\s*$", "", l2)         # « … » / « … » ;  → …
    return l2
body_lines = [strip_quotes(l) for l in out]
# Tête hybride de l'art. 600 C. com. : « Article 600 alinéas 3, 4 et 5.- » → « Article 600.- »
# (l'information « al. 3 à 5 » est portée par le libellé d'affichage ; sans cela, le corps
# affiché commençait par le fragment orphelin « alinéas 3, 4 et 5.- » — constat cliente).
body_lines = [re.sub(r"^Article 600 alinéas 3, 4 et 5\.\-", "Article 600.-", l) for l in body_lines]

# ── 3) TOC (lignes réelles, verbatim) ──
def lvl(l):
    if l == "DÉCRÈTE": return 1
    if re.match(r"^TITRE\b.+—", l): return 1
    if re.match(r"^CHAPITRE\b.+—", l): return 2
    if re.match(r"^Section\s+[IVX]+\.-", l): return 3
    return None
toc, k = [], 0
for l in body_lines:
    v = lvl(l)
    if v is not None:
        k += 1
        toc.append({"label": l, "level": v, "anchor": f"sec-{k}", "kind": "code"})
print(f"toc : {len(toc)} en-têtes")
assert len(toc) == 1 + 3 + 6 + 12, f"attendu 22 (DÉCRÈTE+3 TITRES+6 CHAPITRES+12 Sections), trouvé {len(toc)}"

# ── 4) Labels (décret 1-21 + articles cités, y compris n-m) ──
ART = re.compile(r"^Article\s+(1er|\d{1,4}(?:-\d+)?)\s*(?:alinéas[^.]*)?\.\-", re.I)
labels, seq = {}, []
for l in body_lines:
    m = ART.match(l)
    if m:
        d = m.group(1)
        a = "art-1" if d == "1er" else f"art-{d}"
        if a not in labels:
            labels[a] = f"Article {d}"
            seq.append(a)
dec = [a for a in seq if re.fullmatch(r"art-(?:[1-9]|1\d|2[01])", a)]
quoted = [a for a in seq if a not in dec]
print(f"articles du décret : {len(dec)} · cités : {len(quoted)}")
assert dec == [f"art-{n}" for n in range(1, 22)], f"séquence 1..21 attendue : {dec}"
assert len(quoted) == 83, f"83 articles cités attendus, trouvé {len(quoted)}"
labels["art-600"] = "Article 600 — C. com. (al. 3 à 5)"
for a in ("art-1611-1", "art-1611-2"):
    labels[a] = labels[a].replace("Article", "Article") + " — C. com."
# CC quotés : suffixe de lisibilité sur les amendés majeurs
for n in ("1780", "1782", "1838", "1839"):
    labels[f"art-{n}"] = f"Article {n} — C. civ. (nouvelle rédaction)"

# ── 5) navToc : arbre TITRES → CHAPITRES → Sections (libellés réels) + articles clés ──
def anchor_of(prefix):
    return next(t["anchor"] for t in toc if t["label"].startswith(prefix))
def children_between(a, b, minlvl):
    ia = next(i for i, t in enumerate(toc) if t["anchor"] == a)
    ib = next((i for i, t in enumerate(toc) if t["anchor"] == b), len(toc))
    return [{"label": t["label"], "anchor": t["anchor"]} for t in toc[ia + 1:ib] if t["level"] >= minlvl]
t1, t2, t3 = anchor_of("TITRE PREMIER"), anchor_of("TITRE II"), anchor_of("TITRE III")
navToc = [{
    "label": "Décret réformant le Droit des Sûretés", "anchor": anchor_of("DÉCRÈTE"),
    "children": [
        {"label": "TITRE PREMIER — Dispositions modifiant le Code civil (arts. 1er à 16)", "anchor": t1, "children": children_between(t1, t2, 2)},
        {"label": "TITRE II — Dispositions modifiant le Code de commerce (arts. 17 et 18)", "anchor": t2, "children": children_between(t2, t3, 2)},
        {"label": "TITRE III — Dispositions diverses et finales (arts. 19 à 21)", "anchor": t3},
    ],
}]

# ── 6) Index alphabétique curé ──
IDX = {
    "Agent des sûretés": ["1774-4", "1774-5", "1774-6", "1774-7", "1774-8", "1774-9", "1774-10"],
    "Antichrèse": ["1970-1", "1970-2", "1970-3", "1970-4", "1970-5", "1970-6", "1970-7", "1970-8", "1970-9", 16],
    "Cautionnement (acte, somme maximale)": [1780, 1782, 5],
    "Classement des privilèges": ["1869-1", "1869-2", "1869-3"],
    "Clause de réserve de propriété": ["1858-13", "1858-14", "1858-17", 18],
    "Droit de rétention": ["1859-1"],
    "Gage de meubles corporels": [1840, 1841, 1842, 1843, 1844, 1845, 1846, 1847, 1848, 1849, 9],
    "Gage avec ou sans dépossession": [1848, 1849, 1851, "1851-1", 1853],
    "Gage commercial (Code de commerce)": ["1611-1", "1611-2", 17],
    "Garantie autonome": ["1809-1", "1809-2", "1809-3", "1809-4", "1809-5", "1809-6", "1809-7", "1809-8", "1809-9", 6],
    "Lettre de confort": ["1809-10", 7],
    "Loi du 27 novembre 2008 (gage sans dépossession) — abrogation": [20],
    "Nantissement de créance": ["1858-1", "1858-2", "1858-3", "1858-7", "1858-8", "1858-9"],
    "Nantissement de compte": ["1858-6"],
    "Pacte commissoire (attribution du bien gagé)": [1854, 1855],
    "Propriété retenue à titre de garantie": ["1858-13", "1858-15", "1858-16", "1858-19", 11],
    "Réalisation du gage (défaut de paiement)": [1853, 1854, 1855],
    "Registre des Sûretés Mobilières": [1839, 1845],
    "Revendication en matière de faillite": [600, 18],
    "Sûretés en général (définition, accessoire)": ["1774-1", "1774-2", "1774-3", 1],
    "Sûretés mobilières (énumération)": [1838, 8],
    "Sûretés personnelles": ["1774-3", 4],
}
for s, refs in IDX.items():
    for r in refs:
        assert f"art-{r}" in labels, f"index « {s} » → art-{r} absent"
indexEntries = [{"subject": s, "ctRefs": refs} for s, refs in sorted(IDX.items(), key=lambda kv: kv[0].lower())]

ann = {"title": "Décret réformant le Droit des Sûretés", "annotationAuthor": "",
       "navToc": navToc, "toc": toc, "connexes": [], "jurisprudence": {}, "indexEntries": indexEntries, "labels": labels}
open(f"{OUT}/bodyOriginal.txt", "w").write("\n".join(body_lines) + "\n")
json.dump(ann, open(f"{OUT}/annotations.json", "w"), ensure_ascii=False, indent=1)
print(f"✓ corps {len(body_lines)} lignes · labels {len(labels)} · index {len(indexEntries)} sujets · jointures {len(joined)}")
