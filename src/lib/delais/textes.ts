/**
 * § 5.5 — LES TEXTES GELÉS. **AUCUN `Date` DANS CE FICHIER.**
 *
 * Le calcul ne doit dépendre d'aucune requête à la base, et personne ne doit pouvoir
 * modifier la règle de calcul en éditant un document du corpus. Chaque texte ci-dessous a
 * été relu **mot pour mot en base de production le 19 août 2026** et est recopié tel quel,
 * y compris ses coquilles d'OCR et sa ponctuation d'origine.
 *
 * `scripts/verify-delais-sources.ts` — LECTURE SEULE — relit ces articles en base et affiche
 * le diff. Un diff non vide est un signal humain, pas une mise à jour automatique.
 */

export type TexteGele = {
  /** Référence telle qu'elle s'affiche : « C. pr. civ., art. 987 ». */
  reference: string
  /** Le texte, VERBATIM. Jamais traduit (convention du dépôt : `Document.bodyOriginal`). */
  texte: string
  /** D'où il vient, en toutes lettres. */
  source: string
  /** `Document.id` en base de production, pour le lien profond et pour la vérification. */
  docId: string
  /** Date de la lecture en base. */
  luLe: string
}

const LU_LE = '2026-08-19'

export const DOC_CPC = 'cms7u9239000212wwoddflgnu'
export const DOC_CTRAV = 'cmr102ish0012ttoijkh8f31e'
export const DOC_CCIV = 'cmr4b6f3v0000iz56asjmwrlg'
export const DOC_CONST = 'cmr1it23a0000b4r0l6r1xp5l'
export const DOC_MONITEUR_1989 = 'cmsw5mxng000ag85y3o2ey2rr'

/** Les articles gelés, par clé. */
export const TEXTES: Record<string, TexteGele> = {
  'cpc-987': {
    reference: 'C. pr. civ., art. 987',
    texte:
      'Article 987.- Tous les délais prévus au Code de procédure civile sont francs.\n' +
      'Le délai franc est celui dans lequel ne se comptent ni le jour du départ, ni le jour de l’échéance.\n' +
      'Quand il y a lieu à augmentation, à raison de la distance, le délai sera augmenté d’un jour par quarante kilomètres.\n' +
      'Les fractions de moins de trente kilomètres ne sont pas comptées, les fractions de trente kilomètres et au-dessus augmentent les délais d’un jour.',
    source: 'Code de procédure civile d’Haïti, promulgué le 17 janvier 1964',
    docId: DOC_CPC,
    luLe: LU_LE,
  },
  'cpc-991': {
    reference: 'C. pr. civ., art. 991',
    texte:
      'Article 991.- A moins qu’il y ait péril en la demeure expressément indiqué dans la décision, l’exécution provisoire sur minute ne pourra être prononcée, à peine de prise à partie contre le juge.\n' +
      'Aucune signification ni exécution ne pourra être faite avant six heures du matin et après six heures du soir, non plus que les dimanches et les jours de fêtes légales, si ce n’est en vertu de permission du juge, dans le cas où il y aura péril en la demeure.\n' +
      'Les délais légaux seront prorogés d’un jour, si le dernier est un dimanche ou un jour de fête légale.\n' +
      'Il en est de même lorsque, au dernier jour, le chômage est prescrit par arrêté du Président de la République.',
    source: 'Code de procédure civile d’Haïti, promulgué le 17 janvier 1964',
    docId: DOC_CPC,
    luLe: LU_LE,
  },
  'cpc-996': {
    reference: 'C. pr. civ., art. 996',
    texte:
      'Article 996.- La signification d’une décision fait courir les délais des recours et contre la partie à la requête de qui elle a lieu et contre celle qui l’a reçue.',
    source: 'Code de procédure civile d’Haïti, promulgué le 17 janvier 1964',
    docId: DOC_CPC,
    luLe: LU_LE,
  },
  'cpc-74': {
    reference: 'C. pr. civ., art. 74',
    texte:
      'Article 74.- Le délai des ajournements sera de trente jours francs pour ceux qui demeurent dans les Antilles ou sur le continent américain, et de quarante-cinq jours francs pour ceux qui demeurent au-delà de l’un ou de l’autre océan. En cas de guerre, les délais peuvent être augmentés.',
    source: 'Code de procédure civile d’Haïti, promulgué le 17 janvier 1964',
    docId: DOC_CPC,
    luLe: LU_LE,
  },
  'cpc-12': {
    reference: 'C. pr. civ., art. 12',
    texte:
      'Article 12.- Les juges de paix jugeront tous les jours même les dimanches et autres jours fériés. Ils pourront donner audience chez eux, en tenant les portes ouvertes.',
    source: 'Code de procédure civile d’Haïti, promulgué le 17 janvier 1964',
    docId: DOC_CPC,
    luLe: LU_LE,
  },
  'ctrav-511': {
    reference: 'C. trav., art. 511',
    texte:
      'Article 511. Tous les délais de procédure prévus au Code du Travail sont francs. Le délai franc est celui dans lequel ne se compte ni le jour du départ ni le jour de l’échéance.\n' +
      'Les délais légaux sont prorogés d’un jour si le dernier jour est un dimanche ou un jour férié légal ou prescrit par Arrêté Présidentiel.',
    source: 'Code du travail (Décret du 24 février 1984), édition annotée J.-F. Salès',
    docId: DOC_CTRAV,
    luLe: LU_LE,
  },
  'ctrav-512': {
    reference: 'C. trav., art. 512',
    texte:
      'Article 512. Aucune signification ni exécution ne pourra être faite avant huit heures du matin et après cinq heures du soir, non plus les dimanches et les jours fériés chômés.\n' +
      'Toute signification ou exécution faite au mépris du présent article est nulle.',
    source: 'Code du travail (Décret du 24 février 1984), édition annotée J.-F. Salès',
    docId: DOC_CTRAV,
    luLe: LU_LE,
  },
  'ctrav-108': {
    reference: 'C. trav., art. 108',
    texte:
      'Article 108. Les travailleurs doivent bénéficier, sans diminution de salaire, du repos hebdomadaire, des jours fériés chômés et des jours de chômage autorisés par Arrêté Présidentiel, sauf s’ils sont employés pour effectuer un travail à caractère provisoire.',
    source: 'Code du travail (Décret du 24 février 1984), édition annotée J.-F. Salès',
    docId: DOC_CTRAV,
    luLe: LU_LE,
  },
  'ctrav-110': {
    reference: 'C. trav., art. 110 (décret du 23 mai 1989, reproduit)',
    texte:
      'Article 110. Modifié par le Décret du 23 mai 1989 ainsi qu’il suit:\n' +
      'Article 1. Dès la publication du présent Décret, les Fêtes légales sont:\n' +
      'Le Mardi Gras\n' +
      'Le Vendredi Saint\n' +
      'La Fête Dieu\n' +
      'L’Assomption\n' +
      'Le 17 Octobre, mort de Dessalines\n' +
      'Le 2 Novembre, Fêtes des Morts\n' +
      'Le 25 Décembre, Jour de Noël.\n' +
      'Article 2. L’Administration Publique, le Commerce, l’Industrie et les Ecoles chômeront à l’occasion des Fêtes Nationales et Légales."',
    source:
      'Code du travail, art. 110 — reproduction du Décret du 23 mai 1989. Source primaire : ' +
      'Le Moniteur n° 47-A du jeudi 22 juin 1989 (LM1989-47-A). ⚠️ Le fascicule du Moniteur est ' +
      'un scan OCR de qualité médiocre (« Vendredit Saint », « Fête des Morts » au singulier) : ' +
      'c’est la reproduction du Code du travail qui est citée ici, et le Moniteur qui fait foi.',
    docId: DOC_CTRAV,
    luLe: LU_LE,
  },
  /**
   * § 5.5 — LA SOURCE PRIMAIRE des sept fêtes légales. Elle manquait : le décret n'existait
   * que par sa REPRODUCTION à l'article 110 du Code du travail (`ctrav-110`), si bien que
   * `verify-delais-sources.ts` ne recoupait jamais le fascicule lui-même (défaut 17 b).
   *
   * ⚠️ Le fascicule est un scan OCR de qualité médiocre, sur DEUX COLONNES : la colonne des
   * ministres signataires et un en-tête de page s'intercalent AU MILIEU de la liste des sept
   * fêtes. Le texte ci-dessous est recopié VERBATIM, coquilles comprises (« Décrét »,
   * « Vendredit Saint », « Noel »), mais LIGNE À LIGNE — un contrôle par sous-chaîne
   * contiguë ne peut pas passer sur un tel scan. C'est pourquoi la clé est traitée à part
   * dans le script de vérification (`PAR_LIGNES`) : chaque ligne doit se retrouver telle
   * quelle dans le corps, et c'est le Code du travail qui donne la lecture propre.
   */
  'decret-1989-art-1': {
    reference: 'Décret du 23 mai 1989, art. 1er (Le Moniteur n° 47-A du jeudi 22 juin 1989)',
    texte:
      "Article 1.'- Dès publication du présent\n" +
      'Décrét les Fêtes légales sont:\n' +
      '- Le Mardi Gras\n' +
      '- Le Vendredit Saint\n' +
      '- La Fête Dieu\n' +
      "L' Assomption\n" +
      '- Le 17 Octobre, Mort de Dessalines\n' +
      '- Le 2 Novembre, Fête des Morts\n' +
      'Le 25 Décembre, -Jour de Noel.',
    source:
      'Le Moniteur n° 47-A du jeudi 22 juin 1989 (LM1989-47-A), fascicule scanné — « Décret ' +
      'déterminant, en dehors des Fêtes Nationales, de façon plus précise les Fêtes légales ». ' +
      '⚠️ OCR médiocre sur deux colonnes : « Vendredit Saint », « Décrét », « Noel », et la ' +
      'colonne des ministres signataires s’intercale entre les sept lignes. La reproduction du ' +
      'Code du travail (`ctrav-110`) donne la lecture propre ; le Moniteur fait foi.',
    docId: DOC_MONITEUR_1989,
    luLe: LU_LE,
  },
  'const-275': {
    reference: 'Constitution de 1987, art. 275',
    texte:
      'Article 275\n' +
      "Le chômage de l'Administration Publique et Privée et du Commerce sera observé à l'occasion des Fêtes Nationales et des Fêtes Légales.",
    source: 'Constitution du 29 mars 1987 (amendée 2011)',
    docId: DOC_CONST,
    luLe: LU_LE,
  },
  'const-275-1': {
    reference: 'Constitution de 1987, art. 275.1',
    texte:
      'Article 275.1\n' +
      "Les fêtes nationales sont: 1) La Fête de l'Indépendance Nationale le Premier Janvier; 2) Le Jour des Aïeux le 2 Janvier; 3) La Fête de l'Agriculture et du Travail le Premier Mai; 4) La Fête du Drapeau et de l'Université le 18 mai; 5) La Commémoration de la Bataille de Vertières Jour des forces armées d’Haïti, le 18 novembre.",
    source: 'Constitution du 29 mars 1987 (amendée 2011)',
    docId: DOC_CONST,
    luLe: LU_LE,
  },
  'const-275-2': {
    reference: 'Constitution de 1987, art. 275.2',
    texte: 'Article 275.2\nLes Fêtes Légales sont déterminées par la Loi.',
    source: 'Constitution du 29 mars 1987 (amendée 2011)',
    docId: DOC_CONST,
    luLe: LU_LE,
  },
}

/**
 * § 4.7, garde-fou 1 — LES SIX ENTRÉES `CIVIL` DÉCLARÉES FRANCHES, VÉRIFIÉES UNE PAR UNE EN
 * BASE DE PRODUCTION LE 19 AOÛT 2026.
 *
 * ⚠️ CORRECTIF (défaut 1 du cahier de recette). Le garde-fou du § 4.7 exigeait « la phrase de
 * l'article » mais ne contrôlait que la présence du **mot** « franc » — que les six fondements
 * du catalogue portent tous sous la formule méta « l'article lui-même qualifie le délai de
 * franc ». Un tel contrôle ne garde rien. Le garde-fou exige désormais une **citation réelle**
 * (`regimes.ts`, `citationDeFranc`) : la phrase de l'article, lue en base.
 *
 * Résultat de la vérification : **cinq entrées sur six** portent la phrase ; la sixième — la
 * transcription du dispositif du jugement de divorce, « Loi, art. 10 », donnée pour « 3 jours
 * francs » — **n'a AUCUN texte dans le corpus qui la rende franche**. Elle est marquée
 * `regimeIncertain: true` : la tête d'affiche est calculée en régime ORDINAIRE (la plus
 * précoce, donc la plus sûre) et le régime franc devient une lecture nommée.
 */
export type CitationRegime = {
  /** `article` de l'entrée du catalogue, tel quel. */
  article: string
  /** La phrase de l'article, VERBATIM, ou `null` si le corpus n'en porte aucune. */
  citation: string | null
  reference: string
  docId: string | null
  luLe: string
  /** Ce que la vérification a établi, en toutes lettres. */
  constat: string
}

export const CITATIONS_CIVIL_FRANC: Record<string, CitationRegime> = {
  'Art. 229 (L. 5 mai 1949)': {
    article: 'Art. 229 (L. 5 mai 1949)',
    citation:
      'Art. 229 (Loi du 5 mai 1949, art. 1) Le demandeur, en vertu de la permission du tribunal, fera citer le défendeur à comparaître dans le délai de huitaine franche, outre le délai de distance; il sera donné en tête de la citation copie de la demande en divorce et des pièces à l\'appui.',
    reference: 'C. civ., art. 229 (Loi du 5 mai 1949, art. 1)',
    docId: DOC_CCIV,
    luLe: LU_LE,
    constat: 'Citation trouvée en base : « huitaine franche ». Régime FRANC établi.',
  },
  'Art. 2 (loi annexée)': {
    article: 'Art. 2 (loi annexée)',
    citation:
      'Le délai du recours est de trois (3) jours francs, à compter de la notification de l’ordonnance par la partie intéressée.',
    reference:
      'Décret du 14 septembre 1983 réglementant la procédure de recouvrement des créances d’aliments et celle relative à la garde d’enfants, art. 2, al. 4 (Le Moniteur n° 74 du jeudi 27 octobre 1983)',
    docId: 'cms8dwuuy0026qt1vtjgzjuxr',
    luLe: LU_LE,
    constat:
      'Citation trouvée en base, au quatrième alinéa de l’art. 2 : « trois (3) jours francs ». ' +
      'Régime FRANC établi. ⚠️ Le répertoire écrit « Art. 2 (loi annexée) » ; le texte est un ' +
      'DÉCRET, appendice IV.8 du Code de procédure civile.',
  },
  'Art. 6': {
    article: 'Art. 6',
    citation:
      'Art. 6.- Faute par le saisissant de porter la demande en validité devant le juge des référés dans le délai de un jour franc à compter de la saisie-arrêt, le débiteur saisi pourra demander la mainlevée de la saisie dans les formes et délais de l’article 1 ci-dessus.',
    reference:
      'Décret du 14 septembre 1983 (créances d’aliments et garde d’enfants), art. 6 (Le Moniteur n° 74 du jeudi 27 octobre 1983)',
    docId: 'cms8dwuuy0026qt1vtjgzjuxr',
    luLe: LU_LE,
    constat: 'Citation trouvée en base : « un jour franc ». Régime FRANC établi.',
  },
  'Art. 28': {
    article: 'Art. 28',
    citation:
      'Art. 28.- En cas de refus d’homologation, chacune des parties peut, dans les trente jours francs du prononcé du jugement, le déférer à la Cour d’appel, qui instruit dans les mêmes formes que le tribunal civil.',
    reference:
      'Décret du 4 avril 1974 établissant la procédure d’adoption, art. 28 (Le Moniteur n° 32 du 18 avril 1974)',
    docId: 'cms8dwvkj0027qt1vrfyplivq',
    luLe: LU_LE,
    constat: 'Citation trouvée en base : « trente jours francs ». Régime FRANC établi.',
  },
  'Art. 30': {
    article: 'Art. 30',
    citation:
      'Art. 30.- Le recours en Cassation contre l’arrêt rejetant la demande d’homologation est recevable dans le délai de trente jours francs à partir de la signification dudit arrêt et suivant les formes tracées par le Code de procédure civile en matière de pourvoi en Cassation.',
    reference:
      'Décret du 4 avril 1974 établissant la procédure d’adoption, art. 30 (Le Moniteur n° 32 du 18 avril 1974)',
    docId: 'cms8dwvkj0027qt1vrfyplivq',
    luLe: LU_LE,
    constat: 'Citation trouvée en base : « trente jours francs ». Régime FRANC établi.',
  },
  'Loi, art. 10': {
    article: 'Loi, art. 10',
    citation: null,
    reference:
      'Aucune. Le seul art. 10 du corpus sur la transcription du divorce est celui du Décret ' +
      'du 6 juin 1968 réglementant la procédure du divorce (appendice IV.5.3, Le Moniteur ' +
      'n° 51 du 20 juin 1968).',
    docId: 'cms8dwred0021qt1v7m35suhu',
    luLe: LU_LE,
    /**
     * ⚠️ **CE TEXTE EST LU PAR UNE AVOCATE, PAS PAR LA RÉDACTION** (correctif du 20 août 2026).
     * Il finissait par « L'entrée est donc marquée `regimeIncertain: true` … À faire trancher
     * par la rédaction (§ 13, point 5). » : un nom de champ technique et le renvoi à un
     * paragraphe d'une spécification interne, affichés sous la date, sur la fiche publiée. Le
     * fond était honnête ; la forme donnait à lire un brouillon. Il dit maintenant les trois
     * mêmes choses — ce que la plateforme sait, ce qu'elle ne sait pas, ce qu'il reste à
     * vérifier — dans les mots du métier.
     */
    constat:
      'Le répertoire donne ce délai pour franc ; aucun texte du corpus ne le dit. L’article 10 ' +
      'porte seulement : « La transcription est faite à la diligence de la partie la plus ' +
      'diligente, dans les délais prévus par la loi. » — ni « trois jours », ni « francs ». Le ' +
      'mot « franc » ne paraît que quatre fois dans tout le Code civil (art. 229, « franche » ; ' +
      'art. 770 et 1298, au sens de « francs et quittes »), et aucune des lois du divorce ' +
      'versées au corpus ne le porte. La plateforme ne tranche donc pas la qualification : elle ' +
      'retient la date la plus précoce — celle du régime ordinaire, où le jour de l’échéance ' +
      'compte — et nomme la date franche à côté, un jour plus tard. Vérifiez le texte dont vous ' +
      'tenez ces trois jours : c’est lui qui dira laquelle des deux dates vous engage.',
  },
}

/**
 * § 4.9, avis A5 — LES TROIS ARTICLES QUI AUGMENTENT « D'UN JOUR PAR CINQ LIEUES »,
 * RELUS UN PAR UN EN BASE DE PRODUCTION LE 19 AOÛT 2026 (document `DOC_CCIV`).
 *
 * ⚠️ CORRECTIF (défaut 9). Le gabarit du § 4.9 impose « un jour par cinq lieues
 * **([citation de l'article])** », et `construireEntrees` écrivait `citationArticle: null`
 * en dur pour les 393 lignes : la plateforme affirmait une règle en lieues **sans produire
 * la phrase qui la fonde** — le reproche même que le § 4.4 fait à l'idée d'appliquer A5 à
 * l'art. 229. Le mot « lieue » ne paraît que QUATRE fois dans tout le Code civil : aux
 * art. 338, 353, 1827 et 1952 (l'art. 338 est un délai de conciliation, hors répertoire).
 *
 * Recoupé par `scripts/verify-delais-durees.ts`, qui lit la base. Le contrôle est BLOQUANT :
 * une entrée `JOURS_DISTANCE_NON_CHIFFREE` qui porte A5 sans citation contenant « lieue »
 * arrête la graine (`controler`, § 5.3).
 */
export const CITATIONS_DISTANCE_LIEUES: Record<string, CitationRegime> = {
  'Art. 353': {
    article: 'Art. 353',
    citation:
      "Ses diligences à ce sujet devront avoir lieu dans le délai de trois jours, à partir de la notification qui lui aura été faite de sa nomination ; lequel délai sera augmenté d'un jour par cinq lieues de distance, du lieu de son domicile à celui de l'ouverture de la tutelle : passé ce délai, il sera non recevable.",
    reference: 'C. civ., art. 353, al. 2',
    docId: DOC_CCIV,
    luLe: LU_LE,
    constat:
      'Citation trouvée en base, au deuxième alinéa : « augmenté d’un jour par cinq lieues de ' +
      'distance ». A5 établi.',
  },
  'Art. 1827': {
    article: 'Art. 1827',
    citation:
      "Si le fonds ou l'héritage est éloigné de plus de cinq lieues du domicile de la partie condamnée, il sera ajouté au délai de quinzaine, un jour par cinq lieues.",
    reference: 'C. civ., art. 1827, al. 2',
    docId: DOC_CCIV,
    luLe: LU_LE,
    constat:
      'Citation trouvée en base, au deuxième alinéa : « il sera ajouté au délai de quinzaine, ' +
      'un jour par cinq lieues ». A5 établi.',
  },
  'Art. 1952': {
    article: 'Art. 1952',
    citation:
      "1. Que cette réquisition sera signifiée au nouveau propriétaire dans quarante jours, au plus tard, de la notification faite à la requête de ce dernier, en y ajourant un jour par cinq lieues de distance entre le domicile réel de chaque créancier requérant.",
    reference: 'C. civ., art. 1952, 1°',
    docId: DOC_CCIV,
    luLe: LU_LE,
    constat:
      'Citation trouvée en base, au 1° de l’article : « en y ajourant un jour par cinq lieues de ' +
      'distance ». ⚠️ « ajourant » est la graphie de la base — coquille d’OCR pour « ajoutant », ' +
      'recopiée telle quelle (§ 5.5). A5 établi.',
  },
}

/**
 * § 4.5 — LA PHRASE DE L'ARTICLE QUI PORTE RÉELLEMENT LA DURÉE, quand ce n'est pas celui du
 * catalogue. RELUE EN BASE LE 19 AOÛT 2026.
 *
 * ⚠️ CORRECTIF (défaut 3 du cahier de recette). Le recoupement des 123 durées a remonté
 * l'art. 356 : son texte ne porte AUCUNE durée, les trente jours viennent de l'art. 354. La
 * durée est juste au fond, mais le catalogue l'attribuait à un article qui ne l'énonce pas,
 * et rien ne le signalait à l'écran. La citation vit ici pour la même raison que
 * `CITATIONS_CIVIL_FRANC` : elle est recoupée contre la base par
 * `scripts/verify-delais-sources.ts`, et non recopiée à la main dans une phrase.
 *
 * La clé est l'`article` de l'entrée du CATALOGUE (« 356 ») ; la citation, elle, est celle de
 * l'article qui porte la durée (« 354 »).
 */
export const CITATIONS_DUREE_AILLEURS: Record<string, CitationRegime> = {
  '356': {
    article: '356',
    citation:
      'Le délai pour interjeter appel est, à peine de déchéance, de trente jours francs pour ceux qui demeurent en Haïti.',
    reference: 'C. pr. civ., art. 354',
    docId: DOC_CPC,
    luLe: LU_LE,
    constat:
      'L’art. 356 lu en base ne dit que : « Le délai de l’appel courra à l’encontre de celui ' +
      'qui aura signifié le jugement, du jour de cette signification. La signification, même ' +
      'sans réserve, n’emportera pas acquiescement. » — aucune durée. Les trente jours sont ' +
      'ceux de l’art. 354, premier alinéa, cité ici mot pour mot.',
  },
}

/**
 * Les extraits d'arrêts cités aux § 2.6 à § 2.12, relus en base. Ils sont du TEXTE, jamais
 * des liens : la table de concordance ancien / nouveau Code n'existe pas, et fabriquer un
 * renvoi automatique d'un arrêt vers un article en vigueur serait une invention (§ 4.5).
 */
export type ExtraitArret = {
  reference: string
  docId: string
  extrait: string
  luLe: string
}

export const ARRETS: Record<string, ExtraitArret> = {
  'brown-and-root-liste-fermee': {
    reference: 'Cass. 1re Sect. n° 13, 28 mars 1966, Brown and Root',
    docId: 'cmsxndmx5000fd7x2wrh4g37t',
    extrait:
      "que la Brown and Root, en objectant que le 2 Novembre est le jour des Morts et que la coutume en fait un jour de fête, n'a pas apporté la preuve que le 2 Novembre 1963 fut un jour férié ou un jour de fête légale; que l'article 958 C.P.C. prescrit la prorogation des délais légaux d'un jour dans les seuls cas suivants: 1o) si le dernier jour est un dimanche ou un jour de fête légale; 2o) si, au dernier jour, le chomage est prescrit par arrêté du Président de la République",
    luLe: LU_LE,
  },
  'brown-and-root-continent': {
    reference: 'Cass. 1re Sect. n° 13, 28 mars 1966, Brown and Root',
    docId: 'cmsxndmx5000fd7x2wrh4g37t',
    extrait:
      "Attendu que l'arrêt du 26 Juillet 1963 a été signifié à partie le 2 Septembre 1963; que la Brown and Root, qui demeure sur le continent américain, avait jusqu'au 2 Novembre 1963, pour faire utilement sa déclaration de pourvoi en Cassation contre l'arrêt du 26 Juillet 1963;",
    luLe: LU_LE,
  },
  'brown-and-root-922': {
    reference: 'Cass. 1re Sect. n° 13, 28 mars 1966, Brown and Root',
    docId: 'cmsxndmx5000fd7x2wrh4g37t',
    extrait:
      "que le délai qu'avait la Brown and Root pour se pourvoir courrait à dater de cette signification et était celui indiqué par l'article 922 C.P.C.",
    luLe: LU_LE,
  },
  'germeil-distance': {
    reference: 'Cass. 1re Sect. n° 45, 7 juillet 1965, Germeil c. Aubourg',
    docId: 'cmstqpylg001l106gn3ov95iq',
    extrait:
      'Départ jeudi 17 mai 1962, 30 jours francs et 6 jours de distance pour 267 kilomètres ; ' +
      'dernier jour utile samedi 23 juin 1962 — un samedi, sans aucun report.',
    luLe: LU_LE,
  },
  'prophete-renonciation': {
    reference: 'Cass. 2e Sect. n° 3, 9 décembre 1965, Prophète',
    docId: 'cmsxn6jma00024tt0vm4jsyb3',
    extrait:
      'Le délai de distance est prévu dans l’intérêt privé des parties : deux codéfenderesses ' +
      'sont réputées y avoir renoncé en venant réclamer les exploits à Port-au-Prince. Il est ' +
      'renonçable, il n’est pas d’ordre public, il n’est jamais appliqué d’office.',
    luLe: LU_LE,
  },
}

/**
 * § 4.11 — les fenêtres horaires. Ce sont des DONNÉES réglables (modèle
 * `DelaiFenetreSignification`), pas des constantes du calcul : la fenêtre NE BORNE PAS le
 * délai, qui se compte en jours entiers et ignore les heures.
 */
export type FenetreSignification = {
  matiere: 'CIVILE' | 'TRAVAIL'
  heureDebut: number
  heureFin: number
  source: string
  sourceDocId: string
  nullite: boolean
  nulliteTexteFr: string | null
}

export const FENETRES_V1: readonly FenetreSignification[] = [
  {
    matiere: 'CIVILE',
    heureDebut: 6,
    heureFin: 18,
    source: 'C. pr. civ., art. 991',
    sourceDocId: DOC_CPC,
    nullite: false,
    nulliteTexteFr: null,
  },
  {
    matiere: 'TRAVAIL',
    heureDebut: 8,
    heureFin: 17,
    source: 'C. trav., art. 512',
    sourceDocId: DOC_CTRAV,
    nullite: true,
    nulliteTexteFr:
      'Toute signification ou exécution faite au mépris du présent article est nulle.',
  },
]

export const VERSION_FENETRES_COURANTE = 1
