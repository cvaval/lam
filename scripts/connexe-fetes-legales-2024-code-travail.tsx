/**
 * Code du travail annoté, art. 110 (fêtes légales du Décret du 23 mai 1989) : repli « Législation connexe » vers le
 * Décret du 11 décembre 2024 déterminant les Fêtes Légales, avec sa liste (art. 2).
 *
 * Me Vaval, 20 oct. 2026 : « ne pas mettre abrogé mais ajouter la référence du décret de 2024 en repli avec la liste
 * des fêtes légales correspondantes ». Le décret de 2024 ne nomme pas celui de 1989 dans son dispositif (il le vise,
 * et abroge « toutes dispositions contraires ») : bloc de nature `source` (« Législation connexe »), jamais
 * « Abrogé par » — cf. le registre des situations.
 *
 * La liste est reprise MOT POUR MOT de la fiche du décret en base (art. 2), et comparée au texte attendu.
 *
 * Garde-fous (refus d'écrire si l'un échoue) : seule la clé `connexe['art-110']` change dans les annotations ; le
 * lecteur relit exactement le bloc écrit, de nature « source » (jamais abrogatif) ; rendu : un repli « Législation
 * connexe » de plus, sous l'art. 110 et nulle part ailleurs (le contenu d'un repli fermé n'est pas rendu côté serveur :
 * c'est le gabarit du repli « Constitution de 1987 » de l'art. 6, en ligne) ; la fiche n'a pas changé depuis la
 * lecture. Rejouable : sans effet si le bloc est déjà là. Instantané AVANT (hors dépôt) : `<dossier>/<id>.json`.
 *
 *     npx tsx --tsconfig <tsconfig jsx> scripts/connexe-fetes-legales-2024-code-travail.tsx <dossier instantané> [--commit]
 */
import { PrismaClient } from '@prisma/client'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnnotatedText } from '../src/components/AnnotatedText'
import { parseAnnotations, type ConnexeBlock } from '../src/lib/legislation/annotated'
import { natureDuConnexe, situationDuConnexe } from '../src/lib/legislation/situations'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const DOSSIER = process.argv.slice(2).find((a) => !a.startsWith('--'))
const COMMIT = process.argv.includes('--commit')

const DECRET_ID = 'cmt1x4eza0001m0c3gp6996w7'
const CLE = 'art-110'
const LABEL = 'Décret du 11 décembre 2024 déterminant les Fêtes Légales (Le Moniteur, Spécial n° 66-A du 11 décembre 2024)'
const ATTENDU = [
  'Article 2.- Les Fêtes Légales sont :',
  '1°) le Lundi Gras, à partir de midi ;',
  '2°) le Mardi Gras ;',
  '3°) le Vendredi Saint ;',
  '4°) la Fête Dieu ;',
  '5°) le 14 Août, Jour du Bois-Caïman et de l’Union pour la Liberté ;',
  '6°) le 15 Août, Fête de l’Assomption ;',
  '7°) le 20 Septembre, Jour de DESSALINES ;',
  '8°) le 17 Octobre, Commémoration de la Mort de DESSALINES ;',
  '9°) le 1er Novembre, la Toussaint ;',
  '10°) le 2 Novembre, Fête des Morts ; et',
  '11°) le 25 Décembre, Jour de Noël.',
]

async function main() {
  if (!DOSSIER) throw new Error('usage : connexe-fetes-legales-2024-code-travail.tsx <dossier instantané> [--commit]')
  // La liste, tirée de la fiche du décret.
  const decret = await prisma.document.findUniqueOrThrow({ where: { id: DECRET_ID }, select: { titleFr: true, moniteurRef: true, bodyOriginal: true } })
  if (decret.titleFr !== 'Décret du 11 décembre 2024 déterminant les Fêtes Légales') throw new Error(`fiche inattendue : ${decret.titleFr}`)
  const DL = decret.bodyOriginal.split('\n').map((l) => l.trim())
  const i2 = DL.indexOf(ATTENDU[0])
  if (i2 < 0 || DL.slice(i2, i2 + ATTENDU.length).join('\n') !== ATTENDU.join('\n') || !/^Article 3\.-/.test(DL[i2 + ATTENDU.length] ?? '')) throw new Error('art. 2 du décret ≠ texte attendu')
  const bloc: ConnexeBlock = { label: LABEL, text: ATTENDU.join('\n'), docId: DECRET_ID, anchor: 'art-2', kind: 'source' }

  const d = await prisma.document.findFirstOrThrow({ where: { source: 'CODE_TRAVAIL_ANNOTE' }, select: { id: true, bodyOriginal: true, annotationsJson: true, updatedAt: true } })
  const brut = JSON.parse(d.annotationsJson!) as Record<string, any>
  brut.connexe ??= {}
  const avant: ConnexeBlock[] = brut.connexe[CLE] ?? []
  if (avant.some((b) => b.docId === DECRET_ID)) { console.log(`= ${CLE} : le repli du décret de 2024 est déjà là — rien à écrire`); return }
  const json0 = JSON.stringify(brut)
  brut.connexe[CLE] = [...avant, bloc]
  const json1 = JSON.stringify(brut)

  // ── Garde-fous ──
  const erreurs: string[] = []
  const a0 = parseAnnotations(d.annotationsJson)!, a1 = parseAnnotations(json1)!
  const sauf = (o: Record<string, any>) => JSON.stringify({ ...o, connexe: { ...o.connexe, [CLE]: undefined } })
  if (sauf(JSON.parse(json0)) !== sauf(JSON.parse(json1))) erreurs.push('autre chose que connexe[art-110] changerait')
  if (d.annotationsJson !== json0) console.log('ℹ︎ la réécriture JSON normalise la chaîne (même contenu)')
  if (JSON.stringify(a1.connexe?.[CLE]?.at(-1)) !== JSON.stringify(bloc)) erreurs.push('le lecteur ne relit pas le bloc écrit')
  if (natureDuConnexe(bloc) !== 'source' || situationDuConnexe(natureDuConnexe(bloc)) !== 'connexe') erreurs.push('nature du bloc ≠ législation connexe')
  const rendu = (a: typeof a0) => renderToStaticMarkup(<AnnotatedText text={d.bodyOriginal} annotations={a} locale="fr" linkArtRefs hideInlineIndex />)
  const h0 = rendu(a0), h1 = rendu(a1)
  const replis = (h: string, de = 0, a = h.length) => (h.slice(de, a).match(/data-situation="connexe"/g) ?? []).length
  const entre = (h: string) => [h.indexOf('id="art-110"'), h.indexOf('id="art-111"')] as const
  const [x0, y0] = entre(h0), [x1, y1] = entre(h1)
  if (x1 < 0 || y1 < x1) erreurs.push('art. 110 / 111 introuvables au rendu')
  if (replis(h1) - replis(h0) !== 1) erreurs.push(`replis « connexe » ${replis(h0)} → ${replis(h1)}`)
  if (replis(h1, x1, y1) - replis(h0, x0, y0) !== 1) erreurs.push('le repli n’est pas sous l’art. 110')
  if (/data-situation="(?:acte_abrogatif|abroge|texte_abroge)"/.test(h1.slice(x1, y1)) && !/data-situation="(?:acte_abrogatif|abroge|texte_abroge)"/.test(h0.slice(x0, y0))) erreurs.push('un état « abrogé » apparaîtrait')
  console.log(`connexe[${CLE}] : ${avant.length} → ${avant.length + 1} bloc(s) ; replis « connexe » au rendu ${replis(h0)} → ${replis(h1)}`)
  console.log(`  ${LABEL}\n  ${ATTENDU.join('\n  ')}`)
  if (erreurs.length) { console.log(`⛔ refus : ${erreurs.join(', ')}`); process.exitCode = 1; return }
  if (!COMMIT) { console.log('(à blanc — --commit pour écrire)'); return }

  mkdirSync(DOSSIER, { recursive: true })
  writeFileSync(join(DOSSIER, `${d.id}.json`), JSON.stringify({ id: d.id, updatedAt: d.updatedAt, annotationsJson: d.annotationsJson }))
  const r = await prisma.document.updateMany({ where: { id: d.id, updatedAt: d.updatedAt }, data: { annotationsJson: json1 } })
  if (r.count !== 1) throw new Error('la fiche a changé depuis la lecture : rien écrit')
  await reindexDocument(d.id)
  await audit({ action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: d.id, meta: { via: 'connexe-fetes-legales-2024-code-travail', article: CLE, connexe: LABEL, decision: 'repli « Législation connexe », pas « Abrogé » — Me Vaval, 20 oct. 2026' } })
  console.log('✓ écrit, réindexé, journalisé')
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
