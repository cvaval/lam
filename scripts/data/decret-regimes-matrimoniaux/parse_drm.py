#!/usr/bin/env python3
"""Décret portant réforme des régimes matrimoniaux (9 avril 2020, Moniteur Spécial n° 6
du 13 mai 2020) → corps + annotations pour le lecteur annoté Lam (patron Code civil).

Produit : bodyOriginal.txt + annotations.json (navToc, toc, labels, indexEntries).
Décisions d'import (journalisées ici) :
  - bandeau du Moniteur (8 lignes : manchette, SOMMAIRE, NUMÉRO SPÉCIAL) NON repris —
    la provenance vit dans Document.moniteurRef ;
  - intitulés multi-lignes JOINTS en une ligne (« SECTION IV — DES CLAUSES PAR
    LESQUELLES… ») : nécessaire à l'appariement sommaire↔corps (segmentAnnotated
    apparie des lignes entières) ; guillemet ouvrant « des citations retiré des seuls
    INTITULÉS (conservé partout ailleurs : texte officiel verbatim, § 02).
Usage : python3 scripts/data/decret-regimes-matrimoniaux/parse_drm.py
"""
import zipfile, re, html, json, os, sys

SRC = os.path.expanduser("~/Downloads/Decret_Regimes_Matrimoniaux_9_avril_2020.docx")
OUT = os.path.dirname(os.path.abspath(__file__))

z = zipfile.ZipFile(SRC)
xml = z.read("word/document.xml").decode("utf-8", "replace")
paras = re.findall(r"<w:p\b.*?</w:p>", xml, re.S)

def text_of(p):
    p2 = re.sub(r"<w:tab\b[^>]*/?>", " ", p)
    return html.unescape("".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", p2, re.S))).strip()

rows = [t for t in (text_of(p) for p in paras) if t]

# ── 1) Bandeau du Moniteur : retiré (8 premières lignes, jusqu'à « NUMÉRO SPÉCIAL ») ──
i0 = rows.index("LIBERTÉ — ÉGALITÉ — FRATERNITÉ") if "LIBERTÉ — ÉGALITÉ — FRATERNITÉ" in rows else 8
assert i0 <= 10, f"bandeau inattendu (LIBERTÉ à l'indice {i0})"
rows = rows[i0:]

# ── 2) Jointure des intitulés multi-lignes (séquences exactes, vérifiées) ──
JOINS = [
    (["« PREMIÈRE PARTIE", "DE LA COMMUNAUTÉ LÉGALE"], "PREMIÈRE PARTIE — DE LA COMMUNAUTÉ LÉGALE"),
    (["SECTION PREMIÈRE", "DE CE QUI COMPOSE LA COMMUNAUTÉ ACTIVEMENT ET PASSIVEMENT"],
     "SECTION PREMIÈRE — DE CE QUI COMPOSE LA COMMUNAUTÉ ACTIVEMENT ET PASSIVEMENT"),
    (["Paragraphe 2.-", "Du passif de la communauté, et des actions qui en résultent contre la communauté"],
     "Paragraphe 2.- Du passif de la communauté, et des actions qui en résultent contre la communauté"),
    (["SECTION II", "DE L’ADMINISTRATION DE LA COMMUNAUTÉ ET DES BIENS PROPRES"],
     "SECTION II — DE L’ADMINISTRATION DE LA COMMUNAUTÉ ET DES BIENS PROPRES"),
    (["SECTION III", "DE LA DISSOLUTION DE LA COMMUNAUTÉ ET DE QUELQUES-UNES DE SES SUITES"],
     "SECTION III — DE LA DISSOLUTION DE LA COMMUNAUTÉ ET DE QUELQUES-UNES DE SES SUITES"),
    (["« DEUXIÈME PARTIE", "DE LA COMMUNAUTÉ CONVENTIONNELLE", "ET DES CONVENTIONS QUI PEUVENT MODIFIER", "OU MÊME EXCLURE LA COMMUNAUTÉ LÉGALE"],
     "DEUXIÈME PARTIE — DE LA COMMUNAUTÉ CONVENTIONNELLE ET DES CONVENTIONS QUI PEUVENT MODIFIER OU MÊME EXCLURE LA COMMUNAUTÉ LÉGALE"),
    (["SECTION PREMIÈRE", "DE LA COMMUNAUTÉ DES MEUBLES ET ACQUÊTS"],
     "SECTION PREMIÈRE — DE LA COMMUNAUTÉ DES MEUBLES ET ACQUÊTS"),
    (["SECTION II", "DE LA CLAUSE DE PRÉLÈVEMENT MOYENNANT INDEMNITÉ"],
     "SECTION II — DE LA CLAUSE DE PRÉLÈVEMENT MOYENNANT INDEMNITÉ"),
    (["SECTION III", "DU PRÉCIPUT CONVENTIONNEL"], "SECTION III — DU PRÉCIPUT CONVENTIONNEL"),
    (["SECTION IV", "DES CLAUSES", "PAR LESQUELLES ON ASSIGNE À CHACUN DES ÉPOUX", "DES PARTS INÉGALES DANS LA COMMUNAUTÉ"],
     "SECTION IV — DES CLAUSES PAR LESQUELLES ON ASSIGNE À CHACUN DES ÉPOUX DES PARTS INÉGALES DANS LA COMMUNAUTÉ"),
    (["SECTION V", "DE LA COMMUNAUTÉ À TITRE UNIVERSEL"], "SECTION V — DE LA COMMUNAUTÉ À TITRE UNIVERSEL"),
    (["SECTION VI", "DE LA CLAUSE DE SÉPARATION DE BIENS"], "SECTION VI — DE LA CLAUSE DE SÉPARATION DE BIENS"),
]
def norm(s):  # apostrophes typographiques vs droites dans les comparaisons
    return s.replace("'", "’").strip()
out, i, joined = [], 0, 0
while i < len(rows):
    hit = None
    for seq, repl in JOINS:
        if i + len(seq) <= len(rows) and all(norm(rows[i + k]) == norm(seq[k]) for k in range(len(seq))):
            hit = (len(seq), repl); break
    if hit:
        out.append(hit[1]); i += hit[0]; joined += 1
    else:
        out.append(rows[i]); i += 1
assert joined == len(JOINS), f"jointures : {joined}/{len(JOINS)}"
# Guillemet ouvrant de citation devant une tête d'article (« Article 1174.-, « Article 1888.-) :
# retiré (sinon l'ancre #art-N n'est pas détectée) — même décision que pour les intitulés.
body_lines = [re.sub(r"^«\s*(?=Article\s)", "", l) for l in out]

# ── 3) TOC dérivée du CORPS (libellés = lignes réelles, VERBATIM — jamais retapés :
#      segmentAnnotated apparie à l'égalité stricte, apostrophes comprises) ──
JOINED = {norm(repl) for _, repl in JOINS}
def toc_level(line):
    n = norm(line)
    if n == "DÉCRÈTE": return 1
    if n in JOINED: return 2 if "PARTIE" in line else (4 if line.startswith("Paragraphe") else 3)
    if re.match(r"^Paragraphe \d\.-\s+\S", line): return 4  # « Paragraphe 1.- De l'actif… » (lignes simples)
    if norm(line).startswith("DISPOSITIONS COMMUNES AUX CINQ SECTIONS"): return 3
    return None
toc, k = [], 0
for l in body_lines:
    lvl = toc_level(l)
    if lvl is not None:
        k += 1
        toc.append({"label": l, "level": lvl, "anchor": f"sec-{k}", "kind": "code"})
assert len(toc) == 18, f"toc attendue 18 entrées, trouvé {len(toc)} : {[t['label'][:40] for t in toc]}"
order = {norm(t["label"]): i for i, t in enumerate(toc)}

# ── 4) Labels d'articles (décret 1-11 + articles du Code cités) ──
ART_RE = re.compile(r"^«?\s*Article\s+(1er|\d{1,4}(?:-\d+)?)\s*\.\-", re.I)
labels, seq = {}, []
for l in body_lines:
    m = ART_RE.match(l)
    if m:
        d = m.group(1)
        anchor = "art-1" if d == "1er" else f"art-{d}"
        if anchor not in labels:
            labels[anchor] = f"Article {d}"
            seq.append(anchor)
decret_arts = [a for a in seq if int(re.match(r"art-(\d+)", a).group(1)) <= 11 and "-" not in a.replace("art-", "", 1).replace("1er", "")]
quoted = [a for a in seq if a not in decret_arts]
print(f"articles du décret : {len(decret_arts)} → {decret_arts}")
print(f"articles du Code cités : {len(quoted)} (de {quoted[0]} à {quoted[-1]})")
assert decret_arts == [f"art-{n}" for n in range(1, 12)], "séquence 1..11 attendue"
assert "art-1212" not in labels, "1212 ne doit PAS être cité par le décret"
for a in ("art-1181-1", "art-1184-1", "art-1184-2", "art-1888"):
    assert a in labels, f"{a} attendu"

# ── 5) navToc (arbre descriptif, ancres réelles) ──
def sec(prefix):  # ancre du 1er libellé toc commençant par…
    return next(t["anchor"] for t in toc if norm(t["label"]).startswith(norm(prefix)))
i_p2 = next(i for i, t in enumerate(toc) if t["label"].startswith("DEUXIÈME PARTIE"))
navToc = [{
    "label": "Décret portant réforme des régimes matrimoniaux", "anchor": sec("DÉCRÈTE"),
    "children": [
        {"label": "Article 1er — Contrat de mariage : arts. 1174, 1181, 1181-1, 1184-1, 1184-2", "anchor": "art-1"},
        {"label": "Article 2 — Communauté légale (arts. 1186 à 1248)", "anchor": "art-2", "children": [
            {"label": t["label"], "anchor": t["anchor"]} for i, t in enumerate(toc) if 0 < i < i_p2]},
        {"label": "Article 3 — Abrogation des articles 1249 à 1281", "anchor": "art-3"},
        {"label": "Article 4 — Communauté conventionnelle (arts. 1282 à 1309)", "anchor": "art-4", "children": [
            {"label": t["label"], "anchor": t["anchor"]} for i, t in enumerate(toc) if i >= i_p2]},
        {"label": "Article 5 — Abrogation des articles 1310 à 1324", "anchor": "art-5"},
        {"label": "Article 6 — Article 1888 modifié (hypothèque légale)", "anchor": "art-6"},
        {"label": "Article 7 — Hypothèque légale de la femme mariée : Code civil", "anchor": "art-7"},
        {"label": "Article 8 — Hypothèque légale : Loi du 27 août 1913", "anchor": "art-8"},
        {"label": "Article 9 — Abrogation du Décret-loi du 11 janvier 1944", "anchor": "art-9"},
        {"label": "Article 10 — Disposition transitoire", "anchor": "art-10"},
        {"label": "Article 11 — Clause abrogatoire", "anchor": "art-11"},
    ],
}]

# ── 6) Index alphabétique (curé depuis le texte ; réfs = ancres présentes) ──
IDX = {
    "Acquêts": [1187, 1188], "Administration conjointe de la communauté": [1201, 1203, 1204],
    "Bail à usage d’habitation (décès d’un époux)": ["1184-2"],
    "Biens propres": [1189, 1190, 1191, 1192, 1193, 1205, 1206],
    "Biens réservés de la femme mariée (abrogation)": [9],
    "Changement de régime matrimonial": [1181, "1181-1", 10],
    "Clause de séparation de biens": [1302, 1303, 1304, 1305, 1306, 1307, 1308, 1309],
    "Communauté des meubles et acquêts": [1283, 1284, 1285, 1286],
    "Communauté à titre universel": [1299],
    "Contrat de mariage (immutabilité tempérée)": [1174, 1181, "1181-1"],
    "Dettes des époux": [1194, 1195, 1196, 1200, 1239, 1240, 1242],
    "Dissolution de la communauté": [1216, 1217, 1224, "1184-1", "1184-2"],
    "Dot (enfant commun)": [1213, 1214, 1215],
    "Emploi et remploi": [1208, 1209, 1210],
    "Homologation (Doyen du Tribunal de Première Instance)": [1181],
    "Hypothèque légale": [1888, 7, 8],
    "Liquidation et partage de la communauté": [1225, 1233, 1234, 1236, 1237, 1238],
    "Logement familial — usufruit du conjoint survivant": ["1184-1"],
    "Mandat entre époux": [1305, 1306, 1307],
    "Parts inégales (communauté)": [1295, 1296, 1297, 1298],
    "Passif de la communauté": [1194, 1195, 1196, 1197, 1198, 1199, 1200, 1239, 1240, 1241, 1242, 1243, 1244, 1245, 1246, 1247, 1248],
    "Préciput conventionnel": [1291, 1292, 1293, 1294],
    "Prélèvement moyennant indemnité": [1287, 1288, 1289, 1290],
    "Récompenses (communauté)": [1197, 1198, 1199, 1207, 1211, 1226, 1227, 1228, 1229, 1230, 1231, 1232],
    "Recel et détournement d’effets de la communauté": [1235],
    "Séparation de biens judiciaire": [1218, 1219, 1220, 1221, 1222, 1223, 1224],
    "Usufruit légal du conjoint survivant": ["1184-1"],
    "Abrogations (articles 1249 à 1281, 1310 à 1324)": [3, 5],
    "Disposition transitoire (professions séparées)": [10],
}
for s, refs in IDX.items():
    for r in refs:
        assert f"art-{r}" in labels, f"index « {s} » → art-{r} absent"
indexEntries = [{"subject": s, "ctRefs": refs} for s, refs in sorted(IDX.items(), key=lambda kv: kv[0].lower())]

ann = {"title": "Décret portant réforme des régimes matrimoniaux", "annotationAuthor": "",
       "navToc": navToc, "toc": toc, "connexes": [], "jurisprudence": {}, "indexEntries": indexEntries, "labels": labels}
open(f"{OUT}/bodyOriginal.txt", "w").write("\n".join(body_lines) + "\n")
json.dump(ann, open(f"{OUT}/annotations.json", "w"), ensure_ascii=False, indent=1)
print(f"✓ corps {len(body_lines)} lignes · toc {len(toc)} · labels {len(labels)} · index {len(indexEntries)} sujets")
