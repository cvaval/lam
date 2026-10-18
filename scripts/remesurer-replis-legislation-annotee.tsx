/**
 * REMESURE DES REPLIS DE LA LÉGISLATION ANNOTÉE — § 7.1 de
 * docs/prompt-harmonisation-replis-legislation-annotee.md. LECTURE SEULE.
 *
 * Rend chaque fiche annotée (les données de prod, le composant de la fiche) en fr, en et ht, et compte
 * ce qui reste de chaque défaut mesuré à l'audit du 17 oct. 2026 :
 *   D2  ancienne rédaction montrée deux fois (repli + historique) ; abrogé à trois signaux
 *   D5  « Ancienne version (1987) » ailleurs que sur la Constitution
 *   D7  bloc connexe sans `kind` · D10 bandeau sans `kind`, ou dit « Renvoi »
 *   D11 pastille cliquable sans destination
 *   D15 libellé français dans le rendu anglais ou créole
 *
 *     npx tsx scripts/remesurer-replis-legislation-annotee.tsx
 */
import { PrismaClient } from '@prisma/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnnotatedText } from '../src/components/AnnotatedText'
import type { ArticleMark } from '../src/components/OfficialText'
import { parseAnnotations } from '../src/lib/legislation/annotated'
import { applyAmendments } from '../src/lib/legislation/segment'
import { getAmendments } from '../src/lib/legislation/amendments'
import { libelle, SITUATIONS, type Situation } from '../src/lib/legislation/situations'
import type { Locale } from '../src/lib/types'

const prisma = new PrismaClient()
const LOCALES: Locale[] = ['fr', 'en', 'ht']
/** Libellés de l'interface qui ne doivent jamais se lire sur /en ni /ht (le texte officiel, lui, est français). */
const UI_FR = (locale: Locale): string[] => [
  ...(Object.keys(SITUATIONS) as Situation[]).filter((s) => libelle(s, locale) !== SITUATIONS[s].label.fr).map((s) => SITUATIONS[s].label.fr),
  'Afficher',
  'Masquer',
  'Commentaires',
]

async function main() {
  const cibles = await prisma.$queryRaw<{ id: string; source: string | null }[]>`
    SELECT d.id, d.source FROM "Document" d
    WHERE d.type = 'LEGISLATION' AND d."annotationsJson" IS NOT NULL
      AND (d."annotationsJson" ~ '"(?:status|connexe|oldVersions|jurisprudence|commentaires|statusActe)"\\s*:\\s*\\{\\s*"'
           OR d."annotationsJson" ~ '"(?:note|insertedArticles)"\\s*:'
           OR EXISTS (SELECT 1 FROM "ArticleVersion" v WHERE v."documentId" = d.id))`
  console.log(`${cibles.length} fiche(s) annotée(s) à appareil\n`)

  const t = { deuxFois: 0, enRepli: 0, enRepliAbroges: 0, parFiche: {} as Record<string, number>, abrogeMulti: 0, f1987: [] as string[], connexeSansKind: 0, bandeauSansKind: 0, bandeauRenvoi: 0, lienMort: 0, sansDestination: 0, uiFr: {} as Record<string, number> }
  for (const { id, source } of cibles) {
    const d = await prisma.document.findUnique({ where: { id }, select: { bodyOriginal: true, bodyClean: true, annotationsJson: true } })
    const a = parseAnnotations(d!.annotationsJson)
    if (!a) continue
    const amendments = await getAmendments(id)
    const toc = new Set(a.toc.map((e) => e.label.replace(/\s+/g, ' ').trim()))
    const texte = applyAmendments(d!.bodyClean ?? d!.bodyOriginal ?? '', amendments, (l) => toc.has(l.replace(/\s+/g, ' ').trim()))

    // Même construction que la fiche (src/app/[locale]/(app)/doc/[id]/page.tsx).
    const marquesDe = (locale: Locale) => {
      const m = new Map<string, ArticleMark>()
      for (const ov of amendments.values()) {
        if (ov.added) m.set(ov.anchor, { kind: 'ajout', label: `${libelle('nouveau', locale)} — acte`, title: 't', href: '/doc' })
        else if (ov.amended) m.set(ov.anchor, { kind: ov.abrogated ? 'abroge' : 'modifie', label: libelle(ov.abrogated ? 'abroge' : 'amende', locale), title: 't', href: `#hist-${ov.anchor}` })
      }
      return m.size ? m : undefined
    }
    const histDansRepli = new Map<string, string>()
    const historique: string[] = []
    for (const ov of amendments.values()) {
      if (!ov.amended) continue
      if (a.oldVersions?.[ov.anchor]) {
        histDansRepli.set(ov.anchor, 'ligne datée')
        if (ov.abrogated) t.enRepliAbroges++
        t.parFiche[source ?? id] = (t.parFiche[source ?? id] ?? 0) + 1
      }
      else historique.push(ov.anchor)
    }
    t.enRepli += histDansRepli.size

    for (const blocs of Object.values(a.connexe ?? {})) for (const b of blocs) if (!b.kind) t.connexeSansKind++
    for (const c of a.crossRefs ?? []) if ((c.note || c.docs?.length || c.insertedArticles?.length) && !c.kind) t.bandeauSansKind++

    for (const locale of LOCALES) {
      const html = renderToStaticMarkup(
        <AnnotatedText text={texte} annotations={a} locale={locale} articleMarks={marquesDe(locale)} historiqueEnRepli={histDansRepli} linkArtRefs hideInlineIndex />,
      )
      if (locale === 'fr') {
        // D2 : un repli « hist-art-N » dans le lecteur ET une entrée d'historique de bas de page.
        for (const anc of historique) if (html.includes(`id="hist-${anc}"`)) t.deuxFois++
        // D2 : un article abrogé ne porte qu'UNE pastille « Abrogé ».
        for (const art of html.split('<article').slice(1)) if ((art.match(/data-situation="abroge"/g) ?? []).length > 1) t.abrogeMulti++
        // D5
        if (html.includes('Ancienne version (1987)')) t.f1987.push(source ?? id)
        // D10 : un bandeau qui dit « Renvoi » (aucun des 30 ne renvoie à un article).
        t.bandeauRenvoi += (html.match(/<p data-situation="renvoi"/g) ?? []).length
        // D11 : lien interne de pastille sans cible (cibles = ids du lecteur + entrées d'historique).
        const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]).concat(historique.map((x) => `hist-${x}`)))
        for (const m of html.matchAll(/<a href="#([^"]+)"[^>]*data-situation=/g)) if (!ids.has(m[1])) t.lienMort++
        t.sansDestination += html.split('title="Ancienne rédaction non disponible au corpus" data-situation="amende"').length - 1
      } else {
        for (const fr of UI_FR(locale)) {
          const n = html.split(`>${fr}<`).length - 1
          if (n) t.uiFr[`${locale}:${fr}`] = (t.uiFr[`${locale}:${fr}`] ?? 0) + n
        }
      }
    }
  }

  const ligne = (k: string, v: unknown, cible: string) => console.log(`${k.padEnd(64)} ${String(v).padStart(6)}   (attendu : ${cible})`)
  ligne('D2  anciennes rédactions montrées DANS le repli, sous l’article', t.enRepli, '209 = 137 amendés + 72 abrogés')
  console.log(`      dont ${t.enRepliAbroges} articles abrogés ; par fiche : ${Object.entries(t.parFiche).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  ligne('D2  … et ENCORE dans l’historique de bas de page', t.deuxFois, '0')
  ligne('D2  articles abrogés à plus d’une pastille « Abrogé »', t.abrogeMulti, '0')
  ligne('D5  fiches à « Ancienne version (1987) »', `${t.f1987.length} ${t.f1987.join(',')}`, '1 CONSTITUTION_1987')
  ligne('D7  blocs connexes sans nature', t.connexeSansKind, '0')
  ligne('D10 bandeaux sans nature', t.bandeauSansKind, '0')
  ligne('D10 bandeaux qui disent « Renvoi »', t.bandeauRenvoi, '0')
  ligne('D11 pastilles cliquables sans destination', t.lienMort, '0')
  ligne('D11 pastilles « Amendé » sans destination, dites telles', t.sansDestination, '≈ 249')
  ligne('D15 libellés français sur /en et /ht', Object.values(t.uiFr).reduce((x, y) => x + y, 0), '0')
  for (const [k, v] of Object.entries(t.uiFr)) console.log(`      ${k} : ${v}`)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
