/**
 * A · LE THÈME « MARCHÉS PUBLICS », sous « Droit public & administratif ».
 * (Feuille de route « Lam — Prompt marchés publics (corpus) », 27 août 2026, § 8.1.)
 *
 *     npx tsx scripts/creer-theme-marches-publics.ts             # simulation — n'écrit rien
 *     npx tsx scripts/creer-theme-marches-publics.ts --apply     # écriture — Me Vaval, elle seule
 *
 * PREMIER des trois scripts : A (thème) → B (les 25 textes) → C (le graphe).
 *
 * ─── CE QU'IL FAIT ──────────────────────────────────────────────────────────────────────
 *  1. PREMIÈRE ASSERTION — l'empreinte des pièces sources. Le thème n'a de sens que s'il
 *     reçoit ce corpus-là : le manifeste `scripts/data/marches-publics/manifeste-empreintes.json`
 *     est confronté aux `.docx` d'origine et aux pièces du dépôt AVANT tout le reste. Si le
 *     lot n'est pas celui qui a été arbitré, on ne crée rien — pas même un thème vide.
 *  2. Mesure l'arbre : parent résolu par slug, frères, position CALCULÉE (max + 1).
 *  3. Crée le thème par la lib canonique `createTheme` (src/lib/legislation/themes.ts:305),
 *     qui recalcule la position et REFUSE un slug existant (`ThemeError('slugExists')`).
 *  4. Relit : existence, parent, position, unicité du libellé chez les frères.
 *
 * ─── VERROU (§ 13.8) ────────────────────────────────────────────────────────────────────
 * Les libellés En/Ht sont une QUESTION OUVERTE et **le slug est IMMUABLE une fois créé**.
 * `--apply` REFUSE tant que LIBELLES_VALIDES vaut false. Me Vaval tranche « Public
 * procurement » / « Mache piblik » — validé le 28 août 2026, le drapeau est à true.
 * Les six frères ont tous leurs trois libellés : le nouveau ne peut pas rester incomplet.
 *
 * ─── PIÈGES MESURÉS (§ 8.1) ─────────────────────────────────────────────────────────────
 *  1. `DocumentTheme_one_primary` est un index UNIQUE PARTIEL (prisma/sql/legislation-themes-indexes.sql,
 *     l. 7-8) : UN SEUL `isPrimary` par document. C'est l'étape B qui le respecte.
 *  2. « du spécifique au général » vise l'ordre des thèmes SUR un document, pas la position
 *     dans l'arbre.
 *  3. Un thème VIDE est ÉLAGUÉ de la navigation (`elaguer`, themes.ts l. 203) : il restera
 *     INVISIBLE jusqu'au premier rattachement de l'étape B. Ce n'est pas un défaut — mais
 *     c'est la raison pour laquelle A ne se lance pas sans que B suive.
 *  4. AUCUNE modification de `DOC_TYPE_META` (interdit n° 19) : les textes sont de type
 *     LEGISLATION → rubrique « Législation annotée » (src/lib/brand.ts l. 60-67). Une
 *     rubrique n'est pas un type.
 *
 * Idempotent (§ 9.7) : relancé, il constate le thème existant, le contrôle et n'écrit rien.
 */
import { prisma } from '../src/lib/db'
import { createTheme } from '../src/lib/legislation/themes'
import { audit } from '../src/lib/auth/audit'
import { assertionEmpreintes, rapportEmpreintes } from './data/marches-publics/fiches-marches-publics'

const APPLY = process.argv.includes('--apply')

const PARENT_SLUG = 'droit-public'
const SLUG = 'marches-publics' // ⚠️ IMMUABLE une fois créé
const LABEL_FR = 'Marchés publics'

/**
 * § 13.8 — **TRANCHÉ par Me Vaval le 28 août 2026** : « oui pour Public Procurement et c'est
 * Mache piblik SANS L'ACCENT ». Le créole proposé portait « Machè » ; sa correction fait foi.
 * ⚠️ C'est la même règle que le 21 août sur « refere » : **le créole de la plateforme s'écrit
 * sans accent grave** — mon test d'homoglyphes avait alors interdit l'orthographe correcte.
 * Le slug reste `marches-publics`, immuable.
 */
const LABEL_EN_PROPOSE = 'Public procurement'
const LABEL_HT_PROPOSE = 'Mache piblik'
const LIBELLES_VALIDES = true // ← validé par Me Vaval, 28 août 2026

async function main() {
  const p = (s = '') => console.log(s)

  p('══════════════════════════════════════════════════════════════════════════════════')
  p('  A · THÈME « Marchés publics » sous « Droit public & administratif » (§ 8.1)')
  p(`  drapeaux : --apply=${APPLY}`)
  p('══════════════════════════════════════════════════════════════════════════════════')
  p()

  // ── 1. PREMIÈRE ASSERTION : les empreintes ────────────────────────────────────────────
  const e = assertionEmpreintes(APPLY)
  rapportEmpreintes(e, p)
  if (e.docxAbsents.length) p('  ⚠️ la simulation continue ; --apply refusera tant qu’une pièce d’origine manque')
  p()

  // ── 2. L'arbre ────────────────────────────────────────────────────────────────────────
  const parent = await prisma.theme.findFirst({ where: { slug: PARENT_SLUG } })
  if (!parent) throw new Error(`thème parent « ${PARENT_SLUG} » introuvable — STOP`)
  const freres = await prisma.theme.findMany({
    where: { parentId: parent.id },
    orderBy: { position: 'asc' },
    select: { slug: true, labelFr: true, labelEn: true, labelHt: true, position: true },
  })
  const max = await prisma.theme.aggregate({ where: { parentId: parent.id }, _max: { position: true } })
  const positionCalculee = (max._max.position ?? -1) + 1
  const total = await prisma.theme.count()
  const homonymes = await prisma.theme.findMany({ where: { slug: { contains: 'march' } }, select: { slug: true, labelFr: true } })

  p('L’ARBRE, MESURÉ EN LECTURE SEULE')
  p(`  parent : « ${parent.labelFr} » (${parent.slug}, id ${parent.id}, position ${parent.position})`)
  p(`  frères : ${freres.length}`)
  for (const f of freres)
    p(`    pos ${f.position}  ${f.slug.padEnd(30)} ${f.labelFr}${f.labelEn && f.labelHt ? '' : '   ⚠️ libellés incomplets'}`)
  p(`  position CALCULÉE pour « ${LABEL_FR} » : ${positionCalculee} (max des frères + 1)`)
  p(`  thèmes en base : ${total} · slugs contenant « march » : ${homonymes.map((h) => h.slug).join(', ') || '∅'}`)
  const freresIncomplets = freres.filter((f) => !f.labelEn || !f.labelHt).length
  p(`  frères aux trois libellés remplis : ${freres.length - freresIncomplets}/${freres.length}`)
  p()

  // ── 3. Idempotence ────────────────────────────────────────────────────────────────────
  const existant = await prisma.theme.findUnique({ where: { slug: SLUG } })
  if (existant) {
    p('THÈME DÉJÀ EXISTANT — rien à écrire (§ 9.7)')
    p(`  « ${existant.labelFr} » (${existant.slug}) · id ${existant.id} · parentId ${existant.parentId} · position ${existant.position}`)
    p(`  labelEn ${existant.labelEn ?? 'NULL'} · labelHt ${existant.labelHt ?? 'NULL'}`)
    if (existant.parentId !== parent.id) throw new Error(`le thème existe mais son parent n’est pas ${PARENT_SLUG} — investiguer, STOP`)
    const rattaches = await prisma.documentTheme.count({ where: { themeId: existant.id } })
    p(`  documents rattachés : ${rattaches}${rattaches === 0 ? '  (thème ÉLAGUÉ de la navigation tant que B n’a pas versé)' : ''}`)
    return
  }

  p('CE QUI SERAIT CRÉÉ')
  p(`  slug     : ${SLUG}   ⚠️ IMMUABLE une fois créé`)
  p(`  labelFr  : ${LABEL_FR}`)
  p(`  labelEn  : ${LABEL_EN_PROPOSE}   ${LIBELLES_VALIDES ? '(validé)' : '⚠️ PROPOSÉ, NON VALIDÉ (§ 13.8)'}`)
  p(`  labelHt  : ${LABEL_HT_PROPOSE}   ${LIBELLES_VALIDES ? '(validé)' : '⚠️ PROPOSÉ, NON VALIDÉ (§ 13.8)'}`)
  p(`  parentId : ${parent.id} (${PARENT_SLUG})`)
  p(`  position : ${positionCalculee} — recalculée par createTheme, pas écrite en dur`)
  p('  AuditLog : 1 THEME_CREATED — RECOMPTÉ après la transaction (audit() avale ses erreurs)')
  p()
  p('  Le thème restera INVISIBLE en navigation tant qu’aucun document LEGISLATION/DOCTRINE')
  p('  n’y sera rattaché (élagage, themes.ts l. 203) : enchaîner sur B, et ne pas s’arrêter là.')
  p()

  if (!APPLY) {
    p('SIMULATION — rien n’a été écrit. --apply est réservé à Me Vaval (§ 10.2).')
    return
  }
  if (!LIBELLES_VALIDES)
    throw new Error(
      'libellés En/Ht NON VALIDÉS (§ 13.8) et le slug est IMMUABLE : faire trancher ' +
        `« ${LABEL_EN_PROPOSE} » / « ${LABEL_HT_PROPOSE} » par Me Vaval, passer LIBELLES_VALIDES à true, puis relancer — annulé`,
    )

  const auditAvant = await prisma.auditLog.count({ where: { action: 'THEME_CREATED' } })
  const theme = await createTheme({
    slug: SLUG,
    parentId: parent.id,
    labelFr: LABEL_FR,
    labelEn: LABEL_EN_PROPOSE,
    labelHt: LABEL_HT_PROPOSE,
  })
  await audit({
    action: 'THEME_CREATED',
    targetType: 'Theme',
    targetId: theme.id,
    meta: {
      op: 'creer-theme-marches-publics',
      feuilleDeRoute: 'Lam — Prompt marchés publics (corpus), 27 août 2026, § 8.1',
      slug: SLUG,
      parent: PARENT_SLUG,
      parentId: parent.id,
      position: theme.position,
      labels: { fr: LABEL_FR, en: LABEL_EN_PROPOSE, ht: LABEL_HT_PROPOSE },
      libellesValidesPar: 'Me Vaval (§ 13.8) — drapeau LIBELLES_VALIDES',
      manifesteEmpreintes: e.manifeste.genere_le,
    },
  })

  // ── 4. Relecture ──────────────────────────────────────────────────────────────────────
  const relu = await prisma.theme.findUnique({ where: { slug: SLUG } })
  if (!relu) throw new Error('relecture : thème introuvable après création — STOP')
  if (relu.parentId !== parent.id) throw new Error('relecture : parent incorrect — STOP')
  if (relu.position !== positionCalculee) throw new Error(`relecture : position ${relu.position} ≠ ${positionCalculee} attendue — STOP`)
  if (!relu.labelEn || !relu.labelHt) throw new Error('relecture : libellés En/Ht incomplets — STOP')
  const memeLibelle = await prisma.theme.count({ where: { parentId: parent.id, labelFr: LABEL_FR } })
  if (memeLibelle !== 1) throw new Error(`relecture : ${memeLibelle} frères nommés « ${LABEL_FR} » — STOP`)
  const freresApres = await prisma.theme.count({ where: { parentId: parent.id } })
  if (freresApres !== freres.length + 1) throw new Error(`relecture : ${freresApres} frères pour ${freres.length} + 1 attendus — STOP`)
  // ⚠️ audit() avale ses erreurs : on RECOMPTE (§ 10.4).
  const auditApres = await prisma.auditLog.count({ where: { action: 'THEME_CREATED' } })
  if (auditApres < auditAvant + 1)
    throw new Error(`écriture NON AUDITÉE : AuditLog THEME_CREATED ${auditAvant} → ${auditApres} — défaut à corriger`)

  p(`✓ Thème créé : « ${parent.labelFr} » → « ${relu.labelFr} » (${relu.slug}, id ${relu.id}, position ${relu.position})`)
  p(`  journal d'audit THEME_CREATED ${auditAvant} → ${auditApres} (recompté)`)
  p('  contrôles : thème unique chez ses frères, parent et position conformes, trois libellés remplis')
  p('  ÉTAPE SUIVANTE : npx tsx scripts/importer-marches-publics.ts --apply')
}

main()
  .catch((e) => {
    console.error('\nÉCHEC :', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
