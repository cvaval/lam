# -*- coding: utf-8 -*-
"""
Confrontation des 191 articles du décret du 29 septembre 2005 sur l'Impôt sur le Revenu.

  côté A : `loi_ir.txt`  — transcription COMPLÈTE du texte de 2005 (191 articles),
                            fichier daté du 9 juillet 2020, provenance inconnue.
  côté B : `body_db.txt` — le corps EN BASE (document cms43ptub00008lo8tv3y25kk),
                            édition consolidée Joseph Paillant 2018.
  arbitre : `Decret_2005_Impot_sur_le_Revenu.txt` — le Journal officiel
                            (Le Moniteur, Spécial n° 10 du 5 octobre 2005),
                            articles 1 à 126 SEULEMENT.

Le script NE LIT NI N'ÉCRIT LA BASE. Il ne produit qu'un fichier JSON.

    python3 confronter_191.py [chemin/de/sortie.json]

Mesure : comparaison AU MOT, `SequenceMatcher(..., autojunk=False)`.
`autojunk=True` (le défaut) traite comme du bruit tout élément présent dans plus
de 1 % d'une séquence de plus de 200 éléments : sur ces articles il rend des
ratios absurdes (0,157 sur des textes quasi identiques). Ne pas le réactiver.

Normalisation avant découpage en mots : apostrophes et tirets unifiés, accents
retirés, casse repliée, espaces repliés. La ponctuation reste COLLÉE au mot
(« contribuable » ≠ « contribuable, »), conformément au protocole du prompt.
"""

import os
import re
import sys
import json
import unicodedata
import statistics
from difflib import SequenceMatcher

# --------------------------------------------------------------------------
# Emplacement des pièces
# --------------------------------------------------------------------------
# ⚠️ Défaut D13 du contrôle du 25 août : la valeur par défaut pointait un répertoire
# TEMPORAIRE de séance, qui n'existe plus une fois la séance close. Les pièces sont
# désormais dans le dépôt, à côté de ce script.
PIECES = os.environ.get('IR2005_PIECES', os.path.dirname(os.path.abspath(__file__)))
F_LOI = os.path.join(PIECES, 'piece-transcription-2020-191-articles.txt')
F_JO = os.path.join(PIECES, 'piece-jo-2005-moniteur-sp10.txt')
F_DB = os.path.join(PIECES, 'etat-2026-08-25-corps.txt')
F_ANN = os.path.join(PIECES, 'etat-2026-08-25-annotations.json')

SORTIE_DEFAUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                             'confrontation-191.json')


def rd(p):
    with open(p, encoding='utf-8') as f:
        return [l.rstrip('\n') for l in f]


# --------------------------------------------------------------------------
# Normalisation
# --------------------------------------------------------------------------
UNIF = {'’': "'", '‘': "'", 'ʼ': "'", '`': "'", '´': "'",
        '“': '"', '”': '"',
        '–': '-', '—': '-', '−': '-',
        ' ': ' ', ' ': ' ', ' ': ' ',
        # fractions typographiques du livre imprimé : « 2½ % » vaut « 2.5% »
        '½': '.5', '¼': '.25', '¾': '.75'}


def unif(s):
    for k, v in UNIF.items():
        s = s.replace(k, v)
    return s


def sans_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn')


def mots(s):
    return sans_accents(unif(s)).casefold().split()


def sim(a, b):
    return SequenceMatcher(None, a, b, autojunk=False).ratio()


# --------------------------------------------------------------------------
# Segmentation des trois pièces
# --------------------------------------------------------------------------
RE_DIV_LOI = re.compile(r'\[\d+(?:\s*-\s*\d+)?\]\s*$')   # « Section 1 : … [4-10] »
RE_HEAD_LOI = re.compile(r'^Article\s+(\d+(?:\.\d+)?)\s*:\s*(.*)$')
RE_HEAD_JO = re.compile(r'^Article\s+(\d+(?:-\d+)?)\.-\s*(.*)$')
RE_DIV_JO = re.compile(r'^(TITRE|CHAPITRE|SECTION)\b|^Sous Section\b|^[ABC]\)\s+[A-Z]')
RE_HEAD_DB = re.compile(r'^Article\s+(\d+(?:-\d+)?)\.-\s*(.*)$')


def _segmente(lignes, re_head, est_division, num_norm=lambda x: x):
    arts, divisions, orphelins = {}, [], []
    cur = None
    for i, l in enumerate(lignes, 1):
        m = re_head.match(l)
        if m and not est_division(l):
            num = num_norm(m.group(1))
            cur = num
            arts[num] = {'ligne': i, 'tete': l,
                         'corps': ([m.group(2)] if m.group(2).strip() else [])}
            continue
        if est_division(l):
            divisions.append({'ligne': i, 'texte': l})
            cur = None
            continue
        if cur is None:
            orphelins.append({'ligne': i, 'texte': l})
        else:
            arts[cur]['corps'].append(l)
    return arts, divisions, orphelins


def parse_loi():
    return _segmente(rd(F_LOI), RE_HEAD_LOI,
                     lambda l: bool(RE_DIV_LOI.search(l)),
                     num_norm=lambda n: n.replace('.', '-'))


def parse_jo():
    return _segmente(rd(F_JO), RE_HEAD_JO, lambda l: bool(RE_DIV_JO.match(l)))


def parse_db():
    ann = json.load(open(F_ANN, encoding='utf-8'))
    tocl = set(t['label'] for t in ann['toc'])
    return _segmente(rd(F_DB), RE_HEAD_DB,
                     lambda l: (l in tocl) or l.startswith('Sous Section'))


def txt(a):
    return '\n'.join(a['corps'])


def cle(n):
    p = n.split('-')
    return (int(p[0]), int(p[1]) if len(p) > 1 else 0)


# --------------------------------------------------------------------------
# Nature d'un écart (ce qui n'a PAS de portée)
# --------------------------------------------------------------------------
NON_ALNUM = re.compile(r'[^0-9a-z]+')
ENUM = re.compile(r'^[0-9]+[).:\-]*$|^[a-z][).:\-]*$|^[ivx]+[).:\-]*$|^[-•·]$')
# apostrophe détachée : « l' article », « quel' administration », « 1' excédent »
APO_DETACHEE = re.compile(r"(?:^|[\s(])[a-z0-9]{1,2}'\s")
# glyphes parasites de cadre / de colonne laissés par l'océrisation
GLYPHE = re.compile(r"[~·•_¬¦]|\.{2,}|,{2,}|-{5,}|\"'|(?:^|\s)'(?:\s|$)")


def sq(s):
    return NON_ALNUM.sub('', s)


def marque_ocr(a, b):
    """Signature MÉCANIQUE d'océrisation du côté base — jamais une appréciation."""
    if APO_DETACHEE.search(b) and not APO_DETACHEE.search(a):
        return 'ocr_apostrophe_detachee', b.strip()[:120]
    if GLYPHE.search(b) and not GLYPHE.search(a):
        return 'ocr_glyphe', b.strip()[:120]
    if re.match(r'^[a-z]\)[a-z]', b) and not re.match(r'^[a-z]\)', a):
        return 'ocr_enumeration_collee', b.strip()[:80]
    return None


def num_canon(s):
    """« 25.000,00 », « 25,000 », « 25 000,00 » -> « 25000 »."""
    out = []
    for m in re.finditer(r'\d[\d .,]*\d|\d', s):
        v = m.group(0).replace(' ', '')
        v = re.sub(r'[.,]00$', '', v)
        out.append(re.sub(r'[.,]', '', v))
    return out


def nature(e):
    """Renvoie (nature, indice) — 'fond' quand l'écart porte sur les mots."""
    a, b = e['loi_2020'], e['base']
    ta, tb = a.split(), b.split()
    ocr = marque_ocr(a, b)

    if sq(a) == sq(b):
        # mêmes lettres/chiffres : reste la ponctuation, les espaces, les tirets
        if ocr:
            return ocr
        if len(ta) == len(tb):
            return 'ponctuation', ''
        sa = a.replace('-', '').replace(' ', '')
        sb = b.replace('-', '').replace(' ', '')
        if sa == sb and a.count('-') != b.count('-'):
            return 'trait_union', ''
        pleins_a = ta and all(sq(t) for t in ta)
        pleins_b = tb and all(sq(t) for t in tb)
        if pleins_a and pleins_b and len(ta) != len(tb):
            # un mot est soudé d'un côté ou coupé de l'autre ; QUI a raison est
            # tranché par le J.O. dans classe_ecart(), pas ici.
            return 'mot_soude_ou_coupe', (b if len(tb) != len(ta) else a).strip()[:80]
        return 'espacement', ''

    # marqueurs d'énumération seuls
    ra = ''.join(sq(t) for t in ta if not ENUM.match(t))
    rb = ''.join(sq(t) for t in tb if not ENUM.match(t))
    if ra == rb:
        return 'enumeration', ''

    # même valeur numérique, notation différente (« 25,000 » / « 25.000,00 »)
    na, nb = num_canon(a), num_canon(b)
    alpha_a = re.sub(r'[^a-z]', '', a)
    alpha_b = re.sub(r'[^a-z]', '', b)
    if na and na == nb and alpha_a == alpha_b:
        return 'notation_numerique', ''

    if ocr:
        return ocr
    return 'fond', ''


# --------------------------------------------------------------------------
# Marqueurs relevés sur le texte du corps en base
# --------------------------------------------------------------------------
M_FILET = re.compile(r'-{5,}')
M_BUDGET = re.compile(r'budget\s*20\d\d\s*-\s*20\d\d', re.I)
M_MONITEUR = re.compile(r'moniteur\s*(?:special)?\s*#', re.I)
M_ART_INS = re.compile(r'(?:^|\s)[-–—]\s*article\s+\d+\.-', re.I)
M_NB = re.compile(r'→|\bn\.?\s?b\.?\s*[:.]', re.I)
M_REFPAGE = re.compile(r'r[ée]f\.?\s*pages?', re.I)
M_LF = re.compile(r'lois?\s+de\s+finances', re.I)

BLOCS = [('filet_de_cadre', M_FILET), ('encadre_budget', M_BUDGET),
         ('renvoi_moniteur', M_MONITEUR), ('article_insere', M_ART_INS),
         ('note_nb', M_NB), ('renvoi_page_livre', M_REFPAGE)]

ACRONYMES = ('dgi', 'brh', 'ulcc', 'tca', 'cscca')


def marqueurs_bloc(s):
    return [nom for nom, rx in BLOCS if rx.search(s)]


def acronyme_ajoute(e):
    """La transcription 2020 développe « … des Impôts » en « … des Impôts (DGI) »."""
    a, b = sq(e['loi_2020']), sq(e['base'])
    if len(a) <= len(b):
        return None
    reste = a[len(b):] if a.startswith(b) else (a[:-len(b)] if b and a.endswith(b) else a)
    return reste if reste in ACRONYMES else None


# --------------------------------------------------------------------------
# Écarts et arbitrage
# --------------------------------------------------------------------------
def ecarts(n, LOI, JO, DB, ctx=4):
    A, B = mots(txt(LOI[n])), mots(txt(DB[n]))
    # `mots()` ne touche pas aux frontières de mots (vérifié : 0 article sur 510
    # où le compte diffère du découpage brut), on peut donc indexer le texte
    # d'origine avec les mêmes indices pour citer verbatim.
    Ar, Br = txt(LOI[n]).split(), txt(DB[n]).split()
    jow = mots(txt(JO[n])) if n in JO else None
    jos = ' ' + ' '.join(jow) + ' ' if jow is not None else None

    def dans_jo(seq):
        if jos is None or not seq:
            return None
        return (' ' + ' '.join(seq) + ' ') in jos

    out = []
    for tag, i1, i2, j1, j2 in SequenceMatcher(None, A, B, autojunk=False).get_opcodes():
        if tag == 'equal':
            continue
        sl, sb = A[i1:i2], B[j1:j2]
        cl, cr = A[max(0, i1 - ctx):i1], A[i2:i2 + ctx]
        e = {'op': tag,
             'contexte_gauche': ' '.join(cl),
             'contexte_droit': ' '.join(cr),
             'loi_2020': ' '.join(sl),
             'base': ' '.join(sb),
             # les mêmes segments, tels qu'ils s'écrivent dans les fichiers
             'loi_2020_verbatim': ' '.join(Ar[i1:i2]),
             'base_verbatim': ' '.join(Br[j1:j2]),
             'contexte_gauche_verbatim': ' '.join(Ar[max(0, i1 - ctx):i1])}
        if jos is not None:
            # on rejoue les deux lectures avec le MÊME contexte (zones communes)
            a_in, b_in = dans_jo(cl + sl + cr), dans_jo(cl + sb + cr)
            if a_in and not b_in:
                v, conf = 'jo=loi_2020', 'contexte'
            elif b_in and not a_in:
                v, conf = 'jo=base', 'contexte'
            elif a_in and b_in:
                v, conf = 'jo=les_deux', 'contexte'
            else:
                a2, b2 = dans_jo(sl), dans_jo(sb)
                if a2 and not b2:
                    v, conf = 'jo=loi_2020', 'segment'
                elif b2 and not a2:
                    v, conf = 'jo=base', 'segment'
                elif a2 and b2:
                    v, conf = 'jo=les_deux', 'segment'
                elif a2 is None and b2 is False:
                    v, conf = 'jo=loi_2020', 'segment'
                elif b2 is None and a2 is False:
                    v, conf = 'jo=base', 'segment'
                else:
                    v, conf = 'indecidable', 'aucune'
            e['arbitrage_jo'] = v
            e['arbitrage_appui'] = conf
        else:
            e['arbitrage_jo'] = 'hors_jo'
            e['arbitrage_appui'] = 'aucune'
        nat, ind = nature(e)
        e['nature'] = nat
        if ind:
            e['indice'] = ind
        out.append(e)
    return out


def accords_contre_jo(n, LOI, JO, DB):
    """Écarts J.O. ↔ base où la transcription 2020 lit COMME LA BASE.

    Ce sont les leçons que la comparaison loi↔base ne peut pas voir : les deux
    témoins partagent la divergence, l'écart n'apparaît donc pas entre eux.
    """
    if n not in JO:
        return []
    J, B = mots(txt(JO[n])), mots(txt(DB[n]))
    L = ' ' + ' '.join(mots(txt(LOI[n]))) + ' '
    out = []
    for tag, i1, i2, j1, j2 in SequenceMatcher(None, J, B, autojunk=False).get_opcodes():
        if tag == 'equal':
            continue
        sj, sb = J[i1:i2], B[j1:j2]
        cl, cr = J[max(0, i1 - 4):i1], J[i2:i2 + 4]
        if not cl and not cr:
            continue
        # la transcription lit-elle comme la base, contre le J.O. ?
        if (' ' + ' '.join(cl + sb + cr) + ' ') not in L:
            continue
        nat, _ = nature({'loi_2020': ' '.join(sj), 'base': ' '.join(sb)})
        if nat != 'fond':
            continue
        out.append({'contexte_gauche': ' '.join(cl),
                    'jo_2005': ' '.join(sj),
                    'loi_2020_et_base': ' '.join(sb),
                    'contexte_droit': ' '.join(cr),
                    'lecture': "Le J.O. de 2005 porte cette leçon ; la transcription "
                               "de 2020 ET le corps en base ne la portent ni l'une ni "
                               "l'autre. La confrontation transcription ↔ base est "
                               "aveugle à ce cas : les deux témoins s'accordent."})
    return out


# --------------------------------------------------------------------------
# Classement
# --------------------------------------------------------------------------
NATURE_CAT = {
    'ponctuation': 'e', 'trait_union': 'e', 'enumeration': 'e',
    'notation_numerique': 'e', 'espacement': 'e',
    'ocr_apostrophe_detachee': 'b', 'ocr_glyphe': 'b',
    'ocr_enumeration_collee': 'b',
}

# Débris nommément visés par le § 7.5 et le § 11.10 du prompt. Ce n'est PAS une
# catégorie : c'est un drapeau, posé même quand l'écart est classé (a) ou (c),
# pour que l'étape de correction dispose de l'index.
DEBRIS_SIGNALES = [
    ('te_pourcent', re.compile(r'\bte%')),
    ('renvoi_page_livre', M_REFPAGE),
    ('encadre_budget', M_BUDGET),
    ('filet_de_cadre', re.compile(r'-{10,}')),
    ('note_pdf_interrompu', re.compile(r"\[le texte du fichier pdf", re.I)),
    ('apostrophe_detachee', APO_DETACHEE),
]

# Les trois en-têtes A) B) C) du J.O. (style Heading4, § 9.1 du prompt). Le corps
# en base les porte comme des lignes ORDINAIRES : n'étant pas au `toc`, elles
# tombent dans le bloc de l'article qui précède. Ce n'est pas un écart de
# rédaction, c'est une conséquence mesurable de leur absence du sommaire.
ENTETES_ABC = {
    'a) regime simplifie pour certaines activites professionnelles',
    'b) regime du benefice reel',
    'c) acompte provisionnel',
}

# Décisions prises à la main, écart par écart, après lecture du diff complet.
# Clé : (article, segment côté base). Elles priment sur les règles automatiques.
SURCLASSEMENT_ECART = {
    ('135', 'imposes'): ('d', 'coquille_transcription',
                         "La transcription lit « mposes » ; la base lit « imposés ». "
                         "Le mot amputé est du côté de la transcription. Hors portée "
                         "du J.O. : non arbitré, apprécié sur la forme du mot."),
    ('138', 'controle'): ('d', 'coquille_transcription',
                          "La transcription lit « contrtole ». Hors portée du J.O."),
    ('141', 'camionnettes,'): ('d', 'coquille_transcription',
                               "La transcription lit « camionettes ». Hors portée du J.O."),
    ('141', 'il-les'): ('b', 'ocr_chiffre_romain',
                        "« Il-Les » est la lecture océrisée de « II.- Les » (le romain II "
                        "lu « Il »). Défaut du côté base. Hors portée du J.O."),
}

# Articles dont le contenu est une TABLE aplatie en liste, différemment de part
# et d'autre. L'alignement au mot s'y décale et fabrique des écarts qui ne sont
# que des séparateurs déplacés. À lire avec cette réserve, pas comme du fond.
RESERVE_ART = {
    '29': "Le barème des taux maxima d'amortissement est un tableau (20 lignes × 2 "
          "colonnes au .docx du J.O.) aplati en liste des deux côtés, avec des "
          "séparateurs différents (« Tracteurs 20% » / « - Tracteurs : 20% »). "
          "L'alignement au mot s'y décale : plusieurs écarts de cet article ne "
          "sont que du séparateur déplacé. Ne pas les lire comme du fond.",
    '141': "Le barème des éléments de train de vie est aplati en liste des deux "
           "côtés, avec des séparateurs différents. Même réserve qu'à l'article 29.",
    '149': "Le barème de l'impôt est un tableau aplati en liste des deux côtés, "
           "avec des notations de montant différentes (« 60,000 » / « 60.000,00 »). "
           "Même réserve qu'à l'article 29.",
}

SURCLASSEMENT_ART = {
    '104': ('f', 'f_correction_base',
            "Le J.O. et la transcription 2020 lisent tous deux « commissionnaire aux "
            "comptes » ; la base lit « commissaire aux comptes ». La base s'écarte des "
            "deux témoins de 2005 sans qu'aucun texte modificatif ne soit invoqué : "
            "correction éditoriale probable, non documentée."),
    '189': ('f', 'f_omission_base',
            "La transcription 2020 porte la clôture signée — « Donné au Palais National, "
            "à Port-au-Prince, le 29 septembre 2005, An 202ème de l'Indépendance » suivie "
            "des dix-huit signatures ministérielles. Le corps en base s'arrête à la "
            "formule d'abrogation. Aucune loi de finances n'est en cause : c'est un "
            "retranchement de l'édition consolidée. Le J.O. de la cliente s'arrête à "
            "l'article 126, il ne peut pas arbitrer."),
}


MOT_OUTIL = re.compile(r'^[a-z\']{1,7}[.,;:]?$')


def _variante_courte(a, b):
    """Deux lectures d'un même mot (accord, mot outil) plutôt qu'une autre règle."""
    ta, tb = a.split(), b.split()
    if len(ta) <= 1 and len(tb) <= 1:
        if not ta or not tb:
            return False
        x, y = sq(ta[0]), sq(tb[0])
        if x and y and (x.startswith(y[:max(3, len(y) - 2)])
                        or y.startswith(x[:max(3, len(x) - 2)])):
            return True
        return bool(MOT_OUTIL.match(a) and MOT_OUTIL.match(b))
    return False


def classe_ecart(num, e, art_lf, art_bloc):
    b = e['base']
    surc = SURCLASSEMENT_ECART.get((num, b.strip()))
    if surc:
        return surc[0], surc[1], surc[2]

    if b.strip() in ENTETES_ABC and not e['loi_2020'].strip():
        return ('e', 'entete_ABC_hors_toc',
                "Le J.O. porte cette ligne comme un en-tête (style Heading4) ; le corps "
                "en base la porte comme une ligne ordinaire, faute d'entrée au `toc`. "
                "Écart de découpage, pas de rédaction.")

    # L'appareil éditorial prime sur la signature d'océrisation : les encadrés
    # « Budget » arrivent avec leur filet, mais c'est l'encadré qui est en cause.
    # En revanche une simple citation de source — « (… Loi de Finances 2013-2014,
    # Moniteur Spécial # 2 …) » — nomme le texte modificatif : c'est (a), pas (c).
    blocs = [nom for nom, rx in BLOCS
             if nom not in ('filet_de_cadre', 'renvoi_moniteur') and rx.search(b)]
    if blocs:
        return ('c', 'appareil_' + '+'.join(blocs),
                "Passage présent dans le corps en base et absent du texte de 2005 : "
                "matière de l'éditeur (encadré, note « → N.B. », article de loi de "
                "finances recopié sous son hôte, renvoi de pagination du livre papier).")
    if M_LF.search(b):
        return 'a', 'citation_loi_de_finances', None
    if M_MONITEUR.search(b):
        return ('a', 'citation_source_moniteur',
                "Le passage cite sa source au Moniteur sans nommer de loi de finances ; "
                "il désigne un texte modificatif, ce n'est pas de l'appareil éditorial.")

    nat = e['nature']
    if nat in NATURE_CAT:
        return NATURE_CAT[nat], 'auto_' + nat, None

    if nat == 'mot_soude_ou_coupe':
        j = e['arbitrage_jo']
        if j == 'jo=loi_2020':
            return ('b', 'ocr_mot_soude_ou_coupe',
                    "Le J.O. lit comme la transcription : c'est le corps en base qui "
                    "soude ou coupe le mot (« les quelles », « 141et142 »).")
        if j == 'jo=base':
            return ('d', 'transcription_mot_soude_ou_coupe',
                    "Le J.O. lit comme la base : c'est la transcription qui soude ou "
                    "coupe le mot.")
        nb, na_ = len(e['base'].split()), len(e['loi_2020'].split())
        if nb < na_:
            return ('b', 'ocr_mots_soudes_non_arbitre',
                    "Le corps en base soude deux mots ; aucun arbitre disponible, "
                    "conclusion tirée de la seule forme.")
        return ('d', 'transcription_mots_soudes_non_arbitre',
                "La transcription soude deux mots ; aucun arbitre disponible.")

    ac = acronyme_ajoute(e)
    if ac:
        return ('d', 'sigle_ajoute_' + ac,
                "La transcription de 2020 développe le sigle. Mesuré : « (DGI) » "
                "apparaît 93 fois dans la transcription, 0 fois au J.O. et 1 fois "
                "en base ; « (BRH) » 4 fois dans la transcription, 0 au J.O. et 0 "
                "en base. C'est une normalisation du transcripteur, pas le texte.")

    j = e['arbitrage_jo']
    if j == 'jo=base':
        return ('d', 'transcription_s_ecarte_du_jo',
                "Le J.O. lit comme la base ; c'est la transcription de 2020 qui s'écarte.")
    if j == 'jo=loi_2020':
        if art_lf or art_bloc:
            return ('a', 'base_s_ecarte_de_2005_article_consolide',
                    "La base s'écarte du J.O. dans un article qui porte par ailleurs "
                    "la marque d'une consolidation (citation de loi de finances ou "
                    "appareil éditorial).")
        if _variante_courte(e['loi_2020'], b):
            return ('f', 'f_variante_de_mot',
                    "La base s'écarte du J.O. de 2005 sur un accord ou un mot outil, "
                    "sans qu'aucun texte modificatif ne soit invoqué. Ni débris "
                    "mécanique d'océrisation, ni consolidation documentée.")
        return ('f', 'f_base_s_ecarte_du_jo_sans_texte_modificatif',
                "La base s'écarte du J.O. de 2005 sans qu'aucun texte modificatif "
                "ne soit invoqué et sans signature mécanique d'océrisation.")
    if j == 'jo=les_deux':
        return ('f', 'f_arbitrage_ambigu',
                "Les deux lectures se trouvent dans l'article au J.O. : le test par "
                "sous-chaîne ne tranche pas.")
    if j == 'hors_jo':
        if art_lf or art_bloc:
            return ('a', 'article_consolide_hors_portee_du_jo',
                    "Article postérieur à 126 portant la marque d'une consolidation ; "
                    "aucun arbitre disponible.")
        return ('f', 'f_non_arbitrable_hors_jo',
                "Article postérieur à 126 : le fascicule du Moniteur s'y interrompt, "
                "la transcription de 2020 est le seul témoin et ne peut pas s'arbitrer "
                "elle-même.")
    if art_lf or art_bloc:
        return ('a', 'article_consolide_arbitrage_indecidable',
                "Le contexte de l'écart est trop remanié pour se retrouver au J.O. ; "
                "l'article porte la marque d'une consolidation.")
    return ('f', 'f_indecidable',
            "Le contexte de l'écart ne se retrouve pas au J.O. : rien ne permet "
            "de trancher.")


PRIORITE = ['a', 'c', 'f', 'b', 'd', 'e']
LIBELLE = {
    'a': "consolidation postérieure (une loi de finances a modifié l'article)",
    'b': "débris d'océrisation du corps en base",
    'c': "appareil de Paillant inséré dans le dispositif",
    'd': "coquille ou normalisation de la transcription de 2020",
    'e': "écart d'extraction (ponctuation, numérotation, notation) — sans portée",
    'f': "inexpliqué",
}


# --------------------------------------------------------------------------
# Vérifications — elles accompagnent le fichier pour qu'il soit rejouable
# --------------------------------------------------------------------------
def couverture_lignes(arts, divisions, orphelins, fichier, re_head):
    """Toute ligne source doit tomber dans exactement un seau."""
    n = len(divisions) + len(orphelins)
    for a in arts.values():
        n += 1                                    # la ligne de tête
        m = re_head.match(a['tete'])
        tete_avec_texte = bool(m and m.group(2).strip())
        k = len(a['corps'])
        if tete_avec_texte and k:
            k -= 1                                # corps[0] est sur la ligne de tête
        n += k
    return n, len(rd(fichier))


def compte_sigles():
    brut = {'transcription_2020': open(F_LOI, encoding='utf-8').read(),
            'jo_2005': open(F_JO, encoding='utf-8').read(),
            'base': open(F_DB, encoding='utf-8').read()}
    return {sig: {k: v.count(sig) for k, v in brut.items()}
            for sig in ('(DGI)', '(BRH)', '(ULCC)', '(TCA)')}


MARQUEUR_ENUM = re.compile(r'^(?:[0-9]{1,2}|[a-z]|[ivx]{1,4})[).]$'
                           r'|^(?:[0-9]{1,2}|[a-z]|[ivx]{1,4})\.-$')


def marqueurs_enum_perdus(JO, DB):
    """Alinéas dont le corps en base a perdu le marqueur que porte le J.O.

    La confrontation au mot les manque : en retirant les marqueurs des deux
    côtés pour ne pas compter le changement de style (« 1.- » / « 1) »), elle
    efface du même coup les marqueurs DISPARUS. Mesure séparée, donc.
    """
    def marks(t):
        return [w for w in mots(t) if MARQUEUR_ENUM.match(w)]
    out = []
    for n in sorted(set(JO) & set(DB), key=cle):
        j, b = marks(txt(JO[n])), marks(txt(DB[n]))
        if len(b) < len(j):
            out.append({'article': n, 'marqueurs_au_jo': len(j),
                        'marqueurs_en_base': len(b)})
    return out


def calibration_jo_loi(LOI, JO):
    com = sorted(set(JO) & set(LOI), key=cle)
    s = [sim(mots(txt(LOI[k])), mots(txt(JO[k]))) for k in com]
    return {
        'articles_communs': len(com),
        'identiques': sum(1 for x in s if x == 1.0),
        'sup_0_99': sum(1 for x in s if x >= 0.99),
        'sup_0_97': sum(1 for x in s if x >= 0.97),
        'sup_0_90': sum(1 for x in s if x >= 0.90),
        'sup_0_80': sum(1 for x in s if x >= 0.80),
        'mediane': round(statistics.median(s), 4),
        'articles_sous_0_90': [k for k, x in zip(com, s) if x < 0.90],
    }


def main():
    sortie = sys.argv[1] if len(sys.argv) > 1 else SORTIE_DEFAUT

    LOI, dl, ol = parse_loi()
    JO, dj, oj = parse_jo()
    DB, dd, od = parse_db()

    nums = sorted(set(LOI) & set(DB), key=cle)
    assert len(LOI) == 191 and len(DB) == 191, (len(LOI), len(DB))
    assert len(nums) == 191, len(nums)
    assert len(JO) == 128, len(JO)

    articles = []
    for n in nums:
        A, B = mots(txt(LOI[n])), mots(txt(DB[n]))
        es = ecarts(n, LOI, JO, DB)
        tdb = txt(DB[n])
        art_bloc = marqueurs_bloc(tdb)
        art_lf = bool(M_LF.search(tdb))

        for e in es:
            c, sc, just = classe_ecart(n, e, art_lf, bool(art_bloc))
            e['categorie'], e['sous_categorie'] = c, sc
            if just:
                e['justification'] = just
            # Alinéa entier ajouté au dispositif par une loi de finances nommée :
            # classé (a), mais c'est le candidat du § 7.8 (sortir l'appareil).
            if (c == 'a' and e['op'] == 'insert'
                    and len(e['base'].split()) >= 15):
                e['candidat_sortie_appareil'] = True
            dbs = [nom for nom, rx in DEBRIS_SIGNALES if rx.search(e['base'])]
            if dbs:
                e['debris_signales'] = dbs

        if n in SURCLASSEMENT_ART:
            c, sc, motif = SURCLASSEMENT_ART[n]
            for e in es:
                if e['nature'] == 'fond':
                    e['categorie'], e['sous_categorie'] = c, sc
                    e['motif_surclassement'] = motif

        cats = sorted(set(e['categorie'] for e in es), key=PRIORITE.index)
        principale = cats[0] if cats else None

        rec = {
            'numero': n,
            'similarite_loi2020_base': round(sim(A, B), 4),
            'mots_loi2020': len(A),
            'mots_base': len(B),
            'ligne_loi2020': LOI[n]['ligne'],
            'ligne_base': DB[n]['ligne'],
            'categorie': principale,
            'categories': cats,
            'categorie_libelle': LIBELLE.get(principale),
            'marqueurs_base': art_bloc + (['citation_loi_de_finances'] if art_lf else []),
            'nb_ecarts': len(es),
            'nb_ecarts_de_fond': sum(1 for e in es if e['nature'] == 'fond'),
            'ecarts': es,
            'texte_loi_2020': txt(LOI[n]),
            'texte_base': txt(DB[n]),
        }
        if n in SURCLASSEMENT_ART:
            rec['motif_surclassement'] = SURCLASSEMENT_ART[n][2]
        if n in RESERVE_ART:
            rec['reserve_de_lecture'] = RESERVE_ART[n]

        if n in JO:
            J = mots(txt(JO[n]))
            rec['arbitrage_jo'] = {
                'disponible': True,
                'ligne_jo': JO[n]['ligne'],
                'texte_jo': txt(JO[n]),
                'similarite_jo_loi2020': round(sim(J, A), 4),
                'similarite_jo_base': round(sim(J, B), 4),
                'plus_proche_du_jo': ('loi_2020' if sim(J, A) > sim(J, B)
                                      else ('base' if sim(J, B) > sim(J, A) else 'ex_aequo')),
                'ecarts_loi2020_et_base_accordes_contre_le_jo':
                    accords_contre_jo(n, LOI, JO, DB),
            }
        else:
            rec['arbitrage_jo'] = {
                'disponible': False,
                'motif': "Le fascicule du Moniteur produit par la cliente s'interrompt "
                         "à l'article 126, au milieu d'une phrase. Au-delà, la "
                         "transcription de 2020 est le seul témoin du texte d'origine "
                         "et son autorité est moindre : provenance inconnue, et elle "
                         "normalise (93 « (DGI) » ajoutés, 0 au J.O.).",
            }
        articles.append(rec)

    # ---------------- comptes ----------------
    par_principale = {}
    par_presence = {}
    par_ecart = {}
    for a in articles:
        if a['categorie']:
            par_principale[a['categorie']] = par_principale.get(a['categorie'], 0) + 1
        for c in a['categories']:
            par_presence[c] = par_presence.get(c, 0) + 1
        for e in a['ecarts']:
            par_ecart[e['categorie']] = par_ecart.get(e['categorie'], 0) + 1

    sims = [a['similarite_loi2020_base'] for a in articles]
    accords = [a['numero'] for a in articles
               if a['arbitrage_jo']['disponible']
               and a['arbitrage_jo']['ecarts_loi2020_et_base_accordes_contre_le_jo']]

    meta = {
        'objet': "Confrontation article par article du texte de 2005 (transcription "
                 "complète de 2020) et du corps en base (édition consolidée Paillant 2018).",
        'document_en_base': 'cms43ptub00008lo8tv3y25kk',
        'genere_par': os.path.basename(os.path.abspath(__file__)),
        'aucune_ecriture_en_base': True,
        'pieces': {
            'loi_2020': {'chemin': F_LOI, 'articles': len(LOI),
                         'role': "transcription complète du texte de 2005, provenance inconnue"},
            'base': {'chemin': F_DB, 'articles': len(DB),
                     'role': "corps en base, édition consolidée Paillant 2018"},
            'jo_2005': {'chemin': F_JO, 'articles': len(JO),
                        'role': "Le Moniteur, Spécial n° 10 du 5 octobre 2005 — arbitre, art. 1 à 126"},
        },
        'methode': {
            'unite': 'le mot',
            'algorithme': 'difflib.SequenceMatcher(None, A, B, autojunk=False)',
            'normalisation': "apostrophes et tirets unifiés, accents retirés, casse "
                             "repliée, espaces repliés ; la ponctuation reste collée au mot",
            'comparaison': "article entier contre article entier, jamais un préfixe",
            'arbitrage': "chaque écart est rejoué dans le J.O. avec son contexte commun ; "
                         "on regarde laquelle des deux lectures y figure verbatim",
        },
        'couverture': {
            'articles_apparies': len(nums),
            'articles_loi_2020': len(LOI),
            'articles_base': len(DB),
            'articles_arbitres_par_le_jo': sum(1 for a in articles if a['arbitrage_jo']['disponible']),
            'articles_sans_arbitre': sum(1 for a in articles if not a['arbitrage_jo']['disponible']),
            'numerotation': "1 à 189 sans trou, plus 63-1 et 63-2, des deux côtés",
            'appariement': "191 sur 191 des deux côtés ; aucun numéro d'un côté "
                           "seulement ; aucun doublon.",
        },
        'verifications': {
            'lignes_couvertes_par_la_segmentation': {
                'loi_2020': couverture_lignes(LOI, dl, ol, F_LOI, RE_HEAD_LOI),
                'jo_2005': couverture_lignes(JO, dj, oj, F_JO, RE_HEAD_JO),
                'base': couverture_lignes(DB, dd, od, F_DB, RE_HEAD_DB),
                'lecture': "[lignes attribuées, lignes du fichier] — doivent être égales",
            },
            'tetes_d_article_sans_texte_sur_leur_ligne': {
                'jo_2005': [k for k, v in JO.items()
                            if not RE_HEAD_JO.match(v['tete']).group(2).strip()],
                'base': [k for k, v in DB.items()
                         if not RE_HEAD_DB.match(v['tete']).group(2).strip()],
                'note': "Confirme le § 9.4 du prompt : au J.O. l'article 74 tient sur "
                        "une ligne « Article 74.- » nue.",
            },
            'sigles_developpes_par_la_transcription': compte_sigles(),
            'calibration_jo_contre_transcription_2020': dict(
                calibration_jo_loi(LOI, JO),
                annonce_du_prompt_2bis={'identiques': 26, 'sup_0_99': 36, 'sup_0_97': 67,
                                        'sup_0_90': 123, 'sup_0_80': 127, 'mediane': 0.971},
                ecart="Mes chiffres sont un peu plus favorables que ceux du § 2 bis. "
                      "Le prompt ne dit pas si sa mesure inclut la ligne de tête ni la "
                      "note d'éditeur de l'article 126 : le delta n'est pas attribuable "
                      "avec certitude. Il n'affecte pas la présente confrontation, qui "
                      "porte sur transcription ↔ base.",
            ),
        },
        'similarite': {
            'identiques': sum(1 for s in sims if s == 1.0),
            'sup_0_99': sum(1 for s in sims if s >= 0.99),
            'sup_0_97': sum(1 for s in sims if s >= 0.97),
            'sup_0_95': sum(1 for s in sims if s >= 0.95),
            'sup_0_90': sum(1 for s in sims if s >= 0.90),
            'sup_0_80': sum(1 for s in sims if s >= 0.80),
            'mediane': round(statistics.median(sims), 4),
            'moyenne': round(statistics.mean(sims), 4),
            'minimum': min(sims),
        },
        'categories': LIBELLE,
        'convention_de_comptage': "Un article peut relever de plusieurs catégories. "
                                  "`par_categorie_principale` compte chaque article UNE fois, "
                                  "selon la priorité " + ' > '.join(PRIORITE) + ". "
                                  "`par_presence` compte un article dans chaque catégorie qu'il "
                                  "présente. `par_ecart` compte les écarts, pas les articles.",
        'comptes': {
            'par_categorie_principale': par_principale,
            'par_presence': par_presence,
            'par_ecart': par_ecart,
            'total_ecarts': sum(a['nb_ecarts'] for a in articles),
            'total_ecarts_de_fond': sum(a['nb_ecarts_de_fond'] for a in articles),
            'articles_strictement_identiques': sum(1 for a in articles if not a['ecarts']),
        },
        'index': {
            'articles_par_categorie_principale': {
                c: [a['numero'] for a in articles if a['categorie'] == c]
                for c in PRIORITE},
            'articles_par_presence': {
                c: [a['numero'] for a in articles if c in a['categories']]
                for c in PRIORITE},
            'articles_strictement_identiques': [a['numero'] for a in articles
                                                if not a['ecarts']],
            'articles_candidats_sortie_appareil': sorted(
                {a['numero'] for a in articles
                 for e in a['ecarts'] if e.get('candidat_sortie_appareil')}, key=cle),
            'articles_avec_debris_signale': {
                nom: sorted({a['numero'] for a in articles for e in a['ecarts']
                             if nom in e.get('debris_signales', [])}, key=cle)
                for nom, _ in DEBRIS_SIGNALES},
        },
        'angle_mort_mesure': {
            'constat': "La comparaison loi_2020 ↔ base ne peut pas voir les leçons que "
                       "les DEUX témoins partagent contre le J.O. Elle ne voit pas "
                       "davantage un marqueur d'alinéa disparu, puisque la mesure "
                       "neutralise le style de numérotation. Les deux angles morts "
                       "sont mesurés séparément ci-dessous, et seulement sur 1-126.",
            'articles_ou_la_transcription_2020_lit_comme_la_base_contre_le_jo': accords,
            'nombre': len(accords),
            'marqueurs_d_alinea_perdus_par_la_base': marqueurs_enum_perdus(JO, DB),
        },
        'orphelins_de_segmentation': {
            'loi_2020': len(ol), 'jo_2005': len(oj), 'base': len(od),
            'detail_base': od,
            'note': "Côté loi_2020 et J.O. les orphelins sont le préambule (visas, "
                    "considérants, DÉCRÈTE), qui ne relève d'aucun article.",
        },
    }

    with open(sortie, 'w', encoding='utf-8') as f:
        json.dump({'meta': meta, 'articles': articles}, f,
                  ensure_ascii=False, indent=1)

    print(f"écrit : {sortie}")
    print(f"articles : {len(articles)}   écarts : {meta['comptes']['total_ecarts']}"
          f"   dont de fond : {meta['comptes']['total_ecarts_de_fond']}")
    print("par catégorie principale :", par_principale)
    print("par présence            :", par_presence)
    print("par écart               :", par_ecart)


if __name__ == '__main__':
    main()
