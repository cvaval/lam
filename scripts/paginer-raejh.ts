/**
 * RAEJH — PAGE DU FAC-SIMILÉ POUR CHAQUE EXTRAIT, ET LE PDF SUR CHAQUE ARRÊT CRÉÉ.
 *
 *     npx tsx scripts/paginer-raejh.ts            # simulation
 *     npx tsx scripts/paginer-raejh.ts --apply    # écrit JurisExtrait.page + Document.sourcePdfUrl
 *
 * ─── LE FAC-SIMILÉ DE RÉFÉRENCE, CE SONT LES TROIS TOMES — PAS `RAEJH_full.pdf` ─────────────
 * ⚠️ `RAEJH_full.pdf` (882 p.) EST DÉFECTUEUX : tome I, puis tome II, puis LE TOME II UNE SECONDE
 * FOIS (219 pages identiques sur 219, mesuré), et jamais le tome III — qui porte à lui seul les
 * notions de M à V (586 p., « Avril 2021, Pro Éditions »). Un premier alignement sur ce fichier
 * perdait 286 notions, tout un pan de l'alphabet. Trois objets sur le Blob, `tome` (1, 2, 3) et
 * `page` dans le PDF de ce tome. Chaque arrêt créé reçoit l'URL du tome de son premier extrait
 * (les arrêts existants gardent leur propre fac-similé s'ils en ont un — on ne l'écrase pas).
 *
 * ─── L'ALIGNEMENT ──────────────────────────────────────────────────────────────────────────
 * La couche texte (Acrobat 11 Paper Capture, ~2 000 c./page) est bonne pour CHERCHER, pas
 * pour citer : accents perdus, « lere section », « Arret ». On replie donc des deux côtés
 * (minuscules, sans accents, sans espaces) et on cherche :
 *   1. la NOTION — le livre est alphabétique, le curseur ne recule jamais ;
 *   2. sous elle, chaque ENTRÉE par sa date « du 23 mai 1967 » ET un nom propre des parties,
 *      dans les 12 pages qui suivent la notion ; à défaut, la page de la notion.
 * Une notion introuvable est rapportée ; ses extraits restent sans page. Rien n'est deviné.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { uploadToBlob, isBlobUrl } from '../src/lib/storage/blob'

const DOSSIER = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/Recueil Jurisprudences JFS'
const TOMES = [1, 2, 3].map((t) => ({ tome: t, pdf: `${DOSSIER}/RAEJH_Tome-${['I', 'II', 'III'][t - 1]}.pdf`, blob: `source-pdf/jurisprudence/raejh-sales-tome-${t}.pdf` }))
const APPLY = process.argv.includes('--apply')

const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
if (env.BLOB_READ_WRITE_TOKEN) process.env.BLOB_READ_WRITE_TOKEN = env.BLOB_READ_WRITE_TOKEN
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const serre = (s: string) => fold(s).replace(/[^a-z0-9]+/g, '')
const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre']
const CREUX = new Set(['compagnie', 'societe', 'consorts', 'pourvoi', 'ministere', 'public', 'haytian', 'haitian', 'american', 'company', 'sugar'])

async function main() {
  console.log(`\n══ PAGINATION ${APPLY ? '(ÉCRITURE)' : '(simulation)'} — trois tomes ══`)
  const notions = JSON.parse(readFileSync('scripts/data/raejh-sales/notions.json', 'utf8')) as { label: string; slug: string; virtuel: boolean }[]
  const labelParSlug = new Map(notions.map((n) => [n.slug, n.label]))
  const extraits = await prisma.jurisExtrait.findMany({
    select: { id: true, rang: true, page: true, theme: { select: { slug: true } }, decision: { select: { id: true, publicationDate: true, titleFr: true } } },
  })
  const parNotion = new Map<string, typeof extraits>()
  for (const e of extraits) parNotion.set(e.theme.slug, [...(parNotion.get(e.theme.slug) ?? []), e])
  const slugs = [...parNotion.keys()].sort((a, b) => (labelParSlug.get(a) ?? a).localeCompare(labelParSlug.get(b) ?? b, 'fr'))
  const cles = slugs.map((sl) => [sl, serre(labelParSlug.get(sl) ?? '')] as const).filter(([, k]) => k.length >= 3)
  const slugParCle = new Map(cles.map(([sl, k]) => [k, sl]))
  const trig = (x: string) => { const t = ` ${x} `; const o = new Set<string>(); for (let i = 0; i + 3 <= t.length; i++) o.add(t.slice(i, i + 3)); return o }
  const simT = (a: string, b: string) => { const A = trig(a), B = trig(b); let n = 0; for (const x of A) if (B.has(x)) n++; return n / (A.size + B.size - n || 1) }

  /**
   * ⚠️ PAS DE CURSEUR. Un premier jet avançait dans MON ordre de tri (« ACTE … » avant
   * « ACTES … ») quand le livre range « ACTES AUTHENTIQUES » avant « ACTE PRIVÉ » ; une notion
   * déjà dépassée se retrouvait dans la TABLE DES NOTIONS, où le curseur sautait. On lit donc
   * les titres LIGNE À LIGNE : un titre est une ligne (ou deux consécutives) dont la forme
   * repliée est celle d'une notion ; PREMIÈRE page retenue — la manchette des pages de suite
   * vient après. Les pages à plus de 20 titres sont des tables : écartées.
   * ⚠️ L'OCR ABÎME LES TITRES (« COMMER<;ANT », « !.:ASSIGNATION », « / » lu « I ») : seconde
   * passe tolérante sur les lignes en capitales, ≥ 0,75, avec contrôle inverse — l'ambiguïté
   * se mesure entre NOTIONS, pas entre lignes (un titre est souvent imprimé deux fois).
   */
  const position = new Map<string, { tome: number; page: number }>() // slug → notion
  const pagesParTome = new Map<number, string[]>()
  for (const T of TOMES) {
    const texte = execFileSync('pdftotext', [T.pdf, '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    const pagesBrutes = texte.split('\f')
    pagesParTome.set(T.tome, pagesBrutes.map(serre))
    const parPageTitres = new Map<number, number>()
    const candidats: [number, string][] = []
    pagesBrutes.forEach((pg, p) => {
      const lignes = pg.split('\n').map((l) => l.trim()).filter(Boolean)
      for (let i = 0; i < lignes.length; i++) {
        for (const k of [serre(lignes[i]), serre(lignes[i] + (lignes[i + 1] ?? ''))]) {
          const slug = k.length >= 3 ? slugParCle.get(k) : undefined
          if (slug) { candidats.push([p, slug]); parPageTitres.set(p, (parPageTitres.get(p) ?? 0) + 1); break }
        }
      }
    })
    const pagesTables = new Set([...parPageTitres].filter(([, n]) => n > 20).map(([p]) => p))
    let exacts = 0
    for (const [p, slug] of candidats) if (!pagesTables.has(p) && !position.has(slug)) { position.set(slug, { tome: T.tome, page: p }); exacts++ }
    const capsLines: [number, string][] = []
    pagesBrutes.forEach((pg, p) => {
      if (pagesTables.has(p)) return
      for (const l of pg.split('\n').map((x) => x.trim())) if (l.length >= 3 && l.length <= 90 && /\p{L}/u.test(l) && l === l.toUpperCase() && !/^\d/.test(l)) capsLines.push([p, serre(l)])
    })
    let flous = 0
    for (const [slug, k] of cles) {
      if (position.has(slug)) continue
      let best: [number, number, string] = [-1, 0, '']
      for (const [p, l] of capsLines) { if (Math.abs(l.length - k.length) > 5) continue; const sc = simT(l, k); if (sc > best[1]) best = [p, sc, l] }
      if (best[1] < 0.75) continue
      let maxAutre = 0
      for (const [sl2, k2] of cles) if (sl2 !== slug && Math.abs(k2.length - best[2].length) <= 5) maxAutre = Math.max(maxAutre, simT(best[2], k2))
      if (maxAutre > best[1]) continue
      position.set(slug, { tome: T.tome, page: best[0] }); flous++
    }
    console.log(`tome ${T.tome} : ${pagesBrutes.length} pages · tables écartées ${[...pagesTables].map((p) => p + 1).join(',') || '—'} · notions ${exacts} exactes + ${flous} tolérantes`)
  }

  let notionsPerdues = 0, entreesParDate = 0, entreesParNotion = 0, sansPage = 0
  const perdues: string[] = []
  const posParId = new Map<string, { tome: number; page: number }>()
  for (const slug of slugs) {
    const pos = position.get(slug)
    if (!pos) { notionsPerdues++; perdues.push(labelParSlug.get(slug) ?? slug); sansPage += parNotion.get(slug)!.length; continue }
    const pages = pagesParTome.get(pos.tome)!
    for (const e of parNotion.get(slug)!) {
      const d = e.decision.publicationDate
      let pEntree = -1
      if (d) {
        const dateCle = serre(`du ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`)
        const noms = fold(e.decision.titleFr).replace(/[^a-z ]+/g, ' ').split(/\s+/).filter((t) => t.length >= 5 && !CREUX.has(t))
        for (let p = pos.page; p < Math.min(pages.length, pos.page + 12); p++) {
          if (pages[p].includes(dateCle) && (noms.length === 0 || noms.some((n) => pages[p].includes(n)))) { pEntree = p; break }
        }
      }
      if (pEntree >= 0) entreesParDate++; else { pEntree = pos.page; entreesParNotion++ }
      posParId.set(e.id, { tome: pos.tome, page: pEntree + 1 })
    }
  }
  console.log(`notions : ${position.size} trouvées · ${notionsPerdues} introuvables → ${sansPage} extraits sans page`)
  console.log(`entrées : ${entreesParDate} par date+nom · ${entreesParNotion} par la page de la notion`)
  if (perdues.length) console.log(`  introuvables (12 premières) : ${perdues.slice(0, 12).join(' · ')}`)
  // tome de chaque arrêt créé = celui de son premier extrait (tome le plus bas, puis page)
  const tomeParDecision = new Map<string, number>()
  for (const e of extraits) { const pos = posParId.get(e.id); if (!pos) continue; const cur = tomeParDecision.get(e.decision.id); if (cur === undefined || pos.tome < cur) tomeParDecision.set(e.decision.id, pos.tome) }

  const aLier = await prisma.document.count({ where: { source: 'RAEJH_SALES', sourcePdfUrl: null } })
  console.log(`fac-similés : ${TOMES.map((T) => `t.${T.tome} ${(statSync(T.pdf).size / 1024 / 1024).toFixed(0)} Mo`).join(' · ')} · arrêts créés sans PDF : ${aLier} · avec tome connu : ${tomeParDecision.size}`)
  if (!APPLY) { console.log('\n(Simulation — relancer avec --apply pour écrire.)'); return }

  const parPos = new Map<string, string[]>()
  for (const [id, pos] of posParId) { const k = `${pos.tome}|${pos.page}`; parPos.set(k, [...(parPos.get(k) ?? []), id]) }
  for (const [k, ids] of parPos) { const [tome, page] = k.split('|').map(Number); await prisma.jurisExtrait.updateMany({ where: { id: { in: ids } }, data: { tome, page } }) }
  console.log(`tome/page écrits sur ${posParId.size} extraits (${parPos.size} positions distinctes)`)

  if (!process.env.BLOB_READ_WRITE_TOKEN) { console.error('⛔ BLOB_READ_WRITE_TOKEN absent'); process.exit(1) }
  const urlParTome = new Map<number, string>()
  for (const T of TOMES) {
    const url = await uploadToBlob(T.blob, readFileSync(T.pdf), 'application/pdf', { multipart: true })
    if (!isBlobUrl(url)) { console.error('⛔ URL non Blob'); process.exit(1) }
    urlParTome.set(T.tome, url); console.log(`  tome ${T.tome} sur le Blob`)
  }
  let lies = 0
  for (const [tome, url] of urlParTome) {
    const ids = [...tomeParDecision].filter(([, t]) => t === tome).map(([id]) => id)
    if (!ids.length) continue
    const r = await prisma.document.updateMany({ where: { id: { in: ids }, source: 'RAEJH_SALES', sourcePdfUrl: null }, data: { sourcePdfUrl: url } })
    lies += r.count
  }
  console.log(`✅ sourcePdfUrl posé sur ${lies} arrêts · relecture : ${await prisma.document.count({ where: { source: 'RAEJH_SALES', sourcePdfUrl: null } })} sans PDF · ${await prisma.jurisExtrait.count({ where: { page: null } })} extraits sans page`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
