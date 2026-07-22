import type { DocType, Locale } from './types'

/**
 * Registre des 6 types de documents (§01). Chaque type porte :
 *  - une pastille (nom de couleur créole + classes Tailwind)
 *  - un badge (libellé court, recoloré §01)
 *  - le slug d'URL, l'icône, et ses particularités d'interface.
 *
 * La navigation par couleur traverse toute la plateforme : tuiles du dashboard,
 * filtres, badges de résultats, admin.
 */
export interface DocTypeMeta {
  type: DocType
  num: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  slug: string
  /** nom de couleur (créole) tel que défini au Brand Book */
  pastille: string
  /** clé de couleur Tailwind (cf. tailwind.config.ts) */
  color: 'lank' | 'soley' | 'brim' | 'lagon' | 'fey' | 'sitwon' | 'endeks' | 'kannel'
  badge: string
  /** titres traduisibles du type */
  label: Record<Locale, string>
  /** particularités d'interface (§01) */
  feature: Record<Locale, string>
  /** l'Index ne contient que des références aux textes (pas de texte intégral) */
  referenceOnly?: boolean
}

export const DOC_TYPE_META: Record<DocType, DocTypeMeta> = {
  LEGISLATION: {
    type: 'LEGISLATION',
    num: 1,
    // URL de la rubrique : « editionsmoniteur » (et non « legislation ») pour coller au
    // nom affiché « Éditions Le Moniteur ». Ancien slug accepté en alias (TYPE_SLUGS)
    // et redirigé (next.config.mjs) — anciens liens/favoris préservés.
    slug: 'editionsmoniteur',
    pastille: 'Lank',
    color: 'lank',
    badge: 'LE MONITEUR',
    label: {
      fr: 'Éditions Le Moniteur',
      en: 'Le Moniteur editions',
      ht: 'Edisyon Le Moniteur',
    },
    feature: {
      fr: 'Versions consolidées + historique des modifications ; statut En vigueur / Abrogé.',
      en: 'Consolidated versions + amendment history; status In force / Repealed.',
      ht: 'Vèsyon konsolide + istorik modifikasyon ; estati An vigè / Abowje.',
    },
  },
  CIRCULAIRE_BRH: {
    type: 'CIRCULAIRE_BRH',
    num: 2,
    slug: 'circulaires',
    pastille: 'Solèy',
    color: 'soley',
    badge: 'BRH',
    label: {
      fr: 'Circulaires de la BRH',
      en: 'BRH circulars',
      ht: 'Sikilè BRH yo',
    },
    feature: {
      fr: 'Tri par numéro de circulaire ; alertes de veille réglementaire (palier Pro).',
      en: 'Sort by circular number; regulatory-watch alerts (Pro tier).',
      ht: 'Triye pa nimewo sikilè ; alèt sou règleman (palye Pro).',
    },
  },
  JURISPRUDENCE: {
    type: 'JURISPRUDENCE',
    num: 3,
    slug: 'jurisprudence',
    pastille: 'Brim',
    color: 'brim',
    badge: 'JURISPRUDENCE',
    label: {
      fr: 'Recueil de jurisprudence',
      en: 'Case-law reports',
      ht: 'Rekèy jirispridans',
    },
    feature: {
      fr: "Filtres par juridiction (Cassation, Appel) et par matière ; sommaires d'arrêts.",
      en: 'Filters by court (Cassation, Appeal) and by subject; case summaries.',
      ht: 'Filtè pa jiridiksyon (Kasasyon, Apèl) ak pa matyè ; rezime desizyon yo.',
    },
  },
  DOCTRINE: {
    type: 'DOCTRINE',
    num: 4,
    // URL de la rubrique : « legislationannotee » (et non « doctrine ») pour coller au
    // nom affiché « Législation annotée ». L'ancien slug reste accepté en alias
    // (TYPE_SLUGS) et redirigé (next.config.mjs) — anciens liens/favoris préservés.
    slug: 'legislationannotee',
    pastille: 'Lagon',
    color: 'lagon',
    badge: 'ANNOTÉE',
    label: {
      fr: 'Législation annotée',
      en: 'Annotated legislation',
      ht: 'Lejislasyon anote',
    },
    feature: {
      fr: 'Auteur, revue, année ; citations croisées vers la législation commentée.',
      en: 'Author, journal, year; cross-citations to the commented legislation.',
      ht: 'Otè, revi, ane ; sitasyon kwaze sou lejislasyon yo komante a.',
    },
  },
  LOI_FINANCES: {
    type: 'LOI_FINANCES',
    num: 5,
    slug: 'finances',
    pastille: 'Fèy',
    color: 'fey',
    badge: 'FINANCES',
    label: {
      fr: 'Lois de finances haïtiennes',
      en: 'Haitian finance acts',
      ht: 'Lwa finans ayisyen yo',
    },
    feature: {
      fr: "Navigation par exercice fiscal ; comparateur d'articles entre exercices.",
      en: 'Navigation by fiscal year; article comparator across budgets.',
      ht: 'Navigasyon pa ane fiskal ; konparatè atik ant egzèsis yo.',
    },
  },
  MARQUE: {
    type: 'MARQUE',
    num: 6,
    slug: 'marques',
    pastille: 'Sitwon',
    color: 'sitwon',
    badge: 'MARQUES',
    label: {
      fr: 'Marques de commerce & de fabrique',
      en: 'Trade & manufacturing marks',
      ht: 'Mak komès ak fabrik',
    },
    feature: {
      fr: "Recherche d'antériorité : nom, classe de Nice, titulaire, n° BHDA, date de publication au Moniteur. Vue grille avec reproduction de la marque si publiée.",
      en: 'Prior-art search: name, Nice class, holder, BHDA no., Moniteur publication date. Grid view with mark reproduction when published.',
      ht: 'Rechèch antèryorite : non, klas Nice, titilè, nimewo BHDA, dat piblikasyon nan Monitè a. Vi griyaj ak repwodiksyon mak la si li pibliye.',
    },
  },
  INDEX: {
    type: 'INDEX',
    num: 7,
    slug: 'index',
    pastille: 'Endèks',
    color: 'endeks',
    badge: 'INDEX',
    referenceOnly: true,
    label: {
      fr: 'Index du Moniteur',
      en: 'Moniteur index',
      ht: 'Endèks Monitè a',
    },
    feature: {
      fr: 'Références des textes publiés au Moniteur (1900-2023) — lois, sociétés, marques. Référence et date de publication ; sans texte intégral.',
      en: 'References to texts published in the Moniteur (1900-2023) — laws, companies, marks. Reference and publication date; no full text.',
      ht: 'Referans tèks ki pibliye nan Monitè a (1900-2023) — lwa, konpayi, mak. Referans ak dat piblikasyon ; san tèks konplè.',
    },
  },
  TARIF_DOUANIER: {
    type: 'TARIF_DOUANIER',
    num: 8,
    slug: 'tarifs',
    pastille: 'Kannèl',
    color: 'kannel',
    badge: 'DOUANES',
    label: {
      fr: 'Tarifs douaniers',
      en: 'Customs tariffs',
      ht: 'Tarif ladwàn',
    },
    feature: {
      fr: 'Table des positions tarifaires (codes SH) et de leurs taux — droit de douane, TCA, accises ; recherche par code ou produit. Plus le corpus douanier : Tarif AGD, décrets et circulaires des douanes.',
      en: 'Tariff schedule (HS codes) and their rates — customs duty, sales tax, excise; search by code or product. Plus the customs corpus: AGD tariff, decrees and customs circulars.',
      ht: 'Tablo pozisyon tarifè yo (kòd SH) ak to yo — dwa ladwàn, TCA, aksiz ; chèche pa kòd oswa pwodwi. Plis dokiman ladwàn yo : Tarif AGD, dekrè ak sikilè ladwàn.',
    },
  },
}

export const DOC_TYPE_LIST = Object.values(DOC_TYPE_META).sort((a, b) => a.num - b.num)

/** Classes Tailwind par couleur — pastille (fond doux + texte) et badge (plein). */
export const COLOR_CLASSES: Record<DocTypeMeta['color'], { dot: string; badge: string; ring: string; text: string }> = {
  lank: { dot: 'bg-lank', badge: 'bg-lank text-white', ring: 'ring-lank', text: 'text-lank' },
  soley: { dot: 'bg-soley', badge: 'bg-soley text-lank', ring: 'ring-soley', text: 'text-soley-700' },
  brim: { dot: 'bg-brim', badge: 'bg-brim text-white', ring: 'ring-brim', text: 'text-brim-700' },
  lagon: { dot: 'bg-lagon', badge: 'bg-lagon text-lank', ring: 'ring-lagon', text: 'text-lagon-700' },
  fey: { dot: 'bg-fey', badge: 'bg-fey text-white', ring: 'ring-fey', text: 'text-fey' },
  sitwon: { dot: 'bg-sitwon', badge: 'bg-sitwon text-lank', ring: 'ring-sitwon', text: 'text-sitwon-700' },
  endeks: { dot: 'bg-endeks', badge: 'bg-endeks text-white', ring: 'ring-endeks', text: 'text-endeks-700' },
  kannel: { dot: 'bg-kannel', badge: 'bg-kannel text-white', ring: 'ring-kannel', text: 'text-kannel-700' },
}

/** Le sous-ensemble « 6 services de textes intégraux » (sans l'Index). */
export const FULLTEXT_TYPE_LIST = DOC_TYPE_LIST.filter((m) => !m.referenceOnly)

export const BRAND = {
  name: 'Lam',
  wordmark: 'lam',
  domain: 'lam.ht',
  url: 'https://lam.ht',
  baseline: { fr: 'Le fruit du savoir', en: 'The fruit of knowledge', ht: 'Fwi konesans la' },
  seal: 'LAM · LE FRUIT DU SAVOIR',
  verifiedBadge: { fr: 'Document vérifié', en: 'Verified document', ht: 'Dokiman verifye' },
}
