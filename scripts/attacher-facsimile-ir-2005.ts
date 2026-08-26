/**
 * Décret du 29 septembre 2005 relatif à l'Impôt sur le Revenu — ATTACHER LE FAC-SIMILÉ.
 *
 *     npx tsx scripts/attacher-facsimile-ir-2005.ts            # simulation, n'écrit rien
 *     npx tsx scripts/attacher-facsimile-ir-2005.ts --apply    # lancé par Me Vaval, elle seule
 *
 * Le fascicule du Journal officiel — Le Moniteur, Spécial n° 10, 160ᵉ année, mercredi 5 octobre
 * 2005, 36 pages — a servi d'ARBITRE tout le 25 août 2026, et la fiche ne le porte pas :
 * `sourcePdfUrl` et `sourceFileUrl` sont NULL. Ce serait le premier fac-similé de ce texte au
 * corpus. Le script le téléverse sur le Blob PRIVÉ et renseigne `sourcePdfUrl`.
 *
 * ─── LA MÉCANIQUE EST REPRISE, PAS INVENTÉE ────────────────────────────────────────────────
 * Modèle : `scripts/_attach-imf-pdf.ts` (Décret IMF 2020, premier fac-similé de la plateforme).
 *   · store Vercel Blob PRIVÉ « lam-pdfs » — le blob n'est JAMAIS servi directement ;
 *   · chemin DÉTERMINISTE `source-pdf/legislation/<docId>.pdf` + `allowOverwrite` : rejouer le
 *     script ne crée pas un second objet ;
 *   · `multipart: true` — 23 Mo passent mal en une seule requête ;
 *   · ⚠️ PIÈGE DU JETON OIDC : `BLOB_READ_WRITE_TOKEN` est passé EXPLICITEMENT. Sans lui, le SDK
 *     privilégie le jeton OIDC (lecture OK, écriture en échec). `src/lib/storage/blob.ts` le lit
 *     à l'APPEL et non au chargement du module — le poser dans `main()` suffit et évite toute
 *     question d'ordre d'évaluation des imports.
 *   · lecture : route AUTHENTIFIÉE `/api/doc/[id]/pdf` (session + `canReadService` + — hors
 *     circulaires BRH — `canSeeSourcePdf`). L'URL Blob n'est jamais exposée au navigateur.
 *
 * ─── LE FAC-SIMILÉ NE COUVRE QUE LES ARTICLES 1 À 126, ET LA FICHE DOIT LE DIRE ────────────
 * MESURÉ sur sa couche texte (`piece-jo-2005-facsimile-couche-texte.txt`, 1 842 lignes) :
 * la dernière tête d'article est « Article 126.- » (ligne 1 838) et le fichier s'arrête sur
 * « Cette déclaration doit comporter: » — au milieu d'une énumération. « Article 127 » n'y
 * paraît qu'une fois, comme RENVOI dans le corps de l'article 19, jamais comme tête.
 *
 * Le bouton de la fiche porte le libellé générique « PDF source » (`t.doc.source`,
 * `src/lib/i18n/locales/fr.ts` l. 714, partagé par tout le corpus) : on ne peut pas le
 * particulariser sans toucher aux traductions de tous les documents. La mention va donc à DEUX endroits, tous deux dans l'appareil de CE document :
 *   1. la note de provenance en tête de fiche (`crossRefs`, ancre `sec-1`) — celle que lit
 *      quiconque ouvre le document par le haut, à côté du bouton ;
 *   2. la note de l'article 126 (`commentaires`, clé `sec-52|art-126`) — celle qui marque déjà
 *      la frontière, et qui devient INEXACTE une fois le fac-similé joint : elle parle du
 *      « fascicule transmis à la rédaction », pièce privée, alors qu'il sera sur la fiche.
 *
 * ─── ORDRE AVEC scripts/reprise-ir-2005.ts ─────────────────────────────────────────────────
 * INDIFFÉRENT. Ce script ne touche pas au corps ; il accepte les DEUX empreintes possibles
 * (avant et après la reprise) et les deux passages se composent : `reprise-ir-2005.ts` recopie
 * l'intégralité de `annotationsJson` et n'en réécrit que `commentaires`, où il ajoute des clés
 * sans toucher au texte que celui-ci réécrit.
 */
import { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'
import { accessSync, constants, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseAnnotations, type CrossRefEntry } from '../src/lib/legislation/annotated'
import { uploadToBlob, isBlobUrl } from '../src/lib/storage/blob'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

const DIR = join(process.cwd(), 'scripts/data/decret-ir-2005')
const SOURCE = 'DECRET_IMPOT_REVENU_2005'
const DOC_ID = 'cms43ptub00008lo8tv3y25kk'
const PDF = '/Users/cvaval/Downloads/Decret 2005 IR.pdf'
const CHEMIN_BLOB = `source-pdf/legislation/${DOC_ID}.pdf`

/** Les DEUX états admis du corps : avant la reprise du 25 août, et après. Le script ne touche
 *  pas au corps — il exige seulement de savoir DUQUEL il parle. */
const CORPS_ADMIS: Record<string, string> = {
  da6b03f3df2032c1dc265ae0cca79315: 'état du 25 août 11 h 04 (743 lignes) — la reprise n’a pas encore été appliquée',
  '720974af182dbfc31c176cd18c6fcaf5': 'état après scripts/reprise-ir-2005.ts (732 lignes)',
}
/** Empreinte du fascicule relevée le 25 août 2026. Un autre PDF sous le même nom s'arrête ici. */
const PDF_MD5 = '0654990a76ae289e9650c37da0e4a535'
const PDF_OCTETS = 24_344_390
const PDF_PAGES = 36

const md5 = (s: string | Buffer) => createHash('md5').update(s as never).digest('hex')

type AnnotationsBrutes = {
  crossRefs: CrossRefEntry[]
  commentaires: Record<string, string[]>
  [k: string]: unknown
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// LES DEUX MENTIONS, ÉCRITES ICI ET NULLE PART AILLEURS
// ══════════════════════════════════════════════════════════════════════════════════════════
const PHRASE_SEC1 =
  ' Le fac-similé du Journal officiel joint à cette fiche — Le Moniteur, Spécial n° 10, ' +
  '160ᵉ année, mercredi 5 octobre 2005, 36 pages — reproduit le fascicule tel qu’il a été ' +
  'publié. ⚠️ Il ne couvre que les articles 1 à 126 : il s’interrompt à l’article 126, au ' +
  'milieu d’une phrase, et ne porte ni les articles 127 à 189 ni la formule de clôture. Pour ' +
  'ces articles-là, le texte affiché ici est celui de l’édition consolidée de 2018 et aucune ' +
  'pièce faisant foi n’est jointe.'

const NOTE_126_AVANT =
  'Le niveau « Sous Section » du sommaire s’arrête ici : le décret n’en porte plus au-delà de ' +
  'l’article 126. Le fascicule du Moniteur transmis à la rédaction s’interrompt lui aussi à cet ' +
  'article, au milieu d’une phrase ; les articles 127 à 189 sont donnés d’après l’édition ' +
  'consolidée de 2018.'
const NOTE_126_APRES =
  'Le niveau « Sous Section » du sommaire s’arrête ici : le décret n’en porte plus au-delà de ' +
  'l’article 126. Le fac-similé du Journal officiel joint à cette fiche (Le Moniteur, Spécial ' +
  'n° 10 du 5 octobre 2005, 36 pages) s’interrompt lui aussi à cet article, au milieu d’une ' +
  'phrase : sa dernière tête d’article est « Article 126.- » et le fascicule s’arrête sur les ' +
  'mots « Cette déclaration doit comporter: ». Les articles 127 à 189 sont donnés d’après ' +
  'l’édition consolidée de 2018, sans pièce faisant foi.'

async function main() {
  const p = (s = '') => console.log(s)

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 0. LE JETON — explicitement, avant tout appel au Blob (piège OIDC)
  // ════════════════════════════════════════════════════════════════════════════════════════
  const env = Object.fromEntries(
    readFileSync('.env', 'utf8')
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
      'BLOB_READ_WRITE_TOKEN absent de .env — sans jeton explicite, le SDK retombe sur le jeton ' +
        'OIDC et l’écriture échoue en 500 au `put`.',
    )

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 1. LA FICHE, ET SES GARDES
  // ════════════════════════════════════════════════════════════════════════════════════════
  const candidats = await prisma.document.findMany({ where: { source: SOURCE }, select: { id: true } })
  if (candidats.length !== 1) throw new Error(`${candidats.length} document(s) de source ${SOURCE}, il en faut exactement 1`)
  if (candidats[0].id !== DOC_ID) throw new Error(`la fiche de source ${SOURCE} est ${candidats[0].id}, attendu ${DOC_ID}`)
  const garde = await prisma.document.count({
    where: { type: 'LEGISLATION', OR: [{ titleFr: { contains: 'Impôt sur le Revenu' } }, { number: { contains: '29 septembre 2005' } }] },
  })
  if (garde !== 1) throw new Error(`${garde} fiches candidates, il en faut exactement 1`)
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: DOC_ID } })

  // Empreinte du corps EN PREMIÈRE ASSERTION. Le script ne modifie pas le corps, mais les
  // notes qu'il écrit décrivent un texte précis : s'il a changé sous une troisième main, la
  // description peut être fausse.
  const md5Corps = md5(doc.bodyOriginal)
  const etatCorps = CORPS_ADMIS[md5Corps]
  if (!etatCorps)
    throw new Error(
      `corps : md5 ${md5Corps}, aucun des deux états admis (${Object.keys(CORPS_ADMIS).join(', ')}). ` +
        'Quelqu’un est passé après la reprise du 25 août 2026 : relire le corps avant d’écrire une note qui le décrit.',
    )

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 2. LE FASCICULE — présent, entier, et bien celui qui a servi d'arbitre
  // ════════════════════════════════════════════════════════════════════════════════════════
  let stat
  try {
    stat = statSync(PDF)
  } catch {
    throw new Error(`fac-similé introuvable : ${PDF}`)
  }
  const buf = readFileSync(PDF)
  const pdfMd5 = md5(buf)
  if (!buf.subarray(0, 5).toString('latin1').startsWith('%PDF-')) throw new Error(`${PDF} n’est pas un PDF (en-tête absent)`)
  if (buf.length !== PDF_OCTETS) throw new Error(`fac-similé : ${buf.length} octets, attendu ${PDF_OCTETS}`)
  if (pdfMd5 !== PDF_MD5)
    throw new Error(
      `fac-similé : md5 ${pdfMd5}, attendu ${PDF_MD5}. Ce n’est pas le fichier qui a servi d’arbitre le 25 août ; ` +
        'les mentions « articles 1 à 126 » écrites par ce script ne le décriraient pas.',
    )
  const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
  if (pages !== PDF_PAGES) throw new Error(`fac-similé : ${pages} pages comptées, attendu ${PDF_PAGES}`)

  // La couche texte, pièce de contrôle de la mention « 1 à 126 » : on ne l'affirme pas, on la mesure.
  const couche = readFileSync(join(DIR, 'piece-jo-2005-facsimile-couche-texte.txt'), 'utf8')
  const tetesCouche = [...couche.matchAll(/^\s*Article\s+(\d+(?:-\d+)?)\s*\.?-/gm)].map((m) => m[1])
  const derniere = tetesCouche[tetesCouche.length - 1]
  if (derniere !== '126')
    throw new Error(`couche texte du fac-similé : dernière tête d’article « ${derniere} », attendu « 126 »`)
  if (!couche.trimEnd().endsWith('Cette déclaration doit comporter:'))
    throw new Error('couche texte du fac-similé : le fascicule ne s’arrête plus là où la note l’annonce')

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 3. IDEMPOTENCE — un fac-similé déjà attaché ne se réattache pas à l'aveugle
  // ════════════════════════════════════════════════════════════════════════════════════════
  if (doc.sourcePdfUrl && !isBlobUrl(doc.sourcePdfUrl))
    throw new Error(`sourcePdfUrl vaut « ${doc.sourcePdfUrl} », qui n’est pas une URL Blob : ne pas l’écraser sans la lire`)
  const dejaAttache = isBlobUrl(doc.sourcePdfUrl)

  // ════════════════════════════════════════════════════════════════════════════════════════
  // 4. LES DEUX MENTIONS
  // ════════════════════════════════════════════════════════════════════════════════════════
  const brut = JSON.parse(doc.annotationsJson!) as AnnotationsBrutes
  if (!parseAnnotations(doc.annotationsJson)) throw new Error('annotationsJson illisible')

  const crossRefs = brut.crossRefs.map((c) => ({ ...c }))
  const iSec1 = crossRefs.findIndex((c) => c.anchor === 'sec-1')
  if (iSec1 < 0) throw new Error('la note de provenance (crossRefs, ancre sec-1) a disparu : rien où accrocher la mention')
  const noteSec1Avant = crossRefs[iSec1].note ?? ''
  if (!noteSec1Avant.startsWith('Texte CONSOLIDÉ : Décret du 29 septembre 2005'))
    throw new Error(`la note sec-1 n’est plus celle du relevé — la relire avant d’y ajouter une phrase :\n  ${noteSec1Avant.slice(0, 120)}…`)
  const sec1DejaFait = noteSec1Avant.includes('Le fac-similé du Journal officiel joint à cette fiche')
  const noteSec1Apres = sec1DejaFait ? noteSec1Avant : noteSec1Avant + PHRASE_SEC1
  crossRefs[iSec1] = { ...crossRefs[iSec1], note: noteSec1Apres }

  const commentaires: Record<string, string[]> = Object.fromEntries(
    Object.entries(brut.commentaires).map(([k, v]) => [k, [...v]]),
  )
  const CLE_126 = 'sec-52|art-126'
  const liste126 = commentaires[CLE_126]
  if (!liste126) throw new Error(`la clé « ${CLE_126} » n’existe pas : la note de frontière de l’article 126 a disparu`)
  const i126 = liste126.indexOf(NOTE_126_AVANT)
  const note126DejaFaite = liste126.includes(NOTE_126_APRES)
  if (i126 < 0 && !note126DejaFaite)
    throw new Error(
      `la note de l’article 126 n’est ni celle du relevé ni celle que ce script écrit. Elle a changé : la relire.\n  en base : ` +
        JSON.stringify(liste126[0]?.slice(0, 160)),
    )
  if (i126 >= 0) liste126[i126] = NOTE_126_APRES
  commentaires[CLE_126] = liste126

  const annotations = JSON.stringify({ ...brut, crossRefs, commentaires })
  if (!parseAnnotations(annotations)) throw new Error('le JSON produit n’est pas relisible par parseAnnotations')
  // Garde de non-débordement : SEULES ces deux valeurs bougent.
  {
    const a = JSON.parse(doc.annotationsJson!) as AnnotationsBrutes
    const b = JSON.parse(annotations) as AnnotationsBrutes
    if (Object.keys(a).join('|') !== Object.keys(b).join('|')) throw new Error('les clés de premier niveau d’annotationsJson ont bougé')
    if (a.crossRefs.length !== b.crossRefs.length) throw new Error('le nombre de crossRefs a bougé')
    if (Object.keys(a.commentaires).length !== Object.keys(b.commentaires).length) throw new Error('le nombre de clés de commentaires a bougé')
    if (Object.values(a.commentaires).flat().length !== Object.values(b.commentaires).flat().length)
      throw new Error('le nombre d’entrées de commentaires a bougé')
    const inchange = (o: AnnotationsBrutes) =>
      JSON.stringify({
        ...o,
        crossRefs: o.crossRefs.map((c, i) => (i === iSec1 ? { ...c, note: '' } : c)),
        commentaires: { ...o.commentaires, [CLE_126]: o.commentaires[CLE_126].map((t, i) => (i === Math.max(i126, 0) ? '' : t)) },
      })
    if (inchange(a) !== inchange(b)) throw new Error('annotationsJson : autre chose que les deux notes attendues a changé')
  }

  // ════════════════════════════════════════════════════════════════════════════════════════
  // RAPPORT
  // ════════════════════════════════════════════════════════════════════════════════════════
  p('══════════════════════════════════════════════════════════════════════════════════')
  p('  FAC-SIMILÉ DU JOURNAL OFFICIEL — Décret du 29 septembre 2005 sur l’Impôt sur le Revenu')
  p(`  ${doc.id} · source ${SOURCE} · corps : ${etatCorps}`)
  p('══════════════════════════════════════════════════════════════════════════════════')
  p()
  p('LE FICHIER')
  p(`  ${PDF}`)
  p(`  ${buf.length} octets (${(buf.length / 1024 / 1024).toFixed(1)} Mo) · ${pages} pages · md5 ${pdfMd5}`)
  p(`  modifié le ${stat.mtime.toISOString().slice(0, 10)} · en-tête %PDF ✓`)
  p()
  p('CE QUE LE FASCICULE COUVRE — MESURÉ, PAS SUPPOSÉ')
  p(`  couche texte : ${couche.split('\n').length} lignes · ${tetesCouche.length} têtes d’article`)
  p(`  première tête RELEVÉE : Article ${tetesCouche[0]} · DERNIÈRE : Article ${derniere}`)
  p(`  (la tête de l’article 1 est bien au fascicule — l’OCR l’écrit « Article 1.· », point-médian`)
  p(`  au lieu du tiret, et le relevé ne la compte pas. Ce n’est pas une lacune du fascicule.)`)
  p(`  le fascicule s’arrête sur « Cette déclaration doit comporter: » — au milieu d’une énumération`)
  p(`  « Article 127 » n’y paraît qu’une fois, comme RENVOI dans le corps de l’article 19 : jamais comme tête`)
  p(`  ⇒ les articles 127 à 189 et la formule de clôture NE SONT PAS au fac-similé`)
  p()
  p('DESTINATION')
  p(`  store Vercel Blob PRIVÉ « lam-pdfs » · chemin déterministe ${CHEMIN_BLOB}`)
  p(`  allowOverwrite + addRandomSuffix:false + multipart ⇒ rejouer le script ne crée pas un second objet`)
  p(`  lecture par la route AUTHENTIFIÉE /api/doc/${DOC_ID}/pdf — l’URL Blob n’est jamais exposée`)
  p(`  qui verra le bouton « PDF source » : le personnel (isStaff) et tout compte portant canViewSourcePdf,`)
  p(`  sous réserve de canReadService('LEGISLATION'). Ce n’est pas une circulaire BRH : pas de`)
  p(`  téléchargement ouvert, affichage inline.`)
  p(`  champ écrit : Document.sourcePdfUrl (${doc.sourcePdfUrl ?? 'NULL'} aujourd’hui)`)
  p(`  champ NON écrit : Document.sourceFileUrl — il archive le .docx d'ORIGINE, pas un fac-similé.`)
  p(`  Le laisser NULL n’est pas un oubli ; s’il faut y archiver le .docx de la cliente, c’est une`)
  p(`  autre écriture et une autre décision.`)
  p()
  p('LES DEUX MENTIONS « ARTICLES 1 À 126 »')
  p(`  ⚠ le bouton porte le libellé générique « PDF source » (t.doc.source, src/lib/i18n/locales/fr.ts`)
  p(`    l. 714), partagé par tout le corpus : le particulariser toucherait les traductions de TOUS`)
  p(`    les documents. La mention va donc dans l’appareil de CE document, à deux endroits.`)
  p()
  p(`  1. NOTE DE PROVENANCE EN TÊTE DE FICHE — crossRefs, ancre sec-1 ${sec1DejaFait ? '(DÉJÀ FAITE)' : ''}`)
  p(`     ${noteSec1Avant.length} → ${noteSec1Apres.length} caractères · la note existante n’est pas réécrite, la phrase s’ajoute`)
  p(`     ajout : « ${PHRASE_SEC1.trim()} »`)
  p()
  p(`  2. NOTE DE L’ARTICLE 126 — commentaires, clé ${CLE_126} ${note126DejaFaite ? '(DÉJÀ FAITE)' : ''}`)
  p(`     Elle DEVIENT INEXACTE une fois le fac-similé joint : elle parle du « fascicule transmis à la`)
  p(`     rédaction », pièce privée, alors qu’il sera sur la fiche. La rectifier fait partie de`)
  p(`     l’attachement, elle n’en est pas la suite.`)
  p(`     avant : « ${NOTE_126_AVANT} »`)
  p(`     après : « ${NOTE_126_APRES} »`)
  p()
  p('CONTRÔLE DE NON-DÉBORDEMENT')
  p(`  crossRefs : ${brut.crossRefs.length} (inchangé) · commentaires : ${Object.keys(brut.commentaires).length} clés / ` +
    `${Object.values(brut.commentaires).flat().length} entrées (inchangé)`)
  p(`  annotationsJson : ${doc.annotationsJson!.length} → ${annotations.length} caractères`)
  p(`  hors les deux notes, le JSON est IDENTIQUE — vérifié par comparaison des deux objets ✓`)
  p(`  bodyOriginal : NON TOUCHÉ (md5 ${md5Corps})`)
  p()
  if (dejaAttache) {
    p(`ÉTAT : un fac-similé est DÉJÀ attaché (${doc.sourcePdfUrl!.slice(0, 72)}…).`)
    p(`  Le chemin est déterministe : le téléversement écrasera le même objet, l’URL ne changera pas.`)
    p()
  }

  const horodatage = new Date().toISOString().replace(/[:.]/g, '-')
  const fichierEtat = join(DIR, `etat-anterieur-facsimile-${horodatage}.json`)
  const etatAnterieur = {
    _lisezMoi:
      'État de la fiche AVANT le passage de scripts/attacher-facsimile-ir-2005.ts --apply. ' +
      'Le corps n’est pas touché ; seuls sourcePdfUrl et deux notes d’annotationsJson changent.',
    ecritLe: new Date().toISOString(),
    id: doc.id,
    source: SOURCE,
    md5BodyOriginal: md5Corps,
    etatDuCorps: etatCorps,
    sourcePdfUrl: doc.sourcePdfUrl,
    sourceFileUrl: doc.sourceFileUrl,
    annotationsJson: doc.annotationsJson,
    facsimile: { chemin: PDF, octets: buf.length, pages, md5: pdfMd5, blob: CHEMIN_BLOB },
  }
  const poids = Buffer.byteLength(JSON.stringify(etatAnterieur, null, 2), 'utf8')

  if (!APPLY) {
    accessSync(DIR, constants.W_OK)
    p(`ÉTAT ANTÉRIEUR — serait écrit dans ${fichierEtat}`)
    p(`  ${poids} octets · annotations ${doc.annotationsJson!.length} car.`)
    p()
    p('CE QUI SERAIT ÉCRIT')
    p(`  Blob   : ${CHEMIN_BLOB} (${(buf.length / 1024 / 1024).toFixed(1)} Mo, multipart, privé)`)
    p(`  Document ${DOC_ID} : sourcePdfUrl, annotationsJson, searchText`)
    p(`  AuditLog : 1 DOC_PUBLISHED`)
    p(`  reindexDocument : 1 document, HORS transaction`)
    p()
    p('SIMULATION — rien n’a été écrit, aucun octet n’est parti sur le Blob.')
    await prisma.$disconnect()
    return
  }

  // L'état antérieur AVANT tout : si le fichier ne s'écrit pas, rien n'a bougé.
  writeFileSync(fichierEtat, JSON.stringify(etatAnterieur, null, 2) + '\n', 'utf8')
  p(`état antérieur sauvegardé : ${fichierEtat} (${poids} octets)`)

  // Le téléversement est HORS transaction : ce n'est pas une écriture de base, et une requête
  // réseau de 23 Mo n'a rien à faire dans une transaction Postgres. Si la transaction échouait
  // après coup, le blob resterait orphelin — privé, non référencé, sans effet visible, et
  // écrasé au prochain passage puisque le chemin est déterministe.
  p(`téléversement de ${(buf.length / 1024 / 1024).toFixed(1)} Mo vers ${CHEMIN_BLOB}…`)
  const url = await uploadToBlob(CHEMIN_BLOB, buf, 'application/pdf', { multipart: true })
  if (!isBlobUrl(url)) throw new Error(`l’URL rendue par le Blob n’en est pas une : ${url}`)
  p(`  ✓ ${url.slice(0, 96)}…`)

  const searchText = buildSearchText({ ...doc, annotationsJson: annotations } as never)
  await prisma.$transaction(
    async (tx) => {
      await tx.document.update({ where: { id: DOC_ID }, data: { sourcePdfUrl: url, annotationsJson: annotations, searchText } })
      await audit(
        {
          action: 'DOC_PUBLISHED',
          targetType: 'Document',
          targetId: DOC_ID,
          meta: {
            source: SOURCE,
            motif:
              'Fac-similé du Journal officiel (Le Moniteur, Spécial n° 10 du 5 octobre 2005, 36 pages) attaché à la ' +
              'fiche — premier fac-similé de ce texte au corpus. Il ne couvre que les articles 1 à 126 : la note de ' +
              'provenance (sec-1) et la note de l’article 126 le disent au lecteur.',
            fichierEtatAnterieur: fichierEtat,
            // Des EMPREINTES, jamais le corps ni les annotations en entier.
            facsimile: { octets: buf.length, pages, md5: pdfMd5, chemin: CHEMIN_BLOB },
            couverture: { premierArticle: tetesCouche[0], dernierArticle: derniere, nonCouverts: '127 à 189 + formule de clôture' },
            avant: { sourcePdfUrl: doc.sourcePdfUrl, md5AnnotationsJson: md5(doc.annotationsJson ?? '') },
            apres: { sourcePdfUrl: url, md5AnnotationsJson: md5(annotations) },
            md5BodyOriginal: md5Corps,
            notes: ['crossRefs/sec-1', CLE_126],
          },
        },
        tx,
      )
    },
    { timeout: 120_000, maxWait: 30_000 },
  )

  // ⚠️ HORS TRANSACTION : reindexDocument prend le singleton Prisma, pas `tx`, et c'est
  // clearSearchCache() qui empêche la recherche de servir l'ancien texte depuis son cache.
  await reindexDocument(DOC_ID)

  // ⚠️ audit() avale ses erreurs (src/lib/auth/audit.ts l. 85-87) : « journalisé » se RELIT.
  const journalise = await prisma.auditLog.count({ where: { targetId: DOC_ID, action: 'DOC_PUBLISHED' } })
  const relu = await prisma.document.findUniqueOrThrow({
    where: { id: DOC_ID },
    select: { sourcePdfUrl: true, annotationsJson: true, bodyOriginal: true },
  })
  if (relu.sourcePdfUrl !== url) throw new Error('après écriture : sourcePdfUrl relu ne vaut pas l’URL téléversée')
  if (md5(relu.bodyOriginal) !== md5Corps) throw new Error('après écriture : le corps a changé — il ne devait pas')
  if (md5(relu.annotationsJson ?? '') !== md5(annotations)) throw new Error('après écriture : annotationsJson relu n’a pas l’empreinte attendue')

  p()
  p(`✓ Fac-similé attaché : ${DOC_ID}`)
  p(`  sourcePdfUrl ← ${url.slice(0, 90)}…`)
  p(`  2 notes portées à l’appareil (crossRefs/sec-1, ${CLE_126}) · corps intact · réindexé`)
  if (journalise === 0) {
    p()
    p('⛔ L’ÉCRITURE EST FAITE, MAIS ELLE N’EST PAS JOURNALISÉE.')
    p('   `audit()` avale ses erreurs ; l’entrée DOC_PUBLISHED n’existe pas en base.')
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
