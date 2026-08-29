/**
 * BANQUES D'ÉPARGNE ET DE LOGEMENT, 1984 — mettre la fiche en conformité avec le Journal officiel.
 *
 *     npx tsx scripts/conformer-bel-1984.ts            # simulation
 *     npx tsx scripts/conformer-bel-1984.ts --apply    # Me Vaval, elle seule
 *
 * Me Vaval, 29 août 2026 : « en cas de divergence au niveau du nom ou du contenu, la version
 * ci-jointe prévaut. Effectuer les corrections. » — puis : « **revoir uniquement ce qui est
 * fourni, ne pas éliminer les pages manquantes.** »
 *
 * ⚠️ CE N'EST PAS UN DÉCRET, C'EST UNE LOI. La base disait « Décret du 4 juillet 1984 organisant
 * les Banques d'Epargne et de Logement ». Le Journal officiel dit « **Loi portant création et
 * fonctionnement des Banques d'Épargne et de Logement** » — trois fois : au sommaire du fascicule,
 * en tête de l'acte (« LOI »), et dans sa formule d'adoption (« A PROPOSÉ / Et la Chambre
 * Législative a voté la Loi suivante »). Le corps le trahissait déjà : son article 34 parle des
 * « avantages particuliers reconnus par la présente LOI ».
 *
 * ⚠️ LA PIÈCE EST PARTIELLE — 5 articles sur 40. Elle porte le préambule, puis saute au chapitre
 * quatrième : articles 28, 33, 37, 38 et 40, et les formules finales. Les articles 1 à 27,
 * 29 à 32, 34 à 36 et 39 n'y sont PAS. **Elle prévaut sur ce qu'elle contient, et sur rien
 * d'autre.** Les trente-cinq autres restent exactement tels qu'ils sont : le script COMPTE, avant
 * et après, et refuse si le total n'est pas 40.
 *
 * ⚠️ TROIS DATES, ET UNE SEULE EST LA BONNE. « Fait à la Chambre Législative […] le 4 juillet
 * 1984 » (dernier vote) · « Donné au Palais National […] le 28 août 1984 » (promulgation) ·
 * publication au Moniteur n° 64 du 6 septembre 1984. Une LOI porte la date de son DERNIER VOTE
 * (règle du 28 août 2026) ⇒ adoptionDate 1984-07-04, publicationDate 1984-09-06. En base,
 * adoptionDate était NULLE et publicationDate valait le 4 juillet — la date du vote logée dans le
 * champ de la publication.
 *
 * ⚠️ CE QUI N'EST PAS REPRIS DE LA PIÈCE, ET POURQUOI : le bandeau du journal, le sommaire du
 * fascicule (qui annonce quatre actes étrangers à la loi), l'en-tête de page courant, et la tête
 * « CHAPITRE QUATRIÈME / AVANTAGES PARTICULIERS » — la base porte déjà son propre en-tête de
 * chapitre, auquel son sommaire est ACCROCHÉ ; le remplacer casserait la navigation et laisserait
 * trois chapitres sur quatre dans l'ancienne forme.
 */
import { prisma } from '../src/lib/db'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated } from '../src/lib/legislation/annotated'

const APPLY = process.argv.includes('--apply')
const TITRE = 'Loi du 4 juillet 1984 portant création et fonctionnement des Banques d’Épargne et de Logement'
const MONITEUR = 'Le Moniteur · LM1984-64 · 139ᵉ année, n° 64 du jeudi 6 septembre 1984, p. 873 à 877'
const PREMIERE_LIGNE = 'Moniteur No 64 du 6 septembre 1984'

async function main() {
  const p: { preambule: string[]; formules: string[]; articles: Record<string, string[]> } =
    JSON.parse(readFileSync(join(process.cwd(), 'scripts/data/bel-1984/piece-retenue.json'), 'utf8'))
  const NUMS = ['28', '33', '37', '38', '40']
  if (Object.keys(p.articles).sort().join(',') !== NUMS.slice().sort().join(','))
    throw new Error(`la pièce porte ${Object.keys(p.articles).join(',')}, « ${NUMS.join(',')} » attendus. STOP`)
  if (p.preambule[0]?.trim() !== 'LOI') throw new Error('le préambule ne commence pas par « LOI ». STOP')
  if (!p.formules[0]?.startsWith('Fait à la Chambre Législative')) throw new Error('les formules ne commencent pas comme attendu. STOP')

  const d = await prisma.document.findFirst({
    where: { source: 'CC_VANDAL_II-I-1' },
    select: { id: true, titleFr: true, number: true, bodyOriginal: true, annotationsJson: true, adoptionDate: true, publicationDate: true, moniteurRef: true },
  })
  if (!d) throw new Error('CC_VANDAL_II-I-1 introuvable. STOP')
  const avant = (d.bodyOriginal ?? '').split('\n')
  const empreinte = createHash('md5').update(d.bodyOriginal ?? '').digest('hex')
  const ann = JSON.parse(String(d.annotationsJson ?? '{}'))

  // ⚠️ L'IDEMPOTENCE SE TESTE EN PREMIER. Placée après le contrôle de la 1ʳᵉ ligne, elle était
  // INATTEIGNABLE : une seconde exécution refusait en disant « la 1ʳᵉ ligne du corps vaut LOI »,
  // ce qui est vrai mais trompeur — le vrai état est « déjà fait ». Vécu le 29 août 2026.
  if (d.titleFr === TITRE) { console.log('fiche déjà conforme — rien à faire.'); await prisma.$disconnect(); return }
  if (avant[0]?.trim() !== PREMIERE_LIGNE) throw new Error(`la 1ʳᵉ ligne du corps vaut « ${avant[0]?.slice(0, 50)} », « ${PREMIERE_LIGNE} » attendue. STOP`)

  const compter = (l: string[]) => l.filter((x) => /^\s*Article\s+\d+(er)?\s*[.．]?\s*[—-]/.test(x)).length
  const nAvant = compter(avant)
  if (nAvant !== 40) throw new Error(`${nAvant} articles avant, 40 attendus. STOP`)

  // ── Le corps neuf : préambule + corps existant (1ʳᵉ ligne ôtée, 5 articles repris) + formules ──
  const tete = (n: string) => avant.findIndex((x) => new RegExp(`^\\s*Article\\s+${n}\\s*[.．]?\\s*[—-]`).test(x))
  const fin = (i: number) => { const j = avant.findIndex((x, k) => k > i && (/^\s*Article\s+\d+(er)?\s*[.．]?\s*[—-]/.test(x) || /^\s*CHAPITRE/.test(x))); return j < 0 ? avant.length : j }
  const remplacements = NUMS.map((n) => { const i = tete(n); if (i < 0) throw new Error(`article ${n} introuvable dans le corps. STOP`); return { n, i, j: fin(i) } }).sort((a, b) => a.i - b.i)
  // aucun chevauchement, et l'ordre du corps est respecté
  for (let k = 1; k < remplacements.length; k++) if (remplacements[k].i < remplacements[k - 1].j) throw new Error('deux remplacements se chevauchent. STOP')

  const corpsMilieu: string[] = []
  let curseur = 1 // on saute la 1ʳᵉ ligne (référence Moniteur → métadonnée)
  for (const r of remplacements) {
    corpsMilieu.push(...avant.slice(curseur, r.i), ...p.articles[r.n])
    curseur = r.j
  }
  corpsMilieu.push(...avant.slice(curseur))
  const neuf = [...p.preambule, ...corpsMilieu, ...p.formules]
  const nApres = compter(neuf)
  if (nApres !== 40) throw new Error(`${nApres} articles après, 40 attendus — la reprise a mangé ou dupliqué un article. STOP`)

  // ── Les 35 NON fournis doivent être RIGOUREUSEMENT identiques ──
  const bloc = (l: string[], n: string) => { const i = l.findIndex((x) => new RegExp(`^\\s*Article\\s+${n}\\s*[.．]?\\s*[—-]`).test(x)); if (i < 0) return null; const j = l.findIndex((x, k) => k > i && (/^\s*Article\s+\d+(er)?\s*[.．]?\s*[—-]/.test(x) || /^\s*(CHAPITRE|Fait à)/.test(x))); return l.slice(i, j < 0 ? l.length : j).join('\n') }
  const tous = ['1er', ...Array.from({ length: 39 }, (_, k) => String(k + 2))]
  const intacts = tous.filter((n) => !NUMS.includes(n))
  const bouges = intacts.filter((n) => bloc(avant, n) !== bloc(neuf, n))
  if (bouges.length) throw new Error(`${bouges.length} article(s) NON fournis ont bougé : ${bouges.slice(0, 6).join(', ')}. STOP`)
  const repris = NUMS.filter((n) => bloc(avant, n) === bloc(neuf, n))

  // ── Le sommaire doit continuer de s'accrocher : ses 4 libellés restent des lignes du corps ──
  const lignes = new Set(neuf.map((x) => x.trim()))
  const perdus = (ann.toc ?? []).filter((t: { label: string }) => !lignes.has(t.label.trim()))
  if (perdus.length) throw new Error(`${perdus.length} en-tête(s) de sommaire ne sont plus dans le corps : ${perdus.map((t: { label: string }) => t.label).join(' · ')}. STOP`)

  console.log(`NOM   « ${d.titleFr} »`)
  console.log(`   →  « ${TITRE} »`)
  console.log(`\nDATES adoption ${d.adoptionDate?.toISOString().slice(0, 10) ?? 'NULL'} → 1984-07-04 (dernier vote)`)
  console.log(`      publication ${d.publicationDate?.toISOString().slice(0, 10) ?? 'NULL'} → 1984-09-06 (Moniteur n° 64)`)
  console.log(`      référence Moniteur : ${d.moniteurRef ?? 'AUCUNE'} → posée`)
  console.log(`\nCORPS ${avant.length} → ${neuf.length} lignes · articles ${nAvant} → ${nApres}`)
  console.log(`      + préambule ${p.preambule.length} l. · + formules et signatures ${p.formules.length} l.`)
  console.log(`      − 1ʳᵉ ligne « ${PREMIERE_LIGNE} » (référence sortie du corps)`)
  console.log(`      ${NUMS.length - repris.length} article(s) repris sur la pièce : ${NUMS.filter((n) => !repris.includes(n)).join(', ')}${repris.length ? ` · ${repris.join(', ')} déjà identiques` : ''}`)
  console.log(`      ${intacts.length} articles NON fournis : tous rigoureusement inchangés ✓`)
  console.log(`      sommaire : ses ${(ann.toc ?? []).length} en-têtes retrouvés dans le corps ✓`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  await prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: d.id },
      data: {
        titleFr: TITRE, number: TITRE, moniteurRef: MONITEUR,
        bodyOriginal: neuf.join('\n'),
        adoptionDate: new Date('1984-07-04T00:00:00Z'),
        publicationDate: new Date('1984-09-06T00:00:00Z'),
      },
    })
    await audit({
      action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: 'BEL_1984_CONFORMITE',
      meta: {
        motif:
          'Mise en conformité avec le Journal officiel (Moniteur n° 64 du 6 septembre 1984, p. 873-877), ' +
          'pièce fournie par Me Vaval le 29 août 2026. L’acte est une LOI, non un décret : le sommaire du ' +
          'fascicule, l’en-tête « LOI » et la formule « la Chambre Législative a voté la Loi suivante » le ' +
          'disent, et l’article 34 du corps parlait déjà de « la présente loi ». Titre et référence ' +
          'corrigés ; adoptionDate 1984-07-04 (dernier vote) et publicationDate 1984-09-06 posées ; ' +
          'référence Moniteur sortie du corps ; préambule (14 visas, considérants, formules) et signatures ' +
          'ajoutés ; 5 articles repris sur la pièce (28, 33, 37, 38, 40). ' +
          '⚠️ La pièce ne couvre que 5 articles sur 40 : les 35 autres sont RIGOUREUSEMENT inchangés, ' +
          'vérifiés un à un — « ne pas éliminer les pages manquantes ».',
        articlesAvant: nAvant, articlesApres: nApres, reprisSurLaPiece: NUMS.length - repris.length, intacts: intacts.length,
      },
    }, tx)
  }, { timeout: 120_000, maxWait: 30_000 })

  const journal = await prisma.auditLog.count({ where: { targetId: 'BEL_1984_CONFORMITE' } })
  await reindexDocument(d.id)
  const ap = await prisma.document.findUnique({ where: { id: d.id }, select: { titleFr: true, number: true, bodyOriginal: true, adoptionDate: true, publicationDate: true, moniteurRef: true, annotationsJson: true } })
  const a2 = JSON.parse(String(ap?.annotationsJson ?? '{}'))
  const b: { anchor?: string | null }[] = segmentAnnotated(ap?.bodyOriginal ?? '', a2.toc ?? [])
  const anc = new Set(b.map((x) => x.anchor).filter(Boolean))
  console.log(`\n✓ AuditLog ${journal} (recompté)`)
  console.log(`  « ${ap?.titleFr} »`)
  console.log(`  adopté ${ap?.adoptionDate?.toISOString().slice(0, 10)} · publié ${ap?.publicationDate?.toISOString().slice(0, 10)}`)
  console.log(`  ${ap?.moniteurRef}`)
  console.log(`  ancres rendues : ${anc.size} · articles ${compter((ap?.bodyOriginal ?? '').split('\n'))} · corps ${(ap?.bodyOriginal ?? '').split('\n').length} lignes (avant ${avant.length}, empreinte ${empreinte.slice(0, 8)})`)
  console.log(`  référence = titre : ${ap?.number === ap?.titleFr}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
