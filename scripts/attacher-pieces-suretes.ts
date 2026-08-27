/**
 * DÉCRET DU 9 AVRIL 2020 RÉFORMANT LE DROIT DES SÛRETÉS — ATTACHER LES PIÈCES (§§ 7.2, 7.10).
 *
 *     npx tsx scripts/attacher-pieces-suretes.ts             # simulation (filigranes ESSAYÉS
 *                                                            #   en dossier temporaire, gardes
 *                                                            #   rejouées ; 0 octet au Blob,
 *                                                            #   0 écriture en base)
 *     npx tsx scripts/attacher-pieces-suretes.ts --apply     # lancé par Me Vaval, elle seule
 *
 * ─── VOLET 1 (§ 7.2) — LE FAC-SIMILÉ ────────────────────────────────────────────────────────
 * Le Moniteur, Spécial N° 7 du jeudi 14 mai 2020, 175ᵉ année — la copie 24 PAGES de la
 * Dropbox (7 289 690 octets, md5 1a6b5a17…), vérifiée à l'image le 26 août ; JAMAIS la copie
 * 20 pages dégradée (interdit n° 7). Patron : scripts/attacher-facsimile-ir-2005.ts —
 * Blob PRIVÉ « lam-pdfs », chemin déterministe source-pdf/legislation/<docId>.pdf,
 * jeton BLOB_READ_WRITE_TOKEN posé EXPLICITEMENT (piège OIDC), lecture par la route
 * authentifiée /api/doc/[id]/pdf, upload HORS transaction.
 *
 * NOTE DE PORTÉE — contrairement à l'IR 2005 (fascicule amputé aux arts 1-126, deux notes
 * obligatoires), CE fascicule est COMPLET : décret p. 1-23 (signatures ministérielles p. 23),
 * avis PN p. 23 datant les Spéciaux 2020 (§ 13.7), avis aux cabinets p. 24. AUCUNE note de
 * couverture n'est requise dans l'appareil ; une note de provenance sur la fiche resterait un
 * choix éditorial de Me Vaval — ce script n'écrit AUCUNE annotation (annotationsJson
 * byte-identique, vérifié). La portée est consignée au rapport et au journal d'audit.
 *
 * ─── VOLET 2 (§ 7.10) — LE FORMULAIRE RSM-001, DEUX FORMATS ─────────────────────────────────
 * Décidé par Me Vaval le 26 août 2026 : le Bordereau d'Inscription du Registre des Sûretés
 * Mobilières (DGI/MEF) s'attache à la fiche comme FORMULAIRE TÉLÉCHARGEABLE, deux formats —
 * ce n'est PAS une annexe du texte, il n'entre JAMAIS au corps (interdit n° 8 ; le corps est
 * vérifié byte-identique). Canoniques du 26 août, archivées § 7.0 :
 *   · piece-formulaire-rsm001-bordereau-inscription-1.docx (179 077 o, md5 f56ab2a8…, 145 ¶)
 *   · …-remplissable-2.pdf (184 860 o, md5 6c4dc078…, 2 p., 98 champs : 67 /Tx + 31 /Btn)
 * FILIGRANE, selon le verdict des fondations du 26 août (essais sur copies, gardes rejouées) :
 *   · .docx : filigrane Lam du standard annexes (public/brand/Lam_Watermark.png, ancre
 *     behindDoc centrée page, 380×169 px) — garde : 145 ¶ et texte du corps IDENTIQUES ;
 *   · PDF : filigrane SOUS le contenu (pypdf clone_from + merge_page(over=False), PNG RÉDUIT
 *     — pleine taille : 10,4 Mo de sortie) — GARDE IMPÉRATIVE § 7.10 :
 *     get_fields() == 98 (67 /Tx, 31 /Btn), noms identiques, APRÈS tout traitement ;
 *     sinon C'EST L'ORIGINAL QUI EST LIVRÉ, tel quel (un bordereau qu'on ne peut plus
 *     remplir n'est plus un formulaire).
 * Les fichiers vont au Blob PRIVÉ sous formulaires/legislation/<docId>/… et leur inventaire
 * (avec l'encadré éditorial § 7.10 (a)-(e)) dans Document.metaJson.formulaires — clé
 * ADDITIVE, les clés existantes de metaJson sont préservées. ⚠️ La ROUTE de téléchargement
 * authentifiée et le bouton de la fiche restent à construire (séance principale) : ce script
 * prépare et référence les pièces, il ne modifie aucun code de rendu (§ 12.18).
 *
 * Points laissés OUVERTS (fondations du 26 août, non tranchés ici) :
 *   · le pied de page du standard annexes tatoue l'email du TÉLÉCHARGEUR — impossible sur un
 *     fichier statique ; servir à la volée ou statique sans tatouage : choix d'implémentation ;
 *   · le rendu visuel du .docx filigrané n'a pas pu être contrôlé (pas de Word/LibreOffice) ;
 *   · « Loi No. : CL 2008-007 du 13 Février 2009 » est citée TELLE QU'IMPRIMÉE, sans
 *     l'identifier à la Loi du 27 novembre 2008 (§ 13.3).
 */
import { createHash } from 'node:crypto'
import { accessSync, constants, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { prisma } from '../src/lib/db'
import { uploadToBlob, isBlobUrl } from '../src/lib/storage/blob'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const APPLY = process.argv.includes('--apply')
const md5 = (s: string | Buffer) => createHash('md5').update(s as never).digest('hex')

const DIR = join(process.cwd(), 'scripts/data/decret-suretes')
const PIECES = join(DIR, 'pieces-2026-08')
const SOURCE = 'DECRET_SURETES'
const DOC_ID = 'cmrspgd9h0000yn8emki3dtw6'

/** Corps mesuré le 26 août 2026. Ce script NE TOUCHE PAS le corps ; il exige seulement de
 *  savoir duquel il parle — l'état d'avant § 7.3 ou l'état où la tête de l'article 600 a été
 *  restaurée par scripts/maj-decret-suretes-2020.ts (prouvé par substitution inverse). */
const MD5_CORPS_MESURE = 'b5e6522caea217ca891dd1316079ef2d'
const TETE_600_AVANT = 'Article 600.-'
const TETE_600_APRES = 'Article 600 alinéas 3, 4 et 5.-'

/** Le fac-similé — empreintes MESURÉES le 26 août (maj2026-pieces.json). */
const FACSIMILE = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/MONITEURS 2020 InComplet/LES MONITEURS MAI 2020/Le Moniteur Spécial No. 7 Mai 2020.pdf'
const FAC_OCTETS = 7_289_690
const FAC_MD5 = '1a6b5a176fc4d2a33a085b2a82cf6096'
const FAC_PAGES = 24
const CHEMIN_BLOB_FAC = `source-pdf/legislation/${DOC_ID}.pdf`

/** Le formulaire RSM-001 — canoniques du 26 août, archivées (§ 7.0). */
const RSM_DOCX = join(PIECES, 'piece-formulaire-rsm001-bordereau-inscription-1.docx')
const RSM_PDF = join(PIECES, 'piece-formulaire-rsm001-bordereau-inscription-remplissable-2.pdf')
const RSM_DOCX_MD5 = 'f56ab2a87638e5c560c1a56fa2fcce4a'
const RSM_DOCX_OCTETS = 179_077
const RSM_PDF_MD5 = '6c4dc078a52361f4cf96562c2499a327'
const RSM_PDF_OCTETS = 184_860
const RSM_PARAGRAPHES = 145 // 50 ¶ de corps + 95 ¶ en cellules (8 tableaux) — compte cellules COMPRISES
const RSM_CHAMPS = { total: 98, tx: 67, btn: 31 }
const WATERMARK = join(process.cwd(), 'public', 'brand', 'Lam_Watermark.png')
const CHEMIN_BLOB_DOCX = `formulaires/legislation/${DOC_ID}/rsm-001-bordereau-inscription.docx`
const CHEMIN_BLOB_PDF = `formulaires/legislation/${DOC_ID}/rsm-001-bordereau-inscription-remplissable.pdf`

/** Encadré éditorial § 7.10 (a)-(e) — repris des fondations, rien de non prouvé. */
const ENCADRE = {
  a: 'Formulaire administratif DGI/MEF — le formulaire en usage pour les inscriptions au Registre des Sûretés Mobilières, non annexé au texte du décret.',
  b: 'Deux formats : Word et PDF remplissable.',
  c: 'Reproduction, non l’original DGI.',
  d: 'L’en-tête du formulaire vise « Loi No. : CL 2008-007 du 13 Février 2009 » [réf. telle qu’imprimée sur le bordereau].',
  e: 'L’arrêté du Premier Ministre prévu au nouvel article 1839 (organisation du Bureau des Sûretés Mobilières) n’est pas au corpus.',
  regle: 'La référence « CL 2008-007 » est citée telle qu’imprimée, sans l’identifier à la Loi du 27 novembre 2008 — correspondance plausible mais non vérifiée (§ 13.3).',
}

/** Aide Python (pypdf + python-docx + PIL) — écrite en dossier temporaire, jamais au dépôt. */
const PY_HELPER = String.raw`
import json, os, shutil, sys
from PIL import Image
from docx import Document
from docx.oxml.ns import qn
from docx.shared import Emu
from lxml import etree
from pypdf import PdfReader, PdfWriter

wm_src, docx_in, docx_out, pdf_in, pdf_out, tmpd = sys.argv[1:7]
out = {}

# ── PNG réduit (leçon des fondations : pleine taille → 10,4 Mo de PDF) ──
im = Image.open(wm_src)
w0, h0 = im.size
tw = 760
th = round(h0 * tw / w0)
small = im.resize((tw, th), Image.LANCZOS)
wm_small = os.path.join(tmpd, 'wm-small.png')
small.save(wm_small)
out['png'] = {'avant': [w0, h0], 'reduit': [tw, th], 'octets': os.path.getsize(wm_small)}

# ── .docx : filigrane en en-tête, wp:inline → wp:anchor behindDoc=1 page/center ──
def corps_texte(d):
    parts = [p.text for p in d.paragraphs]
    for t in d.tables:
        for row in t.rows:
            for c in row.cells:
                parts.extend(p.text for p in c.paragraphs)
    return '\n'.join(parts)

def compte_wp(d):
    return len(d.element.body.findall('.//' + qn('w:p')))

orig = Document(docx_in)
texte_avant = corps_texte(orig)
wp_avant = compte_wp(orig)

shutil.copyfile(docx_in, docx_out)
doc = Document(docx_out)
header = doc.sections[0].header
hp = header.paragraphs[0] if header.paragraphs else header.add_paragraph()
run = hp.add_run()
run.add_picture(wm_small, width=Emu(380 * 9525), height=Emu(169 * 9525))
drawing = run._r.find(qn('w:drawing'))
inline = drawing.find(qn('wp:inline'))
anchor = etree.SubElement(drawing, qn('wp:anchor'))
for k, v in [('distT', '0'), ('distB', '0'), ('distL', '0'), ('distR', '0'), ('simplePos', '0'),
             ('relativeHeight', '0'), ('behindDoc', '1'), ('locked', '0'), ('layoutInCell', '1'),
             ('allowOverlap', '1')]:
    anchor.set(k, v)
sp = etree.SubElement(anchor, qn('wp:simplePos')); sp.set('x', '0'); sp.set('y', '0')
ph = etree.SubElement(anchor, qn('wp:positionH')); ph.set('relativeFrom', 'page')
etree.SubElement(ph, qn('wp:align')).text = 'center'
pv = etree.SubElement(anchor, qn('wp:positionV')); pv.set('relativeFrom', 'page')
etree.SubElement(pv, qn('wp:align')).text = 'center'
anchor.append(inline.find(qn('wp:extent')))
ee = inline.find(qn('wp:effectExtent'))
if ee is not None:
    anchor.append(ee)
etree.SubElement(anchor, qn('wp:wrapNone'))
anchor.append(inline.find(qn('wp:docPr')))
cnv = inline.find(qn('wp:cNvGraphicFramePr'))
if cnv is not None:
    anchor.append(cnv)
anchor.append(inline.find(qn('a:graphic')))
drawing.remove(inline)
doc.save(docx_out)

relu = Document(docx_out)
hdr_xml = relu.sections[0].header.part.element.xml
out['docx'] = {
    'paragraphesAvant': wp_avant,
    'paragraphesApres': compte_wp(relu),
    'texteIdentique': corps_texte(relu) == texte_avant,
    'ancreBehindDoc': ('behindDoc="1"' in hdr_xml) and ('wrapNone' in hdr_xml),
    'octets': os.path.getsize(docx_out),
}

# ── PDF : page de filigrane 612×1008 pt, fusion SOUS le contenu, champs recomptés ──
def stats(fields):
    tx = sum(1 for f in fields.values() if f.get('/FT') == '/Tx')
    btn = sum(1 for f in fields.values() if f.get('/FT') == '/Btn')
    return {'total': len(fields), 'tx': tx, 'btn': btn}

reader = PdfReader(pdf_in)
f0 = reader.get_fields() or {}
s0 = stats(f0)
scale = 2
page_pt = (612, 1008)
canvas = Image.new('RGB', (page_pt[0] * scale, page_pt[1] * scale), 'white')
logo_w = 285 * scale
logo = im.convert('RGBA')
logo_h = round(logo.size[1] * logo_w / logo.size[0])
logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
flat = Image.alpha_composite(Image.new('RGBA', logo.size, (255, 255, 255, 255)), logo).convert('RGB')
canvas.paste(flat, ((canvas.size[0] - logo_w) // 2, (canvas.size[1] - logo_h) // 2))
wm_pdf = os.path.join(tmpd, 'wm.pdf')
canvas.save(wm_pdf, 'PDF', resolution=72.0 * scale)
wreader = PdfReader(wm_pdf)
writer = PdfWriter(clone_from=reader)
for page in writer.pages:
    page.merge_page(wreader.pages[0], over=False)
with open(pdf_out, 'wb') as f:
    writer.write(f)
r2 = PdfReader(pdf_out)
f1 = r2.get_fields() or {}
out['pdf'] = {
    'avant': s0,
    'apres': stats(f1),
    'nomsIdentiques': sorted(f0.keys()) == sorted(f1.keys()),
    'pages': len(r2.pages),
    'octets': os.path.getsize(pdf_out),
}
print(json.dumps(out))
`

type VerdictFiligrane = {
  png: { avant: [number, number]; reduit: [number, number]; octets: number }
  docx: { paragraphesAvant: number; paragraphesApres: number; texteIdentique: boolean; ancreBehindDoc: boolean; octets: number }
  pdf: { avant: { total: number; tx: number; btn: number }; apres: { total: number; tx: number; btn: number }; nomsIdentiques: boolean; pages: number; octets: number }
}

async function main() {
  const p = (s = '') => console.log(s)

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 0. LE JETON — explicitement, avant tout appel au Blob (piège OIDC, project-pdf-storage)
  // ══════════════════════════════════════════════════════════════════════════════════════════
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
    throw new Error('BLOB_READ_WRITE_TOKEN absent de .env — sans jeton explicite, le SDK retombe sur le jeton OIDC et l’écriture échoue au put.')

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 1. LA FICHE — garde d'unicité (§ 10.6 : PAR SOURCE, jamais par date — DEUX décrets du
  //    9 avril 2020 au corpus), titleFr relu, PREMIÈRE assertion = empreinte du corps
  // ══════════════════════════════════════════════════════════════════════════════════════════
  const candidats = await prisma.document.findMany({ where: { source: SOURCE }, select: { id: true } })
  if (candidats.length !== 1) throw new Error(`§ 10.6 — ${candidats.length} document(s) de source ${SOURCE}, il en faut exactement 1`)
  if (candidats[0].id !== DOC_ID) throw new Error(`§ 10.6 — la fiche de source ${SOURCE} est ${candidats[0].id}, attendu ${DOC_ID}`)
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: DOC_ID } })
  if (doc.titleFr !== 'Décret réformant le Droit des Sûretés')
    throw new Error(`titleFr relu : « ${doc.titleFr} » — pas la fiche attendue, ne rien écrire`)

  const md5Corps = md5(doc.bodyOriginal)
  const lignes = doc.bodyOriginal.split('\n')
  const i600 = lignes.findIndex((l) => l.startsWith(TETE_600_APRES))
  const corpsRestaure =
    i600 >= 0 && md5(lignes.map((l, i) => (i === i600 ? TETE_600_AVANT + l.slice(TETE_600_APRES.length) : l)).join('\n')) === MD5_CORPS_MESURE
  const etatCorps =
    md5Corps === MD5_CORPS_MESURE
      ? 'état mesuré le 26 août 2026 (§ 7.3 non encore appliquée)'
      : corpsRestaure
        ? 'état après scripts/maj-decret-suretes-2020.ts (tête de l’art. 600 restaurée — prouvé par substitution inverse)'
        : null
  if (!etatCorps)
    throw new Error(
      `corps du décret : md5 ${md5Corps} — ni l'état mesuré le 26 août (${MD5_CORPS_MESURE}), ni l'état où seule la tête de ` +
        'l’article 600 a été restaurée. Quelqu’un est passé : re-mesurer avant d’attacher quoi que ce soit.',
    )
  const md5AnnAvant = md5(doc.annotationsJson ?? '')

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 2. LE FAC-SIMILÉ — présent, entier, et bien la copie 24 pages qui fait foi
  // ══════════════════════════════════════════════════════════════════════════════════════════
  let statFac
  try {
    statFac = statSync(FACSIMILE)
  } catch {
    throw new Error(`fac-similé introuvable : ${FACSIMILE}`)
  }
  const bufFac = readFileSync(FACSIMILE)
  if (!bufFac.subarray(0, 5).toString('latin1').startsWith('%PDF-')) throw new Error('fac-similé : en-tête %PDF absent')
  if (bufFac.length !== FAC_OCTETS) throw new Error(`fac-similé : ${bufFac.length} octets, attendu ${FAC_OCTETS} — est-ce la copie 20 pages dégradée ? Elle est INTERDITE (n° 7)`)
  const facMd5 = md5(bufFac)
  if (facMd5 !== FAC_MD5) throw new Error(`fac-similé : md5 ${facMd5}, attendu ${FAC_MD5} — pas la copie vérifiée à l'image le 26 août`)
  const pagesFac = (bufFac.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
  if (pagesFac !== FAC_PAGES) throw new Error(`fac-similé : ${pagesFac} pages comptées, attendu ${FAC_PAGES}`)
  if (doc.sourcePdfUrl && !isBlobUrl(doc.sourcePdfUrl))
    throw new Error(`sourcePdfUrl vaut « ${doc.sourcePdfUrl} », qui n'est pas une URL Blob : ne pas l'écraser sans la lire`)
  const facDejaAttache = isBlobUrl(doc.sourcePdfUrl)

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 3. LE FORMULAIRE — canoniques vérifiées, puis FILIGRANE ESSAYÉ (dossier temporaire) et
  //    gardes § 7.10 REJOUÉES — en simulation comme en --apply
  // ══════════════════════════════════════════════════════════════════════════════════════════
  for (const [f, octets, empreinte] of [
    [RSM_DOCX, RSM_DOCX_OCTETS, RSM_DOCX_MD5],
    [RSM_PDF, RSM_PDF_OCTETS, RSM_PDF_MD5],
  ] as const) {
    if (!existsSync(f)) throw new Error(`canonique introuvable : ${f} — rejouer l'archivage § 7.0`)
    const b = readFileSync(f)
    if (b.length !== octets || md5(b) !== empreinte)
      throw new Error(`${f} : ${b.length} o / md5 ${md5(b)} — pas la canonique du 26 août (${octets} o / ${empreinte})`)
  }
  if (!existsSync(WATERMARK)) throw new Error(`filigrane introuvable : ${WATERMARK}`)

  const tmp = mkdtempSync(join(tmpdir(), 'suretes-pieces-'))
  let verdict: VerdictFiligrane
  const docxFiligrane = join(tmp, 'rsm-001-filigrane.docx')
  const pdfFiligrane = join(tmp, 'rsm-001-filigrane.pdf')
  try {
    const helper = join(tmp, 'filigrane.py')
    writeFileSync(helper, PY_HELPER, 'utf8')
    const sortie = execFileSync('python3', [helper, WATERMARK, RSM_DOCX, docxFiligrane, RSM_PDF, pdfFiligrane, tmp], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    })
    verdict = JSON.parse(sortie.trim().split('\n').pop()!) as VerdictFiligrane

    // ── Gardes § 7.10, rejouées sur le PRODUIT (jamais sur la parole des fondations) ──
    if (verdict.pdf.avant.total !== RSM_CHAMPS.total || verdict.pdf.avant.tx !== RSM_CHAMPS.tx || verdict.pdf.avant.btn !== RSM_CHAMPS.btn)
      throw new Error(`PDF canonique : ${JSON.stringify(verdict.pdf.avant)} champs — attendu ${JSON.stringify(RSM_CHAMPS)} (mauvais fichier)`)
    if (verdict.docx.paragraphesAvant !== RSM_PARAGRAPHES)
      throw new Error(`.docx canonique : ${verdict.docx.paragraphesAvant} ¶ (cellules comprises) — attendu ${RSM_PARAGRAPHES} (un compte naïf par doc.paragraphs rend 50)`)
    const pdfOk =
      verdict.pdf.apres.total === RSM_CHAMPS.total &&
      verdict.pdf.apres.tx === RSM_CHAMPS.tx &&
      verdict.pdf.apres.btn === RSM_CHAMPS.btn &&
      verdict.pdf.nomsIdentiques &&
      verdict.pdf.pages === 2
    const docxOk = verdict.docx.paragraphesApres === verdict.docx.paragraphesAvant && verdict.docx.texteIdentique && verdict.docx.ancreBehindDoc

    // ── Ce qui sera livré : le filigrané si les gardes passent, SINON L'ORIGINAL (§ 7.10) ──
    const pdfALivrer = pdfOk ? pdfFiligrane : RSM_PDF
    const docxALivrer = docxOk ? docxFiligrane : RSM_DOCX
    const bufDocx = readFileSync(docxALivrer)
    const bufPdf = readFileSync(pdfALivrer)

    // ══════════════════════════════════════════════════════════════════════════════════════
    // 4. metaJson — clé ADDITIVE `formulaires` (les clés existantes sont préservées)
    // ══════════════════════════════════════════════════════════════════════════════════════
    let meta: Record<string, unknown> = {}
    if (doc.metaJson) {
      try {
        meta = JSON.parse(doc.metaJson) as Record<string, unknown>
      } catch {
        throw new Error('metaJson existant illisible — ne pas l’écraser sans le lire')
      }
      if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) throw new Error('metaJson existant n’est pas un objet — ne pas l’écraser')
    }
    const formulaireDejaLa = 'formulaires' in meta
    const metaApres = JSON.stringify({
      ...meta,
      formulaires: {
        decision: 'Me Vaval, 26 août 2026 — formulaire téléchargeable, deux formats (§ 7.10). Non annexé au texte du décret.',
        titre: 'Formulaire RSM-001 — Bordereau d’Inscription (Direction du Registre des Sûretés Mobilières, DGI/MEF)',
        encadre: ENCADRE,
        fichiers: [
          {
            format: 'docx',
            blobPath: CHEMIN_BLOB_DOCX,
            octets: bufDocx.length,
            md5: md5(bufDocx),
            filigrane: docxOk,
            sourceCanonique: { fichier: 'piece-formulaire-rsm001-bordereau-inscription-1.docx', md5: RSM_DOCX_MD5 },
          },
          {
            format: 'pdf-remplissable',
            blobPath: CHEMIN_BLOB_PDF,
            octets: bufPdf.length,
            md5: md5(bufPdf),
            filigrane: pdfOk,
            champs: verdict.pdf.apres,
            sourceCanonique: { fichier: 'piece-formulaire-rsm001-bordereau-inscription-remplissable-2.pdf', md5: RSM_PDF_MD5 },
          },
        ],
        avertissement:
          'Route de téléchargement authentifiée et bouton de fiche À CONSTRUIRE — ce champ référence les pièces du Blob privé, il ne les expose pas. ' +
          'Tatouage nominatif par téléchargeur : impossible sur un fichier statique, choix d’implémentation ouvert.',
      },
    })

    // ══════════════════════════════════════════════════════════════════════════════════════
    // RAPPORT
    // ══════════════════════════════════════════════════════════════════════════════════════
    p('══════════════════════════════════════════════════════════════════════════════════')
    p('  PIÈCES — Décret du 9 avril 2020 réformant le Droit des Sûretés')
    p(`  ${doc.id} · source ${SOURCE} · corps : ${etatCorps}`)
    p('══════════════════════════════════════════════════════════════════════════════════')
    p()
    p('─── VOLET 1 (§ 7.2) — LE FAC-SIMILÉ ───────────────────────────────────────────────')
    p(`  ${FACSIMILE}`)
    p(`  ${bufFac.length} octets (${(bufFac.length / 1024 / 1024).toFixed(1)} Mo) · ${pagesFac} pages · md5 ${facMd5} · modifié le ${statFac.mtime.toISOString().slice(0, 10)}`)
    p('  NOTE DE PORTÉE : fascicule COMPLET — décret p. 1-23 (signatures ministérielles p. 23),')
    p('  avis PN p. 23 datant les Spéciaux 2020 (n° 4 Bail pro 11 mai · n° 5 Crédit-Bail 12 mai ·')
    p('  n° 6 Régimes matrimoniaux 13 mai · n° 7 Sûretés 14 mai — § 13.7), avis aux cabinets p. 24.')
    p('  Contrairement à l’IR 2005 : AUCUNE note de couverture requise ; aucune annotation écrite')
    p('  (une note de provenance sur la fiche resterait un choix éditorial de Me Vaval).')
    p(`  destination : Blob PRIVÉ « lam-pdfs » · ${CHEMIN_BLOB_FAC} (déterministe, allowOverwrite)`)
    p(`  lecture : route authentifiée /api/doc/${DOC_ID}/pdf — l'URL Blob n'est jamais exposée`)
    p(`  sourcePdfUrl aujourd'hui : ${doc.sourcePdfUrl ?? 'NULL'}${facDejaAttache ? ' (DÉJÀ attaché — chemin déterministe, même objet écrasé)' : ''}`)
    p('  la copie 20 pages dégradée (1 639 462 o) est INTERDITE (n° 7) — la garde d’empreinte l’écarte')
    p()
    p('─── VOLET 2 (§ 7.10) — LE FORMULAIRE RSM-001, FILIGRANE ESSAYÉ ET GARDES REJOUÉES ─')
    p(`  canoniques du 26 août vérifiées : .docx ${RSM_DOCX_OCTETS} o (md5 ${RSM_DOCX_MD5.slice(0, 8)}…) · PDF ${RSM_PDF_OCTETS} o (md5 ${RSM_PDF_MD5.slice(0, 8)}…)`)
    p(`  filigrane : ${WATERMARK} ${verdict.png.avant.join('×')} → réduit ${verdict.png.reduit.join('×')} (${verdict.png.octets} o)`)
    p()
    p(`  .docx  ¶ (cellules comprises) : ${verdict.docx.paragraphesAvant} → ${verdict.docx.paragraphesApres} · texte du corps identique : ${verdict.docx.texteIdentique} · ancre behindDoc+wrapNone : ${verdict.docx.ancreBehindDoc}`)
    p(`         → ${docxOk ? `FILIGRANÉ (${verdict.docx.octets} o)` : '⛔ gardes en échec — L’ORIGINAL est livré tel quel'}`)
    p(`  PDF    champs : ${JSON.stringify(verdict.pdf.avant)} → ${JSON.stringify(verdict.pdf.apres)} · noms identiques : ${verdict.pdf.nomsIdentiques} · ${verdict.pdf.pages} pages`)
    p(`         → ${pdfOk ? `FILIGRANÉ (${(verdict.pdf.octets / 1024 / 1024).toFixed(1)} Mo)` : '⛔ garde § 7.10 en échec — L’ORIGINAL est livré tel quel (un bordereau qu’on ne peut plus remplir n’est plus un formulaire)'}`)
    p()
    p(`  destination : ${CHEMIN_BLOB_DOCX} · ${CHEMIN_BLOB_PDF} (Blob PRIVÉ, chemins déterministes)`)
    p(`  inventaire : Document.metaJson.formulaires (clé additive${formulaireDejaLa ? ' — DÉJÀ présente, remplacée' : ''} ; clés existantes ${Object.keys(meta).join(', ') || '∅'} préservées)`)
    p('  encadré éditorial § 7.10 (a)-(e) porté dans l’inventaire — « CL 2008-007 » citée telle qu’imprimée (§ 13.3)')
    p()
    p('  OUVERT (non tranché ici) : tatouage nominatif par téléchargeur (impossible en statique) ·')
    p('  rendu visuel du .docx filigrané (pas de Word/LibreOffice sur cette machine) ·')
    p('  route + bouton de téléchargement à construire (aucun code de rendu modifié, § 12.18)')
    p()
    p('CONTRÔLES § 7.10 : le corps du décret n’est PAS touché (byte-identique) · annotationsJson n’est PAS touché')
    p()

    const horodatage = new Date().toISOString().replace(/[:.]/g, '-')
    const fichierEtat = join(DIR, `etat-anterieur-pieces-${horodatage}.json`)
    const etatAnterieur = {
      _lisezMoi:
        'État de la fiche AVANT scripts/attacher-pieces-suretes.ts --apply. Ni le corps ni annotationsJson ne sont touchés ; ' +
        'seuls sourcePdfUrl et metaJson changent.',
      ecritLe: new Date().toISOString(),
      id: doc.id,
      source: SOURCE,
      md5BodyOriginal: md5Corps,
      etatDuCorps: etatCorps,
      md5AnnotationsJson: md5AnnAvant,
      sourcePdfUrl: doc.sourcePdfUrl,
      sourceFileUrl: doc.sourceFileUrl,
      metaJson: doc.metaJson,
      facsimile: { chemin: FACSIMILE, octets: bufFac.length, pages: pagesFac, md5: facMd5, blob: CHEMIN_BLOB_FAC },
      formulaire: {
        docx: { canonique: RSM_DOCX, md5: RSM_DOCX_MD5, livre: docxOk ? 'filigrané' : 'original', md5Livre: md5(bufDocx), blob: CHEMIN_BLOB_DOCX },
        pdf: { canonique: RSM_PDF, md5: RSM_PDF_MD5, livre: pdfOk ? 'filigrané' : 'original', md5Livre: md5(bufPdf), champs: verdict.pdf.apres, blob: CHEMIN_BLOB_PDF },
      },
    }

    if (!APPLY) {
      accessSync(DIR, constants.W_OK)
      p(`ÉTAT ANTÉRIEUR — serait écrit dans ${fichierEtat}`)
      p()
      p('CE QUI SERAIT ÉCRIT')
      p(`  Blob : ${CHEMIN_BLOB_FAC} (${(bufFac.length / 1024 / 1024).toFixed(1)} Mo, multipart) · ${CHEMIN_BLOB_DOCX} (${bufDocx.length} o) · ${CHEMIN_BLOB_PDF} (${(bufPdf.length / 1024 / 1024).toFixed(1)} Mo)`)
      p(`  Document ${DOC_ID} : sourcePdfUrl, metaJson — bodyOriginal et annotationsJson INTACTS`)
      p('  AuditLog : 1 DOC_PUBLISHED · reindexDocument : 1 document, HORS transaction')
      p()
      p('SIMULATION — rien n’a été écrit en base, aucun octet n’est parti sur le Blob')
      p('(les filigranes ont été essayés en dossier temporaire, supprimé). --apply est réservé à Me Vaval.')
      return
    }

    // L'état antérieur AVANT tout : si le fichier ne s'écrit pas, rien n'a bougé (§ 10.7).
    writeFileSync(fichierEtat, JSON.stringify(etatAnterieur, null, 2) + '\n', 'utf8')
    p(`état antérieur sauvegardé : ${fichierEtat}`)

    // ── Uploads HORS transaction (requêtes réseau ; blobs orphelins sans effet, chemins
    //    déterministes → écrasés au prochain passage) ──
    p(`téléversement de ${(bufFac.length / 1024 / 1024).toFixed(1)} Mo vers ${CHEMIN_BLOB_FAC}…`)
    const urlFac = await uploadToBlob(CHEMIN_BLOB_FAC, bufFac, 'application/pdf', { multipart: true })
    if (!isBlobUrl(urlFac)) throw new Error(`l'URL rendue par le Blob n'en est pas une : ${urlFac}`)
    p(`  ✓ ${urlFac.slice(0, 96)}…`)
    const urlDocx = await uploadToBlob(CHEMIN_BLOB_DOCX, bufDocx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const urlPdf = await uploadToBlob(CHEMIN_BLOB_PDF, bufPdf, 'application/pdf', { multipart: true })
    if (!isBlobUrl(urlDocx) || !isBlobUrl(urlPdf)) throw new Error('URL Blob invalide pour le formulaire')
    p(`  ✓ formulaire : ${urlDocx.slice(0, 80)}… · ${urlPdf.slice(0, 80)}…`)
    // Les URLs complètes rejoignent l'inventaire metaJson (privées — servies plus tard par
    // une route authentifiée, jamais exposées au navigateur).
    const metaFinal = JSON.parse(metaApres) as Record<string, any>
    metaFinal.formulaires.fichiers[0].blobUrl = urlDocx
    metaFinal.formulaires.fichiers[1].blobUrl = urlPdf

    const auditAvant = await prisma.auditLog.count()
    await prisma.$transaction(
      async (tx) => {
        await tx.document.update({ where: { id: DOC_ID }, data: { sourcePdfUrl: urlFac, metaJson: JSON.stringify(metaFinal) } })
        await audit(
          {
            action: 'DOC_PUBLISHED',
            targetType: 'Document',
            targetId: DOC_ID,
            meta: {
              source: SOURCE,
              motif:
                'Pièces attachées (§§ 7.2, 7.10) : fac-similé du Journal officiel (Le Moniteur, Spécial N° 7 du 14 mai 2020, ' +
                '24 pages, fascicule COMPLET — décret p. 1-23, aucune note de couverture requise) + Formulaire RSM-001 en deux ' +
                `formats (${docxOk ? 'docx filigrané' : 'docx ORIGINAL (gardes filigrane en échec)'} · ${pdfOk ? 'PDF remplissable filigrané, 98 champs préservés' : 'PDF ORIGINAL (garde § 7.10 : champs non préservés)'}).`,
              fichierEtatAnterieur: fichierEtat,
              // Des EMPREINTES, jamais les contenus (§ 10.7).
              facsimile: { octets: bufFac.length, pages: pagesFac, md5: facMd5, chemin: CHEMIN_BLOB_FAC },
              formulaire: {
                docx: { octets: bufDocx.length, md5: md5(bufDocx), filigrane: docxOk, chemin: CHEMIN_BLOB_DOCX },
                pdf: { octets: bufPdf.length, md5: md5(bufPdf), filigrane: pdfOk, champs: verdict.pdf.apres, chemin: CHEMIN_BLOB_PDF },
              },
              avant: { sourcePdfUrl: doc.sourcePdfUrl, md5MetaJson: md5(doc.metaJson ?? ''), md5BodyOriginal: md5Corps, md5AnnotationsJson: md5AnnAvant },
              apres: { sourcePdfUrl: urlFac, md5MetaJson: md5(JSON.stringify(metaFinal)) },
            },
          },
          tx,
        )
      },
      { timeout: 120_000, maxWait: 30_000 },
    )

    // ⚠️ HORS transaction : reindexDocument (clearSearchCache inclus).
    await reindexDocument(DOC_ID)

    // ⚠️ audit() avale ses erreurs : tout se RELIT (§ 10.4).
    const auditApres = await prisma.auditLog.count()
    const relu = await prisma.document.findUniqueOrThrow({
      where: { id: DOC_ID },
      select: { sourcePdfUrl: true, metaJson: true, bodyOriginal: true, annotationsJson: true },
    })
    if (relu.sourcePdfUrl !== urlFac) throw new Error('après écriture : sourcePdfUrl relu ne vaut pas l’URL téléversée')
    if (md5(relu.bodyOriginal) !== md5Corps) throw new Error('après écriture : LE CORPS A CHANGÉ — il ne devait pas (§ 7.10)')
    if (md5(relu.annotationsJson ?? '') !== md5AnnAvant) throw new Error('après écriture : annotationsJson a changé — il ne devait pas')
    const metaRelu = JSON.parse(relu.metaJson!) as Record<string, any>
    if (!metaRelu.formulaires?.fichiers?.length) throw new Error('après écriture : metaJson.formulaires absent à la relecture')
    for (const k of Object.keys(meta)) if (!(k in metaRelu)) throw new Error(`après écriture : la clé metaJson « ${k} » a disparu`)

    p()
    p(`✓ Pièces attachées : ${DOC_ID}`)
    p(`  sourcePdfUrl ← ${urlFac.slice(0, 88)}…`)
    p(`  formulaires ← metaJson (2 fichiers, ${docxOk ? 'docx filigrané' : 'docx ORIGINAL'} · ${pdfOk ? 'PDF filigrané, 98 champs' : 'PDF ORIGINAL'})`)
    p(`  corps et annotations INTACTS (empreintes relues) · réindexé, cache de recherche vidé`)
    p(`  journal d'audit : ${auditAvant} → ${auditApres} (+${auditApres - auditAvant}, 1 attendue — recompté, audit() avale ses erreurs)`)
    if (auditApres - auditAvant < 1) {
      p('⛔ L’ÉCRITURE EST FAITE MAIS PAS JOURNALISÉE — audit() avale ses erreurs.')
      p(`   État antérieur récupérable : ${fichierEtat}`)
      process.exitCode = 1
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
    await prisma.$disconnect()
  }
}

main().catch(async (e) => {
  console.error('\nÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
