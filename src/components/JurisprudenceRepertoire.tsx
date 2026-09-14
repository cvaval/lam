import Link from 'next/link'
import { prisma } from '@/lib/db'

/**
 * « AU RÉPERTOIRE » — les extraits de cet arrêt dans le Recueil alphabétique d'extraits de
 * jurisprudence haïtienne (J.-F. Salès, 1963-1989), rangés par notion.
 *
 * Composant SERVEUR asynchrone : il lit `JurisExtrait` pour la décision et rend, sous chaque
 * notion, le passage retenu par l'auteur et ses renvois. Il vit sous `JurisprudenceSommaire`
 * parce que c'est la seule porte de la fiche d'arrêt qui ne soit pas verrouillée par une
 * session parallèle (`doc/[id]/page.tsx`) — et parce que c'est bien de l'APPAREIL, comme le
 * sommaire : la parole de la Cour reste dans le corps, plus bas.
 *
 * ⚠️ UN RENVOI NON RÉSOLU S'AFFICHE COMME DU TEXTE, jamais comme un lien mort ni deviné. Un
 * renvoi résolu vers un texte dont l'article est introuvable mène au texte, sans ancre.
 * ⚠️ UN RENVOI POSTÉRIEUR À L'ARRÊT est une annotation de l'éditeur (le manuscrit a été
 * enrichi après 1989), pas un visa de la Cour : il se rend à part, après « cf. ».
 * ⚠️ AUCUNE CLÉ I18N NOUVELLE — les fichiers de locale appartiennent à une session parallèle.
 */
const LIB = {
  titre: { fr: 'Au Répertoire', en: 'In the Digest', ht: 'Nan Repètwa a' },
  source: {
    fr: 'Recueil alphabétique d’extraits de jurisprudence haïtienne — J.-F. Salès, 1963-1989',
    en: 'Alphabetical Digest of Haitian Case-Law Extracts — J.-F. Salès, 1963-1989',
    ht: 'Rekèy alfabetik ekstrè jirispridans ayisyen — J.-F. Salès, 1963-1989',
  },
  refs: { fr: 'Réf.', en: 'Ref.', ht: 'Ref.' },
  cf: { fr: 'cf.', en: 'cf.', ht: 'gade' },
  cfTitre: {
    fr: 'Renvoi à un texte postérieur à l’arrêt — annotation de l’éditeur, non visa de la Cour',
    en: 'Reference to a text later than the ruling — editor’s note, not a citation by the Court',
    ht: 'Referans a yon tèks ki vin apre desizyon an — nòt editè a, pa sitasyon Kou a',
  },
  notions: { fr: 'Toutes les notions', en: 'All notions', ht: 'Tout nosyon yo' },
} as const
type Libelle = { fr: string; en: string; ht: string }

export async function JurisprudenceRepertoire({ decisionId, locale }: { decisionId: string; locale: string }) {
  const lt = (o: Libelle) => (locale === 'en' ? o.en : locale === 'ht' ? o.ht : o.fr)
  const extraits = await prisma.jurisExtrait.findMany({
    where: { decisionId },
    select: {
      id: true, rang: true, texte: true, refsBrutes: true,
      theme: { select: { labelFr: true, parent: { select: { labelFr: true, slug: true } } } },
      refs: { select: { cible: true, cibleLibelle: true, article: true, posterieur: true, documentId: true, anchor: true } },
    },
    orderBy: [{ theme: { labelFr: 'asc' } }, { rang: 'asc' }],
  })
  if (!extraits.length) return null

  const libelleNotion = (e: (typeof extraits)[number]) => {
    const parent = e.theme.parent
    // Les lettres (« A »… « V ») sont des parents techniques, pas des notions.
    const parentUtile = parent && !/^jfs-lettre-/.test(parent.slug) ? parent.labelFr : null
    return parentUtile ? `${parentUtile} — ${e.theme.labelFr}` : e.theme.labelFr
  }
  const libelleRef = (r: (typeof extraits)[number]['refs'][number]) => {
    const base = r.article ? `art. ${r.article} ${r.cibleLibelle}` : r.cibleLibelle
    return base.replace(/\s+/g, ' ').trim()
  }

  return (
    <section className="rounded-2xl border border-chabon/10 bg-white p-5 font-sans" aria-labelledby="repertoire-titre">
      <div className="mb-3 flex flex-wrap items-baseline gap-2 border-b border-chabon/10 pb-3">
        <h2 id="repertoire-titre" className="text-sm font-semibold text-ank">{lt(LIB.titre)}</h2>
        <span className="text-xs text-grafit">{lt(LIB.source)}</span>
        <Link href={`/${locale}/jurisprudence`} className="no-print ml-auto text-xs text-chabon hover:underline">
          {lt(LIB.notions)} →
        </Link>
      </div>
      <div className="space-y-4">
        {extraits.map((e) => {
          const visas = e.refs.filter((r) => !r.posterieur)
          const cf = e.refs.filter((r) => r.posterieur)
          const rendu = (r: (typeof e.refs)[number], i: number) =>
            r.documentId ? (
              <Link key={i} href={`/${locale}/doc/${r.documentId}${r.anchor ? '#' + r.anchor : ''}`} className="text-chabon hover:underline">
                {libelleRef(r)}
              </Link>
            ) : (
              <span key={i} className="text-ank/80">{libelleRef(r)}</span>
            )
          return (
            <article key={e.id} className="border-l-2 border-chabon/20 pl-4">
              <h3 className="mb-1 font-mono text-[11px] uppercase tracking-wider text-grafit">{libelleNotion(e)}</h3>
              <p className="whitespace-pre-line break-words font-serif text-[15px] leading-relaxed text-ank">{e.texte}</p>
              {(visas.length > 0 || cf.length > 0 || e.refsBrutes) && (
                <p className="mt-1.5 text-xs leading-relaxed">
                  {visas.length > 0 && (
                    <>
                      <span className="font-mono uppercase tracking-wider text-grafit">{lt(LIB.refs)} </span>
                      {visas.map((r, i) => (<span key={i}>{i > 0 && ' · '}{rendu(r, i)}</span>))}
                    </>
                  )}
                  {cf.length > 0 && (
                    <span title={lt(LIB.cfTitre)}>
                      {visas.length > 0 && ' — '}
                      <span className="font-mono uppercase tracking-wider text-grafit">{lt(LIB.cf)} </span>
                      {cf.map((r, i) => (<span key={i}>{i > 0 && ' · '}{rendu(r, i)}</span>))}
                    </span>
                  )}
                  {/* Découpage incomplet : le livre reste lisible tel quel. */}
                  {!visas.length && !cf.length && e.refsBrutes && <span className="text-ank/80">{lt(LIB.refs)} {e.refsBrutes}</span>}
                </p>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
