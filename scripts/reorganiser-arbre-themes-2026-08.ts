/**
 * ARBRE DES THÈMES — les trois décisions de Me Vaval du 28 août 2026.
 *
 *     npx tsx scripts/reorganiser-arbre-themes-2026-08.ts            # simulation
 *     npx tsx scripts/reorganiser-arbre-themes-2026-08.ts --apply    # Me Vaval, elle seule
 *
 *   1. « la procédure civile doit aller sous droit civil. Retirer procédure civile dans la
 *      section de droit public et administratif. »
 *   2. « créer un onglet Notariat » — puis « Non, créer comme un titre 1, comme le Droit privé »
 *      ⇒ RACINE, pas sous Justice.
 *   3. « éliminer Justice car il n'aura pas de contenu. »
 *
 * ⚠️ L'ORDRE EST CONTRAIGNANT : Justice n'est supprimable qu'une fois vidée, et elle ne se vide
 * qu'après les deux premières opérations.
 *
 * ─── LE DÉFAUT QUE L'AUDIT A TROUVÉ, ET QUE LE PROMPT NE VOYAIT PAS ────────────────────────
 * `DocumentTheme.theme` est en `onDelete: Cascade`. Le prompt avait bien vu que **Philogène**
 * (thème `justice` UNIQUE) deviendrait orphelin. Il n'avait PAS vu que **GELIN** — `justice`★ +
 * `procedure-civile` non primaire — perdrait son SEUL rattachement PRIMAIRE : la cascade emporte
 * `justice`, et le document se retrouve avec un thème mais AUCUN primaire. L'index partiel
 * `DocumentTheme_one_primary` ne l'interdit pas (il tolère zéro), donc rien n'aurait protesté.
 * ⇒ On promeut explicitement le rattachement `procedure-civile` de GELIN en primaire.
 *
 * ─── CE QUE L'AUDIT A ÉCARTÉ COMME RISQUE ──────────────────────────────────────────────────
 *  · Aucun composant, aucune traduction, aucun test ne cite le slug `justice` (seul un
 *    COMMENTAIRE de search/page.tsx nomme `procedure-civile`).
 *  · `Theme` n'est référencé que par `DocumentTheme` (Cascade) et par lui-même (Restrict).
 *    `Alert` ne porte aucun thème — et la base n'en compte aucune.
 *  · `Document.matiere` vaut « procedure-civile » sur 118 fiches : texte libre, aucune jointure,
 *    rien à reprendre.
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'

const APPLY = process.argv.includes('--apply')
const NOTARIAT = { slug: 'notariat', labelFr: 'Notariat', labelEn: 'Notarial practice', labelHt: 'Notarya' }
const SOURCES_NOTARIAT = [
  'LOI_NOTARIAT_1862', 'LOI_NOTARIAT_1877', 'LOI_NOTARIAT_1919', 'ARRETE_NOTARIAT_EXAMEN_1919',
  'DECRET_LOI_NOTARIAT_1941', 'DECRET_LOI_NOTARIAT_1969', 'DECRET_NOTARIAT_1974', 'DECRET_NOTARIAT_1986',
]

async function main() {
  const th = await prisma.theme.findMany({ select: { id: true, slug: true, parentId: true, position: true } })
  const par = (s: string) => {
    const t = th.find((x) => x.slug === s)
    if (!t) throw new Error(`thème « ${s} » introuvable. STOP`)
    return t
  }
  const pc = par('procedure-civile'), dc = par('droit-civil'), j = par('justice'), dp = par('droit-prive')

  // ── Gardes d'entrée ────────────────────────────────────────────────────────────────────
  if (pc.parentId !== j.id) {
    if (pc.parentId === dc.id) { console.log('Procédure civile est DÉJÀ sous Droit civil — rien à faire.'); await prisma.$disconnect(); return }
    throw new Error(`Procédure civile a pour parent un thème inattendu (${pc.parentId}). STOP`)
  }
  if (dc.parentId !== dp.id) throw new Error('Droit civil n’est pas sous Droit privé. STOP')
  if (th.some((x) => x.slug === NOTARIAT.slug)) throw new Error('un thème « notariat » existe déjà. STOP')
  if (th.some((x) => x.parentId === pc.id)) throw new Error('Procédure civile a un enfant : le compte annoncé ne vaut plus. STOP')

  const racines = th.filter((x) => !x.parentId).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  if (!racines.every((r, i) => r.position === i))
    throw new Error(`les positions des racines ne forment pas une suite sans trou : ${racines.map((r) => r.position).join(',')}. STOP`)
  const posNotariat = Math.max(...racines.map((r) => r.position ?? 0)) + 1

  const liensPc = await prisma.documentTheme.count({ where: { themeId: pc.id } })
  const primPc = await prisma.documentTheme.count({ where: { themeId: pc.id, isPrimary: true } })
  const liensJ = await prisma.documentTheme.findMany({
    where: { themeId: j.id },
    select: { documentId: true, isPrimary: true, document: { select: { source: true, titleFr: true, themes: { select: { themeId: true, isPrimary: true } } } } },
  })
  if (liensJ.length !== 10) throw new Error(`Justice porte ${liensJ.length} rattachements, 10 attendus. STOP`)

  const notariat = liensJ.filter((l) => SOURCES_NOTARIAT.includes(l.document.source ?? ''))
  if (notariat.length !== 8) throw new Error(`${notariat.length} textes de notariat retrouvés sous Justice, 8 attendus. STOP`)
  for (const l of notariat) {
    if (!l.isPrimary) throw new Error(`${l.document.source} : son rattachement à Justice n’est pas primaire. STOP`)
    if (!l.document.themes.some((t) => t.themeId === dc.id)) throw new Error(`${l.document.source} : pas de rattachement à Droit civil. STOP`)
  }

  const arrets = liensJ.filter((l) => !SOURCES_NOTARIAT.includes(l.document.source ?? ''))
  if (arrets.length !== 2) throw new Error(`${arrets.length} arrêts hors notariat, 2 attendus. STOP`)
  const philo = arrets.find((a) => /Philog/i.test(a.document.titleFr ?? ''))
  const gelin = arrets.find((a) => /GELIN/i.test(a.document.titleFr ?? ''))
  if (!philo || !gelin) throw new Error('Philogène ou GELIN introuvable parmi les deux arrêts. STOP')
  if (philo.document.themes.length !== 1) throw new Error(`Philogène porte ${philo.document.themes.length} thèmes, 1 attendu. STOP`)
  const gelinPc = gelin.document.themes.find((t) => t.themeId === pc.id)
  if (!gelinPc) throw new Error('GELIN ne porte pas Procédure civile. STOP')
  if (gelinPc.isPrimary) throw new Error('GELIN a déjà Procédure civile en primaire — état inattendu. STOP')

  const orphAvant = await prisma.document.count({ where: { type: { in: ['LEGISLATION', 'JURISPRUDENCE'] }, themes: { none: {} } } })

  console.log('── état mesuré ──')
  console.log(`  Procédure civile : ${liensPc} rattachements (${primPc} primaires), 0 enfant`)
  console.log(`  Justice          : ${liensJ.length} rattachements — 8 notariat + 2 arrêts, 1 enfant`)
  console.log(`  racines          : ${racines.length}, positions ${racines.map((r) => r.position).join(',')} → Notariat en ${posNotariat}`)
  console.log(`  documents sans thème (témoin) : ${orphAvant}`)
  console.log('\n── ce qui sera écrit ──')
  console.log(`  1. procedure-civile.parentId : justice → droit-civil, position 0`)
  console.log(`  2. création de « ${NOTARIAT.labelFr} / ${NOTARIAT.labelEn} / ${NOTARIAT.labelHt} » en RACINE (pos ${posNotariat}) + 8 rattachements repris`)
  console.log(`  3. Philogène → procedure-civile (primaire) · GELIN : procedure-civile PROMU primaire`)
  console.log(`     puis suppression du thème justice`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit. --apply est réservé à Me Vaval.'); await prisma.$disconnect(); return }

  await prisma.$transaction(async (tx) => {
    // 1 ─────────────────────────────────────────────────────────────────────────────────
    await tx.theme.update({ where: { id: pc.id }, data: { parentId: dc.id, position: 0 } })

    // 2 ─────────────────────────────────────────────────────────────────────────────────
    const nt = await tx.theme.create({ data: { ...NOTARIAT, parentId: null, position: posNotariat } })
    // `DocumentTheme` a une clé primaire composite (documentId, themeId) : on recrée le lien
    // dans la MÊME transaction plutôt que de muter une composante de la clé. Atomique.
    for (const l of notariat) {
      await tx.documentTheme.delete({ where: { documentId_themeId: { documentId: l.documentId, themeId: j.id } } })
      await tx.documentTheme.create({ data: { documentId: l.documentId, themeId: nt.id, isPrimary: true, assignedBy: 'ADMIN' } })
    }

    // 3 ─────────────────────────────────────────────────────────────────────────────────
    await tx.documentTheme.delete({ where: { documentId_themeId: { documentId: philo.documentId, themeId: j.id } } })
    await tx.documentTheme.create({ data: { documentId: philo.documentId, themeId: pc.id, isPrimary: true, assignedBy: 'ADMIN' } })
    // ⚠️ GELIN — L'ORDRE EST IMPOSÉ PAR L'INDEX, et l'inverse a été essayé et REFUSÉ en base :
    // promouvoir `procedure-civile` pendant que `justice` est encore primaire fait DEUX primaires
    // le temps d'une instruction, et `DocumentTheme_one_primary` est vérifié à CHAQUE instruction,
    // pas en fin de transaction. On retire donc Justice d'abord — GELIN passe alors par un état
    // sans aucun primaire, invisible hors de la transaction — puis on promeut.
    await tx.documentTheme.delete({ where: { documentId_themeId: { documentId: gelin.documentId, themeId: j.id } } })
    await tx.documentTheme.update({ where: { documentId_themeId: { documentId: gelin.documentId, themeId: pc.id } }, data: { isPrimary: true } })

    const reste = await tx.documentTheme.count({ where: { themeId: j.id } })
    const enfants = await tx.theme.count({ where: { parentId: j.id } })
    if (reste !== 0 || enfants !== 0)
      throw new Error(`Justice porte encore ${reste} document(s) et ${enfants} enfant(s) — suppression annulée, transaction défaite. STOP`)
    await tx.theme.delete({ where: { id: j.id } })

    await audit({
      action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: 'ARBRE_THEMES_2026_08',
      meta: {
        motif:
          'Réorganisation de l’arbre des thèmes, décisions de Me Vaval du 28 août 2026 : ' +
          '(1) Procédure civile passe de Justice à Droit civil, ses 151 rattachements suivent le thème ; ' +
          '(2) création du thème Notariat EN RACINE (Notariat / Notarial practice / Notarya) et reprise ' +
          'des 8 textes du notariat, qui gardent leur double rattachement à Droit civil ; ' +
          '(3) suppression du thème Justice, vidé. Philogène (thème Justice unique) est rattaché à ' +
          'Procédure civile ; GELIN voit son rattachement à Procédure civile PROMU primaire — sans quoi ' +
          'la cascade sur DocumentTheme l’aurait laissé sans aucun thème primaire, en silence.',
        rattachementsProcedureCivile: liensPc, textesNotariat: notariat.length, arretsRepris: 2,
      },
    }, tx)
  }, { timeout: 120_000, maxWait: 30_000 })

  const journal = await prisma.auditLog.count({ where: { targetId: 'ARBRE_THEMES_2026_08' } })
  for (const l of [...notariat, philo, gelin]) await reindexDocument(l.documentId)

  // ── Contrôles de sortie ────────────────────────────────────────────────────────────────
  const apres = await prisma.theme.findMany({ select: { id: true, slug: true, parentId: true, position: true, _count: { select: { documents: true, children: true } } } })
  const nt = apres.find((x) => x.slug === 'notariat')!
  const pcA = apres.find((x) => x.slug === 'procedure-civile')!
  const dpub = apres.find((x) => x.slug === 'droit-public')!
  const racA = apres.filter((x) => !x.parentId).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const orphApres = await prisma.document.count({ where: { type: { in: ['LEGISLATION', 'JURISPRUDENCE'] }, themes: { none: {} } } })
  const sansPrim = await prisma.document.count({ where: { themes: { some: {} }, NOT: { themes: { some: { isPrimary: true } } } } })

  console.log(`\n✓ AuditLog ${journal} (recompté) · ${notariat.length + 2} documents réindexés`)
  console.log(`  justice supprimé            : ${!apres.some((x) => x.slug === 'justice')}`)
  console.log(`  procedure-civile sous       : ${apres.find((x) => x.id === pcA.parentId)?.slug} · ${pcA._count.documents} doc`)
  console.log(`  notariat                    : racine=${nt.parentId === null} pos=${nt.position} · ${nt._count.documents} doc`)
  console.log(`  racines                     : ${racA.length} · positions ${racA.map((r) => r.position).join(',')}`)
  console.log(`  droit-public                : ${dpub._count.children} enfants, ${dpub._count.documents} doc`)
  console.log(`  documents sans thème        : ${orphApres} (avant ${orphAvant}) → ${orphApres === orphAvant ? 'INCHANGÉ ✓' : '⚠️ ÉCART'}`)
  console.log(`  documents à thème SANS primaire : ${sansPrim} ${sansPrim === 0 ? '✓' : '⚠️'}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  // ⚠️ Une erreur levée DANS la transaction ressort parfois avec un `message` vide : n'afficher
  // que lui laisserait « ÉCHEC : » tout seul à l'écran. On retombe sur l'objet entier.
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect()
  process.exit(1)
})
