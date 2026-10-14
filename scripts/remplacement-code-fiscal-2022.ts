/**
 * « LE CODE DE 2026 REMPLACE LE TEXTE DE 2022 » — décision de Me Vaval du 14 oct. 2026.
 *
 *     npx tsx scripts/remplacement-code-fiscal-2022.ts            # à blanc
 *     npx tsx scripts/remplacement-code-fiscal-2022.ts --commit   # écrit
 *
 * Le Code fiscal de 2022 (Décret du 19 décembre 2022, Le Moniteur Spécial N° 3 du 20 janvier 2023)
 * n'existe au corpus qu'à l'Index du Moniteur, en TROIS entrées `LM2023-SP3` : « Décret portant Code
 * Fiscal », « Code Général des Impôts (CGI) », « Livre des Procédures Fiscales (LPF) ». Le Décret du
 * 30 septembre 2026 le remplace, et le dit dans son intitulé. Les trois entrées passent au statut
 * `ABROGE`, avec pour `abrogatedByNumber` la référence de la fiche de 2026 : leur page affiche
 * « Ce texte est abrogé et remplacé par : <lien vers le Code de 2026> ». Leurs titres ne changent
 * pas (l'Index ne se réécrit pas) ; le fascicule `LM2023-SP3` des Éditions, lui, n'est pas un texte
 * abrogé mais un numéro du journal : il reste tel quel.
 */
import { PrismaClient } from '@prisma/client'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')
const REFERENCE = 'Décret du 30 septembre 2026 remplaçant le Décret du 19 décembre 2022 portant Code Fiscal'
const ATTENDUES = ['Décret portant Code Fiscal', 'Code Général des Impôts (CGI)', 'Livre des Procédures Fiscales (LPF)']

async function main() {
  const fiche = await prisma.document.findMany({ where: { type: 'LEGISLATION', source: 'CODE_FISCAL_2026', number: REFERENCE }, select: { id: true } })
  if (fiche.length !== 1) throw new Error(`⛔ la fiche du Code fiscal 2026 doit exister (et une seule) : ${fiche.length}`)
  const entrees = await prisma.document.findMany({ where: { type: 'INDEX', number: 'LM2023-SP3' }, select: { id: true, titleFr: true, status: true, abrogatedByNumber: true } })
  const titres = entrees.map((e) => e.titleFr).sort()
  if (titres.join('|') !== [...ATTENDUES].sort().join('|')) throw new Error(`⛔ entrées LM2023-SP3 inattendues : ${titres.join(' · ')}`)
  const aFaire = entrees.filter((e) => e.status !== 'ABROGE' || e.abrogatedByNumber !== REFERENCE)
  for (const e of entrees) console.log(`   ${aFaire.includes(e) ? '→' : '='} ${e.id} « ${e.titleFr} » ${e.status}${aFaire.includes(e) ? ' → ABROGE, remplacé par le Code fiscal 2026' : ''}`)
  if (!COMMIT) {
    console.log('\n(à blanc — --commit pour écrire)')
    return
  }
  await prisma.document.updateMany({ where: { id: { in: aFaire.map((e) => e.id) } }, data: { status: 'ABROGE', abrogatedByNumber: REFERENCE } })
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: fiche[0].id, meta: { via: 'remplacement-code-fiscal-2022', abroges: aFaire.map((e) => e.id), decision: 'le code de 2026 remplace le texte de 2022 (14 oct. 2026)' } })
  const relu = await prisma.document.count({ where: { type: 'INDEX', number: 'LM2023-SP3', status: 'ABROGE', abrogatedByNumber: REFERENCE } })
  if (relu !== 3) throw new Error(`⛔ recompte : ${relu}/3 entrées marquées`)
  console.log(`\n✅ ${aFaire.length} entrée(s) marquée(s) ; recompte : 3/3 abrogées et remplacées par le Code fiscal 2026`)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
