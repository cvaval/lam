/**
 * CLASSEMENT DES BANDEAUX ET DES BLOCS CONNEXES de la Législation annotée — harmonisation des replis
 * (consigne de Me Vaval, 17 oct. 2026 : « les codes couleurs doivent être identiques pour le même type
 * de situation » ; spécification docs/prompt-harmonisation-replis-legislation-annotee.md, § 5.3-5.4).
 *
 * Pose le champ `kind` :
 *  - sur les 30 BANDEAUX de section (`annotations.crossRefs` porteurs d'une note, d'actes ou
 *    d'articles insérés) — table FERMÉE ci-dessous, une ligne par bandeau, relue note par note ;
 *  - sur les 730 BLOCS CONNEXES (`annotations.connexe`) — motifs de `natureDuConnexe`
 *    (src/lib/legislation/situations.ts) ; un bloc qui tombe au défaut « source » doit répondre à la
 *    table FERMÉE `SOURCE_ACCEPTEE`, sinon le script s'arrête sans rien écrire (0 bloc non classé) ;
 *  - `oldVersionsLabel: 'Ancienne version (1987)'` sur la seule Constitution (le libellé était écrit
 *    en dur et s'affichait sur cinq autres textes).
 *
 * ⚠️ IL NE TOUCHE QU'À CES CHAMPS. Avant d'écrire, il vérifie que le JSON de chaque fiche, `kind` et
 * `oldVersionsLabel` retirés, est IDENTIQUE à celui d'avant. Il écrit un journal (fiche, chemin, valeur
 * antérieure) qui suffit à défaire, puis relit et recompte.
 *
 *     npx tsx scripts/classer-replis-legislation-annotee.ts            # à blanc
 *     npx tsx scripts/classer-replis-legislation-annotee.ts --commit   # écrit
 */
import { PrismaClient } from '@prisma/client'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { audit } from '../src/lib/auth/audit'
import { natureDuConnexe, NATURES_BANDEAU, NATURES_CONNEXE, type NatureBandeau, type NatureConnexe } from '../src/lib/legislation/situations'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')
const VIA = 'classer-replis-legislation-annotee'

/**
 * Les 30 bandeaux — `SOURCE|ancre` → nature, et le DÉBUT de la note attendue (garde : une note
 * réécrite depuis ne se reclasse pas à l'aveugle). Tableau D10 du prompt, relu note par note le
 * 17 oct. 2026 ; deux écarts au classement par motifs : le visa de l'IR 2005 (« reproduit ici tel que
 * le porte le Journal officiel » : sic) et la loi UCREF (« Loi votée par… promulguée… » : provenance).
 */
const BANDEAUX: Record<string, { kind: NatureBandeau; debut: string }> = {
  // Irrégularités du Journal officiel, reproduites telles quelles (9)
  'CODE_FISCAL_2026|sec-31': { kind: 'sic', debut: 'Le Journal officiel passe de la rubrique A' },
  'CODE_FISCAL_2026|sec-261': { kind: 'sic', debut: 'Le Journal officiel passe de l’article 293' },
  'CODE_FISCAL_2026|sec-353': { kind: 'sic', debut: 'Le Journal officiel imprime deux fois « Article 406 »' },
  'CODE_PENAL_2025|sec-266': { kind: 'sic', debut: 'Le Journal officiel imprime deux fois « Article 562 »' },
  'CODE_PENAL_2025|sec-350': { kind: 'sic', debut: 'Le Journal officiel passe de l’article 697' },
  'DECRET_MINIER_2026|sec-1': { kind: 'sic', debut: 'Le Journal officiel porte ici « CHAPITRE PREMIER' },
  'DECRET_MINIER_2026|sec-7': { kind: 'sic', debut: 'Le Journal officiel imprime « Articles 27.- »' },
  'DECRET_IMF_2020|sec-6': { kind: 'sic', debut: 'Le Journal officiel ne comporte pas d’article 13' },
  'DECRET_IMPOT_REVENU_2005|sec-56': { kind: 'sic', debut: 'Le visa de la loi sur la responsabilité des fonctionnaires' },
  // Textes consolidés (5)
  'LOI_PATENTE_1996_CONSOLIDE|sec-1': { kind: 'consolidation', debut: 'Texte CONSOLIDÉ de la patente' },
  'DECRET_TIMBRE_1978_CONSOLIDE|sec-1': { kind: 'consolidation', debut: 'Texte CONSOLIDÉ : Décret du 29 novembre 1978' },
  'DECRET_CFPB_1979_CONSOLIDE|sec-1': { kind: 'consolidation', debut: 'Texte CONSOLIDÉ : Décret du 5 avril 1979' },
  'DECRET_IMPOT_REVENU_2005|sec-1': { kind: 'consolidation', debut: 'Texte CONSOLIDÉ : Décret du 29 septembre 2005' },
  'DECRET_ENREGISTREMENT_1977|sec-1': { kind: 'consolidation', debut: 'Décret du 28 septembre 1977' },
  // Modifications par un acte (6)
  'CODE_PENAL_ANNOTE|sec-65': { kind: 'modification', debut: 'Articles 269 et 270 : nouvelle rédaction' },
  'CODE_PENAL_ANNOTE|sec-67': { kind: 'modification', debut: 'Articles 278, 279 et 280' },
  'CODE_PENAL_ANNOTE|sec-69': { kind: 'modification', debut: 'Articles 281, 282 et 283 modifiés' },
  'CODE_CIVIL_ANNOTE|sec-41': { kind: 'modification', debut: 'Cette loi pose, sous la présente LOI Nº 8' },
  'CODE_CIVIL_ANNOTE|sec-93': { kind: 'modification', debut: 'Successions : article 606 modifié' },
  'CODE_PROCEDURE_CIVILE|sec-103': { kind: 'modification', debut: 'Livre IX réformé en entier' },
  // Provenance (3)
  'DECRET_FETES_LEGALES_2024|sec-1': { kind: 'provenance', debut: 'Décret donné au Palais National' },
  'LOI_UCREF_2017|sec-1': { kind: 'provenance', debut: 'Loi votée par la Chambre des Députés le 4 mai 2017' },
  'DECRET_IMF_2020|sec-1': { kind: 'provenance', debut: 'Décret donné au Palais National le 5 juin 2020' },
  // Annexes éditoriales (5)
  'DECRET_TNT_2026|sec-1': { kind: 'annexe', debut: 'Sommaire et index : annexes éditoriales' },
  'CODE_INVESTISSEMENTS_2002|sec-1': { kind: 'annexe', debut: 'Index alphabétique des mots-clés : annexe éditoriale' },
  'DECRET_DENREES_ALIMENTAIRES_2020|sec-1': { kind: 'annexe', debut: 'Sommaire analytique et index' },
  'DECRET_GESTION_ENVIRONNEMENT_2005|sec-1': { kind: 'annexe', debut: 'Sommaire et index : annexes éditoriales' },
  'DECRET_EDH_2016|sec-1': { kind: 'annexe', debut: 'Sommaire analytique et index : annexes éditoriales' },
  // Rectifications (2)
  'DECRET_ENERGIE_ELECTRIQUE_2016|sec-1': { kind: 'rectification', debut: '⚠️ RECTIFICATION (30 août 2026)' },
  'CC_VANDAL_IV-A-5|art-7': { kind: 'rectification', debut: 'Article 7 ajouté le 29 août 2026' },
}

/**
 * Un bloc connexe classé « source » (législation connexe : texte rattaché, renvoi « V. … ») par
 * défaut doit répondre à l'un de ces motifs — relus sur les 124 blocs concernés le 17 oct. 2026 :
 * « V. l'art. 2 du D. du 8 octobre 1982 » (Code civil, 66 blocs sans intitulé), extraits d'actes
 * (« Décret du 30 août 1988, art. 1 La mort civile est abolie »), « Source — Const du 29 mars 1987 »
 * (appendices du CPC), circulaires BRH (Décret IMF), « Code civil d'Haïti » (Arrêté PDP).
 * ⚠️ « Texte SUPPLANTÉ … L'abrogation est tacite » (Décret signature électronique 2015) reste une
 * source : une abrogation TACITE ne s'affirme pas d'une couleur « Abrogé par ».
 */
const SOURCE_ACCEPTEE = [
  /^Source —/,
  /^V\.\s/,
  /^(?:Loi|Décret(?:-loi)?|DECRET|Arrêté)\s+(?:du|DU)\s/,
  /^Constitution de \d{4}/,
  /^Circulaire BRH/,
  /^Code (?:civil|pénal) d’Haïti$/,
  /^Législation sur les loyers/,
  /^Convention synallagmatique par voie électronique/,
]
const sourceAcceptee = (label: string, text: string) => {
  const l = label.trim()
  const t = text.trim()
  return l ? SOURCE_ACCEPTEE.some((r) => r.test(l)) : /^(?:V\.\s|(?:Décret|Loi) du \d|Constitution de \d{4})/.test(t)
}

// ── Types souples : le JSON est relu tel quel, et réécrit tel quel hormis `kind` ──────────────
type Json = Record<string, unknown>
interface Cr extends Json {
  anchor?: string
  note?: string
  kind?: string
  docs?: unknown[]
  insertedArticles?: unknown[]
}
interface Bloc extends Json {
  label?: string
  text?: string
  kind?: string
}
interface Journal {
  docId: string
  source: string
  chemin: string
  avant: unknown
  apres: unknown
}

/** Le JSON sans les champs que ce script a le droit de toucher — doit être identique avant/après. */
const sansChampsTouches = (a: Json): string =>
  JSON.stringify(a, (k, v) => (k === 'kind' || k === 'oldVersionsLabel' ? undefined : v))

async function main() {
  // Préfiltre côté serveur : seules les fiches à bandeaux, à blocs connexes, ou la Constitution
  // (le relevé complet, fiche par fiche, prend six minutes sur le pooler à une connexion).
  const cibles = await prisma.$queryRaw<{ id: string; source: string | null }[]>`
    SELECT id, source FROM "Document"
    WHERE type = 'LEGISLATION' AND "annotationsJson" IS NOT NULL
      AND ("annotationsJson" ~ '"connexe"\\s*:\\s*\\{\\s*"' OR "annotationsJson" ~ '"(?:note|insertedArticles)"\\s*:' OR source = 'CONSTITUTION_1987')`
  console.log(`${cibles.length} fiche(s) à examiner`)

  const journal: Journal[] = []
  const ecritures: { id: string; source: string; json: string; nb: number }[] = []
  const vusBandeaux = new Set<string>()
  const compteBandeaux: Record<string, number> = {}
  const compteConnexe: Record<string, number> = {}
  const nonClasses: string[] = []
  let constitution = 0

  for (const { id, source: src } of cibles) {
    const source = src ?? '(sans source)'
    const d = await prisma.document.findUnique({ where: { id }, select: { annotationsJson: true } })
    const a = JSON.parse(d!.annotationsJson!) as Json
    const avant = sansChampsTouches(a)
    let nb = 0

    for (const [i, c] of ((a.crossRefs as Cr[] | undefined) ?? []).entries()) {
      if (!c.note && !c.docs?.length && !c.insertedArticles?.length) continue
      const cle = `${source}|${c.anchor}`
      const decision = BANDEAUX[cle]
      if (!decision) {
        nonClasses.push(`bandeau ${cle} « ${(c.note ?? '').slice(0, 80)} »`)
        continue
      }
      if (!(c.note ?? '').startsWith(decision.debut)) throw new Error(`⛔ ${cle} : la note ne commence plus par « ${decision.debut} » — rien n'est écrit`)
      if (!NATURES_BANDEAU.includes(decision.kind)) throw new Error(`⛔ ${cle} : nature inconnue ${decision.kind}`)
      vusBandeaux.add(cle)
      compteBandeaux[decision.kind] = (compteBandeaux[decision.kind] ?? 0) + 1
      if (c.kind !== decision.kind) {
        journal.push({ docId: id, source, chemin: `crossRefs[${i}].kind`, avant: c.kind, apres: decision.kind })
        c.kind = decision.kind
        nb++
      }
    }

    for (const [anchor, blocs] of Object.entries((a.connexe as Record<string, Bloc[]> | undefined) ?? {})) {
      for (const [i, b] of (blocs ?? []).entries()) {
        const sansKind = { ...b, kind: undefined }
        const n: NatureConnexe = natureDuConnexe(sansKind)
        if (n === 'source' && !sourceAcceptee(b.label ?? '', b.text ?? '')) {
          nonClasses.push(`connexe ${source}|${anchor}[${i}] « ${(b.label || b.text || '').slice(0, 80)} »`)
          continue
        }
        if (!NATURES_CONNEXE.includes(n)) throw new Error(`⛔ nature inconnue ${n}`)
        compteConnexe[n] = (compteConnexe[n] ?? 0) + 1
        if (b.kind !== n) {
          journal.push({ docId: id, source, chemin: `connexe.${anchor}[${i}].kind`, avant: b.kind, apres: n })
          b.kind = n
          nb++
        }
      }
    }

    if (source === 'CONSTITUTION_1987') {
      constitution++
      if (a.oldVersionsLabel !== 'Ancienne version (1987)') {
        journal.push({ docId: id, source, chemin: 'oldVersionsLabel', avant: a.oldVersionsLabel, apres: 'Ancienne version (1987)' })
        a.oldVersionsLabel = 'Ancienne version (1987)'
        nb++
      }
    }

    if (sansChampsTouches(a) !== avant) throw new Error(`⛔ ${source} : un autre champ que kind/oldVersionsLabel a changé — rien n'est écrit`)
    if (nb) ecritures.push({ id, source, json: JSON.stringify(a), nb })
  }

  const manquants = Object.keys(BANDEAUX).filter((k) => !vusBandeaux.has(k))
  console.log('\nBandeaux :', compteBandeaux, `— ${vusBandeaux.size}/30`)
  console.log('Blocs connexes :', compteConnexe, `— ${Object.values(compteConnexe).reduce((x, y) => x + y, 0)}`)
  console.log(`Constitution : ${constitution} fiche`)
  if (manquants.length) throw new Error(`⛔ bandeaux de la table introuvables : ${manquants.join(', ')} — rien n'est écrit`)
  if (nonClasses.length) throw new Error(`⛔ ${nonClasses.length} non classé(s) — rien n'est écrit :\n  ${nonClasses.join('\n  ')}`)
  if (constitution !== 1) throw new Error(`⛔ ${constitution} Constitution(s) — rien n'est écrit`)
  console.log(`\n${journal.length} champ(s) à poser sur ${ecritures.length} fiche(s) :`)
  for (const e of ecritures) console.log(`  ${e.source} : ${e.nb}`)

  if (!COMMIT) {
    console.log('\n(à blanc — --commit pour écrire)')
    return
  }

  const dir = join(__dirname, 'data/harmonisation-replis')
  mkdirSync(dir, { recursive: true })
  const fichier = join(dir, `journal-${new Date().toISOString().slice(0, 10)}.json`)
  writeFileSync(fichier, JSON.stringify(journal, null, 1))
  console.log(`\njournal : ${fichier}`)

  for (const e of ecritures) {
    // L'écriture recalcule le vecteur plein-texte (~10 s sur le Code civil) : pas de transaction de 5 s.
    await prisma.document.update({ where: { id: e.id }, data: { annotationsJson: e.json } })
    await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: e.id, meta: { via: VIA, correction: 'classement des replis (kind)', champs: e.nb, decision: 'harmonisation des replis — Me Vaval, 17 oct. 2026' } })
    console.log(`  ✓ ${e.source}`)
  }

  // Recompte : relire chaque fiche écrite et vérifier chaque valeur du journal.
  let ok = 0
  for (const e of ecritures) {
    const r = await prisma.document.findUnique({ where: { id: e.id }, select: { annotationsJson: true } })
    if (r?.annotationsJson !== e.json) throw new Error(`⛔ recompte : ${e.source} ne porte pas le JSON écrit`)
    ok += e.nb
  }
  if (ok !== journal.length) throw new Error(`⛔ recompte : ${ok}/${journal.length}`)
  console.log(`\n✅ écrit et recompté : ${ok} champ(s) sur ${ecritures.length} fiche(s)`)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
