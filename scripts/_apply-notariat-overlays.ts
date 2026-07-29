/**
 * NOTARIAT — amendements entre les textes publiés par _import-notariat.ts.
 *
 * Décret-loi du 27 novembre 1969 :
 *   · art. 3  — RÉÉCRIT deux fois : décret du 30 sept. 1974 (20 notaires à Port-au-Prince),
 *               puis décret du 9 juil. 1986 (22). La rédaction de 1986 PRÉVAUT ; les états
 *               de 1969 et de 1974 sont repliés, dans l'ordre chronologique.
 *   · art. 30 — premier paragraphe RÉÉCRIT par l'art. 5 de la loi du 14 février 2017
 *               (écriture « manuellement ou mécaniquement »). Les alinéas suivants sont
 *               INCHANGÉS : seul le § 1er est repris.
 *   · art. 76 — ABROGÉ par l'art. 2 du décret du 30 septembre 1974.
 * Loi du 24 février 1919 :
 *   · art. 30 — RÉÉCRIT par l'art. 1er du décret-loi du 20 juin 1941 (étude vacante).
 * Loi du 21 août 1862 :
 *   · art. 32 et 33 — RÉÉCRITS par l'art. 1er de la loi du 8 août 1877.
 *
 * Convention de la plateforme (identique au Code civil) : le texte EN VIGUEUR est le corps
 * de l'article ; l'ancienne rédaction va dans `oldVersions` (repliable) ; `status` porte la
 * pastille ; `connexe` porte le renvoi cliquable vers le texte modificateur.
 *
 * Les textes nouveaux sont EXTRAITS des textes modificateurs eux-mêmes (jamais retapés),
 * sauf la rédaction de 2017, reproduite verbatim et contrôlée par sentinelle.
 *
 * Idempotent. Sauvegarde : backups/backup-before-notariat.json.
 *   npx tsx scripts/_apply-notariat-overlays.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { type Annotations, type ConnexeBlock } from '../src/lib/legislation/annotated'

const DC = 'scripts/data/notariat-compilation'

/** Rédaction issue de l'art. 5 de la loi du 14 février 2017 — verbatim, contrôlée ci-dessous. */
const ART30_2017 =
  'Les actes des notaires sont, sous la responsabilité de ces officiers publics, écrits à l’encre, ' +
  'manuellement ou mécaniquement, sur papier timbré ou visé pour timbre en un seul et même contexte, ' +
  'lisiblement, sans blanc, abréviation, lacune ou intervalle.'

type Doc = { id: string; bodyOriginal: string | null; annotationsJson: string | null }

async function charger(source: string): Promise<Doc> {
  const d = await prisma.document.findFirst({ where: { source }, select: { id: true, bodyOriginal: true, annotationsJson: true } })
  if (!d?.bodyOriginal || !d.annotationsJson) throw new Error(`${source} introuvable — lancer _import-notariat.ts`)
  return d
}

/**
 * Texte d'un article : de sa tête jusqu'à la tête SUIVANTE **ou** au prochain EN-TÊTE de la
 * table des matières.
 * ⚠️ Sans la borne « en-tête », remplacer le dernier article d'une section engloutit
 * l'intitulé qui la suit — il disparaît alors du corps et la segmentation s'effondre
 * (constat déjà fait sur le décret sûretés : « intitulé hors-toc disparaît sous overlay »).
 */
function bloc(body: string, n: string, entetes: Set<string>): { debut: number; fin: number; lignes: string[] } {
  const lignes = body.split('\n')
  const i = lignes.findIndex((l) => new RegExp(`^Article ${n}\\.\\s*—`).test(l.trim()))
  if (i < 0) throw new Error(`article ${n} introuvable`)
  let j = i + 1
  while (j < lignes.length && !/^Article \d{1,3}\.\s*—/.test(lignes[j].trim()) && !entetes.has(lignes[j].trim())) j++
  return { debut: i, fin: j, lignes: lignes.slice(i, j) }
}

/** Remplace le corps d'un article ; renvoie [nouveauCorps, ancienTexte]. */
function remplacer(body: string, n: string, nouveau: string[], entetes: Set<string>): [string, string] {
  const { debut, fin, lignes } = bloc(body, n, entetes)
  const ancien = lignes.join('\n').replace(new RegExp(`^Article ${n}\\.\\s*—\\s*`), '')
  const toutes = body.split('\n')
  toutes.splice(debut, fin - debut, `Article ${n}. — ${nouveau[0]}`, ...nouveau.slice(1))
  return [toutes.join('\n'), ancien]
}

function poser(
  ann: Annotations & Record<string, any>,
  anchor: string,
  statut: string,
  ancienne: string,
  connexe: ConnexeBlock[],
) {
  ann.status ??= {}
  ann.oldVersions ??= {}
  ann.connexe ??= {}
  ann.status[anchor] = statut
  ann.oldVersions[anchor] = ancienne
  const liste: ConnexeBlock[] = (ann.connexe[anchor] ??= [])
  for (const b of connexe) {
    const i = liste.findIndex((x) => x.label === b.label)
    if (i >= 0) liste[i] = b
    else liste.push(b)
  }
}

async function main() {
  const textes = JSON.parse(readFileSync(`${DC}/textes.json`, 'utf8')) as Record<string, { articles: { num: string; text: string }[] }>
  const art1 = (slug: string) => textes[slug].articles.find((a) => a.num === '1')!.text

  // ── Textes NOUVEAUX, extraits des textes modificateurs ──
  const t1974 = art1('decret-1974-nombre-notaires')
  const t1986 = art1('decret-1986-nombre-notaires')
  const t1941 = art1('decret-loi-1941-etude-vacante')
  const t1877 = art1('loi-1877-modificative')

  const apresModifie = (s: string) => {
    const m = s.match(/est ainsi modifi(?:é|ée|és)\s*[:.]\s*/i)
    if (!m) throw new Error(`« est ainsi modifié » introuvable dans : ${s.slice(0, 90)}…`)
    return s.slice(m.index! + m[0].length).trim()
  }
  const nouveau3_1974 = apresModifie(t1974)
  const nouveau3_1986 = apresModifie(t1986)
  const nouveau30_1941 = (t1941.match(/Article\s+30\s*\.\s*—\s*([\s\S]+)/) ?? [])[1]?.trim()
  const m32 = t1877.match(/Article\s+32\s*\.\s*—\s*([\s\S]*?)(?=Article\s+33\s*\.\s*—)/)
  const m33 = t1877.match(/Article\s+33\s*\.\s*—\s*([\s\S]+)/)
  if (!nouveau30_1941 || !m32 || !m33) throw new Error('extraction des textes réécrits incomplète — annulé')

  // ── Sentinelles : chaînes relevées à la main dans les textes modificateurs ──
  const SENT: [string, string][] = [
    [nouveau3_1974, '20 Notaires pour la Commune de Port-au-Prince'],
    [nouveau3_1986, 'Port-au-Prince: 22 notaires'],
    [nouveau30_1941, 'le juge de Paix de sa résidence est tenu d’apposer d’office les scellés'],
    [m32[1], 'Les inventaires, les actes de partage'],
    [m33[1], 'hors de leur étude'],
    [ART30_2017, 'manuellement ou mécaniquement'],
  ]
  for (const [t, s] of SENT) if (!t.includes(s)) throw new Error(`sentinelle absente : « ${s} »`)
  console.log(`✓ 4 textes réécrits extraits · ${SENT.length} sentinelles OK`)

  const ids: Record<string, string> = {}
  for (const s of ['DECRET_NOTARIAT_1974', 'DECRET_NOTARIAT_1986', 'DECRET_LOI_NOTARIAT_1941', 'LOI_NOTARIAT_1877'])
    ids[s] = (await charger(s)).id
  const loi2017 = await prisma.document.findFirst({ where: { source: 'LOI_SIGNATURE_ELECTRONIQUE_2017' }, select: { id: true } })

  // ══ Décret-loi du 27 novembre 1969 ══
  {
    const d = await charger('DECRET_LOI_NOTARIAT_1969')
    const ann = JSON.parse(d.annotationsJson!) as Annotations & Record<string, any>
    const entetes = new Set(ann.toc.map((t) => t.label))
    let body = d.bodyOriginal!

    // art. 3 — deux amendements successifs : la version 1986 prévaut.
    if (!body.includes('Port-au-Prince: 22 notaires')) {
      const [b1, ancien1969] = remplacer(body, '3', [nouveau3_1986], entetes)
      body = b1
      poser(ann, 'art-3', 'modifié',
        `Rédaction d’origine (décret du 27 novembre 1969) :\n${ancien1969}\n\n` +
        `Rédaction issue du décret du 30 septembre 1974 :\n${nouveau3_1974}`,
        [
          { label: 'Décret du 9 juillet 1986 — rédaction en vigueur', docId: ids['DECRET_NOTARIAT_1986'], anchor: 'art-1',
            text: 'Le nombre des notaires par commune est fixé par l’article 1er du décret du 9 juillet 1986 du Conseil National de Gouvernement, qui modifie le décret du 30 septembre 1974.' },
          { label: 'Décret du 30 septembre 1974 — rédaction intermédiaire', docId: ids['DECRET_NOTARIAT_1974'], anchor: 'art-1',
            text: 'Premier amendement de l’article 3 : le nombre de notaires de Port-au-Prince était porté de 12 à 20.' },
        ])
    }

    // art. 30 — seul le PREMIER paragraphe est réécrit (loi du 14 février 2017, art. 5).
    if (!body.includes('manuellement ou mécaniquement')) {
      const { lignes } = bloc(body, '30', entetes)
      const suite = lignes.slice(1) // alinéas 2 et suivants : INCHANGÉS
      const ancien1 = lignes[0].replace(/^Article 30\.\s*—\s*/, '')
      const [b2] = remplacer(body, '30', [ART30_2017, ...suite], entetes)
      body = b2
      const note: ConnexeBlock = {
        label: 'Loi du 14 février 2017 sur la signature électronique (art. 5)',
        text: 'Le premier paragraphe du présent article a été réécrit par l’article 5 de la loi du 14 février 2017 : '
          + 'l’écriture des actes peut désormais être MÉCANIQUE. Les alinéas suivants demeurent inchangés. '
          + 'Le décret du 9 décembre 2015 avait déjà réécrit ce paragraphe en termes voisins ; il est supplanté par la loi de 2017.',
        ...(loi2017 ? { docId: loi2017.id, anchor: 'art-5' } : {}),
      }
      poser(ann, 'art-30', 'modifié', `Rédaction d’origine (décret du 27 novembre 1969), premier paragraphe :\n${ancien1}`, [note])
      if (!loi2017) console.log('  ⚠ loi de 2017 non encore publiée → note connexe SANS lien cliquable (à recâbler ensuite)')
    }

    // art. 76 — abrogé : le texte est CONSERVÉ, replié, et la pastille l'annonce.
    {
      const { lignes } = bloc(body, '76', entetes)
      const texte = lignes.join('\n').replace(/^Article 76\.\s*—\s*/, '')
      poser(ann, 'art-76', 'abrogé', texte, [
        { label: 'Décret du 30 septembre 1974 (art. 2)', docId: ids['DECRET_NOTARIAT_1974'], anchor: 'art-2',
          text: 'Article abrogé : « Est et demeure abrogé l’Art. 76 du Décret du 27 Novembre 1969 ».' },
      ])
    }

    await prisma.document.update({ where: { id: d.id }, data: { bodyOriginal: body, annotationsJson: JSON.stringify(ann) } })
    await reindexDocument(d.id)
    console.log('✓ décret de 1969 : art. 3 « modifié » (2 états repliés) · art. 30 « modifié » · art. 76 « abrogé »')
  }

  // ══ Loi du 24 février 1919 — art. 30 (décret-loi du 20 juin 1941) ══
  {
    const d = await charger('LOI_NOTARIAT_1919')
    const ann = JSON.parse(d.annotationsJson!) as Annotations & Record<string, any>
    const entetes = new Set(ann.toc.map((t) => t.label))
    let body = d.bodyOriginal!
    if (!body.includes('apposer d’office les scellés')) {
      const [b, ancien] = remplacer(body, '30', [nouveau30_1941], entetes)
      body = b
      poser(ann, 'art-30', 'modifié', `Rédaction d’origine (loi du 24 février 1919) :\n${ancien}`, [
        { label: 'Décret-loi du 20 juin 1941 (étude devenue vacante)', docId: ids['DECRET_LOI_NOTARIAT_1941'], anchor: 'art-1',
          text: 'Article réécrit par l’article 1er du décret-loi du 20 juin 1941, afin d’assurer sans délai la délivrance des copies, extraits, expéditions et grosses lorsque l’étude devient vacante.' },
      ])
      await prisma.document.update({ where: { id: d.id }, data: { bodyOriginal: body, annotationsJson: JSON.stringify(ann) } })
      await reindexDocument(d.id)
    }
    console.log('✓ loi de 1919 : art. 30 « modifié » (décret-loi de 1941)')
  }

  // ══ Loi du 21 août 1862 — art. 32 et 33 (loi du 8 août 1877) ══
  {
    const d = await charger('LOI_NOTARIAT_1862')
    const ann = JSON.parse(d.annotationsJson!) as Annotations & Record<string, any>
    const entetes = new Set(ann.toc.map((t) => t.label))
    let body = d.bodyOriginal!
    const dispo = new Set(body.split('\n').filter((l) => /^Article \d+\.\s*—/.test(l.trim())).map((l) => l.match(/^Article (\d+)\./)![1]))
    let faits = 0
    for (const [n, nouveau] of [['32', m32[1].trim()], ['33', m33[1].trim()]] as const) {
      if (!dispo.has(n)) continue // la loi de 1862 transcrite ne compte que 11 articles
      const [b, ancien] = remplacer(body, n, [nouveau], entetes)
      body = b
      poser(ann, `art-${n}`, 'modifié', `Rédaction d’origine (loi du 21 août 1862) :\n${ancien}`, [
        { label: 'Loi du 8 août 1877 modificative', docId: ids['LOI_NOTARIAT_1877'], anchor: 'art-1',
          text: `Article réécrit par l’article 1er de la loi du 8 août 1877.` },
      ])
      faits++
    }
    if (faits) {
      await prisma.document.update({ where: { id: d.id }, data: { bodyOriginal: body, annotationsJson: JSON.stringify(ann) } })
      await reindexDocument(d.id)
      console.log(`✓ loi de 1862 : ${faits} article(s) « modifié »`)
    } else {
      console.log('⚠ loi de 1862 : articles 32 et 33 ABSENTS de la transcription (elle s’arrête à l’art. 11)')
      console.log('   → la loi de 1877 reste consultable seule ; à recâbler si la loi de 1862 est complétée')
    }
  }

  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
