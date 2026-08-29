/**
 * Garde de segmentation du corpus MARCHÉS PUBLICS — tâche 2 (§ 8.4).
 *
 * Vérifie les fiches `scripts/data/marches-publics/prep-*.json` avec les fonctions
 * RÉELLES de la plateforme (`segmentAnnotated`, `articleAnchorFromHeading`,
 * `parseAnnotations`) : les gardes du parseur Python ne valent que si elles disent la
 * même chose que le code qui rendra la page.
 *
 * Par texte, quatre assertions :
 *   1. secs === toc.length        — chaque entrée de sommaire s'apparie, dans l'ordre ;
 *   2. join === corps             — segmentAnnotated ne perd pas un caractère ;
 *   3. ancres === labels          — toute ancre émise a son libellé, et réciproquement ;
 *   4. aucune ancre dupliquée     — zéro id HTML en double.
 * Plus : aucun renvoi de `navToc` vers une ancre absente du `toc`, et `parseAnnotations`
 * relit sans perte l'objet qui sera stocké dans `Document.annotationsJson`.
 *
 * LECTURE SEULE : ne touche ni la base ni le réseau.
 *   npx tsx scripts/verif-lecteur-marches.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { segmentAnnotated, parseAnnotations, type Annotations, type TocEntry, type NavGroup } from '../src/lib/legislation/annotated'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'

const DIR = path.join(__dirname, 'data', 'marches-publics')

type Fiche = {
  id: string
  slug: string
  titre_provisoire: string
  toc: (TocEntry & { ligne_source: number })[]
  labels: Record<string, string>
  navToc: NavGroup[]
  comptes: Record<string, number>
}

let echecs = 0
const lignes: string[] = []

const fichiers = fs
  .readdirSync(DIR)
  .filter((f) => /^prep-\d\d-.*\.json$/.test(f) && !f.endsWith('-confrontation-tdm.json'))
  .sort()

for (const f of fichiers) {
  const fiche = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as Fiche
  const corps = fs.readFileSync(path.join(DIR, f.replace(/\.json$/, '-corps.txt')), 'utf8')
  const toc: TocEntry[] = fiche.toc.map((e) => ({ level: e.level, label: e.label, anchor: e.anchor, kind: e.kind }))

  const blocks = segmentAnnotated(corps, toc)

  // 1. toutes les entrées du sommaire appariées, dans l'ordre
  const secs = blocks.filter((b) => b.kind === 'section')
  const secsOk = secs.length === toc.length && secs.every((b, i) => b.anchor === toc[i].anchor)

  // 2. aucune perte de caractère
  const joinOk = blocks.map((b) => b.text).join('\n') === corps

  // 3. ancres réellement émises (un bloc `noAnchors` ne pose pas d'id) ↔ labels
  const emises = blocks
    .filter((b): b is Extract<typeof b, { kind: 'body' }> => b.kind === 'body')
    .filter((b) => b.anchor && !b.noAnchors)
    .map((b) => b.anchor as string)
  const cles = Object.keys(fiche.labels).sort()
  const ancresOk = JSON.stringify([...new Set(emises)].sort()) === JSON.stringify(cles)

  // 4. aucune ancre dupliquée
  const dupOk = emises.length === new Set(emises).size

  // 5. les ancres de navToc existent dans le toc
  const ancresToc = new Set(toc.map((e) => e.anchor))
  const navAncres: string[] = []
  for (const g of fiche.navToc) {
    navAncres.push(g.anchor)
    for (const c of g.children ?? []) {
      navAncres.push(c.anchor)
      for (const p of c.children ?? []) navAncres.push(p.anchor)
    }
  }
  const navOk = navAncres.every((a) => ancresToc.has(a))
  const navComplet = navAncres.length === toc.length

  // 6. relecture par parseAnnotations (liste blanche du rendu serveur)
  const ann: Annotations = {
    title: fiche.titre_provisoire,
    annotationAuthor: '',
    navToc: fiche.navToc,
    toc,
    connexes: [],
    jurisprudence: {},
    indexEntries: [],
    labels: fiche.labels,
  }
  const relu = parseAnnotations(JSON.stringify(ann))
  const parseOk =
    !!relu &&
    relu.toc.length === toc.length &&
    Object.keys(relu.labels ?? {}).length === cles.length &&
    relu.navToc.length === fiche.navToc.length

  // 7. toute tête d'article du corps est soit ancrée, soit dans une annexe/en doublon
  let tetes = 0
  for (const l of corps.split('\n')) if (articleAnchorFromHeading(l.trim())) tetes++
  const tetesHorsToc = tetes - toc.filter((e) => articleAnchorFromHeading(e.label)).length

  const ok = secsOk && joinOk && ancresOk && dupOk && navOk && parseOk
  if (!ok) echecs++
  const ko: string[] = []
  if (!secsOk) ko.push('secs≠toc')
  if (!joinOk) ko.push('join≠corps')
  if (!ancresOk) ko.push('ancres≠labels')
  if (!dupOk) ko.push('ancre dupliquée')
  if (!navOk) ko.push('navToc→ancre absente')
  if (!parseOk) ko.push('parseAnnotations')
  lignes.push(
    `${fiche.id}  ${fiche.slug.padEnd(38)} toc=${String(toc.length).padStart(3)} ` +
      `labels=${String(cles.length).padStart(3)} ancres=${String(new Set(emises).size).padStart(3)} ` +
      `têtes=${String(tetesHorsToc).padStart(3)} nav=${String(navAncres.length).padStart(3)}` +
      `${navComplet ? '' : '*'}  ${ok ? 'OK' : 'ÉCHEC ' + ko.join(', ')}`,
  )
}

console.log('Garde de segmentation — corpus marchés publics (lecture seule)\n')
console.log(lignes.join('\n'))
console.log(
  `\n${fichiers.length} textes vérifiés · ${echecs} échec(s).` +
    `\n« têtes » = têtes d'article reconnues dans le corps hors libellés de sommaire ; ` +
    `l'écart avec « ancres » est le nombre de têtes d'annexe sanctionnée (kind connexe) ` +
    `ou de numéros déjà pris — aucune ne produit d'id dupliqué.` +
    `\n* navToc ne reprend pas toutes les entrées du toc (niveaux 4 repliés sous leur parent).`,
)
if (echecs > 0) process.exit(1)
