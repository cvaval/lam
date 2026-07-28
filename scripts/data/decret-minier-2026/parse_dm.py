#!/usr/bin/env python3
# Parseur du DÉCRET RÉGISSANT LES ACTIVITÉS MINIÈRES (Le Moniteur, Spécial N° 16 du
# 30 mars 2026, donné au Palais National le 27 mars 2026).
#
# Quatre sources (~/Downloads) :
#  - Décret_activités_minières_Moniteur_Spécial_16_30-03-2026.docx : pages 1-32,
#    masthead + préambule + articles 1 à 142 (s'achève sur une note de transcription
#    « [Fin de l'extrait…] » qui N'EST PAS du texte officiel → écartée) ;
#  - Decret_Minier_Moniteur_30_mars_2026.docx : pages 33-62, articles 143 à 306 +
#    signatures (6 lignes de couverture + 1 « AVERTISSEMENT ÉDITORIAL » du
#    transcripteur → écartées) ; contient 1 tableau Word (taux de redevance,
#    art. 232.2) émis ligne-par-ligne, cellules jointes « — » ;
#  - Decret_Minier_2026_Sommaire.docx : sommaire préparé par la cliente — AUTORITÉ
#    de validation de la structure (TITRES/CHAPITRES + plages d'articles) ;
#  - Decret_Minier_2026_Index_alphabetique.docx : index alphabétique préparé par la
#    cliente — AUTORITÉ de l'index (sujets + renvois aux articles).
#
# Particularités du texte :
#  - articles décimaux officiels « 39.1 », « 165.2 », « 302.1 »… → ancre art-39-1
#    (prettyRef réaffiche « 39.1 ») ;
#  - l'article 27 EXISTE, imprimé « Articles 27.- » (sic, PLURIEL) au Journal
#    officiel (vérifié sur le scan, p. 12) — le sommaire et l'index clients le
#    croient absent (leur note [²]) : tête reconnue via la forme plurielle
#    (anchors.ts), corps VERBATIM, note rectificative en crossRefs ;
#  - le Moniteur porte « CHAPITRE PREMIER — DISPOSITIONS GÉNÉRALES » là où la
#    lecture systématique établit le TITRE PREMIER (note [¹] du sommaire client) :
#    corps VERBATIM, niveau 1 dans la TdM, note en crossRefs.
#
# Règle d'extraction : INCLURE PAR DÉFAUT — seuls des écarts EXPLICITEMENT listés
# (notes du transcripteur) sont retirés, et des sentinelles piochées à la main dans
# les quatre coins du texte sont exigées dans le corps final (leçon Décret sûretés).
import html
import json
import os
import re
import unicodedata
import zipfile

DL = os.path.expanduser("~/Downloads")
F_P1 = f"{DL}/Décret_activités_minières_Moniteur_Spécial_16_30-03-2026.docx"
F_P2 = f"{DL}/Decret_Minier_Moniteur_30_mars_2026.docx"
F_SOM = f"{DL}/Decret_Minier_2026_Sommaire.docx"
F_IDX = f"{DL}/Decret_Minier_2026_Index_alphabetique.docx"
OUT = os.path.dirname(os.path.abspath(__file__))


def para_text(fragment: str) -> str:
    """Texte d'un <w:p>/<w:tc> : retire w:pPr AVANT de lire les w:t (un <w:tabs>
    dans les propriétés avalerait le paragraphe — piège Décret sûretés)."""
    f = re.sub(r"<w:pPr>.*?</w:pPr>", "", fragment, flags=re.S)
    f = re.sub(r"<w:tab\b[^>]*/?>", " ", f)
    f = re.sub(r"<w:br\s*/?>", " ", f)
    t = html.unescape("".join(re.findall(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", f, re.S)))
    return re.sub(r"\s+", " ", t).strip()


def blocks_of(path: str) -> list[str]:
    """Paragraphes ET tableaux dans l'ordre du document. Un tableau est émis
    ligne-par-ligne, cellules non vides jointes par « — » (le lecteur annoté ne
    consomme pas richBlocksJson — rendu texte fidèle, cellule VERBATIM)."""
    xml = zipfile.ZipFile(path).read("word/document.xml").decode("utf-8", "replace")
    body = re.search(r"<w:body>(.*)</w:body>", xml, re.S).group(1)
    out: list[str] = []
    for m in re.finditer(r"<w:tbl>.*?</w:tbl>|<w:p\b[^>]*(?:/>|>.*?</w:p>)", body, re.S):
        frag = m.group(0)
        if frag.startswith("<w:tbl>"):
            for tr in re.findall(r"<w:tr\b.*?</w:tr>", frag, re.S):
                cells = []
                for tc in re.findall(r"<w:tc\b.*?</w:tc>", tr, re.S):
                    # une cellule peut contenir PLUSIEURS paragraphes (« Concentré des
                    # métaux de base… ; » + « Concentré des métaux Mineurs… ») : les
                    # joindre par une espace, sinon ils se collent (constat d'audit).
                    paras = [para_text(p) for p in re.findall(r"<w:p\b[^>]*(?:/>|>.*?</w:p>)", tc, re.S)]
                    cells.append(" ".join(p for p in paras if p))
                cells = [c for c in cells if c]
                if cells:
                    out.append(" — ".join(cells))
        else:
            t = para_text(frag)
            if t:
                out.append(t)
    return out


def norm_label(s: str) -> str:
    """Comparaison tolérante d'intitulés (apostrophes, guillemets, espaces)."""
    s = s.replace("’", "'").replace("«", '"').replace("»", '"')
    return re.sub(r"\s+", " ", s).strip().upper()


# ── 1. Lecture des deux moitiés du corps ─────────────────────────────────────────
p1 = blocks_of(F_P1)
assert p1[-1].startswith("[Fin de l"), f"P1 : note finale attendue, trouvé : {p1[-1][:60]}"
p1 = p1[:-1]  # note du transcripteur — pas du texte officiel
assert p1[-1].startswith("Article 142.-"), f"P1 : doit finir à l'art. 142, trouvé : {p1[-1][:60]}"
assert p1[0] == "JOURNAL OFFICIEL DE LA RÉPUBLIQUE D’HAÏTI", p1[0]

p2 = blocks_of(F_P2)
assert p2[6].startswith("AVERTISSEMENT ÉDITORIAL"), p2[6][:60]
assert p2[5].startswith("Pages 33 à 62"), p2[5][:60]
p2 = p2[7:]  # 6 lignes de couverture + avertissement du transcripteur — écartées
assert p2[0] == "CHAPITRE VII" and p2[1] == "RETRAIT DES TITRES MINIERS", p2[:2]

rows = p1 + p2
# « Article 1ᵉʳ » (exposant Unicode du transcripteur) → « Article 1er » : LEAD_ART
# et articleAnchorFromHeading ne connaissent que la forme « er ».
rows = [re.sub(r"^Article 1ᵉʳ\.-", "Article 1er.-", r) for r in rows]
# Quatre têtes transcrites « Article N. » SANS le tiret : le Journal officiel imprime
# uniformément « Article N.- » (style vérifié sur les scans, pp. 8-13 et 47-48) —
# on rétablit la forme du Moniteur pour ces quatre omissions du transcripteur.
DASHLESS = ("161", "193", "211", "226")
fixed = 0
for k, r in enumerate(rows):
    m = re.match(r"^Article (\d{1,3})\. (?=\S)", r)
    if m:
        assert m.group(1) in DASHLESS, f"tête sans tiret imprévue : {r[:70]}"
        rows[k] = f"Article {m.group(1)}.- " + r[len(m.group(0)):]
        fixed += 1
assert fixed == len(DASHLESS), f"{fixed} têtes « N. » corrigées, {len(DASHLESS)} attendues"

# ── 2. Jointure des en-têtes TITRE/CHAPITRE (paires et triplets « — ») ───────────
HEAD = re.compile(r"^(TITRE|CHAPITRE)\s+(PREMIER|[IVX]+)$")


def is_title_cont(t: str) -> bool:
    """Ligne de suite d'un intitulé : tout en capitales, pas un en-tête ni un article."""
    if HEAD.match(t) or t.startswith("Article"):
        return False
    return not re.search(r"[a-zà-öø-ÿ]", t)


body_lines: list[str] = []
toc: list[dict] = []
i = 0
sec = 0
while i < len(rows):
    t = rows[i]
    m = HEAD.match(t)
    if m:
        parts = []
        j = i + 1
        while j < len(rows) and is_title_cont(rows[j]):
            parts.append(rows[j])
            j += 1
        assert parts, f"en-tête « {t} » sans intitulé (¶{i})"
        label = f"{t} — {' '.join(parts)}"
        sec += 1
        # niveau 1 = TITRE ; cas [¹] : le tout premier en-tête du Moniteur porte
        # « CHAPITRE PREMIER — DISPOSITIONS GÉNÉRALES » au niveau des Titres.
        level = 1 if m.group(1) == "TITRE" or sec == 1 else 2
        if sec == 1:
            assert label == "CHAPITRE PREMIER — DISPOSITIONS GÉNÉRALES", label
        toc.append({"level": level, "label": label, "anchor": f"sec-{sec}", "kind": "code"})
        body_lines.append(label)
        i = j
        continue
    body_lines.append(t)
    i += 1

# ── 3. Articles : ancres, labels, ordre ─────────────────────────────────────────
# « Articles? » : l'article 27 est imprimé « Articles 27.- » (sic) au J.O. — seule
# tête plurielle admise, vérifiée ci-dessous.
ART = re.compile(r"^(Articles?)\s+(1er|\d{1,3}(?:\.\d{1,2})?)\.-(?:\s|$)")
anchors: list[str] = []
labels: dict[str, str] = {}
order: list[tuple[int, int]] = []
plurals: list[str] = []
for ln in body_lines:
    if not ln.startswith("Article"):
        continue
    m = ART.match(ln)
    assert m, f"ligne « Article » non reconnue comme tête : {ln[:80]}"
    num = m.group(2)
    if m.group(1) == "Articles":
        plurals.append(num)
    base = 1 if num == "1er" else int(num.split(".")[0])
    sub = int(num.split(".")[1]) if "." in num else 0
    anchor = "art-" + ("1" if num == "1er" else num.replace(".", "-"))
    assert anchor not in labels, f"tête d'article en double : {ln[:60]}"
    anchors.append(anchor)
    labels[anchor] = f"Article {num}"
    order.append((base, sub))

assert plurals == ["27"], f"têtes plurielles « Articles N.- » inattendues : {plurals}"
assert order == sorted(order), "numérotation non croissante"
bases = sorted({b for b, _ in order})
assert bases == list(range(1, 307)), (
    f"articles de base ≠ 1..306 : manquants {sorted(set(range(1,307)) - set(bases))}, "
    f"en trop {sorted(set(bases) - set(range(1,307)))}"
)
decimals = [a for (b, s), a in zip(order, anchors) if s]
print(f"✓ corps : {len(body_lines)} lignes · {len(anchors)} articles (1→306 complet, art. 27 « Articles 27.- » sic) · {len(decimals)} décimaux")

# ── 4. Validation contre le Sommaire client (autorité de structure) ──────────────
som = blocks_of(F_SOM)
SOM = re.compile(
    r"^(TITRE|CHAPITRE)\s+(PREMIER|[IVX]+)\s+—\s+(.+?)"
    r"(?:\s+\[[¹²]\])?(?:\s+\(Art\.\s+([^)]+)\))?(?:\s+\[[¹²]\])?\s+\d{1,2}$"
)
som_entries = []
for t in som:
    if t.startswith("NOTES DE RELEVÉ") or t.startswith("SIGNATURES"):
        break
    m = SOM.match(t)
    if m:
        rng = None
        if m.group(4):
            parts = [p.strip().replace("1ᵉʳ", "1") for p in m.group(4).split(" à ")]
            rng = (parts[0], parts[-1])
        som_entries.append({"kind": m.group(1), "num": m.group(2), "title": m.group(3), "range": rng})
assert len(som_entries) == len(toc), f"sommaire client {len(som_entries)} entrées ≠ corps {len(toc)}"

# appariement libellés : cas [¹] (TITRE PREMIER ↔ CHAPITRE PREMIER, même intitulé)
for k, (s, e) in enumerate(zip(som_entries, toc)):
    body_kind, body_title = e["label"].split(" — ", 1)
    if k == 0:
        assert s["kind"] == "TITRE" and norm_label(s["title"]) == norm_label(body_title), (s, e)
        continue
    assert norm_label(f"{s['kind']} {s['num']}") == norm_label(body_kind), (s, e)
    assert norm_label(s["title"]) == norm_label(body_title), f"intitulé ≠ sommaire :\n  som : {s['title']}\n  corps: {body_title}"

# plages d'articles : 1ᵉʳ article après chaque en-tête = borne basse ; dernier avant
# l'en-tête suivant (chapitres) = borne haute. Les TITRES à chapitres n'ont pas de
# plage propre dans le sommaire client (rng=None) — validés via leurs chapitres.
pos_of = {}
seq = []  # (type, key) dans l'ordre du corps : ('sec', k) | ('art', num-affiché)
for ln in body_lines:
    mm = ART.match(ln)
    if mm:
        seq.append(("art", "1" if mm.group(2) == "1er" else mm.group(2)))
    elif toc and any(ln == e["label"] for e in toc):
        seq.append(("sec", ln))
for k, e in enumerate(toc):
    s = som_entries[k]
    if not s["range"]:
        continue
    idx = next(i for i, (ty, key) in enumerate(seq) if ty == "sec" and key == e["label"])
    after = [key for ty, key in seq[idx + 1:] if ty == "art"]
    nxt = next((i for i, (ty, _) in enumerate(seq[idx + 1:]) if ty == "sec"), None)
    within = [key for ty, key in (seq[idx + 1: idx + 1 + nxt] if nxt is not None else seq[idx + 1:]) if ty == "art"]
    lo, hi = s["range"]
    assert after and after[0] == lo, f"{e['label']} : 1ᵉʳ article {after[0] if after else '∅'} ≠ sommaire {lo}"
    if s["kind"] == "CHAPITRE" or s["range"][0] == s["range"][1] or e["label"].startswith("TITRE"):
        # borne haute vérifiable seulement si l'en-tête suivant clôt la plage
        if within:
            assert within[-1] == hi, f"{e['label']} : dernier article {within[-1]} ≠ sommaire {hi}"
print(f"✓ sommaire client : {len(som_entries)} en-têtes appariés (libellés + plages d'articles)")

# ── 5. navToc : groupes = TITRES (affichage sommaire client), enfants = chapitres ──
navToc = []
cur = None
for k, e in enumerate(toc):
    s = som_entries[k]
    if e["level"] == 1:
        disp = f"TITRE {s['num']} — {s['title']}" if k == 0 else e["label"]
        cur = {"label": disp, "anchor": e["anchor"], "children": []}
        navToc.append(cur)
    else:
        cur["children"].append({"label": e["label"], "anchor": e["anchor"]})
for g in navToc:
    if not g["children"]:
        g["children"] = [{"label": g["label"].split(" — ", 1)[1], "anchor": g["anchor"]}]

# ── 6. Index alphabétique client (autorité de l'index) ───────────────────────────
idx_rows = blocks_of(F_IDX)
assert idx_rows[3] == "INDEX ALPHABÉTIQUE", idx_rows[3]
idx_rows = idx_rows[8:]  # en-tête + 3 notes liminaires (reprises en livraison)

REF_TOK = re.compile(r"^(\d{1,3}(?:\.\d{1,2})?)(?:\s+\((\d{1,3}°)\))?$")
RANGE_TOK = re.compile(r"^(\d{1,3}(?:\.\d{1,2})?)\s+à\s+(\d{1,3}(?:\.\d{1,2})?)$")
art_seq = [key for ty, key in seq if ty == "art"]  # numéros affichés, ordre du décret


def expand_range(lo: str, hi: str) -> list[str]:
    """Plage « 25 à 29 » → articles RÉELS du décret entre les deux bornes (l'art. 27
    absent est sauté naturellement ; « 163 à 165.2 » inclut 165.1)."""
    a, b = art_seq.index(lo), art_seq.index(hi)
    assert a < b, (lo, hi)
    return art_seq[a: b + 1]


indexEntries = []
letters = []
subject = None
n_sub = 0
qualifs = 0
for t in idx_rows:
    if re.fullmatch(r"[A-Z]", t):
        letters.append(t)
        continue
    if t.startswith("–") or t.startswith("-"):
        assert subject, f"sous-entrée sans sujet : {t[:60]}"
        line = t.lstrip("–- ").strip()
        toks = [x.strip() for x in line.split(",")]
        refs: list[str] = []
        quals: list[str] = []
        while toks:
            tok = toks[-1]
            mr = RANGE_TOK.fullmatch(tok)
            mt = REF_TOK.fullmatch(tok)
            if mr:
                refs = expand_range(mr.group(1), mr.group(2)) + refs
            elif mt:
                refs.insert(0, mt.group(1))
                if mt.group(2):
                    quals.insert(0, mt.group(2))
            else:
                break
            toks.pop()
        desc = ", ".join(toks).strip()
        assert refs, f"sous-entrée sans renvoi : {t[:80]}"
        assert desc, f"sous-entrée sans description : {t[:80]}"
        if quals:
            desc = f"{desc} ({', '.join(quals)})"
            qualifs += 1
        ct = []
        for r in refs:
            ref = r.replace(".", "-")
            assert f"art-{ref}" in labels, f"index : renvoi mort {r} (« {subject} — {desc} »)"
            if ref not in ct:
                ct.append(ref)
        indexEntries.append({"subject": f"{subject} — {desc}", "ctRefs": ct})
        n_sub += 1
        continue
    subject = t

assert letters == sorted(letters) and len(letters) == len(set(letters)), letters
covered = {r for e in indexEntries for r in e["ctRefs"]}
uncovered = [a[4:] for a in anchors if a[4:] not in covered]
print(
    f"✓ index client : {n_sub} entrées ({len(letters)} lettres, {qualifs} renvois qualifiés « (n°) »), "
    f"0 renvoi mort · couverture {len(covered)}/{len(anchors)} articles"
    + (f" · non couverts : {', '.join(uncovered[:12])}{'…' if len(uncovered) > 12 else ''}" if uncovered else "")
)

# ── 7. Notes éditoriales (sommaire client) reprises en renvois de section ────────
chap4 = next(e for e in toc if e["label"] == "CHAPITRE IV — AUTORISATION DE PROSPECTION")
crossRefs = [
    {
        "anchor": "sec-1",
        "articles": [],
        "note": "Le Journal officiel porte ici « CHAPITRE PREMIER — DISPOSITIONS GÉNÉRALES » au niveau "
        "hiérarchique des Titres ; la lecture systématique du Décret (le Titre suivant étant le "
        "« TITRE II ») établit qu'il s'agit du TITRE PREMIER. Le texte du Moniteur est reproduit tel quel.",
    },
    {
        "anchor": chap4["anchor"],
        "articles": [],
        "note": "Le Journal officiel imprime « Articles 27.- » (sic, au pluriel) pour l'article 27, "
        "reproduit tel quel ci-dessous — l'article existe bien, entre les articles 26 et 28.",
    },
]

# ── 8. Sentinelles (piochées à la main aux quatre coins du texte) ────────────────
body = "\n".join(body_lines) + "\n"
SENTINELS = [
    "181ᵉ Année – Spécial N° 16 — PORT-AU-PRINCE — Lundi 30 Mars 2026",  # masthead
    "Et après délibération ;",  # fin des visas
    "DÉCRÈTE",
    "1. Autorité Minière Nationale (AMN) : Organisme étatique responsable du secteur minier ;",  # art. 6
    "Articles 27.- L’Autorisation de Prospection peut être renouvelée",  # coquille officielle (pluriel)
    "Article 39.1.- Les travaux doivent commencer",  # 1ᵉʳ article décimal
    "Article 142.- La renonciation prend effet",  # charnière P1→P2
    "Article 143.- Un Titre Minier est nul et non avenu",
    "Fixing de l'après-midi à Londres",  # tableau des redevances (art. 232.2)
    "zinc ; Concentré des métaux Mineurs",  # cellule multi-paragraphes jointe par espace
    "LME = London Metal Exchange",  # note sous le tableau
    "Article 305.- Le présent Décret entre en vigueur six (6) mois après la date de sa publication.",
    "Donné au Palais National, à Port-au-Prince, le 27 mars 2026, An 223ᵉ de l'Indépendance.",
    "Le Ministre de l'Éducation Nationale et de la Formation Professionnelle Vijonet DEMERO",  # dernière ligne
]
for s in SENTINELS:
    assert s in body, f"SENTINELLE ABSENTE du corps : {s[:70]}"
for bad in ("AVERTISSEMENT ÉDITORIAL", "[Fin de l", "Pages 33 à 62"):
    assert bad not in body, f"note de transcription restée dans le corps : {bad}"
print(f"✓ {len(SENTINELS)} sentinelles présentes · notes de transcription exclues")

# ── 9. Émission ──────────────────────────────────────────────────────────────────
ann = {
    "title": "Décret régissant les activités minières",
    "annotationAuthor": "",
    "navToc": navToc,
    "toc": toc,
    "connexes": [],
    "jurisprudence": {},
    "indexEntries": indexEntries,
    "crossRefs": crossRefs,
    "labels": labels,
}
open(f"{OUT}/bodyOriginal.txt", "w").write(body)
json.dump(ann, open(f"{OUT}/annotations.json", "w"), ensure_ascii=False, indent=1)
print(
    f"✓ écrit : bodyOriginal.txt ({len(body_lines)} lignes) · annotations.json "
    f"(toc {len(toc)}, navToc {len(navToc)} titres, index {len(indexEntries)}, labels {len(labels)})"
)
