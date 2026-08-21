/**
 * § 5.5 — VÉRIFICATION DES TEXTES GELÉS. **LECTURE SEULE.**
 *
 *   npx tsx scripts/verify-delais-sources.ts
 *
 * Relit en base les articles recopiés dans `src/lib/delais/textes.ts` et affiche le diff.
 * **Il n'écrit rien, il ne corrige rien.** Un diff non vide est un signal humain, pas une
 * mise à jour automatique : si le corpus a changé, c'est à la rédaction de dire si c'est le
 * corpus ou la constante qui a raison.
 *
 * Il vérifie aussi les SIX citations du § 4.7 (garde-fou 1) : pour chaque entrée `CIVIL` en
 * régime `FRANC`, la phrase de l'article existe-t-elle encore, mot pour mot, à l'endroit où
 * elle a été lue le 19 août 2026 ?
 */
import { prisma } from '../src/lib/db'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import {
  ARRETS,
  CITATIONS_CIVIL_FRANC,
  CITATIONS_DISTANCE_LIEUES,
  CITATIONS_DUREE_AILLEURS,
  TEXTES,
} from '../src/lib/delais/textes'

/** Comparaison INSENSIBLE aux seuls blancs : tout le reste compte, y compris les coquilles. */
function memeTexte(a: string, b: string): boolean {
  const n = (s: string) => s.replace(/\s+/g, ' ').trim()
  return n(a) === n(b)
}

/** Extrait le bloc d'un article : de son en-tête à l'en-tête suivant. */
function blocArticle(corps: string, ancre: string): string | null {
  const lignes = corps.split('\n')
  let dans = false
  const buf: string[] = []
  for (const l of lignes) {
    const a = articleAnchorFromHeading(l.trim())
    if (a) {
      if (dans) break
      if (a === ancre) dans = true
    }
    if (dans) buf.push(l)
  }
  return buf.length ? buf.join('\n').trimEnd() : null
}

/**
 * ⚠️ `ctrav-110` NE S'EXTRAIT PAS PAR BLOC. L'article 110 du Code du travail REPRODUIT le
 * décret du 23 mai 1989, qui porte sa propre numérotation : la ligne « Article 1. Dès la
 * publication du présent Décret… » est reconnue comme un en-tête d'article par
 * `articleAnchorFromHeading`, et l'extraction s'arrête là. Ce n'est pas une divergence du
 * texte, c'est une limite de l'extracteur — la même famille de piège que les 207 numéros en
 * double du Code du travail (§ 4.5 bis). On le contrôle donc par recherche de sous-chaîne
 * dans le corps, sur le texte entier.
 */
const PAR_SOUS_CHAINE = new Set(['ctrav-110'])

/**
 * ⚠️ `decret-1989-art-1` NE S'EXTRAIT NI PAR BLOC NI PAR SOUS-CHAÎNE CONTIGUË. Le fascicule
 * du Moniteur n° 47-A est un scan sur DEUX COLONNES : la colonne des ministres signataires
 * et un en-tête de page s'intercalent au milieu de la liste des sept fêtes légales. Le
 * contrôle porte donc LIGNE À LIGNE — chaque ligne de la constante doit se retrouver dans le
 * corps, blancs normalisés. C'est la même famille de limite d'extracteur que `ctrav-110`,
 * pas une divergence du texte (§ 5.5, défaut 17 b).
 */
const PAR_LIGNES = new Set(['decret-1989-art-1'])

const ANCRES: Record<string, string> = {
  'cpc-987': 'art-987',
  'cpc-991': 'art-991',
  'cpc-996': 'art-996',
  'cpc-74': 'art-74',
  'cpc-12': 'art-12',
  'ctrav-511': 'art-511',
  'ctrav-512': 'art-512',
  'ctrav-108': 'art-108',
  'ctrav-110': 'art-110',
  'const-275': 'art-275',
  'const-275-1': 'art-275-1',
  'const-275-2': 'art-275-2',
}

async function main() {
  console.log('\n● LECTURE SEULE — aucun écrit, aucune correction automatique.\n')
  let ecarts = 0

  const corps = new Map<string, string>()
  for (const cle of Object.keys(TEXTES)) {
    const t = TEXTES[cle]
    if (!corps.has(t.docId)) {
      const doc = await prisma.document.findUnique({
        where: { id: t.docId },
        select: { bodyOriginal: true },
      })
      corps.set(t.docId, doc?.bodyOriginal ?? '')
    }
  }

  console.log('─── Les articles gelés ' + '─'.repeat(52))
  for (const [cle, t] of Object.entries(TEXTES)) {
    const body = corps.get(t.docId) ?? ''
    if (!body) {
      console.log(`  ✗ ${cle.padEnd(14)} document introuvable : ${t.docId}`)
      ecarts++
      continue
    }
    if (PAR_LIGNES.has(cle)) {
      const plat = body.replace(/\s+/g, ' ')
      const manquantes = t.texte
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !plat.includes(l.replace(/\s+/g, ' ')))
      if (manquantes.length === 0) {
        console.log(
          `  ✓ ${cle.padEnd(20)} ${t.reference} (contrôlé LIGNE À LIGNE — scan deux colonnes)`,
        )
      } else {
        ecarts++
        console.log(`  ✗ ${cle.padEnd(20)} ${t.reference} — ${manquantes.length} ligne(s) absentes :`)
        for (const l of manquantes) console.log(`      « ${l} »`)
      }
      continue
    }
    if (PAR_SOUS_CHAINE.has(cle)) {
      const trouve = body.replace(/\s+/g, ' ').includes(t.texte.replace(/\s+/g, ' '))
      if (trouve) {
        console.log(`  ✓ ${cle.padEnd(14)} ${t.reference} (contrôlé par sous-chaîne)`)
      } else {
        ecarts++
        console.log(`  ✗ ${cle.padEnd(14)} ${t.reference} — texte INTROUVABLE dans le corps`)
        console.log(`      constante : ${t.texte.replace(/\s+/g, ' ').slice(0, 220)}`)
      }
      continue
    }
    const bloc = blocArticle(body, ANCRES[cle])
    if (!bloc) {
      console.log(`  ✗ ${cle.padEnd(14)} en-tête ${ANCRES[cle]} introuvable dans le corps`)
      ecarts++
      continue
    }
    if (memeTexte(bloc, t.texte)) {
      console.log(`  ✓ ${cle.padEnd(14)} ${t.reference}`)
    } else {
      ecarts++
      console.log(`  ✗ ${cle.padEnd(14)} ${t.reference} — DIFF :`)
      console.log(`      constante : ${t.texte.replace(/\s+/g, ' ').slice(0, 220)}`)
      console.log(`      base      : ${bloc.replace(/\s+/g, ' ').slice(0, 220)}`)
    }
  }

  for (const [titre, table] of [
    ['Les six citations CIVIL / FRANC (§ 4.7, garde-fou 1)', CITATIONS_CIVIL_FRANC],
    ['Les trois citations « un jour par cinq lieues » (§ 4.9, A5)', CITATIONS_DISTANCE_LIEUES],
    // § 4.5, défaut 3 — l'article qui porte la durée quand ce n'est pas celui du catalogue.
    ['Les durées portées par UN AUTRE article (§ 4.5, art. 356)', CITATIONS_DUREE_AILLEURS],
  ] as const) {
    console.log(`\n─── ${titre} ` + '─'.repeat(Math.max(4, 74 - titre.length)))
    for (const [article, c] of Object.entries(table)) {
      if (!c.citation || !c.docId) {
        console.log(`  · ${article.padEnd(26)} AUCUNE CITATION — ${c.constat.slice(0, 90)}…`)
        continue
      }
      const doc = await prisma.document.findUnique({
        where: { id: c.docId },
        select: { bodyOriginal: true },
      })
      const body = (doc?.bodyOriginal ?? '').replace(/\s+/g, ' ')
      const trouvee = body.includes(c.citation.replace(/\s+/g, ' '))
      if (trouvee) console.log(`  ✓ ${article.padEnd(26)} retrouvée mot pour mot`)
      else {
        ecarts++
        console.log(`  ✗ ${article.padEnd(26)} INTROUVABLE en base — la citation a bougé`)
      }
    }
  }

  console.log('\n─── Les extraits d’arrêts ' + '─'.repeat(49))
  for (const [cle, a] of Object.entries(ARRETS)) {
    const doc = await prisma.document.findUnique({
      where: { id: a.docId },
      select: { bodyOriginal: true },
    })
    const body = (doc?.bodyOriginal ?? '').replace(/\s+/g, ' ')
    // Les deux extraits « germeil-distance » et « prophete-renonciation » sont des RÉSUMÉS de
    // la rédaction, pas des citations : ils ne se recherchent pas dans le corps.
    if (!/^[a-z-]*brown/.test(cle)) {
      console.log(`  · ${cle.padEnd(30)} résumé éditorial — non recherché`)
      continue
    }
    const trouve = body.includes(a.extrait.replace(/\s+/g, ' '))
    if (trouve) console.log(`  ✓ ${cle.padEnd(30)} retrouvé mot pour mot`)
    else {
      ecarts++
      console.log(`  ✗ ${cle.padEnd(30)} INTROUVABLE dans ${a.docId}`)
    }
  }

  console.log(
    ecarts === 0
      ? '\n✓ Aucun écart : les constantes gelées sont conformes à la base.\n'
      : `\n✗ ${ecarts} écart(s). C’est un signal HUMAIN : ne corrige rien tout seul.\n`,
  )
  if (ecarts > 0) process.exitCode = 1
}

main().finally(() => prisma.$disconnect())
