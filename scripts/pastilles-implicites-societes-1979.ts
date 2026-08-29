/**
 * DÉCRET DU 10 OCTOBRE 1979 — les abrogations IMPLICITES du décret du 2 juin 1995.
 *
 *     npx tsx scripts/pastilles-implicites-societes-1979.ts            # simulation
 *     npx tsx scripts/pastilles-implicites-societes-1979.ts --apply    # Me Vaval, elle seule
 *
 * Me Vaval, 29 août 2026 : « prévoir les pastilles car c'est indiqué que 1995 abrogerait certains
 * articles ». C'est sa RÈGLE DU 28 AOÛT, posée sur les seuils des marchés publics : **quand un
 * texte reprend la même matière, il abroge implicitement l'ancien**. Elle est mesurable, et elle
 * a été mesurée ici article par article.
 *
 * ─── LA CORRESPONDANCE, MESURÉE SUR LES DEUX DISPOSITIFS ───────────────────────────────────
 *  · 1979 art. 1er  « les sociétés PAR ACTIONS seront autorisées à fonctionner par le Secrétaire
 *    d'État du Commerce » → 1995 art. 1er al. 2 « les sociétés ANONYMES, quels que soient leur
 *    nationalité et leur objet sont autorisées à fonctionner par le Ministère du Commerce ».
 *    ⇒ même objet, autorité changée — MAIS le champ se rétrécit : toute société par actions qui
 *    n'est pas anonyme (commandite par actions) n'est pas visée par 1995.
 *    ⇒ **partiellement abrogé**, et non « abrogé ».
 *  · 1979 art. 3 « autorisation accordée par avis signé du Secrétaire d'État […] Ledit avis, ainsi
 *    que l'acte constitutif et les statuts seront publiés au Moniteur » → 1995 art. 1er al. 2
 *    « selon Avis signé du Ministre et publié au Journal Officiel ».
 *    ⇒ l'alinéa 1er est repris ; l'alinéa 2 ne l'est PAS — 1995 ne parle que de l'avis, jamais de
 *    la publication de l'acte constitutif et des statuts. ⇒ **partiellement abrogé**.
 *  · 1979 art. 4 « Immédiatement après la publication de l'avis […] le déblocage des fonds pourra
 *    être effectué par la banque » → 1995 art. 3, qui refait la condition ENTIÈREMENT : le
 *    déblocage suppose désormais l'autorisation du Ministère et quatre pièces fiscales.
 *    ⇒ **abrogé**.
 *
 * ─── CE QUI N'EST PAS TOUCHÉ, ET POURQUOI ──────────────────────────────────────────────────
 *  · 1979 art. 2 (pièces de la demande d'autorisation, au Département du Commerce) : l'article 2
 *    de 1995 énumère les pièces de l'IMMATRICULATION FISCALE, à la DGI. **Objets différents** —
 *    l'un n'atteint pas l'autre. Aucune pastille.
 *  · 1979 art. 7 : clause d'abrogation propre au décret de 1979, hors du champ. Aucune pastille.
 *  · 1979 art. 5 et 6 : déjà « abrogé » depuis le 29 août (abrogation NOMINATIVE par l'art. 1er
 *    al. 1 de 1995). Le script REFUSE si elles ont disparu.
 *
 * ⚠️ CES TROIS PASTILLES SONT UNE DÉCISION D'ÉDITEUR, pas une clause. Aucune disposition ne
 * nomme les articles 1er, 3 et 4. L'appui est l'article 4 du décret de 1995 — « abroge toutes
 * dispositions […] qui lui sont contraires » — plus la reprise mesurée de la même matière. Les
 * notes le disent en toutes lettres : on n'écrit pas « abrogé » comme si le texte l'avait dit.
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated } from '../src/lib/legislation/annotated'
import { createHash } from 'node:crypto'

const APPLY = process.argv.includes('--apply')
const PLAN: { anchor: string; status: string; motif: string }[] = [
  { anchor: 'art-1', status: 'partiellement abrogé',
    motif: 'Repris par l’article 1er, alinéa 2, du Décret du 2 juin 1995 : « les sociétés anonymes, quels que soient leur nationalité et leur objet sont autorisées à fonctionner par le Ministère du Commerce et de l’Industrie, selon Avis signé du Ministre et publié au Journal Officiel Le Moniteur. » ⚠️ PARTIELLEMENT : le décret de 1995 ne vise que les sociétés ANONYMES, quand celui de 1979 visait toutes les sociétés PAR ACTIONS.' },
  { anchor: 'art-3', status: 'partiellement abrogé',
    motif: 'Alinéa 1er repris par l’article 1er, alinéa 2, du Décret du 2 juin 1995 (l’avis est désormais signé du Ministre, non du Secrétaire d’État). ⚠️ PARTIELLEMENT : l’alinéa 2 — publication au Moniteur de l’avis ET de l’acte constitutif et des statuts — n’est pas repris ; le décret de 1995 ne parle que de l’avis.' },
  { anchor: 'art-4', status: 'abrogé',
    motif: 'Entièrement refait par l’article 3 du Décret du 2 juin 1995 : le déblocage du compte, qui suivait en 1979 la seule publication de l’avis, suppose désormais l’autorisation du Ministère et quatre pièces (carte d’immatriculation fiscale, récépissés de la DGI, déclaration de fonctionnement, quitus fiscal des fondateurs).' },
]

async function main() {
  const d = await prisma.document.findFirst({ where: { source: 'CC_VANDAL_IV-A-5' }, select: { id: true, bodyOriginal: true, annotationsJson: true } })
  const d95 = await prisma.document.findFirst({ where: { source: 'DECRET_SOCIETES_ANONYMES_1995' }, select: { id: true } })
  if (!d || !d95) throw new Error('décret de 1979 ou de 1995 introuvable. STOP')
  const ann = JSON.parse(String(d.annotationsJson ?? '{}'))
  const status: Record<string, string> = ann.status ?? {}
  const empreinte = createHash('md5').update(d.bodyOriginal ?? '').digest('hex')

  if (status['art-5'] !== 'abrogé' || status['art-6'] !== 'abrogé')
    throw new Error('les pastilles nominatives des art. 5 et 6 ont disparu — relire avant d’ajouter. STOP')
  const déjà = PLAN.filter((p) => status[p.anchor])
  if (déjà.length) throw new Error(`${déjà.length} pastille(s) déjà posée(s) : ${déjà.map((p) => `${p.anchor}=${status[p.anchor]}`).join(', ')}. STOP`)

  const blocs: { anchor?: string | null }[] = segmentAnnotated(d.bodyOriginal ?? '', ann.toc ?? [])
  const ancres = new Set(blocs.map((b) => b.anchor).filter(Boolean) as string[])
  for (const p of PLAN) if (!ancres.has(p.anchor)) throw new Error(`${p.anchor} absent du corps. STOP`)
  // Les valeurs doivent être celles que le lecteur affiche, et aucune autre.
  const ADMISES = new Set(['modifié', 'nouveau', 'abrogé', 'partiellement abrogé'])
  for (const p of PLAN) if (!ADMISES.has(p.status)) throw new Error(`statut « ${p.status} » inconnu du lecteur. STOP`)
  // Ce qu'on NE touche PAS doit rester intouché.
  for (const a of ['art-2', 'art-7']) if (PLAN.some((p) => p.anchor === a)) throw new Error(`${a} ne doit pas recevoir de pastille. STOP`)

  const texteDe = (n: string) => {
    const l = (d.bodyOriginal ?? '').split('\n')
    const deb = l.findIndex((x) => new RegExp(`^\\s*Article\\s+${n}(er)?\\s*[.．]?\\s*[—-]`).test(x))
    const fin = l.findIndex((x, k) => k > deb && /^\s*Article\s+\d+(er)?\s*[.．]?\s*[—-]/.test(x))
    return deb < 0 ? '' : l.slice(deb, fin < 0 ? undefined : fin).join('\n')
  }

  console.log('pastilles à poser sur le décret du 10 octobre 1979 :')
  for (const p of PLAN) {
    const t = texteDe(p.anchor.replace('art-', ''))
    if (!t.trim()) throw new Error(`${p.anchor} : texte introuvable. STOP`)
    console.log(`\n  ${p.anchor} → « ${p.status} »  (${t.split('\n').length} al., ${t.length} car.)`)
    console.log(`     ${p.motif.slice(0, 150)}…`)
  }
  console.log(`\n  intouchés : art-2 (objet différent : immatriculation fiscale) · art-7 (clause propre à 1979)`)
  console.log(`  déjà abrogés nommément : art-5, art-6`)
  console.log(`  corps : INTACT (${empreinte.slice(0, 10)}) — une pastille ne touche jamais au texte`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  await prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: d.id },
      data: { annotationsJson: JSON.stringify({ ...ann, status: { ...status, ...Object.fromEntries(PLAN.map((p) => [p.anchor, p.status])) } }) },
    })
    for (const p of PLAN)
      await tx.articleVersion.create({
        data: {
          documentId: d.id, anchor: p.anchor, label: `Article ${p.anchor.replace('art-', '')}`,
          body: texteDe(p.anchor.replace('art-', '')),
          status: p.status === 'abrogé' ? 'ABROGE' : 'MODIFIE',
          effectiveDate: new Date('1995-06-02T00:00:00Z'),
          amendedByDocId: d95.id, amendedByNumber: 'Décret du 2 juin 1995',
          note: `${p.motif} ⚠️ Abrogation IMPLICITE : aucune disposition ne nomme cet article. Décision d’édition de Me Vaval du 29 août 2026, appuyée sur l’article 4 du Décret de 1995 (« abroge toutes […] dispositions […] qui lui sont contraires ») et sur la reprise mesurée de la même matière.`,
          origin: 'MANUAL',
        },
      })
    await tx.crossRef.create({
      data: {
        fromId: d95.id, toId: d.id, toType: 'LEGISLATION', kind: 'ABROGE', position: 3, source: 'EDITORIAL',
        toLabel: 'Décret du 10 octobre 1979 sur les sociétés anonymes — articles 1er, 3 et 4 (abrogation implicite)',
        note:
          'Abrogation IMPLICITE, non nominative — décision d’édition de Me Vaval du 29 août 2026 : un texte ' +
          'qui reprend la même matière abroge l’ancien. Mesuré sur les deux dispositifs : art. 1er de 1979 ' +
          '(qui autorise) repris par l’art. 1er al. 2 de 1995, mais pour les seules sociétés ANONYMES quand ' +
          '1979 visait toutes les sociétés PAR ACTIONS ⇒ partiellement abrogé ; art. 3 al. 1 (forme de l’avis) ' +
          'repris, al. 2 (publication de l’acte constitutif et des statuts) NON repris ⇒ partiellement abrogé ; ' +
          'art. 4 (déblocage des fonds) entièrement refait par l’art. 3 de 1995 ⇒ abrogé. ' +
          '⚠️ L’art. 2 de 1979 n’est PAS atteint : l’art. 2 de 1995 porte sur l’immatriculation fiscale à la ' +
          'DGI, objet différent de la demande d’autorisation de fonctionner. Appui au dispositif : art. 4 du ' +
          'Décret de 1995, clause générale.',
      },
    })
    await audit({
      action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: 'SOCIETES_1979_IMPLICITE',
      meta: {
        motif:
          'Abrogations IMPLICITES du décret du 10 octobre 1979 par celui du 2 juin 1995, sur la règle de ' +
          'Me Vaval du 28 août 2026 (même matière reprise ⇒ abrogation implicite), mesurée article par ' +
          'article : art. 1er et 3 « partiellement abrogé », art. 4 « abrogé ». L’art. 2 n’est pas atteint ' +
          '(objet différent : immatriculation fiscale) ; l’art. 7 non plus. Les art. 5 et 6 restaient ' +
          'abrogés nominativement. Aucune ligne du corps n’est touchée.',
        partiellementAbroges: 2, abroges: 1, intouches: ['art-2', 'art-7'],
      },
    }, tx)
  }, { timeout: 120_000, maxWait: 30_000 })

  const journal = await prisma.auditLog.count({ where: { targetId: 'SOCIETES_1979_IMPLICITE' } })
  await reindexDocument(d.id)
  const ap = await prisma.document.findUnique({ where: { id: d.id }, select: { bodyOriginal: true, annotationsJson: true } })
  const a = JSON.parse(String(ap?.annotationsJson ?? '{}'))
  const av = await prisma.articleVersion.count({ where: { documentId: d.id } })
  console.log(`\n✓ AuditLog ${journal} (recompté) · ArticleVersion ${av}`)
  console.log(`  corps : ${createHash('md5').update(ap?.bodyOriginal ?? '').digest('hex') === empreinte ? 'INTACT ✓' : '⚠️ MODIFIÉ'}`)
  console.log(`  pastilles : ${Object.entries(a.status ?? {}).map(([k, v]) => `${k}=${v}`).join(' · ')}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
