/**
 * SUITES DE L'AUDIT DU 30 AOÛT 2026 — trois défauts EN LIGNE, réparés.
 *
 *     npx tsx scripts/reparer-suites-audit-2026-08-30.ts            # simulation
 *     npx tsx scripts/reparer-suites-audit-2026-08-30.ts --apply    # Me Vaval, elle seule
 *
 * L'audit adversarial des quatre prompts a retenu 35 constats sur 73. Trois portent sur des
 * données DÉJÀ VERSÉES, et ce script les répare. Il ne touche à rien d'autre.
 *
 * ─── 1. ENVIRONNEMENT : L'INDEX A ÉTÉ COMPTÉ DEUX FOIS ─────────────────────────────────────
 * `Decret_12_octobre_2005_Index_des_mots_cles.docx` porte DEUX parties : un index alphabétique
 * (160 sujets principaux, 31 sous-entrées, 666 renvois) et un « CLASSEMENT THÉMATIQUE DES
 * ENTRÉES » qui reprend les MÊMES sujets regroupés par rubrique, séparateur TABULATION. Mon
 * lecteur les a ADDITIONNÉS : 352 entrées et 1 284 renvois versés, dont 161 sujets en double avec
 * des `ctRefs` strictement identiques.
 * ⚠️ Deux « particularités » que j'avais cru mesurer sur l'index alphabétique — virgule facultative
 * avant « art. », sous-entrées signalées par une minuscule — n'existent QUE dans le classement
 * thématique. Les 31 sous-entrées de l'index portent bien un tiret cadratin. J'avais inventé deux
 * règles pour rattraper des lignes qu'il ne fallait pas lire.
 *
 * ─── 2. ENVIRONNEMENT : LE CORPS EMPORTE UN AUTRE ACTE ET LE COLOPHON ──────────────────────
 * `bodyOriginal` se terminait par « EXTRAITS DU REGISTRE DES MARQUES DE FABRIQUE ET DE COMMERCE »,
 * deux notices de marques et le colophon des Presses Nationales — six lignes qui appartiennent au
 * fascicule, pas au décret. Le texte s'arrête à la dernière signature ministérielle.
 *
 * ─── 3. TÉLÉCOMS : L'OBJET DU DÉCRET DE TAXATION EST INVENTÉ ───────────────────────────────
 * `titleFr` et `number` portent « …un mode de taxation EN HARMONIE AVEC LE SERVICE RENDU ».
 * Cette formule n'existe NULLE PART. Le .docx (l. 4) et la notice de l'Index du Moniteur
 * (LM1987-76) disent l'un comme l'autre : « …en harmonie avec le NIVEAU D'UTILISATION DU SPECTRE,
 * en tenant compte des nouvelles méthodes de description et de désignation des émissions ».
 * La règle du nom complet existe pour que l'intitulé soit EXACT : un objet approximatif la vide
 * de son sens.
 *
 * ─── CE QUI N'EST PAS FAIT ICI ─────────────────────────────────────────────────────────────
 * L'erratum du Moniteur n° 94 de 1987 touchant le décret sur la mission du CONATEL (notice
 * LM1987-94) est RÉEL et n'est pas traité : son contenu doit être lu sur le fascicule avant d'être
 * reporté. Il est inscrit comme point ouvert, pas corrigé à l'aveugle.
 */
import { prisma } from '../src/lib/db'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated } from '../src/lib/legislation/annotated'

const APPLY = process.argv.includes('--apply')
const D = join(process.cwd(), 'scripts/data')

const ENV_SOURCE = 'DECRET_GESTION_ENVIRONNEMENT_2005'
const ENV_ATTENDU = { entrees: 191, renvois: 666, lignes: 530, articles: 162, toc: 41 }
const ENV_DEFECTUEUX = { entrees: 352, renvois: 1284, lignes: 536 }

const TAX_SOURCE = 'DECRET_CONATEL_TAXATION_1987'
const TAX_FAUX =
  'Décret du 26 juin 1987 dotant le Conseil National des Télécommunications de moyens techniques ' +
  'et adoptant un mode de taxation en harmonie avec le service rendu'
const TAX_JUSTE =
  'Décret du 26 juin 1987 dotant le Conseil National des Télécommunications (CONATEL) de moyens ' +
  'techniques et adoptant un mode de taxation en harmonie avec le niveau d’utilisation du spectre, ' +
  'en tenant compte des nouvelles méthodes de description et de désignation des émissions'

type Idx = { subject: string; ctRefs: number[] }

async function main() {
  // ══ LA CHARGE UTILE SE VÉRIFIE AVANT LA BASE ══════════════════════════════════════════
  const neuf: Idx[] = JSON.parse(readFileSync(join(D, 'environnement-2005/index-environnement.json'), 'utf8'))
  const corpsNeuf = readFileSync(join(D, 'environnement-2005/corps-environnement.txt'), 'utf8').replace(/\n+$/, '')
  const suj = neuf.map((e) => e.subject)
  const renvois = neuf.reduce((n, e) => n + e.ctRefs.length, 0)
  const lignesNeuf = corpsNeuf.split('\n').filter(Boolean).length

  if (neuf.length !== ENV_ATTENDU.entrees) throw new Error(`index reconstruit : ${neuf.length} entrées, ${ENV_ATTENDU.entrees} attendues. STOP`)
  if (renvois !== ENV_ATTENDU.renvois) throw new Error(`index reconstruit : ${renvois} renvois, ${ENV_ATTENDU.renvois} attendus. STOP`)
  if (suj.length !== new Set(suj).size) throw new Error(`index reconstruit : ${suj.length - new Set(suj).size} sujet(s) en double — c'est le défaut qu'on répare. STOP`)
  if (lignesNeuf !== ENV_ATTENDU.lignes) throw new Error(`corps reconstruit : ${lignesNeuf} lignes, ${ENV_ATTENDU.lignes} attendues. STOP`)
  // ⚠️ Le contrôle porte sur la QUEUE, après la dernière signature — pas sur tout le corps : la
  // ligne de SOMMAIRE du fascicule (l. 3) énumère les deux actes du numéro, extraits de marques
  // compris. C'est le mastic du Moniteur, conservé verbatim comme le fait le corpus ; le chercher
  // partout ferait échouer le contrôle sur une ligne qu'il faut garder.
  const lgNeuf = corpsNeuf.split('\n').filter(Boolean)
  const derSig = lgNeuf.findLastIndex((l) => /^(Le|La)\s+Ministre/.test(l))
  if (derSig < 0) throw new Error('aucune signature ministérielle dans le corps reconstruit. STOP')
  const queue = lgNeuf.slice(derSig + 1)
  if (queue.length) throw new Error(`le corps reconstruit porte encore ${queue.length} ligne(s) après la dernière signature — « ${queue[0].slice(0, 60)} ». STOP`)

  // ══ 1 et 2 — LE DÉCRET SUR L'ENVIRONNEMENT ════════════════════════════════════════════
  const env = await prisma.document.findFirst({ where: { source: ENV_SOURCE }, select: { id: true, titleFr: true, bodyOriginal: true, annotationsJson: true } })
  if (!env) throw new Error(`${ENV_SOURCE} introuvable. STOP`)
  const a = JSON.parse(String(env.annotationsJson ?? '{}'))
  const ancien: Idx[] = a.indexEntries ?? []
  const ancienRenvois = ancien.reduce((n, e) => n + e.ctRefs.length, 0)
  const ancienLignes = (env.bodyOriginal ?? '').split('\n').filter(Boolean).length

  const envFait = ancien.length === ENV_ATTENDU.entrees && ancienRenvois === ENV_ATTENDU.renvois && ancienLignes === ENV_ATTENDU.lignes
  if (!envFait) {
    if (ancien.length !== ENV_DEFECTUEUX.entrees || ancienRenvois !== ENV_DEFECTUEUX.renvois || ancienLignes !== ENV_DEFECTUEUX.lignes)
      throw new Error(`fiche environnement : ${ancien.length} entrées / ${ancienRenvois} renvois / ${ancienLignes} lignes ; ${ENV_DEFECTUEUX.entrees} / ${ENV_DEFECTUEUX.renvois} / ${ENV_DEFECTUEUX.lignes} attendus. État inconnu : on ne devine pas. STOP`)
  }

  // Le nouveau corps doit rendre EXACTEMENT les mêmes ancres, et le sommaire tenir.
  const blocs = segmentAnnotated(corpsNeuf, a.toc ?? []) as { kind: string; anchor?: string | null }[]
  const anc = new Set(blocs.filter((x) => x.kind === 'body' && x.anchor).map((x) => x.anchor!))
  if (anc.size !== ENV_ATTENDU.articles) throw new Error(`corps reconstruit : ${anc.size} ancres, ${ENV_ATTENDU.articles} attendues. STOP`)
  if (blocs.filter((x) => x.kind === 'section').length !== ENV_ATTENDU.toc) throw new Error(`corps reconstruit : sections rendues ≠ ${ENV_ATTENDU.toc}. STOP`)
  const morts = neuf.flatMap((e) => e.ctRefs.filter((n) => !anc.has(`art-${n}`)).map((n) => `${e.subject.slice(0, 22)}→art-${n}`))
  if (morts.length) throw new Error(`${morts.length} renvoi(s) mort(s) — ${morts.slice(0, 4).join(' · ')}. STOP`)

  // ⚠️ Rien ne doit se PERDRE. La normalisation retire aussi la mention « préambule » restée
  // collée au sujet dans l'ancien index (avec OU sans virgule : le classement thématique la
  // séparait par une tabulation). Sans elle, le garde-fou accuse 74 renommages d'être des pertes.
  const norm = (s: string) =>
    s.replace(/\s*\(préambule — visas\)\s*$/i, '')
      .replace(/[,\s]\s*pr[ée]ambule(?=\s*(—|$))/gi, '')
      .replace(/\s+/g, ' ').trim()
  const perdus = [...new Set(ancien.map((e) => norm(e.subject)))].filter((s) => !neuf.some((e) => norm(e.subject) === s))
  if (perdus.length) throw new Error(`${perdus.length} sujet(s) DISPARAÎTRAIENT — « ${perdus.slice(0, 3).join(' · ')} ». La réparation ne perd rien. STOP`)
  const cptAncien = new Map<string, number>()
  for (const e of ancien) cptAncien.set(norm(e.subject), (cptAncien.get(norm(e.subject)) ?? 0) + 1)
  const doubles = [...cptAncien].filter(([, n]) => n > 1).length
  const renommes = ancien.filter((e) => /[,\s]\s*pr[ée]ambule/i.test(e.subject)).length

  // ⚠️ Ce que le corps perd doit être EXACTEMENT la matière étrangère, rien du décret.
  const perduesLignes = (env.bodyOriginal ?? '').split('\n').filter(Boolean).filter((l) => !corpsNeuf.split('\n').includes(l))
  const etrangeres = perduesLignes.filter((l) => /EXTRAITS DU REGISTRE|Extrait de la requête|Presses Nationales|Boîte Postale|Dépôt Légal/i.test(l))
  if (perduesLignes.length !== etrangeres.length)
    throw new Error(`le corps perdrait ${perduesLignes.length - etrangeres.length} ligne(s) qui ne sont PAS de la matière étrangère — « ${perduesLignes.find((l) => !etrangeres.includes(l))?.slice(0, 60)} ». STOP`)

  // ══ 3 — L'INTITULÉ DU DÉCRET DE TAXATION ══════════════════════════════════════════════
  const tax = await prisma.document.findFirst({ where: { source: TAX_SOURCE }, select: { id: true, titleFr: true, number: true } })
  if (!tax) throw new Error(`${TAX_SOURCE} introuvable. STOP`)
  const taxFait = tax.titleFr === TAX_JUSTE && tax.number === TAX_JUSTE
  if (!taxFait && (tax.titleFr !== TAX_FAUX || tax.number !== TAX_FAUX))
    throw new Error(`fiche taxation : intitulé inattendu « ${tax.titleFr?.slice(0, 70)} ». On ne devine pas. STOP`)
  // ⚠️ L'intitulé juste doit être celui de la SOURCE, pas une reformulation : on le confronte
  // à la notice de l'Index du Moniteur, seule autorité disponible.
  const notice = await prisma.document.findFirst({ where: { type: 'INDEX', number: 'LM1987-76', titleFr: { contains: 'moyens techniques' } }, select: { titleFr: true } })
  if (!notice) throw new Error('notice LM1987-76 introuvable — l’intitulé juste ne peut être confronté. STOP')
  // ⚠️ La comparaison ignore la PONCTUATION : le .docx écrit « …du spectre, en tenant compte… »,
  // la notice de l'Index « …du spectre en tenant compte… ». Une virgule d'écart ne doit pas faire
  // échouer un contrôle de substance — mais les MOTS, eux, doivent coïncider exactement.
  const fold = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[’']/g, "'").replace(/[,;.]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!fold(TAX_JUSTE).includes(fold(notice.titleFr ?? '').replace(/^decret /, '')))
    throw new Error(`l’intitulé proposé ne recouvre pas la notice du Moniteur :\n     notice  « ${notice.titleFr} »\n     proposé « ${TAX_JUSTE} »\n   STOP`)

  if (envFait && taxFait) { console.log('les trois réparations sont déjà faites — rien à faire.'); await prisma.$disconnect(); return }

  console.log('SUITES DE L’AUDIT DU 30 AOÛT 2026\n')
  console.log(`1. « ${env.titleFr?.slice(0, 66)} »`)
  console.log(`   index  : ${ancien.length} → ${neuf.length} entrées · ${ancienRenvois} → ${renvois} renvois · ${doubles} doublon(s) retiré(s) · ${renommes} sujet(s) renommés`)
  console.log(`   corps  : ${ancienLignes} → ${lignesNeuf} lignes · ${etrangeres.length} ligne(s) étrangère(s) retirée(s) :`)
  for (const l of etrangeres) console.log(`              « ${l.slice(0, 88)} »`)
  console.log(`   inchangé : ${anc.size} ancres, ${ENV_ATTENDU.toc} sections, aucun renvoi mort, aucun sujet perdu`)
  console.log(`\n2. « ${TAX_SOURCE} »`)
  console.log(`   AVANT : ${tax.titleFr}`)
  console.log(`   APRÈS : ${TAX_JUSTE}`)
  console.log(`   confronté à la notice LM1987-76 de l’Index du Moniteur : concordant`)
  console.log(`\n⚠️ NON TRAITÉ ICI : l’erratum du Moniteur n° 94 de 1987 (notice LM1987-94) touchant le décret`)
  console.log(`   sur la mission du CONATEL. Il est RÉEL ; son contenu doit être lu sur le fascicule avant`)
  console.log(`   d’être reporté. Point ouvert, pas correction à l’aveugle.`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  await prisma.$transaction(async (tx) => {
    if (!envFait) {
      await tx.document.update({
        where: { id: env.id },
        data: { bodyOriginal: corpsNeuf, annotationsJson: JSON.stringify({ ...a, indexEntries: neuf }) },
      })
      await audit({
        action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: env.id,
        meta: {
          motif:
            'Deux réparations, suites de l’audit adversarial du 30 août 2026. (1) INDEX : le fichier de la ' +
            'cliente porte deux parties — un index alphabétique et un « CLASSEMENT THÉMATIQUE DES ENTRÉES » ' +
            'qui reprend les mêmes sujets, séparateur tabulation. Elles avaient été ADDITIONNÉES : 352 ' +
            'entrées et 1 284 renvois versés, dont 161 sujets en double avec des ctRefs identiques. La ' +
            'fiche ne porte plus que l’index alphabétique : 191 entrées, 666 renvois, aucun doublon, aucun ' +
            'renvoi mort, 161 des 162 articles cités (seul l’article 98 ne l’est jamais). Aucun sujet perdu, ' +
            'contrôlé un par un ; 45 sujets renommés, la mention « préambule » étant détachée du sujet. ' +
            '(2) CORPS : il emportait les EXTRAITS DU REGISTRE DES MARQUES DE FABRIQUE ET DE COMMERCE, deux ' +
            'notices de marques et le colophon des Presses Nationales — six lignes du fascicule, étrangères ' +
            'au décret. Le texte s’arrête désormais à la dernière signature ministérielle. Les 162 ancres, ' +
            'les 41 sections et les 33 visas sont inchangés.',
          index: { avant: ancien.length, apres: neuf.length, renvoisAvant: ancienRenvois, renvoisApres: renvois, doublonsRetires: doubles },
          corps: { avant: ancienLignes, apres: lignesNeuf, lignesRetirees: etrangeres.length },
        },
      }, tx)
    }
    if (!taxFait) {
      await tx.document.update({ where: { id: tax.id }, data: { titleFr: TAX_JUSTE, number: TAX_JUSTE } })
      await audit({
        action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: tax.id,
        meta: {
          motif:
            'Intitulé corrigé, suite de l’audit du 30 août 2026. La fiche portait « …un mode de taxation en ' +
            'harmonie avec le SERVICE RENDU » — formule qui n’existe dans aucune source. Le .docx de la ' +
            'transcription et la notice LM1987-76 de l’Index du Moniteur disent l’un comme l’autre « …en ' +
            'harmonie avec le NIVEAU D’UTILISATION DU SPECTRE, en tenant compte des nouvelles méthodes de ' +
            'description et de désignation des émissions ». La règle du nom complet existe pour que ' +
            'l’intitulé soit exact : un objet approximatif la vide de son sens. Le sigle (CONATEL) est ' +
            'ajouté, comme le porte la notice.',
          avant: TAX_FAUX, apres: TAX_JUSTE, temoin: 'LM1987-76',
        },
      }, tx)
    }
  }, { timeout: 120_000 })

  // ── on RELIT la base ───────────────────────────────────────────────────────────────────
  await reindexDocument(env.id)
  await reindexDocument(tax.id)
  const e2 = await prisma.document.findFirst({ where: { source: ENV_SOURCE }, select: { bodyOriginal: true, annotationsJson: true, searchText: true } })
  const a2 = JSON.parse(String(e2?.annotationsJson ?? '{}'))
  const i2: Idx[] = a2.indexEntries ?? []
  const s2 = i2.map((x) => x.subject)
  const b2 = segmentAnnotated(e2?.bodyOriginal ?? '', a2.toc ?? []) as { kind: string; anchor?: string | null }[]
  const t2 = await prisma.document.findFirst({ where: { source: TAX_SOURCE }, select: { titleFr: true, number: true, searchText: true } })
  console.log(`\n✓ environnement : ${(e2?.bodyOriginal ?? '').split('\n').filter(Boolean).length} lignes · ${new Set(b2.filter((x) => x.kind === 'body' && x.anchor).map((x) => x.anchor)).size} ancres · index ${i2.length}/${i2.reduce((n, x) => n + x.ctRefs.length, 0)} · ${s2.length - new Set(s2).size} doublon(s) · ${/EXTRAITS DU REGISTRE|Presses Nationales/i.test(e2?.bodyOriginal ?? '') ? 'MATIÈRE ÉTRANGÈRE PRÉSENTE ⚠️' : 'aucune matière étrangère'} · ${e2?.searchText?.length ?? 0} c.`)
  console.log(`✓ taxation : titre=réf ${t2?.titleFr === t2?.number ? 'oui' : 'NON'} · « ${t2?.titleFr?.slice(0, 92)}… » · ${t2?.searchText?.length ?? 0} c.`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
