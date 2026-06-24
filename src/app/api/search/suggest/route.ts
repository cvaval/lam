import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth/session'
import { getClientCtx } from '@/lib/auth/request'
import { guard } from '@/lib/security/ratelimit'
import { can } from '@/lib/rbac'
import { accessibleTypes } from '@/lib/access'
import { prisma } from '@/lib/db'
import { fold } from '@/lib/search/normalize'
import { pickLocale } from '@/lib/i18n/pick'
import type { DocType } from '@/lib/types'

export const runtime = 'nodejs'

// Types « nommés » : on propose en autocomplétion les titres de lois, circulaires,
// finances, jurisprudence, doctrine et marques — PAS les 27k entrées d'Index (avis en
// vrac, peu utiles à compléter ; les sociétés de l'Index sont proposées via Company).
const NAMED: DocType[] = ['LEGISLATION', 'CIRCULAIRE_BRH', 'LOI_FINANCES', 'JURISPRUDENCE', 'DOCTRINE', 'MARQUE']

// La requête « ressemble à un numéro/référence » (saut direct) si elle contient un
// chiffre et reste courte (ex. « 129 », « 95-5 », « LM2016-100 », « BRH 129 »).
const looksLikeRef = (q: string) => /\d/.test(q) && q.length <= 24

export interface Suggestion {
  kind: 'direct' | 'doc' | 'company'
  id: string
  type?: DocType
  number?: string | null
  title: string
}

/**
 * Autocomplétion de la barre de recherche (§07). Renvoie, selon les services
 * accessibles à l'utilisateur (§03), des suggestions issues du corpus :
 *  - « direct » : correspondances de NUMÉRO (saut direct vers la fiche) ;
 *  - « doc »    : titres de lois/circulaires/… contenant la saisie ;
 *  - « company »: sociétés de l'Index du Moniteur.
 * Léger (autocomplétion fréquente) : ne consomme PAS le quota mensuel de recherche.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)

  const ctx = getClientCtx(req)
  if (!(await guard({ action: 'suggest', subject: user.id, limit: 80, windowMs: 60_000 }, { actorId: user.id, ip: ctx.ip }))) {
    return NextResponse.json({ ok: true, suggestions: [] })
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 80)
  if (q.length < 2) return NextResponse.json({ ok: true, suggestions: [] })

  const f = fold(q)
  const allowed = accessibleTypes(user)
  const named = NAMED.filter((t) => allowed.includes(t))
  const locale = user.locale

  const out: Suggestion[] = []
  const seen = new Set<string>()
  const titleOf = (d: { titleFr: string; titleEn: string | null; titleHt: string | null }) =>
    pickLocale(d.titleFr, d.titleEn, d.titleHt, locale) || d.titleFr

  const docSelect = { id: true, type: true, number: true, titleFr: true, titleEn: true, titleHt: true } as const

  // 1) Saut direct par NUMÉRO (ex. « 129 » → Circulaire n° 129).
  if (named.length && looksLikeRef(q)) {
    const token = q.replace(/^(circulaire|lettre|lettre-circulaire|loi|brh|n[o°]\s*|du)\s*/gi, '').trim() || q
    const direct = await prisma.document.findMany({
      where: { type: { in: named }, number: { contains: token, mode: 'insensitive' } },
      take: 4,
      orderBy: { publicationDate: 'desc' },
      select: docSelect,
    })
    for (const d of direct) {
      const tkey = 't:' + fold(titleOf(d))
      if (seen.has(d.id) || seen.has(tkey)) continue
      seen.add(d.id)
      seen.add(tkey)
      out.push({ kind: 'direct', id: d.id, type: d.type as DocType, number: d.number, title: titleOf(d) })
    }
  }

  // 2) Titres / contenu (recherche accent-folée via searchText), hors avis-sociétés groupés.
  // On rapporte un peu plus large puis on PRIORISE les correspondances de TITRE/NUMÉRO
  // (plus pertinentes en autocomplétion) sur les simples correspondances de corps.
  if (named.length) {
    const docs = await prisma.document.findMany({
      where: {
        type: { in: named },
        searchText: { contains: f },
        OR: [{ category: null }, { category: { not: 'SOCIETE' } }],
      },
      take: 14,
      orderBy: { publicationDate: 'desc' },
      select: docSelect,
    })
    const inTitle = (d: typeof docs[number]) =>
      fold(`${d.titleFr} ${d.titleEn ?? ''} ${d.titleHt ?? ''} ${d.number ?? ''}`).includes(f)
    docs.sort((a, b) => Number(inTitle(b)) - Number(inTitle(a))) // titre d'abord, ordre par date conservé sinon
    for (const d of docs) {
      // Dédup par ID ET par TITRE folé (comme le moteur FTS) : un même texte dual-listé —
      // ex. Code des Douanes en Législation ET en « Législation annotée » — ne doit pas
      // produire deux suggestions identiques (constat d'audit §3/§17).
      const tkey = 't:' + fold(titleOf(d))
      if (seen.has(d.id) || seen.has(tkey)) continue
      seen.add(d.id)
      seen.add(tkey)
      out.push({ kind: 'doc', id: d.id, type: d.type as DocType, number: d.number, title: titleOf(d) })
      if (out.filter((o) => o.kind === 'doc').length >= 6) break
    }
  }

  // 3) Sociétés de l'Index (réservé aux paliers qui voient l'Index sociétés).
  if (can(user.role, 'index.companies')) {
    const cos = await prisma.company.findMany({
      where: { searchName: { contains: f } },
      take: 3,
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
    for (const c of cos) {
      const key = `co:${c.id}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ kind: 'company', id: c.id, title: c.name })
    }
  }

  return NextResponse.json({ ok: true, suggestions: out.slice(0, 8) })
}
