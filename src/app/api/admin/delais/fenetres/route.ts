import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { requireCapabilityApi } from '@/lib/auth/guard'
import { audit } from '@/lib/auth/audit'
import { estSchemaAbsent, estVersionConcurrente } from '@/lib/delais/service-base'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * § 7.5 — LES FENÊTRES DE SIGNIFICATION. Deux lignes, et deux seulement : CIVILE (6–18,
 * C. pr. civ. art. 991) et TRAVAIL (8–17, C. trav. art. 512, dont la sanction de nullité est
 * expresse).
 *
 * Elles NE BORNENT PAS le délai, qui se compte en jours entiers et ignore les heures : elles
 * disent à quelle heure un huissier peut agir. Versionnées comme le calendrier, et pour la
 * même raison : **un permalien doit rendre à l'identique la phrase qu'il a rendue.**
 *
 * En tête de l'écran, la phrase qui borne l'édition : « Ces valeurs sont celles que les codes
 * écrivent. Ne les modifiez que sur un texte modificatif, en changeant la source dans le même
 * enregistrement. » — d'où `source` obligatoire sur CHAQUE ligne, dans le même envoi.
 */
const fenetre = z.object({
  matiere: z.enum(['CIVILE', 'TRAVAIL']),
  heureDebut: z.number().int().min(0).max(23),
  heureFin: z.number().int().min(1).max(24),
  /** JAMAIS VIDE : une heure sans le texte qui la fixe est une heure inventée. */
  source: z.string().trim().min(1).max(500),
  sourceDocId: z.string().trim().max(60).nullish(),
  nullite: z.boolean().default(false),
  nulliteTexteFr: z.string().trim().max(1000).nullish(),
})

const corps = z.object({
  // Les DEUX lignes voyagent ensemble : une version des fenêtres est un jeu complet, comme une
  // version du calendrier. Publier une matière sans l'autre ferait une version bancale, dont
  // la moitié tomberait en 404 sur un permalien.
  fenetres: z.array(fenetre).length(2),
  motif: z.string().trim().max(600).optional(),
})

export async function PATCH(req: NextRequest) {
  const admin = await requireCapabilityApi('corpus.manage')
  if (!admin) return apiError('forbidden', 403)
  const parsed = corps.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const lignes = parsed.data.fenetres

  const matieres = new Set(lignes.map((f) => f.matiere))
  if (matieres.size !== 2) return apiError('matieresIncompletes', 400)
  for (const f of lignes) {
    if (f.heureFin <= f.heureDebut) return apiError('heuresIncoherentes', 400)
    // Une nullité affirmée sans son texte serait une sanction sans texte.
    if (f.nullite && !(f.nulliteTexteFr ?? '').trim()) return apiError('nulliteSansTexte', 400)
  }

  try {
    const derniere = await prisma.delaiFenetreSignification.findFirst({
      orderBy: { versionFenetres: 'desc' },
      select: { versionFenetres: true },
    })
    const version = (derniere?.versionFenetres ?? 0) + 1

    await prisma.$transaction(
      lignes.map((f) =>
        prisma.delaiFenetreSignification.create({
          data: {
            versionFenetres: version,
            matiere: f.matiere,
            heureDebut: f.heureDebut,
            heureFin: f.heureFin,
            source: f.source,
            sourceDocId: f.sourceDocId?.trim() || null,
            nullite: f.nullite,
            nulliteTexteFr: f.nulliteTexteFr?.trim() || null,
          },
        }),
      ),
    )

    await audit({
      action: 'DELAI_FENETRES_UPDATED',
      actorId: admin.id,
      targetType: 'DELAI',
      targetId: `fenetres-v${version}`,
      meta: {
        version,
        versionPrecedente: derniere?.versionFenetres ?? null,
        motif: parsed.data.motif ?? null,
        fenetres: lignes.map((f) => ({ matiere: f.matiere, de: f.heureDebut, a: f.heureFin, source: f.source })),
      },
    })
    return NextResponse.json({ ok: true, version })
  } catch (e) {
    // Même course que sur le calendrier : `@@unique([versionFenetres, matiere])` protège la
    // base, mais un P2002 non reconnu remonterait une 500 au lieu d'un conflit lisible.
    if (estVersionConcurrente(e)) return apiError('versionConcurrente', 409)
    if (estSchemaAbsent(e)) return apiError('delaisSchemaAbsent', 503)
    throw e
  }
}
