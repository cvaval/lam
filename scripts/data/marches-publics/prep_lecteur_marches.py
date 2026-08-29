#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Préparation « lecteur annoté » du corpus MARCHÉS PUBLICS (tâche 2, § 8.4 de la feuille
de route). Ne touche PAS la base : produit, par texte, un `prep-NN-<slug>.json` (toc,
labels, navToc, comptes, gardes, notes de transcription retirées) et le corps
correspondant `prep-NN-<slug>-corps.txt`.

Sources : les pièces canoniques `piece-*.txt` du dossier (extractions RETENUES du § 4,
empreintées au `manifeste-empreintes.json`) — tabulations du J.O. préservées. Aucune des
pièces écartées (`ecartees/`) n'est lue.

Deux mécanismes portent tout le reste :
  · un en-tête entre au `toc` (ancre sec-N) et n'est donc JAMAIS pris pour un article —
    indispensable ici : « Section 1 - … », « Section 3. … », « Section 1re.- … » sont
    reconnus comme têtes d'article par `articleAnchorFromHeading` ;
  · l'annexe sanctionnée reçoit `kind: "connexe"` : `segmentAnnotated` cesse alors
    d'émettre des ancres (mécanisme `inAnnexe`), ce qui supprime les id dupliqués que
    produiraient les articles 1 à N des contrats-types et de la Charte annexée.
Le corps est VERBATIM, à trois opérations près, toutes tracées dans le JSON :
  1. `segments`  — découpe § 8.3 : un document = un seul acte (+ son annexe sanctionnée) ;
  2. `retraits`  — lignes de NOTE DE TRANSCRIPTION de l'éditeur (§ 11.11 : « toute
     mention d'éditeur va en note, jamais au dispositif ») ;
  3. `jointures` — un en-tête imprimé sur deux lignes ou plus (« CHAPITRE I » puis
     « DISPOSITIONS GÉNÉRALES ») est joint en une ligne « CHAPITRE I — DISPOSITIONS
     GÉNÉRALES » : c'est la seule façon pour `segmentAnnotated` d'apparier le libellé
     du `toc` à la ligne du corps (patron décret minier, parse_dm.py).
Tout le reste — sics compris (« Articles 30.- », « 227.1 », graphies décimales à
point) — est intact : AUCUNE normalisation.

Rien n'est écrit en base ici ; ce script ne fait que mesurer et préparer.
"""
import hashlib
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = HERE  # pièces canoniques `piece-*.txt` du manifeste d'empreintes (tâche 1)

# ── Ports EXACTS des motifs TypeScript (src/lib/doc/anchors.ts) ────────────────────
RE_ART = re.compile(
    r"^(?:art(?:icle)?\.?|section)\s+"
    r"(premier|\d{1,4}(?:\s*(?:er|ère))?(?:\s*(?:bis|ter|quater))?(?:[.\-]\d+)*)",
    re.I,
)
RE_ARTS_PLURIEL = re.compile(r"^articles\s+(\d{1,4}(?:[.\-]\d+)*)\.-", re.I)


def anchor_from_designation(desig: str) -> str:
    s = str(desig).lower().strip()
    s = re.sub(r"^premier\b", "1", s)
    s = re.sub(r"(\d)\s*(?:er|ère)(?=[\s.\-]|$)", r"\1", s)
    s = re.sub(r"(\d)\s*(bis|ter|quater)", r"\1-\2", s)
    s = re.sub(r"[.\s]+", "-", s)
    s = re.sub(r"-+", "-", s)
    s = re.sub(r"^-|-$", "", s)
    return "art-" + s


def article_anchor_from_heading(line: str):
    m = RE_ART.match(line)
    if m:
        return anchor_from_designation(m.group(1)), m.group(1)
    p = RE_ARTS_PLURIEL.match(line)
    if p:
        return anchor_from_designation(p.group(1)), p.group(1)
    return None, None


def norm_line(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def md5(path: str) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()


# ── Prédicats de continuation d'en-tête ───────────────────────────────────────────
def cont_caps(t: str) -> bool:
    """Ligne de suite d'un en-tête : capitales, ni article ni nouvel en-tête."""
    if not t:
        return False
    if re.match(r"^(TITRE|CHAPITRE|SECTION|SOUS-SECTION|Section|Sous-section|Article|Articles|ANNEXE)\b", t):
        return False
    return not re.search(r"[a-zà-öø-ÿ]", t)


def cont_libre(t: str) -> bool:
    """Suite d'en-tête pouvant porter des minuscules (« Composition », « Attributions »)."""
    if not t:
        return False
    if re.match(r"^(TITRE|CHAPITRE|SECTION|SOUS-SECTION|Section|Sous-section|Article|Articles|ANNEXE)\b", t):
        return False
    return len(t) < 200


CONT = {"caps": cont_caps, "libre": cont_libre}


# ── Spécifications, texte par texte ───────────────────────────────────────────────
# `segments`   : plages de lignes SOURCE (1-based, inclusives) reprises au corps.
# `retraits`   : lignes SOURCE retirées (note d'éditeur) — motif obligatoire.
# `bare`       : en-têtes imprimés sur plusieurs lignes → jointure « — ».
# `inline`     : en-têtes tenant sur une ligne.
# `covers`     : {ligne_source: nb_lignes} — page de garde d'une pièce annexée.
# `connexe`    : ligne SOURCE à partir de laquelle le `toc` bascule en kind « connexe »
#                (l'annexe sanctionnée : ses articles ne portent pas d'ancre, ce qui
#                supprime tout id dupliqué — mécanisme `inAnnexe` de segmentAnnotated).
SPECS = [
  {
    "id": "00", "slug": "loi-mere-2009",
    "titre": "Loi n° CL 06 2009-009 fixant les règles générales relatives aux Marchés Publics et aux Conventions de Concession d'Ouvrage de Service Public (« Loi du 10 juin 2009 »)",
    "src": "piece-00-loi-2009-corps.txt",
    "segments": [(1, 491)],
    "retraits": [],
    "bare": [], "cont": "caps",
    "inline": [(r"^TITRE [IVXL]+ —", 1), (r"^CHAPITRE [IVXL]+ —", 2), (r"^Section \d+ —", 3)],
    "covers": {}, "connexe": None,
    "controle_tdm": "txt-00-loi-2009-tdm.txt",
  },
  {
    "id": "01", "slug": "decret-2004",
    "titre": "Décret fixant la réglementation des marchés publics de services, de fournitures et de travaux",
    "src": "piece-01-decret-2004-12-03-reglementation.txt",
    "segments": [(1, 431)],
    "retraits": [],
    "bare": [(r"^CHAPITRE [IVXL]+$", 1)], "cont": "caps",
    "inline": [(r"^SECTION [IVXL]+\.-", 2)],
    "caps_extra": {140: 3, 151: 3, 163: 3, 174: 3, 220: 3, 241: 3, 260: 3, 281: 3, 294: 3, 299: 3, 314: 3, 348: 3, 350: 3},
    "covers": {}, "connexe": None,
  },
  {
    "id": "02", "slug": "arr-modalites-2009",
    "titre": "Arrêté précisant les modalités d'application de la Loi fixant les règles générales relatives aux Marchés Publics et aux Conventions de Concession d'Ouvrage de Service Public",
    "src": "piece-02-arrete-2009-10-26-modalites.txt",
    "segments": [(1, 891)],
    "retraits": [],
    "bare": [(r"^TITRE [IVXL]+$", 1), (r"^CHAPITRE [IVXL]+$", 2)], "cont": "caps",
    "inline": [(r"^Section \d+(?:\.\d+)? ?[-:]", 3), (r"^Sous-section \d+(?:\.\d+)? ?[-:]", 4)],
    "covers": {}, "connexe": None,
  },
  {
    "id": "03", "slug": "arr-manuel-2009",
    "titre": "Arrêté sanctionnant le Manuel de Procédures pour la passation des Marchés Publics et des Conventions de Concession d'Ouvrage de Service Public",
    "src": "piece-03-arrete-2009-10-26-manuel-procedures.txt",
    "segments": [(1, 991)],
    "retraits": [],
    "bare": [(r"^CHAPITRE [IVXL]+$", 2)], "cont": "caps",
    "inline": [(r"^Section \d+ ?[-:]", 3), (r"^Sous-section \d+ ?[-:]", 4)],
    "caps_extra": {93: 2}, "covers": {87: 4}, "connexe": 87,
  },
  {
    "id": "04", "slug": "arr-org-cnmp-2009",
    "titre": "Arrêté déterminant les modalités d'organisation et de fonctionnement de la Commission Nationale des Marchés Publics (CNMP)",
    "src": "piece-04-arrete-2009-10-26-organisation-cnmp.txt",
    "segments": [(1, 364)],
    "retraits": [(16, "note de l'éditeur : « Le présent document reproduit le troisième Arrêté du Numéro Spécial No. 10. »"),
                 (361, "note de l'éditeur sur les signatures « pr. » (mention N.B. absente du J.O.)")],
    "bare": [(r"^CHAPITRE [IVXL]+$", 1)], "cont": "caps",
    "inline": [(r"^Section \d+ ?[-.]", 2)],
    "covers": {}, "connexe": None,
  },
  {
    "id": "05", "slug": "arr-dao-travaux-2011",
    "titre": "Arrêté sanctionnant pour sortir son plein et entier effet le Dossier d'Appel d'Offres standard pour la réalisation de travaux (Tome I)",
    "src": "piece-05-arrete-2011-05-10-dao-travaux-tome1.txt",
    "segments": [(1, 99)], "retraits": [],
    "bare": [], "cont": "caps", "inline": [], "covers": {}, "connexe": None,
  },
  {
    "id": "06", "slug": "arr-dtp-consultants-2011",
    "titre": "Arrêté sanctionnant pour sortir son plein et entier effet le Dossier de demandes types de propositions pour services de consultants et modèles de contrats (Tome III)",
    "src": "piece-06-arrete-2011-05-10-consultants-tome3.txt",
    "segments": [(1, 101)],
    "retraits": [(103, "note de transcription de l'éditeur (corrections d'OCR, anomalies de l'original)")],
    "bare": [], "cont": "caps", "inline": [], "covers": {}, "connexe": None,
  },
  {
    "id": "07", "slug": "arr-ccag-2011",
    "titre": "Arrêté sanctionnant pour sortir son plein et entier effet le Cahier des Clauses Administratives Générales (CCAG) applicables aux marchés publics de fournitures, de services et d'équipements informatiques et de bureautique",
    "src": "piece-07-arrete-2011-05-10-ccag.txt",
    "segments": [(1, 19), (28, 93)],
    "retraits": [(21, "NOTE DE TRANSCRIPTION (bloc de l'éditeur)"),
                 (22, "NOTE DE TRANSCRIPTION"),
                 (23, "NOTE DE TRANSCRIPTION"),
                 (24, "NOTE DE TRANSCRIPTION"),
                 (25, "NOTE DE TRANSCRIPTION"),
                 (27, "ligne vide du bloc de note")],
    "bare": [], "cont": "caps", "inline": [], "covers": {}, "connexe": None,
    "reserve": "fragment : page 2 du Moniteur absente du scan source ; la ligne 26 « [Début de l'extrait…] » est un marqueur d'éditeur CONSERVÉ au corps (il borne le fragment) — à trancher par Me Vaval.",
  },
  {
    "id": "08", "slug": "arr-seuils-2012",
    "titre": "Arrêté fixant les seuils de passation des marchés publics et les seuils d'intervention de la Commission Nationale des Marchés Publics",
    "src": "piece-08-arrete-2012-05-25-seuils.txt",
    "segments": [(1, 96)], "retraits": [],
    "bare": [], "cont": "caps", "inline": [], "covers": {}, "connexe": None,
  },
  {
    "id": "09", "slug": "arr-charte-ethique-2012",
    "titre": "Arrêté sanctionnant pour sortir son plein et entier effet la Charte d'Éthique applicable aux acteurs des marchés publics et des conventions de concession d'ouvrage de service public",
    "src": "piece-09-arrete-2012-12-21-charte-ethique.txt",
    "segments": [(1, 5), (72, 305)],
    "retraits": [],
    "bare": [(r"^CHAPITRE (?:1er|[IVXL]+)$", 2)], "cont": "caps",
    "inline": [(r"^Section \d+(?:re)? ?\.-", 3), (r"^Sous-section \d+(?:re)? ?\.-", 4)],
    "caps_extra": {164: 2}, "covers": {160: 3, 289: 1}, "connexe": 160,
    "decoupe": "hors-corpus retiré : SOMMAIRE du fascicule (l. 6-13, il nomme l'arrêté Delmas et deux Résolutions non versés) et l'ARRÊTÉ d'utilité publique de Delmas en entier (l. 14-70).",
  },
  {
    "id": "10", "slug": "arr-demande-prix-fournitures-2017",
    "titre": "Arrêté sanctionnant pour sortir leur plein et entier effet le Manuel de procédures de demande de prix pour acquisition de fournitures et le Dossier de demande de prix pour acquisition de fournitures",
    "src": "piece-10-arrete-2017-08-30-demande-prix-fournitures.txt",
    "segments": [(1, 1400)],
    "retraits": [(163, "[Note de transcription] de l'éditeur"),
                 (257, "[Note de transcription] de l'éditeur"),
                 (322, "[Note de transcription] de l'éditeur"),
                 (1276, "[Note de transcription] de l'éditeur")],
    "bare": [], "cont": "caps", "inline": [],
    "covers": {88: 8, 887: 4}, "connexe": 88,
  },
  {
    "id": "11", "slug": "arr-procedures-celeres-2017",
    "titre": "Arrêté sanctionnant pour sortir leur plein et entier effet le Manuel de procédures célères pour la passation des marchés publics en état d'urgence déclaré, le Document-type de préqualification d'entreprises et le Modèle de marché pour intervention en situation d'état d'urgence déclaré",
    "src": "piece-11-arrete-2017-08-30-procedures-celeres.txt",
    "segments": [(1, 1366)], "retraits": [],
    "bare": [], "cont": "caps", "inline": [],
    "covers": {105: 5, 192: 5, 814: 5}, "connexe": 105,
  },
  {
    "id": "12", "slug": "arr-cotations-travaux-2017",
    "titre": "Arrêté sanctionnant pour sortir leur plein et entier effet le Manuel de procédures de demande de cotations pour les contrats de travaux et le Dossier de demande de cotations pour l'exécution de contrats de travaux",
    "src": "piece-12-arrete-2017-08-30-cotations-travaux.txt",
    "segments": [(1, 1680)],
    "retraits": [(395, "[Note de transcription] de l'éditeur (diagramme de Gantt restitué en tableau)")],
    "bare": [], "cont": "caps", "inline": [],
    "covers": None, "connexe": None,  # renseignés par mesure (voir COVERS_MESURES)
  },
  {
    "id": "13", "slug": "arr-alleges-travaux-2017",
    "titre": "Arrêté sanctionnant pour sortir leur plein et entier effet le Manuel de procédures allégées pour la passation des marchés de travaux et le Dossier d'Appel d'Offres allégé pour la passation des marchés de travaux",
    "src": "piece-13-arrete-2017-08-30-allege-travaux.txt",
    "segments": [(1, 2700)],
    "retraits": [(506, "Nota (transcription) de l'éditeur"),
                 (510, "Nota (transcription) de l'éditeur"),
                 (760, "Nota (transcription) de l'éditeur"),
                 (1217, "Nota (transcription) de l'éditeur"),
                 (1295, "Nota (transcription) de l'éditeur")],
    "bare": [], "cont": "caps", "inline": [],
    "covers": None, "connexe": None,
  },
  {
    "id": "14", "slug": "arr-alleges-fournitures-2017",
    "titre": "Arrêté sanctionnant pour sortir leur plein et entier effet le Manuel de procédures allégées pour la passation des marchés de fournitures et le Dossier d'Appel d'Offres allégé pour la passation des marchés de fournitures",
    "src": "piece-14-arrete-2017-08-30-allege-fournitures.txt",
    "segments": [(1, 1973)],
    "retraits": [(536, "[Note de transcription] de l'éditeur (diagramme de Gantt)")],
    "bare": [], "cont": "caps", "inline": [],
    "covers": None, "connexe": None,
  },
  {
    "id": "15", "slug": "arr-alleges-consultants-2017",
    "titre": "Arrêté sanctionnant pour sortir leur plein et entier effet le Manuel de procédures allégées pour la sélection de consultants et le Dossier allégé de demande de propositions pour services de consultants",
    "src": "piece-15-arrete-2017-08-30-allege-consultants.txt",
    "segments": [(1, 1561)], "retraits": [],
    "bare": [], "cont": "caps", "inline": [],
    "covers": None, "connexe": None,
  },
  {
    "id": "16", "slug": "arr-defense-2019",
    "titre": "Arrêté portant révision de l'arrêté du 30 août 2017 fixant les règles de procédures de passation de certains marchés de travaux, de fournitures et de services intéressant la défense ou la sécurité nationale",
    "src": "piece-16-arrete-2019-01-09-defense.txt",
    "segments": [(1, 176)], "retraits": [],
    "bare": [], "cont": "caps", "inline": [], "covers": {}, "connexe": None,
  },
  {
    "id": "17", "slug": "arr-nomination-cnmp-2019",
    "titre": "Arrêté nommant les membres de la Commission Nationale des Marchés Publics (CNMP)",
    "src": "piece-17-arrete-2019-12-26-nomination-cnmp.txt",
    "segments": [(1, 9), (28, 60)], "retraits": [],
    "bare": [], "cont": "caps", "inline": [], "covers": {}, "connexe": None,
    "decoupe": "hors-corpus retiré : SOMMAIRE du fascicule (l. 10-15 — il nomme les « Extraits du Registre des Marques », non transcrits), l'AVIS commercial des Presses Nationales (l. 16-22) et les repères de page (l. 23-27).",
  },
  {
    "id": "18", "slug": "arr-defense-2020",
    "titre": "Arrêté soumettant les marchés publics de défense ou de sécurité nationale au respect des principes de passation des marchés",
    "src": "piece-18-arrete-2020-02-12-defense.txt",
    "segments": [(1, 152)], "retraits": [],
    "bare": [], "cont": "caps", "inline": [], "covers": {}, "connexe": None,
  },
  {
    "id": "19", "slug": "arr-modif-227-2020",
    "titre": "Arrêté modifiant les articles 227 et 227.1 de l'Arrêté du 26 octobre 2009 précisant les modalités d'application de la Loi du 10 juin 2009",
    "src": "piece-19-20-fascicule-sp8-2021-02-04.txt",
    "segments": [(1, 4), (18, 95)], "retraits": [],
    "bare": [], "cont": "caps", "inline": [], "covers": {}, "connexe": None,
    "decoupe": "fascicule à 10 actes : seul le 1er arrêté marchés publics est versé ici. Retirés : SOMMAIRE (l. 5-16, il nomme les nominations BNC/BNDA/CNAL, les commissions municipales et la circulaire 009 CIN) ; arrêté CMMP/CSMP (l. 96-209, versé au document n° 20) ; nominations et circulaire 009 (l. 211-484).",
  },
  {
    "id": "20", "slug": "arr-composition-cmmp-2020",
    "titre": "Arrêté fixant la composition des Commissions Ministérielles des Marchés Publics (CMMP) et des Commissions Spécialisées des Marchés Publics (CSMP)",
    "src": "piece-19-20-fascicule-sp8-2021-02-04.txt",
    "segments": [(1, 4), (98, 211)], "retraits": [],
    "bare": [(r"^CHAPITRE (?:Ier|[IVXL]+)$", 1), (r"^Section \d+(?:re)?$", 2)], "cont": "libre",
    "inline": [], "covers": {}, "connexe": None,
    "decoupe": "même fascicule que le n° 19 : seul le 2e arrêté marchés publics est versé ici (l. 96-209).",
  },
  {
    "id": "21", "slug": "decret-beneficiaires-effectifs-2021",
    "titre": "Décret établissant l'obligation de présenter des informations permettant d'identifier les Bénéficiaires effectifs des Marchés publics et des Concessions",
    "src": "piece-21-22-fascicule-sp52-2021-11-09.txt",
    "segments": [(1, 14), (15, 126)], "retraits": [],
    "bare": [(r"^CHAPITRE [IVXL]+$", 1), (r"^Section [IVXL]+$", 2)], "cont": "libre",
    "inline": [], "covers": {}, "connexe": None,
    "decoupe": "fascicule à 2 actes, tous deux du corpus : le Décret (l. 15-126) ici, l'Arrêté (l. 128-241) au document n° 22. Bloc NOTE DE TRANSCRIPTION du fascicule (l. 252-256) retiré des deux.",
  },
  {
    "id": "22", "slug": "arr-seuils-sous-intervention-2021",
    "titre": "Arrêté fixant les seuils de passation des Marchés publics en dessous des seuils d'intervention de la Commission Nationale des Marchés Publics",
    "src": "piece-21-22-fascicule-sp52-2021-11-09.txt",
    "segments": [(1, 14), (129, 251)], "retraits": [],
    "bare": [], "cont": "caps", "inline": [], "covers": {}, "connexe": None,
    "decoupe": "même fascicule que le n° 21 ; le colophon des Presses Nationales (l. 243-250) est rattaché au dernier acte. NOTE DE TRANSCRIPTION (l. 252-256) retirée.",
  },
  {
    "id": "23", "slug": "arr-seuils-2022",
    "titre": "Arrêté fixant les seuils de passation des marchés publics et les seuils d'intervention de la Commission Nationale des Marchés Publics",
    "src": "piece-23-arrete-2022-06-01-seuils.txt",
    "segments": [(1, 186)], "retraits": [],
    "bare": [], "cont": "caps", "inline": [], "covers": {}, "connexe": None,
  },
  {
    "id": "24", "slug": "circulaire-010-2023",
    "titre": "Circulaire 010 relative aux procédures de passation et d'exécution des marchés publics",
    "src": "piece-24-circulaire-010-2023-12-04.txt",
    "segments": [(1, 44)], "retraits": [],
    "bare": [], "cont": "caps", "inline": [], "covers": {}, "connexe": None,
    "sans_appareil": "0 article, 0 division imprimée : ni toc, ni labels, ni navToc, ni pointAnchors (§ 9.6 et interdit n° 16 — on ne fabrique pas d'appareil que le texte ne porte pas).",
  },
]

# Pages de garde des pièces annexées, MESURÉES ligne à ligne (l. source → nb de lignes
# à joindre). Renseignées ici pour les textes de 2017 dont la page de garde est le seul
# en-tête imprimé non ambigu (les tables des matières internes répètent les intitulés).
COVERS_MESURES = {
    "12": ({93: 5, 566: 5, 807: 4}, 93),
    "13": ({89: 11, 729: 11, 1186: 11}, 89),
    "14": ({108: 6, 690: 6, 1081: 6}, 108),
    "15": ({91: 4, 757: 5}, 91),
}

# ⚠️ MESURE (2017, textes n° 10-15) : on N'A PAS construit de sommaire des divisions
# internes des pièces annexées. Leurs tables des matières internes répètent les
# intitulés avec une ponctuation DIFFÉRENTE de l'en-tête réel (« I.INTRODUCTION » du
# sommaire contre « I. INTRODUCTION » de la division, mesuré au n° 14) : aucune règle
# automatique ne les sépare, et fabriquer la division serait l'interdit n° 16. Le
# sommaire de ces textes se limite donc aux PIÈCES sanctionnées (pages de garde CNMP),
# ce que le § 8.4 prescrit pour les arrêtés-chapeaux. Un sommaire d'annexe rédigé à la
# main reste possible : c'est une décision de curation, pas une mesure.


def charger(spec):
    path = os.path.join(SRC, spec["src"])
    lignes = open(path, encoding="utf-8").read().split("\n")
    retraits = {n for n, _ in spec["retraits"]}
    out = []  # (n_source, texte)
    for a, b in spec["segments"]:
        for n in range(a, min(b, len(lignes)) + 1):
            if n in retraits:
                continue
            out.append((n, lignes[n - 1]))
    return out, lignes


def construire(spec):
    src_lignes, brut = charger(spec)
    covers = spec.get("covers") or {}
    connexe_at = spec.get("connexe")
    bare = [(re.compile(r), lv) for r, lv in spec["bare"]]
    inline = [(re.compile(r), lv) for r, lv in spec["inline"]]
    cont = CONT[spec.get("cont", "caps")]

    corps, toc, jointures = [], [], []
    i, sec = 0, 0
    while i < len(src_lignes):
        n, raw = src_lignes[i]
        t = raw.strip()
        lab, lvl, consommees = None, None, 1
        if n in covers:
            k = covers[n]
            parts = [src_lignes[i + j][1].strip() for j in range(k) if i + j < len(src_lignes)]
            parts = [p for p in parts if p]
            lab, lvl, consommees = " — ".join(parts), 1, k
        else:
            for rx, lv in bare:
                if rx.match(t):
                    parts, j = [], i + 1
                    extra = spec.get("caps_extra") or {}
                    while j < len(src_lignes) and src_lignes[j][0] not in extra \
                            and cont(src_lignes[j][1].strip()):
                        parts.append(src_lignes[j][1].strip())
                        j += 1
                    assert parts, f"[{spec['id']}] en-tête « {t} » sans intitulé (l. {n})"
                    lab, lvl, consommees = f"{t} — {' '.join(parts)}", lv, j - i
                    break
            if lab is None:
                for rx, lv in inline:
                    if rx.match(t):
                        lab, lvl, consommees = t, lv, 1
                        break
            if lab is None and n in (spec.get("caps_extra") or {}):
                lab, lvl, consommees = t, spec["caps_extra"][n], 1
        if lab is not None:
            sec += 1
            kind = "connexe" if (connexe_at is not None and n >= connexe_at) else "code"
            toc.append({"level": lvl, "label": lab, "anchor": f"sec-{sec}", "kind": kind,
                        "ligne_source": n})
            if consommees > 1:
                jointures.append({"ligne_source": n, "lignes_jointes": consommees, "libelle": lab})
            corps.append(lab)
            i += consommees
            continue
        corps.append(raw)
        i += 1

    # ── Écarter du `toc` les libellés qui apparaissent PLUSIEURS FOIS dans le corps :
    #    l'appariement de segmentAnnotated se ferait sur le rappel de sommaire interne.
    occurrences = {}
    for ligne in corps:
        occurrences[norm_line(ligne.strip())] = occurrences.get(norm_line(ligne.strip()), 0) + 1
    ecartes = [e for e in toc if occurrences.get(norm_line(e["label"]), 0) != 1]
    if ecartes:
        toc = [e for e in toc if occurrences.get(norm_line(e["label"]), 0) == 1]
        for k, e in enumerate(toc, start=1):
            e["anchor"] = f"sec-{k}"

    # ── Ancres d'articles : simulation FIDÈLE de segmentAnnotated ──────────────────
    toc_labels = [norm_line(e["label"]) for e in toc]
    ptr, in_annexe, seen = 0, False, set()
    ancres, labels, doublons, appariement = [], {}, [], []
    for k, ligne in enumerate(corps):
        t = ligne.strip()
        if ptr < len(toc_labels) and norm_line(t) == toc_labels[ptr]:
            appariement.append({"toc": ptr, "ligne_corps": k + 1, "label": toc[ptr]["label"]})
            if toc[ptr]["kind"] == "connexe":
                in_annexe = True
            ptr += 1
            continue
        a, desig = article_anchor_from_heading(t)
        if a:
            if in_annexe or a in seen:
                doublons.append({"ligne_corps": k + 1, "ancre": a, "tete": t[:80],
                                 "motif": "doublon" if a in seen else "annexe (kind connexe)"})
            else:
                ancres.append(a)
                labels[a] = re.sub(r"\s*[.\-:].*$", "", t.split("\t")[0]).strip() or t[:40]
                # libellé LU DU CORPS : « Article 1er.- … » → « Article 1er »
                m = re.match(r"^(Articles?\s+[^\s.\-:]+(?:[.\-]\d+)*)", t)
                if m:
                    labels[a] = m.group(1).rstrip(".-").strip()
            seen.add(a)
    return {
        "corps": corps, "toc": toc, "labels": labels, "ancres": ancres,
        "jointures": jointures, "appariement": appariement, "doublons": doublons,
        "ptr": ptr, "src_lignes": src_lignes, "brut": brut,
        "ecartes_repetes": [e["label"] for e in ecartes],
    }


def nav_toc(toc):
    """navToc : groupes de niveau 1, enfants de niveau 2, petits-enfants de niveau 3+."""
    groups = []
    for e in toc:
        item = {"label": e["label"], "anchor": e["anchor"]}
        if e["level"] == 1 or not groups:
            groups.append({"label": e["label"], "anchor": e["anchor"], "children": []})
            if e["level"] != 1:
                groups[-1]["children"] = []
            continue
        g = groups[-1]
        if e["level"] == 2:
            g["children"].append(item)
        else:
            if not g["children"]:
                g["children"].append(item)
            else:
                p = g["children"][-1]
                p.setdefault("children", []).append(item)
    return groups


def main():
    rapport = []
    for spec in SPECS:
        if spec["covers"] is None:
            spec["covers"], spec["connexe"] = COVERS_MESURES[spec["id"]]
        r = construire(spec)
        corps_txt = "\n".join(r["corps"])
        nav = nav_toc(r["toc"])

        # ── GARDES DE SEGMENTATION ────────────────────────────────────────────────
        gardes = {}
        gardes["secs_egale_toc"] = (r["ptr"] == len(r["toc"]))
        gardes["join_egale_corps"] = ("\n".join(r["corps"]) == corps_txt)
        gardes["ancres_egalent_labels"] = (sorted(set(r["ancres"])) == sorted(r["labels"].keys()))
        gardes["aucune_ancre_dupliquee"] = (len(r["ancres"]) == len(set(r["ancres"])))
        gardes["toc_apparie_dans_l_ordre"] = all(
            r["appariement"][i]["ligne_corps"] < r["appariement"][i + 1]["ligne_corps"]
            for i in range(len(r["appariement"]) - 1)
        )
        # l'appariement doit tomber sur la ligne VOULUE (pas sur un rappel de sommaire interne)
        gardes["appariement_sur_la_bonne_ligne"] = True
        pos = {}
        for k, ligne in enumerate(r["corps"]):
            pos.setdefault(norm_line(ligne.strip()), []).append(k + 1)
        entrees_ambigues = [e["label"] for e in r["toc"] if len(pos.get(norm_line(e["label"]), [])) > 1]
        gardes["libelles_toc_uniques_dans_le_corps"] = not entrees_ambigues

        base = f"prep-{spec['id']}-{spec['slug']}"
        with open(os.path.join(HERE, base + "-corps.txt"), "w", encoding="utf-8") as f:
            f.write(corps_txt)
        fiche = {
            "id": spec["id"], "slug": spec["slug"], "titre_provisoire": spec["titre"],
            "source": {"fichier": spec["src"], "md5_txt": md5(os.path.join(SRC, spec["src"])),
                       "lignes_fichier": len(r["brut"])},
            "decoupe": {"segments": spec["segments"], "note": spec.get("decoupe"),
                        "retraits": [{"ligne_source": n, "motif": m, "texte": r["brut"][n - 1]}
                                     for n, m in spec["retraits"]]},
            "jointures_entetes": r["jointures"],
            "toc": [{k: v for k, v in e.items()} for e in r["toc"]],
            "labels": r["labels"],
            "navToc": nav,
            "pointAnchors": None,
            "comptes": {
                "lignes_corps": len(r["corps"]),
                "toc": len(r["toc"]),
                "labels": len(r["labels"]),
                "ancres_emises": len(r["ancres"]),
                "tetes_article_sans_ancre_annexe_ou_doublon": len(r["doublons"]),
                "navToc_groupes": len(nav),
            },
            "gardes": gardes,
            "ancres_non_emises": r["doublons"][:60],
            "libelles_toc_ambigus": entrees_ambigues,
            "libelles_ecartes_car_repetes_dans_le_corps": r["ecartes_repetes"],
            "reserve": spec.get("reserve"),
            "sans_appareil": spec.get("sans_appareil"),
            "md5_corps": hashlib.md5(corps_txt.encode("utf-8")).hexdigest(),
            "apostrophes": {"droites": corps_txt.count("'"), "courbes": corps_txt.count("’")},
            "exposants_unicode": {c: corps_txt.count(c) for c in ("ᵉ", "ʳ", "º", "ᵉʳ")
                                  if corps_txt.count(c)},
        }
        with open(os.path.join(HERE, base + ".json"), "w", encoding="utf-8") as f:
            json.dump(fiche, f, ensure_ascii=False, indent=1)
        rapport.append((spec["id"], spec["slug"], fiche["comptes"], gardes))

    print(f"{'#':<3} {'slug':<38} {'lignes':>6} {'toc':>4} {'lbl':>4} {'anc':>4} {'nav':>4}  gardes")
    for i, s, c, g in rapport:
        ko = [k for k, v in g.items() if not v]
        print(f"{i:<3} {s:<38} {c['lignes_corps']:>6} {c['toc']:>4} {c['labels']:>4} "
              f"{c['ancres_emises']:>4} {c['navToc_groupes']:>4}  {'OK' if not ko else 'ÉCHEC ' + ','.join(ko)}")


if __name__ == "__main__":
    main()
