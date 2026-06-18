import { put, get, type GetBlobResult } from '@vercel/blob'

/**
 * Stockage des fichiers (PDF originaux, pièces téléversées) sur Vercel Blob — store
 * PRIVÉ « lam-pdfs ». Les blobs privés ne sont JAMAIS servis directement : ils
 * passent par une route authentifiée (src/app/api/doc/[id]/pdf) qui vérifie l'accès
 * (canSeeSourcePdf / canReadService) puis streame le contenu. Le jeton est lu depuis
 * BLOB_READ_WRITE_TOKEN (env Vercel + .env local).
 */

const BLOB_HOST = '.blob.vercel-storage.com'

// Jeton RW statique passé EXPLICITEMENT (lu à l'APPEL, pas au chargement du module :
// les scripts définissent process.env après l'import). Dans une Function Vercel, le
// SDK privilégie sinon le jeton OIDC (lecture OK mais l'écriture échouait → 500 au
// put). Le jeton explicite est prioritaire (cf. doc « Resolution order »).
const rwToken = () => process.env.BLOB_READ_WRITE_TOKEN

/** Une URL Blob (migrée) — par opposition aux anciens chemins locaux (non servables). */
export function isBlobUrl(u: string | null | undefined): boolean {
  return typeof u === 'string' && u.includes(BLOB_HOST)
}

/**
 * Téléverse un PDF (ou autre binaire) dans le store privé et renvoie son URL Blob.
 * `pathname` déterministe (ex. `source-pdf/<type>/<docId>.pdf`) → ré-exécution
 * idempotente grâce à allowOverwrite.
 */
export async function uploadToBlob(
  pathname: string,
  data: Buffer | Uint8Array | ArrayBuffer | Blob,
  contentType = 'application/pdf',
  opts: { multipart?: boolean } = {},
): Promise<string> {
  const res = await put(pathname, data as Buffer, {
    access: 'private',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    multipart: opts.multipart,
    token: rwToken(),
  })
  return res.url
}

/** Récupère un blob privé (flux + métadonnées) pour le streamer via une Function. */
export async function getPrivateBlob(url: string): Promise<GetBlobResult | null> {
  return get(url, { access: 'private', token: rwToken() })
}
