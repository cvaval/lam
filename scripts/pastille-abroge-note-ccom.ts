/**
 * CODE DE COMMERCE — PASTILLE « ABROGÉ » ET NOTE AU LIEU DU REPLI (arts 91-95).
 *
 *     npx tsx scripts/pastille-abroge-note-ccom.ts            # simulation
 *     npx tsx scripts/pastille-abroge-note-ccom.ts --apply    # Me Vaval, elle seule
 *
 * DEUX DÉCISIONS DE ME VAVAL, 27 août 2026, qui reprennent l'application du matin :
 *  1. « pour les articles pour lesquels il n'y a pas de nouvelle version, la pastille doit
 *     dire abrogé et non amendé » — donc arts 91, 93, 94, 95 : `modifié` → `abrogé`
 *     (le 92 l'est déjà ; le 600, qui A une nouvelle version, RESTE `modifié`) ;
 *  2. « une note » au lieu du repli — le repli « ancienne version » de ces articles ne
 *     montrait RIEN de plus que le corps (aucun texte nouveau n'existe sous ces numéros :
 *     le droit en vigueur vit sous 1611-1/1611-2). Le repli dupliqué DISPARAÎT (91 à 95,
 *     92 compris — même défaut, même remède), remplacé par une note qui dit où vit le droit.
 *     Le repli du 600 est un VRAI repli (ancien texte à 2 alinéas sous un corps à 5) : GARDÉ.
 *
 * Le corps n'est pas touché — la rédaction ancienne reste affichée sous son numéro, c'est la
 * pastille et la note qui disent son sort. Quatre ArticleVersion ABROGE sont créées pour
 * 91/93/94/95 (le 92 a déjà la sienne) : elles archivent le texte abrogé, comme pour le 92.
 */
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../src/lib/db'
import { segmentAnnotated, type Annotations, type AnnBlock } from '../src/lib/legislation/annotated'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex')
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
const APPLY = process.argv.includes('--apply')
const REF = 'Décret réformant le Droit des Sûretés (Le Moniteur, Spécial n° 7 du 14 mai 2020)'
const DIR = join(process.cwd(), 'scripts/data/decret-suretes')

const NOTE_REMPLACE = (cible: string) =>
  `L’article 17 du Décret du 9 avril 2020 réformant le Droit des Sûretés (Le Moniteur, ` +
  `Spécial n° 7 du 14 mai 2020) reprend la matière de cet article à l’article ${cible} du ` +
  `présent Code. La rédaction reproduite ci-dessus est celle d’avant la réforme ; elle ne ` +
  `porte plus le droit en vigueur.`
const NOTE_92 =
  `Abrogé par l’article 17 du Décret du 9 avril 2020 réformant le Droit des Sûretés (Le ` +
  `Moniteur, Spécial n° 7 du 14 mai 2020) : « L’actuel article 92 est abrogé. » La rédaction ` +
  `reproduite ci-dessus est celle d’avant la réforme.`

/** ancre → { note, versABROGE } */
const PLAN: Record<string, { note: string; creerAV: boolean; cible?: string }> = {
  'art-91': { note: NOTE_REMPLACE('1611-1'), creerAV: true, cible: 'art-1611-1' },
  'art-92': { note: NOTE_92, creerAV: false },
  'art-93': { note: NOTE_REMPLACE('1611-2'), creerAV: true, cible: 'art-1611-2' },
  'art-94': { note: NOTE_REMPLACE('1611-2'), creerAV: true, cible: 'art-1611-2' },
  'art-95': { note: NOTE_REMPLACE('1611-2'), creerAV: true, cible: 'art-1611-2' },
}
const PASSENT_ABROGE = ['art-91', 'art-93', 'art-94', 'art-95']

async function main() {
  const doc = await prisma.document.findFirst({
    where: { source: 'CODE_COMMERCE_ANNOTE' },
    select: { id: true, titleFr: true, bodyOriginal: true, annotationsJson: true },
  })
  if (!doc) throw new Error('CODE_COMMERCE_ANNOTE introuvable')
  const dec = await prisma.document.findFirst({
    where: { source: 'DECRET_SURETES' }, select: { id: true, bodyOriginal: true },
  })
  if (!dec) throw new Error('DECRET_SURETES introuvable')
  // La phrase du 92 est CITÉE dans la note : elle doit exister au décret, mot pour mot.
  if (!(dec.bodyOriginal ?? '').includes('L’actuel article 92 est abrogé'))
    throw new Error('la citation « L’actuel article 92 est abrogé » est introuvable au corps du décret')

  if (!doc.bodyOriginal || !dec.bodyOriginal) throw new Error('corps vide sur une des deux fiches')
  const corpsCcom = doc.bodyOriginal
  const md5Corps = md5(corpsCcom)
  console.log(`✓ Code de commerce ${doc.id} · corps md5 ${md5Corps} (NON touché par ce script)`)

  const ann = JSON.parse(doc.annotationsJson ?? '{}') as Annotations & {
    status?: Record<string, string>
    oldVersions?: Record<string, unknown>
    commentaires?: Record<string, string[]>
  }
  const status = ann.status ?? {}
  const ov = (ann.oldVersions ?? {}) as Record<string, unknown>
  const comm = (ann.commentaires ?? {}) as Record<string, string[]>
  if (Array.isArray(ann.oldVersions) || Array.isArray(ann.commentaires))
    throw new Error('oldVersions/commentaires : forme inattendue (tableau)')

  // ── L'état de départ, VÉRIFIÉ avant d'y toucher ─────────────────────────────
  for (const a of PASSENT_ABROGE)
    if (status[a] !== 'modifié') throw new Error(`${a} : statut « ${status[a]} », attendu « modifié » — l'état n'est pas celui du 27 août matin`)
  if (status['art-92'] !== 'abrogé') throw new Error(`art-92 : statut « ${status['art-92']} », attendu « abrogé »`)
  if (status['art-600'] !== 'modifié') throw new Error(`art-600 : statut « ${status['art-600']} », attendu « modifié » — il a une VRAIE nouvelle version, il ne bouge pas`)

  // Les blocs du corps, pour prouver la duplication repli = corps.
  const blocs = segmentAnnotated(corpsCcom, ann.toc)
  const parAncre = new Map<string, string>()
  const jurisKeyDe = new Map<string, string>()
  for (const b of blocs)
    if (b.kind === 'body' && b.anchor) {
      parAncre.set(b.anchor, b.text)
      const bb = b as Extract<AnnBlock, { kind: 'body' }> & { jurisKey?: string }
      if (bb.jurisKey) jurisKeyDe.set(b.anchor, bb.jurisKey)
    }

  for (const a of Object.keys(PLAN)) {
    const repli = ov[a]
    if (typeof repli !== 'string') throw new Error(`${a} : oldVersions absent ou non-chaîne — rien à convertir`)
    const corps = parAncre.get(a)
    if (!corps) throw new Error(`${a} : aucun bloc de corps`)
    if (norm(repli) !== norm(corps))
      throw new Error(`${a} : le repli DIFFÈRE du corps — ce n'est pas un doublon, on ne le supprime pas (vérifier à la main)`)
  }
  // Le 600 : son repli doit DIFFÉRER du corps (vrai repli) — on le garde.
  if (typeof ov['art-600'] !== 'string' || norm(ov['art-600'] as string) === norm(parAncre.get('art-600') ?? ''))
    throw new Error('art-600 : son repli devrait être un VRAI ancien texte, différent du corps')

  // L'AV du 92 existe déjà ; celles des quatre autres pas encore.
  const avAvant = await prisma.articleVersion.findMany({
    where: { documentId: doc.id, anchor: { in: [...PASSENT_ABROGE, 'art-92'] } },
    select: { anchor: true, status: true },
  })
  if (!avAvant.some((v) => v.anchor === 'art-92' && v.status === 'ABROGE'))
    throw new Error('art-92 : ArticleVersion ABROGE attendue (écrite ce matin) — introuvable')
  for (const a of PASSENT_ABROGE)
    if (avAvant.some((v) => v.anchor === a)) throw new Error(`${a} : une ArticleVersion existe déjà — ne pas dupliquer`)

  // ── Construction ────────────────────────────────────────────────────────────
  const statusApres = { ...status }
  for (const a of PASSENT_ABROGE) statusApres[a] = 'abrogé'
  const ovApres = { ...ov }
  for (const a of Object.keys(PLAN)) delete ovApres[a]
  const commApres: Record<string, string[]> = Object.fromEntries(Object.entries(comm).map(([k, v]) => [k, [...v]]))
  let notes = 0
  for (const [a, p] of Object.entries(PLAN)) {
    const cle = jurisKeyDe.get(a)
    if (!cle) throw new Error(`${a} : aucune jurisKey — la note serait orpheline`)
    const liste = commApres[cle] ?? []
    if (!liste.includes(p.note)) { liste.push(p.note); notes++ }
    commApres[cle] = liste
    if (p.cible && !(ann.labels ?? {})[p.cible]) throw new Error(`${a} : la cible ${p.cible} n'est pas dans labels`)
  }

  const annApres = JSON.stringify({ ...ann, status: statusApres, oldVersions: ovApres, commentaires: commApres })

  console.log('\n──────── RAPPORT (avant écriture) ────────')
  console.log(`Statuts : 91/93/94/95 modifié → ABROGÉ · 92 abrogé (inchangé) · 600 modifié (inchangé — vraie nouvelle version)`)
  console.log(`Replis supprimés (doublons du corps, prouvés au caractère près) : ${Object.keys(PLAN).join(', ')}`)
  console.log(`Repli GARDÉ : art-600 (ancien texte à 2 alinéas ≠ corps à 5 — vrai repli)`)
  console.log(`Notes ajoutées : ${notes} — sous ${Object.keys(PLAN).map((a) => jurisKeyDe.get(a)).join(', ')}`)
  console.log(`ArticleVersion ABROGE à créer : ${PASSENT_ABROGE.join(', ')} (le 92 a déjà la sienne)`)
  console.log(`Corps : NON touché (md5 ${md5Corps})`)

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. --apply est réservé à Me Vaval.')
    await prisma.$disconnect()
    return
  }

  const horo = new Date().toISOString().replace(/[:.]/g, '-')
  const fichierEtat = join(DIR, `etat-anterieur-pastilles-${horo}.json`)
  writeFileSync(fichierEtat, JSON.stringify({ id: doc.id, md5Corps, annotationsJson: doc.annotationsJson }, null, 2))
  console.log(`\nétat antérieur : ${fichierEtat}`)

  await prisma.$transaction(async (tx) => {
    const frais = await tx.document.findUnique({ where: { id: doc.id }, select: { bodyOriginal: true } })
    if (md5(frais!.bodyOriginal) !== md5Corps) throw new Error('le corps a changé depuis la lecture — on ne s’appuie plus sur rien')
    await tx.document.update({ where: { id: doc.id }, data: { annotationsJson: annApres } })
    for (const a of PASSENT_ABROGE) {
      const p = PLAN[a]
      await tx.articleVersion.create({
        data: {
          documentId: doc.id, anchor: a, label: `Article ${a.slice(4)}`,
          body: parAncre.get(a)!, status: 'ABROGE',
          amendedByDocId: dec.id, amendedByNumber: REF, effectiveDate: new Date('2020-05-14'),
          note: `Matière reprise à l’article ${p.cible!.slice(4)} du Code de commerce (article 17 du décret).`,
          origin: 'MANUAL',
        },
      })
    }
    await audit({
      action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: doc.id,
      meta: { source: 'CODE_COMMERCE_ANNOTE',
        motif: 'Décisions de Me Vaval du 27 août : pastille « abrogé » sur 91/93/94/95 (pas de nouvelle version sous ces numéros) ; replis-doublons remplacés par des notes (92 compris) ; 4 ArticleVersion ABROGE.',
        fichierEtatAnterieur: fichierEtat, md5CorpsInchange: md5Corps },
    }, tx)
  }, { timeout: 120_000, maxWait: 30_000 })

  const journalise = await prisma.auditLog.count({ where: { targetId: doc.id, action: 'ARTICLE_AMENDED' } })
  await reindexDocument(doc.id)
  console.log(`✓ écrit · AuditLog ARTICLE_AMENDED sur ce document : ${journalise} (recompté — audit() avale ses erreurs) · réindexé`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error('ÉCHEC :', e instanceof Error ? e.message : e); await prisma.$disconnect(); process.exit(1) })
