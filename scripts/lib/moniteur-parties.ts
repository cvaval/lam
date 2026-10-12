/**
 * Lecture des noms de fichiers des fascicules du Moniteur — fonctions PURES, testées à part
 * (`moniteur-parties.test.ts`) : le script d'import lance `main()` dès son chargement et ne
 * peut pas être importé par un test.
 */

const MOIS_RE = 'janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre'

/**
 * Le JOUR de parution écrit dans un nom de fichier, ou null.
 *
 * ⚠️ LE NUMÉRO N'EST PAS LE JOUR. L'ancienne lecture cherchait « un nombre suivi d'un mois » dans
 * le nom entier : « Le Moniteur No. 4 Janvier 2022 » donnait le 4 janvier — c'est le numéro du
 * fascicule, pas sa date. Tous les fascicules de numéro ≤ 31 nommés sans jour (2013, 2017, 2020,
 * 2022) recevaient une date fausse marquée « lue dans le nom ». On retire donc la désignation
 * « No. N[-X] » (et « Nos. N et M ») avant de chercher le jour.
 *
 * « 1er » est lu (« Mardi 1er Août 2023 ») ; « 2Avril » aussi (jour collé au mois, 2016-2026).
 * Le suffixe peut porter un chiffre (« Spécial No.12-A1 Février 2025 ») : sans quoi le « 1 »
 * de « A1 » devenait le 1er février.
 */
export function jourDuNom(nom: string): number | null {
  const sans = nom
    .normalize('NFC')
    .replace(/No\.?s?\s*\d+(?:\s*(?:[+&]|et)\s*\d+)?(?:\s*-\s*[A-Za-z]\d?\b)?/i, ' ')
  const m = sans.match(new RegExp(`(?:^|[^\\d])(\\d{1,2})(?:er)?\\s*(?:${MOIS_RE})`, 'i'))
  if (!m) return null
  const d = Number(m[1])
  return d >= 1 && d <= 31 ? d : null
}

/** Première page de la plage écrite dans le nom : « (12-30 pages) », « (1-30pages) », « (81 - 100 pages) ». */
export function debutDePlage(nom: string): number | null {
  const m = nom.normalize('NFC').match(/\(\s*(\d+)\s*-\s*\d+\s*pages?\s*\)/i)
  return m ? Number(m[1]) : null
}

export interface PartieNommee {
  /** Nom du fichier (sans chemin). */
  nom: string
  /** Clé d'édition lue dans le nom du fichier (ex. « SP-30-A »), ou null si illisible. */
  cle: string | null
}

export interface EditionDecoupee {
  /** Clé de l'édition (celle de sa première partie, à défaut celle du dossier). */
  cle: string
  /** Les parties, dans l'ordre des pages. */
  parties: string[]
  /** Parties dont le nom désigne un autre numéro mais que la pagination rattache ici. */
  rectifications: string[]
}

/**
 * Découpe un dossier « édition en plusieurs parties » en éditions, parties dans l'ORDRE DES PAGES.
 *
 * ⚠️ L'ORDRE ALPHABÉTIQUE N'EST PAS L'ORDRE DES PAGES : « (101-130 pages) » passe avant
 * « (25-40 pages) ». On trie sur la première page de la plage.
 *
 * ⚠️ UN DOSSIER PEUT PORTER PLUSIEURS ÉDITIONS, ET UN NOM PEUT MENTIR. Deux cas réels :
 *  - 2021, dossier « Spécial No. 30 » : n° 30 (4 parties), 30-A (4) et 30-B (2) — trois
 *    éditions, chacune recommençant à la page 1. Fondues en une seule fiche, deux disparaissaient ;
 *  - 2020, dossier « Spécial No. 13 » : « No. 13 (1-20) », « No. 14 (21-40) », « No. 14 (41-72) ».
 *    L'en-tête de page des deux derniers dit « Spécial N° 13 · Vendredi 3 Juillet 2020 » : la
 *    pagination continue, ce sont des parties du n° 13 au nom erroné (le vrai n° 14 a son dossier).
 * Règle : une partie qui commence à la page 1 (ou sans plage) OUVRE une édition, sous la clé de son
 * propre nom ; une partie qui commence plus loin CONTINUE l'édition en cours, quel que soit son nom
 * (et on le signale). Les parties du numéro du dossier passent en premier.
 * Une première partie qui ne commence pas à 1 est une anomalie : on lève une erreur.
 */
export function decouperEnEditions(cleDossier: string, parties: PartieNommee[]): EditionDecoupee[] {
  const groupes = new Map<string, PartieNommee[]>()
  for (const p of parties) {
    const k = p.cle ?? cleDossier
    groupes.set(k, [...(groupes.get(k) ?? []), p])
  }
  const cles = [...groupes.keys()].sort((a, b) => Number(b === cleDossier) - Number(a === cleDossier) || a.localeCompare(b))
  const ordonnees = cles.flatMap((k) =>
    groupes.get(k)!.slice().sort((a, b) => (debutDePlage(a.nom) ?? 1) - (debutDePlage(b.nom) ?? 1) || a.nom.localeCompare(b.nom)),
  )

  const editions: EditionDecoupee[] = []
  for (const p of ordonnees) {
    const debut = debutDePlage(p.nom) ?? 1
    const courante = editions[editions.length - 1]
    if (debut === 1 || !courante) {
      if (debut !== 1) throw new Error(`« ${p.nom} » commence à la page ${debut} sans partie qui la précède`)
      editions.push({ cle: p.cle ?? cleDossier, parties: [p.nom], rectifications: [] })
      continue
    }
    courante.parties.push(p.nom)
    if (p.cle && p.cle !== courante.cle) {
      courante.rectifications.push(`« ${p.nom} » nommé ${p.cle} : pages ${debut} et suivantes de ${courante.cle}`)
    }
  }
  return editions
}
