'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { sendJson } from '@/lib/http'
import type { LigneFenetreAdmin } from './DelaiAdmin'

/**
 * § 7.5 — LES FENÊTRES DE SIGNIFICATION. Deux lignes, et deux seulement.
 *
 * Elles ne bornent pas le délai — il se compte en jours entiers et ignore les heures. Elles
 * disent à quelle heure un huissier peut agir, et le Code du travail y attache une nullité
 * expresse. D'où la règle d'écran, reprise mot pour mot du § 7.5 : « Ces valeurs sont celles
 * que les codes écrivent. Ne les modifiez que sur un texte modificatif, en changeant la source
 * dans le même enregistrement. »
 */

const BOUTON = 'min-h-[44px] rounded-full px-4 py-2 text-xs font-semibold transition'
const CHAMP = 'mt-1 w-full rounded-lg border border-chabon/20 bg-white px-3 py-2 text-sm font-normal text-ank'

type Saisie = {
  matiere: 'CIVILE' | 'TRAVAIL'
  heureDebut: string
  heureFin: string
  source: string
  sourceDocId: string
  nullite: boolean
  nulliteTexteFr: string
}

function depuis(lignes: LigneFenetreAdmin[]): Saisie[] {
  const une = (m: 'CIVILE' | 'TRAVAIL', defaut: Saisie): Saisie => {
    const l = lignes.find((x) => x.matiere === m)
    return l
      ? {
          matiere: m,
          heureDebut: String(l.heureDebut),
          heureFin: String(l.heureFin),
          source: l.source,
          sourceDocId: l.sourceDocId ?? '',
          nullite: l.nullite,
          nulliteTexteFr: l.nulliteTexteFr ?? '',
        }
      : defaut
  }
  return [
    une('CIVILE', {
      matiere: 'CIVILE',
      heureDebut: '6',
      heureFin: '18',
      source: 'C. pr. civ., art. 991',
      sourceDocId: '',
      nullite: false,
      nulliteTexteFr: '',
    }),
    une('TRAVAIL', {
      matiere: 'TRAVAIL',
      heureDebut: '8',
      heureFin: '17',
      source: 'C. trav., art. 512',
      sourceDocId: '',
      nullite: true,
      nulliteTexteFr: 'Toute signification ou exécution faite au mépris du présent article est nulle.',
    }),
  ]
}

export function DelaiFenetresAdmin({
  t,
  fenetres,
  version,
  schemaAbsent,
}: {
  t: Dictionary
  fenetres: LigneFenetreAdmin[]
  version: number | null
  schemaAbsent: boolean
}) {
  const d = t.delaisAdmin
  const router = useRouter()
  const [saisies, setSaisies] = useState<Saisie[]>(() => depuis(fenetres))
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const maj = (i: number, k: keyof Saisie, v: string | boolean) => {
    setSaisies((s) => s.map((x, j) => (i === j ? { ...x, [k]: v } : x)))
    setErreur(null)
  }

  async function enregistrer() {
    setBusy(true)
    setErreur(null)
    const res = await sendJson('/api/admin/delais/fenetres', 'PATCH', {
      fenetres: saisies.map((s) => ({
        matiere: s.matiere,
        heureDebut: Number(s.heureDebut),
        heureFin: Number(s.heureFin),
        source: s.source,
        sourceDocId: s.sourceDocId || null,
        nullite: s.nullite,
        nulliteTexteFr: s.nulliteTexteFr || null,
      })),
    })
    setBusy(false)
    if (!res.ok) {
      setErreur(res.error ?? 'actionFailed')
      return
    }
    router.refresh()
  }

  return (
    <div className="mt-5 max-w-4xl">
      <p className="font-mono text-xs text-ank">
        {version == null ? '—' : d.windowsVersion.replace('{n}', String(version))}
      </p>
      <p className="mt-2 rounded-xl border border-chabon/20 bg-white p-4 text-sm text-grafit">{d.windowsNote}</p>

      {erreur && (
        <p role="alert" className="mt-3 rounded-lg border-l-[3px] border-wouj bg-white px-3 py-2 text-sm text-ank">
          <b>{t.common.echec}</b> {(t.errors as Record<string, string>)[erreur] ?? erreur}
        </p>
      )}

      {saisies.map((s, i) => (
        <section key={s.matiere} className="mt-4 rounded-xl border border-chabon/20 bg-white p-4">
          <h3 className="font-serif text-base font-semibold text-ank">
            {s.matiere === 'CIVILE' ? d.matiereCIVILE : d.matiereTRAVAIL}
          </h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs font-semibold text-ank">
              {d.colHeureDebut}
              <input value={s.heureDebut} onChange={(e) => maj(i, 'heureDebut', e.target.value)} className={CHAMP} />
            </label>
            <label className="block text-xs font-semibold text-ank">
              {d.colHeureFin}
              <input value={s.heureFin} onChange={(e) => maj(i, 'heureFin', e.target.value)} className={CHAMP} />
            </label>
            <label className="block text-xs font-semibold text-ank lg:col-span-2">
              {d.fieldSource}
              <input value={s.source} onChange={(e) => maj(i, 'source', e.target.value)} className={CHAMP} />
            </label>
            <label className="block text-xs font-semibold text-ank lg:col-span-2">
              {d.fieldSourceDocId}
              <input value={s.sourceDocId} onChange={(e) => maj(i, 'sourceDocId', e.target.value)} className={CHAMP} />
            </label>
            <label className="block text-xs font-semibold text-ank lg:col-span-2">
              {d.colNullite}
              <input value={s.nulliteTexteFr} onChange={(e) => maj(i, 'nulliteTexteFr', e.target.value)} className={CHAMP} />
            </label>
          </div>
          <label className="mt-3 flex items-start gap-2 text-xs font-semibold text-ank">
            <input type="checkbox" checked={s.nullite} onChange={(e) => maj(i, 'nullite', e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>{d.colNullite}</span>
          </label>
        </section>
      ))}

      <button
        type="button"
        disabled={busy || schemaAbsent}
        onClick={enregistrer}
        className={`${BOUTON} mt-4 bg-wouj text-white hover:opacity-90 disabled:opacity-40`}
      >
        {d.save}
      </button>
    </div>
  )
}
