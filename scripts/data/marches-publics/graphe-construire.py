# -*- coding: utf-8 -*-
"""
MARCHÉS PUBLICS — construction du GRAPHE (§ 6), du plan PASTILLES/REPLIS (§ 7) et des
rattachements INDEX (§ 8.6). Produit trois fichiers de données, RIEN d'autre :

    graphe-crossrefs.json   les arêtes, chacune avec sa clause CITÉE mot pour mot
    graphe-pastilles.json   les pastilles, les replis (oldVersions) et les ArticleVersion
    graphe-index.json       les rattachements à l'Index du Moniteur, résolus en DEUX TEMPS

AUCUNE ÉCRITURE EN BASE. Ce script ne touche pas Prisma ; il lit les corps préparés et
recopie. Le script d'application (--apply, lancé par Me Vaval seule) consommera ces JSON.

RÈGLE DE FABRICATION — aucune clause n'est RETAPÉE : chaque citation est EXTRAITE du corps
qui la porte, par une sentinelle courte, et le script échoue si la sentinelle n'apparaît pas
exactement une fois. Une clause qui bouge d'un caractère fait tomber la construction.

    python3 scripts/data/marches-publics/graphe-construire.py
"""
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone

D = os.path.dirname(os.path.abspath(__file__))

# ─────────────────────────────────────────────────────────────────────────────
# Les 25 textes : n° du § 4 → corps préparé + clé `source` PROPOSÉE (§ 8.4).
# ⚠️ Les clés `source` sont une PROPOSITION : elles doivent être identiques à celles du
# script d'import. Aucune n'existe en base (mesuré le 27 août : 0 source commençant par
# « MARCHES »). Le préfixe une fois posé ne change plus.
# ─────────────────────────────────────────────────────────────────────────────
TEXTES = {
    '00': ('MARCHES_LOI_2009', 'prep-00-loi-mere-2009-corps.txt', "Loi du 10 juin 2009 fixant les règles générales relatives aux Marchés Publics et aux Conventions de Concession d'Ouvrage de Service Public"),
    '01': ('MARCHES_DECRET_2004', 'prep-01-decret-2004-corps.txt', 'Décret du 3 décembre 2004 fixant la réglementation des marchés publics de services, de fournitures et de travaux'),
    '02': ('MARCHES_ARR_MODALITES_2009', 'prep-02-arr-modalites-2009-corps.txt', "Arrêté du 26 octobre 2009 précisant les modalités d'application de la Loi du 10 juin 2009"),
    '03': ('MARCHES_ARR_MANUEL_2009', 'prep-03-arr-manuel-2009-corps.txt', 'Arrêté du 26 octobre 2009 sanctionnant le Manuel de Procédures'),
    '04': ('MARCHES_ARR_ORG_CNMP_2009', 'prep-04-arr-org-cnmp-2009-corps.txt', "Arrêté du 26 octobre 2009 déterminant les modalités d'organisation et de fonctionnement de la CNMP"),
    '05': ('MARCHES_ARR_DAO_TRAVAUX_2011', 'prep-05-arr-dao-travaux-2011-corps.txt', "Arrêté du 10 mai 2011 sanctionnant le dossier d'appel d'offres standard pour la réalisation de travaux"),
    '06': ('MARCHES_ARR_DTP_CONSULTANTS_2011', 'prep-06-arr-dtp-consultants-2011-corps.txt', 'Arrêté du 10 mai 2011 sanctionnant le dossier de demandes types de propositions pour des services de consultants et modèles de contrats'),
    '07': ('MARCHES_ARR_CCAG_2011', 'prep-07-arr-ccag-2011-corps.txt', 'Arrêté du 10 mai 2011 sanctionnant le CCAG applicable aux marchés publics de fournitures, de services, d’informatique et de bureautique'),
    '08': ('MARCHES_ARR_SEUILS_2012', 'prep-08-arr-seuils-2012-corps.txt', "Arrêté du 25 mai 2012 fixant les seuils de passation des marchés publics et les seuils d'intervention de la CNMP"),
    '09': ('MARCHES_ARR_CHARTE_2012', 'prep-09-arr-charte-ethique-2012-corps.txt', "Arrêté du 21 décembre 2012 sanctionnant la Charte d'Éthique"),
    '10': ('MARCHES_ARR_DP_FOURNITURES_2017', 'prep-10-arr-demande-prix-fournitures-2017-corps.txt', 'Arrêté du 30 août 2017 — demande de prix pour acquisition de fournitures'),
    '11': ('MARCHES_ARR_CELERES_2017', 'prep-11-arr-procedures-celeres-2017-corps.txt', "Arrêté du 30 août 2017 — procédures célères, état d'urgence déclaré"),
    '12': ('MARCHES_ARR_COTATIONS_TRAVAUX_2017', 'prep-12-arr-cotations-travaux-2017-corps.txt', 'Arrêté du 30 août 2017 — demande de cotations pour les contrats de travaux'),
    '13': ('MARCHES_ARR_ALLEGES_TRAVAUX_2017', 'prep-13-arr-alleges-travaux-2017-corps.txt', 'Arrêté du 30 août 2017 — procédures allégées, marchés de travaux'),
    '14': ('MARCHES_ARR_ALLEGES_FOURNITURES_2017', 'prep-14-arr-alleges-fournitures-2017-corps.txt', 'Arrêté du 30 août 2017 — procédures allégées, marchés de fournitures'),
    '15': ('MARCHES_ARR_ALLEGES_CONSULTANTS_2017', 'prep-15-arr-alleges-consultants-2017-corps.txt', 'Arrêté du 30 août 2017 — procédures allégées, sélection de consultants'),
    '16': ('MARCHES_ARR_DEFENSE_2019', 'prep-16-arr-defense-2019-corps.txt', "Arrêté du 9 janvier 2019 portant révision de l'arrêté du 30 août 2017 (défense ou sécurité nationale)"),
    '17': ('MARCHES_ARR_NOMINATION_CNMP_2019', 'prep-17-arr-nomination-cnmp-2019-corps.txt', 'Arrêté du 26 décembre 2019 nommant les membres de la CNMP'),
    '18': ('MARCHES_ARR_DEFENSE_2020', 'prep-18-arr-defense-2020-corps.txt', 'Arrêté du 12 février 2020 soumettant les marchés publics de défense ou de sécurité nationale au respect des principes de passation des marchés'),
    '19': ('MARCHES_ARR_MODIF_227_2020', 'prep-19-arr-modif-227-2020-corps.txt', "Arrêté du 9 décembre 2020 modifiant les articles 227 et 227.1 de l'Arrêté du 26 octobre 2009"),
    '20': ('MARCHES_ARR_COMPOSITION_CMMP_2020', 'prep-20-arr-composition-cmmp-2020-corps.txt', 'Arrêté du 9 décembre 2020 fixant la composition des CMMP et des CSMP'),
    '21': ('MARCHES_DECRET_BENEFICIAIRES_2021', 'prep-21-decret-beneficiaires-effectifs-2021-corps.txt', "Décret du 21 octobre 2021 établissant l'obligation d'identifier les Bénéficiaires effectifs"),
    '22': ('MARCHES_ARR_SEUILS_2021', 'prep-22-arr-seuils-sous-intervention-2021-corps.txt', "Arrêté du 21 octobre 2021 fixant les seuils de passation en dessous des seuils d'intervention de la CNMP"),
    '23': ('MARCHES_ARR_SEUILS_2022', 'prep-23-arr-seuils-2022-corps.txt', "Arrêté du 1er juin 2022 fixant les seuils de passation des marchés publics et les seuils d'intervention de la CNMP"),
    '24': ('MARCHES_CIRC_010_2023', 'prep-24-circulaire-010-2023-corps.txt', 'Circulaire n° 010 du 4 décembre 2023 relative aux procédures de passation et d’exécution des marchés publics'),
}

# Textes CITÉS mais ABSENTS du corpus — renvoi EN CLAIR, jamais en lien (§ 7, § 12.5).
ABSENTS = {
    'loi-1953-adjudication': {
        'designation': 'Loi du 16 septembre 1953 sur l’adjudication',
        'index_moniteur': None,
        'note': 'abrogée par l’article 99 de la Loi du 10 juin 2009 ; ni fichier ni entrée INDEX repérés',
    },
    'arr-2006-12-04-seuils': {
        'designation': 'Arrêté du 4 décembre 2006 révisant les seuils de passation des marchés publics',
        'index_moniteur': 'LM2006-117 (Le Moniteur n° 117 du 19 décembre 2006)',
        'note': 'abrogé par l’article 99 de la Loi du 10 juin 2009 ; absent du lot',
    },
    'arr-2009-09-05-seuils': {
        'designation': 'Arrêté du 5 septembre 2009 fixant les seuils de passation des marchés publics et les seuils d’intervention de la Commission Nationale des Marchés Publics suivant la nature des marchés',
        'index_moniteur': 'LM2009-95 (Le Moniteur n° 95 du 9 septembre 2009)',
        'note': 'remplacé EN FAIT par l’arrêté du 25 mai 2012, qui ne l’abroge pas nommément ; absent du lot',
    },
    'arr-2017-08-30-defense': {
        'designation': 'Arrêté du 30 août 2017 fixant les règles de procédures de passation de certains marchés de travaux, de fournitures, de prestations intellectuelles et de services dans les domaines de défense ou de sécurité nationale',
        'index_moniteur': 'LM2017-143 (Le Moniteur n° 143 du 4 septembre 2017)',
        'note': 'RACINE de la branche défense — révisé par l’arrêté du 9 janvier 2019, absent du lot et sans fac-similé repéré',
    },
    'circ-008-2022': {
        'designation': 'Circulaire n° 008 du Premier Ministre en date du 5 septembre 2022',
        'index_moniteur': None,
        'note': 'citée deux fois par la Circulaire 010 (paragraphes 4 à 6 ; paragraphe 6) ; absente du lot',
    },
    'arr-2012-12-21-docs-standards': {
        'designation': 'Arrêté du 21 décembre 2012 sanctionnant les documents standards relatifs à l’évaluation des offres et au suivi de l’exécution des marchés publics',
        'index_moniteur': 'LM2013-SP1 (Le Moniteur Spécial n° 1 du 9 janvier 2013)',
        'note': 'frère de la Charte d’Éthique, même date d’adoption ; absent du lot',
    },
    'arretes-2011-05-10-autres': {
        'designation': 'les sept autres arrêtés du 10 mai 2011 énumérés aux visas de la Charte d’Éthique (CCAG travaux ; DAO fournitures ; DAO informatique et bureautique ; CCAG fournitures/services/informatique/bureautique — voir n° 7 ; CCAG prestations intellectuelles ; DAO prestation de services ; DAO deux étapes concessions ; CCAG concessions)',
        'index_moniteur': 'LM2011-SP3 (Le Moniteur Spécial n° 3 du 13 mai 2011), 4 entrées « Tome I à IV »',
        'note': 'la série complète compte DIX arrêtés ; le lot en porte trois (n° 5, 6, 7)',
    },
    'decret-1989-10-23': {
        'designation': 'Décret du 23 octobre 1989 relatif aux normes et conditions de passation des marchés par les pouvoirs publics',
        'index_moniteur': 'LM1989-91',
        'note': 'visé par le Décret du 3 décembre 2004 ; hors périmètre de la livraison',
    },
}


def lire(fichier):
    p = os.path.join(D, fichier)
    with open(p, encoding='utf-8') as f:
        t = f.read()
    return t


CORPS = {n: lire(f) for n, (_, f, _) in TEXTES.items()}
ECHECS = []


def clause(num, sentinelle, lignes=1):
    """Extrait `lignes` lignes du corps du texte `num`, à partir de la ligne qui contient
    `sentinelle`. Échoue si la sentinelle n'apparaît pas sur EXACTEMENT une ligne."""
    lg = CORPS[num].split('\n')
    hits = [i for i, l in enumerate(lg) if sentinelle in l]
    if len(hits) != 1:
        ECHECS.append(f'texte n° {num} : sentinelle « {sentinelle[:60]}… » trouvée {len(hits)} fois (1 attendue)')
        return {'texte': None, 'fichier': TEXTES[num][1], 'ligne': None, 'sentinelle': sentinelle}
    i = hits[0]
    txt = '\n'.join(lg[i:i + lignes])
    return {
        'texte': txt,
        'fichier': TEXTES[num][1],
        'ligne': i + 1,
        'lignes': lignes,
        'sentinelle': sentinelle,
        'md5': hashlib.md5(txt.encode()).hexdigest()[:10],
    }


def A(id_, de, vers, kind, fondement, cl, justification, ancre_cible=None, ancre_clause=None,
      note='', vers_absent=None, position=0):
    """Une arête. `vers` = n° de texte du corpus ; `vers_absent` = clé de ABSENTS.

    ⚠️ DEUX ancres, à ne jamais confondre — les mélanger fabrique un lien qui pointe à côté :
      · `ancre_cible`  → `CrossRef.toAnchor` : un article DU DOCUMENT VISÉ (#art-N chez lui) ;
      · `ancre_clause` → l'article DU DOCUMENT SOURCE où la clause est écrite. Il n'entre PAS
        dans le CrossRef : il est nommé dans la note (« article 99 de la Loi »), là où il se lit.
    """
    if (vers is None) == (vers_absent is None):
        raise SystemExit(f'{id_} : il faut une cible et une seule (corpus OU absente)')
    if ancre_cible and vers is None:
        raise SystemExit(f'{id_} : une cible ABSENTE ne peut pas porter d’ancre — renvoi en clair')
    e = {
        'id': id_,
        'de': {'texte': de, 'source': TEXTES[de][0], 'libelle': TEXTES[de][2]},
        'kind': kind,
        'fondement': fondement,
        'clause_citee': cl,
        'ancre_de_la_clause_chez_la_source': ancre_clause,
        'justification_du_kind': justification,
        'crossRef': {
            'fromSource': TEXTES[de][0],
            'toSource': TEXTES[vers][0] if vers else None,
            'toType': None,
            'toNumber': None,
            'toAnchor': ancre_cible,
            'toLabel': None if vers else ABSENTS[vers_absent]['designation'],
            'kind': kind,
            'source': 'EDITORIAL',
            'position': position,
            'note': None,  # rempli plus bas
        },
    }
    if vers:
        e['vers'] = {'texte': vers, 'source': TEXTES[vers][0], 'libelle': TEXTES[vers][2], 'presence': 'CORPUS'}
    else:
        e['vers'] = dict(ABSENTS[vers_absent], presence='ABSENT', cle=vers_absent)
    # La note du CrossRef PORTE la clause : c'est elle qui justifie le kind sur la fiche.
    corps_note = note.strip()
    cite = (cl or {}).get('texte')
    bloc = f'{fondement} : « {cite} »' if cite else fondement
    e['crossRef']['note'] = (corps_note + ' — ' if corps_note else '') + bloc
    if e['vers']['presence'] == 'ABSENT':
        e['crossRef']['note'] += (
            ' [Texte non versé au corpus : renvoi en clair, sans lien. '
            + (f"Indexé au Moniteur : {e['vers']['index_moniteur']}. " if e['vers'].get('index_moniteur') else '')
            + e['vers']['note'] + ']'
        )
    return e


# ═════════════════════════════════════════════════════════════════════════════
# § 6 — LES ARÊTES
# ═════════════════════════════════════════════════════════════════════════════
aretes = []

# ── A. Dispositif nominatif : kind FERME ──────────────────────────────────────
aretes.append(A(
    'A01', '00', '01', 'ABROGE', 'dispositif (article 99 de la Loi)',
    clause('00', 'Article 99.-'),
    "L'article 99 est l'ACTE d'abrogation et il NOMME le décret. Le considérant de la loi le "
    "nomme aussi : c'est le MOTIF, il ne fonde rien (§ 6, doctrine maison). L'article 97 n'abroge "
    "pas : il maintient le décret en vigueur pour les marchés et avenants déjà approuvés — "
    "clause de TRANSITION.",
    note="Abrogation nommée au dispositif de la loi-mère. Corroborée à l'intérieur du lot par la "
         "clause d'entrée en vigueur commune aux trois arrêtés du 26 octobre 2009 (org/fonct art. 51 ; "
         "modalités art. 241 ; manuel art. 2), qui datent leur entrée en vigueur de « la cessation des "
         "effets » du décret de 2004 « telle que prévue par l'article 97 »",
    ancre_clause='art-99',
))
aretes.append(A(
    'A02', '00', None, 'ABROGE', 'dispositif (article 99 de la Loi)',
    clause('00', 'Article 99.-'),
    "Même clause, même acte : l'article 99 nomme la Loi de 1953 au titre des textes abrogés.",
    vers_absent='loi-1953-adjudication', ancre_clause='art-99', position=1,
))
aretes.append(A(
    'A03', '00', None, 'ABROGE', 'dispositif (article 99 de la Loi)',
    clause('00', 'Article 99.-'),
    "Même clause, même acte : l'article 99 nomme l'Arrêté du 4 décembre 2006 au titre des textes abrogés.",
    vers_absent='arr-2006-12-04-seuils', ancre_clause='art-99', position=2,
))
aretes.append(A(
    'A04', '19', '02', 'MODIFIE', 'dispositif (article 2 de l’Arrêté)',
    clause('19', 'Article 2.-\tLes modifications apportées', 12),
    "L'article 2 réécrit deux articles nommés et donne leur nouvelle rédaction entre guillemets : "
    "c'est du dispositif, donc MODIFIE. Le considérant qui annonce la modification n'est pas invoqué.",
    note="Modifie les articles 227 et 227-1 de l'arrêté modalités. ⚠️ Le modificateur écrit « 227.1 » "
         "à POINT là où le texte de base écrit « 227-1 » à TRAIT D'UNION : chaque graphie reste chez "
         "elle, l'ancre est art-227-1",
    ancre_cible='art-227', ancre_clause='art-2',
))
aretes.append(A(
    'A04b', '19', '02', 'MODIFIE', 'dispositif (article 2 de l’Arrêté)',
    clause('19', 'L’article 227.1 est modifié comme suit :', 3),
    "Second article réécrit par la même clause. Une arête par article visé : la fiche de "
    "l'arrêté modalités doit pouvoir montrer, sous CHACUN des deux articles, le texte qui l'a "
    "réécrit. ⚠️ Graphie « 227.1 » à POINT au modificateur, « 227-1 » à TRAIT D'UNION au texte "
    "de base ; l'ancre commune est art-227-1.",
    ancre_cible='art-227-1', ancre_clause='art-2', position=1,
))
aretes.append(A(
    'A05', '16', None, 'MODIFIE', 'dispositif (article 1er de l’arrêté)',
    clause('16', 'Article 1er.-\tLe présent arrêté porte révision'),
    "« porte révision de » au dispositif : acte de modification. La cible est ABSENTE du corpus — "
    "renvoi en clair, aucun lien.",
    vers_absent='arr-2017-08-30-defense', ancre_clause='art-1',
))
aretes.append(A(
    'A06', '18', '16', 'ABROGE', 'dispositif (article 15 de l’arrêté)',
    clause('18', 'Article 15.-\tLe présent arrêté remplace'),
    "« remplace » un arrêté NOMMÉ, au dispositif : remplacement intégral, donc ABROGE. "
    "L'arrêté de 2019 avait, lui, une clause d'abrogation seulement GÉNÉRIQUE (son art. 15 : "
    "« abroge tous arrêtés… contraires »), qui ne nomme personne.",
    ancre_clause='art-15',
))
aretes.append(A(
    'A07', '21', '18', 'MODIFIE', 'dispositif (article 16.1, alinéa 2, du Décret)',
    clause('21', "annule et remplace la définition contenue dans l'article 2"),
    "« annule et remplace » au dispositif, cible NOMMÉE (article 2 de l'Arrêté du 12 février 2020) : "
    "MODIFIE. ⚠️ L'ÉTENDUE n'est pas tranchée (§ 13.4) : la clause vise « la définition », et "
    "l'article 2 de 2020 porte, après sa définition, une liste de DOUZE catégories (mesurée ; le § 7 "
    "du prompt en annonce onze — onze est le compte de la rédaction de 2019, la douzième catégorie "
    "étant le cas « électricité » ajouté en 2020). Le corps de l'article 2 n'est PAS substitué.",
    note="Pastille + note seulement, sans substitution du corps, en attente de la réponse § 13.4",
    ancre_cible='art-2', ancre_clause='art-16-1',
))

# ── B. Remplacements IMPLICITES : aucune abrogation nominative → CITE + note ──
aretes.append(A(
    'A08', '23', '22', 'CITE', 'dispositif (articles 7 et 7-1 de l’Arrêté)',
    clause('23', 'Les marchés publics sont soumis aux seuils fixés par l’Arrêté du 21 octobre 2021'),
    "Le dispositif DATE la fin de l'empire de l'arrêté de 2021 (30 septembre 2022) et l'entrée en "
    "vigueur des nouveaux seuils (1er octobre 2022, art. 7) ; il ne l'ABROGE nulle part nommément. "
    "L'article 10 ne « rapporte » que « tout Arrêté… contraire », sans nommer. Le kind reste donc "
    "CITE ; ABROGE relèverait d'une décision d'éditeur (§ 13.3), pas du texte.",
    note="Remplacement EN FAIT au 1er octobre 2022. ⚠️ SIC conservé : l'article 7-1 désigne l'arrêté "
         "du 21 octobre 2021 sous l'intitulé de celui de 2012 (« …et les seuils d'intervention »), "
         "alors que le VISA du même arrêté (« Vu l'Arrêté du 21 octobre 2021 fixant les seuils de "
         "passation des marchés publics en dessous des seuils d'intervention de la CNMP ») le désigne "
         "correctement. Écart d'intitulé relevé, non tranché (§ 13.10)",
    ancre_clause='art-7-1',
))
aretes.append(A(
    'A09', '23', '08', 'CITE', 'considérant (révision à la baisse des seuils de contrôle a priori)',
    clause('23', 'Considérant la nécessité de réviser à la baisse les seuils de contrôle a priori'),
    "Le texte qui nomme l'arrêté de 2012 est un CONSIDÉRANT : il ne peut pas fonder un ABROGE "
    "(§ 6, interdit n° 9). Le dispositif de 2022 occupe le même champ mais n'abroge personne "
    "nommément.",
    note="Occupation complète du champ, sans abrogation nominative — statut de l'arrêté de 2012 à "
         "décider par l'éditeur (§ 13.3)",
    position=1,
))
aretes.append(A(
    'A10', '08', None, 'CITE', 'visa (l’arrêté de 2012 n’a AUCUNE clause d’abrogation)',
    clause('08', "Vu l'Arrêté du 5 septembre 2009 fixant les seuils de passation des marchés publics ;"),
    "Simple VISA. Mesuré : l'article 8 de l'arrêté de 2012 est une clause d'exécution "
    "(« sera imprimé, publié et exécuté ») — il n'abroge rien. Aucun arrêté de seuils de la série "
    "n'abroge nommément son prédécesseur.",
    vers_absent='arr-2009-09-05-seuils',
))

# ── C. Confirmations, compléments, citations (kind CITE) ─────────────────────
aretes.append(A(
    'A11', '22', '08', 'CITE', 'dispositif (article 6 de l’Arrêté) — confirmation PARTIELLE',
    clause('22', "Les dispositions de l'Arrêté du 25 mai 2012 précité relatives aux seuils"),
    "Le dispositif MAINTIENT expressément une partie de l'arrêté de 2012 (les seuils d'intervention). "
    "Confirmer n'est ni modifier ni abroger : CITE. ⚠️ Le même arrêté porte à son article 8 une "
    "clause générique (« rapporte tout autre Arrêté ou disposition d'Arrêté qui lui est contraire ») "
    "qui ne nomme personne et ne change pas le kind.",
    ancre_clause='art-6',
))
aretes.append(A(
    'A12', '20', '04', 'CITE', 'considérant (« combler ce vide et… compléter »)',
    clause('20', 'Considérant qu’il y a lieu de combler ce vide'),
    "Le mot « compléter » est dans un CONSIDÉRANT, jamais au dispositif : le dispositif de l'arrêté "
    "de composition ne réécrit aucun article de l'arrêté de 2009. Considérant → CITE (§ 6).",
    note="Complément énoncé en motif, pas de modification textuelle de l'arrêté du 26 octobre 2009",
))
aretes.append(A(
    'A13', '16', '05', 'CITE', 'dispositif (article 14 de l’arrêté)',
    clause('16', 'Article 14.-\tPour passer les marchés soumis au présent arrêté'),
    "Renvoi d'usage aux documents standard du 10 mai 2011 (Spécial n° 3) : usage, non modification.",
    note="La clause vise « les documents standards, pris par arrêté en Conseil des Ministres le "
         "10 mai 2011 » — collectivement. Elle est reprise à l'identique à l'article 14 de l'arrêté "
         "du 12 février 2020. Trois des dix arrêtés de la série sont au corpus (n° 5, 6, 7) ; les "
         "sept autres sont renvoyés en clair",
))
aretes.append(A('A14', '16', '06', 'CITE', 'dispositif (article 14 de l’arrêté)', clause('16', 'Article 14.-\tPour passer les marchés soumis au présent arrêté'), "Même clause, autre arrêté de la même série présent au corpus.", position=1))
aretes.append(A('A15', '16', '07', 'CITE', 'dispositif (article 14 de l’arrêté)', clause('16', 'Article 14.-\tPour passer les marchés soumis au présent arrêté'), "Même clause, autre arrêté de la même série présent au corpus.", position=2))
aretes.append(A('A16', '18', '05', 'CITE', 'dispositif (article 14 de l’arrêté)', clause('18', "Article 14.-\tPour passer les marchés soumis au présent arrêté"), "Clause identique à celle de 2019 ; usage des documents standard.", position=0))
aretes.append(A('A17', '18', '06', 'CITE', 'dispositif (article 14 de l’arrêté)', clause('18', "Article 14.-\tPour passer les marchés soumis au présent arrêté"), "Clause identique à celle de 2019 ; usage des documents standard.", position=1))
aretes.append(A('A18', '18', '07', 'CITE', 'dispositif (article 14 de l’arrêté)', clause('18', "Article 14.-\tPour passer les marchés soumis au présent arrêté"), "Clause identique à celle de 2019 ; usage des documents standard.", position=2))

aretes.append(A(
    'A19', '09', '05', 'CITE', 'visa (énumération faisant foi des DIX arrêtés du 10 mai 2011)',
    clause('09', 'Vu l’arrêté du 10 mai 2011 sanctionnant le dossier d’appel d’offres standard pour la réalisation de travaux'),
    "Visa nominatif du premier des dix arrêtés de la série ; l'objet du visa est exactement celui que "
    "sanctionne le texte n° 5 (« le dossier d'appel d'offres standard pour la réalisation de travaux »).",
))
aretes.append(A(
    'A20', '09', '06', 'CITE', 'visa (énumération faisant foi des DIX arrêtés du 10 mai 2011)',
    clause('09', 'Vu l’arrêté du 10 mai 2011 sanctionnant le dossier de demandes types de propositions'),
    "Visa nominatif ; objet identique à celui que sanctionne le dispositif du texte n° 6.",
    position=1,
))
aretes.append(A(
    'A21', '09', '07', 'CITE', 'visa (énumération faisant foi des DIX arrêtés du 10 mai 2011)',
    clause('09', 'Vu l’arrêté du 10 mai 2011 sanctionnant le Cahier des Clauses Administratives Générales (CCAG) applicables aux marchés publics de fournitures'),
    "Visa nominatif ; objet identique à celui que sanctionne le dispositif du texte n° 7 — dont le NOM "
    "DE FICHIER annonçait le Tome IV « prestation de services » (§ 9.2 : identification au corps).",
    position=2,
))
aretes.append(A(
    'A22', '09', None, 'CITE', 'visas (les sept autres arrêtés du 10 mai 2011)',
    clause('09', 'Vu l’arrêté du 10 mai 2011 sanctionnant le Cahier des Clauses Administratives Générales (CCAG) applicables aux conventions de concession'),
    "Les dix visas successifs de la Charte font foi de la composition de la série ; sept de ces "
    "arrêtés ne sont pas au lot.",
    vers_absent='arretes-2011-05-10-autres', position=3,
))
aretes.append(A(
    'A23', '02', '09', 'CITE', 'dispositif (article 240 — disposition transitoire)',
    clause('02', 'Article 240.-'),
    "L'article 240 ANNONCE les documents standard et la charte d'éthique à venir ; il ne modifie rien. "
    "L'annonce vaut renvoi vers les textes qui l'ont exécutée.",
    ancre_clause='art-240',
))
aretes.append(A('A24', '02', '05', 'CITE', 'dispositif (article 240 — disposition transitoire)', clause('02', 'Article 240.-'), "Même clause : l'annonce vise aussi les dossiers standard d'appel d'offres.", ancre_clause='art-240', position=1))
aretes.append(A('A25', '02', '06', 'CITE', 'dispositif (article 240 — disposition transitoire)', clause('02', 'Article 240.-'), "Même clause.", ancre_clause='art-240', position=2))
aretes.append(A('A26', '02', '07', 'CITE', 'dispositif (article 240 — disposition transitoire)', clause('02', 'Article 240.-'), "Même clause : l'annonce vise aussi les cahiers des clauses administratives générales.", ancre_clause='art-240', position=3))

aretes.append(A(
    'A27', '22', '10', 'CITE', 'visa + considérant (les arrêtés du 30 août 2017)',
    clause('22', 'Vu les Arrêtés du 30 août 2017'),
    "Visa collectif de la série 2017 : les procédures de 2017 reçoivent de l'arrêté de 2021 leurs "
    "tranches de montants. Simple adossement → CITE.",
))
for i, n in enumerate(['12', '13', '14', '15'], start=1):
    aretes.append(A(f'A{27 + i:02d}', '22', n, 'CITE', 'visa + considérant (les arrêtés du 30 août 2017)', clause('22', 'Vu les Arrêtés du 30 août 2017'), "Même visa collectif.", position=i))

aretes.append(A(
    'A32', '24', '20', 'CITE', 'prose (directive n° 1 de la Circulaire)',
    clause('24', 'en respectant les dispositions de l’Arrêté du 9 décembre 2020 fixant la composition'),
    "La Circulaire ne modifie rien ; elle prescrit l'application. ⚠️ Deux arrêtés portent la date du "
    "9 décembre 2020 : la Circulaire cite ici, en toutes lettres, celui qui fixe la COMPOSITION des "
    "CMMP/CSMP (texte n° 20) — et non le modificatif des articles 227/227-1 (texte n° 19). "
    "Renvoi précis : « les articles 4 et 6 de l'Arrêté du 9 décembre 2020 précité ».",
))
aretes.append(A(
    'A33', '24', '02', 'CITE', 'prose (directives n° 2, 8 et 9 de la Circulaire)',
    clause('24', 'l’article 5-2 de l’Arrêté du 26 octobre 2009 précisant les modalités'),
    "Renvois d'application, sans modification : art. 5-2, art. 46 et 47, Chapitre III du Titre III.",
    ancre_cible='art-5-2', position=1,
))
aretes.append(A(
    'A34', '24', '21', 'CITE', 'prose (directives n° 5, 16 et 21 de la Circulaire)',
    clause('24', 'des articles 2, 3 et 6 du Décret du 21 octobre 2021'),
    "Renvois d'application aux art. 2, 3, 6, 15 et 16.1 du décret — graphie « 16.1 » à point, sic.",
    position=2,
))
aretes.append(A(
    'A35', '24', '18', 'CITE', 'prose (directives n° 16 et 17 de la Circulaire)',
    clause('24', 'du 2) de l’article 6 de l’Arrêté du 12 février 2020'),
    "Renvois d'application : art. 2, « 2) de l'article 6 », « f) du 1) de l'article 6 », art. 14.",
    ancre_cible='art-6', position=3,
))
aretes.append(A(
    'A36', '24', '11', 'CITE', 'prose (directive n° 13 de la Circulaire)',
    clause('24', 'conformément aux dispositions de l’Arrêté du 30 août 2017 sanctionnant le Manuel de procédures célères'),
    "La Circulaire nomme ici, par son OBJET, l'un des six arrêtés du 30 août 2017 : celui des "
    "procédures célères (texte n° 11, Spécial n° 26). Renvoi résolu, non collectif.",
    position=4,
))
aretes.append(A(
    'A37', '24', None, 'CITE', 'prose (directives n° 2 et 19 de la Circulaire)',
    clause('24', 'conformément aux paragraphes 4 à 6 de la Circulaire N°. 008'),
    "Citée deux fois (« paragraphes 4 à 6 » puis « paragraphe 6 ») ; absente du corpus.",
    vers_absent='circ-008-2022', position=5,
))
aretes.append(A(
    'A38', '24', '05', 'CITE', 'prose (directive n° 18 de la Circulaire)',
    clause('24', 'des documents standards, pris par arrêté du 10 mai 2011'),
    "Renvoi collectif aux documents standard du Spécial n° 3 du 13 mai 2011.",
    position=6,
))

# ── D. Le fondement commun : tout le lot s'adosse à la loi-mère ──────────────
# Sentinelles RELEVÉES une à une sur les corps préparés — pas de motif générique : deux textes
# écrivent « 10 Juin » avec une majuscule (sic), un troisième n'a pas de visa du tout.
FONDEMENTS = {
    '02': ('Vu la Loi du 10 Juin 2009', "l'arrêté modalités est pris pour l'application de la Loi ; son considérant précise « que l'article 98 de ladite Loi prévoit que les modalités d'application en sont établies par Arrêté pris en Conseil des Ministres ». ⚠️ SIC : le visa écrit « 10 Juin » avec une majuscule"),
    '03': ('Vu la Loi du 10 Juin 2009', "sanctionne le manuel de procédures que « la Loi… prévoit en son article 64 ». ⚠️ SIC : le visa écrit « 10 Juin » avec une majuscule"),
    '04': ('Vu la Loi du 10 juin 2009', "arrêté d'organisation pris sur le fondement de l'article 15 de la Loi (cité au considérant)"),
    '05': ('Vu la loi du 10 juin 2009', "sanctionne un document standard prévu par l'article 42 de la Loi (cité au considérant)"),
    '06': ('Vu la loi du 10 juin 2009', "sanctionne un document standard prévu par l'article 42 de la Loi (cité au considérant)"),
    '08': ('Vu la Loi du 10 juin 2009', "seuils : le considérant renvoie à l'article 30 et aux articles 60 et 62 de la Loi"),
    '09': ('Vu la loi du 10 juin 2009', "charte d'éthique annoncée par l'article 240 de l'arrêté modalités"),
    '10': ('Vu la loi du 10 juin 2009', 'procédures sous les seuils — article 27.1 de la Loi, cité au considérant'),
    '11': ('Vu la loi du 10 juin 2009', "procédures célères — état d'urgence déclaré"),
    '12': ('Vu la loi du 10 juin 2009', 'procédures sous les seuils — article 27.1 de la Loi, cité au considérant'),
    '13': ('Vu la loi du 10 juin 2009', 'procédures sous les seuils — article 27.1 de la Loi, cité au considérant'),
    '14': ('Vu la loi du 10 juin 2009', 'procédures sous les seuils — article 27.1 de la Loi, cité au considérant'),
    '15': ('Vu la loi du 10 juin 2009', "prestations intellectuelles — article 27 de la Loi, cité au considérant"),
    '16': ('Vu la loi du 10 juin 2009', "marchés de défense — le visa précise « notamment son article 96 »"),
    '17': ('Vu la loi du 10 juin 2009', 'nomination des membres de la CNMP prévue par la Loi'),
    '18': ('Vu la loi du 10 juin 2009', "marchés de défense — le visa précise « notamment son article 96 »"),
    '20': ('Vu la Loi du 10 juin 2009', "commissions prévues par l'article 6 de la Loi, cité au considérant"),
    '21': ('Vu la Loi du 10 juin 2009', 'décret pris dans le champ de la Loi'),
    '22': ('Vu la Loi du 10 juin 2009', "seuils — article 30 de la Loi"),
    '23': ('Vu la Loi du 10 juin 2009', "seuils — le considérant renvoie à l'article 30 et à l'article 62 de la Loi"),
    '24': ('En référence à la Loi du 10 juin 2009', "circulaire d'application ; la Loi ouvre la phrase liminaire"),
}
for k, (sent, pourquoi) in FONDEMENTS.items():
    aretes.append(A(
        f'F{k}', k, '00', 'CITE', 'visa / référence liminaire',
        clause(k, sent),
        f'Fondement du texte : {pourquoi}. Un visa n’est ni une modification ni une abrogation.',
        note='Renvoi de fondement vers la loi-mère', position=90,
    ))
# Deux textes n'ont AUCUN visa de la loi-mère — mesuré, à ne pas fabriquer :
#   n° 07 : la page 2 du Moniteur manque au scan source, en-tête, visas et premiers
#           considérants absents (§ 4.3) — le texte reprend au milieu des considérants ;
#   n° 19 : le modificatif ne vise que l'arrêté qu'il modifie et la Charte ; la loi n'apparaît
#           que dans l'INTITULÉ de l'arrêté modifié.
aretes.append(A(
    'F19', '19', '02', 'CITE', 'visa',
    clause('19', "Vu l’Arrêté du 26 octobre 2009 précisant les modalités d’application"),
    "Le modificatif VISE l'arrêté qu'il modifie ; le visa (CITE) et la clause de modification "
    "(MODIFIE, arête A04) sont deux arêtes distinctes, à ne pas confondre.",
    note="Ce texte ne vise PAS la loi-mère : mesuré, aucun « Vu la Loi du 10 juin 2009 » dans son corps",
    position=90,
))
aretes.append(A(
    'F19b', '19', '09', 'CITE', 'visa',
    clause('19', "Vu l’Arrêté du 21 décembre 2012 sanctionnant la Charte d’Éthique"),
    "Visa nominatif de la Charte d'Éthique — présente au corpus.",
    position=91,
))
# Les visas de l'arrêté du 5 septembre 2009 (absent du corpus) : mesurés dans DEUX autres textes.
aretes.append(A(
    'F02b', '02', None, 'CITE', 'visa',
    clause('02', "Vu l’Arrêté du 5 septembre 2009 fixant les seuils de passation des Marchés Publics"),
    "Visa nominatif de l'arrêté de seuils de 2009, absent du corpus.",
    vers_absent='arr-2009-09-05-seuils', position=93,
))
aretes.append(A(
    'F03b', '03', None, 'CITE', 'visa',
    clause('03', "Vu l’Arrêté du 5 septembre 2009 fixant les seuils de passation des marchés publics"),
    "Visa nominatif de l'arrêté de seuils de 2009, absent du corpus.",
    vers_absent='arr-2009-09-05-seuils', position=93,
))
aretes.append(A(
    'F05b', '05', None, 'CITE', 'visa',
    clause('05', "Vu l'arrêté du 5 septembre 2009 fixant les seuils de passation des marchés publics"),
    "Visa nominatif de l'arrêté de seuils de 2009, absent du corpus.",
    vers_absent='arr-2009-09-05-seuils', position=93,
))
aretes.append(A(
    'F06b', '06', None, 'CITE', 'visa',
    clause('06', "Vu l’arrêté du 5 septembre 2009 fixant les seuils de passation des marchés publics"),
    "Visa nominatif de l'arrêté de seuils de 2009, absent du corpus.",
    vers_absent='arr-2009-09-05-seuils', position=93,
))
# Les arrêtés du 26 octobre 2009 se visent entre eux (mesuré).
aretes.append(A(
    'F02c', '02', '04', 'CITE', 'visa',
    clause('02', "Vu l’Arrêté du 26 octobre 2009 déterminant les modalités d’organisation"),
    "Visa nominatif de l'arrêté d'organisation de la CNMP, du même jour.",
    position=94,
))
aretes.append(A(
    'F03c', '03', '04', 'CITE', 'visa',
    clause('03', "Vu l’Arrêté du 26 octobre 2009 déterminant les modalités d’organisation"),
    "Visa nominatif de l'arrêté d'organisation de la CNMP, du même jour.",
    position=94,
))
aretes.append(A(
    'F03d', '03', '02', 'CITE', 'visa',
    clause('03', "Vu l’Arrêté du 26 octobre 2009 précisant les modalités d’application"),
    "Visa nominatif de l'arrêté modalités, du même jour.",
    position=95,
))
# Le décret de 2004 est ANTÉRIEUR à la loi : il ne la vise pas. Il vise, lui, la loi de 1953
# qu'il n'abroge pas nommément (son art. 117 est une clause générique).
aretes.append(A(
    'F01', '01', None, 'CITE', 'visa',
    clause('01', "Vu la Loi du 16 septembre 1953 sur l'Adjudication;"),
    "Le décret de 2004 VISE la loi de 1953 ; son article 117 n'abroge que « toutes Lois… qui lui "
    "est contraire » (sic — accord singulier du J.O.), sans nommer personne.",
    vers_absent='loi-1953-adjudication', position=91,
))
aretes.append(A(
    # F<NN> = NN est le n° du texte SOURCE, suffixes b/c/d pour ses arêtes suivantes.
    # Était 'F02' — collision avec l'arête du texte n° 02 (D6, contrôle du 28 août).
    'F01b', '01', None, 'CITE', 'visa',
    clause('01', 'Vu le Décret du 23 octobre 1989 relatif aux normes et conditions de Passation'),
    "Visa du décret de 1989, ancêtre du régime ; hors périmètre de la livraison.",
    vers_absent='decret-1989-10-23', position=92,
))
aretes.append(A(
    # Était 'F03' — collision avec l'arête du texte n° 03 (D6, contrôle du 28 août).
    # Le texte n° 02 porte déjà F02, F02b, F02c : celle-ci est la quatrième.
    'F02d', '02', None, 'CITE', 'dispositif (article 240 — disposition transitoire)',
    clause('02', 'Article 240.-'),
    "L'article 240 annonce aussi les « documents normalisés » — l'arrêté du 21 décembre 2012 qui les "
    "sanctionne (LM2013-SP1) n'est pas au lot.",
    vers_absent='arr-2012-12-21-docs-standards', ancre_clause='art-240', position=4,
))


# ═════════════════════════════════════════════════════════════════════════════
# § 7 — PASTILLES ET REPLIS
# ═════════════════════════════════════════════════════════════════════════════
def bloc(num, debut, fin_exclue):
    """Bloc de lignes [debut, fin_exclue[ du corps, bornes données par leur PREMIÈRE ligne."""
    lg = CORPS[num].split('\n')
    i = [k for k, l in enumerate(lg) if l.startswith(debut)]
    j = [k for k, l in enumerate(lg) if l.startswith(fin_exclue)]
    if len(i) != 1 or len(j) != 1:
        ECHECS.append(f'texte n° {num} : bornes « {debut} » ({len(i)}) / « {fin_exclue} » ({len(j)}) — 1 et 1 attendues')
        return None
    return '\n'.join(lg[i[0]:j[0]])


anc_227 = bloc('02', 'Article 227.-', 'Article 227-1.-')
anc_227_1 = bloc('02', 'Article 227-1.-', 'Article 227-2.-')
nou_227 = bloc('19', '« Article 227.- ', 'L’article 227.1 est modifié')
nou_227_1 = bloc('19', '« Article 227.1.- ', 'Article 3.-')

# ── Le déguillemetage, et pourquoi il n'est pas cosmétique ───────────────────
# Le modificateur encadre CHAQUE paragraphe de la rédaction nouvelle : « … ». Rendu tel quel
# dans `ArticleVersion.body`, le lecteur affiche une tête EN DOUBLE — mesuré en rejouant la
# chaîne du lecteur (src/lib/legislation/segment.ts `applyAmendments`, puis LEAD_ART dans
# src/components/AnnotatedText.tsx) :
#     « Article 227.- « Article 227.- Le Comité de Règlement des Différends… »
# parce que `applyAmendments` ne reconnaît pas une tête d'article derrière un guillemet et
# rajoute la sienne. L'opération ci-dessous retire le « ouvrant et le » fermant DE BORD, et
# rien d'autre : elle est réversible caractère par caractère, et son résultat est contrôlé.
LEAD_ART = re.compile(
    r'^(?:art(?:icle)?s?\.?|section)\s+(?:premier|\d{1,4}(?:\s*(?:er|ère))?'
    r'(?:\s*(?:bis|ter|quater))?(?:[.\-]\d+)*)\s*[.)\-–]*\s*', re.I)


def deguillemeter(bloc_cite):
    """Retire le « de début et le » de fin SUR CHAQUE LIGNE — jamais un autre caractère."""
    if bloc_cite is None:
        return None
    out = []
    for l in bloc_cite.split('\n'):
        m = re.sub(r'^«\s*', '', l)
        m = re.sub(r'\s*»(\s*\.)?$', lambda g: '.' if g.group(1) else '', m)
        out.append(m)
    return '\n'.join(out)


def rendu_lecteur(body, label):
    """Rejoue la chaîne du lecteur sur la PREMIÈRE ligne : ce que verra Me Vaval."""
    if body is None:
        return None
    txt = body.strip()
    prefixe = '' if re.match(r'^(article|art)\b', txt, re.I) else f'{label}.- '
    segment = (prefixe + txt).split('\n')[0]
    return {'apres_applyAmendments': segment, 'corps_affiche_sous_le_badge': LEAD_ART.sub('', segment).lstrip()}


def sans_tete(bloc_art):
    """Retire la tête « Article N.- » d'un texte d'article — convention des replis de la
    maison (_apply-notariat-overlays.ts, _apply-decret-agressions-2005.ts) : le libellé est
    affiché à part, le répéter dans le repli le ferait lire deux fois."""
    if bloc_art is None:
        return None
    lignes = bloc_art.split('\n')
    lignes[0] = LEAD_ART.sub('', lignes[0]).lstrip()
    return '\n'.join(lignes)


nou_227_dg, nou_227_1_dg = deguillemeter(nou_227), deguillemeter(nou_227_1)
anc_227_st, anc_227_1_st = sans_tete(anc_227), sans_tete(anc_227_1)

pastilles = {
    'principe': (
        "La version EN VIGUEUR est celle qui s'affiche ; l'ancienne rédaction se replie "
        "(annotations.oldVersions) et se date (ArticleVersion). Patron : Code civil / Code de commerce "
        "(scripts/_apply-notariat-overlays.ts, scripts/_apply-electronique-cc.ts). "
        "Référence = titre complet. Aucune citation normalisée."
    ),
    'statuts_de_document': [
        {
            'texte': '01',
            'source': TEXTES['01'][0],
            'status': 'ABROGE',
            'abrogatedByNumber': None,
            'abroge_par': {'texte': '00', 'source': TEXTES['00'][0], 'clause': 'article 99'},
            'clause_citee': clause('00', 'Article 99.-'),
            'note_de_fiche': (
                "Abrogé par la Loi du 10 juin 2009 fixant les règles générales relatives aux Marchés "
                "Publics et aux Conventions de Concession d'Ouvrage de Service Public, article 99, qui "
                "le nomme. L'article 97 de la même Loi maintient toutefois les dispositions du présent "
                "Décret « applicables aux marchés et avenants déjà approuvés avant la date d'entrée en "
                "vigueur » de la Loi. Les trois arrêtés du 26 octobre 2009 datent leur propre entrée en "
                "vigueur de « la cessation des effets » du présent Décret."
            ),
            'controle': "abrogatedByNumber est résolu À L'AFFICHAGE par numéro ; la loi-mère étant versée, "
                        "le lien se fait par CrossRef A01 (toId), pas par ce champ",
        },
        {
            'texte': '16',
            'source': TEXTES['16'][0],
            'status': 'ABROGE',
            'abroge_par': {'texte': '18', 'source': TEXTES['18'][0], 'clause': 'article 15'},
            'clause_citee': clause('18', 'Article 15.-\tLe présent arrêté remplace'),
            'note_de_fiche': (
                "Remplacé par l'Arrêté du 12 février 2020 soumettant les marchés publics de défense ou "
                "de sécurité nationale au respect des principes de passation des marchés, article 15. "
                "Le présent arrêté portait lui-même révision de l'arrêté du 30 août 2017, qui n'est pas "
                "au corpus."
            ),
            'controle': 'cible présente : lien résolu (CrossRef A06)',
        },
    ],
    'articles_amendes': [
        {
            'texte': '02',
            'source': TEXTES['02'][0],
            'anchor': 'art-227',
            'label': 'Article 227',
            'pastille': "Modifié par l'Arrêté du 9 décembre 2020 modifiant les articles 227 et 227.1 de l'Arrêté du 26 octobre 2009",
            'annotations.status[art-227]': 'modifié',
            'SUBSTITUTION_DU_CORPS': True,
            'version_en_vigueur': {
                'origine': "citée entre guillemets au dispositif du modificateur (texte n° 19, article 2)",
                'texte_cite_verbatim': nou_227,
                'md5_verbatim': hashlib.md5((nou_227 or '').encode()).hexdigest()[:10],
                'payload_ArticleVersion_body': nou_227_dg,
                'md5_payload': hashlib.md5((nou_227_dg or '').encode()).hexdigest()[:10],
                'operation': "retrait du « ouvrant et du » fermant DE BORD sur chaque ligne, rien d'autre — réversible",
                'rendu_si_verbatim': rendu_lecteur(nou_227, 'Article 227'),
                'rendu_si_payload': rendu_lecteur(nou_227_dg, 'Article 227'),
                'pourquoi': (
                    "Mesuré en rejouant la chaîne du lecteur : gardé verbatim, le corps produit la tête "
                    "EN DOUBLE (« Article 227.- « Article 227.- Le Comité… »), parce que "
                    "`applyAmendments` ne reconnaît pas une tête d'article derrière un guillemet et "
                    "rajoute la sienne. Les DEUX états sont fournis avec leur md5 : la citation "
                    "verbatim reste dans la note du CrossRef et dans le corps du modificateur, qui, lui, "
                    "n'est pas touché."
                ),
            },
            'repli_oldVersions': {
                'origine': 'rédaction de 2009, extraite du corps préparé du texte n° 2',
                'texte_verbatim': anc_227,
                'md5_verbatim': hashlib.md5((anc_227 or '').encode()).hexdigest()[:10],
                'payload_oldVersions': anc_227_st,
                'md5_payload': hashlib.md5((anc_227_st or '').encode()).hexdigest()[:10],
                'operation': "retrait de la tête « Article 227.- » — convention des replis de la maison, le libellé étant affiché à part",
            },
            'ArticleVersion': [
                {'seq': 0, 'status': 'MODIFIE', 'body': '↑ repli_oldVersions.payload_oldVersions', 'label': 'Article 227', 'note': 'rédaction du 26 octobre 2009'},
                {'seq': 1, 'status': 'EN_VIGUEUR', 'body': '↑ version_en_vigueur.payload_ArticleVersion_body', 'label': 'Article 227',
                 'amendedBySource': TEXTES['19'][0], 'amendedByNumber': 'Arrêté du 9 décembre 2020', 'effectiveDate': None,
                 'note': "Arrêté du 9 décembre 2020 modifiant les articles 227 et 227.1 de l'Arrêté du 26 octobre 2009 précisant les modalités d'application de la Loi du 10 juin 2009 fixant les règles générales relatives aux marchés publics et aux conventions de concession d'ouvrage de service public, article 2"},
            ],
            'crossRef': 'A04',
        },
        {
            'texte': '02',
            'source': TEXTES['02'][0],
            'anchor': 'art-227-1',
            'label': 'Article 227-1',
            'pastille': "Modifié par l'Arrêté du 9 décembre 2020 modifiant les articles 227 et 227.1 de l'Arrêté du 26 octobre 2009",
            'annotations.status[art-227-1]': 'modifié',
            'graphie': (
                "⚠️ Le modificateur écrit « Article 227.1 » à POINT ; le texte de base écrit "
                "« Article 227-1 » à TRAIT D'UNION. Chaque graphie reste dans son corps ; l'ancre "
                "commune est art-227-1 (labels['art-227-1'] = « Article 227-1 »)."
            ),
            'SUBSTITUTION_DU_CORPS': True,
            'version_en_vigueur': {
                'origine': "citée entre guillemets au dispositif du modificateur (texte n° 19, article 2)",
                'texte_cite_verbatim': nou_227_1,
                'md5_verbatim': hashlib.md5((nou_227_1 or '').encode()).hexdigest()[:10],
                'payload_ArticleVersion_body': nou_227_1_dg,
                'md5_payload': hashlib.md5((nou_227_1_dg or '').encode()).hexdigest()[:10],
                'operation': "retrait du « ouvrant et du » fermant DE BORD sur chaque ligne, rien d'autre — réversible",
                'rendu_si_verbatim': rendu_lecteur(nou_227_1, 'Article 227-1'),
                'rendu_si_payload': rendu_lecteur(nou_227_1_dg, 'Article 227-1'),
                'pourquoi': (
                    "Même mesure que pour l'article 227, et un second effet ici : gardé verbatim, le "
                    "lecteur empile les DEUX graphies rivales — « Article 227-1.- « Article 227.1.- … ». "
                    "Avec le payload, le badge affiche « Article 227-1 » (labels) et la tête « 227.1 » du "
                    "modificateur est absorbée par LEAD_ART : la graphie à point reste lisible là où elle "
                    "est écrite, dans le corps du modificateur, qui n'est pas touché."
                ),
            },
            'repli_oldVersions': {
                'origine': 'rédaction de 2009, extraite du corps préparé du texte n° 2',
                'texte_verbatim': anc_227_1,
                'md5_verbatim': hashlib.md5((anc_227_1 or '').encode()).hexdigest()[:10],
                'payload_oldVersions': anc_227_1_st,
                'md5_payload': hashlib.md5((anc_227_1_st or '').encode()).hexdigest()[:10],
                'operation': "retrait de la tête « Article 227-1.- »",
            },
            'ArticleVersion': [
                {'seq': 0, 'status': 'MODIFIE', 'body': '↑ repli_oldVersions.payload_oldVersions', 'label': 'Article 227-1', 'note': 'rédaction du 26 octobre 2009'},
                {'seq': 1, 'status': 'EN_VIGUEUR', 'body': '↑ version_en_vigueur.payload_ArticleVersion_body', 'label': 'Article 227-1',
                 'amendedBySource': TEXTES['19'][0], 'amendedByNumber': 'Arrêté du 9 décembre 2020', 'effectiveDate': None,
                 'note': "Arrêté du 9 décembre 2020 modifiant les articles 227 et 227.1 de l'Arrêté du 26 octobre 2009, article 2 — le modificateur écrit « Article 227.1 » à point"},
            ],
            'crossRef': 'A04b',
        },
        {
            'texte': '18',
            'source': TEXTES['18'][0],
            'anchor': 'art-2',
            'label': 'Article 2',
            'pastille': "Modifié (définition annulée et remplacée) par le Décret du 21 octobre 2021, article 16.1, alinéa 2",
            'annotations.status[art-2]': 'modifié',
            'SUBSTITUTION_DU_CORPS': False,
            'pourquoi_pas_de_substitution': (
                "L'étendue n'est pas tranchée (§ 13.4, interdit n° 7). La clause du décret ne remplace "
                "que « la définition ». Or l'article 2 de l'arrêté de 2020 porte, après sa phrase de "
                "définition, une énumération de DOUZE catégories (mesurée sur le corps : items 1) à 12) ; "
                "la rédaction de 2019 en portait ONZE, la catégorie « Les marchés publics de "
                "l'électricité » ayant été insérée en 11e position en 2020). Substituer le corps "
                "entier emporterait cette liste ; ne substituer que la première phrase suppose que la "
                "liste survit. Aucune des deux lectures ne se déduit du texte."
            ),
            'conduite_retenue': "pastille + note exposant la clause, SANS toucher au corps ; ni oldVersions ni ArticleVersion tant que la réponse n'est pas connue",
            'note_dediee': (
                "L'article 16.1, alinéa 2, du Décret du 21 octobre 2021 établissant l'obligation de "
                "présenter des informations permettant d'identifier les Bénéficiaires effectifs des "
                "Marchés publics et des Concessions dispose : « Cette définition des Marchés de défense "
                "ou de sécurité nationale annule et remplace la définition contenue dans l'article 2 de "
                "l'Arrêté du 12 février 2020 soumettant les marchés publics de défense ou de sécurité "
                "nationale au respect des principes de passation de marchés. » La portée de ce "
                "remplacement sur l'énumération qui suit la définition n'est pas précisée par le texte."
            ),
            'clause_citee': clause('21', "annule et remplace la définition contenue dans l'article 2"),
            'definition_de_remplacement': clause('21', 'Article 16.1.-'),
            'crossRef': 'A07',
        },
    ],
    'entrent_EN_VIGUEUR_sans_pastille': ['02', '03', '04', '05', '06', '07', '09', '10', '11', '12', '13', '14', '15', '19', '20', '21', '23', '24'],
    'statuts_a_trancher_par_l_editeur': [
        {
            'textes': ['08', '22'],
            'question': '§ 13.3',
            'defaut_si_pas_de_decision': 'EN_VIGUEUR + note d’édition citant l’article 7-1 de l’arrêté du 1er juin 2022 — jamais ABROGE (§ 11.8, interdit n° 6)',
            'note_proposee': (
                "Les seuils fixés par le présent arrêté ont été remplacés EN FAIT à compter du "
                "1er octobre 2022 par l'Arrêté du 1er juin 2022 fixant les seuils de passation des "
                "marchés publics et les seuils d'intervention de la Commission Nationale des Marchés "
                "Publics (articles 7 et 7-1). Aucun texte ne l'abroge nommément."
            ),
        },
        {
            'textes': ['17'],
            'question': '§ 13.2',
            'defaut_si_pas_de_decision': 'ne pas verser sans décision (acte de nomination individuel, mandat de trois ans échu)',
        },
    ],
    'loi_mere_00': {
        'status': 'EN_VIGUEUR',
        'pastille': None,
        'note_de_tete': (
            "La pièce transcrite est la reproduction pour erreurs matérielles publiée au Moniteur "
            "n° 78 du mardi 28 juillet 2009, qui renvoie au Moniteur n° 60 du vendredi 12 juin 2009. "
            "Le texte est désigné, ici comme dans les visas de tous ses arrêtés d'application, "
            "« Loi du 10 juin 2009 » — date du vote de la Chambre des Députés. Le Sénat l'a votée le "
            "4 juin 2009 et la promulgation présidentielle est datée du 12 juin 2009."
        ),
        'decision_de_me_vaval': (
            'double publication laissée telle quelle et mentionnée sans qu’on tranche ; écart '
            '10 juin / 12 juin non pris en compte ; la règle générale « adoptionDate = dernière '
            'entité d’adoption » n’est PAS appliquée à ce texte (décision expresse du 27 août)'
        ),
    },
}

# ═════════════════════════════════════════════════════════════════════════════
# § 8.6 — RATTACHEMENTS À L'INDEX DU MONITEUR (résolution en DEUX TEMPS)
# ═════════════════════════════════════════════════════════════════════════════
index = {
    'methode': (
        "DEUX TEMPS, jamais un seul. (1) `number` + `type: 'INDEX'` restreint aux entrées du "
        "FASCICULE — ce couple n'est PAS unique, un fascicule portant une entrée par titre du "
        "sommaire. (2) parmi elles, l'entrée est désignée par son `id`, re-contrôlé en relisant son "
        "`titleFr`. Le titre DÉPARTAGE, il n'est jamais la clé. La `source` seule est un "
        "discriminant NUL (`source = 'MONITEUR'` porte le miroir entier). "
        "Avant écriture : la résolution FINALE doit désigner EXACTEMENT UNE ligne."
    ),
    'cardinaux_mesures': {
        'note': "mesurés en base de production le 27 août 2026, SELECT seul — la garde porte sur "
                "l'entrée retenue, pas sur ce cardinal",
        'LM2005-12': 1, 'LM2009-SP10': 3, 'LM2011-SP3': 4, 'LM2012-93': 8, 'LM2012-104': 1,
        'LM2013-3': 4, 'LM2013-SP1': 1, 'LM2017-143': 3, 'LM2019-SP3': 1, 'LM2020-SP1': 1,
        'LM2021-SP8': 7, 'LM2009-60': 1, 'LM2009-78': 1, 'LM2009-95': 5, 'LM2006-117': 6,
        'LM2011-52': 8, 'LM2014-179': 5, 'LM2015-210': 4,
        'LM2019-221': 0, 'LM2021-SP52': 0, 'LM2022-SP15': 0,
        'LM2017-SP25': 0, 'LM2017-SP26': 0, 'LM2017-SP28': 0,
        'LM2017-SP31': 0, 'LM2017-SP35': 0, 'LM2017-SP42': 0,
    },
    'lacune_2017_ciblee': (
        "Le miroir porte bien des Spéciaux 2017 — LM2017-SP1 à SP17, puis SP27, SP29, SP30 — "
        "mais AUCUN des six qui portent les arrêtés du 30 août 2017 (SP25, SP26, SP28, SP31, "
        "SP35, SP42). La lacune est ciblée, pas une troncature de série."
    ),
    'rattachements': [
        {'texte': '00', 'source': TEXTES['00'][0], 'chaine_erratum': True, 'entrees': [
            {'number': 'LM2009-60', 'id': 'b673e39b-7c6c-411a-8069-c8148ad50d43', 'titleFr_attendu_debute_par': "Loi fixant les règles générales de passation, d'exécution et de règlement des Marchés Publics", 'role': 'publication d’origine'},
            {'number': 'LM2009-78', 'id': '9cef10a8-673f-43d3-b44d-303282e9a135', 'titleFr_attendu_debute_par': 'Loi fixant les règles générales relatives aux Marchés Publics et aux Conventions de concession', 'role': 'REPRODUCTION — référence affichée'},
        ]},
        {'texte': '01', 'source': TEXTES['01'][0], 'entrees': [
            {'number': 'LM2005-12', 'id': 'b1e56210-f220-4020-88af-ef66a6f3b2f9', 'titleFr_attendu_debute_par': 'Décret fixant la réglementation des marchés publics de services', 'role': 'publication'},
        ]},
        {'texte': '02', 'source': TEXTES['02'][0], 'entrees': [
            {'number': 'LM2009-SP10', 'id': '64853e3f-661a-4762-823e-739fd9e3c9ae', 'titleFr_attendu_debute_par': "Arrêté précisant les modalités d'application de la loi", 'role': 'publication (1er texte du fascicule)'},
        ]},
        {'texte': '03', 'source': TEXTES['03'][0], 'entrees': [
            {'number': 'LM2009-SP10', 'id': '917f68d6-c0ae-4f04-866c-2455a90f563e', 'titleFr_attendu_debute_par': 'Arrêté sanctionnant le manuel de procédures', 'role': 'publication (2e texte du fascicule)'},
        ]},
        {'texte': '04', 'source': TEXTES['04'][0], 'entrees': [
            {'number': 'LM2009-SP10', 'id': '46abae37-ecb1-4c97-b4de-6f386c2f9867', 'titleFr_attendu_debute_par': "Arrêté déterminant les modalités d'organisation et de fonctionnement", 'role': 'publication (3e texte du fascicule)'},
        ]},
        {'texte': '05', 'source': TEXTES['05'][0], 'appariement': 'MESURÉ', 'entrees': [
            {'number': 'LM2011-SP3', 'id': '3301d76b-e3ff-4d33-b8c9-ab00e55247fd', 'titleFr_attendu_debute_par': 'Commission Nationale des Marchés Publics (CNMP) - Tome I', 'role': 'Tome I, item 1'},
        ], 'preuve': "le dispositif du texte n° 5 sanctionne « le dossier d'appel d'offres standard pour la réalisation de travaux » ; l'entrée Tome I annonce « 1) Dossier d'appel d'offres standard pour la réalisation de travaux ». La couverture du fascicule transcrit porte « TOME I »."},
        {'texte': '06', 'source': TEXTES['06'][0], 'appariement': 'MESURÉ', 'entrees': [
            {'number': 'LM2011-SP3', 'id': '8c001e65-9ea5-42e7-aff2-b80a43b01aef', 'titleFr_attendu_debute_par': 'Commission Nationale des Marchés Publics (CNMP) - Tome III', 'role': 'Tome III, item 1'},
        ], 'preuve': "le dispositif du texte n° 6 sanctionne « le dossier de demandes types de propositions pour des services de consultants et modèles de contrats » ; l'entrée Tome III annonce « 1) Demande types de propositions pour des services de consultants et modèles de contrats ». Couverture : « TOME III »."},
        {'texte': '07', 'source': TEXTES['07'][0], 'appariement': 'MESURÉ — CORRIGE LE RELEVÉ', 'entrees': [
            {'number': 'LM2011-SP3', 'id': '4aee16f7-ba5e-41ef-aced-03a4cade0ecd', 'titleFr_attendu_debute_par': 'Commission Nationale des Marchés Publics (CNMP) - Tome IV', 'role': 'Tome IV, item 3'},
        ], 'preuve': "le dispositif du texte n° 7 sanctionne « le Cahier des clauses administratives générales (CCAG) applicables aux marchés publics de fournitures, de services, d'informatique et de bureautique » ; c'est l'item 3 de l'entrée Tome IV. Le relevé du 27 août proposait le Tome II : ERREUR — le Tome II porte les CCAG des concessions et des prestations intellectuelles, non celui des fournitures. La couverture du fichier porte « TOME IV » (et son nom de fichier annonce un DAO prestation de services, § 9.2)."},
        {'texte': '08', 'source': TEXTES['08'][0], 'chaine_erratum': True, 'entrees': [
            {'number': 'LM2012-93', 'id': '2a17113f-b7d6-44b3-8450-7544e4992861', 'titleFr_attendu_debute_par': 'Arrêté fixant les seuils de passation des marchés publics et les seuils', 'role': 'publication d’origine (14 juin 2012)'},
            {'number': 'LM2012-104', 'id': '882aa807-a151-4b80-81ac-1a8d3e08d487', 'titleFr_attendu_debute_par': 'Arrêté fixant les seuils de passation des marchés publics et les seuils', 'role': 'REPRODUCTION — source de la transcription, référence affichée'},
        ], 'reserve': "⚠️ La `publicationDate` de l'entrée LM2012-104 vaut 2012-06-28 en base, alors que le fac-similé porte « Vendredi 29 Juin 2012 » ET que le titre de l'entrée LM2012-93 renvoie lui-même à « LM2012-104 du vendredi 29 juin 2012 ». Le miroir se contredit. La correction de l'entrée est une ÉCRITURE : décision de Me Vaval (§ 13.7). Le rattachement, lui, ne dépend pas de ce point."},
        {'texte': '09', 'source': TEXTES['09'][0], 'entrees': [
            {'number': 'LM2013-3', 'id': '51ebf720-983c-4af4-89a1-2f630f3a473c', 'titleFr_attendu_debute_par': "Arrêté sanctionnant pour sortir son plein et entier effet la Charte d'Éthique", 'role': 'publication'},
        ], 'reserve': "le fascicule porte 4 entrées INDEX, dont l'arrêté d'utilité publique de Delmas — le hors-corpus découpé en tête du fichier (§ 8.3). Ne rattacher que la première."},
        {'texte': '16', 'source': TEXTES['16'][0], 'entrees': [
            {'number': 'LM2019-SP3', 'id': '271b0f4a-f612-4339-b0b9-334374d20056', 'titleFr_attendu_debute_par': "Arrêté portant révision de l'arrêté du 30 août 2017", 'role': 'publication'},
        ], 'reserve': "id NON présent au relevé du 27 août (le relevé rangeait LM2019-SP3 en « connexe » sans son id) — mesuré ici : une seule ligne INDEX pour ce numéro."},
        {'texte': '18', 'source': TEXTES['18'][0], 'entrees': [
            {'number': 'LM2020-SP1', 'id': '59d710a7-d6c1-4cce-8584-5716ddf8a0b3', 'titleFr_attendu_debute_par': 'Arrêté soumettant les marchés publics de défense', 'role': 'publication'},
        ]},
        {'texte': '19', 'source': TEXTES['19'][0], 'entrees': [
            {'number': 'LM2021-SP8', 'id': 'cc554d13-3edb-49f5-a556-e80e9cd7b24a', 'titleFr_attendu_debute_par': "Arrêté modifiant les articles 227 et 227-1", 'role': 'publication (1er texte marchés publics du fascicule)'},
        ], 'reserve': "⚠️ l'entrée INDEX écrit « 227-1 » (trait d'union) là où l'arrêté écrit « 227.1 » (point) : ce n'est pas une objection, le titre départage sur le reste."},
        {'texte': '20', 'source': TEXTES['20'][0], 'entrees': [
            {'number': 'LM2021-SP8', 'id': 'c46706b5-bcbe-4a4f-9e0e-4d6febbd9821', 'titleFr_attendu_debute_par': 'Arrêté fixant la composition des Commissions Ministérielles', 'role': 'publication (2e texte marchés publics du fascicule)'},
        ], 'reserve': "le titre de l'entrée porte « et des des Commissions Spécialisées » — doublon sic du miroir INDEX ; ne pas le « corriger » au passage."},
    ],
    'sans_entree_INDEX': [
        {'textes': ['10', '11', '12', '13', '14', '15'], 'numeros': 'LM2017-SP25 / SP26 / SP28 / SP31 / SP35 / SP42', 'constat': 'le miroir saute de SP17 à SP27 — AUCUNE entrée'},
        {'textes': ['17'], 'numeros': 'LM2019-221', 'constat': 'la série 22x s’arrête à LM2019-220 — 0 ligne mesurée'},
        {'textes': ['21', '22'], 'numeros': 'LM2021-SP52', 'constat': '0 ligne mesurée'},
        {'textes': ['23'], 'numeros': 'LM2022-SP15', 'constat': '0 ligne mesurée'},
        {'textes': ['24'], 'numeros': '—', 'constat': 'Circulaire 010 : sans référence Moniteur (papier Primature) ; rien à rattacher'},
    ],
    'reserve_sur_les_tomes_2011': (
        "⚠️ Les quatre entrées « Tome » ne sont pas des entrées d'ACTE : chacune énumère PLUSIEURS "
        "arrêtés du même 10 mai 2011 (Tome I : 2 · Tome II : 3 · Tome III : 2 · Tome IV : 3 — "
        "soit les dix de la série, ceux-là mêmes que la Charte de 2012 énumère à ses visas). "
        "Le lot n'en porte que trois : chacun est rattaché à l'entrée qui l'ANNONCE, mais l'entrée "
        "reste plus large que le document. À dire en note de fiche, pas à masquer."
    ),
    'regle_absolue': (
        "Aucun rattachement fabriqué pour ces textes. Et JAMAIS de CrossRef par désignation "
        "(toType + toNumber) sur un numéro de fascicule : un numéro du Moniteur désigne un "
        "FASCICULE, pas un acte — LM2012-93 porte 8 lignes INDEX, LM2017-143 en porte 3 dont une "
        "naturalisation. `resolveCrossRefs` choisirait « le meilleur » candidat au hasard des "
        "statuts et des dates (src/lib/legislation/refs.ts, pickBest). Renvoi en clair : "
        "toId, toType, toNumber tous nuls, la désignation dans toLabel."
    ),
    'faux_amis_exclus': [
        {'number': 'LM1974-79', 'id': '6bf3cb30-6184-4c51-a731-0bd703387d5f', 'motif': 'droits communaux perçus par tickets — marchés PHYSIQUES'},
        {'number': 'LM1996-15', 'id': 'e0766d20-4432-494c-bbda-b047fcfc8ef8', 'motif': 'arrêté communal de Port-au-Prince — marchés PHYSIQUES'},
    ],
    'entrees_INDEX_sans_texte_au_corpus': [
        {'number': 'LM2006-117', 'id': '1c83fb54-ff96-4d6b-bf6a-d7dd27417285', 'quoi': 'Arrêté du 4 décembre 2006, abrogé par l’article 99 de la Loi'},
        {'number': 'LM2009-95', 'id': 'b12067a4-efd7-4ab9-af9f-4649992e4dfe', 'quoi': 'Arrêté du 5 septembre 2009 (seuils)'},
        {'number': 'LM2013-SP1', 'id': '4e834aae-13a3-4f47-868e-595d579ccf91', 'quoi': 'documents standards évaluation/suivi'},
        {'number': 'LM2017-143', 'id': '19e1413c-f2b4-44b4-895a-68b9a8803681', 'quoi': 'Arrêté du 30 août 2017 défense — racine de la branche'},
        {'number': 'LM2011-52', 'id': '90b57a60-3186-4b78-b135-d7aea40de387', 'quoi': 'nomination CNMP 2011'},
        {'number': 'LM2014-179', 'id': '5ddd781f-ccaa-4f51-84ab-20c17cc85ff2', 'quoi': 'nomination CNMP 2014'},
        {'number': 'LM2015-210', 'id': '75fdc532-86f9-42c3-a0ac-2f6cd8edb538', 'quoi': 'nomination CNMP 2015'},
        {'number': 'LM2011-SP3', 'id': '0176998c-516c-460d-ad11-cc5197a10b0d', 'quoi': 'Tome II — AUCUN fichier du lot ne le couvre (mesuré)'},
    ],
    'note': "Ces entrées restent des ENTRÉES D'INDEX : elles ne sont pas des textes du corpus et ne "
            "reçoivent aucun CrossRef. Elles sont nommées en clair dans les notes.",
}

# ═════════════════════════════════════════════════════════════════════════════
# Contrôles + écriture
# ═════════════════════════════════════════════════════════════════════════════
if ECHECS:
    print('✗ CONSTRUCTION REFUSÉE — sentinelles ou bornes non uniques :', file=sys.stderr)
    for e in ECHECS:
        print('   ·', e, file=sys.stderr)
    sys.exit(1)

# Aucune arête en double (même de, même vers, même kind).
vus = {}
for a in aretes:
    cle = (a['de']['texte'], a['vers'].get('texte') or a['vers'].get('cle'), a['kind'], a['crossRef']['toAnchor'])
    if cle in vus:
        print(f"✗ arête en double : {a['id']} et {vus[cle]} — {cle}", file=sys.stderr)
        sys.exit(1)
    vus[cle] = a['id']

# Aucun MODIFIE / ABROGE fondé sur un considérant (§ 11.6, interdit n° 9).
for a in aretes:
    if a['kind'] in ('MODIFIE', 'ABROGE') and 'considérant' in a['fondement'].lower():
        print(f"✗ {a['id']} : {a['kind']} fondé sur un considérant — interdit", file=sys.stderr)
        sys.exit(1)

# Aucun lien vers un texte absent (toSource nul ⇒ toLabel renseigné, et réciproquement).
for a in aretes:
    c = a['crossRef']
    if (c['toSource'] is None) != (c['toLabel'] is not None):
        print(f"✗ {a['id']} : cible incohérente (toSource / toLabel)", file=sys.stderr)
        sys.exit(1)
    if c['toType'] or c['toNumber']:
        print(f"✗ {a['id']} : désignation par numéro de fascicule interdite", file=sys.stderr)
        sys.exit(1)

# Toute ancre citée dans un CrossRef vise le document CIBLE : elle doit exister chez lui.
def ancre_existe(num, anchor):
    """L'ancre art-N / art-N-M correspond-elle à une TÊTE du corps ?

    Le motif accepte « Article N », « Articles N » (le pluriel sic du J.O., § 9.1),
    « Article 1er », et les décimales aux DEUX graphies — point (« 227.1 », « 16.1 »)
    comme trait d'union (« 227-1 ») — qui coexistent dans le lot (§ 9.3).
    """
    if anchor is None:
        return True
    m = re.match(r'^art-(\d+)(?:-(\d+))?$', anchor)
    if not m:
        return False
    n, dec = m.group(1), m.group(2)
    if dec:
        tete = rf'^Articles?\s+{n}[.\-]{dec}\s*[.\-–]'
    else:
        tete = rf'^Articles?\s+{n}(?:er)?\s*[.\-–](?!\s*\d)'
    return any(re.match(tete, l.strip()) for l in CORPS[num].split('\n'))


for a in aretes:
    anc = a['crossRef']['toAnchor']
    if anc:  # toAnchor : chez la CIBLE, et seulement chez elle
        cible = a['vers']['texte']
        if not ancre_existe(cible, anc):
            print(f"✗ {a['id']} : toAnchor {anc} introuvable dans le texte n° {cible} (la cible)", file=sys.stderr)
            sys.exit(1)
    ancc = a['ancre_de_la_clause_chez_la_source']
    if ancc and not ancre_existe(a['de']['texte'], ancc):
        print(f"✗ {a['id']} : la clause dit vivre à {ancc}, introuvable dans le texte n° {a['de']['texte']} (la source)", file=sys.stderr)
        sys.exit(1)

# Les pastilles : chaque article amendé doit exister, changer vraiment, et rester réversible.
for a in pastilles['articles_amendes']:
    num, anc = a['texte'], a['anchor']
    if not ancre_existe(num, anc):
        print(f"✗ pastille {num} {anc} : ancre introuvable dans le corps", file=sys.stderr)
        sys.exit(1)
    if not a.get('SUBSTITUTION_DU_CORPS'):
        continue
    ancien = a['repli_oldVersions']['texte_verbatim']
    nouveau = a['version_en_vigueur']['texte_cite_verbatim']
    if ancien is None or nouveau is None:
        print(f"✗ pastille {num} {anc} : extraction incomplète", file=sys.stderr)
        sys.exit(1)
    if ancien == nouveau:
        print(f"✗ pastille {num} {anc} : rédactions identiques — ce ne serait pas un amendement", file=sys.stderr)
        sys.exit(1)
    # le repli doit être le texte du corps VERSÉ, mot pour mot
    if ancien not in CORPS[num]:
        print(f"✗ pastille {num} {anc} : le repli n'est pas dans le corps du texte n° {num}", file=sys.stderr)
        sys.exit(1)
    # RÉVERSIBILITÉ (1) — le déguillemetage ne retire QUE des guillemets et l'espace qui les
    # colle : hors guillemets et blancs, les deux états sont le MÊME texte, caractère à caractère.
    nu = lambda s: re.sub(r'[«»\s]+', '', s)
    if nu(nouveau) != nu(a['version_en_vigueur']['payload_ArticleVersion_body']):
        print(f"✗ pastille {num} {anc} : le déguillemetage a touché autre chose qu'un guillemet", file=sys.stderr)
        sys.exit(1)
    # RÉVERSIBILITÉ (2) — le retrait de tête ne retire qu'un PRÉFIXE : le payload est un
    # suffixe exact du repli verbatim (blancs neutralisés).
    if not nu(ancien).endswith(nu(a['repli_oldVersions']['payload_oldVersions'])):
        print(f"✗ pastille {num} {anc} : le retrait de tête n'est pas un simple préfixe", file=sys.stderr)
        sys.exit(1)
    if nu(a['repli_oldVersions']['payload_oldVersions']) == nu(ancien):
        print(f"✗ pastille {num} {anc} : la tête n'a pas été retirée du repli", file=sys.stderr)
        sys.exit(1)
    # la rédaction nouvelle doit être citée dans le corps du texte MODIFICATEUR
    modif = [x for x in aretes if x['id'] == a['crossRef']][0]['de']['texte']
    if nouveau not in CORPS[modif]:
        print(f"✗ pastille {num} {anc} : la rédaction nouvelle n'est pas dans le corps du texte n° {modif}", file=sys.stderr)
        sys.exit(1)

meta = {
    'genere_le': datetime.now(timezone.utc).astimezone().isoformat(timespec='seconds'),
    'produit_par': 'scripts/data/marches-publics/graphe-construire.py',
    'regles': [
        "Le kind d'un CrossRef AFFIRME : considérant → CITE ; clause du dispositif → MODIFIE / ABROGE.",
        'Chaque arête porte sa clause EXTRAITE du corps (jamais retapée), avec fichier, ligne et md5.',
        'Aucune citation normalisée : les sics du J.O. sont des sentinelles.',
        'Toute cible absente du corpus est un renvoi EN CLAIR (toLabel), jamais un lien.',
        "Aucune écriture en base : ce fichier est une DONNÉE, consommée par le script d'apply.",
    ],
    'empreintes_des_corps_lus': {n: hashlib.md5(CORPS[n].encode()).hexdigest()[:12] for n in sorted(CORPS)},
}

# Degrés par texte — pour que le script d'apply puisse contrôler sa couverture, et pour que
# les zéros se voient. Le texte n° 7 en a un : sortant 0, parce que la page 2 du Moniteur
# manque au scan (ni en-tête, ni visas, ni premiers considérants) — il n'y a rien à citer.
degres = {}
for n in TEXTES:
    sortant = [a['id'] for a in aretes if a['de']['texte'] == n]
    entrant = [a['id'] for a in aretes if a['vers'].get('texte') == n]
    degres[n] = {'source': TEXTES[n][0], 'sortant': len(sortant), 'entrant': len(entrant),
                 'aretes_sortantes': sortant, 'aretes_entrantes': entrant}
conditionnalite = {
    '17': "arête F17 conditionnelle : si Me Vaval écarte l'arrêté de nomination (§ 13.2), "
          "cette arête tombe avec le document. Aucune autre arête n'en dépend.",
    '05': "arêtes A13, A16, A19, A24, F05b · si la série du 10 mai 2011 n'est pas versée (§ 13.5), "
          "les arêtes qui la visent (A13-A21, A24-A26, A38) deviennent des renvois en clair.",
    '06': 'idem n° 5',
    '07': "SORTANT ZÉRO — mesuré, pas un oubli : la page 2 du Moniteur manque au scan source, "
          "le texte reprend au milieu des considérants ; il n'a ni en-tête, ni visas. "
          "Il reçoit en revanche quatre arêtes entrantes.",
}

with open(os.path.join(D, 'graphe-crossrefs.json'), 'w', encoding='utf-8') as f:
    json.dump({'meta': meta, 'textes': {n: {'source': s, 'corps': c, 'libelle': lb} for n, (s, c, lb) in TEXTES.items()},
               'absents': ABSENTS, 'degres': degres, 'conditionnalite': conditionnalite,
               'aretes': aretes}, f, ensure_ascii=False, indent=1)
with open(os.path.join(D, 'graphe-pastilles.json'), 'w', encoding='utf-8') as f:
    json.dump({'meta': meta, 'pastilles': pastilles}, f, ensure_ascii=False, indent=1)
with open(os.path.join(D, 'graphe-index.json'), 'w', encoding='utf-8') as f:
    json.dump({'meta': meta, 'index': index}, f, ensure_ascii=False, indent=1)

par_kind = {}
for a in aretes:
    par_kind[a['kind']] = par_kind.get(a['kind'], 0) + 1
liens_morts = [a['id'] for a in aretes if a['vers']['presence'] == 'ABSENT' and a['crossRef']['toSource']]
print(f"✓ {len(aretes)} arêtes — " + ' · '.join(f'{k} {v}' for k, v in sorted(par_kind.items())))
print(f"✓ {sum(1 for a in aretes if a['vers']['presence'] == 'ABSENT')} renvois EN CLAIR (cible hors corpus) · {len(liens_morts)} lien mort")
print(f"✓ pastilles : {len(pastilles['statuts_de_document'])} statuts de document · "
      f"{len(pastilles['articles_amendes'])} articles ({sum(1 for x in pastilles['articles_amendes'] if x.get('SUBSTITUTION_DU_CORPS') is not False)} avec substitution)")
print(f"✓ index : {len(index['rattachements'])} textes rattachés · "
      f"{sum(len(r['entrees']) for r in index['rattachements'])} entrées · "
      f"{sum(1 for r in index['rattachements'] if r.get('chaine_erratum'))} chaînes d'erratum")
print('✓ écrits : graphe-crossrefs.json · graphe-pastilles.json · graphe-index.json')
