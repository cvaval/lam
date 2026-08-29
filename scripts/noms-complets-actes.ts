/**
 * NOM COMPLET DES ACTES — nature + DATE + objet, dans le titre comme dans la référence.
 *
 *     npx tsx scripts/noms-complets-actes.ts            # simulation
 *     npx tsx scripts/noms-complets-actes.ts --apply    # Me Vaval, elle seule
 *
 * Me Vaval, 29 août 2026 : « il faut TOUJOURS indiquer le nom complet des arrêtés, des décrets et
 * des lois, ne pas s'en tenir uniquement aux dates. Corriger tous les documents de la plateforme
 * afin qu'ils soient conformes. »
 *
 * ⚠️ LE DÉFAUT EST SYMÉTRIQUE, ET C'EST CE QUI LE REND INVISIBLE. Tantôt le titre porte l'objet
 * sans la date (« Décret réformant le Droit des Sûretés »), tantôt la référence porte la date sans
 * l'objet (« Décret du 9 avril 2020 ») — et chacun, pris seul, semble correct. Mesuré sur les
 * 31 278 documents : AUCUN titre ne s'arrête à la date, mais 26 références oui.
 *
 * ⚠️ LA RÈGLE VISE LES ACTES, PAS LES CODES. « Code civil d'Haïti », « Code pénal d'Haïti »,
 * « Code du Travail », « Constitution de 1987 » sont des noms propres. Les remplacer par l'acte
 * qui les institue (« Décret du 24 février 1984 ») appauvrirait la fiche au lieu de l'enrichir.
 * La liste d'exclusion est EXPLICITE et vérifiée : un code qui y échapperait serait renommé.
 *
 * ⚠️ CE SCRIPT NE TOUCHE NI AUX CORPS, NI AUX ANNOTATIONS, NI AUX RENVOIS. Seuls `titleFr` et
 * `number` changent. Il ne touche pas non plus à l'INDEX DU MONITEUR, miroir exact de sa source
 * (27 234 entrées) : y réécrire un titre romprait la réconciliation avec DATA ACEVIEWER.
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'

const APPLY = process.argv.includes('--apply')

/** Référence réduite à la date : « Décret du 9 avril 2020 », rien d'autre. */
const DATE_SEULE = /^(Loi|Décret|Décret-loi|Décret-Loi|Arrêté|Circulaire|Ordonnance)\s+(du|de la|des)\s+(\d{1,2}(?:er)?\s+\p{L}+\s+\d{4})\s*[.,;)]?\s*$/u
/** Le titre porte-t-il une date, même en mois abrégé ? ⚠️ « fév » sans r existe au recueil du
 *  Code de procédure civile (« Décret du 26 fév 1975 ») : une liste trop stricte le déclare sans
 *  date et propose de lui en ajouter une seconde. */
const A_UNE_DATE = /\d{1,2}(?:er)?\s+(janv|fév|fev|mars|avr|mai|juin|juil|août|aout|sept|oct|nov|déc|dec)\p{L}*\.?\s+\d{4}/iu
/** Une date écrite en toutes lettres, où qu'elle soit dans la chaîne. */
const DATE_DEDANS = /(\d{1,2}(?:er)?\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4})/iu
const MOIS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
/** Le titre commence-t-il par la nature de l'acte ? */
const TETE_ACTE = /^(Loi|Décret-loi|Décret-Loi|Décret|Arrêté|Ordonnance)\b/

/** ⚠️ NOMS PROPRES — jamais renommés par l'acte qui les institue. */
const CODES = new Set([
  'CODE_CIVIL_ANNOTE', 'CODE_PENAL_ANNOTE', 'CODE_TRAVAIL_ANNOTE', 'CODE_PROCEDURE_CIVILE',
  'CONSTITUTION_1987', 'CODE_INSTRUCTION_CRIMINELLE', 'CC_VANDAL_CODE',
])

/**
 * ⚠️ LE CAS PORTE SON `id`, PAS SEULEMENT SA `source`. Le 29 août 2026, une première version
 * indexait les identifiants PAR SOURCE — or les 86 circulaires du site de la BRH partagent la
 * source « BRH-WEB ». Les onze mises à jour ont donc toutes écrit sur UNE SEULE fiche, qui s'est
 * retrouvée avec le titre d'une autre. Rien n'a été perdu (chaque titre existait ailleurs), mais
 * une fiche du 13 mars 1995 a porté pendant une heure le titre d'une circulaire du 2 mars 1992.
 * **Une clé d'identité qui n'identifie pas est un piège muet : `source` n'est PAS unique.**
 */
type Cas = { id: string; source: string; type: string; titre: string; ref: string | null; neuf: string; motif: string }

async function main() {
  const docs = await prisma.document.findMany({
    where: { type: { in: ['LEGISLATION', 'DOCTRINE', 'CIRCULAIRE_BRH'] } },
    select: { id: true, type: true, source: true, titleFr: true, number: true, adoptionDate: true },
  })

  const cas: Cas[] = []
  const exclus: string[] = []
  for (const d of docs) {
    const titre = (d.titleFr ?? '').trim()
    const ref = d.number?.trim() ?? null
    if (CODES.has(d.source ?? '')) { if (ref && DATE_SEULE.test(ref)) exclus.push(`${d.source} — « ${titre} » (nom propre, référence « ${ref} » laissée)`); continue }
    const m = ref ? DATE_SEULE.exec(ref) : null
    if (m && !A_UNE_DATE.test(titre) && TETE_ACTE.test(titre)) {
      // ni l'un ni l'autre n'est complet : on fusionne la date de la référence dans le titre
      const neuf = titre.replace(TETE_ACTE, (t) => `${t} du ${m[3]}`)
      cas.push({ id: d.id, source: d.source ?? '', type: d.type, titre, ref, neuf, motif: 'date de la référence portée au titre, puis référence = titre' })
    } else if (m) {
      // le titre est complet, la référence non : la référence prend le titre
      cas.push({ id: d.id, source: d.source ?? '', type: d.type, titre, ref, neuf: titre, motif: 'référence = titre complet' })
    } else if (ref && ref !== titre && ref.length > titre.length && TETE_ACTE.test(ref) && !A_UNE_DATE.test(titre) && TETE_ACTE.test(titre)) {
      // la référence est PLUS riche que le titre : le titre prend la référence
      cas.push({ id: d.id, source: d.source ?? '', type: d.type, titre, ref, neuf: ref, motif: 'titre = référence, plus complète' })
    } else if (TETE_ACTE.test(titre) && !A_UNE_DATE.test(titre) && ref && DATE_DEDANS.test(ref)) {
      // la référence porte la date AILLEURS qu'en tête (« Loi N° 002-2018 du 23 avril 2018 »,
      // « Décret du 25 novembre 2020 (affichage des prix) ») : on la porte au titre.
      const dt = DATE_DEDANS.exec(ref)![1]
      cas.push({ id: d.id, source: d.source ?? '', type: d.type, titre, ref, neuf: titre.replace(TETE_ACTE, (t) => `${t} du ${dt}`), motif: 'date de la référence portée au titre, puis référence = titre' })
    } else if (TETE_ACTE.test(titre) && !A_UNE_DATE.test(titre) && !(ref && DATE_DEDANS.test(ref)) && d.adoptionDate) {
      // ⚠️ DERNIER RECOURS : ni le titre ni la référence ne porte de date, mais la fiche connaît
      // sa date d'adoption. On l'écrit en toutes lettres — c'est la seule source qui reste.
      const a = d.adoptionDate
      const dt = `${a.getUTCDate() === 1 ? '1er' : a.getUTCDate()} ${MOIS[a.getUTCMonth()]} ${a.getUTCFullYear()}`
      cas.push({ id: d.id, source: d.source ?? '', type: d.type, titre, ref, neuf: titre.replace(TETE_ACTE, (t) => `${t} du ${dt}`), motif: 'date tirée de adoptionDate, faute de la trouver au titre ou à la référence' })
    }
  }

  if (!cas.length) { console.log('Aucun acte non conforme — rien à faire.'); await prisma.$disconnect(); return }

  // ⚠️ GARDE : un nom complet doit porter une DATE. Sans elle, on n'écrit pas.
  const sansDate = cas.filter((c) => !A_UNE_DATE.test(c.neuf))
  if (sansDate.length)
    throw new Error(`${sansDate.length} nom(s) proposé(s) sans date — refus : ${sansDate.slice(0, 3).map((c) => `${c.source} « ${c.neuf.slice(0, 50)} »`).join(' · ')}. STOP`)
  // ⚠️ GARDE : le nom neuf doit CONTENIR l'objet du titre d'origine, jamais l'amputer.
  const ampute = cas.filter((c) => c.motif.startsWith('date de la référence') && !c.neuf.includes(c.titre.replace(TETE_ACTE, '').trim()))
  if (ampute.length) throw new Error(`${ampute.length} nom(s) proposé(s) perdent l'objet du titre. STOP`)
  // ⚠️ GARDE : aucun code ne doit se retrouver dans la liste.
  const codes = cas.filter((c) => /^Code\b|^Constitution\b/.test(c.titre))
  if (codes.length) throw new Error(`${codes.length} nom(s) propre(s) dans la liste : ${codes.map((c) => c.source).join(', ')}. STOP`)

  const parMotif = new Map<string, Cas[]>()
  for (const c of cas) parMotif.set(c.motif, [...(parMotif.get(c.motif) ?? []), c])
  console.log(`${docs.length} actes examinés · ${cas.length} à corriger · ${exclus.length} noms propres écartés\n`)
  for (const [motif, l] of parMotif) {
    console.log(`── ${l.length} — ${motif} ──`)
    for (const c of l.slice(0, motif.startsWith('date') ? 99 : 4)) {
      console.log(`  [${c.source}]`)
      console.log(`     titre « ${c.titre.slice(0, 96)} »`)
      console.log(`     réf.  « ${c.ref?.slice(0, 96)} »`)
      console.log(`     ⇒     « ${c.neuf.slice(0, 116)} »`)
    }
    if (l.length > 4 && !motif.startsWith('date')) console.log(`  … et ${l.length - 4} autres`)
    console.log()
  }
  if (exclus.length) { console.log('── noms propres écartés ──'); for (const x of exclus) console.log('  ' + x) }

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  // ⚠️ On écrit sur `c.id` — jamais sur une table indexée par `source`, qui n'est pas unique.
  if (new Set(cas.map((c) => c.id)).size !== cas.length) throw new Error('deux cas partagent le même identifiant. STOP')
  await prisma.$transaction(
    async (tx) => {
      for (const c of cas) await tx.document.update({ where: { id: c.id }, data: { titleFr: c.neuf, number: c.neuf } })
      await audit({
        action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: 'NOMS_COMPLETS_ACTES',
        meta: {
          motif:
            'Nom complet des actes — nature + DATE + objet — dans le titre comme dans la référence. ' +
            'Règle renforcée par Me Vaval le 29 août 2026 : « ne pas s’en tenir uniquement aux dates ». ' +
            'Le défaut était SYMÉTRIQUE : tantôt le titre portait l’objet sans la date, tantôt la ' +
            'référence portait la date sans l’objet, et chacun pris seul semblait correct. ' +
            'Les CODES et la Constitution sont écartés : ce sont des noms propres. Ni les corps, ni les ' +
            'annotations, ni les renvois, ni l’Index du Moniteur ne sont touchés.',
          corriges: cas.length, nomsPropresEcartes: exclus.length,
          parMotif: Object.fromEntries([...parMotif].map(([k, v]) => [k, v.length])),
        },
      }, tx)
    },
    { timeout: 120_000, maxWait: 30_000 },
  )

  const journal = await prisma.auditLog.count({ where: { targetId: 'NOMS_COMPLETS_ACTES' } })
  for (const c of cas) await reindexDocument(c.id)
  const apres = await prisma.document.findMany({ where: { type: { in: ['LEGISLATION', 'DOCTRINE', 'CIRCULAIRE_BRH'] } }, select: { source: true, titleFr: true, number: true } })
  const reste = apres.filter((x) => x.number && DATE_SEULE.test(x.number.trim()) && !CODES.has(x.source ?? ''))
  const desaccord = apres.filter((x) => x.number && x.number !== x.titleFr && !CODES.has(x.source ?? ''))
  console.log(`\n✓ ${cas.length} actes corrigés · AuditLog ${journal} (recompté) · ${cas.length} réindexés`)
  console.log(`  références encore réduites à la date : ${reste.length} ${reste.length ? '⚠️ ' + reste.map((x) => x.source).join(', ') : '✓'}`)
  console.log(`  référence ≠ titre (hors noms propres) : ${desaccord.length}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
