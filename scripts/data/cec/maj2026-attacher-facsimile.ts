/**
 * Loi CEC 2002 — ATTACHER LE FAC-SIMILÉ LACUNAIRE DU MONITEUR N° 54 (§ 7.3).
 *
 * ⚠️ LA QUESTION § 13.3 EST OUVERTE : Me Vaval n'a pas encore décidé d'attacher ce scan
 * (17 des 32 pages manquent). Ce script REFUSE donc de faire quoi que ce soit — même une
 * simulation — sans le drapeau de consentement `--facsimile` :
 *
 *     npx tsx scripts/data/cec/maj2026-attacher-facsimile.ts
 *         → refus : imprime le dossier § 13.3 et s'arrête, rien n'est lu en écriture
 *     npx tsx scripts/data/cec/maj2026-attacher-facsimile.ts --facsimile
 *         → simulation complète, AUCUNE écriture
 *     npx tsx scripts/data/cec/maj2026-attacher-facsimile.ts --facsimile --apply
 *         → écriture — lancé par Me Vaval, et par elle seule
 *
 * LA PIÈCE (dossier complet : maj2026-facsimile-dossier.md) : le PDF autonome
 * `Moniteur/Loi sur les cooperatives Epargne et credit.pdf` — la meilleure des trois
 * copies, vérifiée À L'OCTET le 27 août 2026 : ses 15 planches sont, flux d'image par flux
 * d'image, identiques aux pages 644-658 du volume Tardieu (la numérisation au meilleur
 * OCR) ; la 3ᵉ copie (Lois_18_20/2002.pdf) est une autre numérisation des mêmes planches,
 * avec la même lacune. `lois_cec.pdf` (reproduction) est ÉCARTÉ : il diverge du scan sur
 * une page présente (dossier maj2026-dossier-chapitre-titre2.md).
 *
 * LA LACUNE S'ÉCRIT (§ 7.3, interdit n° 19) : pages imprimées 12-13 et 16-30 manquantes.
 * La mention va à l'appareil de la fiche — entrée `crossRefs` ancrée `sec-1`, le canal de
 * la note de provenance du modèle `scripts/attacher-facsimile-ir-2005.ts` — écrite dans la
 * MÊME transaction que `sourcePdfUrl` : jamais l'un sans l'autre.
 *
 * Mécanique reprise du modèle IR 2005 : Blob PRIVÉ « lam-pdfs », chemin déterministe,
 * jeton `BLOB_READ_WRITE_TOKEN` EXPLICITE depuis `.env` (piège OIDC), lecture par la route
 * authentifiée /api/doc/[id]/pdf, état antérieur horodaté AVANT la transaction, audit
 * recompté APRÈS (audit() avale ses erreurs), reindexDocument HORS transaction.
 *
 * COMPOSITION AVEC maj2026-lot-corps.ts (§ 7.4/7.5) : indifférente. Ce script ne touche pas
 * au corps et ne décrit pas sa lettre ; il admet les deux empreintes (avant/après fusion) et
 * ses gardes d'annotations sont STRUCTURELLES (toc[0] = sec-1, ajout d'une seule entrée
 * crossRefs), pas des empreintes figées — les ajouts d'index du lot-corps n'y font rien.
 */
import { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseAnnotations, type CrossRefEntry } from '../../../src/lib/legislation/annotated'
import { uploadToBlob, isBlobUrl } from '../../../src/lib/storage/blob'
import { buildSearchText } from '../../../src/lib/search/normalize'
import { reindexDocument } from '../../../src/lib/search/reindex'
import { audit } from '../../../src/lib/auth/audit'

const prisma = new PrismaClient()
const CONSENT = process.argv.includes('--facsimile')
const APPLY = process.argv.includes('--apply')
const md5 = (s: string | Buffer) => createHash('md5').update(s as never).digest('hex')

const DOSSIER = __dirname
const SOURCE = 'LOI_CEC_2002'
const DOC_ID = 'cms8jhhz700004szrkm41yahg'
const PDF = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/Loi sur les cooperatives Epargne et credit.pdf'
const CHEMIN_BLOB = `source-pdf/legislation/${DOC_ID}.pdf`

/** Empreinte de la pièce, relevée le 27 août 2026. Un autre fichier sous ce nom est refusé. */
const PDF_MD5 = '0fef82932aca681a2137201e97010020'
const PDF_OCTETS = 600_029
const PDF_PAGES = 15

/** Les deux états admis du corps (§ 7.1 / § 7.4) — relevés et calculés le 27 août 2026. */
const CORPS_ADMIS: Record<string, string> = {
  '67a109181877e5e2b06c13c583992c9d': 'corps du relevé du 27 août (504 lignes) — lot-corps § 7.4 non appliqué',
  '5d781360044ab6db9eee8ba49f369261': 'corps après maj2026-lot-corps.ts (fusion des 3 libellés de TITRES, 501 lignes)',
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// LA MENTION DE LACUNE — obligatoire, écrite ici et nulle part ailleurs
// ══════════════════════════════════════════════════════════════════════════════════════════
const NOTE_LACUNE =
  'Le fac-similé du Journal officiel joint à cette fiche — Le Moniteur, 157ᵉ année, n° 54, ' +
  'mercredi 10 juillet 2002, numéro extraordinaire — est PARTIEL. La numérisation conservée ' +
  '(exemplaire au tampon de la Bibliothèque de l’Université Quisqueya) ne comporte que 15 des ' +
  '32 pages du fascicule : les pages 1 à 11, 14, 15, 31 et 32 ; les pages 12, 13 et 16 à 30 ' +
  'manquent. Les pages présentes portent le préambule, les articles 1 à 44 et 55 à 64 — un ' +
  'article en frontière de page pouvant y être tronqué —, les articles 147 à 151, ainsi que ' +
  'les dates du Sénat (20 juin 2002), de la Chambre des Députés (26 juin 2002) et de la ' +
  'promulgation (9 juillet 2002). Les articles 45 à 54 et 65 à 146 sont sur les pages ' +
  'manquantes : pour eux, cette pièce ne fait pas foi.'

/** Reconnaître notre entrée si elle est déjà en place (idempotence). */
const SENTINELLE_NOTE = 'les pages 12, 13 et 16 à 30'

async function main() {
  const p = (s = '') => console.log(s)

  if (!CONSENT) {
    p('══════════════════════════════════════════════════════════════════════════════════')
    p('  REFUS — la question § 13.3 est OUVERTE (fac-similé lacunaire, 17 pages sur 32')
    p('  manquantes). Ce script n’attache rien, ne simule rien, sans le consentement')
    p('  explicite de Me Vaval, donné par le drapeau --facsimile.')
    p('══════════════════════════════════════════════════════════════════════════════════')
    p()
    p('  La pièce prête : le PDF autonome (15 p., 600 029 octets, md5 0fef8293…),')
    p('  identique à l’octet aux planches 644-658 du volume Tardieu — dossier complet :')
    p('  scripts/data/cec/maj2026-facsimile-dossier.md (choix de la copie, lacune mesurée')
    p('  page à page, mention de lacune, alternative lois_cec.pdf écartée et pourquoi).')
    p()
    p('  Pour simuler :   npx tsx scripts/data/cec/maj2026-attacher-facsimile.ts --facsimile')
    p('  Pour attacher :  npx tsx scripts/data/cec/maj2026-attacher-facsimile.ts --facsimile --apply')
    process.exitCode = 1
    await prisma.$disconnect()
    return
  }

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 0. LE JETON — explicitement, avant tout appel au Blob (piège OIDC)
  // ════════════════════════════════════════════════════════════════════════════════════════
  const env = Object.fromEntries(
    readFileSync(join(process.cwd(), '.env'), 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
      }),
  ) as Record<string, string>
  if (env.BLOB_READ_WRITE_TOKEN) process.env.BLOB_READ_WRITE_TOKEN = env.BLOB_READ_WRITE_TOKEN
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    throw new Error(
      'BLOB_READ_WRITE_TOKEN absent de .env — sans jeton explicite, le SDK retombe sur le ' +
        'jeton OIDC et l’écriture échoue au `put`.',
    )

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 1. LA FICHE, ET SES GARDES
  // ════════════════════════════════════════════════════════════════════════════════════════
  const nCec = await prisma.document.count({ where: { source: SOURCE } })
  if (nCec !== 1) throw new Error(`${nCec} fiches ${SOURCE} — il en faut exactement 1`)
  const doc = await prisma.document.findFirstOrThrow({ where: { source: SOURCE } })
  if (doc.id !== DOC_ID) throw new Error(`la fiche ${SOURCE} est ${doc.id}, attendu ${DOC_ID}`)

  const empreinteCorps = md5(doc.bodyOriginal)
  const etatCorps = CORPS_ADMIS[empreinteCorps]
  if (!etatCorps) {
    p(`⚠ corps : md5 ${empreinteCorps} — aucun des états admis. La note n'en décrit pas la lettre,`)
    p('  mais on ne joint pas une pièce à une fiche qu’on ne reconnaît plus : --apply refusé.')
    if (APPLY) throw new Error('corps dans un état inconnu — --apply refusé (§ 10.8)')
  }

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 2. LA PIÈCE — présente, entière, et bien celle du relevé du 27 août
  // ════════════════════════════════════════════════════════════════════════════════════════
  let stat
  try {
    stat = statSync(PDF)
  } catch {
    throw new Error(`fac-similé introuvable : ${PDF}`)
  }
  const buf = readFileSync(PDF)
  if (!buf.subarray(0, 5).toString('latin1').startsWith('%PDF-')) throw new Error(`${PDF} n'est pas un PDF (en-tête absent)`)
  if (buf.length !== PDF_OCTETS) throw new Error(`fac-similé : ${buf.length} octets, attendu ${PDF_OCTETS}`)
  const pdfMd5 = md5(buf)
  if (pdfMd5 !== PDF_MD5)
    throw new Error(
      `fac-similé : md5 ${pdfMd5}, attendu ${PDF_MD5}. Ce n'est pas le fichier vérifié à l'octet ` +
        'le 27 août (identité aux planches Tardieu, lacune mesurée page à page) : la mention de ' +
        'lacune écrite par ce script ne le décrirait pas.',
    )
  const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
  if (pages !== PDF_PAGES) throw new Error(`fac-similé : ${pages} pages comptées, attendu ${PDF_PAGES}`)

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 3. IDEMPOTENCE ET LA MENTION — jamais le PDF sans la note, jamais la note en double
  // ════════════════════════════════════════════════════════════════════════════════════════
  if (doc.sourcePdfUrl && !isBlobUrl(doc.sourcePdfUrl))
    throw new Error(`sourcePdfUrl vaut « ${doc.sourcePdfUrl} », qui n'est pas une URL Blob : ne pas l'écraser sans la lire`)
  const dejaAttache = isBlobUrl(doc.sourcePdfUrl)

  const ann = parseAnnotations(doc.annotationsJson)
  if (!ann) throw new Error('annotationsJson illisible par parseAnnotations — STOP')
  if (ann.toc[0]?.anchor !== 'sec-1')
    throw new Error(`toc[0] a l'ancre « ${ann.toc[0]?.anchor} », attendu sec-1 — le canal de la note n'est plus celui mesuré`)

  const brut = JSON.parse(doc.annotationsJson!) as Record<string, unknown>
  const crossRefsAvant: CrossRefEntry[] = Array.isArray(brut.crossRefs) ? (brut.crossRefs as CrossRefEntry[]) : []
  const notreEntree = crossRefsAvant.find((c) => c.anchor === 'sec-1' && (c.note ?? '').includes(SENTINELLE_NOTE))
  const autreSec1 = crossRefsAvant.find((c) => c.anchor === 'sec-1' && !(c.note ?? '').includes(SENTINELLE_NOTE))
  if (autreSec1)
    throw new Error(
      'une entrée crossRefs ancrée sec-1 existe déjà et n’est pas la mention de lacune — la lire avant d’en ajouter une seconde',
    )
  const noteDejaFaite = Boolean(notreEntree)
  const crossRefsApres = noteDejaFaite
    ? crossRefsAvant
    : [...crossRefsAvant, { anchor: 'sec-1', articles: [], note: NOTE_LACUNE } satisfies CrossRefEntry]

  const annotations = JSON.stringify({ ...brut, crossRefs: crossRefsApres })
  if (!parseAnnotations(annotations)) throw new Error('le JSON produit n’est pas relisible par parseAnnotations')
  // Garde de non-débordement : hors l'entrée ajoutée, RIEN ne change.
  {
    const a = JSON.parse(doc.annotationsJson!) as Record<string, unknown>
    const b = JSON.parse(annotations) as Record<string, unknown>
    const sansNotre = (o: Record<string, unknown>) => {
      const refs = (Array.isArray(o.crossRefs) ? (o.crossRefs as CrossRefEntry[]) : []).filter(
        (c) => !(c.anchor === 'sec-1' && (c.note ?? '').includes(SENTINELLE_NOTE)),
      )
      const { crossRefs: _ecarte, ...reste } = o
      return JSON.stringify({ ...reste, crossRefsFiltres: refs })
    }
    if (sansNotre(a) !== sansNotre(b)) throw new Error('annotationsJson : autre chose que la mention de lacune a changé — STOP')
    const nA = Array.isArray(a.crossRefs) ? (a.crossRefs as unknown[]).length : 0
    const nB = (b.crossRefs as unknown[]).length
    if (nB !== nA + (noteDejaFaite ? 0 : 1)) throw new Error(`crossRefs : ${nA} → ${nB}, delta inattendu`)
  }

  // ════════════════════════════════════════════════════════════════════════════════════════
  // RAPPORT
  // ════════════════════════════════════════════════════════════════════════════════════════
  p('══════════════════════════════════════════════════════════════════════════════════')
  p('  FAC-SIMILÉ DU MONITEUR N° 54 (10 juillet 2002) — loi CEC 2002')
  p(`  ${doc.id} · source ${SOURCE} · corps md5 ${empreinteCorps}${etatCorps ? ` (${etatCorps})` : ' (ÉTAT INCONNU)'}`)
  p('══════════════════════════════════════════════════════════════════════════════════')
  p()
  p('LA PIÈCE — vérifiée à l’octet contre le relevé du 27 août')
  p(`  ${PDF}`)
  p(`  ${buf.length} octets (${(buf.length / 1024).toFixed(0)} Ko) · ${pages} pages · md5 ${pdfMd5}`)
  p(`  modifié le ${stat.mtime.toISOString().slice(0, 10)} · en-tête %PDF ✓`)
  p('  planches identiques à l’octet aux pages 644-658 du volume Tardieu (15/15 flux d’image,')
  p('  maj2026-facsimile-dossier.md) — la meilleure des trois copies, en 600 Ko.')
  p()
  p('LA LACUNE — MESURÉE PAGE À PAGE, ET DITE AU LECTEUR (§ 12.19)')
  p('  pages imprimées présentes : 1-11, 14, 15, 31, 32 (15 des 32) · manquantes : 12-13 et 16-30')
  p('  mention à l’appareil (crossRefs, ancre sec-1, canal du modèle IR 2005), MÊME transaction')
  p(`  que sourcePdfUrl${noteDejaFaite ? ' — mention DÉJÀ en place, non dupliquée' : ''} :`)
  p(`  « ${NOTE_LACUNE} »`)
  p()
  p('DESTINATION')
  p(`  Blob PRIVÉ « lam-pdfs » · chemin déterministe ${CHEMIN_BLOB} (allowOverwrite, sans suffixe)`)
  p(`  lecture par la route authentifiée /api/doc/${DOC_ID}/pdf — l’URL Blob n’est jamais exposée`)
  p(`  champ écrit : sourcePdfUrl (${doc.sourcePdfUrl ?? 'NULL'} aujourd’hui) ; sourceFileUrl NON touché`)
  if (dejaAttache) p('  un fac-similé est DÉJÀ attaché — le chemin déterministe écrase le même objet, l’URL ne change pas')
  p()

  const horodatage = new Date().toISOString().replace(/[:.]/g, '-')
  const fichierEtat = join(DOSSIER, `maj2026-etat-anterieur-facsimile-${horodatage}.json`)
  const etatAnterieur = {
    _lisezMoi:
      'État de la fiche AVANT maj2026-attacher-facsimile.ts --facsimile --apply. Le corps n’est pas ' +
      'touché ; seuls sourcePdfUrl, une entrée crossRefs (sec-1) et searchText changent.',
    ecritLe: new Date().toISOString(),
    id: doc.id,
    source: SOURCE,
    md5BodyOriginal: empreinteCorps,
    sourcePdfUrl: doc.sourcePdfUrl,
    sourceFileUrl: doc.sourceFileUrl,
    annotationsJson: doc.annotationsJson,
    facsimile: { chemin: PDF, octets: buf.length, pages, md5: pdfMd5, blob: CHEMIN_BLOB },
  }

  if (!APPLY) {
    p('CE QUI SERAIT ÉCRIT')
    p(`  état antérieur : ${fichierEtat}`)
    p(`  Blob     : ${CHEMIN_BLOB} (${(buf.length / 1024).toFixed(0)} Ko, privé)`)
    p(`  Document : sourcePdfUrl, annotationsJson (${noteDejaFaite ? 'mention déjà en place' : '+1 entrée crossRefs'}), searchText`)
    p('  AuditLog : 1 DOC_PUBLISHED · reindexDocument hors transaction')
    p()
    p('SIMULATION — rien n’a été écrit, aucun octet n’est parti sur le Blob.')
    p('--apply est réservé à Me Vaval (§ 10.2), la question § 13.3 restant la sienne.')
    await prisma.$disconnect()
    return
  }

  // L'état antérieur AVANT tout : si ce fichier ne s'écrit pas, rien n'a bougé.
  writeFileSync(fichierEtat, JSON.stringify(etatAnterieur, null, 2) + '\n', 'utf8')
  p(`état antérieur sauvegardé : ${fichierEtat}`)

  // Téléversement HORS transaction (requête réseau) ; en cas d'échec de la transaction, le
  // blob resterait orphelin, privé, non référencé — et écrasé au prochain passage.
  p(`téléversement de ${(buf.length / 1024).toFixed(0)} Ko vers ${CHEMIN_BLOB}…`)
  const url = await uploadToBlob(CHEMIN_BLOB, buf, 'application/pdf', { multipart: true })
  if (!isBlobUrl(url)) throw new Error(`l'URL rendue par le Blob n'en est pas une : ${url}`)
  p(`  ✓ ${url.slice(0, 96)}…`)

  const searchText = buildSearchText({ ...doc, annotationsJson: annotations } as never)
  await prisma.$transaction(
    async (tx) => {
      await tx.document.update({
        where: { id: DOC_ID },
        data: { sourcePdfUrl: url, annotationsJson: annotations, searchText },
      })
      await audit(
        {
          action: 'DOC_PUBLISHED',
          targetType: 'Document',
          targetId: DOC_ID,
          meta: {
            source: SOURCE,
            motif:
              'Fac-similé PARTIEL du Moniteur n° 54 du 10 juillet 2002 attaché à la fiche (décision ' +
              '§ 13.3 de Me Vaval, drapeau --facsimile) : 15 des 32 pages imprimées ; pages 12-13 et ' +
              '16-30 manquantes ; la mention de lacune est portée à l’appareil (crossRefs, sec-1) ' +
              'dans la même transaction.',
            fichierEtatAnterieur: fichierEtat,
            facsimile: { octets: buf.length, pages, md5: pdfMd5, chemin: CHEMIN_BLOB },
            lacune: { pagesPresentes: '1-11, 14, 15, 31, 32', pagesManquantes: '12-13 et 16-30' },
            avant: { sourcePdfUrl: doc.sourcePdfUrl, md5AnnotationsJson: md5(doc.annotationsJson ?? '') },
            apres: { sourcePdfUrl: url, md5AnnotationsJson: md5(annotations) },
            md5BodyOriginal: empreinteCorps,
          },
        },
        tx,
      )
    },
    { timeout: 120_000, maxWait: 30_000 },
  )

  // ⚠️ HORS transaction : reindexDocument prend le singleton Prisma et vide le cache.
  await reindexDocument(DOC_ID)

  // ⚠️ audit() avale ses erreurs : « journalisé » se RELIT.
  const journalise = await prisma.auditLog.count({ where: { targetId: DOC_ID, action: 'DOC_PUBLISHED' } })
  const relu = await prisma.document.findUniqueOrThrow({
    where: { id: DOC_ID },
    select: { sourcePdfUrl: true, annotationsJson: true, bodyOriginal: true },
  })
  if (relu.sourcePdfUrl !== url) throw new Error('après écriture : sourcePdfUrl relu ne vaut pas l’URL téléversée')
  if (md5(relu.bodyOriginal) !== empreinteCorps) throw new Error('après écriture : le corps a changé — il ne devait pas')
  if (md5(relu.annotationsJson ?? '') !== md5(annotations)) throw new Error('après écriture : annotationsJson relu n’a pas l’empreinte attendue')
  const annRelu = parseAnnotations(relu.annotationsJson)
  if (!annRelu?.crossRefs?.some((c) => c.anchor === 'sec-1' && (c.note ?? '').includes(SENTINELLE_NOTE)))
    throw new Error('après écriture : la mention de lacune ne se relit pas — le fac-similé ne doit pas rester attaché sans elle')

  p()
  p(`✓ Fac-similé attaché : ${DOC_ID}`)
  p(`  sourcePdfUrl ← ${url.slice(0, 90)}…`)
  p('  mention de lacune portée à l’appareil (crossRefs/sec-1) · corps intact · réindexé')
  if (journalise === 0) {
    p()
    p('⛔ L’ÉCRITURE EST FAITE, MAIS ELLE N’EST PAS JOURNALISÉE.')
    p('   audit() avale ses erreurs ; l’entrée DOC_PUBLISHED n’existe pas en base.')
    p(`   L’état antérieur reste récupérable : ${fichierEtat}`)
    process.exitCode = 1
  } else {
    p(`  journalisé et VÉRIFIÉ en base : DOC_PUBLISHED ×${journalise}`)
  }
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('\nÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
