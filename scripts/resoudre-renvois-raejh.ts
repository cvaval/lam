/**
 * RAEJH — RÉSOUDRE LES RENVOIS DU RÉPERTOIRE VERS LES TEXTES DU CORPUS.
 *
 *     npx tsx scripts/resoudre-renvois-raejh.ts            # simulation
 *     npx tsx scripts/resoudre-renvois-raejh.ts --apply    # écrit documentId / anchor / resoluLe
 *     npx tsx scripts/resoudre-renvois-raejh.ts --apply --force   # ré-évalue aussi les renvois déjà résolus
 *
 * REJOUABLE, ET À REJOUER APRÈS CHAQUE VERSEMENT DE LÉGISLATION : les renvois sont stockés par
 * DÉSIGNATION (« CTA », « 507 » ; « LOI-1967-08-28 »). Un texte versé demain fait tomber les
 * renvois qui l'attendaient. Ce script imprime, à chaque passage, CE QUI RESTE EN ATTENTE par
 * texte, trié par nombre d'extraits — c'est la file de versement du corpus.
 *
 * ─── RÈGLES DE RÉSOLUTION (prompt § 3.3 et § 7) ────────────────────────────────────────────
 * · Sigles directs (CTA, CPC, CC, CIC, CP, CCOM, CONST-1987) → `Document.source` du registre ;
 *   l'article → ancre `art-N` si une tête d'article la porte dans le corps (même
 *   `articleAnchorFromHeading` que le lecteur). Texte trouvé sans l'article ⇒ `documentId`
 *   posé, `anchor` NULL — jamais une ancre inventée.
 * · Sigles sans concordance (CT, CT-1961, CT-1984, CPC-1836…) → `documentId` seul.
 * · Clés datées LOI-/DECRET-AAAA-MM-JJ → (a) `adoptionDate` = date ; sinon (b) PREMIÈRE date du
 *   `titleFr`, ancrée à la nature en tête ; sinon (c) `publicationDate` = date ET nature en
 *   tête. ⚠️ 3 916 textes sur 3 993 n'ont pas d'`adoptionDate` : (b) est la voie réelle.
 *   ⚠️ « contient la date » aurait résolu la loi de 1982 vers la loi de 2002 qui la modifie.
 * · DEUX candidats ⇒ ambiguïté ⇒ zéro résolution, rapport.
 * · CONST-1964, CONST-1971, LOI-LIB-…, CONV-VARSOVIE… ⇒ en attente, par libellé.
 */
import { PrismaClient } from '@prisma/client'
import { anchorFromDesignation, articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { CIBLES_DIRECTES, CIBLES_SANS_CONCORDANCE, cleDatee, dateEnTeteDuTitre } from '../src/lib/jurisprudence/cibles'

const APPLY = process.argv.includes('--apply')
/**
 * ⚠️ LA DATE SEULE NE SUFFIT PAS QUAND DEUX TEXTES PARTAGENT UN JOUR. Au premier passage,
 * « Décret du 28 septembre 1987 sur la CARTE D'IDENTITÉ » s'est résolu vers le décret du même
 * jour sur la PATENTE (le seul en base), et « Décret du 26 février 1975 … profession
 * d'AVOCAT » vers celui des ARPENTEURS. Quand le livre nomme l'OBJET du texte, le titre du
 * candidat doit en partager au moins un mot significatif ; quand il ne nomme que la date,
 * on accepte le candidat unique et on le RAPPORTE « par date seule ».
 */
const GENERIQUES = new Set(['loi', 'decret', 'decret-loi', 'arrete', 'organique', 'portant', 'relative', 'relatif', 'relatives', 'modifiant', 'instituant', 'reglementant', 'definissant', 'creant', 'revisant', 'fixant', 'concernant', 'profession', 'organisation', 'dispositions', 'certaines', 'articles', 'article', 'code', 'republique', 'haiti', 'haitienne', 'etat', 'national', 'nationale', 'general', 'generale'])
const foldT = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
function objet(libelle: string): Set<string> {
  return new Set(
    foldT(libelle)
      .replace(/\b\d{1,2}(?:er)?\s+[a-z]+\s+\d{4}\b/g, ' ')
      .replace(/[^a-z ]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4 && !GENERIQUES.has(t)),
  )
}
/**
 * ⚠️ L'OBJET D'UNE CIBLE EST L'UNION DES OBJETS DE TOUS SES LIBELLÉS. Le livre écrit tantôt
 * « Décret du 28 septembre 1987 » nu, tantôt « … sur la carte d'identité » : jugé sur le seul
 * premier libellé, le groupe passait « par date seule » vers le décret sur la patente.
 */
function objetConcorde(objets: Set<string>, titre: string): 'oui' | 'non' | 'date-seule' {
  if (!objets.size) return 'date-seule'
  const t = objet(titre)
  for (const w of objets) if (t.has(w)) return 'oui'
  return 'non'
}
const FORCE = process.argv.includes('--force')
const prisma = new PrismaClient()

async function ancresDe(documentId: string): Promise<Set<string>> {
  const d = await prisma.document.findUnique({ where: { id: documentId }, select: { bodyOriginal: true } })
  const out = new Set<string>()
  for (const l of (d?.bodyOriginal ?? '').split(/\r?\n/)) { const a = articleAnchorFromHeading(l.trim()); if (a) out.add(a) }
  return out
}

async function main() {
  const refs = await prisma.jurisExtraitRef.findMany({
    where: FORCE ? {} : { documentId: null },
    select: { id: true, cible: true, cibleLibelle: true, article: true },
  })
  console.log(`\n══ RÉSOLUTION ${APPLY ? '(ÉCRITURE)' : '(simulation)'} — ${refs.length} renvoi(s) à examiner ══`)
  const parCible = new Map<string, typeof refs>()
  for (const r of refs) parCible.set(r.cible, [...(parCible.get(r.cible) ?? []), r])

  const sourcesDirectes = [...new Set([...Object.values(CIBLES_DIRECTES), ...Object.values(CIBLES_SANS_CONCORDANCE)].map((c) => c.source))]
  const docParSource = new Map((await prisma.document.findMany({ where: { source: { in: sourcesDirectes } }, select: { id: true, source: true } })).map((d) => [d.source!, d.id]))
  const ancresCache = new Map<string, Set<string>>()

  type Maj = { ids: string[]; documentId: string; anchor: string | null }
  const majs: Maj[] = []
  const resolus = new Map<string, number>()
  const attente = new Map<string, { n: number; libelle: string; motif: string }>()
  let sansAncre = 0, ambigus = 0

  for (const [cible, rs] of parCible) {
    const libelle = [...new Set(rs.map((r) => r.cibleLibelle))].sort((a, b) => b.length - a.length)[0]
    const objets = new Set<string>()
    for (const r of rs) for (const w of objet(r.cibleLibelle)) objets.add(w)
    // ── sigles directs ──
    const direct = CIBLES_DIRECTES[cible]
    const sansConc = CIBLES_SANS_CONCORDANCE[cible]
    if (direct || sansConc) {
      const source = (direct ?? sansConc)!.source
      const documentId = docParSource.get(source)
      if (!documentId) { attente.set(cible, { n: rs.length, libelle, motif: `source ${source} absente` }); continue }
      if (!ancresCache.has(documentId)) ancresCache.set(documentId, await ancresDe(documentId))
      const ancres = ancresCache.get(documentId)!
      const parAncre = new Map<string, string[]>()
      for (const r of rs) {
        const anchor = direct && r.article ? anchorFromDesignation(r.article) : null
        const key = anchor && ancres.has(anchor) ? anchor : ''
        if (anchor && !ancres.has(anchor)) sansAncre++
        parAncre.set(key, [...(parAncre.get(key) ?? []), r.id])
      }
      for (const [anchor, ids] of parAncre) majs.push({ ids, documentId, anchor: anchor || null })
      resolus.set(cible, rs.length)
      continue
    }
    // ── clés datées ──
    const d = cleDatee(cible)
    if (d) {
      const jour = new Date(d.iso + 'T00:00:00Z')
      const lendemain = new Date(jour.getTime() + 86400000)
      const natureRe = d.nature === 'LOI' ? /^\s*loi\b/i : /^\s*d[ée]cret\b/i
      let cands = await prisma.document.findMany({ where: { type: 'LEGISLATION', adoptionDate: { gte: jour, lt: lendemain } }, select: { id: true, titleFr: true } })
      cands = cands.filter((c) => natureRe.test(c.titleFr))
      if (!cands.length) {
        // (b) première date du titre, ancrée à la nature — on cherche large par l'année, on filtre strict
        const an = d.iso.slice(0, 4)
        const large = await prisma.document.findMany({ where: { type: 'LEGISLATION', titleFr: { contains: an } }, select: { id: true, titleFr: true } })
        cands = large.filter((c) => { const t = dateEnTeteDuTitre(c.titleFr); return t && t.iso === d.iso && t.nature === d.nature })
      }
      // (c) — la date de PUBLICATION — a été RETIRÉE : elle appariait « Loi du 18 septembre
      // 1947 sur les loyers » à une loi du 13 septembre publiée le 18. Un titre sans date en
      // tête ne se résout pas ; il attend.
      // Contrôle de l'OBJET sur chaque candidat retenu par la date.
      const verdicts = cands.map((c) => ({ c, v: objetConcorde(objets, c.titleFr) }))
      const objetNon = verdicts.filter((x) => x.v === 'non')
      cands = verdicts.filter((x) => x.v !== 'non').map((x) => x.c)
      if (!cands.length && objetNon.length) { attente.set(cible, { n: rs.length, libelle, motif: `même date, OBJET ≠ : ${objetNon.map((x) => x.c.titleFr.slice(0, 45)).join(' | ')}` }); continue }
      const parDateSeule = cands.length === 1 && verdicts.find((x) => x.c === cands[0])?.v === 'date-seule'
      if (cands.length === 1) {
        const documentId = cands[0].id
        if (!ancresCache.has(documentId)) ancresCache.set(documentId, await ancresDe(documentId))
        const ancres = ancresCache.get(documentId)!
        const parAncre = new Map<string, string[]>()
        for (const r of rs) {
          const anchor = r.article ? anchorFromDesignation(r.article) : null
          const key = anchor && ancres.has(anchor) ? anchor : ''
          if (anchor && !ancres.has(anchor)) sansAncre++
          parAncre.set(key, [...(parAncre.get(key) ?? []), r.id])
        }
        for (const [anchor, ids] of parAncre) majs.push({ ids, documentId, anchor: anchor || null })
        resolus.set(`${cible} → « ${cands[0].titleFr.slice(0, 60)} »${parDateSeule ? '   ⚠️ par date seule' : ''}`, rs.length)
      } else if (cands.length > 1) {
        ambigus += rs.length
        attente.set(cible, { n: rs.length, libelle, motif: `AMBIGU : ${cands.map((c) => c.titleFr.slice(0, 40)).join(' | ')}` })
      } else attente.set(cible, { n: rs.length, libelle, motif: 'absent du corpus' })
      continue
    }
    attente.set(cible, { n: rs.length, libelle, motif: 'clé sans résolution automatique' })
  }

  console.log('\n── RÉSOLUS ──')
  for (const [k, n] of [...resolus].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${k}`)
  console.log(`  (dont ${sansAncre} vers un texte présent mais un article introuvable — documentId posé, anchor NULL)`)
  console.log('\n── EN ATTENTE — la file de versement, par nombre d’extraits ──')
  for (const [k, v] of [...attente].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${String(v.n).padStart(5)}  ${k.padEnd(28)} ${v.libelle.slice(0, 60).padEnd(62)} ${v.motif}`)
  if (ambigus) console.log(`\n⚠️ ${ambigus} renvoi(s) ambigus — 0 résolution`)

  if (!APPLY) { console.log('\n(Simulation — relancer avec --apply pour écrire.)'); return }
  let n = 0
  for (const m of majs) { await prisma.jurisExtraitRef.updateMany({ where: { id: { in: m.ids } }, data: { documentId: m.documentId, anchor: m.anchor, resoluLe: new Date() } }); n += m.ids.length }
  console.log(`\n✅ ${n} renvoi(s) résolus. Relecture : résolus en base = ${await prisma.jurisExtraitRef.count({ where: { documentId: { not: null } } })} · avec ancre = ${await prisma.jurisExtraitRef.count({ where: { anchor: { not: null } } })} · en attente = ${await prisma.jurisExtraitRef.count({ where: { documentId: null } })}`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
