/**
 * Ajoute 4 lois connexes « Salaire minimum » (2009, 2017, 2022, 2026) au Code du travail
 * annoté (1 Document, source=CODE_TRAVAIL_ANNOTE) — EN PLACE (même id : rien ne référence
 * la fiche hormis les DocumentTheme recréés). Chaque texte devient une SECTION connexe
 * (sec-207…210) sous « Lois connexes » : ligne d'en-tête = libellé TOC (appariement exact,
 * dans l'ordre — cf. segmentAnnotated), + entrée navToc + connexes.
 *
 * Met à jour la SOURCE DE VÉRITÉ (scripts/data/code-travail/parsed/{bodyOriginal.txt,
 * structure.json}) ET la base (bodyOriginal + annotationsJson + searchText). Vérifie par
 * segmentAnnotated avant d'écrire.
 *
 *   npx tsx scripts/add-salaire-minimum-connexes.ts            (simulation + vérif segmenteur)
 *   npx tsx scripts/add-salaire-minimum-connexes.ts --commit
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import mammoth from 'mammoth'
import { segmentAnnotated } from '../src/lib/legislation/annotated'
import { buildSearchText } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
const prisma = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL || env.DATABASE_URL } } })
const COMMIT = process.argv.includes('--commit')
const DATA = 'scripts/data/code-travail/parsed'
const SRC = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/Code du travail'

// Ordre chronologique ; ancres après le max existant (sec-206).
const ITEMS = [
  { file: 'Officiel_Loi_salaire_minimum_6-octobre-2009.docx', title: 'SALAIRE MINIMUM — Loi du 6 octobre 2009', anchor: 'sec-207' },
  { file: 'Officiel_Arrete_salaire_minimum_28-juillet-2017.docx', title: 'SALAIRE MINIMUM — Arrêté du 28 juillet 2017', anchor: 'sec-208' },
  { file: 'Officiel_Arrete_salaire_minimum_21-fevrier-2022.docx', title: 'SALAIRE MINIMUM — Arrêté du 21 février 2022', anchor: 'sec-209' },
  { file: 'Officiel_Arrete_salaire_minimum_6-mai-2026.docx', title: 'SALAIRE MINIMUM — Arrêté du 6 mai 2026', anchor: 'sec-210' },
]

async function main() {
  const body0 = readFileSync(`${DATA}/bodyOriginal.txt`, 'utf8')
  const struct = JSON.parse(readFileSync(`${DATA}/structure.json`, 'utf8'))
  const existingAnchors = new Set<string>((struct.toc as { anchor: string }[]).map((e) => e.anchor))
  const connexeGroup = (struct.navToc as { label: string; anchor: string; children: unknown[] }[]).find((g) => /connexe/i.test(g.label))
  if (!connexeGroup) { console.error('Groupe « Lois connexes » introuvable dans navToc.'); process.exit(1) }

  // 1) Convertir les docx + garde-fous (fichier présent, ancre libre, texte non vide)
  const built: { title: string; anchor: string; text: string }[] = []
  for (const it of ITEMS) {
    if (existingAnchors.has(it.anchor)) { console.error(`Ancre ${it.anchor} déjà présente — abandon (déjà importé ?).`); process.exit(1) }
    const text = (await mammoth.extractRawText({ buffer: readFileSync(`${SRC}/${it.file}`) })).value.trim()
    if (text.length < 200) { console.error(`Texte trop court pour ${it.file} (${text.length}c).`); process.exit(1) }
    built.push({ title: it.title, anchor: it.anchor, text })
    console.log(`• ${it.anchor} · ${it.title} ← ${it.file} (${text.length}c)`)
  }

  // 2) Nouveau corps : chaque connexe = ligne d'en-tête (== libellé TOC) + texte
  const appended = built.map((b) => `${b.title}\n${b.text}`).join('\n\n')
  const newBody = `${body0.replace(/\s+$/, '')}\n\n${appended}\n`

  // 3) Nouvelle structure (append : toc + navToc[connexes] + connexes)
  const newStruct = JSON.parse(JSON.stringify(struct))
  const newGroup = (newStruct.navToc as { label: string; children: { label: string; anchor: string; children: unknown[] }[] }[]).find((g) => /connexe/i.test(g.label))!
  for (const b of built) {
    newStruct.toc.push({ level: 1, label: b.title, anchor: b.anchor, kind: 'connexe' })
    newGroup.children.push({ label: b.title, anchor: b.anchor, children: [] })
    newStruct.connexes.push({ title: b.title, anchor: b.anchor })
  }

  // 4) VÉRIFICATION par le vrai segmenteur : les 4 nouvelles sections doivent apparaître,
  //    avec la bonne ancre, et un bloc de corps NON vide juste après.
  const blocks = segmentAnnotated(newBody, newStruct.toc)
  const sections = blocks.filter((b) => b.kind === 'section')
  console.log(`\nsegmentAnnotated : ${blocks.length} blocs · ${sections.length} sections (attendu ${struct.toc.length + 4} au plus)`)
  let ok = true
  for (const b of built) {
    const si = blocks.findIndex((x) => x.kind === 'section' && (x as { anchor: string }).anchor === b.anchor)
    const bodyBlock = si >= 0 ? blocks[si + 1] : undefined
    const bodyLen = bodyBlock && bodyBlock.kind === 'body' ? bodyBlock.text.length : 0
    const good = si >= 0 && bodyLen > 100
    if (!good) ok = false
    console.log(`  ${good ? '✓' : '✗'} ${b.anchor} — section ${si >= 0 ? 'trouvée' : 'ABSENTE'}, corps ${bodyLen}c`)
  }
  if (!ok) { console.error('\n⚠ Vérification échouée — écriture annulée.'); process.exit(1) }
  console.log(`\ncorps : ${body0.length} → ${newBody.length}c · connexes : ${struct.connexes.length} → ${newStruct.connexes.length}`)

  if (!COMMIT) { console.log('\nSimulation — relancer avec --commit pour écrire (fichiers parsed + base).'); await prisma.$disconnect(); return }

  // 5) Écrire la source de vérité (durabilité pour un futur ré-import)
  writeFileSync(`${DATA}/bodyOriginal.txt`, newBody)
  writeFileSync(`${DATA}/structure.json`, JSON.stringify(newStruct, null, 2))
  console.log('✓ fichiers parsed mis à jour')

  // 6) Mettre à jour la fiche EN PLACE (même id)
  const doc = await prisma.document.findFirst({ where: { source: 'CODE_TRAVAIL_ANNOTE' }, select: { id: true, author: true, titleFr: true } })
  if (!doc) { console.error('Fiche CODE_TRAVAIL_ANNOTE introuvable.'); process.exit(1) }
  const searchText = buildSearchText({ titleFr: doc.titleFr, author: doc.author, matiere: 'social travail', bodyOriginal: newBody })
  await prisma.document.update({
    where: { id: doc.id },
    data: { bodyOriginal: newBody, annotationsJson: JSON.stringify(newStruct), searchText },
  })
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: doc.id, meta: { op: 'add_connexes', which: 'salaire_minimum_2009_2017_2022_2026', anchors: built.map((b) => b.anchor) } }, prisma)
  console.log(`✓ fiche ${doc.id} mise à jour (id conservé) · 4 connexes Salaire minimum ajoutées. Données LIVE.`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
