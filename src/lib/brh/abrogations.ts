/**
 * Chaîne d'abrogation des Circulaires BRH — table de référence de l'application.
 *
 * Chaque relation porte la CLAUSE du texte abrogeant, citée : une abrogation ne se déduit
 * jamais d'une numérotation, d'une date ou d'un titre. La table vit ici, et non dans un
 * script, parce qu'une relation peut prendre effet APRÈS son écriture : la passe quotidienne
 * (/api/cron/alerts) applique celles dont la date d'effet est atteinte.
 *
 * Établie par relevé systématique des corps de la section, puis lecture de chaque phrase.
 * Voir docs/abrogations-brh-liste-verifiee.md.
 */
import type { PrismaClient } from '@prisma/client'

export interface AbrogationRelation {
  /** Numéro canonique du texte abrogé (« Circulaire n° 105-1 »). */
  cible: string
  /** Numéro canonique du texte qui l'abroge. */
  par: string
  /** Date d'EFFET annoncée par la clause — pas la date de signature (AAAA-MM-JJ). */
  effet: string
  /** Extrait verbatim du texte abrogeant : la seule justification admise. */
  clause: string
}

export const ABROGATIONS: AbrogationRelation[] = [
  { cible: 'Circulaire n° 70', par: 'Circulaire n° 110-1', effet: '2017-04-17',
    clause: 'Cette circulaire annule et remplace celle du 16 mai 1995 (Réf. BRH/CIR/95 # 70).' },
  { cible: 'Circulaire n° 105', par: 'Circulaire n° 105-1', effet: '2017-05-02',
    clause: 'La présente circulaire abroge la circulaire 105 en date du 28 novembre 2013 et entre en vigueur le 2 mai 2017.' },
  { cible: 'Circulaire n° 72-3', par: 'Circulaire n° 111', effet: '2017-12-01',
    clause: 'La présente circulaire abroge les circulaires No 72-3 du 1er septembre 1998 et 78-1 du 27 mars 2000. La présente circulaire entre en vigueur le 1er décembre 2017.' },
  { cible: 'Circulaire n° 78-1', par: 'Circulaire n° 111', effet: '2017-12-01',
    clause: 'La présente circulaire abroge les circulaires No 72-3 du 1er septembre 1998 et 78-1 du 27 mars 2000. La présente circulaire entre en vigueur le 1er décembre 2017.' },
  { cible: 'Circulaire n° 61-2', par: 'Circulaire n° 63-3', effet: '2020-11-03',
    clause: 'Les dispositions de la présente circulaire remplacent celles de la Circulaire No 61-2 et entrent en vigueur le 3 novembre 2020.' },
  { cible: 'Circulaire n° 89-1', par: 'Circulaire n° 89-2', effet: '2020-11-03',
    clause: 'Les dispositions de la présente circulaire remplacent celles de la Circulaire No 89-1 du 29 septembre 2015 et entrent en vigueur le 3 novembre 2020.' },
  { cible: 'Circulaire n° 82-2', par: 'Circulaire n° 82-3', effet: '2020-11-03',
    clause: 'Les dispositions de la présente circulaire remplacent celles de la circulaire N° 82-2 du 12 décembre 1997 et entrent en vigueur le 3 novembre 2020.' },
  { cible: 'Circulaire n° 88', par: 'Circulaire n° 88-1', effet: '2021-04-01',
    clause: 'Les dispositions de la présente circulaire remplacent celles de la Circulaire No 88 du 10 décembre 1998 et entrent en vigueur à compter du 1er avril 2021.' },
  { cible: 'Circulaire n° 92', par: 'Circulaire n° 92-1', effet: '2022-02-01',
    clause: 'Les dispositions de la présente circulaire remplacent celles de la circulaire No 92 du 9 avril 1998 et entrent en vigueur le 1er février 2022.' },
  { cible: 'Circulaire n° 99-3', par: 'Circulaire n° 99-4', effet: '2023-08-14',
    clause: 'La présente circulaire abroge la circulaire 99-3 du 27 août 2020 et la note additionnelle du 14 novembre 2022. Elle entre en vigueur le 14 août 2023.' },
  { cible: 'Circulaire n° 83-4', par: 'Circulaire n° 83-5', effet: '2024-04-01',
    clause: 'Les dispositions de la présente circulaire remplacent celles de la circulaire No 83-4 du 18 septembre 2000 et entrent en vigueur le 1er avril 2024.' },
  { cible: 'Circulaire n° 115-5', par: 'Circulaire n° 115-6', effet: '2024-10-01',
    clause: 'La présente circulaire remplace la circulaire 115-5 du 28 mars 2024 et entre en vigueur le 1er octobre 2024.' },
  { cible: 'Lettre-Circulaire n° 09-1', par: 'Circulaire n° 130', effet: '2025-04-02',
    clause: 'Cette circulaire abroge la lettre-circulaire 09-1 du 7 juin 2016 et entre en vigueur le 2 avril 2025.' },
  { cible: 'Circulaire n° 95-4', par: 'Circulaire n° 95-5', effet: '2025-04-16',
    clause: 'La présente circulaire abroge la circulaire No 95-4 et entre en vigueur à la date de signature.' },
  { cible: 'Circulaire n° 105-1', par: 'Circulaire n° 105-2', effet: '2025-10-15',
    clause: 'La présente circulaire abroge la circulaire 105-1 en date du 3 avril 2017 et entre en vigueur le 15 octobre 2025.' },
  { cible: 'Circulaire n° 117', par: 'Circulaire n° 117-1', effet: '2026-01-05',
    clause: 'Les dispositions de la présente circulaire remplacent celles de la circulaire 117 et entrent en vigueur le 5 janvier 2026.' },
  { cible: 'Circulaire n° 129', par: 'Circulaire n° 129-1', effet: '2026-03-02',
    clause: 'La présente circulaire abroge la circulaire 129 du 31 mars 2025 et entre en vigueur le 2 mars 2026.' },
  { cible: 'Circulaire n° 109-1', par: 'Circulaire n° 131', effet: '2026-03-02',
    clause: 'La présente circulaire abroge la circulaire 109-1 du 10 mai 2019 et entre en vigueur le 2 mars 2026.' },
  // ── Effet à venir : appliquée d'elle-même le jour dit par la passe quotidienne ──────
  { cible: 'Circulaire n° 87', par: 'Circulaire n° 87-1', effet: '2026-10-01',
    clause: 'Les dispositions de la présente circulaire remplacent celles de la Circulaire No 87 du 29 septembre 1997 et entrent en vigueur le 1er octobre 2026.' },
]

/** Relations dont la date d'effet est atteinte à `now`. */
export function relationsEchues(now: Date = new Date()): AbrogationRelation[] {
  return ABROGATIONS.filter((r) => new Date(`${r.effet}T00:00:00Z`) <= now)
}

/**
 * Porte en base les abrogations échues qui ne le sont pas encore. Idempotent : ne touche
 * qu'aux fiches dont le statut ou le renvoi diffèrent.
 *
 * GARDE CHRONOLOGIQUE : un texte ne peut pas en abroger un PLUS RÉCENT que lui. Une cible
 * résolue par son seul numéro peut être un homonyme — c'est ainsi que la circulaire de
 * réserves obligatoires de 2015 avait été marquée abrogée par une circulaire de 2008.
 */
export async function appliquerAbrogationsEchues(
  client: PrismaClient,
  now: Date = new Date(),
): Promise<{ portees: string[]; ignorees: string[] }> {
  const portees: string[] = []
  const ignorees: string[] = []
  for (const r of relationsEchues(now)) {
    const par = await client.document.findFirst({
      where: { type: 'CIRCULAIRE_BRH', number: r.par },
      select: { publicationDate: true },
    })
    if (!par) { ignorees.push(`${r.cible} : ${r.par} absente`); continue }
    const cibles = await client.document.findMany({
      where: { type: 'CIRCULAIRE_BRH', number: r.cible },
      select: { id: true, status: true, abrogatedByNumber: true, publicationDate: true },
    })
    if (!cibles.length) { ignorees.push(`${r.cible} : absente`); continue }
    for (const c of cibles) {
      if (c.publicationDate && par.publicationDate && c.publicationDate > par.publicationDate) {
        ignorees.push(`${r.cible} : postérieure à ${r.par} — homonyme probable`)
        continue
      }
      if (c.status === 'ABROGE' && c.abrogatedByNumber === r.par) continue
      await client.document.update({
        where: { id: c.id },
        data: { status: 'ABROGE', abrogatedByNumber: r.par },
      })
      portees.push(`${r.cible} ← ${r.par}`)
    }
  }
  return { portees, ignorees }
}
