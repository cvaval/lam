# -*- coding: utf-8 -*-
"""
Producteur de `appareil-et-notes.json` — décret sur l'Impôt sur le Revenu (2005),
document cms43ptub00008lo8tv3y25kk.

    cd <racine du dépôt> && python3 scripts/data/decret-ir-2005/build_appareil.py

⚠️ ORDRE : `sim_toc.ts` d'abord (il produit `toc-cible.json`), ce script ensuite. Les clés
`jurisKey` et les ancres neuves sont LUES de `toc-cible.json`, jamais écrites ici — c'est la
seule façon d'empêcher les deux fichiers de se contredire (défaut D2 du contrôle du 25 août).

Ce fichier est une PIÈCE DE PRÉPARATION. Il n'ouvre aucune connexion, n'écrit rien en base.
Le script d'écriture est `scripts/import-decret-ir-2005-sommaire.ts`.

Gardes (défaut D12 : la version antérieure n'avait aucune assertion et citait le corps par
numéros de ligne en dur — un corps décalé d'une ligne aurait cité les mauvais passages) :
  · empreinte md5 du corps de départ, en tête ;
  · pour CHAQUE bloc d'appareil, `texte_exact` doit se retrouver dans les lignes déclarées.
"""
import hashlib
import json
import os
import re

DIR = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(DIR, 'appareil-et-notes.json')

MD5_CORPS_DEPART = '78be764c29e46db69e7b93379502d2c1'
LIGNES_CORPS_DEPART = 749
CARACTERES_CORPS_DEPART = 163065

CORPS = open(os.path.join(DIR, 'etat-2026-08-25-corps.txt'), encoding='utf-8').read()
if CORPS.endswith('\n'):
    CORPS = CORPS[:-1]
L = CORPS.split('\n')

# ── D12 — les deux gardes d'entrée ────────────────────────────────────────────
assert len(L) == LIGNES_CORPS_DEPART, f'corps : {len(L)} lignes, attendu {LIGNES_CORPS_DEPART}'
assert len(CORPS) == CARACTERES_CORPS_DEPART, f'corps : {len(CORPS)} caractères'
_md5 = hashlib.md5(CORPS.encode('utf-8')).hexdigest()
assert _md5 == MD5_CORPS_DEPART, f'corps : md5 {_md5}, attendu {MD5_CORPS_DEPART}'

TOC_CIBLE = json.load(open(os.path.join(DIR, 'toc-cible.json'), encoding='utf-8'))
assert TOC_CIBLE['corpsAttendu']['md5Depart'] == MD5_CORPS_DEPART, \
    'toc-cible.json a été produit contre un autre corps de départ'
JURIS = TOC_CIBLE['jurisKeysArticles']           # art-N → {actuelle, apres, change}
ANCRES_NEUVES = TOC_CIBLE['ancresNeuvesParAncre']  # sec-N → {role, ligneCorpsCible, libelle}

JO = open(os.path.join(DIR, 'piece-jo-2005-moniteur-sp10.txt'), encoding='utf-8').read().split('\n')


def g(n):
    """Ligne n du corps de départ, 1-indexée."""
    return L[n - 1]


def bloc(nums):
    return '\n'.join(g(n) for n in nums)


# ── Préambule — ¶13 « DÉCRET » → ¶40 « DÉCRÈTE », VERBATIM du J.O. ────────────
# D8 : le millésime du 8ᵉ visa est « 1879 » au fascicule. Décision de Me Vaval du 25 août
# 2026 : on verse le texte officiel tel qu'il se lit et on porte le dossier en note — c'est
# la doctrine déjà appliquée à l'article 104. Les apostrophes sont repliées en COURBES,
# convention du corps en base (1 550 courbes, 0 droite) ; rien d'autre n'est touché.
PREAMBULE_LIGNES = [l.replace("'", '’').strip() for l in JO[12:40]]
PREAMBULE_LIGNES = [l for l in PREAMBULE_LIGNES if l]
PREAMBULE = '\n'.join(PREAMBULE_LIGNES)
assert len(PREAMBULE_LIGNES) == 27, f'préambule : {len(PREAMBULE_LIGNES)} lignes'
assert PREAMBULE_LIGNES[0] == 'DÉCRET'
assert PREAMBULE_LIGNES[-1] == 'DÉCRÈTE'
assert '26 août 1879' in PREAMBULE, 'le visa doit être versé verbatim, avec « 1879 » (D8)'
assert sum(1 for l in PREAMBULE_LIGNES if l.startswith('Vu ')) == 19
assert sum(1 for l in PREAMBULE_LIGNES if l.startswith('Considérant ')) == 2
# N2 — « VERBATIM » s'entend du TEXTE, pas de la typographie. Deux normalisations, et deux
# seulement : apostrophes droites → courbes, et la ligne vide qui suit « PRÉSIDENT PROVISOIRE
# DE LA RÉPUBLIQUE » retirée. La garde ci-dessous le PROUVE plutôt que de le promettre : on
# revient en arrière sur la typographie et on doit retrouver le J.O. mot pour mot.
_jo_utile = [l.strip() for l in JO[12:40] if l.strip()]
assert [l.replace('’', "'") for l in PREAMBULE_LIGNES] == _jo_utile, \
    'le préambule diffère du J.O. autrement que par les apostrophes'
# Contrat de corps : le préambule doit produire EXACTEMENT le corps cible de toc-cible.json.
_lignes_cible = list(L)
_fusion = f'{_lignes_cible[184]} {_lignes_cible[185].rstrip(".")}'
_lignes_cible[184:186] = [_fusion]
_corps_cible = '\n'.join(PREAMBULE_LIGNES + _lignes_cible)
assert hashlib.md5(_corps_cible.encode('utf-8')).hexdigest() == TOC_CIBLE['corpsAttendu']['md5'], \
    'le préambule produit ici ne donne pas le corps sous lequel toc-cible.json s’apparie'

FILET_17 = g(68)[g(68).index('.,,'):]
FILET_21 = g(95)[g(95).index(' .,,'):]
FILET_95 = g(398)[g(398).index(',’ ~'):]
FILET_128 = g(536)[g(536).index(', ------'):]

appareil = []


def add(**kw):
    """Enregistre un bloc d'appareil. D12 : `texte_exact` doit se retrouver aux lignes
    déclarées — sinon le bloc décrit un corps qui n'est pas celui-ci."""
    if 'texte_exact' in kw and 'lignes' in kw:
        source = '\n'.join(g(n) for n in kw['lignes'])
        assert kw['texte_exact'] in source, \
            f"{kw.get('id')} : texte_exact introuvable aux lignes {kw['lignes']}"
    appareil.append(kw)


# ══════════════════════════════════════════════════════════════════════════════
# FILETS DE CADRE (4)
# ══════════════════════════════════════════════════════════════════════════════
add(id='filet-1', famille='filet_de_cadre', article_hote='17', portee='1-126',
    lignes=[68], position='fin de la ligne 68, après « … revenus bruts générés. »',
    texte_exact=FILET_17,
    ligne_avant=g(68),
    ligne_apres='Le montant des charges déductibles ne doit en aucun cas dépasser le total des revenus bruts générés.',
    retrait='troncature de la ligne 68 : elle porte du dispositif AVANT le filet',
    attrape_par_points_virgule_tirets=True,
    devenir='retire_du_corps', porte_en_commentaires='avec l’encadré budget-17 (même bloc)',
    piece='J.O. Spécial n° 10, art. 17 : l’article s’achève à « … revenus bruts générés. » (pièce piece-jo-2005-moniteur-sp10.txt l. 109) ; la transcription de 2020 (piece-transcription-2020-191-articles.txt l. 114) s’achève de même.')
add(id='filet-2', famille='filet_de_cadre', article_hote='21', portee='1-126',
    lignes=[95], position='fin de la ligne 95, après « … sera considérée. »',
    texte_exact=FILET_21,
    ligne_avant=g(95),
    ligne_apres=g(95)[:g(95).index(' .,,')],
    retrait='troncature de la ligne 95 : elle porte tout l’article 21 AVANT le filet',
    attrape_par_points_virgule_tirets=True,
    devenir='retire_du_corps', porte_en_commentaires='avec l’encadré budget-21 (même bloc)',
    note_de_mesure='⚠️ filet-1 est un SOUS-ENSEMBLE strict de filet-2 (ils ne diffèrent que par l’espace de tête) : la chaîne de filet-1 a DEUX occurrences dans le corps. Un remplacement littéral du filet de l’article 17 amputerait aussi la ligne 95. Le retrait se fait par numéro de ligne.',
    piece='J.O. art. 21 (l. 126) et transcription 2020 art. 21 (l. 136) : l’article s’achève à « … sera considérée. »')
add(id='filet-3', famille='filet_de_cadre', article_hote='95', portee='1-126',
    lignes=[398], position='fin de la ligne 398, après « … Cent Mille (100,000) gourdes. »',
    texte_exact=FILET_95,
    ligne_avant=g(398),
    ligne_apres='En cas de fausse déclaration relevée dans l’état explicatif, l’employeur sera passible d’une amende fixe de Cent Mille (100,000) gourdes.',
    retrait='troncature de la ligne 398 : elle porte du dispositif AVANT le filet',
    attrape_par_points_virgule_tirets=False,
    note_de_mesure='⚠️ Cette rupture ne commence PAS par « .,,----- » mais par « ,’ ~------ » et se termine par « ------~ DISPOSITIONS SPÉCIALES ». Une liste littérale « .,,----- » la manque. Seule /-{10,}/ l’attrape.',
    devenir='retire_du_corps', porte_en_commentaires='avec l’encadré budget-95 (même bloc)',
    piece='J.O. art. 95 : l’article s’achève à « … gourdes. » ; « DISPOSITIONS SPÉCIALES » est un intertitre de l’éditeur, absent du J.O. et de la transcription de 2020.')
add(id='filet-4', famille='filet_de_cadre', article_hote='128', portee='127-189',
    lignes=[536], position='fin de la ligne 536',
    texte_exact=FILET_128,
    ligne_avant=g(536),
    ligne_apres='(la ligne 536 disparaîtrait entièrement : elle appartient au bloc SFD, item lf-sfd-128)',
    retrait='ligne entière, avec le bloc lf-sfd-128 — mais hors de la plage que le script traite',
    attrape_par_points_virgule_tirets=False,
    note_de_mesure='⚠️ 4ᵉ rupture : commence par « , ------- » et se termine par « ------- ’ ». Non attrapée non plus par « .,,----- ».',
    devenir='propose_non_prouve_a_arbitrer',
    porte_en_commentaires='avec le bloc lf-sfd-128 et l’encadré budget-128',
    piece='Transcription 2020, art. 128 (l. 713-722) : l’article d’origine s’achève à « … le cas échéant. ». Le J.O. de la cliente ne couvre pas l’art. 128.')

# ══════════════════════════════════════════════════════════════════════════════
# RENVOIS DE PAGINATION (5)
# ══════════════════════════════════════════════════════════════════════════════
add(id='ref-1', famille='ref_pages', article_hote='15', portee='1-126', lignes=[52],
    texte_exact='Réf. page 587', dans='la note nb-15 (lignes 51-52)',
    devenir='retire_du_corps_avec_sa_note',
    piece='Renvoi de pagination vers l’édition papier Paillant, ouvrage que la plateforme n’héberge pas.')
add(id='ref-2', famille='ref_pages', article_hote='109', portee='1-126', lignes=[461],
    texte_exact='Réf. page 446.', dans='la note nb-109 (ligne 461)',
    devenir='retire_du_corps_avec_sa_note', piece='idem')
add(id='ref-3', famille='ref_pages', article_hote='113', portee='1-126', lignes=[482],
    texte_exact='Ref. page 446', dans='la note nb-113 (ligne 482)',
    note_de_mesure='« Ref. » sans accent — une liste littérale « Réf. » la manque.',
    devenir='retire_du_corps_avec_sa_note', piece='idem')
add(id='ref-4', famille='ref_pages', article_hote='123', portee='1-126', lignes=[514],
    texte_exact='Ref. Pages 386 et 446', dans='la note nb-123 (ligne 514)',
    note_de_mesure='⚠️ « Ref. Pages » — ni accent ni minuscule. Seule une regex /r[ée]f\\.\\s*pages?/i l’attrape.',
    devenir='retire_du_corps_avec_sa_note', piece='idem')
# D16 : art. 149 est hors de la plage 1-126. Le § 7.8 y autorise le retrait d'« un « Réf.
# page » manifeste, RIEN DE PLUS » : on retire donc le seul fragment de pagination, EN
# TRONQUANT la ligne, et on laisse la note N.B. en place (voir nb-149).
add(id='ref-5', famille='ref_pages', article_hote='149', portee='127-189', lignes=[619],
    texte_exact=' Réf. pages 386 et 446', dans='la note nb-149 (ligne 619)',
    ligne_avant=g(619),
    ligne_apres=g(619).replace(' Réf. pages 386 et 446', ''),
    retrait='troncature de la ligne 619 : seul le renvoi de pagination part, la note N.B. reste',
    note_de_mesure='Hors de la plage contrôlée par le fascicule. Le § 7.8 autorise expressément le retrait d’« un « Réf. page » manifeste, rien de plus » : c’est ce fragment-là, et lui seul, qui part.',
    devenir='retire_du_corps',
    piece='Transcription 2020, art. 149 (l. 821-842) : rien de tel entre le barème A et le B.')

# ══════════════════════════════════════════════════════════════════════════════
# ENCADRÉS « BUDGET » (4)
# ══════════════════════════════════════════════════════════════════════════════
add(id='budget-17', famille='encadre_budget', article_hote='17', portee='1-126',
    lignes=[68, 69, 70, 71, 72, 73], intitule='Budget 2010-2011',
    texte_exact=FILET_17 + '\n' + bloc([69, 70, 71, 72, 73]),
    retrait='ligne 68 tronquée (elle porte du dispositif), lignes 69-73 retirées entières',
    devenir='retire_du_corps_porte_en_commentaires',
    piece='J.O. art. 17 : l’article s’achève à « … revenus bruts générés. » (l. 109). Mesures de reconstruction post-séisme, étrangères au décret.')
add(id='budget-21', famille='encadre_budget', article_hote='21', portee='1-126',
    lignes=[95, 96, 97, 98, 99, 100], intitule='Budget 2010-2011',
    texte_exact=FILET_21.lstrip() + '\n' + bloc([96, 97, 98, 99, 100]),
    retrait='ligne 95 tronquée (elle porte tout l’article 21), lignes 96-100 retirées entières',
    devenir='retire_du_corps_porte_en_commentaires',
    piece='J.O. art. 21 (l. 126) et transcription 2020 (l. 136).')
add(id='budget-95', famille='encadre_budget', article_hote='95', portee='1-126',
    lignes=[398, 399, 400, 401, 402, 403, 404], intitule='Budget 2013-2014 / DISPOSITIONS SPÉCIALES',
    texte_exact=FILET_95.lstrip(',’ ') + '\n' + bloc([399, 400, 401, 402, 403, 404]),
    contient=['lf-64', 'lf-65', 'lf-66'],
    retrait='ligne 398 tronquée (elle porte du dispositif), lignes 399-404 retirées entières',
    note_de_mesure='⚠️ lf-64 (l. 401-402), lf-65 (l. 403) et lf-66 (l. 404) sont À L’INTÉRIEUR de ce bloc. Leur texte ne doit être porté qu’UNE fois en commentaires : le commentaire de l’article 95 les contient déjà.',
    devenir='retire_du_corps_porte_en_commentaires',
    piece='J.O. art. 95 : l’article s’achève à « … gourdes. ». Les trois « — Article 64/65/66 » sont des articles de la Loi de finances 2013-2014, pas du décret.')
add(id='budget-128', famille='encadre_budget', article_hote='128', portee='127-189',
    lignes=[537, 538, 539, 540, 541, 542, 543], intitule='Budget 2010-2011',
    texte_exact=bloc([537, 538, 539, 540, 541, 542, 543]),
    retrait='lignes entières — mais hors de la plage que le script traite',
    devenir='propose_non_prouve_a_arbitrer',
    note_de_mesure='Le § 7.8 interdit de toucher au dispositif 127-189, et l’interdit n° 14 le répète. Une pièce existe pourtant : la transcription de 2020 arrête l’art. 128 à « … le cas échéant. ». Elle est de provenance inconnue et n’est pas le Journal officiel : ce n’est pas une preuve, c’est un indice. Retrait PROPOSÉ, NON PROUVÉ — décision à Me Vaval (question 5 des questions_a_me_vaval).',
    piece='Transcription 2020, l. 713-722.')

# ══════════════════════════════════════════════════════════════════════════════
# NOTES « N.B. » (6)
# ══════════════════════════════════════════════════════════════════════════════
add(id='nb-15', famille='note_nb', article_hote='15', portee='1-126', lignes=[51, 52],
    texte_exact=bloc([51, 52]), retrait='lignes entières',
    devenir='retire_du_corps_porte_en_commentaires',
    piece='J.O. art. 15 (l. 81-90) : l’article s’achève à « … l’article 7 du présent Décret. ». Note d’éditeur (« → NB »).')
add(id='nb-92', famille='note_nb', article_hote='92', portee='1-126', lignes=[374, 375],
    texte_exact=bloc([374, 375]), retrait='lignes entières',
    devenir='retire_du_corps_porte_en_commentaires',
    note_de_mesure='Note intercalée ENTRE deux alinéas du dispositif (l. 373 et l. 376) : après retrait, les deux alinéas redeviennent contigus.',
    piece='J.O. art. 92 (l. 437-442) : aucune note ; à cet endroit le J.O. porte l’alinéa d’abattement (voir le commentaire art-92 « rédaction d’origine »).')
add(id='nb-109', famille='note_nb', article_hote='109', portee='1-126', lignes=[461],
    texte_exact=g(461), retrait='ligne entière',
    devenir='retire_du_corps_porte_en_commentaires',
    piece='J.O. art. 109 (l. 525-527) et transcription 2020 (l. 620-623) : rien de tel.')
add(id='nb-113', famille='note_nb', article_hote='113', portee='1-126', lignes=[482],
    texte_exact=g(482), retrait='ligne entière',
    devenir='retire_du_corps_porte_en_commentaires',
    piece='J.O. art. 113 (l. 548) et transcription 2020 (l. 647-648) : l’article tient en un alinéa.')
add(id='nb-123', famille='note_nb', article_hote='123', portee='1-126', lignes=[514],
    texte_exact=g(514), retrait='ligne entière',
    devenir='retire_du_corps_porte_en_commentaires',
    piece='J.O. art. 123 (l. 583) et transcription 2020 (l. 692-693) : l’article tient en un alinéa.')
# D16 — le retrait de la note ENTIÈRE dépasse ce que le § 7.8 autorise hors de la plage
# 1-126. Requalifié : proposé, non prouvé. Seul son « Réf. pages » part (ref-5).
add(id='nb-149', famille='note_nb', article_hote='149', portee='127-189', lignes=[619],
    texte_exact=g(619), retrait='(non retiré par le script — voir ref-5 pour le seul fragment qui part)',
    devenir='propose_non_prouve_a_arbitrer',
    note_de_mesure='Le § 7.8 n’autorise, hors de la plage 1-126, que le retrait d’« un « Réf. page » manifeste, rien de plus ». Le retrait de la note N.B. entière est probablement le bon geste éditorial, mais il n’est appuyé que par la transcription de 2020, pièce de provenance inconnue. Retrait PROPOSÉ, NON PROUVÉ — décision à Me Vaval (question 6 des questions_a_me_vaval). Le script retire le seul « Réf. pages 386 et 446 » et laisse la note.',
    piece='Transcription 2020, art. 149 (l. 821-842) : le barème A est immédiatement suivi de « B - Personnes morales ».')

# ══════════════════════════════════════════════════════════════════════════════
# ARTICLES DE LOI DE FINANCES RECOPIÉS (6)
# ══════════════════════════════════════════════════════════════════════════════
# D5/D6 — `loi_source` est la mention destinée AU LECTEUR : elle ne porte ni pictogramme, ni
# injonction, ni le mot « mesuré ». La réserve « absente du corpus » est une PHRASE, la même
# pour les trois lois de finances concernées, et elle est appliquée partout où le commentaire
# attribue un texte à une loi de finances.
RESERVE_LF = 'Cette loi de finances ne figure pas au corpus de la plateforme ; son texte ne peut pas y être consulté.'
LF_ABSENTES = ('Loi de Finances 2013-2014', 'Loi de Finances 2014-2015', 'Loi de Finances 2015-2016')

add(id='lf-15', famille='article_lf_insere', article_hote='20', portee='1-126',
    lignes=[92, 93], numero_affiche='Article 15',
    texte_exact=bloc([92, 93]), retrait='lignes entières',
    piege='⚠️ Le décret a un vrai article 15 (« Sont exonérés de l’impôt sur le Revenu », l. 39). Cette ligne-ci vit sous l’article 20 et porte un tout autre contenu.',
    loi_source='Loi de Finances 2013-2014, Moniteur spécial # 2 du 10 juin 2014 (mention portée au corps)',
    devenir='retire_du_corps_porte_en_commentaires',
    note_de_mesure='La ligne 92 est une apostrophe courbe orpheline (U+2019 seule) : débris d’océrisation, elle part avec le bloc.',
    piece='J.O. art. 20 (l. 118-124) : l’article s’achève au point f).')
add(id='lf-31', famille='article_lf_insere', article_hote='42', portee='1-126',
    lignes=[204, 205, 206, 207, 208, 209], numero_affiche='Article 31',
    texte_exact=bloc([204, 205, 206, 207, 208, 209]), retrait='lignes entières',
    piege='⚠️ Le décret a un vrai article 31 (Sous Section III, Modalités d’imposition). Celui-ci vit sous l’article 42.',
    loi_source='Loi de Finances 2015-2016 (mention portée au corps)',
    devenir='retire_du_corps_porte_en_commentaires',
    note_de_mesure='Le corps porte 17 lois de finances ; la Loi de finances 2015-2016 n’en fait pas partie, d’où la réserve portée dans le commentaire.',
    piece='J.O. art. 42 (l. 254) : « … émettra un bordereau rectificatif. » puis directement « Sous Section V ». Transcription 2020, art. 42 (l. 280-282) : idem.')
add(id='lf-64', famille='article_lf_insere', article_hote='95', portee='1-126',
    lignes=[401, 402], numero_affiche='Article 64', texte_exact=bloc([401, 402]),
    retrait='lignes entières, DÉJÀ comprises dans budget-95',
    dans='le bloc budget-95 (lignes 398-404)',
    piege='⚠️ Le décret a un vrai article 64. Celui-ci vit entre les articles 95 et 96.',
    loi_source='Loi de Finances 2013-2014, encadré « Budget 2013-2014 » (Moniteur Spécial # 2 du 10 juin 2014)',
    devenir='retire_du_corps_avec_son_encadre', piece='J.O. art. 95→96 sans interposition.')
add(id='lf-65', famille='article_lf_insere', article_hote='95', portee='1-126',
    lignes=[403], numero_affiche='Article 65', texte_exact=g(403),
    retrait='ligne entière, DÉJÀ comprise dans budget-95',
    dans='le bloc budget-95 (lignes 398-404)',
    piege='⚠️ Le décret a un vrai article 65.',
    loi_source='Loi de Finances 2013-2014', devenir='retire_du_corps_avec_son_encadre',
    piece='J.O. art. 95→96 sans interposition.')
add(id='lf-66', famille='article_lf_insere', article_hote='95', portee='1-126',
    lignes=[404], numero_affiche='Article 66', texte_exact=g(404),
    retrait='ligne entière, DÉJÀ comprise dans budget-95',
    dans='le bloc budget-95 (lignes 398-404)',
    piege='⚠️ Le décret a un vrai article 66.',
    loi_source='Loi de Finances 2013-2014', devenir='retire_du_corps_avec_son_encadre',
    piece='J.O. art. 95→96 sans interposition.')
add(id='lf-8', famille='article_lf_insere', article_hote='24', portee='1-126',
    lignes=[128], numero_affiche='Article 8', texte_exact=g(128), retrait='ligne entière',
    piege='⚠️ SIXIÈME ligne du même piège, que le § 7.8 ne compte pas : elle commence par « → » et non par « — », donc /^—\\s*Article/ la manque. Le décret a un vrai article 8 (l. 24) — celui de la retenue sur prestataire étranger, tout autre.',
    loi_source='Loi de Finances 2014-2015 (mention portée au corps)',
    devenir='retire_du_corps_porte_en_commentaires',
    note_de_mesure='Le corps porte 17 lois de finances ; la Loi de finances 2014-2015 n’en fait pas partie, d’où la réserve portée dans le commentaire.',
    piece='J.O. art. 24 (l. 135-155) : l’article s’achève au point 17). Transcription 2020, art. 24 : idem.')

# ══════════════════════════════════════════════════════════════════════════════
# AUTRES — laissés au corps, ou à arbitrer
# ══════════════════════════════════════════════════════════════════════════════
# D6 — plus aucune attribution présentée comme vérifiée : la source est celle que L'ÉDITEUR
# indique, et le texte qui la porterait n'est pas au corpus.
add(id='lf-creditbail-29', famille='alinea_lf_consolide', article_hote='29', portee='1-126',
    lignes=[154], texte_exact=g(154), retrait='(aucun — laissé au corps)',
    devenir='laisse_au_corps_recommande',
    source_indiquee_par_l_editeur='article 7 de la Loi de Finances 2013-2014, Moniteur spécial # 2 du 10 juin 2014',
    note_de_mesure='Alinéa que l’édition Paillant rattache à l’article 29 en l’attribuant à l’art. 7 de la LF 2013-2014. Cette loi de finances n’est pas au corpus : l’attribution est celle de l’éditeur, elle n’a pas pu être vérifiée sur le texte source. Contrairement à lf-8, l’alinéa ne porte AUCUN numéro d’article : il ne peut pas être confondu avec un article du décret. C’est du dispositif consolidé, pas de l’appareil. Débris typographiques résiduels : le marqueur « → », un guillemet fermant orphelin « ». » et une parenthèse non ouverte « … 10 juin 2014) ».',
    piece='J.O. art. 29 (tableau, l. 160-200) : l’alinéa n’y est pas — attendu, il est postérieur.')
add(id='lf-sfd-128', famille='article_loi_tierce', article_hote='128', portee='127-189',
    lignes=[535, 536], texte_exact=bloc([535, 536]),
    retrait='lignes entières — mais hors de la plage que le script traite',
    devenir='propose_non_prouve_a_arbitrer',
    note_de_mesure='Ce n’est pas un amendement du décret : c’est l’article 23 de la Loi du 30 août 1982 sur les Sociétés Financières de Développement, recopié par l’éditeur sous l’article 128. Le filet de cadre filet-4 est collé à sa fin. Hors de la plage 1-126, aucune pièce faisant foi ne borne l’article : retrait PROPOSÉ, NON PROUVÉ — décision à Me Vaval (question 5 des questions_a_me_vaval).',
    piece='Transcription 2020, art. 128 (l. 713-722) : l’article d’origine s’achève à « … le cas échéant. ».')
# D10 — ce n'est PAS un `texte_exact` : c'est une citation abrégée par points de suspension,
# qui a ZÉRO occurrence au corps. Le champ est renommé, et la ligne entière est jointe.
add(id='lf-acompte-19', famille='alinea_lf_consolide', article_hote='19', portee='1-126',
    lignes=[78],
    extrait='… prévues par le présent décret. 7 Un acompte de dix pour cent (10%) … (Article 6 Loi de Finances 2013-2014, Moniteur Spécial # 2 du 10 Juin 2014)',
    ligne_entiere=g(78),
    retrait='(aucun — laissé au corps)',
    devenir='laisse_au_corps_recommande',
    source_indiquee_par_l_editeur='article 6 de la Loi de Finances 2013-2014, Moniteur Spécial # 2 du 10 juin 2014',
    note_de_mesure='⚠️ Le champ s’appelle `extrait` et non `texte_exact` : c’est une citation abrégée, elle a 0 occurrence dans le corps. La ligne réelle est `ligne_entiere`. L’alinéa est attribué par l’édition Paillant à l’art. 6 de la LF 2013-2014, laquelle n’est pas au corpus : l’attribution est celle de l’éditeur, non vérifiée sur le texte source. Dispositif consolidé — il reste. Seul le « 7 » isolé entre « présent décret. » et « Un acompte » est un débris (voir debris_candidats_hors_prompt).',
    piece='J.O. art. 19 (l. 112-114) : l’article s’achève à « … prévues par le présent Décret. ».')

# ── D11 — mesure du recouvrement des lignes, calculée et non affirmée ─────────
_declarees, _doublees = [], []
for it in appareil:
    for n in it.get('lignes', []):
        if n in _declarees:
            _doublees.append(n)
        _declarees.append(n)
_doublees = sorted(set(_doublees))
_distinctes = sorted(set(_declarees))

# ══════════════════════════════════════════════════════════════════════════════
# COMMENTAIRES — le texte destiné au LECTEUR
# ══════════════════════════════════════════════════════════════════════════════
# D5 — aucune de ces chaînes ne doit contenir « ⚠️ », « mesuré », « ne pas … », ni « .. » :
# ce sont des consignes à l'exécutant, pas de la prose de fiche. Contrôlé plus bas.
MON = '(Le Moniteur, Spécial n° 10 du 5 octobre 2005)'
commentaires = {}


def cm(art, texte, origine, **kw):
    commentaires.setdefault('art-' + art, []).append(dict(texte=texte, origine=origine, **kw))


cm('8', 'Rédaction d’origine ' + MON + ' : « Il est fait obligation aux personnes physiques ou morales qui utilisent les services d’un prestataire dont le domicile fiscal est situé hors d’Haïti, au cours d’un séjour temporaire dans le pays, de verser à la Direction Générale des Impôts, dans les quinze (15) jours qui suivent le paiement de ses rémunérations, le montant de l’impôt sur le revenu calculé au taux de 20% libératoire. » L’incise « au cours d’un séjour temporaire dans le pays », qui bornait l’obligation au prestataire de passage, et le taux unique de 20% ne figurent plus dans la rédaction en vigueur.',
   '§ 7.6 — rédaction de 2005 perdue (incise du § 1). Le § 2 n’est PAS ajouté ici : il est déjà en base et c’est lui que la correction de l’annotation assainit.')
cm('8', 'Note d’édition. L’annotation portée jusqu’ici sous cet article attribuait au décret de 2005 la phrase : « Tout contrat passé avec une personne physique ou morale dont le domicile fiscal est situé hors d’Haïti doit être enregistré à la Direction Générale des Impôts. » Cette phrase ne se lit ni au Journal officiel du 5 octobre 2005, ni dans la transcription intégrale du texte de 2005 dont dispose la plateforme, ni dans aucun autre document du corpus. Son origine n’étant pas établie, elle n’est pas présentée ici comme du texte de 2005.',
   '§ 7.7 — requalification de la phrase non sourcée (option « conserver en requalifiant »).')
cm('45', 'Rédaction d’origine ' + MON + ' : « Si malgré l’injonction à lui faite, le contribuable s’abstient de se conformer à la loi, l’impôt sur la base des états financiers sera établi d’office en quintuplant l’impôt forfaitaire payé ou qu’il devrait payer. En cas de récidive, l’impôt et l’amende seront doublés. » La rédaction en vigueur substitue au quintuple de l’impôt forfaitaire le double du montant de l’acompte.',
   '§ 7.6 — rédaction de 2005 perdue (fin de phrase « payé ou qu’il devrait payer »). Recouvre partiellement l’annotation déjà en base « Passage abrogé … « quintuplant l’impôt forfaitaire » » : la présente note donne l’alinéa entier, l’ancienne n’en donnait que deux mots.')
cm('76', 'Rédaction d’origine ' + MON + ', deuxième alinéa : « Un acompte de deux pour cent (2%) sera également appliqué à la source sur les montants effectivement versés sur tous contrats de prestations de service passés entre l’Etat, les entreprises publiques, les projets financés par l’Etat, les organismes autonomes, les entreprises commerciales, industrielles ou artisanales, les Organisations Non Gouvernementales d’aide au développement, et les institutions religieuses avec des tiers. Le montant retenu sera versé à la Direction Générale des Impôts, entre le 1er et le 15 de chaque mois pour le mois précédent, sous peine des sanctions prévues par le présent Décret. » La mention « les projets financés par l’Etat » a disparu de la rédaction en vigueur, qui étend en revanche l’acompte aux contrats de production de biens et aux « autres personnes morales ».',
   '§ 7.6 — rédaction de 2005 perdue (§ 2, mention « les projets financés par l’Etat »).')
cm('92', 'Rédaction d’origine ' + MON + ', alinéa supprimé : « Aux fins de calcul de la base imposable à la retenue sur salaire des employés, un abattement spécial de dix pour cent (10%) sera appliqué sur le montant brut du salaire mensuel projeté sur 12 mois. A cette base ainsi établie, on appliquera le barème prévu à l’article 149 du présent Décret. »',
   '§ 7.6 — rédaction de 2005 perdue (dernier alinéa, abattement de 10 %). Texte recopié du J.O. (l. 441) ; la transcription de 2020 (l. 519) le porte mot pour mot, à l’accent de « À cette base » près.')
cm('92', 'Le décret, dans sa rédaction publiée au Moniteur du 5 octobre 2005, ouvrait ici une division « Sous Section III.- Modalités d’imposition » (articles 92 à 96). L’édition consolidée de 2018, dont ce texte est tiré, ne la reprend pas.',
   '§ 7.3 — texte imposé, sans imputation d’intention. Décision de Me Vaval du 25 août 2026 : la division ne revient pas au corps.')

# D4 — la citation est reproduite TELLE QUELLE, « I5 % » compris, et l'écart est expliqué au
# lieu d'être normalisé en silence. Sans cela, une consœur qui cherche la phrase sur la
# plateforme ne la trouve pas. Pas de balise HTML : `Jurisprudence.tsx` rend du texte brut.
cm('96', 'Le taux de la retenue à la source sur commissions et courtages était de 10% dans la rédaction publiée au Moniteur du 5 octobre 2005. La Loi de finances de l’exercice 2017-2018, au corpus de la plateforme, dispose : « Le Ier paragraphe de l’article 96 du Décret du 29 septembre 2005 relatif à l’impôt sur le Revenu se lit désormais comme suit : Les commissions et courtages sont frappés d’une retenue à la source au taux de I5 %. » La citation reprend le corps de cette loi tel qu’il figure au corpus, aux seules apostrophes près, rendues courbes comme partout ailleurs sur la plateforme : la couche texte du Moniteur y écrit « I » pour « 1 », et il faut lire « 15 % ». C’est ce taux de 15% qui figure au corps du présent décret.',
   '§ 7.5 — note sur une donnée chiffrée opposable. Pièce citée : Loi de finances 2017-2018, document cmqcmxq0z00091342l6b704dh (number LF2017-2018). Les deux lignes ont été relues en base : « Le Ier paragraphe de l’article 96 du Décret du 29 septembre 2005 relatif à l’impôt sur le Revenu » / « Les commissions et courtages sont frappés d’une retenue à la source au taux de I5 %. L’entreprise ». Défaut D4 du contrôle : la version antérieure normalisait « I5 % » en « 15 % » À L’INTÉRIEUR des guillemets.')
cm('104', 'Les trois témoins du texte de 2005 dont dispose la plateforme — le fascicule du Moniteur, sa couche texte et la transcription intégrale de 2020 — écrivent « commissionnaire aux comptes ». L’édition consolidée de 2018, reproduite ici, écrit « commissaire aux comptes », terme du droit des sociétés. Le corps suit l’édition de 2018.',
   '§ 7.5 — cas inverse : ne pas « corriger » la base vers la leçon du J.O.')
# D7 — la fiche n'a AUCUN fac-similé attaché (sourcePdfUrl et sourceFileUrl sont NULL) : la
# note ne peut pas en promettre un. Et l'index en base couvre 191/191 : la formule du § 7.4
# « le sommaire ET l'index ne couvrent que 1 à 126 » est fausse sur l'index.
cm('126', 'Le niveau « Sous Section » du sommaire s’arrête ici : le décret n’en porte plus au-delà de l’article 126. Le fascicule du Moniteur transmis à la rédaction s’interrompt lui aussi à cet article, au milieu d’une phrase ; les articles 127 à 189 sont donnés d’après l’édition consolidée de 2018.',
   '§ 7.4 — note d’éditeur reprise de la note finale (¶43) du sommaire de la cliente. Rectifiée deux fois (défaut D7) : la fiche ne porte aucun fac-similé (sourcePdfUrl et sourceFileUrl NULL), on ne peut donc pas écrire « le fac-similé dont dispose la plateforme » ; et l’index en base couvre 191/191 articles (369 sujets, 649 renvois, 0 renvoi mort), la formule « le sommaire ET l’index ne couvrent que 1 à 126 » serait donc inexacte.',
   texte_du_prompt_7_4='Le sommaire et l’index dont ce document est doté ne couvrent que les articles 1 à 126 : le fac-similé disponible s’y interrompt.',
   motif_de_l_ecart='La dernière ligne « Sous Section » du corps est la l. 480, l’article 126 la l. 518, et aucune sous-section ne suit : le 4ᵉ niveau du sommaire s’arrête de lui-même à l’article 126. L’index, lui, va jusqu’à 189. Le texte retenu dit ce qui s’observe.')

# ── commentaires d'appareil (§ 7.8) : un par bloc RETIRÉ, sous l'article hôte ──
# D11 — un texte revendiqué deux fois n'est porté qu'UNE fois : lf-64/65/66 sont dans
# budget-95, ref-1..4 sont dans leur note nb-*. Ils ne reçoivent pas de commentaire propre.
APP_ORDER = ['nb-15', 'budget-17', 'lf-15', 'budget-21', 'lf-8', 'lf-31', 'budget-95',
             'nb-92', 'nb-109', 'nb-113', 'nb-123', 'ref-5']
byid = {it['id']: it for it in appareil}


def tete_de(it):
    fam = it['famille']
    if fam == 'note_nb':
        return ('Note de lecture de l’édition Joseph Paillant (Code Fiscal d’Haïti, 2018), retirée du '
                'dispositif : elle n’appartient pas au décret. Texte retiré : ')
    if fam == 'encadre_budget':
        return ('Encadré de l’édition Joseph Paillant (Code Fiscal d’Haïti, 2018) — « %s » —, retiré du '
                'dispositif : il reproduit des mesures de loi de finances qui n’appartiennent pas au '
                'décret. ') % it.get('intitule', '')
    if fam == 'article_lf_insere':
        socle = ('Article inséré par une loi de finances, recopié par l’édition Joseph Paillant sous le '
                 'présent article et retiré du dispositif : sa numérotation est celle de la loi de finances '
                 '(« %s »), non celle du décret — qui a un article de ce numéro, ailleurs et au contenu tout '
                 'autre. Source indiquée par l’éditeur : %s. ') % (it.get('numero_affiche', ''), it.get('loi_source', ''))
        if any(lf in it.get('loi_source', '') for lf in LF_ABSENTES):
            socle += RESERVE_LF + ' '
        return socle + 'Texte retiré : '
    if fam == 'ref_pages':
        return ('Renvoi de pagination de l’édition Joseph Paillant (Code Fiscal d’Haïti, 2018) vers son '
                'propre ouvrage papier, retiré du dispositif : la plateforme n’héberge pas cet ouvrage et le '
                'renvoi n’y mène nulle part. La note de lecture dans laquelle il figurait est laissée en '
                'place. Texte retiré : ')
    return 'Élément retiré du dispositif (appareil de l’édition Joseph Paillant, 2018). Texte retiré : '


for iid in APP_ORDER:
    it = byid[iid]
    tete = tete_de(it)
    # D6 — l'encadré « Budget 2013-2014 » de l'article 95 attribue trois articles à une loi de
    # finances absente du corpus : la même réserve qu'ailleurs, et pour la même raison.
    if iid == 'budget-95':
        tete += ('Les articles 64, 65 et 66 qu’il reproduit sont donnés par l’éditeur comme venant '
                 'de la Loi de Finances 2013-2014. ' + RESERVE_LF + ' ')
    if iid in ('budget-17', 'budget-21'):
        tete += ('Elles sont données par l’éditeur comme venant du budget 2010-2011 '
                 '(Moniteur Spécial # 1 du 14 janvier 2011). ')
    if it['famille'] == 'encadre_budget':
        tete += 'Texte retiré : '
    corps_cite = it.get('texte_exact', it.get('extrait', '')).strip()
    txt = tete + '« ' + corps_cite.replace('\n', ' ⏎ ') + ' »'
    cm(it['article_hote'], txt,
       '§ 7.8 — sortie de l’appareil de Paillant, bloc %s (lignes %s). Pièce : %s'
       % (it['id'], ', '.join(str(x) for x in it['lignes']), it.get('piece', '')),
       bloc=it['id'], devenir=it['devenir'])

# ── D5 — contrôle de la prose destinée au lecteur ─────────────────────────────
INTERDITS_DE_PROSE = [
    ('pictogramme', re.compile('[⚠️]')),
    ('« mesuré »', re.compile(r'\bmesur[ée]\b', re.I)),
    ('injonction « ne pas … »', re.compile(r'\bne pas (la |le |les )?(présenter|citer|appliquer)\b', re.I)),
    ('double point', re.compile(r'\.\.(?!\.)')),
    ('balise HTML', re.compile(r'<[a-z/][^>]*>', re.I)),
    ('numéro de ligne de préparation', re.compile(r'\bl\.\s*\d{2,3}\b')),
]
for cle, items in commentaires.items():
    for i, c in enumerate(items):
        for nom, rx in INTERDITS_DE_PROSE:
            assert not rx.search(c['texte']), f'{cle}[{i}] : {nom} dans le texte du lecteur'

# ── D6 — la réserve est appliquée partout où elle doit l'être, et nulle part ailleurs ──
_avec_reserve = sorted(k for k, v in commentaires.items() if any(RESERVE_LF in c['texte'] for c in v))
assert _avec_reserve == ['art-20', 'art-24', 'art-42', 'art-95'], \
    f'réserve « loi de finances absente du corpus » : {_avec_reserve}'

purges = [dict(
    cle_actuelle='sec-9|art-49', cle_apres=JURIS['art-49']['apres'], article='49',
    probleme='Trois entrées, dont les entrées [0] et [1] sont RIGOUREUSEMENT identiques (chaîne à chaîne). Elles s’affichent l’une sous l’autre sur la fiche.',
    entree_a_retirer="Passage abrogé (barré dans l'édition Paillant 2018) : « quinze millions (15.000.000) »",
    occurrences_avant=3, occurrences_apres=2,
    entrees_conservees=[
        "Passage abrogé (barré dans l'édition Paillant 2018) : « quinze millions (15.000.000) »",
        "Passage abrogé (barré dans l'édition Paillant 2018) : « quinze millions (15.000.000) À l’occasion du dépôt des états financiers annuels, la Direction Générale des Impôts délivrera à l’entreprise un avis de réception contre un droit de timbre fixe de cent (100) gourdes. »"],
    quand='pendant la re-clé du § 6, avant réécriture sous la nouvelle clé — sinon le doublon est reconduit tel quel')]

corrections_a_l_annotation = [dict(
    cle_actuelle='sec-5|art-8', cle_apres=JURIS['art-8']['apres'], article='8',
    avant="Passage abrogé (barré dans l'édition Paillant 2018) : « Néanmoins, lorsque le règlement se fait par tranche, une retenue de 20% de chaque tranche sera appliquée et versée à la Direction Générale des Impôts dans les quinze (15) jours suivant le paiement. Tout contrat passé avec une personne physique ou morale dont le domicile fiscal est situé hors d’Haïti doit être enregistré à la Direction Générale des Impôts. »",
    apres="Passage abrogé (barré dans l'édition Paillant 2018) : « Néanmoins, lorsque le règlement se fait par tranche, une retenue libératoire de 20% de chaque tranche sera appliquée et versée à la Direction Générale des Impôts dans les quinze (15) jours suivant le paiement. »",
    deux_corrections=[
        "« une retenue de 20% » → « une retenue libératoire de 20% » : le J.O. (l. 65) et la transcription de 2020 (l. 61) écrivent tous deux « retenue libératoire ».",
        "Retrait de la phrase « Tout contrat passé … doit être enregistré à la Direction Générale des Impôts. », dont la source n’est pas établie ; elle est requalifiée dans la note d’édition ajoutée sous art-8."],
    mesures=dict(occurrences_dans_le_JO_docx=0, occurrences_dans_la_couche_texte_du_facsimile=0,
                 occurrences_dans_la_transcription_2020=0, documents_du_corpus_la_contenant=0,
                 requete="prisma.document.findMany({ where: { bodyOriginal: { contains: 'Tout contrat passé avec une personne physique ou morale' } } }) → 0"))]

debris = [
    dict(id='ocr-96', article='96', ligne=405, statut='CONFIRMÉ',
         avant='au taux de te% 15%.', apres='au taux de 15%.',
         piece='« te% » est le débris du « 10% » barré. Le J.O. (l. 467) et la transcription de 2020 (l. 549) écrivent 10% ; la rédaction en vigueur est 15% (LF 2017-2018, document cmqcmxq0z00091342l6b704dh). ⚠️ On retire « te% », on GARDE 15%.',
         occurrences_de_la_chaine_dans_le_corps=1),
    dict(id='ocr-99', article='99', ligne=416, statut='CONFIRMÉ',
         avant='n’a pas encore dix (10) depuis qu’il est propriétaire',
         apres='n’a pas encore dix (10) ans depuis qu’il est propriétaire',
         piece='J.O. l. 478 et transcription 2020 l. 564, tous deux « dix (10) ans depuis ».',
         occurrences_de_la_chaine_dans_le_corps=1),
    dict(id='ocr-35', article='35', ligne=189, statut='CONFIRMÉ',
         avant='et autres contribuables à l’article 33',
         apres='et autres contribuables visés à l’article 33',
         piece='J.O. l. 236 et transcription 2020 l. 256, tous deux « contribuables visés à l’article 33 ».',
         occurrences_de_la_chaine_dans_le_corps=1),
    dict(id='ocr-54', article='54', ligne=232, statut='CONFIRMÉ',
         avant='suffisant, 1’ excédent de déficit', apres='suffisant, l’excédent de déficit',
         piece='J.O. l. 285 et transcription 2020 l. 324. Le « 1 » est le chiffre un, suivi de U+2019 et d’une espace.',
         occurrences_de_la_chaine_dans_le_corps=1),
    dict(id='ocr-57', article='57', ligne=241, statut='CONFIRMÉ',
         avant='toutes les fois quel’ Administration', apres='toutes les fois que l’Administration',
         piece='J.O. l. 295 et transcription 2020 l. 337.', occurrences_de_la_chaine_dans_le_corps=1),
    dict(id='ocr-123', article='123', ligne=513, statut='CONFIRMÉ',
         avant='mêmes ’ils sont des revenus', apres='même s’ils sont des revenus',
         piece='J.O. l. 583 et transcription 2020 l. 693.', occurrences_de_la_chaine_dans_le_corps=1),
    dict(id='ocr-118', article='118', ligne=501, statut='CONFIRMÉ',
         avant='c) les différences provenant des changements de méthodes dans l’évaluation des stocks ; les valeurs effectivement versées par l’entreprise pour des charges non déductibles pour l’exercice en cours.',
         apres='c) les différences provenant des changements de méthodes dans l’évaluation des stocks ;\nd) les valeurs effectivement versées par l’entreprise pour des charges non déductibles pour l’exercice en cours.',
         piece='J.O. l. 566-570 : quatre points a. b. c. d. ; transcription 2020 l. 671-675 : quatre items. Le point d) est fondu dans le c).',
         effet_sur_le_compte_de_lignes='+1 ligne (la seule insertion de ligne du lot ; à annoncer au contrôle du § 7.5)'),
    dict(id='ocr-86', article='86', ligne=344, statut='RÉFUTÉ — NE PAS APPLIQUER',
         avant='bordereau complémentaire de l’impôt majoré',
         apres_propose_par_le_prompt='bordereau complémentaire, l’impôt majoré',
         piece='TROIS mesures contredisent la correction du § 7.5 : (1) la couche texte du fac-similé lit « bordereau complémentaire de l’impôt majoré de 25%, au titre d’amende sans préjudice » ; (2) la transcription de 2020, art. 86 (l. 481) lit de même ; (3) l’article jumeau 147 (corps l. 607, transcription l. 815) lit de même. Seule la transcription .docx de la cliente porte la ponctuation « complémentaire, l’impôt » — c’est elle l’exception, pas la base.',
         note='⚠️ La chaîne apparaît DEUX fois dans le corps (art. 86 l. 344 et art. 147 l. 607) : un remplacement littéral toucherait aussi l’article 147, hors plage contrôlée. Réfutation CONFIRMÉE par le contrôle du 25 août.'),
    dict(id='ocr-116', article='116', ligne=486, statut='RÉFUTÉ — NE PAS APPLIQUER',
         avant='retenue libératoire de 20% libératoire',
         apres_propose_par_le_prompt='retenue libératoire de 20%',
         piece='La couche texte du fac-similé écrit « retenue libératoire de 20% libératoire après déduction » (l. 1712-1713) et la transcription de 2020, art. 116 (l. 657) écrit de même. Le doublon est dans le texte de 2005, pas dans l’océrisation de l’édition Paillant. Seule la transcription .docx de la cliente l’a supprimé. Réfutation CONFIRMÉE par le contrôle du 25 août.'),
]

candidats = [
    dict(id='cand-92-soixante', article='92', ligne=373,
         avant='sans excéder soixante ; : mille (60.000) gourdes', apres='sans excéder soixante mille (60.000) gourdes',
         piece='J.O. l. 440 et transcription 2020 l. 518 : « sans excéder soixante mille (60.000) gourdes ». Débris manifeste (« ; : » inséré au milieu d’un nombre écrit en toutes lettres).',
         statut='hors § 7.5 — proposé'),
    dict(id='cand-96-apostrophe', article='96', ligne=407,
         avant='si l’entreprise commettante se ’ conforme', apres='si l’entreprise commettante se conforme',
         piece='J.O. l. 469 et transcription 2020 l. 551.', statut='hors § 7.5 — proposé'),
    # D14 — les deux témoins de 2005 ne portent PAS cet alinéa : leur silence n'atteste rien.
    dict(id='cand-19-sept', article='19', ligne=78,
         avant='prévues par le présent décret. 7 Un acompte de dix pour cent (10%)',
         apres='prévues par le présent décret. Un acompte de dix pour cent (10%)',
         piece='Le « 7 » est isolé entre un point final et une majuscule, dans un alinéa que l’édition Paillant rattache à la LF 2013-2014 : appel de note ou numéro de page de l’édition papier. ⚠️ Les deux témoins de 2005 (J.O. l. 114, transcription 2020 l. 121) ne portent pas du tout cet alinéa — postérieur de neuf ans — et ne peuvent donc rien attester ; le seul arbitre serait l’article 6 de la LF 2013-2014, absente du corpus.',
         statut='hors § 7.5 — PROPOSÉ, NON PROUVÉ (question 4 des questions_a_me_vaval)'),
    dict(id='cand-42-point', article='42', ligne=203,
         avant='émettra un bordereau rectificatif', apres='émettra un bordereau rectificatif.',
         piece='J.O. l. 254 et transcription 2020 l. 281 : la phrase se termine par un point. Le point a été emporté avec le bloc lf-31 qui suivait.',
         statut='hors § 7.5 — proposé ; à appliquer APRÈS le retrait du bloc lf-31'),
    dict(id='cand-99-impot', article='99', ligne=414,
         avant='passibles de l’ impôt sur le revenu.', apres='passibles de l’impôt sur le revenu.',
         piece='Espace parasite après l’apostrophe. J.O. l. 476, transcription 2020 l. 562.',
         statut='hors § 7.5 — proposé'),
    dict(id='cand-29-tableau', article='29', lignes=[149, 150],
         avant='- Frais agencements, aménagements,\ninstallations et améliorations locatives : 20%',
         apres='- Frais d’agencements, aménagements, installations et améliorations locatives : 20%',
         piece='J.O. l. 193 : « Frais d’agencements, aménagements, installations et améliorations locatives ». Ligne coupée en deux ET « d’ » perdu (§ 7.9).',
         statut='§ 7.9 — appliqué par le script (repli « liste réparée » ; la restitution en richBlocksJson reste à arbitrer). Effet sur le compte de lignes : −1'),
]

# ── § 7.9 — le tableau de l'article 29, mesuré ────────────────────────────────
_t29 = [n for n in range(140, 165) if re.match(r'^-\s', g(n))]
tableau_29 = dict(
    ou='corps, lignes 141 à 160 environ — le barème des taux maxima de dépréciation, aplati en liste à tirets',
    richBlocksJson='NULL en base ; la restitution en tableau reste une question (question 9 du § 13)',
    couples_libelle_taux_avant=len(_t29),
    correction_appliquee_par_le_script='cand-29-tableau : les lignes 149 et 150 sont fondues en une, et le « d’ » perdu est rendu (« Frais d’agencements, aménagements, installations et améliorations locatives : 20% »)',
    couples_libelle_taux_apres=len(_t29) - 1,
    convention_des_taux=dict(
        constat='Le corps écrit « 12.5% » (point décimal) là où le J.O. écrit « 12,5% », et « 20 % » / « 5 % » avec une espace avant le signe.',
        decision='AUCUNE normalisation. Les trois formes sont laissées telles quelles : ce sont des données chiffrées opposables, et « préserver » en changeant serait faux. L’écart est signalé au rapport, pas corrigé.',
        interdit='Ne pas écrire que le taux fractionnaire a été « préservé » : le corps écrit « 12.5% », le J.O. « 12,5% ».'),
    piece='Le .docx de la cliente contient exactement un `w:tbl` : 20 lignes × 2 colonnes, en-têtes « Catégorie de biens » / « Taux maximum », un seul paragraphe par cellule.',
)

data = dict(
    _meta=dict(
        fichier='scripts/data/decret-ir-2005/appareil-et-notes.json',
        produit_par='scripts/data/decret-ir-2005/build_appareil.py',
        ordre_de_production='sim_toc.ts (produit toc-cible.json) PUIS build_appareil.py — les clés jurisKey et les ancres neuves sont lues de toc-cible.json, jamais écrites ici.',
        ecrit_le='2026-08-25',
        revise_le='2026-08-25 (application des 19 défauts du rapport de contrôle)',
        document='cms43ptub00008lo8tv3y25kk',
        source='DECRET_IMPOT_REVENU_2005',
        objet='Préambule à verser, inventaire de l’appareil de Paillant, notes à écrire, débris d’océrisation.',
        avertissement='Fichier de PRÉPARATION. Aucune écriture en base n’a été faite. Les numéros de ligne renvoient au corps relevé le 25 août 2026 (749 lignes, 163 065 caractères, md5 78be764c29e46db69e7b93379502d2c1) — état AVANT toute modification, et avant l’insertion du préambule.',
        contrat_des_commentaires='⚠️ `commentaires[art-N]` livre ici des OBJETS {texte, origine, …} ; la base attend `string[]`. Le script d’import écrit `c.texte`, jamais l’objet, et sous la clé `jurisKey` lue de segmentAnnotated (champ `jurisKeysArticles` de toc-cible.json), JAMAIS sous « art-N ». Les clés « art-N » de ce fichier sont un index de préparation, pas des clés de base.',
        corps_de_reference=dict(lignes=LIGNES_CORPS_DEPART, caracteres=CARACTERES_CORPS_DEPART,
                                md5=MD5_CORPS_DEPART, tetes_d_article=191,
                                apostrophes_courbes=1550, apostrophes_droites=0),
    ),
    preambule=dict(
        ou='en tête de bodyOriginal, avant la ligne « TITRE I »',
        mesure_prealable=dict(
            occurrences_dans_le_corps_actuel={'Vu': 0, 'Considérant': 0, 'DÉCRÈTE': 0,
                                              'DECRETE': 0, 'BONIFACE': 0, 'ALEXANDRE': 0},
            methode='re.findall sur les 163 065 caractères de bodyOriginal ; « Vu » cherché en \\bVu\\b'),
        lignes=len(PREAMBULE_LIGNES), caracteres=len(PREAMBULE), visas=19, considerants=2,
        normalisations_typographiques=(
            "VERBATIM s’entend du texte, non de la typographie. Deux normalisations, et deux "
            "seulement, séparent ces 27 lignes du J.O. : les apostrophes droites U+0027 sont "
            "rendues courbes U+2019, convention du corps entier (1 550 courbes, 0 droite — "
            "§ 9.6) ; et la ligne vide qui suit « PRÉSIDENT PROVISOIRE DE LA RÉPUBLIQUE » est "
            "retirée. Aucun mot, aucun chiffre, aucune ponctuation n’est modifié — « Loi du "
            "26 août 1879 » comprise. Une assertion du producteur le vérifie : repliées en "
            "apostrophes droites, les 27 lignes redonnent le J.O. à l’identique."),
        concordance_des_temoins=dict(
            visas={'J.O. .docx': 19, 'transcription 2020': 19, 'couche texte du fac-similé': 19},
            considerants={'J.O. .docx': 2, 'transcription 2020': 2, 'couche texte du fac-similé': 2},
            verdict='CONCORDANTS. Les 27 lignes du préambule s’alignent une à une entre le J.O. et la transcription de 2020 ; six divergences seulement, dont une seule substantielle.'),
        divergences_JO_vs_transcription_2020=[
            dict(rang=8, jo="Vu la Loi du 26 août 1879 sur la responsabilité des fonctionnaires et employés de l'Administration Publique;",
                 transcription_2020="Vu la Loi du 26 août 1870 sur la responsabilité des fonctionnaires et employés de l'Administration Publique;",
                 nature='SUBSTANTIELLE — millésime de la loi visée',
                 tranchee_en_faveur_de='J.O. (« 1879 ») — décision de Me Vaval du 25 août 2026 : le texte officiel est versé verbatim et le dossier va en note.'),
            dict(rang=11, jo="deux Institutions Autonomes : la Banque de la République d'Haïti et la Banque Nationale de Crédit;",
                 transcription_2020="deux institutions autonomes : la Banque de la République d'Haïti (BRH) et la Banque Nationale de Crédit (BNC);",
                 nature='éditoriale (sigles ajoutés par le transcripteur) + coquille « 17 Aoû 1979 » dans la transcription',
                 tranchee_en_faveur_de='J.O.'),
            dict(rang=17, jo="Ministère de l'Economie et des Finances", transcription_2020="Ministère de l'Économie et des Finances",
                 nature='accentuation normalisée par le transcripteur', tranchee_en_faveur_de='J.O.'),
            dict(rang=18, jo="Direction Générale des Impôts;", transcription_2020="Direction Générale des Impôts (DGI);",
                 nature='sigle ajouté par le transcripteur', tranchee_en_faveur_de='J.O.'),
            dict(rang=25, jo="Sur le rapport du Ministre de l'Economie et des Finances;", transcription_2020="… de l'Économie …",
                 nature='accentuation', tranchee_en_faveur_de='J.O.'),
            dict(rang=26, jo="Et après délibération en Conseil des Ministres :", transcription_2020="Et après délibération en Conseil des Ministres;",
                 nature='ponctuation', tranchee_en_faveur_de='J.O.'),
        ],
        dossier_1870_vs_1879=dict(
            verse_au_corps='26 août 1879',
            decision="Décision de Me Vaval du 25 août 2026. Le préambule est versé VERBATIM depuis le Journal officiel, avec « 1879 », et tout le dossier est porté en note. Le faisceau penche pour 1870, mais on n’amende pas le texte officiel sur une inférence : c’est exactement la doctrine appliquée à l’article 104, où le J.O. porte la coquille et où le corps ne la reprend pas.",
            defaut_corrige="D8 du contrôle du 25 août : la version antérieure de ce fichier écrivait « 1870 » dans le dispositif, seule divergence sur 27 lignes, sans que la décision remonte à Me Vaval.",
            temoins_pour_1870=[
                'La transcription intégrale de 2020, l. 10.',
                'Le Moniteur, volume annuel 2005, deux autres numéros signés du même Président : « Vu la Loi du 26 aoQt 1870 sur la responsabilitC des fonctionnaires… » et « … 26 aoClt 1870 … » (n° 39 du lundi 23 mai 2005). Océrisation très bruitée, mais les quatre chiffres sont nets dans les deux cas.',
                'Corpus Lam Veritab : 3 documents portent « 26 août 1870 » avec la MÊME formule de visa — Loi de finances 2005-2006 (cmqcmxpwa00001342l1da2nv9), Loi de finances 2008-2009 (cmqcmxpy700051342d90nkh1h), et la Loi du 21 avril 1940 (cms8dx7r5002oqt1venp0movd), qui la cite dans son dispositif.',
            ],
            temoins_pour_1879=[
                'La couche texte du fac-similé du Spécial n° 10 (l. 34).',
                'Le .docx de la cliente (l. 21) — qui n’est PAS un témoin indépendant : c’est une reprise nettoyée de cette même couche texte.',
            ],
            mesure_du_corpus='documents contenant « 26 août 1870 » : 3 ; contenant « 26 août 1879 » : 0 (requête Prisma sur bodyOriginal ET bodyClean, avec et sans accent).',
            reserve='Non vérifié : nul n’a lu l’IMAGE du fascicule. Si le Spécial n° 10 a bien imprimé « 1879 », la coquille est du J.O. lui-même — et la note reste exacte. Ce que la mesure établit, c’est qu’aucune « Loi du 26 août 1879 » n’est connue de la plateforme.',
        ),
        note_a_porter_en_crossRefs=dict(
            ancre='sec-56',
            pourquoi='l’en-tête du préambule — PAS une clé art-*, le préambule n’a pas d’ancre d’article',
            canal='annotationsJson.crossRefs : { anchor: "sec-56", articles: [], note: … }',
            note='Le visa de la loi sur la responsabilité des fonctionnaires est reproduit ici tel que le porte le Journal officiel : « Loi du 26 août 1879 ». Trois pièces de provenances distinctes nomment au contraire une loi du 26 août 1870 : la transcription intégrale du décret, deux autres numéros du Moniteur de 2005 portant le même visa, et trois documents du corpus, dont la loi du 21 avril 1940 qui la cite dans son dispositif. Aucune ne connaît de loi du 26 août 1879. Le texte officiel est reproduit sans amendement ; la question du millésime reste ouverte.'),
        toc=dict(
            label='DÉCRET',
            commentaire_sur_le_label='Le libellé de toc doit être la ligne du corps, caractère pour caractère : c’est elle qui apparie dans segmentAnnotated. La première ligne du préambule est « DÉCRET » — la propre en-tête de l’acte au J.O. On ne fabrique donc aucune division.',
            anchor=next(a for a, v in ANCRES_NEUVES.items() if v['role'] == 'préambule'),
            pourquoi_cette_ancre='Ancre LUE de toc-cible.json, qui la calcule contre la vraie segmentAnnotated. Les 20 sous-sections prennent sec-33…sec-52 dans l’ordre du corps, les 3 lettres A)/B)/C) sec-53…sec-55, et le préambule l’ancre libre suivante. ⚠️ Défaut D2 : la version antérieure de ce fichier donnait sec-53 au préambule — collision avec la lettre a).',
            level=1, kind='code',
            position_dans_le_tableau='PREMIÈRE entrée du tableau toc (l’appariement est séquentiel : une entrée mise à la fin ne s’apparie jamais).',
            effet_sur_les_cles='AUCUN. L’en-tête du préambule précède « TITRE I » ; curSection est réécrit dès TITRE I. Aucune clé jurisKey ne change du fait du préambule.'),
        navToc=dict(label='Préambule',
                    anchor=next(a for a, v in ANCRES_NEUVES.items() if v['role'] == 'préambule'),
                    position='premier groupe, avant TITRE I',
                    commentaire='Distinction établie sur le Décret minier : le toc colle au J.O. (« DÉCRET »), le navToc à la lecture (« Préambule »). C’est cette entrée qui donne une cible réelle aux 4 renvois « Préambule » de l’index de la cliente, si Me Vaval décide de les reprendre. ⚠️ Jamais dans des ctRefs : « #art-Préambule » est un lien mort.'),
        interdits_respectes=['Aucun « Vu … » n’est inscrit au toc : chaque visa est un alinéa, pas une division (§ 7.1).',
                             'Aucune ancre sec-1 … sec-32 n’est renumérotée.',
                             'Le millésime du 8ᵉ visa n’est pas amendé (§ 12, doctrine de l’article 104).'],
        chaine_d_abrogation_portee_par_le_preambule=[
            'Décret du 29 septembre 1986 relatif à l’Impôt Sur le Revenu',
            'Décret du 27 septembre 1988 modifiant celui du 29 septembre 1986',
            'Loi du 5 février 1995 modifiant les articles 35, 36 et 82 du Décret du 29 septembre 1986'],
        texte=PREAMBULE,
    ),
    appareil=appareil,
    commentaires=commentaires,
    correction_de_l_annotation_de_l_article_8=corrections_a_l_annotation,
    purge_du_doublon=purges,
    debris_ocr=debris,
    debris_candidats_hors_prompt=candidats,
    tableau_article_29=tableau_29,
    cles_jurisKey=dict(
        regle='⚠️ Les clés ci-dessous NE DOIVENT PAS être écrites à la main (§ 12.7). Elles sont LUES de toc-cible.json, qui les tient lui-même du résultat de segmentAnnotated(corps cible, toc cible). Si le script d’import en produit d’autres, c’est le script qui a raison et l’écart est à comprendre, pas à corriger.',
        provenance='toc-cible.json → jurisKeysArticles (produit par sim_toc.ts). Les deux fichiers ne peuvent plus diverger : un seul producteur les calcule.',
        defaut_corrige='D2 du contrôle du 25 août : la version antérieure de ce fichier prédisait sec-44 pour art-76/81/86 et sec-53 pour le préambule. Les trois articles prennent sec-55 (la lettre « c) Acompte Provisionnel » est l’en-tête le plus proche au-dessus d’eux), et sec-53 est pris par la lettre a).',
        table={k: dict(actuelle=v['actuelle'], apres=v['apres'], change=v['change'])
               for k, v in JURIS.items()},
        ancres_neuves=ANCRES_NEUVES,
    ),
    recapitulatif=dict(
        appareil=dict(
            total_blocs=len(appareil),
            filets_de_cadre=sum(1 for i in appareil if i['famille'] == 'filet_de_cadre'),
            ref_pages=sum(1 for i in appareil if i['famille'] == 'ref_pages'),
            encadres_budget=sum(1 for i in appareil if i['famille'] == 'encadre_budget'),
            notes_nb=sum(1 for i in appareil if i['famille'] == 'note_nb'),
            articles_de_lf_inseres=sum(1 for i in appareil if i['famille'] == 'article_lf_insere'),
            article_loi_tierce=sum(1 for i in appareil if i['famille'] == 'article_loi_tierce'),
            alineas_consolides_laisses=sum(1 for i in appareil if i['famille'] == 'alinea_lf_consolide'),
            remarque_retrait='⚠️ Les `lignes` NE PARTITIONNENT PAS le corps : %d lignes appartiennent à deux blocs (un filet est toujours collé à son encadré ; lf-64/65/66 sont À L’INTÉRIEUR de budget-95 ; ref-N est toujours dans nb-N). %d numéros déclarés pour %d distincts. Le retrait se fait sur l’UNION des numéros de ligne — jamais par recherche-remplacement de `texte_exact` : filet-1 est un sous-ensemble strict de filet-2 et se trouve DEUX fois dans le corps. Quatre lignes (68, 95, 398, 619) portent du dispositif AVANT l’appareil : elles se TRONQUENT (`ligne_apres`), elles ne se retirent pas. Et ne portez qu’UNE fois en commentaires un texte revendiqué deux fois : le commentaire de l’art-95 contient déjà les articles 64/65/66, celui de nb-N contient déjà son ref-N.'
                             % (len(_doublees), len(_declarees), len(_distinctes)),
            lignes_revendiquees_deux_fois=_doublees,
            lignes_declarees=len(_declarees),
            lignes_distinctes=len(_distinctes),
            lignes_a_tronquer=[68, 95, 398, 619],
            remarque_filets='⚠️ 2 des 4 filets seulement commencent par « .,,----- » (art. 17 et 21). Le 3ᵉ (art. 95) commence par « ,’ ~----- » et finit par « ------~ DISPOSITIONS SPÉCIALES » ; le 4ᵉ (art. 128) commence par « , ------- » et finit par « ------- ’ ». Seule /-{10,}/ les attrape tous les quatre.',
            remarque_ref_pages='⚠️ Sur 5 occurrences, 3 échappent à une liste littérale « Réf. page » : « Ref. page » (art. 113), « Ref. Pages » (art. 123), « Réf. pages » (art. 149). Regex obligatoire : /r[ée]f\\.\\s*pages?/i.',
            remarque_articles_inseres='⚠️ SIX lignes, pas cinq. Le § 7.8 en compte cinq (« — Article 15/31/64/65/66.- ») ; la sixième, « → Article 8.- » (ligne 128, sous l’article 24), commence par une flèche et non par un tiret cadratin. Les six trompent : le décret a de vrais articles 8, 15, 31, 64, 65 et 66, ailleurs et au contenu tout autre.',
            hors_plage_1_126_non_retire=['budget-128', 'lf-sfd-128', 'filet-4', 'nb-149'],
            hors_plage_1_126_retire=['ref-5 (le seul « Réf. pages » de l’art. 149 — expressément autorisé par le § 7.8)'],
        ),
        commentaires=dict(
            cles_existantes=6,
            cles_existantes_liste=['sec-5|art-8', 'sec-9|art-33', 'sec-9|art-43', 'sec-9|art-45',
                                   'sec-9|art-49', 'sec-10|art-81'],
            cles_proposees=len(commentaires), cles_proposees_liste=sorted(commentaires),
            total_final_estime=len(set(sorted(commentaires)) | {'art-33', 'art-43', 'art-49', 'art-81'}),
            detail_total='%d clés proposées ici ∪ les 4 clés existantes qu’elles ne recouvrent pas (art-33, art-43, art-49, art-81).' % len(commentaires),
            forme='⚠️ objets ici, `string[]` en base — voir _meta.contrat_des_commentaires.',
            alerte_sur_l_assertion_11_4='⚠️ Le § 11.4 pose « les 6 existantes re-clées PLUS les 4 ajoutées = 10 ». Ce compte n’est vrai que si l’on ignore les §§ 7.3 (art. 92), 7.4 (art. 126), 7.5 (art. 96 et 104) et 7.8 (appareil), qui prescrivent chacun d’autres entrées. Une assertion codée en dur sur 10 se déclencherait à tort. Elle doit vérifier que TOUTE clé de commentaires est atteinte par segmentAnnotated, sans nombre fixe.'),
        debris_ocr=dict(
            confirmes=sum(1 for d in debris if d['statut'] == 'CONFIRMÉ'),
            refutes=sum(1 for d in debris if d['statut'].startswith('RÉFUTÉ')),
            confirmes_liste=['96 (te%)', '99 (dix (10) ans)', '35 (contribuables visés)',
                             '54 (l’excédent)', '57 (que l’Administration)', '123 (même s’ils)',
                             '118 (point d) rendu)'],
            refutes_liste=['86 (bordereau complémentaire) — 3 mesures contre, réfutation confirmée par le contrôle',
                           '116 (20% libératoire) — 2 mesures contre, réfutation confirmée par le contrôle'],
            candidats_hors_prompt=len(candidats),
            effet_sur_le_compte_de_lignes='+1 (article 118, point d) séparé) −1 (article 29, lignes 149-150 fondues) = 0. Les autres corrections sont intra-ligne.'),
        portee=dict(
            plage_controlee='1-126 par le fascicule du Moniteur ; 1-189 par la transcription de 2020, pièce de provenance inconnue',
            articles_hors_facsimile_touches=[
                '149 — seul le fragment « Réf. pages 386 et 446 » est retiré (§ 7.8, « un « Réf. page » manifeste, rien de plus »). La note N.B. entière RESTE au corps : son retrait est proposé, non prouvé.'],
            articles_hors_facsimile_non_touches=[
                '128 — encadré Budget 2010-2011, article 23 de la loi SFD de 1982, filet de cadre : retrait proposé, NON PROUVÉ, non appliqué (interdit n° 14).',
                '149 — note N.B. entière : retrait proposé, NON PROUVÉ, non appliqué.'])),
    questions_a_me_vaval=[
        '1. Le fac-similé (36 pages, articles 1-126) a été ouvert et sert d’arbitre. Faut-il l’ATTACHER à la fiche ? sourcePdfUrl et sourceFileUrl sont NULL : ce serait le premier fac-similé de ce texte au corpus, et c’est ce qui rendrait exacte toute note qui le mentionne.',
        '2. Le visa « 26 août 1879 » : versé verbatim, dossier en note (décision du 25 août). Confirmez-vous ? Le faisceau penche pour 1870.',
        '3. La ligne 185 n’était pas « tronquée » : le corps portait le libellé ENTIER, coupé en deux lignes (185 + 186 « Régime simplifié pour les petites entreprises. »). La fusion retire aussi le point final, que le J.O. ne porte pas. Modification d’une ligne de division, pas de dispositif — mais elle va au-delà de la lettre du § 7.3.',
        '4. Les 6 candidats hors § 7.5 (art. 92, 96, 19, 42, 99, 29) : à appliquer ou non ? Le script les applique tous les six ; cand-19-sept est le seul « proposé, non prouvé ».',
        '5. L’article 128 (encadré Budget + article de la loi SFD de 1982 + filet) : hors de la plage contrôlée, retrait NON appliqué. Faut-il l’autoriser ?',
        '6. L’article 149 : le « Réf. pages » part (autorisé par le § 7.8), la note N.B. reste. Faut-il retirer la note entière ?',
        '7. Le tableau de l’article 29 : restituer en richBlocksJson, ou s’en tenir à la liste réparée ? Les taux « 12.5% » / « 20 % » / « 5 % » sont laissés tels quels.',
        '8. summaryFr annonce « 189 articles » quand le texte en porte 191. Corriger le résumé ?',
        '9. effectiveDate = 2005-10-05 : ni confirmé ni infirmé, aucune clause d’entrée en vigueur dans les articles 1 à 126.',
        '10. Le décret de 1986 que celui de 2005 abroge est au corpus (CC_VANDAL_VII-D-1, statut EN_VIGUEUR) et aucun CrossRef ne relie les deux fiches. Relier ? Revoir le statut de 1986 ?',
        '11. Les articles 127 à 189 ne sont contrôlés par AUCUNE pièce faisant foi. 28 divergences entre la base et la transcription de 2020 restent inexpliquées, dont 15 au-delà de l’article 126.',
        '12. Le décret a-t-il été amendé après 2018 ? L’édition Paillant s’arrête aux lois de finances 2017-2018.',
        '13. Faut-il reprendre les 4 entrées « Préambule » de l’index de la cliente, ancrées sur %s ? Elles ne passent en aucun cas par des ctRefs.' % next(a for a, v in ANCRES_NEUVES.items() if v['role'] == 'préambule'),
    ],
    constats=[
        'Le corps en base ne porte AUCUN préambule : « Vu » 0, « Considérant » 0, « DÉCRÈTE » 0, « BONIFACE » 0, « ALEXANDRE » 0 sur les 163 065 caractères.',
        'Les trois témoins du préambule concordent sur le nombre : 19 visas et 2 considérants chacun.',
        'Une seule divergence substantielle entre les témoins du préambule : « 26 août 1879 » (fascicule et sa couche texte) contre « 26 août 1870 » (transcription 2020 et 3 documents du corpus). Le J.O. est versé VERBATIM, avec 1879, et le dossier va en note — décision de Me Vaval du 25 août.',
        'Le .docx de la cliente n’est pas un témoin indépendant du fac-similé : c’est une reprise nettoyée de sa couche texte. Là où il diverge seul des trois autres pièces, c’est lui qu’il faut soupçonner — ce qui règle les cas 86 et 116.',
        'Deux des neuf corrections du § 7.5 sont RÉFUTÉES par la mesure, et le contrôle du 25 août a confirmé les deux réfutations : l’article 86 (trois pièces lisent comme la base, dont l’article jumeau 147, et la chaîne paraît deux fois au corps) et l’article 116 (deux pièces lisent « 20% libératoire »). Ne pas les appliquer.',
        'La phrase litigieuse de l’annotation de l’article 8 est absente de QUATRE sources : le .docx du J.O. (0), la couche texte du fac-similé (0), la transcription intégrale de 2020 (0), et le corpus entier de la plateforme (0 document).',
        'Le doublon de commentaires[« sec-9|art-49 »] est réel : les entrées [0] et [1] sont identiques caractère pour caractère.',
        'L’index en base couvre 191/191 articles (369 sujets, 649 renvois, 0 renvoi mort). La formule imposée au § 7.4 pour la note de l’article 126 (« le sommaire ET l’index … ne couvrent que les articles 1 à 126 ») est donc inexacte sur l’index ; c’est le texte rectifié qui est retenu.',
        'Les 20 lignes « Sous Section » du corps s’arrêtent à la ligne 480 ; l’article 126 est en ligne 518, et aucune sous-section ne suit. Le 4ᵉ niveau du sommaire s’arrête donc de lui-même à l’article 126.',
        'Aucun fac-similé n’est attaché à la fiche : sourcePdfUrl et sourceFileUrl sont NULL. Aucune note ne doit en promettre un.',
    ],
)

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write('\n')

print('écrit :', OUT, os.path.getsize(OUT), 'octets')
print('blocs d’appareil :', len(appareil))
print('lignes déclarées :', len(_declarees), '· distinctes :', len(_distinctes),
      '· revendiquées deux fois :', _doublees)
print('clés de commentaires (préparation) :', len(commentaires), sorted(commentaires))
print('préambule :', len(PREAMBULE_LIGNES), 'lignes ·', len(PREAMBULE), 'caractères · visa « 1879 » verbatim')
print('corps cible md5 :', hashlib.md5(_corps_cible.encode('utf-8')).hexdigest(),
      '(= toc-cible.json corpsAttendu.md5)')
