/**
 * MONITEUR N° 23 DU 3 FÉVRIER 2016 — ATTACHER LES TROIS FAC-SIMILÉS.
 *
 *     npx tsx scripts/attacher-facsimiles-energie-2016.ts            # simulation
 *     npx tsx scripts/attacher-facsimiles-energie-2016.ts --apply    # Me Vaval, elle seule
 *
 * À LANCER APRÈS scripts/importer-decrets-energie-2016.ts --apply : ce script retrouve les trois
 * fiches par leur `source` et refuse de travailler si l'une manque.
 *
 * ⚠️ LE FONDS PDF N'A PAS CE FASCICULE. `MONITEUR_PDF_2016` saute du n° 20 (29 janvier) au n° 24
 * (4 février) : les n° 21, 22 et 23 y manquent. Le fac-similé vient donc de la cliente —
 * « Energie - LM#23- merc. 3 fev.2016.pdf », 30 pages, couvrant exactement les pages 1-18, 23-26
 * et 30-37 du Moniteur, c'est-à-dire les trois décrets transcrits et rien d'autre.
 *
 * ⚠️ LE SCAN EST DÉCOUPÉ, PAS PARTAGÉ. Les trois intervalles de pages sont DISJOINTS et leurs
 * frontières ont été vérifiées page à page sur la couche texte : la p. 19 du scan ouvre le DSIS
 * (« LIBERTÉ ÉGALITÉ FRATERNITÉ / RÉPUBLIQUE D'HAÏTI / DÉCRET », Moniteur p. 23) et la p. 23 ouvre
 * l'ANARSE (Moniteur p. 30). Chaque fiche reçoit donc SES pages — 18 + 4 + 8 = 30, aucune perdue,
 * aucune en double. Le corpus admet aussi le partage d'un même PDF entre deux fiches quand les
 * actes se chevauchent (marchés publics) ; ici ils ne se chevauchent pas, on découpe.
 *
 * ⚠️ LE QUATRIÈME DÉCRET DU FASCICULE N'EST PAS DANS LE SCAN. Celui qui refonde l'Électricité
 * d'Haïti (EDH) commence à la page 38 : ni transcrit, ni scanné, ni versé. Le fac-similé ne le
 * couvre pas et ne prétend pas le couvrir.
 *
 * ─── MÉCANIQUE REPRISE DE scripts/attacher-facsimile-ir-2005.ts ────────────────────────────
 *   · store Vercel Blob PRIVÉ « lam-pdfs » — jamais servi directement au navigateur ;
 *   · chemin DÉTERMINISTE `source-pdf/legislation/<docId>.pdf` + `allowOverwrite` : rejouer le
 *     script ne crée pas un second objet ;
 *   · ⚠️ PIÈGE DU JETON OIDC : `BLOB_READ_WRITE_TOKEN` doit être posé EXPLICITEMENT, sinon le SDK
 *     privilégie le jeton OIDC (lecture bonne, écriture en échec) ;
 *   · lecture par la route AUTHENTIFIÉE `/api/doc/[id]/pdf`.
 */
import { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { uploadToBlob, isBlobUrl } from '../src/lib/storage/blob'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const DIR = join(process.cwd(), 'scripts/data/energie-2016/facsimiles')

/** Empreintes des découpes VÉRIFIÉES : un fichier substitué ne passe pas. */
const PIECES = [
  { source: 'DECRET_ENERGIE_ELECTRIQUE_2016', fichier: 'energie.pdf', pages: 18, moniteur: 'pages 1 à 18',
    sha: 'c2c9856569569e98' },
  { source: 'DECRET_DSIS_2016', fichier: 'dsis.pdf', pages: 4, moniteur: 'pages 23 à 26',
    sha: '820df0ebe62b3460' },
  { source: 'DECRET_ANARSE_2016', fichier: 'anarse.pdf', pages: 8, moniteur: 'pages 30 à 37',
    sha: '631905b9ebddb192' },
] as const

async function main() {
  // ⚠️ LA CHARGE UTILE SE VÉRIFIE AVANT LA BASE. Placés après le contrôle des fiches, l'empreinte
  // et le compte de pages seraient INATTEIGNABLES tant que l'import n'a pas tourné — donc jamais
  // testés (leçon BEL 1984, dans l'autre sens : un garde-fou qu'un autre masque n'existe pas).
  const pieces = PIECES.map((p) => {
    const buf = readFileSync(join(DIR, p.fichier))
    const sha = createHash('sha256').update(buf).digest('hex').slice(0, 16)
    if (sha !== p.sha) throw new Error(`${p.fichier} : empreinte ${sha}, ${p.sha} attendue — pièce substituée. STOP`)
    // Le nombre de pages se lit dans la STRUCTURE du PDF, jamais dans un nom de fichier.
    const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
    if (pages !== p.pages) throw new Error(`${p.fichier} : ${pages} pages, ${p.pages} attendues. STOP`)
    return { ...p, buf }
  })

  const docs = await prisma.document.findMany({
    where: { source: { in: PIECES.map((p) => p.source) } },
    select: { id: true, source: true, titleFr: true, sourcePdfUrl: true },
  })
  if (docs.length !== PIECES.length)
    throw new Error(`${docs.length} fiche(s) sur ${PIECES.length} — lancer d’abord importer-decrets-energie-2016.ts --apply. STOP`)

  // ⚠️ L'IDEMPOTENCE SE TESTE EN PREMIER (leçon BEL 1984 : placée après un autre garde-fou, elle
  // devient inatteignable et la seconde exécution accuse à tort).
  const deja = docs.filter((d) => d.sourcePdfUrl)
  if (deja.length === docs.length) { console.log('les trois fac-similés sont déjà attachés — rien à faire.'); await prisma.$disconnect(); return }
  for (const d of deja)
    if (!isBlobUrl(d.sourcePdfUrl)) throw new Error(`${d.source} porte déjà « ${d.sourcePdfUrl} », qui n’est pas une URL Blob : ne pas écraser sans lire. STOP`)

  const prep = pieces.map((p) => {
    const doc = docs.find((d) => d.source === p.source)
    if (!doc) throw new Error(`${p.source} introuvable. STOP`)
    return { ...p, doc, chemin: `source-pdf/legislation/${doc.id}.pdf` }
  })

  console.log('Fac-similés du Moniteur n° 23 du 3 février 2016 (scan de la cliente, 30 pages, découpé) :\n')
  for (const p of prep)
    console.log(`  ${p.source.padEnd(30)} ${String(p.pages).padStart(2)} p. (${p.moniteur}) · ${String(Math.round(p.buf.length / 1024)).padStart(4)} Ko · ${p.doc.sourcePdfUrl ? 'DÉJÀ attaché' : 'à attacher'}`)
  console.log(`\n  ⚠️ le 4ᵉ décret du fascicule (Électricité d’Haïti, pages 38 et suivantes) n’est pas dans le scan.`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été téléversé ni écrit.'); await prisma.$disconnect(); return }

  // ⚠️ LE JETON, EXPLICITEMENT ET AVANT TOUT APPEL AU BLOB. `npx tsx` ne charge pas `.env` pour
  // process.env : sans cette lecture, le SDK retombe sur le jeton OIDC — lecture bonne, écriture
  // en échec 500 au `put`. Repris de scripts/attacher-facsimile-ir-2005.ts.
  const env = Object.fromEntries(
    readFileSync('.env', 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
  ) as Record<string, string>
  if (env.BLOB_READ_WRITE_TOKEN) process.env.BLOB_READ_WRITE_TOKEN = env.BLOB_READ_WRITE_TOKEN
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    throw new Error('BLOB_READ_WRITE_TOKEN absent de .env — sans jeton explicite, le SDK retombe sur le jeton OIDC et l’écriture échoue en 500 au `put`. STOP')

  for (const p of prep) {
    const url = await uploadToBlob(p.chemin, p.buf, 'application/pdf', { multipart: true })
    if (!isBlobUrl(url)) throw new Error(`l’URL rendue par le Blob n’en est pas une : ${url}. STOP`)
    await prisma.$transaction(async (tx) => {
      await tx.document.update({ where: { id: p.doc.id }, data: { sourcePdfUrl: url } })
      await audit({
        action: 'DOC_PUBLISHED', targetType: 'Document', targetId: p.doc.id,
        meta: {
          motif: `Fac-similé attaché : Le Moniteur, 171ᵉ année, n° 23 du mercredi 3 février 2016, ${p.moniteur} ` +
            `(${p.pages} pages). Découpé du scan de 30 pages fourni par la cliente, dont les trois intervalles ` +
            `sont disjoints et vérifiés page à page. Le fonds MONITEUR_PDF_2016 n’a pas ce fascicule (les n° 21 ` +
            `à 23 y manquent). ⚠️ Le 4ᵉ décret du fascicule — Électricité d’Haïti (EDH), pages 38 et suivantes — ` +
            `n’est ni dans le scan, ni au corpus.`,
          pages: p.pages, sha256: p.sha,
        },
      }, tx)
    }, { timeout: 60_000 })
    console.log(`  ✓ ${p.source.padEnd(30)} ${url.slice(0, 84)}…`)
  }

  // On RELIT la base : audit() avale ses erreurs.
  const ctrl = await prisma.document.findMany({
    where: { source: { in: PIECES.map((p) => p.source) } },
    select: { source: true, sourcePdfUrl: true },
  })
  const sans = ctrl.filter((d) => !isBlobUrl(d.sourcePdfUrl))
  console.log(`\n✓ ${ctrl.length - sans.length}/${ctrl.length} fiches portent un fac-similé${sans.length ? ` — MANQUE : ${sans.map((d) => d.source).join(', ')}` : ''}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
