/**
 * Contenu juridique du portail (CGU, Politique de confidentialité, Avertissement
 * légal). Données structurées rendues par <LegalDoc> — AUCUNE injection HTML : les
 * paragraphes sont du texte brut échappé par React. Le texte fait foi en français
 * (§02 / Art. 14.4 des CGU) ; l'interface autour reste traduisible.
 *
 * Source : documents officiels Lam (CGU_Lam.docx, Politique de confidentialité +
 * Avertissement légal), version finalisée et réconciliée (opérateur = « Lam » ;
 * hébergeur = Vercel/États-Unis ; périmètre des Services aligné sur l'Article 4 ;
 * aucune mention de prestataire de paiement).
 */

export type LegalBlock =
  | { t: 'h2'; id: string; s: string }
  | { t: 'h3'; s: string }
  | { t: 'p'; s: string }
  | { t: 'ul'; items: string[] }
  | { t: 'warn'; paras: string[] }

export interface LegalDocData {
  slug: 'cgu' | 'confidentialite' | 'mentions-legales'
  title: string
  updated?: string
  intro?: string[]
  blocks: LegalBlock[]
}

export const CGU: LegalDocData = {
  slug: 'cgu',
  title: "Conditions Générales d'Utilisation",
  updated: '14 juin 2026',
  blocks: [
    { t: 'h2', id: 'art1', s: 'Article 1 — Objet' },
    { t: 'p', s: "Les présentes Conditions Générales d'Utilisation (ci-après « CGU ») régissent l'accès et l'utilisation de la plateforme Lam, accessible à l'adresse lam.ht (ci-après « la Plateforme »), exploitée par Lam (ci-après « l'Opérateur »)." },
    { t: 'p', s: "La Plateforme est un service de recherche en ligne (SaaS) offrant un accès numérique au contenu et à l'index du Journal Officiel de la République d'Haïti (Le Moniteur) et au contenu des circulaires de la Banque de la République d'Haïti." },
    { t: 'p', s: "Toute utilisation de la Plateforme implique l'acceptation sans réserve des présentes CGU. L'Utilisateur est invité à les lire attentivement avant toute utilisation." },

    { t: 'h2', id: 'art2', s: 'Article 2 — Définitions' },
    { t: 'ul', items: [
      "« Utilisateur » : toute personne physique ou morale accédant à la Plateforme, qu'elle dispose ou non d'un compte.",
      "« Abonné » : tout Utilisateur titulaire d'un compte et d'un abonnement actif donnant accès aux fonctionnalités payantes de la Plateforme.",
      "« Compte » : l'espace personnel créé par l'Utilisateur lors de son inscription sur la Plateforme, protégé par des identifiants de connexion.",
      "« Contenu » : l'ensemble des textes législatifs, réglementaires et officiels, index, métadonnées, outils de recherche et autres informations accessibles via la Plateforme.",
      "« Services » : l'ensemble des fonctionnalités offertes par la Plateforme, telles que décrites à l'Article 4, à savoir la recherche dans Le Moniteur, la consultation de l'index législatif et la recherche des circulaires de la Banque de la République d'Haïti.",
      "« Données personnelles » ou « Données à caractère personnel » : toute information se rapportant à une personne physique identifiée ou identifiable, au sens de l'Arrêté du 30 avril 2018.",
    ] },

    { t: 'h2', id: 'art3', s: 'Article 3 — Accès à la Plateforme' },
    { t: 'h3', s: "3.1 Conditions d'accès" },
    { t: 'p', s: "L'accès à la Plateforme est ouvert à toute personne physique majeure ou personne morale. L'Utilisateur qui crée un Compte déclare être majeur au sens de la loi haïtienne et disposer de la capacité juridique nécessaire pour s'engager au titre des présentes CGU." },
    { t: 'h3', s: '3.2 Inscription' },
    { t: 'p', s: "L'accès aux fonctionnalités complètes de la Plateforme nécessite la création d'un Compte. L'Utilisateur fournit les informations suivantes lors de l'inscription : nom et prénom(s), adresse électronique, mot de passe, et, le cas échéant, la dénomination sociale et le numéro d'identification fiscale (NIF) de la personne morale qu'il représente. L'Utilisateur s'engage à fournir des informations exactes et à les maintenir à jour." },
    { t: 'h3', s: '3.3 Identifiants de connexion' },
    { t: 'p', s: "L'Utilisateur est seul responsable de la confidentialité de ses identifiants de connexion. Toute utilisation de la Plateforme effectuée au moyen de ses identifiants est réputée avoir été effectuée par lui. En cas de perte, de vol ou d'utilisation non autorisée de ses identifiants, l'Utilisateur s'engage à en informer l'Opérateur sans délai à l'adresse contact@lam.ht." },
    { t: 'h3', s: '3.4 Disponibilité' },
    { t: 'p', s: "L'Opérateur s'efforce d'assurer la disponibilité continue de la Plateforme. Toutefois, l'accès peut être temporairement interrompu pour des raisons de maintenance, de mise à jour ou en cas de force majeure. L'Opérateur ne saurait être tenu responsable des interruptions de service indépendantes de sa volonté." },

    { t: 'h2', id: 'art4', s: 'Article 4 — Description des Services' },
    { t: 'p', s: 'La Plateforme offre les Services suivants :' },
    { t: 'ul', items: [
      "Recherche dans Le Moniteur : accès numérique au contenu des éditions du Journal Officiel de la République d'Haïti, avec moteur de recherche par mots-clés, date de publication, numéro d'édition et type d'acte.",
      'Index législatif : index structuré de la législation haïtienne, incluant les lois, décrets, arrêtés et autres actes normatifs.',
      "Recherche des Circulaires de la Banque de la République d'Haïti (BRH) : accès numérique au contenu des différentes circulaires publiées par la BRH.",
    ] },
    { t: 'p', s: "L'Opérateur se réserve le droit de modifier, d'enrichir ou de supprimer certaines fonctionnalités de la Plateforme, sous réserve d'en informer les Abonnés dans un délai raisonnable." },

    { t: 'h2', id: 'art5', s: 'Article 5 — Abonnement et tarification' },
    { t: 'h3', s: "5.1 Formules d'abonnement" },
    { t: 'p', s: "L'accès aux Services est conditionné à la souscription d'un abonnement. Les formules d'abonnement, leurs tarifs et les fonctionnalités incluses sont détaillés sur la page de tarification de la Plateforme. L'Opérateur se réserve le droit de modifier les tarifs, sous réserve d'en informer les Abonnés au moins trente (30) jours avant l'entrée en vigueur des nouveaux tarifs." },
    { t: 'h3', s: '5.2 Modalités de paiement' },
    { t: 'p', s: "Le paiement s'effectue par les moyens de paiement acceptés sur la Plateforme. Le paiement est exigible à la souscription de l'abonnement et, pour les abonnements récurrents, à chaque date d'échéance. L'Opérateur ne collecte ni ne stocke directement les coordonnées de cartes de crédit des Utilisateurs." },
    { t: 'h3', s: '5.3 Facturation' },
    { t: 'p', s: "Une facture électronique est émise et mise à disposition de l'Abonné dans son Compte après chaque paiement. Les factures sont conservées conformément aux obligations fiscales en vigueur en Haïti." },
    { t: 'h3', s: '5.4 Renouvellement et résiliation' },
    { t: 'p', s: "Sauf mention contraire, les abonnements sont renouvelés automatiquement à l'expiration de chaque période. L'Abonné peut résilier son abonnement à tout moment depuis son Compte. La résiliation prend effet à l'expiration de la période d'abonnement en cours. Aucun remboursement au prorata n'est effectué pour la période entamée." },

    { t: 'h2', id: 'art6', s: "Article 6 — Obligations de l'Utilisateur" },
    { t: 'p', s: "L'Utilisateur s'engage à :" },
    { t: 'ul', items: [
      'utiliser la Plateforme conformément à sa finalité de recherche juridique et dans le respect des lois et règlements en vigueur en Haïti ;',
      'ne pas tenter d\'accéder de manière non autorisée aux systèmes informatiques de la Plateforme, ni contourner les mesures de sécurité mises en place ;',
      'ne pas utiliser de robots, scrapers ou tout autre moyen automatisé pour extraire massivement le Contenu de la Plateforme ;',
      'ne pas reproduire, redistribuer, revendre ou mettre à disposition de tiers tout ou partie du Contenu de la Plateforme en dehors des cas expressément autorisés ;',
      'ne pas partager ses identifiants de connexion avec des tiers ;',
      'ne pas utiliser la Plateforme à des fins illégales, frauduleuses ou portant atteinte aux droits de tiers.',
    ] },
    { t: 'p', s: "Tout manquement aux présentes obligations peut entraîner la suspension ou la résiliation du Compte de l'Utilisateur, sans préjudice de tout dommage et intérêt." },

    { t: 'h2', id: 'art7', s: 'Article 7 — Propriété intellectuelle' },
    { t: 'h3', s: '7.1 Contenu législatif et réglementaire' },
    { t: 'p', s: "Les textes législatifs, réglementaires et officiels publiés dans Le Moniteur sont des actes de l'autorité publique et ne sont pas, en tant que tels, susceptibles d'appropriation par le droit d'auteur. Leur reproduction et leur diffusion sont libres, sous réserve du respect de leur intégrité." },
    { t: 'h3', s: "7.2 Apport de l'Opérateur" },
    { t: 'p', s: "La structuration, l'indexation, les métadonnées, les outils de recherche, l'architecture de la base de données, le design, le code source, les éléments graphiques, la marque Lam, le logo et la charte graphique constituent des œuvres protégées par le droit de la propriété intellectuelle. Toute reproduction, représentation, modification ou exploitation non autorisée de ces éléments est interdite." },
    { t: 'h3', s: "7.3 Licence d'utilisation" },
    { t: 'p', s: "L'Opérateur accorde à l'Abonné, pour la durée de son abonnement, une licence personnelle, non exclusive, non transférable et non cessible d'utilisation des Services. Cette licence autorise la consultation, le téléchargement et l'impression de documents à des fins de recherche personnelle ou professionnelle. Elle n'autorise pas la reproduction systématique, la redistribution commerciale ou la constitution de bases de données concurrentes à partir du Contenu." },

    { t: 'h2', id: 'art8', s: 'Article 8 — Protection des données à caractère personnel' },
    { t: 'h3', s: '8.1 Responsable du traitement' },
    { t: 'p', s: "L'Opérateur est responsable du traitement des données à caractère personnel collectées via la Plateforme, au sens de l'Arrêté du 30 avril 2018 fixant les règles relatives à la protection des données à caractère personnel et du Décret du 6 janvier 2016 sur l'administration électronique." },
    { t: 'h3', s: '8.2 Données collectées' },
    { t: 'p', s: "L'Opérateur collecte les catégories de données suivantes :" },
    { t: 'ul', items: [
      "Données d'identification : nom, prénom(s), adresse électronique.",
      'Données professionnelles : dénomination sociale, NIF, profession (le cas échéant).',
      'Données de connexion : adresse IP, type de navigateur, dates et heures de connexion, pages consultées.',
      "Données d'utilisation : historique de recherche, documents consultés ou téléchargés.",
    ] },
    { t: 'p', s: "L'Opérateur ne collecte ni ne stocke les coordonnées de cartes de crédit des Utilisateurs." },
    { t: 'h3', s: '8.3 Finalités du traitement' },
    { t: 'p', s: 'Les données sont collectées pour les finalités suivantes :' },
    { t: 'ul', items: [
      "fourniture et gestion des Services (création de Compte, authentification, gestion de l'abonnement) ;",
      "amélioration de la Plateforme (analyse d'utilisation, détection d'anomalies techniques) ;",
      "communication avec l'Utilisateur (notifications de service, support technique) ;",
      'respect des obligations légales et fiscales applicables.',
    ] },
    { t: 'h3', s: '8.4 Principe de minimisation' },
    { t: 'p', s: "Conformément à l'Article 3, alinéas 1 et 2, de l'Arrêté du 30 avril 2018, l'Opérateur ne collecte que les données strictement nécessaires aux finalités déclarées ci-dessus." },
    { t: 'h3', s: '8.5 Durée de conservation' },
    { t: 'p', s: "Les données à caractère personnel sont conservées conformément au principe de durée limitée prévu par l'Article 3, alinéa 3, de l'Arrêté de 2018 :" },
    { t: 'ul', items: [
      "Données d'identification et professionnelles : conservées pendant la durée de l'abonnement et pendant une période de douze (12) mois après la clôture du Compte, sauf obligation légale contraire.",
      'Données de connexion : conservées pendant une durée de douze (12) mois à compter de leur collecte.',
      "Données d'utilisation : conservées sous forme anonymisée à des fins statistiques après une période de six (6) mois.",
      'Données de facturation : conservées pendant la durée requise par la législation fiscale haïtienne.',
    ] },
    { t: 'p', s: "À l'expiration de ces délais, les données sont supprimées ou irréversiblement anonymisées." },
    { t: 'h3', s: '8.6 Destinataires des données' },
    { t: 'p', s: "Les données à caractère personnel sont accessibles exclusivement aux personnes habilitées au sein de l'Opérateur, en raison de leurs fonctions, conformément à l'Article 3, alinéa 5, de l'Arrêté de 2018. Elles peuvent également être transmises aux prestataires suivants, dans la stricte mesure nécessaire à la fourniture des Services :" },
    { t: 'ul', items: [
      "prestataire d'hébergement (pour le stockage sécurisé des données) ;",
      "prestataire d'envoi d'e-mails transactionnels (pour les notifications de service).",
    ] },
    { t: 'p', s: "L'Opérateur ne vend, ne loue et ne cède en aucun cas les données personnelles de ses Utilisateurs à des tiers à des fins commerciales ou publicitaires." },
    { t: 'h3', s: '8.7 Sécurité des données' },
    { t: 'p', s: "L'Opérateur met en œuvre les mesures de sécurité techniques et organisationnelles adéquates, tant physiques que logiques, pour protéger les données personnelles contre la déformation, l'endommagement ou l'accès par des tiers non autorisés, conformément à l'Article 3, alinéas 6 et 7, de l'Arrêté de 2018. Ces mesures incluent notamment le chiffrement des communications (SSL/TLS), le chiffrement des données au repos, le contrôle d'accès par rôle, et la journalisation des accès." },
    { t: 'h3', s: '8.8 Hébergement des données' },
    { t: 'p', s: "Les données collectées par la Plateforme sont hébergées sur des serveurs situés aux États-Unis (Vercel Inc.). L'Opérateur s'engage à informer les Utilisateurs de toute modification de la localisation géographique des serveurs." },
    { t: 'h3', s: '8.9 Droits des personnes concernées' },
    { t: 'p', s: "Conformément à l'Article 3, alinéas 8 et 9, de l'Arrêté de 2018, l'Utilisateur dispose des droits suivants :" },
    { t: 'ul', items: [
      "Droit d'accès : obtenir la confirmation que des données le concernant sont traitées et en obtenir une copie.",
      'Droit de rectification : demander la correction de données inexactes ou incomplètes.',
      "Droit de suppression : demander l'effacement de ses données, sous réserve des obligations légales de conservation.",
      'Droit à la portabilité : recevoir ses données dans un format structuré, couramment utilisé et lisible par machine.',
    ] },
    { t: 'p', s: "Ces droits peuvent être exercés par courrier électronique à l'adresse legal@lam.ht ou par courrier postal à l'adresse du siège social de l'Opérateur. L'Opérateur s'engage à répondre à toute demande dans un délai de trente (30) jours." },
    { t: 'h3', s: '8.10 Cookies' },
    { t: 'p', s: "La Plateforme utilise des cookies strictement nécessaires au fonctionnement du service (cookies de session et d'authentification). Des cookies d'analyse peuvent être utilisés pour améliorer la Plateforme, sous réserve du consentement préalable de l'Utilisateur. L'Utilisateur peut gérer ses préférences en matière de cookies via le panneau de configuration accessible depuis la Plateforme." },

    { t: 'h2', id: 'art9', s: 'Article 9 — Responsabilité' },
    { t: 'h3', s: '9.1 Nature du Contenu' },
    { t: 'warn', paras: [
      "Le Contenu accessible sur la Plateforme est fourni à titre informatif. Il ne constitue pas un avis juridique et ne saurait se substituer à la consultation d'un avocat ou d'un professionnel du droit. L'Opérateur ne garantit pas que le Contenu est exhaustif, à jour ou exempt d'erreurs. L'Utilisateur est invité à vérifier l'exactitude et l'actualité de tout texte auprès des sources officielles.",
    ] },
    { t: 'h3', s: '9.2 Limitation de responsabilité' },
    { t: 'p', s: "L'Opérateur ne saurait être tenu responsable des dommages directs ou indirects résultant de l'utilisation ou de l'impossibilité d'utiliser la Plateforme, y compris en cas d'interruption de service, de perte de données, de virus informatique ou de tout autre événement échappant à son contrôle raisonnable. La responsabilité de l'Opérateur est en tout état de cause limitée au montant des sommes effectivement versées par l'Abonné au cours des douze (12) mois précédant le fait générateur du dommage." },
    { t: 'h3', s: '9.3 Force majeure' },
    { t: 'p', s: "L'Opérateur ne pourra être tenu responsable en cas de manquement à ses obligations résultant d'un cas de force majeure, tel que défini par le Code Civil haïtien, incluant notamment les catastrophes naturelles, les pannes généralisées d'électricité ou de télécommunications, les cyberattaques d'ampleur, les émeutes, les actes de guerre et les décisions gouvernementales." },

    { t: 'h2', id: 'art10', s: 'Article 10 — Notification des incidents de sécurité' },
    { t: 'p', s: "En cas de violation de données à caractère personnel susceptible d'engendrer un risque pour les droits et libertés des Utilisateurs, l'Opérateur s'engage à notifier les Utilisateurs concernés dans les meilleurs délais, et au plus tard dans les soixante-douze (72) heures suivant la découverte de l'incident. La notification indiquera la nature de la violation, les données concernées, les mesures prises pour y remédier et les recommandations à l'attention des Utilisateurs affectés." },

    { t: 'h2', id: 'art11', s: 'Article 11 — Propriété et intégrité des textes officiels' },
    { t: 'warn', paras: [
      "L'Opérateur s'efforce de reproduire fidèlement les textes officiels disponibles sur sa plateforme. Toute erreur de transcription signalée par un Utilisateur sera corrigée dans les meilleurs délais. Les textes accessibles sur la Plateforme ne se substituent pas à la version officielle publiée par les Presses Nationales d'Haïti. En cas de divergence, la version publiée au Moniteur fait foi.",
    ] },

    { t: 'h2', id: 'art12', s: 'Article 12 — Droit applicable et règlement des différends' },
    { t: 'h3', s: '12.1 Droit applicable' },
    { t: 'p', s: 'Les présentes CGU sont régies par le droit haïtien.' },
    { t: 'h3', s: '12.2 Médiation' },
    { t: 'p', s: "En cas de différend relatif à l'interprétation ou à l'exécution des présentes CGU, les parties s'efforceront de le résoudre à l'amiable. L'Utilisateur peut, à cet effet, adresser une réclamation écrite à l'Opérateur à l'adresse legal@lam.ht. L'Opérateur s'engage à y répondre dans un délai de trente (30) jours." },
    { t: 'h3', s: '12.3 Juridiction compétente' },
    { t: 'p', s: "À défaut de résolution amiable, tout litige sera soumis à la compétence exclusive des tribunaux haïtiens." },

    { t: 'h2', id: 'art13', s: 'Article 13 — Modifications des CGU' },
    { t: 'p', s: "L'Opérateur se réserve le droit de modifier les présentes CGU à tout moment. Les modifications entreront en vigueur dès leur publication sur la Plateforme. L'Abonné sera informé de toute modification substantielle par courrier électronique au moins quinze (15) jours avant son entrée en vigueur. La poursuite de l'utilisation de la Plateforme après l'entrée en vigueur des modifications vaut acceptation des CGU modifiées." },

    { t: 'h2', id: 'art14', s: 'Article 14 — Dispositions générales' },
    { t: 'h3', s: '14.1 Intégralité' },
    { t: 'p', s: "Les présentes CGU constituent l'intégralité de l'accord entre l'Utilisateur et l'Opérateur concernant l'utilisation de la Plateforme. Elles remplacent tout accord, communication ou proposition antérieure, orale ou écrite, relatif au même objet." },
    { t: 'h3', s: '14.2 Nullité partielle' },
    { t: 'p', s: "Si l'une des clauses des présentes CGU est déclarée nulle ou inapplicable par une juridiction compétente, les autres clauses demeureront en vigueur et produiront leurs pleins effets." },
    { t: 'h3', s: '14.3 Renonciation' },
    { t: 'p', s: "Le fait pour l'Opérateur de ne pas se prévaloir d'un manquement de l'Utilisateur à l'une de ses obligations ne saurait être interprété comme une renonciation à l'obligation en cause." },
    { t: 'h3', s: '14.4 Langue' },
    { t: 'p', s: 'Les présentes CGU sont rédigées en français. En cas de traduction, seule la version française fait foi.' },

    { t: 'h2', id: 'art15', s: 'Article 15 — Contact' },
    { t: 'p', s: "Pour toute question relative aux présentes CGU, à la protection des données personnelles ou au fonctionnement de la Plateforme, l'Utilisateur peut contacter l'Opérateur par courrier électronique : legal@lam.ht." },
  ],
}

export const CONFIDENTIALITE: LegalDocData = {
  slug: 'confidentialite',
  title: 'Politique de confidentialité',
  updated: '14 juin 2026',
  intro: [
    "La présente Politique de confidentialité décrit la manière dont Lam (ci-après « l'Opérateur »), exploitant la plateforme Lam accessible à l'adresse lam.ht (ci-après « la Plateforme »), collecte, utilise, conserve et protège les données à caractère personnel de ses utilisateurs.",
    "Cette Politique est établie conformément au Décret du 6 janvier 2016 reconnaissant le droit de tout administré à s'adresser à l'Administration Publique par des moyens électroniques, et à l'Arrêté du 30 avril 2018 fixant les règles relatives à la protection des données à caractère personnel.",
    "L'Opérateur s'engage à protéger la vie privée de ses utilisateurs et à traiter leurs données personnelles avec le plus haut degré de sécurité et de transparence.",
  ],
  blocks: [
    { t: 'h2', id: 's1', s: '1. Responsable du traitement' },
    { t: 'p', s: 'Le responsable du traitement des données à caractère personnel collectées via la Plateforme est : Lam — Siège social : 62, rue Geffrard, Pétion-Ville, Haïti — Contact : legal@lam.ht.' },

    { t: 'h2', id: 's2', s: '2. Données collectées' },
    { t: 'p', s: "L'Opérateur collecte uniquement les données strictement nécessaires aux finalités déclarées, conformément au principe de minimisation prévu par l'Article 3, alinéas 1 et 2, de l'Arrêté du 30 avril 2018." },
    { t: 'h3', s: "2.1 Données fournies par l'utilisateur" },
    { t: 'ul', items: [
      "Données d'identification : nom, prénom(s), adresse électronique.",
      "Données professionnelles : dénomination sociale, Numéro d'Identification Fiscale (NIF), profession (le cas échéant).",
      "Mot de passe : stocké sous forme chiffrée (hashée). L'Opérateur n'a pas accès au mot de passe en clair.",
    ] },
    { t: 'h3', s: '2.2 Données collectées automatiquement' },
    { t: 'ul', items: [
      "Données de connexion : adresse IP, type et version du navigateur, système d'exploitation, dates et heures de connexion.",
      "Données d'utilisation : pages consultées, recherches effectuées, documents téléchargés, durée des sessions.",
    ] },
    { t: 'h3', s: '2.3 Données non collectées' },
    { t: 'p', s: "L'Opérateur ne collecte ni ne stocke les coordonnées de cartes de crédit ou de débit, ni de données biométriques." },

    { t: 'h2', id: 's3', s: '3. Finalités du traitement' },
    { t: 'p', s: 'Les données personnelles sont traitées exclusivement pour les finalités suivantes :' },
    { t: 'ul', items: [
      "Fourniture des Services : création et gestion du Compte, authentification, gestion de l'abonnement, accès aux fonctionnalités de la Plateforme.",
      'Facturation : émission de factures, suivi des paiements, respect des obligations fiscales.',
      "Communication de service : notifications techniques, alertes de sécurité, mises à jour des Conditions Générales d'Utilisation.",
      "Amélioration de la Plateforme : analyse anonymisée de l'utilisation, détection et correction d'anomalies techniques.",
      'Sécurité : prévention des fraudes, détection des accès non autorisés, protection de l\'intégrité de la Plateforme.',
    ] },
    { t: 'p', s: 'Les données ne sont en aucun cas utilisées à des fins de publicité ciblée, de profilage commercial, ou de revente à des tiers.' },

    { t: 'h2', id: 's4', s: '4. Base juridique du traitement' },
    { t: 'ul', items: [
      "Exécution contractuelle : le traitement est nécessaire à l'exécution du contrat d'abonnement entre l'Utilisateur et l'Opérateur.",
      "Obligation légale : le traitement est nécessaire au respect des obligations de l'Opérateur.",
      "Intérêt légitime : le traitement est nécessaire à la sécurité de la Plateforme et à l'amélioration des Services.",
      'Consentement : pour les cookies non essentiels et, le cas échéant, pour les communications informatives.',
    ] },

    { t: 'h2', id: 's5', s: '5. Durée de conservation' },
    { t: 'ul', items: [
      "Données d'identification et professionnelles : pendant la durée de l'abonnement, puis douze (12) mois après la clôture du Compte.",
      'Données de connexion : douze (12) mois à compter de leur collecte.',
      "Données d'utilisation : six (6) mois sous forme identifiable, puis conservées sous forme irréversiblement anonymisée à des fins statistiques.",
      'Données de facturation : durée requise par la législation fiscale haïtienne en vigueur.',
    ] },
    { t: 'p', s: "À l'expiration de ces délais, les données sont définitivement supprimées ou irréversiblement anonymisées." },

    { t: 'h2', id: 's6', s: '6. Destinataires des données' },
    { t: 'p', s: "Les données à caractère personnel sont accessibles exclusivement aux personnes habilitées au sein de l'Opérateur. Elles peuvent être transmises aux prestataires suivants, dans la stricte mesure nécessaire à l'exécution des Services :" },
    { t: 'ul', items: [
      "Prestataire d'hébergement : Vercel Inc., pour le stockage sécurisé des données.",
      "Prestataire d'e-mails transactionnels, pour l'envoi des notifications de service.",
    ] },
    { t: 'p', s: "L'Opérateur ne vend, ne loue et ne cède en aucun cas les données personnelles de ses utilisateurs à des tiers à des fins commerciales ou publicitaires. En cas de demande d'une autorité judiciaire compétente, l'Opérateur pourra être tenu de communiquer certaines données, dans le strict respect de la législation applicable." },

    { t: 'h2', id: 's7', s: '7. Localisation et hébergement des données' },
    { t: 'p', s: "Les données collectées via la Plateforme sont hébergées sur des serveurs situés à l'étranger (États-Unis — Vercel Inc., Covina, Californie). L'Opérateur s'engage à procéder à une évaluation des risques avant tout transfert de données vers un pays ne disposant pas d'une législation de protection des données équivalente." },

    { t: 'h2', id: 's8', s: '8. Mesures de sécurité' },
    { t: 'ul', items: [
      'Chiffrement en transit : toutes les communications entre l\'utilisateur et la Plateforme sont chiffrées via le protocole TLS.',
      "Chiffrement au repos : les données stockées sont chiffrées sur les serveurs d'hébergement.",
      'Hachage des mots de passe : les mots de passe sont stockés sous forme de hash cryptographique irréversible.',
      "Contrôle d'accès : l'accès aux données est restreint aux seuls membres du personnel autorisés, selon le principe du moindre privilège.",
      'Journalisation : les accès aux données sont journalisés à des fins de traçabilité et d\'audit.',
      "DNSSEC : le nom de domaine lam.ht est protégé par DNSSEC pour garantir l'authenticité des résolutions DNS.",
      'Sauvegardes : des sauvegardes régulières et chiffrées sont effectuées pour prévenir toute perte de données.',
    ] },

    { t: 'h2', id: 's9', s: '9. Cookies' },
    { t: 'h3', s: '9.1 Cookies strictement nécessaires' },
    { t: 'p', s: "La Plateforme utilise des cookies strictement nécessaires au fonctionnement du service, qui ne nécessitent pas le consentement préalable de l'utilisateur : un cookie de session (expire à la fermeture du navigateur), un cookie d'authentification (expiration : trente (30) jours) et un cookie de préférences (enregistre la langue)." },
    { t: 'h3', s: "9.2 Cookies d'analyse" },
    { t: 'p', s: "La Plateforme peut utiliser des cookies d'analyse pour comprendre comment les utilisateurs interagissent avec le service. Ces cookies ne sont déposés qu'après le consentement explicite de l'utilisateur, recueilli via le bandeau de gestion des cookies affiché lors de la première visite." },
    { t: 'h3', s: '9.3 Gestion des cookies' },
    { t: 'p', s: "L'utilisateur peut à tout moment modifier ses préférences en matière de cookies via le panneau de configuration accessible depuis le pied de page de la Plateforme. Il peut également configurer son navigateur pour refuser tout ou partie des cookies." },

    { t: 'h2', id: 's10', s: '10. Droits des utilisateurs' },
    { t: 'ul', items: [
      "Droit d'accès : obtenir la confirmation que des données le concernant sont traitées, en connaître la nature et en recevoir une copie.",
      'Droit de rectification : demander la correction de données inexactes, incomplètes ou obsolètes.',
      "Droit de suppression : demander l'effacement de ses données personnelles, sous réserve des obligations légales de conservation.",
      'Droit à la portabilité : recevoir les données fournies dans un format structuré, couramment utilisé et lisible par machine.',
      "Droit d'opposition : s'opposer au traitement de ses données pour les finalités fondées sur l'intérêt légitime de l'Opérateur.",
      'Droit de retrait du consentement : retirer à tout moment le consentement donné pour les cookies non essentiels ou les communications informatives.',
    ] },
    { t: 'p', s: "Toute demande peut être adressée par courrier électronique à l'adresse legal@lam.ht. L'Opérateur s'engage à accuser réception de toute demande dans un délai de cinq (5) jours ouvrables et à y répondre dans un délai maximum de trente (30) jours. L'Opérateur pourra demander une preuve d'identité pour s'assurer que la demande émane bien de la personne concernée." },

    { t: 'h2', id: 's11', s: '11. Notification des violations de données' },
    { t: 'p', s: "En cas de violation de données à caractère personnel susceptible d'engendrer un risque pour les droits et libertés des utilisateurs, l'Opérateur s'engage à notifier les utilisateurs concernés dans les meilleurs délais, et au plus tard dans les soixante-douze (72) heures suivant la découverte de l'incident, en communiquant la nature de la violation, les catégories de données concernées, les conséquences probables, les mesures prises et des recommandations." },

    { t: 'h2', id: 's12', s: '12. Protection des mineurs' },
    { t: 'p', s: "La Plateforme n'est pas destinée aux personnes mineures au sens de la loi haïtienne. L'Opérateur ne collecte pas sciemment de données personnelles de mineurs. Si l'Opérateur découvre que des données d'un mineur ont été collectées, il procédera à leur suppression immédiate." },

    { t: 'h2', id: 's13', s: '13. Modifications de la Politique de confidentialité' },
    { t: 'p', s: "L'Opérateur se réserve le droit de modifier la présente Politique à tout moment. Toute modification substantielle sera notifiée aux utilisateurs par courrier électronique et signalée de manière visible sur la Plateforme. La date de dernière mise à jour est indiquée en tête du présent document." },

    { t: 'h2', id: 's14', s: '14. Contact' },
    { t: 'p', s: "Pour toute question relative à la présente Politique de confidentialité ou à l'exercice de vos droits : legal@lam.ht." },
  ],
}

export const MENTIONS: LegalDocData = {
  slug: 'mentions-legales',
  title: 'Avertissement légal & mentions légales',
  blocks: [
    { t: 'h2', id: 'm1', s: '1. Éditeur du site' },
    { t: 'p', s: 'Le site lam.ht est édité par : Lam — Siège social : 62, rue Geffrard, Pétion-Ville, Haïti — Contact : legal@lam.ht.' },

    { t: 'h2', id: 'm2', s: '2. Hébergeur' },
    { t: 'p', s: 'Vercel Inc. — 440 N. Barranca Avenue, #4133, Covina, CA 91723 — Localisation des serveurs : États-Unis.' },

    { t: 'h2', id: 'm3', s: '3. Objet du site' },
    { t: 'p', s: "Lam est une plateforme de recherche juridique en ligne (SaaS) offrant un accès numérique aux index de la législation haïtienne." },

    { t: 'h2', id: 'm4', s: '4. Avertissement juridique' },
    { t: 'warn', paras: [
      'Les informations accessibles sur la Plateforme sont fournies à titre informatif et documentaire uniquement. Elles ne constituent en aucun cas un avis juridique, un conseil professionnel ni une recommandation.',
      "L'Opérateur s'efforce de restituer fidèlement les textes publiés par le législateur et les régulateurs. Toutefois, les textes accessibles sur la Plateforme ne se substituent pas aux versions officielles publiées par les Presses Nationales d'Haïti, la Banque de la République d'Haïti ainsi que les autres autorités étatiques. En cas de divergence entre le texte affiché sur la Plateforme et les versions publiées, les dernières versions publiées font foi.",
      "L'Opérateur ne garantit pas que le contenu de la Plateforme soit exhaustif, à jour ou exempt d'erreurs de transcription. L'utilisateur est invité à vérifier l'exactitude et l'actualité de tout texte auprès des sources officielles avant de s'en prévaloir.",
      "L'utilisation de la Plateforme ne crée aucune relation avocat-client entre l'Opérateur et l'utilisateur. Pour toute question juridique, l'utilisateur est invité à consulter un avocat inscrit au Barreau compétent.",
    ] },

    { t: 'h2', id: 'm5', s: '5. Propriété intellectuelle' },
    { t: 'h3', s: '5.1 Textes législatifs et réglementaires' },
    { t: 'p', s: "Les textes législatifs, réglementaires et officiels publiés dans Le Moniteur sont des actes de l'autorité publique. Leur reproduction et leur diffusion sont libres, sous réserve du respect de leur intégrité." },
    { t: 'h3', s: '5.2 Éléments protégés' },
    { t: 'p', s: "Sont protégés et appartiennent exclusivement à l'Opérateur : la marque Lam, le logo, la charte graphique et la baseline « Le fruit du savoir » ; la structuration, l'indexation et les métadonnées de la base de données ; les outils de recherche, les algorithmes et l'architecture technique ; le design et l'interface utilisateur ; le code source de la Plateforme. Toute reproduction, représentation, modification, extraction, réutilisation ou exploitation non autorisée de ces éléments est interdite et constitue une contrefaçon susceptible de poursuites." },

    { t: 'h2', id: 'm6', s: '6. Liens hypertextes' },
    { t: 'p', s: "La Plateforme peut contenir des liens vers des sites tiers. L'Opérateur n'exerce aucun contrôle sur le contenu de ces sites et décline toute responsabilité quant à leur contenu, leurs pratiques en matière de protection des données, ou tout dommage résultant de leur consultation. La création de liens hypertextes vers la Plateforme est libre, sous réserve qu'elle n'induise pas le public en erreur quant à l'identité de l'éditeur ou à la nature du site." },

    { t: 'h2', id: 'm7', s: '7. Limitation de responsabilité' },
    { t: 'p', s: "L'Opérateur ne saurait être tenu responsable des dommages directs ou indirects résultant de l'utilisation ou de l'impossibilité d'utiliser la Plateforme, des décisions prises par l'utilisateur sur la base des informations accessibles, des interruptions de service, pertes de données, virus informatiques ou tout événement échappant à son contrôle raisonnable, ni du contenu des sites tiers accessibles via des liens hypertextes. La responsabilité de l'Opérateur est, en tout état de cause, limitée au montant des sommes effectivement versées par l'utilisateur au cours des douze (12) mois précédant le fait générateur du dommage." },

    { t: 'h2', id: 'm8', s: '8. Droit applicable et juridiction compétente' },
    { t: 'p', s: "Le présent Avertissement légal est régi par le droit haïtien. Tout litige relatif à l'utilisation de la Plateforme sera soumis à la compétence exclusive des tribunaux de Port-au-Prince, Haïti." },

    { t: 'h2', id: 'm9', s: '9. Contact' },
    { t: 'p', s: 'Pour toute question relative aux présentes mentions légales : legal@lam.ht — Adresse postale : 62, rue Geffrard, Pétion-Ville, Haïti.' },
  ],
}

export const LEGAL_DOCS = { cgu: CGU, confidentialite: CONFIDENTIALITE, 'mentions-legales': MENTIONS } as const
