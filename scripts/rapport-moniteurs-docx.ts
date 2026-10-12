/**
 * Rapport Word des Éditions Le Moniteur — UN SEUL fichier pour tous les millésimes
 * (décision de Me Vaval, 12 oct. 2026). Lit la base, n'y écrit RIEN.
 *
 *   npx tsx scripts/rapport-moniteurs-docx.ts --avant --inventaire <dossier> \
 *     [--ecarts <fichier.json>]… [--annees 2013,2017] [--sortie <fichier.docx>]
 *
 * --avant : « Inventaire avant versement ». <dossier> contient un <année>.json par millésime,
 *   produit par `import-moniteur-pdf.ts --completer --inventaire-json` (à blanc) ; les statuts
 *   sont ceux PRÉVUS (« à verser », « déjà en base »). Chaque --ecarts est un JSON
 *   `{ ecarts: [{ annee: number | null, objet, detail }] }` : rapprochements faits ailleurs
 *   (tableaux de la cliente, fiches de livraison, Index) ; `annee: null` = constat général.
 *
 * Le rapport final (`--final`, état réel en base après versement) reste à écrire (Étape 4).
 *
 * Mise en page (prompt § 6) : A4 paysage, marges 1,5 cm, Arial 9 pt, un Titre 1 par millésime
 * (volet de navigation de Word), en-tête de tableau répété, lignes insécables, « page X sur Y ».
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { BRAND_COLORS } from '../src/lib/brand-colors'

const prisma = new PrismaClient()

const CHABON = BRAND_COLORS.chabon.replace('#', '')
const WOUJ = BRAND_COLORS.wouj.replace('#', '')
const PIL = BRAND_COLORS.pil.replace('#', '')
const GRIS = '6E6D8E'

const CM = 567 // twips par centimètre
const LARGEUR_UTILE = Math.round((29.7 - 2 * 1.5) * CM)

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

interface Fascicule {
  ref: string
  type: string
  special: boolean
  num: number
  suffix: string
  monthIdx: number
  day: number | null
  pages: number
  parts: number
  label: string
  texteCaracteres: number
  fichiers: string[]
  statut: 'deja-en-base' | 'a-verser'
}
interface Inventaire {
  annee: number
  source: string
  ecartes: string[]
  rectifies: string[]
  fascicules: Fascicule[]
}
interface Ecart {
  annee: number | null
  objet: string
  detail: string
}
interface FicheBase {
  number: string
  title: string
  publicationDate: Date | null
  dateSource: string | null
}

const sansTiret = (ref: string) => ref.replace(/-/g, '').toUpperCase()

/** « 1 975 » — l'espace fine insécable de `fr-FR` (U+202F) manque à Arial : espace insécable. */
const nb = (n: number) => n.toLocaleString('fr-FR').replace(/\u202f/g, '\u00a0')

/** « mercredi 9 janvier 2013 (09/01/2013) » — le 1er s'écrit « 1er ». */
function dateLongue(an: number, mois: number, jour: number): string {
  const j = new Date(Date.UTC(an, mois, jour)).getUTCDay()
  const court = `${String(jour).padStart(2, '0')}/${String(mois + 1).padStart(2, '0')}/${an}`
  return `${JOURS[j]} ${jour === 1 ? '1er' : jour} ${MOIS[mois]} ${an} (${court})`
}

/** « Spécial n° 12-A1 », « n° 30 (4 parties) ». */
function numero(f: Fascicule, annee: number): string {
  const reste = f.ref.replace(`LM${annee}-`, '')
  const base = reste.startsWith('SP') ? `Spécial n° ${reste.slice(2)}` : `n° ${reste}`
  return f.parts > 1 ? `${base} (${f.parts} parties)` : base
}

// ───────────────────────────── briques docx ─────────────────────────────
const run = (text: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) =>
  new TextRun({ text, font: 'Arial', size: o.size ?? 18, bold: o.bold, color: o.color ?? CHABON, italics: o.italics })

function cellule(contenu: (string | TextRun[])[], largeur: number, o: { entete?: boolean; droite?: boolean } = {}): TableCell {
  return new TableCell({
    width: { size: largeur, type: WidthType.DXA },
    shading: o.entete ? { type: ShadingType.CLEAR, color: 'auto', fill: PIL } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: contenu.map(
      (c) =>
        new Paragraph({
          alignment: o.droite ? AlignmentType.RIGHT : AlignmentType.LEFT,
          children: typeof c === 'string' ? [run(c, { bold: o.entete })] : c,
        }),
    ),
  })
}

/** Tableau à largeurs FIXES (cm), en-tête répété, lignes insécables. */
function tableau(entetes: string[], largeursCm: number[], lignes: (string | TextRun[])[][][], droite: number[] = []): Table {
  const total = largeursCm.reduce((a, b) => a + b, 0)
  const tw = largeursCm.map((l) => Math.round((l / total) * LARGEUR_UTILE))
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: LARGEUR_UTILE, type: WidthType.DXA },
    columnWidths: tw,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: entetes.map((e, i) => cellule([e], tw[i], { entete: true })) }),
      ...lignes.map(
        (l) => new TableRow({ cantSplit: true, children: l.map((c, i) => cellule(c, tw[i], { droite: droite.includes(i) })) }),
      ),
    ],
  })
}

const titre1 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { after: 120 }, children: [run(t, { bold: true, size: 32 })] })
const titre2 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 100 }, children: [run(t, { bold: true, size: 24 })] })
const para = (t: string | TextRun[], after = 80) => new Paragraph({ spacing: { after }, children: typeof t === 'string' ? [run(t)] : t })

// ───────────────────────────── programme ─────────────────────────────
async function main() {
  const args = process.argv.slice(2)
  const opt = (nom: string) => {
    const i = args.indexOf(nom)
    return i >= 0 ? args[i + 1] : undefined
  }
  if (!args.includes('--avant')) {
    console.error('Seul --avant (inventaire avant versement) existe pour l’instant ; --final viendra à l’Étape 4.')
    process.exit(1)
  }
  const dossierInv = opt('--inventaire')
  if (!dossierInv) throw new Error('--inventaire <dossier> manquant')
  const annees = opt('--annees')?.split(',').map(Number)
  const aujourdhui = new Date()
  const iso = aujourdhui.toISOString().slice(0, 10)
  const sortie = opt('--sortie') ?? join('docs', 'livraison-moniteurs', `Moniteurs-inventaire-${iso}.docx`)

  const inventaires: Inventaire[] = readdirSync(dossierInv)
    .filter((f) => /^\d{4}\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(join(dossierInv, f), 'utf8')) as Inventaire)
    .filter((i) => !annees || annees.includes(i.annee))
    .sort((a, b) => a.annee - b.annee)
  const ecarts: Ecart[] = args
    .flatMap((a, i) => (a === '--ecarts' ? [args[i + 1]] : []))
    .flatMap((f) => (JSON.parse(readFileSync(f, 'utf8')) as { ecarts: Ecart[] }).ecarts)

  // ── LECTURE de la base : fiches d'Éditions et comptes d'Index par référence ──
  const fiches = await prisma.document.findMany({
    where: { type: 'LEGISLATION', source: { in: inventaires.map((i) => i.source) } },
    select: { number: true, titleFr: true, source: true, publicationDate: true, metaJson: true },
  })
  const baseParAn = new Map<number, Map<string, FicheBase>>()
  for (const f of fiches) {
    if (!f.number) continue
    const an = Number(f.source!.split('_').pop())
    let dateSource: string | null = null
    try {
      dateSource = JSON.parse(f.metaJson ?? '{}').dateSource ?? null
    } catch {
      /* metaJson illisible : date tenue pour provisoire */
    }
    if (!baseParAn.has(an)) baseParAn.set(an, new Map())
    baseParAn.get(an)!.set(sansTiret(f.number), { number: f.number, title: f.titleFr, publicationDate: f.publicationDate, dateSource })
  }
  const index = await prisma.document.groupBy({
    by: ['number'],
    where: { type: 'INDEX', source: 'MONITEUR', OR: inventaires.map((i) => ({ number: { startsWith: `LM${i.annee}` } })) },
    _count: { _all: true },
  })
  const entreesIndex = new Map<string, number>()
  for (const g of index) if (g.number) entreesIndex.set(sansTiret(g.number), (entreesIndex.get(sansTiret(g.number)) ?? 0) + g._count._all)

  // ── calculs par millésime ──
  const corps: (Paragraph | Table)[] = []
  const synthese: (string | TextRun[])[][][] = []
  const totaux = { dossier: 0, base: 0, verser: 0, ecartes: 0, sansIndex: 0, ecarts: 0, pages: 0 }

  for (const inv of inventaires) {
    const an = inv.annee
    const base = baseParAn.get(an) ?? new Map<string, FicheBase>()
    const aVerser = inv.fascicules.filter((f) => f.statut === 'a-verser')
    const dejaEnBase = inv.fascicules.filter((f) => f.statut === 'deja-en-base')
    const toutes = new Set([...inv.fascicules.map((f) => sansTiret(f.ref)), ...base.keys()])
    const sansIndex = [...toutes].filter((k) => !entreesIndex.get(k)).length

    // Dates de la base « lues dans le nom » alors que le nom ne porte pas de jour ET dont le
    // jour égale le numéro : c'est le numéro qui a été pris pour le jour (ancien `dayFromName`,
    // corrigé le 12 oct. 2026). Le seul `dateSource` ne suffit pas : 2018 est tout entier
    // « filename » avec des dates justes (n° 1 au mercredi 3 janvier).
    const douteuse = (f: Fascicule) => {
      const b = base.get(sansTiret(f.ref))
      return b?.dateSource === 'filename' && f.day == null && b.publicationDate?.getUTCDate() === f.num
    }
    const datesDouteuses = dejaEnBase.filter(douteuse)

    const lignesAnnee: Ecart[] = [
      ...inv.ecartes.map((e) => ({ annee: an, objet: 'Fichier ÉCARTÉ — non versé', detail: e.replace(/ — écarté par --exclure .*/, ' — écarté pour ce versement (motif ci-dessous)') })),
      ...inv.rectifies.map((r) => ({ annee: an, objet: 'Fichier RECTIFIÉ — la pagination dément le nom', detail: r })),
      ...inv.fascicules
        .filter((f) => f.parts > 1)
        .map((f) => ({
          annee: an,
          objet: `Édition en ${f.parts} parties${f.statut === 'deja-en-base' ? ' (déjà en base)' : ' — fusionnée en un PDF au versement'}`,
          detail: `${numero(f, an)} : ${f.fichiers.map((x) => basename(x)).join(' + ')}`,
        })),
      ...(datesDouteuses.length
        ? [{
            annee: an,
            objet: `${datesDouteuses.length} date(s) en base lue(s) dans un nom SANS jour — le numéro a servi de jour`,
            detail: datesDouteuses.map((f) => f.ref.replace(`LM${an}-`, '')).join(', ') + ' — à reprendre sur la manchette (Claude Haiku 5.5), avec votre accord.',
          }]
        : []),
      ...ecarts.filter((e) => e.annee === an),
    ]

    const pages = aVerser.reduce((s, f) => s + f.pages, 0)
    synthese.push([
      [String(an)], [nb(inv.fascicules.length)], [nb(dejaEnBase.length)], [nb(aVerser.length)],
      [nb(inv.ecartes.length)], ['0'], [nb(sansIndex)], ['—'], [nb(lignesAnnee.length)],
    ])
    totaux.dossier += inv.fascicules.length
    totaux.base += dejaEnBase.length
    totaux.verser += aVerser.length
    totaux.ecartes += inv.ecartes.length
    totaux.sansIndex += sansIndex
    totaux.ecarts += lignesAnnee.length
    totaux.pages += pages

    // ── Tableau 1 : une ligne par fascicule, triée par date puis numéro ──
    const cle = (f: Fascicule): [number, number] => {
      const b = base.get(sansTiret(f.ref))
      if (f.statut === 'deja-en-base' && b?.publicationDate) return [b.publicationDate.getUTCMonth(), b.publicationDate.getUTCDate()]
      return [f.monthIdx, f.day ?? 32]
    }
    const tries = inv.fascicules.slice().sort((a, b) => {
      const [ma, ja] = cle(a)
      const [mb, jb] = cle(b)
      return ma - mb || ja - jb || Number(a.special) - Number(b.special) || a.num - b.num || a.suffix.localeCompare(b.suffix)
    })
    const lignes = tries.map((f): (string | TextRun[])[][] => {
      const b = base.get(sansTiret(f.ref))
      let date: string
      if (f.statut === 'deja-en-base' && b?.publicationDate) {
        const d = b.publicationDate
        date = dateLongue(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
        if (b.dateSource !== 'ocr') date += douteuse(f) ? ' — douteuse (jour = numéro)' : ' — non vérifiée sur la manchette'
      } else if (f.day != null) {
        date = `${dateLongue(an, f.monthIdx, f.day)} — lue dans le nom`
      } else {
        date = `${MOIS[f.monthIdx]} ${an} — jour à lire sur la manchette`
      }
      const nom = f.statut === 'deja-en-base' && b ? b.title : f.label
      const fichiers = f.fichiers.length > 1 ? `${basename(f.fichiers[0])} + ${f.fichiers.length - 1} partie(s)` : basename(f.fichiers[0])
      return [
        [numero(f, an)],
        [date],
        [nom, [run(fichiers, { size: 14, color: GRIS })]],
        [f.ref],
        [String(f.pages)],
        [f.statut === 'a-verser' ? 'à verser' : 'déjà en base'],
      ]
    })

    corps.push(titre1(`${an}`))
    corps.push(
      para(
        `${inv.fascicules.length} fascicule(s) dans le dossier remis · ${dejaEnBase.length} déjà en base (sautés) · ` +
          `${aVerser.length} à verser (${nb(pages)} pages, dont ` +
          `${aVerser.filter((f) => f.texteCaracteres === 0).length} sans couche texte) · ${inv.ecartes.length} écarté(s) · ` +
          `${sansIndex} fascicule(s) sans entrée d'Index.`,
        160,
      ),
    )
    corps.push(titre2(`Éditions Le Moniteur ${an}`))
    corps.push(
      tableau(
        ['N° du Moniteur', 'Date de parution', 'Nom', 'Référence', 'Pages', 'Statut'],
        [3, 5.6, 9.4, 3.4, 1.4, 2.9],
        lignes,
        [4],
      ),
    )
    corps.push(titre2(`Écarts et anomalies ${an}`))
    corps.push(
      lignesAnnee.length
        ? tableau(['Objet', 'Détail'], [7.5, 19.2], lignesAnnee.map((e) => [[e.objet], [e.detail]]))
        : para('Aucun écart.'),
    )
  }

  // ── en-tête du document ──
  const generaux = ecarts.filter((e) => e.annee == null)
  const tete: (Paragraph | Table)[] = [
    new Paragraph({ spacing: { after: 60 }, children: [run('Éditions Le Moniteur — Inventaire avant versement', { bold: true, size: 36 })] }),
    new Paragraph({
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: WOUJ } },
      children: [
        run(
          `Produit le ${dateLongue(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate()).replace(/ \(.*/, '')} · ` +
            `périmètre : dossier « Moniteur » du Bureau, ${inventaires.length} millésimes · lecture seule — rien n'a été écrit en base.`,
          { color: GRIS },
        ),
      ],
    }),
    para([
      run('À approuver : ', { bold: true }),
      run(
        `${nb(totaux.verser)} fascicules à verser (${nb(totaux.pages)} pages), ` +
          `${nb(totaux.base)} déjà en base laissés tels quels, ${nb(totaux.ecartes)} fichier(s) écarté(s) (motifs aux tableaux d’écarts). ` +
          'Rien ne sera écrit sans votre accord exprès, millésime par millésime.',
      ),
    ]),
    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, children: [run('Synthèse par millésime', { bold: true, size: 32 })] }),
    tableau(
      ['Millésime', 'Fascicules dans le dossier', 'Déjà en base', 'À verser', 'Écartés', 'À trancher', "Sans entrée d'Index", "Entrées d'Index créées", 'Écarts signalés'],
      [2.4, 2.9, 2.9, 2.9, 2.6, 2.6, 3.8, 3.8, 2.8],
      [
        ...synthese,
        [['Total'], [nb(totaux.dossier)], [nb(totaux.base)], [nb(totaux.verser)], [nb(totaux.ecartes)], ['0'], [nb(totaux.sansIndex)], ['—'], [nb(totaux.ecarts)]],
      ],
      [1, 2, 3, 4, 5, 6, 7, 8],
    ),
    para([run("« Sans entrée d'Index » compte les fascicules du dossier et de la base qui n'ont encore aucune entrée à l'Index du Moniteur ; « Entrées d'Index créées » sera rempli au rapport final.", { size: 15, color: GRIS })], 120),
  ]
  if (generaux.length) {
    tete.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, children: [run('Constats généraux et questions', { bold: true, size: 32 })] }))
    tete.push(tableau(['Objet', 'Détail'], [7.5, 19.2], generaux.map((e) => [[e.objet], [e.detail]])))
  }

  const doc = new Document({
    creator: 'Agora',
    title: 'Éditions Le Moniteur — Inventaire avant versement',
    styles: { default: { document: { run: { font: 'Arial', size: 18 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: Math.round(21 * CM), height: Math.round(29.7 * CM), orientation: PageOrientation.LANDSCAPE },
            margin: { top: Math.round(1.5 * CM), bottom: Math.round(1.5 * CM), left: Math.round(1.5 * CM), right: Math.round(1.5 * CM) },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  run('Éditions Le Moniteur — inventaire avant versement · page ', { size: 14, color: GRIS }),
                  new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 14, color: GRIS }),
                  run(' sur ', { size: 14, color: GRIS }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 14, color: GRIS }),
                ],
              }),
            ],
          }),
        },
        children: [...tete, ...corps],
      },
    ],
  })

  mkdirSync(dirname(sortie), { recursive: true })
  writeFileSync(sortie, await Packer.toBuffer(doc))
  console.log(`→ ${sortie} · ${inventaires.length} millésimes · ${totaux.dossier} fascicules (${totaux.verser} à verser) · ${totaux.ecarts} écarts`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
