/**
 * RAEJH — PROJETER LES EXTRAITS DU RÉPERTOIRE SOUS LES ARTICLES DES CODES QU'ILS CITENT.
 *
 *     SEARCH_PROVIDER=fts npx tsx scripts/projeter-extraits-dans-codes.ts            # simulation
 *     SEARCH_PROVIDER=fts npx tsx scripts/projeter-extraits-dans-codes.ts --apply    # écrit
 *
 * REJOUABLE, À REJOUER APRÈS CHAQUE PASSAGE DU RÉSOLVEUR : la table `JurisExtraitRef` est la
 * SOURCE ; le champ `annotations.jurisprudence[clé] = [{ ref, excerpt }]` de chaque code est
 * une PROJECTION — le canal que `AnnotatedText` lit déjà pour le pliable « Jurisprudence »
 * sous chaque article. Les entrées projetées portent `raejh: true` : chaque passage les
 * retire toutes puis les repose depuis la table. Les entrées HÉRITÉES (286 sur le Code du
 * travail, 1 287 sur le CPC, 1 205 sur le Code civil, 21 sur le Code de commerce — les notes
 * des éditions annotées elles-mêmes) ne sont JAMAIS touchées : sentinelle, compte avant =
 * compte après.
 *
 * ─── POURQUOI UNE PROJECTION ET PAS UNE LECTURE DIRECTE ─────────────────────────────────────
 * Le lecteur (`AnnotatedText.tsx`) et son modèle (`annotated.ts`) appartiennent à une session
 * parallèle. Le canal existe, les sept codes le rendent : l'alimenter depuis la table livre le
 * pliable d'article aujourd'hui, sans toucher au lecteur. Le jour où le lecteur lira la table
 * par `(cible, article)`, cette projection deviendra inutile — et se retirera d'un passage.
 *
 * ─── LES CLÉS ───────────────────────────────────────────────────────────────────────────────
 * ⚠️ `jurisKey = <section>|<ancre>` — calculé par `segmentAnnotated` sur le corps et le toc du
 * code, EXACTEMENT comme le lecteur. On ne fabrique pas la clé : on la lit sur le bloc. Une
 * ancre résolue qui ne trouve pas son bloc est rapportée, jamais posée sous une clé devinée.
 *
 * ─── CE QUI N'EST PAS PROJETÉ ──────────────────────────────────────────────────────────────
 * · les renvois POSTÉRIEURS à l'arrêt — annotation de l'éditeur, non visa de la Cour : sous
 *   l'article, on ne montre que ce que la Cour a appliqué ;
 * · un extrait dont le même arrêt (même date, un nom propre commun) figure déjà sous la même
 *   clé parmi les entrées héritées — les 249 de Salès que le Code du travail portait déjà ;
 * · un renvoi résolu sans ancre (texte présent, article absent).
 */
import { PrismaClient } from '@prisma/client'
import { parseAnnotations, segmentAnnotated } from '../src/lib/legislation/annotated'
import { CIBLES_DIRECTES } from '../src/lib/jurisprudence/cibles'

const APPLY = process.argv.includes('--apply')
const prisma = new PrismaClient()
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const dateFr = (d: Date) => `${d.getUTCDate() === 1 ? '1er' : d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
const CREUX = new Set(['compagnie', 'societe', 'sieur', 'sieurs', 'dame', 'dames', 'consorts', 'pourvoi', 'ministere', 'public', 'epoux', 'veuve', 'haytian', 'haitian', 'hasco', 'american', 'sugar', 'company', 'section', 'arret', 'premiere', 'deuxieme', 'reunies', 'sections'])
const noms = (s: string) => new Set(fold(s).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((t) => t.length >= 5 && !CREUX.has(t)))
const dateDe = (s: string) => { const m = /(\d{1,2})(?:er)?\s+([a-zéû]+)\s+(\d{4})/i.exec(s); return m ? `${m[3]}-${fold(m[2])}-${m[1].padStart(2, '0')}` : null }

type Cas = { ref: string; excerpt: string; raejh?: boolean }

async function main() {
  const sources = [...new Set(Object.values(CIBLES_DIRECTES).map((c) => c.source))]
  console.log(`\n══ PROJECTION ${APPLY ? '(ÉCRITURE)' : '(simulation)'} — ${sources.length} codes ══`)
  const aReindexer: string[] = []
  for (const source of sources) {
    const doc = await prisma.document.findFirst({ where: { source }, select: { id: true, bodyOriginal: true, annotationsJson: true } })
    if (!doc?.annotationsJson) { console.log(`  ${source.padEnd(28)} — sans annotations, sauté`); continue }
    const raw = JSON.parse(String(doc.annotationsJson))
    const ann = parseAnnotations(String(doc.annotationsJson))
    if (!ann) { console.log(`  ${source.padEnd(28)} — annotations illisibles, sauté`); continue }
    // clés du lecteur : ancre → jurisKey, lues sur les blocs
    const cleParAncre = new Map<string, string>()
    for (const b of segmentAnnotated(doc.bodyOriginal, ann.toc, ann.pointAnchors)) if (b.kind === 'body' && b.anchor && b.jurisKey && !b.noAnchors && !cleParAncre.has(b.anchor)) cleParAncre.set(b.anchor, b.jurisKey)

    // entrées héritées = tout ce qui n'est pas marqué raejh
    const juris: Record<string, Cas[]> = raw.jurisprudence ?? {}
    const herite: Record<string, Cas[]> = {}
    let nHerite = 0, nRetire = 0
    for (const [k, arr] of Object.entries(juris)) {
      const h = (arr ?? []).filter((c) => !c.raejh)
      nRetire += (arr ?? []).length - h.length
      if (h.length) { herite[k] = h; nHerite += h.length }
    }

    // renvois résolus vers ce code, avec ancre, non postérieurs
    const refs = await prisma.jurisExtraitRef.findMany({
      where: { documentId: doc.id, anchor: { not: null }, posterieur: false },
      select: { anchor: true, article: true, extrait: { select: { id: true, texte: true, decision: { select: { titleFr: true, chambre: true, publicationDate: true } } } } },
    })
    const projete: Record<string, Cas[]> = {}
    let poses = 0, sansBloc = 0, doublonsHerites = 0, doublonsInternes = 0
    const vus = new Set<string>()
    for (const r of refs) {
      const cle = cleParAncre.get(r.anchor!)
      if (!cle) { sansBloc++; continue }
      const d = r.extrait.decision
      const ref = `Arrêt du ${d.publicationDate ? dateFr(d.publicationDate) : '?'}, ${d.chambre ?? 'formation non précisée'}, ${d.titleFr}`
      const sig = `${cle}|${r.extrait.id}`
      if (vus.has(sig)) { doublonsInternes++; continue } // le même extrait cite deux fois le même article
      vus.add(sig)
      const dIso = d.publicationDate?.toISOString().slice(0, 10)
      const nomsRef = noms(d.titleFr)
      const dejaHerite = (herite[cle] ?? []).some((h) => {
        const hd = dateDe(h.ref)
        if (!hd || !dIso) return false
        const [y, mo, da] = dIso.split('-'); const mois = MOIS[Number(mo) - 1]
        if (hd !== `${y}-${fold(mois)}-${da}`) return false
        const hn = noms(h.ref)
        for (const n of nomsRef) if (hn.has(n)) return true
        return false
      })
      if (dejaHerite) { doublonsHerites++; continue }
      projete[cle] = [...(projete[cle] ?? []), { ref, excerpt: r.extrait.texte, raejh: true }]
      poses++
    }
    // fusion : héritées d'abord, projetées ensuite
    const fusion: Record<string, Cas[]> = {}
    for (const k of new Set([...Object.keys(herite), ...Object.keys(projete)])) fusion[k] = [...(herite[k] ?? []), ...(projete[k] ?? [])]
    const nApres = Object.values(fusion).flat().filter((c) => !c.raejh).length
    if (nApres !== nHerite) { console.error(`⛔ ${source} : entrées héritées ${nHerite} → ${nApres}`); process.exit(1) }
    console.log(`  ${source.padEnd(28)} héritées ${String(nHerite).padStart(5)} (intactes) · retirées ${String(nRetire).padStart(4)} (ancienne projection) · posées ${String(poses).padStart(4)} sur ${Object.keys(projete).length} articles · doublons hérités ${doublonsHerites} · internes ${doublonsInternes} · sans bloc ${sansBloc}`)
    if (APPLY) {
      await prisma.document.update({ where: { id: doc.id }, data: { annotationsJson: JSON.stringify({ ...raw, jurisprudence: fusion }) } })
      aReindexer.push(doc.id)
    }
  }
  if (!APPLY) { console.log('\n(Simulation — relancer avec --apply pour écrire.)'); return }
  const { reindexDocument } = await import('../src/lib/search/reindex')
  for (const id of aReindexer) await reindexDocument(id)
  console.log(`\n✅ ${aReindexer.length} codes mis à jour et réindexés.`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
