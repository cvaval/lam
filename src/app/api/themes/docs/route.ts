import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth/session'
import { documentsInTheme, TYPES_LEGISLATION_ANNOTEE } from '@/lib/legislation/themes'
import { corpusForSlug } from '@/lib/types'
import { guard, LIMITS } from '@/lib/security/ratelimit'

export const runtime = 'nodejs'

/**
 * Textes rattachés à un thème (sous-arbre compris), filtrés par accès §03 PUIS par le
 * corpus de la rubrique qui interroge.
 *
 * ⚠️ UN THÈME N'APPARTIENT À AUCUNE RUBRIQUE. Il classe des documents ; ce sont les
 * documents qui ont un type. La même route sert donc plusieurs rubriques, et c'est
 * l'APPELANT qui dit laquelle — d'où `section`. Sans ce paramètre, la route servait le
 * corpus de la Législation annotée en dur : appelée depuis une autre rubrique, elle
 * aurait rendu un arbre juste, des compteurs justes, et une liste vide à chaque clic —
 * la panne la plus difficile à lire, puisque tout le reste paraît fonctionner.
 *
 * Le repli en l'absence de `section` reste la Législation annotée : c'est ce que faisait
 * la route hier, et un onglet resté ouvert pendant un déploiement doit continuer d'être
 * servi correctement plutôt que de recevoir une liste vide.
 *
 * (Anciennement /api/legislation/theme-docs — nom trompeur dès lors qu'elle sert aussi
 * les circulaires. L'ancien chemin subsiste en réexport le temps que les onglets ouverts
 * se rechargent ; il peut être supprimé au déploiement suivant.)
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)
  // Anti-scraping (§09) : borne le moissonnage de la cartographie titres↔thèmes (constat audit).
  if (!(await guard({ action: 'doc', subject: user.id, ...LIMITS.doc }, { actorId: user.id }))) return apiError('rate', 429)
  const themeId = req.nextUrl.searchParams.get('themeId') ?? ''
  if (!themeId) return apiError('invalidFields', 400)

  const section = req.nextUrl.searchParams.get('section')
  // Une rubrique inconnue NE DOIT PAS ouvrir davantage : on retombe sur le corpus le plus
  // étroit connu, jamais sur « tous les types accordés ».
  const corpus = (section ? corpusForSlug(section) : null) ?? TYPES_LEGISLATION_ANNOTEE

  const docs = await documentsInTheme(themeId, user, { take: 300, corpus })
  return NextResponse.json({
    ok: true,
    docs: docs.map((d) => ({ id: d.id, type: d.type, titleFr: d.titleFr, titleEn: d.titleEn, titleHt: d.titleHt, number: d.number, status: d.status, anchor: d.anchor })),
  })
}
