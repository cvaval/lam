/**
 * RAEJH — INTÉGRER LE RÉPERTOIRE AUX ARRÊTS EXISTANTS, AU MÊME STANDARD, ET RELIER LES NOTIONS
 * AUX TEXTES DE LOI.
 *
 *     SEARCH_PROVIDER=fts npx tsx scripts/integrer-raejh.ts            # simulation
 *     SEARCH_PROVIDER=fts npx tsx scripts/integrer-raejh.ts --apply    # écrit
 *
 * Trois directives de la cliente (14 septembre 2026) :
 *   1. « le même standard, avec le nom des parties et l'année » ;
 *   2. « intégrer le répertoire aux autres textes présents » ;
 *   3. « rechercher par notion pour l'ensemble des textes ».
 *
 * ─── A. LES DOUBLONS QUE LES PARTIES NE POUVAIENT PAS VOIR ─────────────────────────────────
 * ⚠️ 18 ARRÊTS EXISTANTS ONT UN TITRE CASSÉ — « Cour de Cassation, Première Section, n°  » —
 * sans parties. L'appariement par parties ne pouvait pas les reconnaître : 19 arrêts du
 * recueil de 1964-66 ont été CRÉÉS à côté de leur fiche à texte intégral. Le TEXTE, lui, les
 * reconnaît : l'« Attendu » du recueil se retrouve à 72-100 % dans le corps intégral (shingles
 * de 6 mots). Règle : même jour, formation compatible, couverture ≥ 0,40 et le second candidat
 * < 0,15 ⇒ même arrêt ⇒ les extraits et les notions passent à la fiche existante, la fiche
 * d'extraits est supprimée (audit DOC_DELETED). Le corps intégral n'est JAMAIS touché.
 * ⚠️ ET LA FICHE CASSÉE REÇOIT SES PARTIES — c'est la première directive : le recueil donne
 * « Société du Rhum BARBANCOURT c. Jeanne BARBANCOURT » là où la fiche disait « n°  ».
 *
 * ─── B. LA FICHE FANTÔME ───────────────────────────────────────────────────────────────────
 * « Arrêt du 21 dècembre 1971 » — accent GRAVE sur décembre : la classe `[a-zéû]` de
 * l'extracteur refusait la date, la suivante sur la ligne (« Loi du 24 juillet 1961 ») passait
 * pour celle de l'arrêt, les parties se vidaient. Une fiche au titre vide, datée d'avant le
 * recueil. Son extrait rejoint l'arrêt Jarbath du 21 décembre 1971, 2ᵉ section ; elle est
 * supprimée. L'extracteur est corrigé (`\p{L}`), le jeu régénéré.
 *
 * ─── C. LE STANDARD DE PRÉSENTATION ────────────────────────────────────────────────────────
 * Les arrêts existants : `moniteurRef` = « Cour de Cassation · Section · n° N · AAAA-AAAA »,
 * `recueilRef` = « Cour de Cassation — exercice AAAA-AAAA (recueil complet) ». Le recueil
 * disait « … · 3 décembre 1979 — Salès, RAEJH » et un volume unique « Salès — … ». Désormais :
 * `moniteurRef` = « Cour de Cassation · Section · AAAA-AAAA » (pas de n° : le livre n'en
 * donne pas — on n'en invente pas), `recueilRef` = le volume de l'EXERCICE — celui qui existe
 * déjà quand il existe (1964-65, 1965-66), « Cour de Cassation — exercice AAAA-AAAA » sinon.
 * Le recueil se fond dans 27 volumes annuels au lieu d'en faire un 28ᵉ à part. La source
 * reste dite : la notice en tête du corps, et « Salès » sous l'arrêt.
 *
 * ─── D. LES NOTIONS SUR LES TEXTES DE LOI ──────────────────────────────────────────────────
 * Une notion cite des articles ; ces articles sont dans des textes du corpus. Chaque paire
 * (texte, notion) née d'un renvoi RÉSOLU et NON POSTÉRIEUR devient un `DocumentTheme` — avec
 * `anchor` = le premier article cité, pour que la notion mène à l'article. Dès lors : le
 * parcours de la Législation annotée montre la racine du Répertoire (les branches sans texte
 * sont élaguées), et la recherche, qui filtre déjà par thème (`domaineIds`), filtre par
 * notion sur tout le corpus. 537 paires, 13 textes.
 */
import { PrismaClient } from '@prisma/client'
import { audit } from '../src/lib/auth/audit'

const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()
const SOURCE = 'RAEJH_SALES'

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
function shingles(s: string, n = 6) { const w = fold(s).split(' ').filter(Boolean); const o = new Set<string>(); for (let i = 0; i + n <= w.length; i++) o.add(w.slice(i, i + n).join(' ')); return o }
function couverture(extrait: string, corps: string) { const S = shingles(extrait); if (!S.size) return 0; const C = shingles(corps); let n = 0; for (const x of S) if (C.has(x)) n++; return n / S.size }
const titreCasse = (t: string) => /^Cour de Cassation\b/i.test(t) || t.trim() === ''

async function main() {
  console.log(`\n══ INTÉGRATION ${APPLY ? '(ÉCRITURE)' : '(simulation)'} ══`)
  const aReindexer = new Set<string>()

  // ── B. la fiche fantôme ──
  const fantome = await prisma.document.findFirst({ where: { source: SOURCE, titleFr: '' }, select: { id: true, extraitsDecision: { select: { id: true, themeId: true } } } })
  const jarbath = await prisma.document.findFirst({ where: { type: 'JURISPRUDENCE', publicationDate: new Date('1971-12-21T00:00:00Z'), chambre: 'Deuxième Section', titleFr: { contains: 'JARBATH' } }, select: { id: true, titleFr: true } })
  if (fantome && jarbath) {
    console.log(`B. fiche fantôme : ${fantome.extraitsDecision.length} extrait(s) → « ${jarbath.titleFr} » ; fiche supprimée`)
    if (APPLY) {
      await prisma.jurisExtrait.updateMany({ where: { decisionId: fantome.id }, data: { decisionId: jarbath.id } })
      await prisma.documentTheme.createMany({ data: fantome.extraitsDecision.map((e) => ({ documentId: jarbath.id, themeId: e.themeId, isPrimary: false, assignedBy: 'ADMIN' })), skipDuplicates: true })
      await prisma.document.delete({ where: { id: fantome.id } })
      await audit({ action: 'DOC_DELETED', actorId: null, targetType: 'DOCUMENT', meta: { reason: 'RAEJH : fiche fantôme (date mal lue, parties vides) fondue dans l’arrêt Jarbath', count: 1 } })
      aReindexer.add(jarbath.id)
    }
  } else console.log(`B. fiche fantôme : ${fantome ? 'présente, cible Jarbath INTROUVABLE — rien fait' : 'déjà traitée'}`)

  // ── A. fusion par le texte ──
  const sales = await prisma.document.findMany({ where: { source: SOURCE, NOT: { titleFr: '' } }, select: { id: true, titleFr: true, chambre: true, publicationDate: true, extraitsDecision: { select: { id: true, texte: true, themeId: true } } } })
  const anciens = await prisma.document.findMany({ where: { type: 'JURISPRUDENCE', source: { not: SOURCE } }, select: { id: true, titleFr: true, chambre: true, publicationDate: true, bodyOriginal: true } })
  const parDate = new Map<number, typeof anciens>()
  for (const a of anciens) { const k = a.publicationDate?.getTime() ?? 0; parDate.set(k, [...(parDate.get(k) ?? []), a]) }
  const primaires = new Set((await prisma.documentTheme.findMany({ where: { isPrimary: true }, select: { documentId: true } })).map((x) => x.documentId))
  let fusions = 0, titresRepares = 0, douteux = 0
  const journal: string[] = []
  for (const s of sales) {
    const cands = (parDate.get(s.publicationDate?.getTime() ?? -1) ?? []).filter((a) => !s.chambre || !a.chambre || a.chambre === s.chambre)
    if (!cands.length) continue
    const texte = s.extraitsDecision.map((e) => e.texte).join('\n')
    const scores = cands.map((a) => ({ a, c: couverture(texte, a.bodyOriginal) })).sort((x, y) => y.c - x.c)
    const top = scores[0]
    if (!(top.c >= 0.4 && (scores.length === 1 || scores[1].c < 0.15))) { if (top.c >= 0.15) douteux++; continue }
    fusions++
    const repare = titreCasse(top.a.titleFr)
    if (repare) titresRepares++
    journal.push(`${(top.c * 100).toFixed(0).padStart(3)} % « ${s.titleFr.slice(0, 44)} » → « ${top.a.titleFr.slice(0, 40)} »${repare ? '  ⇒ titre réparé' : ''}`)
    if (!APPLY) continue
    await prisma.jurisExtrait.updateMany({ where: { decisionId: s.id }, data: { decisionId: top.a.id } })
    await prisma.documentTheme.createMany({ data: s.extraitsDecision.map((e) => ({ documentId: top.a.id, themeId: e.themeId, isPrimary: false, assignedBy: 'ADMIN' })), skipDuplicates: true })
    if (repare) await prisma.document.update({ where: { id: top.a.id }, data: { titleFr: s.titleFr } })
    await prisma.document.delete({ where: { id: s.id } })
    aReindexer.add(top.a.id)
  }
  if (APPLY && fusions) await audit({ action: 'DOC_DELETED', actorId: null, targetType: 'DOCUMENT', meta: { reason: 'RAEJH : fiches d’extraits fondues dans l’arrêt à texte intégral (appariement par le texte)', count: fusions } })
  console.log(`A. fusions par le texte : ${fusions} (titres cassés réparés : ${titresRepares}) · douteux non fusionnés : ${douteux}`)
  for (const l of journal) console.log('   ' + l)
  const cassesRestants = anciens.filter((a) => titreCasse(a.titleFr)).length - titresRepares
  console.log(`   titres cassés restants (sans jumeau au recueil) : ${cassesRestants}`)

  // ── C. standard de présentation ──
  const labelsExercice = new Map<number, string>()
  for (const a of await prisma.document.findMany({ where: { type: 'JURISPRUDENCE', source: { not: SOURCE }, recueilRef: { not: null } }, select: { exerciceDebut: true, recueilRef: true } }))
    if (a.exerciceDebut && a.recueilRef && !labelsExercice.has(a.exerciceDebut)) labelsExercice.set(a.exerciceDebut, a.recueilRef)
  const restants = await prisma.document.findMany({ where: { source: SOURCE }, select: { id: true, chambre: true, exerciceDebut: true, exerciceFin: true } })
  const parCle = new Map<string, string[]>()
  for (const d of restants) {
    const ex = `${d.exerciceDebut}-${d.exerciceFin}`
    const moniteurRef = `Cour de Cassation · ${d.chambre ?? 'formation non précisée'} · ${ex}`
    const recueilRef = labelsExercice.get(d.exerciceDebut ?? -1) ?? `Cour de Cassation — exercice ${ex}`
    const k = `${moniteurRef}${recueilRef}`
    parCle.set(k, [...(parCle.get(k) ?? []), d.id])
  }
  const volumes = new Set([...parCle.keys()].map((k) => k.split('')[1]))
  console.log(`C. présentation : ${restants.length} arrêts du recueil → ${volumes.size} volumes d'exercice (dont ${[...volumes].filter((v) => /complet/.test(v)).length} existants rejoints)`)
  if (APPLY) {
    for (const [k, ids] of parCle) { const [moniteurRef, recueilRef] = k.split(''); await prisma.document.updateMany({ where: { id: { in: ids } }, data: { moniteurRef, recueilRef } }); ids.forEach((id) => aReindexer.add(id)) }
  }

  // ── D. notions sur les textes de loi ──
  const paires = await prisma.$queryRaw<{ documentId: string; themeId: string; anchor: string | null }[]>`
    SELECT r."documentId", e."themeId", min(r.anchor) AS anchor
    FROM "JurisExtraitRef" r JOIN "JurisExtrait" e ON e.id = r."extraitId"
    WHERE r."documentId" IS NOT NULL AND r.posterieur = false
    GROUP BY r."documentId", e."themeId"`
  const dejaLa = new Set((await prisma.documentTheme.findMany({ where: { documentId: { in: [...new Set(paires.map((p) => p.documentId))] } }, select: { documentId: true, themeId: true } })).map((x) => `${x.documentId}|${x.themeId}`))
  const nouvelles = paires.filter((p) => !dejaLa.has(`${p.documentId}|${p.themeId}`))
  console.log(`D. notions ↔ textes de loi : ${paires.length} paires · ${nouvelles.length} à créer · ${[...new Set(paires.map((p) => p.documentId))].length} textes`)
  if (APPLY && nouvelles.length) {
    for (let i = 0; i < nouvelles.length; i += 300) await prisma.documentTheme.createMany({ data: nouvelles.slice(i, i + 300).map((p) => ({ documentId: p.documentId, themeId: p.themeId, isPrimary: false, assignedBy: 'ADMIN', anchor: p.anchor })), skipDuplicates: true })
    paires.forEach((p) => aReindexer.add(p.documentId))
  }

  if (!APPLY) { console.log('\n(Simulation — relancer avec --apply pour écrire.)'); return }
  // ── réindexation (FTS seul), 4 de front ──
  if (process.env.SEARCH_PROVIDER === 'opensearch') { console.error('⛔ SEARCH_PROVIDER=opensearch — lancer avec SEARCH_PROVIDER=fts'); process.exit(1) }
  const { reindexDocument } = await import('../src/lib/search/reindex')
  const ids = [...aReindexer]
  let i = 0
  const w = async () => { while (i < ids.length) { const id = ids[i++]; await reindexDocument(id); if (i % 200 === 0) console.log(`  réindexés ${i}/${ids.length}`) } }
  await Promise.all([w(), w(), w(), w()])
  console.log(`\n──── RELECTURE ────`)
  console.log('  arrêts RAEJH_SALES restants :', await prisma.document.count({ where: { source: SOURCE } }))
  console.log('  titres vides ou cassés (tous arrêts) :', await prisma.document.count({ where: { type: 'JURISPRUDENCE', OR: [{ titleFr: '' }, { titleFr: { startsWith: 'Cour de Cassation' } }] } }))
  const vols = await prisma.document.groupBy({ by: ['recueilRef'], where: { type: 'JURISPRUDENCE' }, _count: true })
  console.log('  volumes :', vols.length, '·', vols.map((v) => `${v.recueilRef?.replace('Cour de Cassation — exercice ', '')}:${v._count}`).sort().join(' '))
  console.log('  textes de loi portant des notions :', (await prisma.documentTheme.groupBy({ by: ['documentId'], where: { theme: { slug: { startsWith: 'jfs-' } }, document: { type: { not: 'JURISPRUDENCE' } } } })).length)
  console.log(`✅ ${ids.length} réindexés.`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
