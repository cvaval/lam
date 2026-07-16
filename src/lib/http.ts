/**
 * Petit client fetch partagé (composants client). Centralise la sérialisation
 * JSON, la lecture de la réponse et — surtout — la prise en compte du statut HTTP :
 * un 403/409/500 ne doit jamais être traité comme un succès (constat d'audit).
 *
 * Retour : { ok, status, data, error }. `ok` reflète à la fois le statut HTTP et
 * le champ booléen `ok` du corps JSON (convention de toutes nos routes API).
 */
export type PostResult<T = any> = {
  ok: boolean
  status: number
  data: T | null
  error: string | null
}

async function requestJson<T>(url: string, init: RequestInit): Promise<PostResult<T>> {
  try {
    const res = await fetch(url, init)
    const data = await res.json().catch(() => null)
    const ok = res.ok && (data?.ok ?? true)
    return { ok, status: res.status, data: data as T, error: ok ? null : data?.error ?? `http_${res.status}` }
  } catch {
    // Échec réseau / requête interrompue.
    return { ok: false, status: 0, data: null, error: 'network' }
  }
}

export async function postJson<T = any>(url: string, body?: unknown): Promise<PostResult<T>> {
  return requestJson<T>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/** PATCH/PUT/DELETE JSON — même contrat que postJson (statut HTTP + `ok` du corps). */
export async function sendJson<T = any>(url: string, method: 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<PostResult<T>> {
  return requestJson<T>(url, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/** Variante multipart (téléversement de fichier) : ne fixe pas content-type. */
export async function postForm<T = any>(url: string, form: FormData): Promise<PostResult<T>> {
  return requestJson<T>(url, { method: 'POST', body: form })
}
