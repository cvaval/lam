#!/usr/bin/env python3
"""Loi N° 002-2018 portant Réforme du statut du commerçant (23 avril 2018, Le Moniteur
Spécial n° 5 du 21 mai 2018) → corps + annotations pour le lecteur annoté Lam.

SOURCE : docx vérifié (consigne cliente — le PDF du Moniteur ne sert qu'à la collation).
Décisions d'import (journalisées) :
  - <w:pPr> retiré avant extraction (piège <w:tabs> — leçon Décret sûretés) ;
  - en-têtes structurels en paires/triplets JOINTS « — » (libellés toc = lignes verbatim) ;
  - « Article N.-Texte » normalisé en « Article N.- Texte » (espace après « .- ») ;
  - le sommaire énoncé par l'article 1er (Chapitre I-Du Statut…) reste du TEXTE de l'article.
Usage : python3 scripts/data/loi-statut-commercant-2018/parse_lsc.py
"""
import zipfile, re, html, json, os

SRC = os.path.expanduser("~/Downloads/Statut de commercant.docx")
OUT = os.path.dirname(os.path.abspath(__file__))

z = zipfile.ZipFile(SRC)
xml = z.read("word/document.xml").decode("utf-8", "replace")
paras = re.findall(r"<w:p\b.*?</w:p>", xml, re.S)
def text_of(p):
    p1 = re.sub(r"<w:pPr>.*?</w:pPr>", "", p, flags=re.S)
    p2 = re.sub(r"<w:tab\b[^>]*/?>", " ", p1)
    t = html.unescape("".join(re.findall(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", p2, re.S)))
    return re.sub(r"\s+", " ", t).strip()
rows = [t for t in (text_of(p) for p in paras) if t]
assert len(rows) >= 280, f"docx inattendu ({len(rows)} ¶)"

# ── 1) Jointure des en-têtes structurels ──
HEAD_KW = re.compile(r"^(TITRE PREMIER|CHAPITRE\s+[IVX]+|SECTION\s+[IVX]+|LIVRE PREMIER)$")
UPPER = re.compile(r"^[A-ZÀ-ÖØ-Þ0-9''’ ,\.\-]+$")
out, i = [], 0
joined = 0
while i < len(rows):
    t = rows[i]
    if t == "CODE DE COMMERCE" and i + 2 < len(rows) and rows[i + 1] == "LIVRE PREMIER":
        out.append("CODE DE COMMERCE — LIVRE PREMIER — " + rows[i + 2]); joined += 1; i += 3; continue
    if HEAD_KW.match(t) and i + 1 < len(rows) and UPPER.match(rows[i + 1]) and not rows[i + 1].startswith("Article"):
        out.append(f"{t} — {rows[i + 1]}"); joined += 1; i += 2; continue
    out.append(t); i += 1
# Normalisations d'espacement (journalisées) : « Article N.-Texte » → « Article N.- Texte » ;
# items d'énumération COLLÉS « a)Fonctionnaires… » / « 1.Commerçants… » → espace après le
# marqueur (sinon le rendu ne reconnaît pas la liste et RECOUD la ligne au paragraphe
# précédent — 56 items lettrés + 5 numérotés constatés dans ce docx).
def normalize(l):
    l = re.sub(r"^(Article\s+(?:1er|\d{1,4}(?:-\d{1,2})?)\s*\.\-)(?=\S)", r"\1 ", l)
    l = re.sub(r"^([a-z]\))(?=\S)", r"\1 ", l)
    l = re.sub(r"^(\d{1,2}[.)°]\)?)(?=\S)", r"\1 ", l)
    # Fidélité au Moniteur (audit, collation visuelle p. 14) : le docx « corrige » en
    # « connaître » là où le Moniteur imprime « connaitre » (et garde « disparaitre »
    # ailleurs) — on revient à la graphie publiée.
    l = l.replace("aurait dû connaître", "aurait dû connaitre")
    return l
body_lines = [normalize(l) for l in out]
# RESTAURATION (journalisée) : le docx omet le triptyque d'ouverture de la loi, présent
# dans le Moniteur p. 10 (collation visuelle de l'audit) — réinséré verbatim avant
# « LOI N° : 002-2018 » pour que l'en-tête affiché soit conforme à la publication.
i_loi = next(i for i, l in enumerate(body_lines) if l.startswith("LOI N"))
assert not any(l == "CORPS LÉGISLATIF" for l in body_lines[:i_loi]), "triptyque déjà présent"
body_lines[i_loi:i_loi] = ["LIBERTÉ ÉGALITÉ FRATERNITÉ", "RÉPUBLIQUE D’HAÏTI", "CORPS LÉGISLATIF"]
print(f"jointures : {joined}")
assert joined == 1 + 1 + 3 + 9, f"attendu 14 jointures (triplet + TITRE + 3 CHAPITRES + 9 SECTIONS + ... ) : {joined}"

# ── 2) TOC (lignes charnières + en-têtes joints, verbatim) ──
def lvl(l):
    if re.match(r"^LOI PORTANT|^LOI$", l): return None
    if l.startswith("LOI N"): return 1                     # « LOI N° : 002-2018 » — tête du document
    if l.startswith("Le Pouvoir Exécutif"): return 2       # charnière préambule → dispositif
    if l.startswith("CODE DE COMMERCE — LIVRE PREMIER"): return 2
    if l.startswith("TITRE PREMIER — "): return 2
    if re.match(r"^CHAPITRE\s+[IVX]+ — ", l): return 3
    if re.match(r"^SECTION\s+[IVX]+ — ", l): return 4
    if l.startswith("Donné à la Chambre des Députés"): return 4  # clôt le dispositif (signatures)
    if l == "AU NOM DE LA RÉPUBLIQUE": return 2
    return None
toc, k = [], 0
for l in body_lines:
    v = lvl(l)
    if v is not None:
        k += 1
        toc.append({"label": l, "level": v, "anchor": f"sec-{k}", "kind": "code"})
print(f"toc : {len(toc)} en-têtes")
assert len(toc) == 1 + 1 + 1 + 1 + 3 + 9 + 1 + 1, f"attendu 18 : {len(toc)}"

# ── 3) Labels : porteurs (1, 2) + 65 articles du code ──
ART = re.compile(r"^Article\s+(1er|\d{1,4}(?:-\d{1,2})?)\s*\.\-\s")
labels, seq = {}, []
for l in body_lines:
    m = ART.match(l)
    if m:
        d = "1" if m.group(1) == "1er" else m.group(1)
        a = f"art-{d}"
        if a not in labels:
            labels[a] = f"Article {m.group(1)}"
            seq.append(a)
code_arts = [a for a in seq if "-" in a.replace("art-", "", 1)]
port = [a for a in seq if a not in code_arts]
print(f"porteurs : {port} · articles du code : {len(code_arts)}")
assert port == ["art-1", "art-2"], f"porteurs attendus art-1, art-2 : {port}"
assert len(code_arts) == 65, f"65 articles attendus : {len(code_arts)}"
EXPECT = {"1000": 1, "1111": 4, "1112": 9, "1120": 13, "1131": 2, "1132": 4, "1133": 9, "1134": 3, "1135": 3, "1136": 15, "1137": 2}
from collections import Counter
got = Counter(a.replace("art-", "").split("-")[0] for a in code_arts)
assert dict(got) == EXPECT, f"répartition inattendue : {dict(got)}"
# Sentinelles anti-circularité (choisies dans le Moniteur, jamais dans l'extraction)
SENTINELS = [
    "en vue de leur revente", "sauf s'il est émancipé", "cinq (5) ans",
    "quarante-huit (48) heures", "articles 1332-1 et 1332-2", "insusceptible de recours",
]
body_all = "\n".join(body_lines)
missing = [s for s in SENTINELS if s.replace("'", "’") not in body_all and s not in body_all]
assert not missing, f"sentinelles absentes : {missing}"  # AUCUNE exemption (audit : sentinelle morte interdite)

# ── 4) navToc descriptif ──
def sec(prefix):
    return next(t["anchor"] for t in toc if t["label"].startswith(prefix))
chap_secs = [t for t in toc if t["level"] in (3, 4)]
def kids(chapPrefix, nextPrefix):
    ia = next(i for i, t in enumerate(toc) if t["label"].startswith(chapPrefix))
    # Borne : prochain niveau ≤3, préfixe suivant, OU le bloc signatures (« Donné à la
    # Chambre… ») — l'audit avait relevé la promulgation classée en enfant du Chapitre III.
    ib = next((i for i, t in enumerate(toc) if i > ia and (t["level"] <= 3 or t["label"].startswith(nextPrefix) or t["label"].startswith("Donné"))), len(toc))
    return [{"label": t["label"], "anchor": t["anchor"]} for t in toc[ia + 1:ib] if t["level"] == 4]
navToc = [{
    "label": "Loi N° 002-2018 — Réforme du statut du commerçant", "anchor": sec("LOI N"),
    "children": [
        {"label": "Préambule (visas et considérants)", "anchor": sec("LOI N")},
        {"label": "Article 1er — Refonte du Titre 1er du Livre premier du Code de commerce", "anchor": "art-1"},
        {"label": "Article 1000-1 — Champ d'application", "anchor": "art-1000-1"},
        {"label": "Chapitre I — Du Statut du Commerçant (arts. 1111-1 à 1112-9)", "anchor": sec("CHAPITRE I — "), "children": kids("CHAPITRE I — ", "CHAPITRE II")},
        {"label": "Chapitre II — De la Prescription (arts. 1120-1 à 1120-13)", "anchor": sec("CHAPITRE II — ")},
        {"label": "Chapitre III — Du Registre du Commerce (arts. 1131-1 à 1137-2)", "anchor": sec("CHAPITRE III — "), "children": kids("CHAPITRE III — ", "ZZZ")},
        {"label": "Article 2 — Clause abrogatoire", "anchor": "art-2"},
        {"label": "Signatures et promulgation", "anchor": sec("Donné à la Chambre")},
    ],
}]

# ── 5) Index alphabétique curé ──
IDX = {
    "Acte de commerce par nature": ["1111-1", "1111-2"],
    "Acte de commerce par la forme (lettre de change, billet à ordre, warrant)": ["1111-3"],
    "Preuve des actes de commerce (voie électronique, livres)": ["1111-4"],
    "Capacité d'exercer le commerce": ["1112-1", "1112-2"],
    "Mineur émancipé": ["1112-2"],
    "Conjoint du commerçant": ["1112-2"],
    "Étranger commerçant — CARICOM": ["1112-3", "1112-9"],
    "Incompatibilités (fonctionnaires, officiers ministériels, militaires)": ["1112-4", "1112-5"],
    "Interdictions d'exercer le commerce": ["1112-6", "1112-7", "1112-8"],
    "Prescription commerciale (5 ans / 1 an)": ["1120-1", "1120-2", "1120-3"],
    "Suspension de la prescription (médiation, conciliation)": ["1120-5", "1120-6"],
    "Interruption de la prescription": ["1120-7", "1120-8", "1120-9", "1120-10"],
    "Renonciation à la prescription": ["1120-13"],
    "Registre du Commerce — missions": ["1131-1", "1131-2"],
    "Registre du Commerce — organisation": ["1132-1", "1132-2", "1132-3", "1132-4"],
    "Immatriculation au Registre du Commerce": ["1133-1", "1133-2", "1133-3", "1133-4"],
    "Radiation (cessation d'activité, décès)": ["1133-6"],
    "Présomption de la qualité de commerçant": ["1134-1", "1134-2"],
    "Fichier National": ["1135-1", "1135-2", "1135-3"],
    "Formalités par voie électronique": ["1136-1", "1136-3", "1136-4", "1136-8"],
    "Signature électronique et accusé d'enregistrement": ["1136-4", "1136-10", "1136-13"],
    "Contentieux du Registre du Commerce": ["1137-1", "1137-2"],
    "Patente (conditionnée à l'immatriculation)": ["1112-1"],
    "Entreprise individuelle à responsabilité limitée": ["1131-2", "1133-1"],
}
for s, refs in IDX.items():
    for r in refs:
        assert f"art-{r}" in labels, f"index « {s} » → art-{r} absent"
indexEntries = [{"subject": s, "ctRefs": refs} for s, refs in sorted(IDX.items(), key=lambda kv: kv[0].lower())]

ann = {"title": "Loi portant Réforme du statut du commerçant et des actes de commerce et organisant le registre du Commerce",
       "annotationAuthor": "", "navToc": navToc, "toc": toc, "connexes": [], "jurisprudence": {},
       "indexEntries": indexEntries, "labels": labels}
open(f"{OUT}/bodyOriginal.txt", "w").write("\n".join(body_lines) + "\n")
json.dump(ann, open(f"{OUT}/annotations.json", "w"), ensure_ascii=False, indent=1)
print(f"✓ corps {len(body_lines)} lignes · labels {len(labels)} · index {len(indexEntries)} sujets")
