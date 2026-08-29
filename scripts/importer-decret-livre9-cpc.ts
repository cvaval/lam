/**
 * LIVRE IX DU CODE DE PROCÉDURE CIVILE — le décret du 28 décembre 2005 (arbitrage).
 *
 *     npx tsx scripts/importer-decret-livre9-cpc.ts            # simulation
 *     npx tsx scripts/importer-decret-livre9-cpc.ts --apply    # Me Vaval, elle seule
 *
 * ⚠️ LE TEXTE EST DÉJÀ DANS LE CODE. Mesuré le 28 août 2026 : la fiche `CODE_PROCEDURE_CIVILE`
 * porte EXACTEMENT les 26 articles de base (955 à 980) et les 43 articles décimaux du décret,
 * et huit articles témoins sont identiques mot pour mot. Ce script n'écrit donc PAS une ligne
 * dans `bodyOriginal` du Code : il POSE LES PASTILLES et verse le décret comme document.
 *
 * ⚠️ DEUX DATES, ET LA BONNE EST LA PREMIÈRE. Le dispositif se clôt sur « Donné au Palais
 * National à Port-au-Prince le 28 décembre 2005 » ; la publication au Moniteur n'intervient que
 * trois mois plus tard, le 3 avril 2006. Un décret porte la date de sa signature.
 *
 * ⚠️ AUCUNE PASTILLE « abrogé ». Le décret dit que les articles « se liront désormais comme
 * suit » : il les REMPLACE, il n'en supprime aucun — la plage 955..980 est couverte sans trou.
 * Son article 2 abroge « les dispositions contraires » : clause GÉNÉRALE, qui se pose en
 * CrossRef sur le document, jamais en pastille d'article. Poser un « abrogé » au nom d'une
 * clause générale, ce serait affirmer ce que le texte ne dit pas.
 *
 * ⚠️ LES 26 PASTILLES « modifié » N'OUVRENT AUCUN REPLI, ET LA FICHE LE DIT. La rédaction
 * d'avant 2006 n'existe nulle part sur la plateforme (recherche du 28 août : un seul document
 * porte un article 955 d'arbitrage, le Code lui-même ; les 116 textes de l'Appendice sont des
 * satellites ; les 9 entrées d'Index sur l'arbitrage d'avant 2006 visent la Commission
 * Tripartite ou des conventions internationales). Une note portée sur l'en-tête du Livre IX
 * l'explique au lecteur, plutôt que de lui promettre un repli vide.
 *
 * ⚠️ L'INDEX DU CODE N'EST PAS TOUCHÉ (décision de Me Vaval, « éviter ces doublons »). Les deux
 * index ne suivent pas la même convention : celui du Code préfixe par la matière (« Appel —
 * Arbitrage (en matière d'…) ») parce qu'il couvre dix livres ; celui du décret nomme le terme
 * nu (« Appel ») parce qu'il n'en couvre qu'un. 0 doublon textuel, mais 14 par inclusion : un
 * dédoublonnage par égalité de chaîne n'en verrait aucun.
 */
import { prisma } from '../src/lib/db'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { createHash } from 'node:crypto'

const APPLY = process.argv.includes('--apply')
const D = join(process.cwd(), 'scripts/data/cpc-livre9')
const lire = (f: string) => readFileSync(join(D, f), 'utf8')
const SOURCE = 'DECRET_LIVRE_IX_CPC_2005'
const TITRE = 'Décret du 28 décembre 2005 portant réforme du Livre IX du Code de Procédure Civile Haïtien'
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

async function main() {
  const corps = lire('corps-decret-2006.txt').replace(/\n+$/, '')
  const toc: { level: number; label: string; anchor: string; kind: string }[] = JSON.parse(lire('toc-decret.json'))
  const idx: { subject: string; ctRefs: string[] }[] = JSON.parse(lire('idx-decret.json'))
  const tab: { art: string; objet: string }[] = JSON.parse(lire('table-analytique.json'))

  const têtes = corps.split('\n').flatMap((l) => {
    const m = l.match(/^Article\s+(\d{1,4}(?:-\d+)?)\s*\.-/)
    return m ? [m[1]] : []
  })
  const disp = têtes.filter((t) => t === '1' || t === '2')
  const l9 = têtes.filter((t) => t !== '1' && t !== '2')
  const base = [...new Set(l9.filter((t) => !t.includes('-')))]
  const dec = l9.filter((t) => t.includes('-'))
  if (têtes.length !== 71 || disp.length !== 2 || base.length !== 26 || dec.length !== 43)
    throw new Error(`décret : ${têtes.length} têtes (${disp.length} dispositif, ${base.length} base, ${dec.length} décimaux) — 71/2/26/43 attendus. STOP`)
  if (toc.length !== 13) throw new Error(`sommaire : ${toc.length} entrées, 13 attendues. STOP`)
  if (idx.length !== 76 || tab.length !== 69) throw new Error(`index ${idx.length}/76 · table ${tab.length}/69. STOP`)
  const lignes = new Set(corps.split('\n').map((l) => l.trim()))
  const absents = toc.filter((t) => !lignes.has(t.label))
  if (absents.length) throw new Error(`${absents.length} libellé(s) de sommaire absents du corps : ${absents.map((t) => t.label).join(' · ')}. STOP`)

  if (await prisma.document.findFirst({ where: { source: SOURCE } })) throw new Error(`${SOURCE} déjà versé. STOP`)
  const code = await prisma.document.findFirst({ where: { source: 'CODE_PROCEDURE_CIVILE' }, select: { id: true, bodyOriginal: true, annotationsJson: true } })
  if (!code) throw new Error('CODE_PROCEDURE_CIVILE introuvable. STOP')
  const empreinteAvant = createHash('md5').update(code.bodyOriginal ?? '').digest('hex')
  const annCode = JSON.parse(String(code.annotationsJson ?? '{}'))

  // ── Le Code porte-t-il bien la rédaction de 2006 ? Huit témoins, sinon on n'écrit rien ──
  const teteDe = (txt: string, n: string) => txt.split('\n').find((l) => new RegExp(`^\\s*Article\\s+${n}\\s*\\.-`).test(l)) ?? ''
  const divergents = ['955', '956', '957', '957-1', '960', '970', '976-1', '980'].filter(
    (n) => fold(teteDe(code.bodyOriginal ?? '', n)).slice(0, 240) !== fold(teteDe(corps, n)).slice(0, 240),
  )
  if (divergents.length) throw new Error(`témoins divergents (${divergents.join(', ')}) : le Code n'est plus celui qui a été mesuré. STOP`)

  // ── Les ancres du Livre IX du Code coïncident-elles EXACTEMENT avec celles du décret ? ──
  const ancresCode = new Set((code.bodyOriginal ?? '').split('\n').flatMap((l) => {
    const m = l.match(/^\s*Article\s+(\d{3}(?:-\d+)?)\s*\.-/)
    const n = m ? m[1] : null
    return n && +n.split('-')[0] >= 955 && +n.split('-')[0] <= 980 ? [n] : []
  }))
  const manquants = l9.filter((n) => !ancresCode.has(n))
  const enTrop = [...ancresCode].filter((n) => !l9.includes(n))
  if (manquants.length || enTrop.length)
    throw new Error(`ancres : ${manquants.length} du décret absentes du Code (${manquants.slice(0,4)}), ${enTrop.length} du Code absentes du décret (${enTrop.slice(0,4)}). STOP`)

  // ── Les pastilles ──
  const statusAvant: Record<string, string> = annCode.status ?? {}
  const nouvelles: Record<string, string> = {}
  for (const n of base) nouvelles[`art-${n}`] = 'modifié'
  for (const n of dec) nouvelles[`art-${n}`] = 'nouveau'
  const collisions = Object.keys(nouvelles).filter((k) => k in statusAvant)
  if (collisions.length) throw new Error(`${collisions.length} pastille(s) déjà posée(s) sur ces ancres : ${collisions.slice(0, 5)}. STOP`)
  const statusApres = { ...statusAvant, ...nouvelles }

  const secL9 = (annCode.toc ?? []).find((t: { label: string }) => /^LIVRE IX$/i.test(t.label.trim()))?.anchor
  if (!secL9) throw new Error('en-tête « LIVRE IX » introuvable au sommaire du Code. STOP')

  console.log(`décret : ${corps.split('\n').length} lignes · ${têtes.length} têtes (2 + 26 base + 43 décimaux) · sommaire ${toc.length}`)
  console.log(`index du décret : ${idx.length} mots-clés + ${tab.length} objets de la table analytique = ${idx.length + tab.length} entrées`)
  console.log(`\npastilles sur le Code : ${Object.keys(statusAvant).length} existantes + 26 « modifié » + 43 « nouveau » = ${Object.keys(statusApres).length}`)
  console.log(`  aucune « abrogé » — le décret remplace, il ne supprime aucun numéro`)
  console.log(`  note portée sur l’en-tête du Livre IX (${secL9}) : les 26 replis manquent, et la fiche le dit`)
  console.log(`  corps du Code : INTACT (empreinte ${empreinteAvant.slice(0, 10)})`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  const themes = await prisma.theme.findMany({ where: { slug: { in: ['arbitrage', 'procedure-civile'] } }, select: { id: true, slug: true } })
  if (themes.length !== 2) throw new Error('thèmes arbitrage / procedure-civile introuvables. STOP')
  let docId = ''
  await prisma.$transaction(async (tx) => {
    const ann = {
      title: TITRE, annotationAuthor: '', toc,
      navToc: toc.filter((t) => t.level <= 2).map((t) => ({ label: t.label, anchor: t.anchor, children: [] })),
      connexes: [], jurisprudence: {},
      indexEntries: [
        ...idx.map((e) => ({ subject: e.subject, ctRefs: e.ctRefs })),
        ...tab.map((t) => ({ subject: t.objet, ctRefs: [t.art] })),
      ],
      labels: Object.fromEntries(têtes.map((n) => [`art-${n}`, `Article ${n}`])),
    }
    const doc = await tx.document.create({
      data: {
        type: 'LEGISLATION', status: 'EN_VIGUEUR', titleFr: TITRE, number: TITRE,
        bodyOriginal: corps, originalLang: 'fr', source: SOURCE, category: 'LEGISLATION',
        moniteurRef: 'Le Moniteur · LM2006-32 · 161ᵉ année, n° 32 du lundi 3 avril 2006, p. 1 à 11',
        adoptionDate: new Date('2005-12-28T00:00:00Z'), publicationDate: new Date('2006-04-03T00:00:00Z'),
        annotationsJson: JSON.stringify(ann),
      },
    })
    docId = doc.id
    for (const t of themes)
      await tx.documentTheme.create({ data: { documentId: doc.id, themeId: t.id, isPrimary: t.slug === 'arbitrage', assignedBy: 'IMPORT' } })

    // ── Les pastilles + la note d'en-tête, dans les ANNOTATIONS du Code, jamais dans son corps ──
    const cr = Array.isArray(annCode.crossRefs) ? annCode.crossRefs : []
    await tx.document.update({
      where: { id: code.id },
      data: {
        annotationsJson: JSON.stringify({
          ...annCode, status: statusApres,
          crossRefs: [...cr, {
            anchor: secL9, articles: [],
            note:
              'Livre IX réformé en entier par le Décret du 28 décembre 2005 (Le Moniteur n° 32 du ' +
              '3 avril 2006) : les articles 955 à 980 « se liront désormais comme suit », et 43 articles ' +
              'décimaux y ont été ajoutés. Le texte ci-dessous est celui de 2005. ⚠️ La rédaction ' +
              'ANTÉRIEURE n’est pas au corpus : les articles portant la pastille « modifié » n’ouvrent ' +
              'donc aucun repli, faute de pièce — et non parce qu’il n’y aurait rien à replier.',
            docs: [{ label: TITRE, id: doc.id }],
          }],
        }),
      },
    })

    await tx.crossRef.createMany({
      data: [
        { fromId: doc.id, toId: code.id, toType: 'LEGISLATION', kind: 'MODIFIE', position: 0, source: 'EDITORIAL',
          toLabel: 'Code de procédure civile d’Haïti — Livre IX',
          note: 'dispositif (article 1er du Décret) : « Le livre 9 du Code de Procédure Civile portant sur l’arbitrage est et demeure modifié. Les articles 955 à 980 qui le composent se liront désormais comme suit : » — 26 articles réécrits, 43 articles décimaux ajoutés.' },
        { fromId: doc.id, toType: 'LEGISLATION', kind: 'ABROGE', position: 1, source: 'EDITORIAL',
          toLabel: 'Toutes lois et dispositions contraires (clause générale)',
          note: 'dispositif (article 2 du Décret) : « Le présent Décret abroge toutes Lois ou dispositions de Lois, tous Décrets-Lois ou dispositions de Décrets-Lois… qui lui sont contraires ». ⚠️ Clause GÉNÉRALE : aucune pastille « abrogé » n’en est tirée sur un article, faute de désignation nominative.' },
      ],
    })
    for (const [slug, label] of [['CC_VANDAL_I-D-1', 'Loi du 11 juin 1935 réglementant l’arbitrage commercial'], ['CC_VANDAL_I-Annexe-II', 'Règlement d’arbitrage']] as const) {
      const t = await tx.document.findFirst({ where: { source: slug }, select: { id: true } })
      if (t) await tx.crossRef.create({ data: { fromId: doc.id, toId: t.id, toType: 'LEGISLATION', kind: 'CITE', position: 2, source: 'EDITORIAL', toLabel: label, note: 'visa du Décret : « Vu la Loi du 11 juin 1935 créant la Chambre de Commerce et d’Industrie d’Haïti et réglementant l’Arbitrage Commercial National ; » / « Vu les règlements du 31 juillet 1964 relatifs à la Chambre de Commerce et d’Industrie d’Haïti ; »' } })
    }

    await audit({
      action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: 'CPC_LIVRE_IX_2005',
      meta: {
        motif:
          'Décret du 28 décembre 2005 réformant le Livre IX du Code de procédure civile (arbitrage) : ' +
          'versé comme document sous Arbitrage et Procédure civile, et PASTILLES posées sur le Code — ' +
          '26 « modifié » (art. 955 à 980) et 43 « nouveau » (articles décimaux). Le corps du Code n’est ' +
          'PAS touché : il portait déjà la rédaction de 2005, vérifiée sur huit articles témoins. Aucune ' +
          'pastille « abrogé » : le décret remplace sans supprimer aucun numéro, et son article 2 n’est ' +
          'qu’une clause générale. Les 26 replis manquent — la rédaction antérieure n’est pas au corpus — ' +
          'et une note portée sur l’en-tête du Livre IX le dit au lecteur.',
        pastillesModifie: 26, pastillesNouveau: 43, pastillesTotal: Object.keys(statusApres).length,
      },
    }, tx)
  }, { timeout: 120_000, maxWait: 30_000 })

  const journal = await prisma.auditLog.count({ where: { targetId: 'CPC_LIVRE_IX_2005' } })
  await reindexDocument(docId); await reindexDocument(code.id)
  const apres = await prisma.document.findUnique({ where: { id: code.id }, select: { bodyOriginal: true, annotationsJson: true } })
  const a = JSON.parse(String(apres?.annotationsJson ?? '{}'))
  const d = await prisma.document.findFirst({ where: { source: SOURCE }, select: { annotationsJson: true, themes: { select: { isPrimary: true, theme: { select: { slug: true } } } } } })
  const ad = JSON.parse(String(d?.annotationsJson ?? '{}'))
  const cr = await prisma.crossRef.count({ where: { from: { source: SOURCE } } })
  console.log(`\n✓ AuditLog ${journal} (recompté)`)
  console.log(`  corps du Code : ${createHash('md5').update(apres?.bodyOriginal ?? '').digest('hex') === empreinteAvant ? 'INTACT ✓' : '⚠️ MODIFIÉ'}`)
  console.log(`  pastilles du Code : ${Object.keys(a.status ?? {}).length} (dont ${Object.values(a.status ?? {}).filter((x) => x === 'nouveau').length} « nouveau », ${Object.values(a.status ?? {}).filter((x) => x === 'modifié').length} « modifié », ${Object.values(a.status ?? {}).filter((x) => x === 'abrogé').length} « abrogé »)`)
  console.log(`  index du Code : ${(a.indexEntries ?? []).length} entrées (inchangé)`)
  console.log(`  décret : sommaire ${(ad.toc ?? []).length} · index ${(ad.indexEntries ?? []).length} · libellés ${Object.keys(ad.labels ?? {}).length} · renvois ${cr}`)
  console.log(`  thèmes : ${d?.themes.map((t) => t.theme.slug + (t.isPrimary ? '★' : '')).join(', ')}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
