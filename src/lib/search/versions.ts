/**
 * Versions disponibles des documents d'une page de résultats — le TEXTE (corps transcrit) et le
 * PDF original servable (Blob privé). Une seule requête pour la page affichée, quel que soit le
 * moteur de recherche (le miroir OpenSearch comme le moteur intégré) : rien n'est réindexé.
 *
 * « Texte » : un corps de plus de 300 octets (en deçà, c'est le libellé d'un fascicule scanné
 * non transcrit, « marque-page »). « PDF » : une adresse du Blob privé — seule servable par
 * `/api/doc/{id}/pdf` (les anciens chemins locaux ne le sont pas).
 *
 * `octet_length`, jamais `length` : la taille d'un texte compressé (TOAST) se lit dans son en-tête,
 * alors que compter ses CARACTÈRES oblige PostgreSQL à le décompresser en entier.
 */
import { prisma } from '../db'

export const SEUIL_TEXTE = 300
const BLOB = '%.blob.vercel-storage.com%'

export async function versionsDisponibles(ids: string[]): Promise<Map<string, { texte: boolean; pdf: boolean }>> {
  if (!ids.length) return new Map()
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string; texte: boolean; pdf: boolean }>>`
      SELECT id,
             (octet_length(coalesce("bodyOriginal", '')) > ${SEUIL_TEXTE} OR octet_length(coalesce("bodyClean", '')) > ${SEUIL_TEXTE}) AS texte,
             coalesce("sourcePdfUrl" LIKE ${BLOB}, false) AS pdf
      FROM "Document" WHERE id = ANY(${ids}::text[])`
    return new Map(rows.map((r) => [r.id, { texte: r.texte, pdf: r.pdf }]))
  } catch (e) {
    // Une panne ici ne doit pas faire tomber la recherche : les résultats restent, sans bouton PDF.
    console.error('[recherche] versions disponibles', e)
    return new Map()
  }
}
