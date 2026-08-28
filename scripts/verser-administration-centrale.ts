/**
 * Verse le Décret du 17 mai 2005 sur l'Administration Centrale de l'État et son amendement
 * du 6 janvier 2016.
 *
 *   npx tsx scripts/verser-administration-centrale.ts [--commit]
 *
 * Cf. docs/prompt-decret-administration-centrale-2005.md.
 *
 * ⚠️ TROIS CONVENTIONS DE NUMÉROTATION DANS UN SEUL TEXTE : 174 articles entiers, 37
 * DÉCIMAUX (19.1, 26.1 à 26.6, 140.1 à 140.6…) et 5 À TIRET (163-1 à 163-3, 169-1, 169-2).
 * Un analyseur qui ne connaît que N et N.M lit « Article 163-1 » comme une seconde tête de
 * l'article 163 : cinq articles disparaissent et le 163 hérite d'un corps étranger. Un
 * premier comptage a d'ailleurs annoncé « 17 doublons » — c'était cet artefact.
 *
 * ⚠️ ET LE FICHIER NE S'ARRÊTE PAS AU DÉCRET : après les signatures viennent l'adresse des
 * Presses Nationales et le dépôt légal.
 */
import { execFileSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { buildSearchText, fold } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const DL = '/Users/cvaval/Downloads'

/** Les TROIS formes : entière, décimale, à tiret. */
const TETE = /^Article\s+(\d+(?:er)?(?:[.-]\d+)?)\s*\.?\s*[—–-]/
/** Colophon de fin de fascicule — jamais du décret. */
const COLOPHON = /Presses Nationales|Dépôt Légal|Boîte Postale|ISSN/i

interface T {
  source: string; titre: string; fichier: string; debut: number; articles: number
  adoption: string; publication: string; moniteurRef: string; themes: string[]
}

const TEXTES: T[] = [
  {
    source: 'DECRET_ADMIN_CENTRALE_2005',
    titre: "Décret du 17 mai 2005 portant organisation de l'Administration Centrale de l'État",
    fichier: 'Decret_Administration_Centrale_Etat_2005.docx',
    debut: 44, articles: 216,
    adoption: '2005-05-17', publication: '2005-09-27',
    moniteurRef: 'Le Moniteur, 160ᵉ Année, Spécial n° 8, mardi 27 septembre 2005',
    themes: ['administration-centrale', 'droit-public'],
  },
  {
    source: 'DECRET_ADMIN_CENTRALE_AMEND_2016',
    // ⚠️ TITRE COMPLET, ET C'EST VITAL : un « Décret du 6 janvier 2016 » existe DÉJÀ en base
    // — celui sur l'administration électronique, Moniteur n° 20 du 29 janvier. Deux décrets
    // signés le même jour, publiés dans deux numéros consécutifs. Seul le titre les sépare.
    titre: "Décret du 6 janvier 2016 portant amendement du Décret du 17 mai 2005 portant organisation de l'Administration Centrale de l'État",
    fichier: 'Decret_6_janvier_2016_amendement_Administration_Centrale_Etat.docx',
    debut: 16, articles: 3,
    adoption: '2016-01-06', publication: '2016-02-01',
    moniteurRef: 'Le Moniteur, 171ᵉ Année, n° 21, lundi 1ᵉʳ février 2016',
    themes: ['administration-centrale', 'droit-public'],
  },
]

function lignes(f: string): string[] {
  const xml = execFileSync('unzip', ['-p', `${DL}/${f}`, 'word/document.xml'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return xml.replace(/<w:tab\/>/g, ' ').replace(/<\/w:p>|<w:br\/>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .split('\n').map((l) => l.trim()).filter(Boolean)
}

function extraire(t: T) {
  const L = lignes(t.fichier)
  const fin = L.findIndex((l, i) => i > t.debut && COLOPHON.test(l))
  const seg = L.slice(t.debut, fin < 0 ? L.length : fin)
  const arts = seg.map((l) => TETE.exec(l)?.[1]).filter(Boolean) as string[]
  return { corps: seg.join('\n'), arts }
}

async function main() {
  const commit = process.argv.includes('--commit')
  console.log('ADMINISTRATION CENTRALE DE L’ÉTAT — 2 textes\n')
  const prets: { t: T; corps: string; arts: string[] }[] = []
  let stop = false
  for (const t of TEXTES) {
    const { corps, arts } = extraire(t)
    const ent = arts.filter((a) => !/[.-]\d/.test(a))
    const dec = arts.filter((a) => a.includes('.'))
    const tir = arts.filter((a) => /\d-\d/.test(a))
    const ok = arts.length === t.articles
    if (!ok) stop = true
    console.log(`  ${ok ? '✔' : '⛔'} ${t.source.padEnd(34)} ${String(arts.length).padStart(3)}/${t.articles} art.`)
    console.log(`      ${ent.length} entiers · ${dec.length} décimaux · ${tir.length} à tiret${tir.length ? ' (' + tir.join(', ') + ')' : ''} · ${corps.length.toLocaleString('fr')} c.`)
    prets.push({ t, corps, arts })
  }
  if (stop) { console.error('\n⛔ ARRÊT — un compte ne tombe pas.'); process.exit(1) }

  // ⚠️ L'HOMONYME : vérifier qu'aucune référence ne se heurte avant d'écrire.
  const homonyme = await prisma.document.findFirst({
    where: { number: { startsWith: 'Décret du 6 janvier 2016' } }, select: { number: true, source: true },
  })
  if (homonyme) console.log(`\n  homonyme en base : « ${homonyme.number!.slice(0, 70)}… » (${homonyme.source})`)
  const collision = await prisma.document.count({ where: { number: { in: TEXTES.map((t) => t.titre) } } })
  console.log(`  collision de référence : ${collision ? '⛔ ' + collision : 'aucune ✔'}`)
  if (collision) process.exit(1)

  const deja = await prisma.document.findMany({ where: { source: { in: TEXTES.map((t) => t.source) } }, select: { source: true } })
  console.log(`  déjà en base : ${deja.length ? deja.map((x) => x.source).join(', ') : 'aucun'}`)

  if (!commit) { console.log('\n(à blanc — ajouter --commit pour écrire)'); await prisma.$disconnect(); return }

  const connus = new Set(deja.map((x) => x.source))
  let n = 0
  for (const { t, corps } of prets) {
    if (connus.has(t.source)) { console.log(`   = ${t.source} — sauté`); continue }
    const doc = await prisma.document.create({
      data: {
        type: 'LEGISLATION', status: 'EN_VIGUEUR', source: t.source,
        number: t.titre, titleFr: t.titre, bodyOriginal: corps, moniteurRef: t.moniteurRef,
        adoptionDate: new Date(`${t.adoption}T00:00:00Z`),
        publicationDate: new Date(`${t.publication}T00:00:00Z`),
        sealed: false,
        searchText: [buildSearchText({ titleFr: t.titre, number: t.titre, moniteurRef: t.moniteurRef }), fold(corps)].filter(Boolean).join(' '),
      },
    })
    for (const [i, slug] of t.themes.entries()) {
      const th = await prisma.theme.findUnique({ where: { slug }, select: { id: true } })
      if (th) await prisma.documentTheme.create({ data: { documentId: doc.id, themeId: th.id, isPrimary: i === 0 } })
    }
    n++; console.log(`   + ${t.source}`)
  }
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', meta: { via: 'verser-administration-centrale', textes: n } })
  console.log(`\n✅ ${n} textes versés.`)
  await prisma.$disconnect()
}

main()
