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

export async function postJson<T = any>(url: string, body?: unknown): Promise<PostResult<T>> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    const ok = res.ok && (data?.ok ?? true)
    return { ok, status: res.status, data: data as T, error: ok ? null : data?.error ?? `http_${res.status}` }
  } catch {
    // Échec réseau / requête interrompue.
    return { ok: false, status: 0, data: null, error: 'network' }
  }
}

/** Variante multipart (téléversement de fichier) : ne fixe pas content-type. */
export async function postForm<T = any>(url: string, form: FormData): Promise<PostResult<T>> {
  try {
    const res = await fetch(url, { method: 'POST', body: form })
    const data = await res.json().catch(() => null)
    const ok = res.ok && (data?.ok ?? true)
    return { ok, status: res.status, data: data as T, error: ok ? null : data?.error ?? `http_${res.status}` }
  } catch {
    return { ok: false, status: 0, data: null, error: 'network' }
  }
}
