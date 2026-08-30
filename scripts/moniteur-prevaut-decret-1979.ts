/**
 * DÉCRET DU 10 OCTOBRE 1979 — le Journal officiel prévaut sur l'édition Vandal.
 *
 *     npx tsx scripts/moniteur-prevaut-decret-1979.ts            # simulation
 *     npx tsx scripts/moniteur-prevaut-decret-1979.ts --apply    # Me Vaval, elle seule
 *
 * Me Vaval, 29 août 2026, sur les six divergences relevées entre l'édition Vandal (au corpus) et
 * la transcription du Moniteur n° 82 du 18 octobre 1979 : « **le contenu du Moniteur prévaut.
 * corriger.** »
 *
 * ⚠️ QUATRE ÉCARTS SONT TYPOGRAPHIQUES, DEUX SONT DE FOND — et ce sont les deux de fond qui
 * commandent la décision :
 *   · art. 1er — « Dès la **publication** du présent décret » (Vandal) devient « Dès la
 *     **PROMULGATION** » (Moniteur). Deux déclencheurs juridiques différents : la promulgation
 *     précède la publication.
 *   · art. 6 — « pour exister **ET** fonctionner » devient « pour exister **OU** fonctionner ».
 *     Condition cumulative ou alternative : l'arrêté présidentiel devient exigible pour l'un ou
 *     l'autre, non pour les deux réunis.
 * Les quatre autres : « créées »/« crées », espaces dans les guillemets (art. 3 et 4),
 * « spécifications »/« spécification ».
 *
 * ⚠️ L'ARTICLE 7 NE BOUGE PAS : il vient DÉJÀ du Moniteur (ajouté le 29 août, il manquait au
 * corpus). Seuls les articles 1 à 6 sont repris.
 *
 * ⚠️ LES CINQ `ArticleVersion` DOIVENT SUIVRE. Elles conservent le texte des articles au moment
 * où ils ont été abrogés — texte qui était celui de Vandal. Le laisser tel quel ferait cohabiter
 * deux rédactions du même article : la Moniteur au corps, la Vandal au repli. Elles sont donc
 * réécrites sur le Moniteur, comme le corps.
 */
import { prisma } from '../src/lib/db'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'

const APPLY = process.argv.includes('--apply')
const SC = '/private/tmp/claude-501/-Users-cvaval-Library-CloudStorage-Dropbox-Lam-Veritab/b86c8ab9-626b-4ed6-9e9c-f6e8779c5980/scratchpad/soc'
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'").replace(/[—–]/g, '-').replace(/\s+/g, ' ').trim()

async function main() {
  const d = await prisma.document.findFirst({ where: { source: 'CC_VANDAL_IV-A-5' }, select: { id: true, bodyOriginal: true, annotationsJson: true } })
  if (!d) throw new Error('CC_VANDAL_IV-A-5 introuvable. STOP')
  const base = (d.bodyOriginal ?? '').split('\n')
  const piece = readFileSync(`${SC}/1979.txt`, 'utf8').split('\n')
  const empreinte = createHash('md5').update(d.bodyOriginal ?? '').digest('hex')
  const ann = JSON.parse(String(d.annotationsJson ?? '{}'))

  const anc = (l: string[]) => [...new Set(l.map((x) => articleAnchorFromHeading(x.trim())).filter(Boolean) as string[])]
  const ancBase = anc(base), ancPiece = anc(piece)
  const attendu = ['art-1', 'art-2', 'art-3', 'art-4', 'art-5', 'art-6', 'art-7']
  if (ancBase.join(',') !== attendu.join(',')) throw new Error(`base : ancres ${ancBase.join(',')} — ${attendu.join(',')} attendues. STOP`)
  if (attendu.some((a) => !ancPiece.includes(a))) throw new Error(`la pièce ne porte pas les 7 articles (${ancPiece.join(',')}). STOP`)

  /** Bloc d'un article — découpé par la fonction de la plateforme, jamais par une expression maison. */
  const bloc = (l: string[], cible: string) => {
    const i = l.findIndex((x) => articleAnchorFromHeading(x.trim()) === cible)
    if (i < 0) return null
    const j = l.findIndex((x, k) => k > i && Boolean(articleAnchorFromHeading(x.trim())))
    return { i, j: j < 0 ? l.length : j, lignes: l.slice(i, j < 0 ? undefined : j) }
  }

  // ── Reconstruire le corps : art. 1 à 6 du Moniteur, le reste inchangé ──
  const REPRIS = ['art-1', 'art-2', 'art-3', 'art-4', 'art-5', 'art-6']
  const remp = REPRIS.map((a) => {
    const b = bloc(base, a), p = bloc(piece, a)
    if (!b || !p) throw new Error(`${a} introuvable dans la base ou la pièce. STOP`)
    return { a, ...b, neuf: p.lignes }
  }).sort((x, y) => x.i - y.i)
  for (let k = 1; k < remp.length; k++) if (remp[k].i < remp[k - 1].j) throw new Error('deux remplacements se chevauchent. STOP')

  const neuf: string[] = []
  let curseur = 0
  for (const r of remp) { neuf.push(...base.slice(curseur, r.i), ...r.neuf); curseur = r.j }
  neuf.push(...base.slice(curseur))

  if (anc(neuf).join(',') !== attendu.join(',')) throw new Error(`après reprise : ancres ${anc(neuf).join(',')}. STOP`)
  // ⚠️ L'article 7 doit être RIGOUREUSEMENT inchangé : il vient déjà du Moniteur.
  const a7av = bloc(base, 'art-7')!.lignes.join('\n'), a7ap = bloc(neuf, 'art-7')!.lignes.join('\n')
  if (a7av !== a7ap) throw new Error('l’article 7 a bougé — il ne devait pas. STOP')
  // ⚠️ Les deux écarts DE FOND doivent être effectivement portés, sinon la reprise n'a rien fait.
  const t = (l: string[], a: string) => norm(bloc(l, a)!.lignes.join(' '))
  if (!t(neuf, 'art-1').includes('des la promulgation')) throw new Error('art. 1er : « promulgation » n’est pas au texte neuf. STOP')
  if (!t(neuf, 'art-6').includes('pour exister ou fonctionner')) throw new Error('art. 6 : « exister ou fonctionner » n’est pas au texte neuf. STOP')
  if (t(base, 'art-1').includes('des la promulgation')) throw new Error('art. 1er portait déjà « promulgation » — déjà corrigé ? STOP')

  const versions = await prisma.articleVersion.findMany({ where: { documentId: d.id }, select: { id: true, anchor: true, body: true } })
  if (versions.length !== 5) throw new Error(`${versions.length} ArticleVersion, 5 attendues. STOP`)
  const majV = versions.map((v) => {
    const p = bloc(piece, v.anchor)
    if (!p) throw new Error(`${v.anchor} : pas de texte au Moniteur pour la version d’article. STOP`)
    return { id: v.id, anchor: v.anchor, avant: v.body, apres: p.lignes.join('\n') }
  })

  console.log(`corps : ${base.length} → ${neuf.length} lignes · ancres inchangées (${attendu.length})`)
  console.log(`  article 7 : INTACT ✓ (il venait déjà du Moniteur)`)
  console.log(`\n  les deux écarts DE FOND, désormais portés :`)
  console.log(`   art. 1er  « Dès la publication »   → « Dès la PROMULGATION »`)
  console.log(`   art. 6    « exister ET fonctionner » → « exister OU fonctionner »`)
  console.log(`\n  ${majV.length} ArticleVersion réécrites sur le Moniteur :`)
  for (const v of majV) console.log(`   ${v.anchor} : ${v.avant.length} → ${v.apres.length} car. ${v.avant === v.apres ? '(identique)' : ''}`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  const cr = Array.isArray(ann.crossRefs) ? ann.crossRefs : []
  const i7 = cr.findIndex((x: { anchor: string }) => x.anchor === 'art-7')
  if (i7 < 0) throw new Error('la note de l’article 7 est introuvable. STOP')
  const noteNeuve =
    'Article 7 ajouté le 29 août 2026 d’après la transcription du Moniteur n° 82 du 18 octobre 1979 : ' +
    'il manquait au corpus, qui s’arrêtait à l’article 6. ' +
    '⚠️ ÉCARTS TRANCHÉS le 29 août 2026 — décision de Me Vaval : « le contenu du Moniteur prévaut ». ' +
    'La rédaction des articles 1 à 6 différait entre l’édition Vandal, jusqu’ici au corpus, et la ' +
    'transcription du Journal officiel. Les six articles portent désormais le texte du Moniteur. ' +
    'Deux écarts n’étaient pas typographiques : l’article 1er disait « Dès la PUBLICATION du présent ' +
    'décret » là où le Moniteur dit « Dès la PROMULGATION » — la promulgation précède la publication ; ' +
    'et l’article 6 disait « pour exister ET fonctionner » là où le Moniteur dit « OU », faisant de ' +
    'l’autorisation présidentielle une exigence alternative et non cumulative. Les quatre autres ' +
    'écarts (« créées »/« crées », espaces dans les guillemets aux articles 3 et 4, ' +
    '« spécifications »/« spécification ») étaient de pure forme.'

  await prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: d.id },
      data: {
        bodyOriginal: neuf.join('\n'),
        annotationsJson: JSON.stringify({ ...ann, crossRefs: cr.map((x: unknown, k: number) => (k === i7 ? { ...(x as object), note: noteNeuve } : x)) }),
      },
    })
    for (const v of majV) await tx.articleVersion.update({ where: { id: v.id }, data: { body: v.apres } })
    await audit({
      action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: 'DECRET_1979_MONITEUR_PREVAUT',
      meta: {
        motif:
          'Décret du 10 octobre 1979 : les articles 1 à 6 portent désormais la rédaction du Journal ' +
          'officiel (Moniteur n° 82 du 18 octobre 1979) et non celle de l’édition Vandal — décision de ' +
          'Me Vaval du 29 août 2026 : « le contenu du Moniteur prévaut ». Deux écarts de fond portés : ' +
          '« publication » → « PROMULGATION » à l’article 1er, « exister ET fonctionner » → « OU » à ' +
          'l’article 6. Quatre autres écarts de pure forme. L’article 7 est INTACT : il venait déjà du ' +
          'Moniteur. Les cinq ArticleVersion sont réécrites sur le Moniteur — les laisser aurait fait ' +
          'cohabiter deux rédactions du même article, l’une au corps et l’autre au repli.',
        articlesRepris: REPRIS.length, ecartsDeFond: 2, versionsReecrites: majV.length,
      },
    }, tx)
  }, { timeout: 120_000, maxWait: 30_000 })

  const journal = await prisma.auditLog.count({ where: { targetId: 'DECRET_1979_MONITEUR_PREVAUT' } })
  await reindexDocument(d.id)
  const ap = await prisma.document.findUnique({ where: { id: d.id }, select: { bodyOriginal: true, annotationsJson: true } })
  const l = (ap?.bodyOriginal ?? '').split('\n')
  const a2 = JSON.parse(String(ap?.annotationsJson ?? '{}'))
  console.log(`\n✓ AuditLog ${journal} (recompté)`)
  console.log(`  corps : ${l.length} lignes (avant ${base.length}, empreinte ${empreinte.slice(0, 8)}) · ancres ${anc(l).length}`)
  console.log(`  art. 1er porte « promulgation » : ${norm(bloc(l, 'art-1')!.lignes.join(' ')).includes('des la promulgation')}`)
  console.log(`  art. 6 porte « exister ou fonctionner » : ${norm(bloc(l, 'art-6')!.lignes.join(' ')).includes('pour exister ou fonctionner')}`)
  console.log(`  pastilles inchangées : ${Object.entries(a2.status ?? {}).map(([k, v]) => `${k}=${v}`).join(' · ')}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
