# -*- coding: utf-8 -*-
"""Construit scripts/data/decret-ir-2005/reprise-divergences.json.
   N'ÉCRIT RIEN EN BASE. Ne lit que le corps déjà exporté (lecture seule)."""
import json, hashlib, os, datetime

S = '/private/tmp/claude-501/-Users-cvaval-Library-CloudStorage-Dropbox-Lam-Veritab/b86c8ab9-626b-4ed6-9e9c-f6e8779c5980/scratchpad'
P = '/Users/cvaval/Library/CloudStorage/Dropbox/Lam Veritab/lam-veritab/scripts/data/decret-ir-2005'
B = open(os.path.join(S, 'corps-actuel.txt'), encoding='utf-8').read()
L = B.split('\n')
MD5 = hashlib.md5(B.encode('utf-8')).hexdigest()

def loc(s):
    n = B.count(s)
    li = [i + 1 for i, l in enumerate(L) if s in l]
    return {'occurrences_dans_le_corps': n, 'lignes': li, 'unique': n == 1}

CORR = []
def c(art, avant, apres, cat, piece, appui, portee='fond', note=None):
    d = {'article': art, 'avant': avant, 'apres': apres, 'categorie': cat,
         'piece': piece, 'appui': appui, 'portee': portee}
    d.update(loc(avant))
    if note: d['note'] = note
    CORR.append(d)

FAC = 'piece-jo-2005-facsimile-couche-texte.txt'
TR  = 'piece-transcription-2020-191-articles.txt'

c('44', 'tel que prévu au premier paragraphe de l’article 49',
       'comme cela est prévu au premier paragraphe de l’article 49', 'b', FAC,
       "Fac-similé, art. 44 : « des états tïnanciers vérifiés, comme cela est prévu au premier paragraphe de l'article 49 ». "
       "Le sp10 et la transcription de 2020 lisent de même. La base est seule à écrire « tel que ».")
c('63', 'seront indiquées le nom et l’adresse', 'seront indiqués le nom et l’adresse', 'b', FAC,
       "Fac-similé : « sur lesquelles seront indiqués le nom et l'adresse ». Accord avec « le nom et l'adresse », non avec « factures ». "
       "Les trois autres témoins lisent « indiqués ».")
c('63-1', 'ou de crédit avec qui il a affaires à leur envoyer', 'ou de crédit avec qui il a affaire à leur envoyer', 'b', FAC,
       "Fac-similé, art. 63-1 : « avec qui il a affaire ». Le J.O. écrit bien « affaire » à l'art. 63-1 et « affaires » à l'art. 63-2 : "
       "la base a harmonisé au pluriel, la transcription de 2020 au singulier ; chacune a tort une fois. Seul l'art. 63-1 est à reprendre.")
c('63-1', 'les banques commerciales 1• Les informations', 'les banques commerciales. Les informations', 'c', FAC,
       "Fac-similé : « sur les banques commerciales. Les informations ». Le « 1• » est un appel de note de l'édition Paillant 2018 "
       "resté dans le dispositif ; il a de surcroît mangé le point final. Aucune note n'y est attachée dans annotationsJson.")
c('77', 'Article 77.- Tout acquisition de biens', 'Article 77.- Toute acquisition de biens', 'b', FAC,
       "Fac-similé : « Toute acquisition de biens ou de service effectuée ». Le participe « effectuée » du corps atteste le féminin : "
       "le « e » a été perdu à l'océrisation de l'édition de 2018.")
c('103', 'e)Toute construction érigée', 'e) Toute construction érigée', 'b', FAC,
       "Fac-similé : « e) Toute construction érigée ». Les lettres a) à d) du même article portent l'espace ; seule e) l'a perdue.",
       portee='typographique', note='Écart de forme, sans portée sur le sens.')
c('104', 'l’impôt sur la plus value sera différé', 'l’impôt sur la plus-value sera différé', 'b', FAC,
       "Fac-similé, art. 104 : « l'impôt sur la plus-value sera différé ». Le trait d'union a sauté. "
       "⚠️ Ne pas toucher au « plus value » de l'art. 103 d) : le fac-similé l'écrit lui aussi sans trait d'union.",
       portee='typographique')
c('105', 'responsable du paiement lesdits impôts', 'responsable du paiement desdits impôts', 'b', FAC,
       "Fac-similé : « sous peine d'être personnellement responsable du paiement desdits impôts et des droits d'enregistrement ». "
       "« paiement lesdits » est agrammatical.")
c('130', 'les noms, prénom et adresse du cessionnaire', 'les nom, prénom et adresse du cessionnaire', 'b',
       'corps en base (art. 32, ligne 194) + ' + FAC,
       "Appui INTERNE, indépendant de la transcription : le corps lui-même écrit « Les nom, prénom, numéro d'identification fiscale » "
       "à l'art. 32 (ligne 194), leçon que le fac-similé confirme pour cette formule. « les noms, prénom » — pluriel puis singulier — "
       "n'est cohérent dans aucune des deux lectures.",
       note="Le fac-similé s'arrête à l'article 126 : il ne couvre PAS cet article. La correction repose sur la cohérence interne du corps, "
            "que la transcription de 2020 corrobore sans en être le fondement.")
c('134', 'les noms, prénom et adresse du successeur', 'les nom, prénom et adresse du successeur', 'b',
       'corps en base (art. 32, ligne 194) + ' + FAC,
       "Même formule, même appui interne qu'à l'art. 130.",
       note="Hors couverture du fac-similé. Réserve : la base porte l'anomalie DEUX fois (130 et 134) ; deux glissements identiques "
            "sont moins probables qu'un seul, mais la source unique de l'édition de 2018 peut les expliquer ensemble.")
c('137', 'La demande d’éclaircissement tend à obtenir', 'La demande d’éclaircissements tend à obtenir', 'b',
       'corps en base (art. 136)',
       "Appui INTERNE : l'art. 136 du corps écrit « l'envoi au redevable d'une demande d'éclaircissementS ou de justification » ; "
       "l'art. 137 définit cette demande-là. Le corps se contredit d'un article à l'autre.",
       note="Hors couverture du fac-similé.")
c('144', 'articles 140, 141et142.', 'articles 140, 141 et 142.', 'b', 'corps en base (évidence mécanique)',
       "Mots collés : « 141et142 ». Débris d'océrisation manifeste, démontrable sans aucun témoin externe.")
c('144', 'La constatation ne peut porter que sur', 'La contestation ne peut porter que sur', 'b',
       'corps en base (art. 167 ligne 664, art. 107 ligne 447) + sens de l’article',
       "Appui INTERNE : l'article s'ouvre sur « Pour contester le mode de taxation… » ; le corps écrit « la contestation » aux art. 107 et 167 "
       "et « La constatation » ici seulement. Le sens commande « contestation » : c'est le recours, non un constat, qui est borné à "
       "l'existence et à la consistance des éléments de train de vie.",
       note="Hors couverture du fac-similé.")
c('157', 'Assurance vie : le montant de la réserve mathématique selon les\nformules soumises',
       'Assurance vie : le montant de la réserve mathématique selon les formules soumises', 'b',
       'corps en base (évidence mécanique)',
       "La phrase est COUPÉE en deux lignes du corps (lignes 634 et 635), au milieu d'un groupe nominal. "
       "Même défaut que l'ancienne ligne 185, fondue par l'application du 25 août (§ 7.3).",
       note="Remplacement multiligne : la chaîne « selon les\\nformules » est unique dans le corps.")
c('158', 'Les compagnies d’assurance haïtienne soumettront', 'Les compagnies d’assurance haïtiennes soumettront', 'b',
       'corps en base (art. 159, ligne 643)',
       "Appui INTERNE : le corps écrit « Les compagnies d'assurance haïtiennes » à la ligne 643 (art. 159). "
       "Le sujet est pluriel et le verbe « soumettront » l'est aussi.",
       note="Hors couverture du fac-similé.")
c('168', 'de la Direction de l’ Inspection Fiscale du Ministère de l’Economie et de Finances',
       'de la Direction de l’Inspection Fiscale du Ministère de l’Economie et des Finances', 'b',
       'corps en base (22 occurrences contraires)',
       "Deux débris sur la même ligne. (1) apostrophe détachée « l’ Inspection ». (2) « et de Finances » : "
       "le corps écrit « Ministère de l'Economie et DES Finances » 22 fois sur 23 ; cette occurrence est la seule fautive.",
       note="Hors couverture du fac-similé, mais démontré par le corps seul.")
c('168', 'qui fixera sa position Si la question', 'qui fixera sa position. Si la question', 'b',
       'corps en base (évidence mécanique)',
       "Point final perdu entre deux phrases : « …qui fixera sa position Si la question est fixée à sa convenance… ».")
c('168', 'dans les quatre vingt dix (90) jours', 'dans les quatre-vingt-dix (90) jours', 'b',
       'corps en base (art. 44, ligne 216) + ' + FAC,
       "Appui INTERNE : le corps écrit « quatre-vingt-dix (90) jours » à l'art. 44 (ligne 216), leçon du fac-similé pour cet article-là. "
       "Traits d'union perdus ici seulement.", portee='typographique')
c('170', 'l’Unité de Lutte Contre le Corruption', 'l’Unité de Lutte Contre la Corruption', 'b',
       'corps en base (art. 183, ligne 715)',
       "Appui INTERNE : le corps écrit « l'Unité de Lutte Contre LA Corruption » à l'art. 183 (ligne 715). "
       "« le Corruption » est impossible en français.",
       note="Hors couverture du fac-similé. La transcription de 2020 développe en outre le sigle (ULCC) : "
            "ce développement N'EST PAS repris, la base ne porte aucun sigle développé (mesuré : 0 occurrence de (ULCC), (BRH), (TCA)).")
c('170', 'les Conseils d’ Administration des Sections Communales', 'les Conseils d’Administration des Sections Communales', 'b',
       'corps en base (évidence mécanique)',
       "Apostrophe détachée. Même famille de débris que « l’ Administration » (art. 107) et « l’ Inspection » (art. 168).",
       portee='typographique')
c('184', 'des prescription indiquées au présent article', 'des prescriptions indiquées au présent article', 'b',
       'corps en base (évidence mécanique)',
       "« des prescription indiquées » : article et participe au pluriel, nom au singulier. Accord impossible, "
       "démontrable sans témoin externe.",
       note="Hors couverture du fac-similé.")

# ------------------------------------------------------------------ divergences
D = []
def d(art, base, tr, cat, verdict, arbitre, motif, corrige=False, extra=None):
    o = {'article': art, 'au_dela_de_126': art not in ('34','35','44','63','63-1','63-2','74','77','99','103','104','105','112'),
         'ce_qu_ecrit_la_base': base, 'ce_qu_ecrit_la_transcription_2020': tr,
         'categorie': cat, 'verdict': verdict, 'arbitre': arbitre, 'motif': motif,
         'appelle_une_correction_du_corps': corrige}
    if extra: o.update(extra)
    D.append(o)

FACOK = "le fac-similé (couche texte du fascicule du Moniteur) — plage 1-126"
SEUL  = "AUCUN — au-delà de l'article 126 la transcription de 2020 est le SEUL témoin du texte d'origine ; elle n'a pas l'autorité de deux"

d('34', "et toutes recettes généralement quelconque liées à des marchandises",
      "et toutes recettes généralement quelconques liées", 'd', 'la base a raison', FACOK,
      "Le fac-similé écrit « quelconque » (art. 34, ligne 566), comme la base. La faute d'accord est celle du J.O. de 2005 ; "
      "la transcription de 2020 la corrige silencieusement. À noter : piece-jo-2005-moniteur-sp10.txt écrit « quelconques » — "
      "cette pièce est elle-même une transcription NETTOYÉE, ce qui justifie que l'arbitre soit le fac-similé et non elle.")
d('35', "« …et autres contribuables visés à l’article 33 » (mot rendu le 25 août à 11:04)",
      "« …et autres contribuables visés à l’article 33 »", 'résolu', 'divergence éteinte', FACOK,
      "Le mot « visés » manquait au corps ; l'application du 25 août (§ 7.5) l'a rendu. La divergence n'existe plus. "
      "⚠️ RÉSERVE MESURÉE : la couche texte du fac-similé n'écrit PAS « visés » (« et autres contribuables à l'article 33 ») ; "
      "le mot tombe en fin de ligne dans le fascicule. Seuls sp10 et la transcription de 2020 le portent. La correction reste défendable "
      "(la phrase est agrammaticale sans lui) mais elle n'est pas couverte par l'arbitre.",
      extra={'ecart_residuel': "« 1 % » (base) / « 1% » (transcription) — catégorie (e), sans portée",
             'consolidation_posterieure': {
               'texte': "Loi de finances 2017-2018, Le Moniteur Spécial n° 27 du 19 septembre 2017",
               'au_corpus': True,
               'ce_qu_elle_dit': "« Le 2ème paragraphe de l'article 35 du Décret du 29 septembre 2005 relatif à l'impôt sur le Revenu se lit "
                                 "désormais comme suit : En aucun cas, l'Impôt sur le Revenu sur la base forfaitaire ne peut être inférieur "
                                 "à dix mille (10,000.00) gourdes. »",
               'etat_du_corps': "Le corps écrit encore « cinq mille (5,000.00) gourdes » — la rédaction de 2005.",
               'portee': "LACUNE DE CONSOLIDATION, pas une correction du texte de 2005. La note de crossRefs annonce pourtant la "
                         "LF 2017-2018 comme intégrée, et l'édition Paillant l'a bien appliquée aux art. 8, 33, 43, 45, 49, 81 et 96. "
                         "Décision à Me Vaval : ne rien changer sans qu'elle tranche."}})
d('44', "des états financiers vérifiés, tel que prévu au premier paragraphe de l’article 49",
      "…, comme cela est prévu au premier paragraphe de l’article 49", 'b', 'la base a tort', FACOK,
      "Le fac-similé écrit « comme cela est prévu ». La base est seule contre les trois autres témoins.", corrige=True)
d('63', "sur lesquelles seront indiquées le nom et l’adresse", "…seront indiqués le nom et l’adresse", 'b',
      'la base a tort', FACOK, "Le fac-similé écrit « indiqués ».", corrige=True,
      extra={'ecarts_voisins_sans_portee': "« prestataires de service » (sing.), « (10.000) », « cent mille gourdes (100.000) », « (250.000) » : "
             "le fac-similé donne raison à la base sur les quatre. La transcription de 2020 met les pluriels et remplace le point "
             "des milliers par une virgule — catégorie (d)."})
d('63-1', "« avec qui il a affaires » ; « banques commerciales 1• Les informations » ; « l’inspection Fiscale » (minuscule)",
      "« avec qui il a affaire » ; « banques commerciales. » ; « (DGI) », « (BRH) » développés", 'b+c',
      'la base a tort sur deux points', FACOK,
      "Fac-similé : « avec qui il a affaire » et « banques commerciales. Les informations ». Le « 1• » est un appel de note de "
      "l'édition Paillant. En revanche « sur qui pèse des soupçons » (singulier) et « actionnaires, ou autres » sont bien la leçon "
      "du fac-similé : la base a raison, la transcription corrige.", corrige=True)
d('63-2', "« avec qui il a affaires » ; « en cas de dommage des biens » ; « se feront autorisés »",
      "« affaire » ; « dommages » ; « autoriser »", 'd', 'la base a raison sur les trois', FACOK,
      "Le fac-similé écrit « affaires », « dommage », « se feront autorisés ». Le J.O. de 2005 est ici agrammatical et la base le "
      "reproduit fidèlement. C'est l'écart que la confrontation avait dit « indécidable » : le fac-similé le décide, et il décide "
      "contre la transcription. Les tirets de liste du corps ne sont pas au fascicule : catégorie (e), sans portée.")
d('74', "« les professionnels dont leur domicile fiscal est situé hors d’Haïti » ; « les tenanciers des jeux » ; « (10.000) »",
      "« dont le domicile » ; « les tenanciers de jeux » ; « (10,000) »", 'd', 'la base a raison sur les trois', FACOK,
      "Fac-similé : « perçus par les professionnels dont leur domicile fiscal est situé hors d'Bani [Haïti] », « les tenanciers DES jeux », "
      "« Dix Mille (10.000) gourdes ». Les lettres a) b) c) sont au fascicule et au corps ; la transcription les a supprimées.",
      extra={'consolidation_posterieure': {
               'textes': ["Loi de finances 2023-2024, art. 37 — réécrit l'article 74 en entier (retenue des professionnels ramenée de 20 % à 15 %)",
                          "Loi de finances 2024-2025, art. 38 — le réécrit à nouveau (minimum porté à 25 000 gourdes)",
                          "Loi de finances 2025-2026, art. 36 — idem",
                          "Lois de finances 2021-2022 (art. 33), 2023-2024 (art. 27), 2024-2025 (art. 28), 2025-2026 (art. 26) — ajoutent un paragraphe (transport en commun, 4 000 gourdes)"],
               'au_corpus': True,
               'portee': "TOUTES POSTÉRIEURES à l'édition Paillant 2018, dont le corps est la reproduction : le corps n'a pas à les porter "
                         "en l'état, mais le document est présenté comme « texte consolidé ». À arbitrer par Me Vaval, séparément.",
               'piege': "La LF 2024-2025 art. 38 écrit « les professionnels dont LE domicile fiscal » — la leçon de la transcription de 2020. "
                        "Cela ne prouve rien sur 2005 : c'est une rédaction de 2024."}})
d('77', "Tout acquisition de biens ou de service effectuée", "Toute acquisition de biens ou de services, effectuée", 'b',
      'la base a tort sur « Tout »', FACOK,
      "Fac-similé : « Toute acquisition ». Sur les trois « service » au singulier et sur les virgules, en revanche, le fac-similé "
      "donne raison à la base.", corrige=True)
d('99', "« …n’a pas encore dix (10) ans depuis qu’il est propriétaire » (mot rendu le 25 août à 11:04)",
      "idem", 'résolu', 'divergence éteinte', FACOK,
      "Le mot « ans » manquait ; il a été rendu ce matin. Le fac-similé confirme : « n'a pas encore dix (10) ans depuis qu'il est "
      "propriétaire ». La correction était fondée. Écart résiduel : « plus ; » / « plus; » — catégorie (e).")
d('103', "de 20% de la plus-values à court terme", "de 20% de la plus-value à court terme", 'd', 'la base a raison', FACOK,
      "Le fac-similé écrit « de 20% de la plus-values à court terme » : la faute de nombre est celle du J.O. de 2005. "
      "De même « la plus value sera calculée » (alinéa d), sans trait d'union, est bien la leçon du fascicule. "
      "Ne rien changer au dispositif ; une note pourrait le dire au lecteur.",
      extra={'correction_mineure_annexe': "« e)Toute » (sans espace) — débris typographique, corrigé séparément."})
d('104', "vérifiés par un commissaire aux comptes", "vérifiés par un commissionnaire aux comptes",
      'décision éditoriale documentée', 'ni faute ni inexpliqué', FACOK,
      "CET ÉCART N'EST PAS INEXPLIQUÉ : il est déjà documenté en base, dans annotationsJson.commentaires['sec-49|art-104'] — "
      "« Les trois témoins du texte de 2005 […] écrivent “commissionnaire aux comptes”. L'édition consolidée de 2018, reproduite ici, "
      "écrit “commissaire aux comptes”, terme du droit des sociétés. Le corps suit l'édition de 2018. » "
      "La confrontation l'avait rangé en (f) faute d'avoir lu la note. Il sort de la liste des inexpliqués.",
      extra={'correction_mineure_annexe': "« l’impôt sur la plus value » — trait d'union perdu, que le fac-similé porte ; corrigé séparément."})
d('105', "personnellement responsable du paiement lesdits impôts", "…du paiement desdits impôts", 'b', 'la base a tort', FACOK,
      "Fac-similé : « du paiement desdits impôts et des droits d'enregistrement ». Sur les montants « (10,000.00) » et « (120,000.00) » "
      "et sur l'absence de virgules, le fac-similé donne au contraire raison à la base.", corrige=True,
      extra={'signale_non_propose': "Les items 7) et 8) de l'énumération ont perdu leur point-virgule final, que le fascicule porte. "
             "Non proposé ici : correction d'appareil typographique à traiter en lot."})
d('112', "à titre de libéralités généralement quelconque, sauf preuve contraire",
      "…généralement quelconques, sauf preuve contraire", 'd', 'la base a raison', FACOK,
      "Fac-similé : « à titre de libéralités généralement quelconque ». Même verrue qu'à l'art. 34, même conclusion. "
      "Les lettres a) à d) sont au fascicule et au corps.")

d('130', "2) les noms, prénom et adresse du cessionnaire", "les nom, prénom et adresse du cessionnaire", 'b',
      'la base a tort', SEUL,
      "Fondé NON sur la transcription mais sur la cohérence interne du corps : art. 32 (ligne 194) « Les nom, prénom, numéro "
      "d'identification fiscale… », leçon que le fac-similé confirme pour cette formule-là. « les noms, prénom » n'est cohérent "
      "dans aucune lecture.", corrige=True,
      extra={'exclusion_consolidation': "Aucun texte du corpus ne modifie ni ne cite un article 130-189 du décret "
             "(requête SQL sur l'ensemble des documents : 0 résultat). La catégorie (a) est exclue."})
d('134', "les noms, prénom et adresse du successeur", "les nom, prénom et adresse du successeur", 'b',
      'la base a tort', SEUL, "Même formule et même appui interne qu'à l'art. 130.", corrige=True,
      extra={'reserve': "La base porte l'anomalie DEUX fois (130 et 134). Deux glissements identiques sont moins probables qu'un ; "
             "une même source d'édition peut cependant les expliquer ensemble. À valider par Me Vaval."})
d('137', "La demande d’éclaircissement tend à obtenir", "La demande d’éclaircissements tend à obtenir", 'b',
      'la base a tort', SEUL,
      "Appui interne : l'art. 136 du corps écrit « une demande d'éclaircissementS ou de justification » ; l'art. 137 définit "
      "cette demande-là. Le corps se contredit d'un article à l'autre.", corrige=True,
      extra={'signale_non_propose': "La ponctuation de l'énumération est incohérente dans le corps : « 1) …famille. », « 2) …global » "
             "(aucune ponctuation), « 3) … ». Non proposé : correction d'appareil."})
d('144', "« articles 140, 141et142. » ; « La constatation ne peut porter que sur… »",
      "« articles 140, 141 et 142. » ; « La contestation ne peut porter… »", 'b',
      'la base a tort sur les deux', SEUL,
      "(1) « 141et142 » : mots collés, débris mécanique démontrable sans témoin. "
      "(2) « constatation » : l'article s'ouvre sur « Pour contester le mode de taxation… » ; le corps écrit « la contestation » "
      "aux art. 107 et 167 et « La constatation » ici seulement ; le sens commande « contestation ».", corrige=True)
d('157', "« (état des revenus et dépenses, bilan, états des sources…) » ; phrase coupée en deux lignes du corps",
      "« (états des revenus et dépenses…) » ; phrase d'un seul tenant", 'd + b',
      'la base a raison sur « état », tort sur la ligne coupée', SEUL,
      "« état des revenus et dépenses » au singulier est la désignation du décret lui-même : l'art. 44, au fac-similé, écrit "
      "« le bilan, l'état des revenus et dépenses, l'état de l'évolution de la situation financière ». La base est cohérente ; "
      "la transcription met un pluriel. EN REVANCHE la phrase « …selon les / formules soumises et approuvées… » est coupée entre "
      "les lignes 634 et 635 du corps : même défaut que l'ancienne ligne 185.", corrige=True)
d('158', "Les compagnies d’assurance haïtienne soumettront", "Les compagnies d’assurance haïtiennes soumettront", 'b',
      'la base a tort', SEUL,
      "Appui interne : le corps écrit « Les compagnies d'assurance haïtiennes » à la ligne 643 (art. 159).", corrige=True)
d('160', "b) pour la compagnie d’assurance étrangère ou DE son réassureur",
      "pour la compagnie d’assurance étrangère ou son réassureur", 'f',
      'INEXPLIQUÉ — laissé tel quel', SEUL,
      "L'alinéa a) du même article écrit « ou son réassureur » : le corps se contredit d'un alinéa à l'autre, et la transcription "
      "lit comme a). Mais l'écart ne change pas le sens, et la plage 1-126 a montré que le J.O. de 2005 porte beaucoup de verrues "
      "de ce type que la base reproduit fidèlement. Sur un seul témoin, on ne tranche pas. NON CORRIGÉ.")
d('168', "« Ministère de l’Economie et de Finances » ; « l’ Inspection » ; « sa position Si » ; « quatre vingt dix » ; "
        "énumération a) b) … d), la lettre c) MANQUE",
      "« et des Finances » ; « l’Inspection » ; « sa position. » ; « quatre-vingt-dix » ; aucune lettre (la transcription les supprime toutes)",
      'b + f', 'la base a tort sur quatre points ; la lettre c) reste inexpliquée', SEUL,
      "Quatre débris démontrables par le corps seul : (1) « et de Finances » — 1 occurrence contre 22 « et des Finances » ; "
      "(2) apostrophe détachée « l’ Inspection » ; (3) point final perdu « sa position Si la question » ; "
      "(4) « quatre vingt dix » contre « quatre-vingt-dix » à l'art. 44. "
      "EN REVANCHE la lettre c) manquante ne se reconstruit pas : la transcription supprime TOUTES les lettres et ne peut donc pas "
      "dire où c) commençait ; le fac-similé ne couvre pas l'article. RESTE INEXPLIQUÉ.", corrige=True)
d('170', "« l’Unité de Lutte Contre le Corruption » ; « les Conseils d’ Administration »",
      "« …contre la Corruption (ULCC) » ; « les Conseils d’Administration »", 'b', 'la base a tort sur les deux', SEUL,
      "Appui interne : le corps écrit « l'Unité de Lutte Contre LA Corruption » à l'art. 183 (ligne 715) ; « le Corruption » est "
      "impossible en français. L'apostrophe détachée est de la même famille que « l’ Administration » (art. 107) et « l’ Inspection » (art. 168). "
      "Le développement des sigles (ULCC), (BRH), (DGI) par la transcription N'EST PAS repris : le corps n'en porte aucun.", corrige=True)
d('171', "et qui payent des salaires", "et qui paient des salaires", 'f', 'INEXPLIQUÉ — laissé tel quel', SEUL,
      "« payent » et « paient » sont deux graphies également admises du verbe payer. Occurrence unique dans le corps : aucun appui "
      "interne. Sur un seul témoin, on ne tranche pas. NON CORRIGÉ.")
d('174', "afin d’en donner suite", "afin d’y donner suite", 'f', 'INEXPLIQUÉ — laissé tel quel', SEUL,
      "« donner suite À une demande » appelle « y donner suite » ; « en donner suite » n'est pas français. Mais l'argument est "
      "purement grammatical, l'occurrence est unique dans le corps, et « en » pour « y » n'est pas un débris d'océrisation "
      "(ce n'est pas une confusion de forme). Sur un seul témoin, on ne tranche pas. NON CORRIGÉ — candidate à l'arbitrage de Me Vaval.")
d('178', "les articles de lois y relatifs", "les articles de loi y relatifs", 'f', 'INEXPLIQUÉ — laissé tel quel', SEUL,
      "Les deux graphies se défendent (« articles de loi » et « articles de lois » se lisent l'une et l'autre). Occurrence unique, "
      "aucun appui interne. NON CORRIGÉ.")
d('184', "« des prescription indiquées » ; « demander le paiement de l’impôt et DE pratiquer l’estimation d’office »",
      "« des prescriptions indiquées » ; « …et pratiquer l’estimation d’office »", 'b + f',
      'la base a tort sur « prescription » ; « et de pratiquer » reste inexpliqué', SEUL,
      "(1) « des prescription indiquées » : article et participe au pluriel, nom au singulier — accord impossible, démontrable "
      "par le corps seul. CORRIGÉ. "
      "(2) « et de pratiquer » rompt le parallélisme de « pour exiger…, contester…, demander… et pratiquer… », mais l'appui est "
      "purement grammatical et le témoin unique. NON CORRIGÉ. "
      "(3) Le développement (TCA) de la transcription n'est pas repris — catégorie (d). "
      "(4) Les marqueurs i./ii./iii., a) b) c), 1) 2) 3) du corps sont absents de la transcription — catégorie (e).", corrige=True)
d('186', "l’administration fiscale n’appliquera PAS contre eux ni majoration ni intérêts de retard",
      "l’Administration fiscale n’appliquera contre eux ni majoration ni intérêts de retard", 'f',
      'INEXPLIQUÉ — laissé tel quel', SEUL,
      "« ne … ni … ni » exclut « pas » : la base porte un solécisme. Mais le sens est identique dans les deux lectures, l'appui est "
      "purement grammatical, le témoin est unique, et la plage 1-126 a montré que le J.O. de 2005 porte des fautes de ce genre "
      "que la base reproduit. NON CORRIGÉ — candidate à l'arbitrage de Me Vaval. "
      "Second écart : « déclarations d’impôts des sociétés » (base) / « déclarations d’Impôt des Sociétés » (transcription) — "
      "ni l'une ni l'autre ne reprend le nom que l'art. 1er donne à l'impôt (« Impôt sur les Sociétés ») : catégorie (e).")
d('189', "Le corps s’arrête à « …à la diligence du Ministre de l’Economie et des Finances. » — la formule de clôture MANQUE "
        "en entier (date, lieu, An de l’Indépendance, signature du Président et de dix-sept ministres, 207 mots). "
        "Et : « …qui lui sont contraires ET sera publié ».",
      "« …qui lui sont contraires. IL sera publié et exécuté… » puis « Donné au Palais National, à Port-au-Prince, le 29 septembre 2005, "
      "An 202ème de l’Indépendance. Par le Président : Me. Boniface ALEXANDRE ; Le Premier Ministre : Gérard LATORTUE ; … » (17 ministres)",
      'f', 'INEXPLIQUÉ — la plus lourde des 28 ; NON versée au dispositif', SEUL,
      "MESURÉ : « Palais National », « LATORTUE », « BAZIN », « 202 » ne figurent NI dans le fac-similé NI dans piece-jo-2005-moniteur-sp10.txt "
      "(0 occurrence dans les deux pièces, qui s'interrompent l'une et l'autre à l'article 126). La transcription de 2020 est donc le SEUL "
      "témoin de ces 207 mots. Des vérifications externes concordent — le préambule versé ce matin nomme bien « Me. BONIFACE ALEXANDRE, "
      "Président Provisoire de la République » ; l'« An 202ème » est arithmétiquement juste pour le 29 septembre 2005 ; le gouvernement "
      "Latortue est en fonction à cette date — mais ces vérifications ne font pas de la transcription un second témoin. "
      "RECOMMANDATION : ne pas verser au corps. Deux voies, à l'arbitrage de Me Vaval : (1) une note sous l'article 189 qui donne la formule "
      "et nomme sa provenance et son unique témoin ; (2) le versement au dispositif si le fascicule complet du Moniteur est retrouvé. "
      "C'est la doctrine appliquée au préambule le 25 août — à une différence près, décisive : le préambule, lui, EST couvert par le fac-similé. "
      "Le second écart (« contraires et sera publié » / « contraires. Il sera publié ») est une variante de rédaction sans effet sur le sens, "
      "sur témoin unique : NON CORRIGÉ.")

comptes = {}
for x in D: comptes[x['categorie']] = comptes.get(x['categorie'], 0) + 1

OUT = {
 'objet': "Reprise des 28 divergences restées « inexpliquées » dans confrontation-191.json, dont 15 au-delà de l'article 126.",
 'document': 'cms43ptub00008lo8tv3y25kk',
 'genere_le': datetime.datetime.now().isoformat(timespec='seconds'),
 'aucune_ecriture_en_base': True,
 'etat_du_corps_travaille': {
   'lignes': len(L), 'caracteres': len(B), 'md5': MD5,
   'note': "État POSTÉRIEUR à l'application du 25 août 2026 à 11:04 (import-decret-ir-2005-sommaire.ts --apply). "
           "etat-2026-08-25-corps.txt, sur lequel confronter_191.py avait travaillé, est l'état d'AVANT (749 lignes)."},
 'hierarchie_des_pieces': {
   '1_a_126': "Le fac-similé (piece-jo-2005-facsimile-couche-texte.txt) ARBITRE. piece-jo-2005-moniteur-sp10.txt est une transcription "
              "déjà nettoyée du même fascicule : elle corrige silencieusement le J.O. (mesuré sur « quelconque(s) », « pèse(nt) », « visés ») "
              "et ne peut donc pas servir d'arbitre.",
   'au_dela_de_126': "La transcription de 2020 est le SEUL témoin du texte d'origine. Elle n'a pas l'autorité de deux. "
              "Une correction n'est proposée au-delà de 126 QUE si le corps se contredit lui-même ou si le débris est mécaniquement "
              "évident (mots collés, apostrophe détachée, point manquant, accord impossible) — jamais sur la seule autorité de la transcription.",
   'reserve_sur_le_fac_simile': "La couche texte du fac-similé est elle-même de l'océrisation. Quand elle donne raison à la base, ce qui pèse "
              "est l'accord de DEUX chaînes d'océrisation indépendantes (le fascicule et le livre de 2018) sur la même leçon, non le fac-similé seul."},
 'ce_que_mesure_la_plage_1_126': {
   'constat': "Sur les écarts de fond des 13 divergences situées entre les articles 1 et 126, le fac-similé donne raison à la BASE environ "
              "deux fois sur trois. La transcription de 2020 corrige silencieusement le Journal officiel : accords et pluriels "
              "(« quelconques », « pèsent », « indiqués »…), sigles développés ((DGI) 93 fois, (BRH), (ULCC), (TCA) — 0 fois au fascicule), "
              "virgules ajoutées, séparateurs de milliers changés (point → virgule), marqueurs de liste supprimés.",
   'consequence': "Au-delà de l'article 126, un écart où la base est simplement moins correcte grammaticalement que la transcription est "
              "plus probablement une verrue du J.O. fidèlement reproduite qu'une faute du corps. C'est le fondement des six « toujours inexpliqué »."},
 'exclusion_de_la_categorie_a_au_dela_de_126': {
   'methode': "Requête SQL en lecture seule sur l'ensemble du corpus : aucun document autre que le décret lui-même ne cite ni ne modifie "
              "un article 130 à 189 du Décret du 29 septembre 2005 (0 résultat). 19 documents citent le décret ; aucun ces articles-là.",
   'conclusion': "Aucune des 15 divergences au-delà de l'article 126 ne s'explique par une consolidation postérieure."},
 'consolidations_trouvees_incidemment': [
   {'article': '35', 'texte': "Loi de finances 2017-2018 (Moniteur Spécial n° 27 du 19 septembre 2017)", 'au_corpus': True,
    'constat': "Le 2ème paragraphe a été réécrit — minimum porté de cinq mille à DIX MILLE gourdes. Le corps porte encore « cinq mille "
               "(5,000.00) gourdes ». Lacune de consolidation, à trancher par Me Vaval ; ce n'est pas une correction du texte de 2005."},
   {'article': '74', 'textes': "LF 2021-2022 art. 33 ; LF 2023-2024 art. 27 et 37 ; LF 2024-2025 art. 28 et 38 ; LF 2025-2026 art. 26 et 36",
    'au_corpus': True,
    'constat': "L'article a été réécrit trois fois et complété quatre fois, toutes postérieurement à l'édition Paillant 2018 que le corps "
               "reproduit. Le corps n'a pas à les porter en l'état, mais le document est présenté comme « texte consolidé »."}],
 'comptes': {
   'divergences_reprises': len(D),
   'au_dela_de_126': sum(1 for x in D if x['au_dela_de_126']),
   'par_categorie': comptes,
   'appellent_une_correction': sum(1 for x in D if x['appelle_une_correction_du_corps']),
   'corrections_prêtes': len(CORR)},
 'divergences': D,
 'corrections': CORR,
 'interdits_respectes': ["aucune écriture en base", "aucun --apply", "aucun git add/commit/push", "aucun runSearch()", "aucun npm run build"],
}
p = os.path.join(P, 'reprise-divergences.json')
json.dump(OUT, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('écrit :', p, os.path.getsize(p), 'octets')
print('divergences', len(D), '| au-delà de 126 :', sum(1 for x in D if x['au_dela_de_126']))
print('par catégorie :', comptes)
print('corrections prêtes :', len(CORR), '| toutes uniques :', all(x['unique'] for x in CORR))
