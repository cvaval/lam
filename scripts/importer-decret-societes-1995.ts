/**
 * SOCIÉTÉS ANONYMES — le décret du 2 juin 1995, et ce qui manquait à celui de 1979.
 *
 *     npx tsx scripts/importer-decret-societes-1995.ts            # simulation
 *     npx tsx scripts/importer-decret-societes-1995.ts --apply    # Me Vaval, elle seule
 *
 * Vérification du 29 août 2026, par SONDE DE CONTENU sur les 3 716 textes de législation :
 *   · le décret du 10 octobre 1979 EST au corpus — `CC_VANDAL_IV-A-5` — mais AMPUTÉ de son
 *     article 7 (et de tout son appareil, par parti de l'édition Vandal) ;
 *   · le décret du 2 juin 1995 est INTROUVABLE.
 *
 * ⚠️ UN TITRE NE PROUVE RIEN. Le corpus dit « Décret du 10 octobre 1979 sur les sociétés
 * anonymes », la pièce « … sur les formalités de constitution des sociétés par actions ».
 * MÊME ACTE — établi par le contenu, jamais par le titre. Chercher le doublon par le titre aurait
 * conclu à l'absence et versé un second exemplaire.
 *
 * ⚠️ DEUX DATES POUR LE DÉCRET DE 1995 : « Donné au Palais National […] le 2 juin 1995 »
 * (signature) et publication au Moniteur n° 48 du 22 juin. Un décret porte la date de sa
 * signature (règle du 28 août 2026). Trois semaines les séparent.
 *
 * ⚠️ DEUX PASTILLES « abrogé », ET AUCUNE AUTRE. L'article 1er du décret de 1995 abroge
 * NOMMÉMENT les articles 5 et 6 de celui de 1979 : `ABROGE` est fondé. Son article 4 n'abroge
 * que « les dispositions contraires » — clause GÉNÉRALE, posée en CrossRef, jamais en pastille.
 * Depuis le 27 août 2026, un texte abrogé ne se dit plus « modifié ».
 *
 * ⚠️ LE TEXTE DES ARTICLES 5 ET 6 RESTE AFFICHÉ, avec sa pastille : on n'efface pas du corps un
 * article abrogé — c'est ainsi que le lecteur voit ce qui est tombé.
 *
 * ⚠️ CE QUE L'AUDIT A TROUVÉ ET QUE LE PROMPT N'AVAIT PAS VU : les SIX articles du décret de 1979
 * divergent entre le corpus (édition Vandal) et la pièce (transcription du Moniteur). Quatre
 * écarts sont typographiques (espaces dans les guillemets, « crées » / « créées »,
 * « spécification » / « spécifications »). DEUX NE LE SONT PAS :
 *   · art. 1er — « Dès la PUBLICATION » (corpus) / « Dès la PROMULGATION » (pièce) : deux
 *     déclencheurs juridiques différents ;
 *   · art. 6  — « pour exister ET fonctionner » (corpus) / « pour exister OU fonctionner »
 *     (pièce) : condition cumulative ou alternative.
 * ⇒ Ce script NE TRANCHE PAS et NE TOUCHE PAS aux articles 1 à 6. Il pose une note d'édition qui
 * dit l'écart, et la question va à Me Vaval. Seul l'article 7, ABSENT du corpus, est ajouté.
 */
import { prisma } from '../src/lib/db'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated } from '../src/lib/legislation/annotated'

const APPLY = process.argv.includes('--apply')
const D = join(process.cwd(), 'scripts/data/societes-1995')
const lire = (f: string) => readFileSync(join(D, f), 'utf8').replace(/\n+$/, '')
const SOURCE = 'DECRET_SOCIETES_ANONYMES_1995'
const TITRE =
  'Décret du 2 juin 1995 abrogeant les articles 5 et 6 du Décret du 10 octobre 1979 relatifs aux formalités de constitution des sociétés anonymes'

async function main() {
  const corps95 = lire('corps-1995.txt')
  const art7 = lire('art7-1979.txt')
  const arts95 = corps95.split('\n').flatMap((l) => { const m = l.match(/^Article\s+(\d+)\s*\.-/); return m ? [Number(m[1])] : [] })
  if (arts95.join(',') !== '1,2,3,4') throw new Error(`décret de 1995 : articles ${arts95.join(',')}, « 1,2,3,4 » attendus. STOP`)
  if (!/^Article 7[.．]?—/.test(art7)) throw new Error(`l'article 7 ne commence pas comme attendu : « ${art7.slice(0, 40)} ». STOP`)

  if (await prisma.document.findFirst({ where: { source: SOURCE } })) throw new Error(`${SOURCE} déjà versé. STOP`)
  const d79 = await prisma.document.findFirst({
    where: { source: 'CC_VANDAL_IV-A-5' },
    select: { id: true, bodyOriginal: true, annotationsJson: true, adoptionDate: true, themes: { select: { isPrimary: true, themeId: true, theme: { select: { slug: true } } } } },
  })
  if (!d79) throw new Error('CC_VANDAL_IV-A-5 introuvable. STOP')
  const empreinteAvant = createHash('md5').update(d79.bodyOriginal ?? '').digest('hex')
  const ann79 = JSON.parse(String(d79.annotationsJson ?? '{}'))

  const blocs: { anchor?: string | null }[] = segmentAnnotated(d79.bodyOriginal ?? '', ann79.toc ?? [])
  const ancres = new Set(blocs.map((b) => b.anchor).filter(Boolean) as string[])
  for (const a of ['art-5', 'art-6']) if (!ancres.has(a)) throw new Error(`${a} absent du décret de 1979. STOP`)
  if (ancres.has('art-7')) throw new Error('le décret de 1979 porte DÉJÀ un article 7 — relire avant d’ajouter. STOP')
  const statusAvant: Record<string, string> = ann79.status ?? {}
  if (statusAvant['art-5'] || statusAvant['art-6']) throw new Error('une pastille existe déjà sur art-5 / art-6. STOP')

  const corps79Neuf = `${d79.bodyOriginal ?? ''}\n${art7}`.replace(/\n+$/, '')
  const themes = d79.themes.map((t) => ({ id: t.themeId, slug: t.theme.slug, primaire: t.isPrimary }))
  if (themes.length !== 2) throw new Error(`le décret de 1979 porte ${themes.length} thèmes, 2 attendus. STOP`)

  console.log(`décret de 1995 : ${corps95.split('\n').length} lignes · articles ${arts95.join(', ')}`)
  console.log(`  thèmes repris de 1979 : ${themes.map((t) => t.slug + (t.primaire ? '★' : '')).join(', ')}`)
  console.log(`\ndécret de 1979 : ${(d79.bodyOriginal ?? '').split('\n').length} → ${corps79Neuf.split('\n').length} lignes (article 7 ajouté)`)
  console.log(`  adoptionDate : ${d79.adoptionDate?.toISOString().slice(0, 10) ?? 'NULL'} → 1979-10-10`)
  console.log(`  pastilles « abrogé » : art-5, art-6 — aucune autre`)
  console.log(`\n⚠️ 6 articles divergent entre le corpus et la pièce ; DEUX ne sont pas typographiques`)
  console.log(`   art. 1er « publication » (corpus) / « promulgation » (pièce)`)
  console.log(`   art. 6   « exister ET fonctionner » / « exister OU fonctionner »`)
  console.log(`   → non tranché, non touché : une note d’édition le dit, la question va à Me Vaval`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  let id95 = ''
  await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        type: 'LEGISLATION', status: 'EN_VIGUEUR', titleFr: TITRE, number: TITRE,
        bodyOriginal: corps95, originalLang: 'fr', source: SOURCE, category: 'LEGISLATION',
        moniteurRef: 'Le Moniteur · LM1995-48 · 150ᵉ année, n° 48 du jeudi 22 juin 1995, p. 943 à 946',
        adoptionDate: new Date('1995-06-02T00:00:00Z'), publicationDate: new Date('1995-06-22T00:00:00Z'),
        annotationsJson: JSON.stringify({
          title: TITRE, annotationAuthor: '', navToc: [], toc: [], connexes: [], jurisprudence: [],
          indexEntries: [], labels: Object.fromEntries(arts95.map((n) => [`art-${n}`, `Article ${n}`])),
        }),
      },
    })
    id95 = doc.id
    for (const t of themes)
      await tx.documentTheme.create({ data: { documentId: doc.id, themeId: t.id, isPrimary: t.primaire, assignedBy: 'IMPORT' } })

    const cr = Array.isArray(ann79.crossRefs) ? ann79.crossRefs : []
    await tx.document.update({
      where: { id: d79.id },
      data: {
        bodyOriginal: corps79Neuf,
        adoptionDate: new Date('1979-10-10T00:00:00Z'),
        annotationsJson: JSON.stringify({
          ...ann79,
          status: { ...statusAvant, 'art-5': 'abrogé', 'art-6': 'abrogé' },
          labels: { ...(ann79.labels ?? {}), 'art-7': 'Article 7' },
          crossRefs: [...cr, {
            anchor: 'art-7', articles: [],
            note:
              'Article 7 ajouté le 29 août 2026 d’après la transcription du Moniteur n° 82 du ' +
              '18 octobre 1979 : il manquait au corpus, qui s’arrêtait à l’article 6. ' +
              '⚠️ ÉCARTS RELEVÉS, NON TRANCHÉS — la rédaction des articles 1 à 6 diffère entre la ' +
              'présente édition et la transcription du Journal officiel. Quatre écarts sont ' +
              'typographiques ; DEUX ne le sont pas : l’article 1er porte ici « Dès la PUBLICATION » ' +
              'quand le Moniteur porte « Dès la PROMULGATION », et l’article 6 « pour exister ET ' +
              'fonctionner » quand le Moniteur porte « ou fonctionner ». Rien n’a été modifié : la ' +
              'question est réservée à l’éditeur, sur le fascicule.',
            docs: [{ label: TITRE, id: doc.id }],
          }],
        }),
      },
    })

    for (const n of [5, 6]) {
      const texte = (d79.bodyOriginal ?? '').split('\n').filter((l, i, arr) => {
        const deb = arr.findIndex((x) => new RegExp(`^\\s*Article\\s+${n}\\s*\\.-`).test(x))
        const fin = arr.findIndex((x, k) => k > deb && /^\s*Article\s+\d+\s*\.-/.test(x))
        return deb >= 0 && i >= deb && (fin < 0 || i < fin)
      }).join('\n')
      if (!texte.trim()) throw new Error(`article ${n} : texte introuvable pour l’ArticleVersion. STOP`)
      await tx.articleVersion.create({
        data: {
          documentId: d79.id, anchor: `art-${n}`, label: `Article ${n}`, body: texte,
          status: 'ABROGE', effectiveDate: new Date('1995-06-02T00:00:00Z'),
          amendedByDocId: doc.id, amendedByNumber: 'Décret du 2 juin 1995',
          note: 'Abrogé nommément par l’article 1er du Décret du 2 juin 1995.', origin: 'MANUAL',
        },
      })
    }

    await tx.crossRef.createMany({
      data: [
        { fromId: doc.id, toId: d79.id, toType: 'LEGISLATION', kind: 'ABROGE', position: 0, source: 'EDITORIAL',
          toLabel: 'Décret du 10 octobre 1979 sur les sociétés anonymes — articles 5 et 6',
          note: 'dispositif (article 1er du Décret) : « Sont et demeurent abrogés les articles 5 et 6 du Décret du 10 octobre 1979 relatifs aux formalités de constitution des sociétés anonymes. » Abrogation NOMINATIVE.' },
        { fromId: doc.id, toType: 'LEGISLATION', kind: 'ABROGE', position: 1, source: 'EDITORIAL',
          toLabel: 'Toutes lois et dispositions contraires (clause générale)',
          note: 'dispositif (article 4 du Décret) : « Le présent Décret abroge toutes lois ou dispostions de lois, tous décrets ou dispositions de décrets, tous décrets-lois ou dispositions de décrets-lois qui lui sont contraires » (sic « dispostions »). ⚠️ Clause GÉNÉRALE : aucune pastille n’en est tirée.' },
      ],
    })
    const l55 = await tx.document.findFirst({ where: { source: 'CC_VANDAL_IV-A-1' }, select: { id: true } })
    if (l55)
      await tx.crossRef.create({
        data: { fromId: doc.id, toId: l55.id, toType: 'LEGISLATION', kind: 'CITE', position: 2, source: 'EDITORIAL',
          toLabel: 'Loi du 3 août 1955 sur la constitution et le fonctionnement des sociétés anonymes',
          note: 'visa du Décret : « Vu la Loi du 19 août 1955 sur les sociétés anonymes ; ». ⚠️ ÉCART DE DATE conservé tel quel : le corpus, le décret de 1979 et deux fascicules du Moniteur (1982, 1985) désignent cette loi par le 3 août 1955 ; l’édition Vandal la date ailleurs du 16 août (satellite IV-D-1, art. 9). Aucune « loi du 19 août 1955 » au corpus. Rien n’est affirmé : à trancher sur le Moniteur n° 82 du 12 septembre 1955.' },
      })

    await audit({
      action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: 'SOCIETES_1995',
      meta: {
        motif:
          'Décret du 2 juin 1995 versé (absent du corpus, vérifié par sonde de contenu sur 3 716 textes) ; ' +
          'article 7 rendu au décret du 10 octobre 1979, qui s’arrêtait à l’article 6 ; adoptionDate ' +
          '1979-10-10 posée (elle était NULLE) ; pastilles « abrogé » sur les articles 5 et 6, abrogés ' +
          'NOMMÉMENT par l’article 1er du décret de 1995, avec deux ArticleVersion datées du 2 juin 1995. ' +
          'Aucune pastille tirée de la clause générale de l’article 4. ⚠️ Six divergences relevées entre ' +
          'l’édition Vandal et la transcription du Moniteur, dont DEUX de fond (publication/promulgation ' +
          'à l’art. 1er, et/ou à l’art. 6) : non tranchées, non touchées, dites en note d’édition.',
        pastilles: 2, articleVersions: 2, divergencesRelevees: 6, divergencesDeFond: 2,
      },
    }, tx)
  }, { timeout: 120_000, maxWait: 30_000 })

  const journal = await prisma.auditLog.count({ where: { targetId: 'SOCIETES_1995' } })
  await reindexDocument(id95); await reindexDocument(d79.id)
  const ap = await prisma.document.findUnique({ where: { id: d79.id }, select: { bodyOriginal: true, annotationsJson: true, adoptionDate: true } })
  const a = JSON.parse(String(ap?.annotationsJson ?? '{}'))
  const b: { anchor?: string | null }[] = segmentAnnotated(ap?.bodyOriginal ?? '', a.toc ?? [])
  const av = await prisma.articleVersion.count({ where: { documentId: d79.id } })
  const nv = await prisma.document.findFirst({ where: { source: SOURCE }, select: { themes: { select: { isPrimary: true, theme: { select: { slug: true } } } } } })
  const cr = await prisma.crossRef.count({ where: { from: { source: SOURCE } } })
  console.log(`\n✓ AuditLog ${journal} (recompté)`)
  console.log(`  décret de 1979 : ${new Set(b.map((x) => x.anchor).filter(Boolean)).size} articles · adopté ${ap?.adoptionDate?.toISOString().slice(0, 10)}`)
  console.log(`  pastilles : ${Object.entries(a.status ?? {}).map(([k, v]) => `${k}=${v}`).join(', ')}`)
  console.log(`  ArticleVersion : ${av} · corps modifié uniquement par l’art. 7 : ${createHash('md5').update(ap?.bodyOriginal ?? '').digest('hex') !== empreinteAvant ? 'oui (attendu)' : '⚠️ INCHANGÉ'}`)
  console.log(`  décret de 1995 : thèmes ${nv?.themes.map((t) => t.theme.slug + (t.isPrimary ? '★' : '')).join(', ')} · ${cr} renvois`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
