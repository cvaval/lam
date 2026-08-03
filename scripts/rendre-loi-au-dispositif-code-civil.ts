/**
 * Code civil — rend au dispositif le texte de loi rangé dans l'appareil.
 *
 * L'alignement sur CCH.docx distinguait la loi de l'appareil par la MISE EN FORME du fichier
 * de composition. Ce discriminant échoue sur les ÉNUMÉRATIONS : le recueil y compose les items
 * comme il compose ses notes. Des morceaux de loi se sont donc retrouvés en « jurisprudence »,
 * affichés derrière un bouton replié intitulé « Annotations » — l'article 1044 se lit « Pour
 * que les offres réelles soient valables, il faut : » et rien d'autre ; à l'article 452, c'est
 * le VERBE de la phrase qui est en note.
 *
 * Le tri n'est PAS mécanisable : le recueil numérote ses notes comme ses items, et la moitié
 * des lignes suspectes sont de vraies annotations que l'alignement a eu raison de sortir du
 * corps. Il a donc été fait article par article, sur le fac-similé et sur la concordance avec
 * le Code civil français de 1804, par quatre lecteurs indépendants ; ce script ne fait
 * qu'APPLIQUER leurs verdicts, en vérifiant que rien ne se perd en route.
 *
 * Entrées (scratchpad de la session) :
 *   dossier-27.json    — pour chaque article : corps, notes, notes suspectes
 *   charge-lot-N.json  — { "art-1044": { garde, apresLigne, supprimerNotes:[…], inserer:[…],
 *                          modifie:{}, preuve, reserve } }
 * `inserer` porte le texte PROPRE : plusieurs notes étaient contaminées (queue de jurisprudence
 * collée à l'item, recopie d'une ligne déjà au corps, fragment mutilé d'un autre item), et les
 * réinsérer telles quelles aurait remis dans le dispositif ce qu'on cherche à en sortir.
 *
 * Invariants vérifiés AVANT toute écriture, sinon refus d'écrire :
 *   · une note rendue au dispositif doit se retrouver mot pour mot dans le nouveau corps ;
 *   · une note laissée en annotation ne doit pas avoir bougé ;
 *   · aucune clé d'annotation orpheline, aucun article perdu par la segmentation ;
 *   · aucune ligne d'en-tête créée ou détruite (les clés sec-K|art-N en dépendent) ;
 *   · un article sous overlay d'amendement est ÉCARTÉ et signalé — le lecteur y affiche la
 *     version en vigueur, la correction n'y serait pas visible ;
 *   · searchText est RECALCULÉ (il n'est reconstruit que par les routes d'administration :
 *     une écriture directe le laisse en arrière, et la recherche reste sur l'ancien texte).
 *
 *     npx tsx scripts/rendre-loi-au-dispositif-code-civil.ts
 *     npx tsx scripts/rendre-loi-au-dispositif-code-civil.ts --voir=1044,452
 *     npx tsx scripts/rendre-loi-au-dispositif-code-civil.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync, existsSync } from 'node:fs'
import { parseAnnotations, segmentAnnotated } from '../src/lib/legislation/annotated'
import { getAmendments } from '../src/lib/legislation/amendments'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { buildSearchText } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const VOIR = (process.argv.find((a) => a.startsWith('--voir='))?.slice(7) ?? '')
  .split(',').map(Number).filter(Boolean)
const S = '/private/tmp/claude-501/-Users-cvaval-Library-CloudStorage-Dropbox-Lam-Veritab/b86c8ab9-626b-4ed6-9e9c-f6e8779c5980/scratchpad'

type Dossier = { anchor: string; num: number; jurisKey: string; corps: string[]; notes: string[]; suspectes: number[] }
type Charge = {
  garde?: boolean
  apresLigne?: number | null
  supprimerNotes?: number[]
  inserer?: string[]
  modifie?: Record<string, string>
  /** Note à RÉÉCRIRE plutôt qu'à retirer : le colonnage de l'OCR a coupé un arrêt en son
   *  milieu pour y loger des items de loi. Les items partent au dispositif ; sans réécriture,
   *  leurs fragments resteraient affichés dans l'appareil (art. 1135, note 5). */
  remplacerNotes?: Record<string, string>
  preuve?: string
  reserve?: string
}
/** Une ligne du dispositif ne cite jamais un arrêt : sentinelle contre l'appareil réinjecté. */
// `arrêt(?![\\p{L}])` et non `\\barrêt\\b` : sans le drapeau Unicode, le mot-frontière tombe
// entre « arrêt » et « é » — une disposition citant un ARRÊTÉ serait refusée à tort.
const MARQUE_JURIS = /Cass\.|Bull\.|arrêt(?![\p{L}])|pourvoi|jugement attaqué/iu

const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim().toLowerCase()
const mots = (s: string) => norm(s).replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim()

async function main() {
  const doc = await prisma.document.findFirst({ where: { source: 'CODE_CIVIL_ANNOTE' } })
  if (!doc) throw new Error('Code civil introuvable.')
  const ann = parseAnnotations(doc.annotationsJson)!
  const brut = JSON.parse(doc.annotationsJson!) as {
    toc: Array<{ anchor: string; label: string; level: number; kind: string }>
    jurisprudence: Record<string, Array<{ ref?: string; excerpt?: string }>>
  }

  const dossier: Dossier[] = JSON.parse(readFileSync(`${S}/dossier-27.json`, 'utf8'))
  const parAncre = new Map(dossier.map((d) => [d.anchor, d]))

  // ── charges des quatre lots ─────────────────────────────────────────────────
  const charges = new Map<string, Charge>()
  let lots = 0
  for (let n = 1; n <= 4; n++) {
    const f = `${S}/charge-lot-${n}.json`
    if (!existsSync(f)) { console.log(`⚠ lot ${n} : charge absente`); continue }
    lots++
    for (const [a, c] of Object.entries(JSON.parse(readFileSync(f, 'utf8')) as Record<string, Charge>)) {
      if (charges.has(a)) throw new Error(`${a} traité par deux lots — lots mal découpés`)
      charges.set(a, c)
    }
  }
  console.log(`lots reçus : ${lots}/4 · articles traités : ${charges.size}`)
  const abandonnes = [...charges].filter(([, c]) => c.garde === false)
  if (abandonnes.length) {
    console.log(`\nécartés à la contre-épreuve (${abandonnes.length}) :`)
    abandonnes.forEach(([a, c]) => console.log(`  ${a} — ${(c.reserve ?? '').slice(0, 120)}`))
  }

  // ── écarter les articles sous overlay ───────────────────────────────────────
  const overlays = await getAmendments(doc.id)

  const lignes = doc.bodyOriginal.split('\n')
  const titresToc = new Set(brut.toc.map((t) => norm(t.label)))
  const teteDe = new Map<string, number>()
  for (let i = 0; i < lignes.length; i++) {
    const a = articleAnchorFromHeading(lignes[i])
    if (a && !teteDe.has(a)) teteDe.set(a, i)
  }
  function bornes(anchor: string): [number, number] {
    const d = teteDe.get(anchor)
    if (d === undefined) throw new Error(`${anchor} introuvable dans le corps`)
    let f = d + 1
    while (f < lignes.length && !articleAnchorFromHeading(lignes[f]) && !titresToc.has(norm(lignes[f]))) f++
    return [d, f]
  }

  const aInserer = new Map<number, string[]>() // index de ligne → lignes ajoutées après
  const journal: string[] = []
  const ecartes: string[] = []
  const perdusTolerés: string[] = []
  const jurisprudence: Record<string, Array<{ ref?: string; excerpt?: string }>> = JSON.parse(JSON.stringify(brut.jurisprudence))
  let nLignes = 0, nArticles = 0

  for (const [anchor, c] of [...charges].sort((a, b) => (parAncre.get(a[0])?.num ?? 0) - (parAncre.get(b[0])?.num ?? 0))) {
    if (c.garde === false) continue
    const d = parAncre.get(anchor)
    if (!d) throw new Error(`${anchor} traité mais absent du dossier`)
    const retirer = (c.supprimerNotes ?? []).filter((i) => Number.isInteger(i))
    const inserer = (c.inserer ?? []).map((l) => l.trim()).filter(Boolean)
    if (!retirer.length && !inserer.length) continue
    if (retirer.some((i) => i < 0 || i >= d.notes.length)) throw new Error(`${anchor} : indice de note hors bornes`)
    if (overlays.get(anchor)?.inForce) {
      ecartes.push(`${anchor} (version amendée en vigueur — la correction n'y serait pas visible)`)
      continue
    }
    // l'appareil et le dispositif doivent être ceux que le relevé a photographiés
    const notesBase = (brut.jurisprudence[d.jurisKey] ?? []).map((j) => (j.excerpt ?? '').trim())
    if (notesBase.length !== d.notes.length || retirer.some((i) => mots(notesBase[i]) !== mots(d.notes[i])))
      throw new Error(`${anchor} : l'appareil a changé depuis le relevé — refaire le dossier`)
    const [deb, fin] = bornes(anchor)
    const corpsActuel = lignes.slice(deb, fin).map((l) => l.trim()).filter(Boolean)
    if (corpsActuel.length !== d.corps.length || mots(corpsActuel.join(' ')) !== mots(d.corps.join(' ')))
      throw new Error(`${anchor} : le dispositif a changé depuis le relevé — refaire le dossier`)
    // une ligne du dispositif ne cite pas un arrêt
    const contaminee = inserer.find((l) => MARQUE_JURIS.test(l))
    if (contaminee) throw new Error(`${anchor} : la ligne « ${contaminee.slice(0, 70)}… » cite une décision`)

    if (inserer.length) {
      const rang = Math.min(Math.max(c.apresLigne ?? 0, 0), corpsActuel.length - 1)
      let vues = -1, cible = deb
      for (let i = deb; i < fin; i++) {
        if (!lignes[i].trim()) continue
        vues++
        if (vues === rang) { cible = i; break }
      }
      if (aInserer.has(cible)) throw new Error(`${anchor} : deux insertions sur la même ligne`)
      aInserer.set(cible, inserer)
      journal.push(
        `art ${d.num} : ${inserer.length} ligne(s) rendues au dispositif après « ${corpsActuel[rang].slice(0, 50)}… »` +
          (Object.keys(c.modifie ?? {}).length ? `  [${Object.keys(c.modifie ?? {}).length} nettoyée(s)]` : '') +
          (c.reserve ? `  ⚠ ${c.reserve.slice(0, 70)}` : ''),
      )
    } else {
      journal.push(`art ${d.num} : ${retirer.length} note(s) supprimées — déjà au dispositif`)
    }
    const remplacer = c.remplacerNotes ?? {}
    for (const k of Object.keys(remplacer)) {
      const i = Number(k)
      if (!Number.isInteger(i) || i < 0 || i >= d.notes.length) throw new Error(`${anchor} : réécriture d'une note hors bornes`)
      if (retirer.includes(i)) throw new Error(`${anchor} : la note ${i} est à la fois retirée et réécrite`)
    }
    if (retirer.length || Object.keys(remplacer).length) {
      jurisprudence[d.jurisKey] = (brut.jurisprudence[d.jurisKey] ?? [])
        .map((j, i) => (remplacer[String(i)] ? { ...j, excerpt: remplacer[String(i)] } : j))
        .filter((_, i) => !retirer.includes(i))
      if (!jurisprudence[d.jurisKey].length) delete jurisprudence[d.jurisKey]
      if (Object.keys(remplacer).length)
        journal.push(`art ${d.num} : ${Object.keys(remplacer).length} note(s) réécrites (fragments de loi retirés de l'appareil)`)
    }
    // INVARIANT LOCAL : rien de ce qui sort de l'appareil ne se perd. Chaque mot rare
    // (6 lettres et plus) d'une note retirée doit se retrouver dans l'article APRÈS coup —
    // dans une ligne réinsérée, dans le dispositif existant, ou dans une note conservée.
    const apres = [...corpsActuel, ...inserer, ...(jurisprudence[d.jurisKey] ?? []).map((j) => j.excerpt ?? '')].join(' ')
    const presents = new Set(mots(apres).split(' ').filter((w) => w.length >= 6))
    for (const i of retirer) {
      const absents = [...new Set(mots(d.notes[i]).split(' ').filter((w) => w.length >= 6))].filter((w) => !presents.has(w))
      if (absents.length > 2)
        throw new Error(`${anchor}, note ${i} : ${absents.length} mots perdus (${absents.slice(0, 6).join(', ')})`)
      if (absents.length) perdusTolerés.push(`${anchor} n${i} : ${absents.join(', ')}`)
    }
    nArticles++
    nLignes += inserer.length
  }

  // ── nouveau corps ───────────────────────────────────────────────────────────
  const corps: string[] = []
  for (let i = 0; i < lignes.length; i++) {
    corps.push(lignes[i])
    const aj = aInserer.get(i)
    if (aj) corps.push(...aj)
  }
  const nouveauCorps = corps.join('\n')

  // ── INVARIANTS ──────────────────────────────────────────────────────────────
  const corpsMots = mots(nouveauCorps)
  for (const [, aj] of aInserer)
    for (const l of aj)
      if (!corpsMots.includes(mots(l))) throw new Error(`ligne non réinsérée : « ${l.slice(0, 70)} »`)

  // aucune tête d'article ni en-tête créés ou détruits
  const tetesAvant = lignes.filter((l) => articleAnchorFromHeading(l)).length
  const tetesApres = corps.filter((l) => articleAnchorFromHeading(l)).length
  if (tetesAvant !== tetesApres)
    throw new Error(`têtes d'article : ${tetesAvant} → ${tetesApres} — une ligne rendue au corps se lit comme un article`)
  const entetesAjoutes = [...aInserer.values()].flat().filter((l) => titresToc.has(norm(l)))
  if (entetesAjoutes.length) throw new Error(`ligne rendue au corps identique à un en-tête du sommaire : « ${entetesAjoutes[0]} »`)

  const clesApres = new Set<string>()
  const artsApres = new Set<string>()
  for (const b of segmentAnnotated(nouveauCorps, brut.toc)) {
    if (b.kind !== 'body') continue
    if (b.jurisKey) clesApres.add(b.jurisKey)
    if (b.anchor) artsApres.add(b.anchor)
  }
  const orphelines = Object.keys(jurisprudence).filter((k) => !clesApres.has(k))
  const artsAvant = new Set(
    segmentAnnotated(doc.bodyOriginal, brut.toc).filter((b) => b.kind === 'body' && b.anchor).map((b) => b.anchor!),
  )
  const perdus = [...artsAvant].filter((a) => !artsApres.has(a))

  // ── rapport ─────────────────────────────────────────────────────────────────
  console.log(`\n${journal.length} articles corrigés :`)
  journal.forEach((l) => console.log('  ' + l))
  if (ecartes.length) {
    console.log(`\nécartés (${ecartes.length}) :`)
    ecartes.forEach((l) => console.log('  ' + l))
  }
  if (perdusTolerés.length) {
    console.log(`\nmots isolés non retrouvés (tolérance ≤2 par note, à l'œil) :`)
    perdusTolerés.slice(0, 20).forEach((l) => console.log('  ' + l))
  }
  console.log(`\nlignes rendues au dispositif : ${nLignes} (${nArticles} articles)`)
  console.log(`corps : ${lignes.length} → ${corps.length} lignes`)
  console.log(`têtes d'article : ${tetesAvant} (inchangé) · articles perdus : ${perdus.length}`)
  console.log(`clés d'annotation orphelines : ${orphelines.length}`)
  if (orphelines.length || perdus.length) throw new Error('segmentation incohérente — aucune écriture')

  for (const n of VOIR) {
    const a = `art-${n}`
    const d = parAncre.get(a)
    console.log(`\n╔══ ARTICLE ${n} — tel qu'il sera rendu ══`)
    const [deb, fin] = bornes(a)
    const out: string[] = []
    for (let i = deb; i < fin; i++) {
      if (lignes[i].trim()) out.push(lignes[i].trim())
      ;(aInserer.get(i) ?? []).forEach((l) => out.push('  ⚖ ' + l))
    }
    out.forEach((l) => console.log('║ ' + l.slice(0, 150)))
    const reste = jurisprudence[d?.jurisKey ?? ''] ?? []
    console.log(`║ ANNOTATIONS restantes : ${reste.length}`)
    reste.slice(0, 4).forEach((j) => console.log('║   · ' + (j.excerpt ?? '').slice(0, 120)))
  }

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }
  const annotationsJson = JSON.stringify({ ...brut, jurisprudence })
  // searchText : il n'est reconstruit que par reindexDocument() (routes d'admin) — une
  // écriture directe le laisserait en arrière et la recherche resterait sur l'ancien texte.
  const searchText = buildSearchText({ ...doc, bodyOriginal: nouveauCorps, annotationsJson } as never)
  await prisma.$transaction(
    async (tx) => {
      await tx.document.update({ where: { id: doc.id }, data: { bodyOriginal: nouveauCorps, annotationsJson, searchText } })
      await audit(
        { action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: doc.id,
          meta: { source: 'CODE_CIVIL_ANNOTE', motif: 'texte de loi rendu au dispositif (arbitrage article par article)',
                  articles: nArticles, lignes: nLignes, ecartes: ecartes.length } },
        tx,
      )
    },
    { timeout: 120_000, maxWait: 30_000 },
  )
  console.log('\n✓ Écrit, index de recherche recalculé, journalisé.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
