'use client'

import { useState } from 'react'
import { FULLTEXT_TYPE_LIST } from '@/lib/brand'
import { Field, fieldCls } from './forms'
import { postJson, postForm } from '@/lib/http'
import { type DocType, type Locale } from '@/lib/types'
import type { Dictionary } from '@/lib/i18n/dictionaries'

interface ExtractedPub {
  selected: boolean
  title: string
  type: DocType
}

type DocKind = 'MONITEUR' | 'CIRCULAIRE_BRH'

interface ExtractResponse {
  ok: boolean
  ai: boolean
  aiError?: string
  documentKind: DocKind
  edition: { moniteurNumber: string | null; editionType: 'REGULIERE' | 'SPECIALE' | null; publicationDate: string | null }
  circulaire: { number: number | null; title: string | null; matiere: string | null }
  keywords: string[]
  publications: { title: string; type: DocType }[]
  bodyText: string
  textLayer: boolean
}

// « a, b ; c » saisi par l'admin → ['a', 'b', 'c'] (forme attendue par l'API).
function parseKeywordsInput(value: string): string[] {
  return value
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function UploadStudio({ locale, t }: { locale: Locale; t: Dictionary }) {
  const [file, setFile] = useState<File | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<{ ai: boolean; aiError?: string; textLayer: boolean; detected?: DocKind } | null>(null)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrNote, setOcrNote] = useState<string | null>(null)

  // Nature du document : édition du Moniteur ou circulaire BRH (onglet manuel,
  // basculé automatiquement par la détection de l'analyse).
  const [mode, setMode] = useState<DocKind>('MONITEUR')

  // Édition du Moniteur (modifiable après analyse)
  const [editionType, setEditionType] = useState<'REGULIERE' | 'SPECIALE'>('REGULIERE')
  const [moniteurNumber, setMoniteurNumber] = useState('')
  const [pubDate, setPubDate] = useState('')

  // Circulaire BRH (modifiable après analyse)
  const [circNumber, setCircNumber] = useState('')
  const [circDate, setCircDate] = useState('')
  const [circEffDate, setCircEffDate] = useState('')
  const [circTitle, setCircTitle] = useState('')
  const [circMatiere, setCircMatiere] = useState('')
  const [circStatus, setCircStatus] = useState('EN_VIGUEUR')

  // Mots-clés thématiques (pré-remplis par l'analyse, corrigeables — séparés par virgules)
  const [keywords, setKeywords] = useState('')

  // Titres extraits (orthographe modifiable) + texte de l'édition
  const [pubs, setPubs] = useState<ExtractedPub[]>([])
  const [body, setBody] = useState('')

  // Publication manuelle (mode simple)
  const [manualOpen, setManualOpen] = useState(false)
  const [titleFr, setTitleFr] = useState('')
  const [manualType, setManualType] = useState<DocType | ''>('')
  const [status, setStatus] = useState('PUBLIE')

  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ count: number; firstId?: string } | null>(null)
  const [gaps, setGaps] = useState<{ year: number; missing: string[] } | null>(null)
  const [brhGaps, setBrhGaps] = useState<{ missing: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function onFile(f: File | undefined) {
    if (!f) return
    setFile(f)
    setPdfUrl(URL.createObjectURL(f))
    setAnalysis(null)
    setPubs([])
    setDone(null)
  }

  // Analyse (IA si configurée côté serveur, heuristique sinon).
  async function analyze() {
    if (!file) return
    setAnalyzing(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('file', file)
      const res = await postForm<ExtractResponse>('/api/admin/upload/extract', fd)
      if (!res.ok || !res.data) throw new Error('extract')
      const data = res.data
      setAnalysis({ ai: data.ai, aiError: data.aiError, textLayer: data.textLayer, detected: data.documentKind })
      // Bascule automatique d'onglet selon la nature détectée (corrigeable à la main).
      setMode(data.documentKind)
      if (data.documentKind === 'CIRCULAIRE_BRH') {
        if (data.circulaire.number != null) setCircNumber(String(data.circulaire.number))
        if (data.edition.publicationDate) setCircDate(data.edition.publicationDate)
        if (data.circulaire.title) setCircTitle(data.circulaire.title)
        if (data.circulaire.matiere) setCircMatiere(data.circulaire.matiere)
      } else {
        if (data.edition.editionType) setEditionType(data.edition.editionType)
        if (data.edition.moniteurNumber) setMoniteurNumber(data.edition.moniteurNumber)
        if (data.edition.publicationDate) setPubDate(data.edition.publicationDate)
      }
      if (data.keywords?.length) setKeywords(data.keywords.join(', '))
      setPubs(data.publications.map((p) => ({ selected: true, title: p.title, type: p.type })))
      if (data.bodyText && !body) setBody(data.bodyText)
    } catch {
      setError(t.cms.analyzeFailed)
    } finally {
      setAnalyzing(false)
    }
  }

  // Reconnaissance de texte (OCR) — pour les PDF numérisés sans couche texte.
  // Remplit l'éditeur avec la transcription intégrale (corrigeable avant publication).
  async function runOcr() {
    if (!file) return
    setOcrBusy(true)
    setOcrNote(null)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('file', file)
      const res = await postForm<{ ok: boolean; text: string; pages: number; truncated: boolean }>(
        '/api/admin/upload/ocr',
        fd,
      )
      if (!res.ok || !res.data?.text) throw new Error('ocr')
      setBody(res.data.text)
      setAnalysis((a) => (a ? { ...a, textLayer: true } : a))
      setOcrNote(
        res.data.truncated
          ? `${t.cms.ocrDone} (${res.data.pages} ${t.cms.ocrPages}, ${t.cms.ocrTruncated})`
          : `${t.cms.ocrDone} (${res.data.pages} ${t.cms.ocrPages})`,
      )
    } catch {
      setError(t.cms.ocrFailed)
    } finally {
      setOcrBusy(false)
    }
  }

  function patchPub(i: number, patch: Partial<ExtractedPub>) {
    setPubs((list) => list.map((p, k) => (k === i ? { ...p, ...patch } : p)))
  }

  const selectedCount = pubs.filter((p) => p.selected).length

  const editionPayload = {
    editionType,
    moniteurNumber: moniteurNumber.trim() || undefined,
    publicationDate: pubDate || undefined,
  }

  // Publication en lot : un document par titre sélectionné.
  async function publishSelected() {
    if (!selectedCount || !body.trim()) {
      setError(t.cms.needBody)
      return
    }
    setBusy(true)
    setError(null)
    const res = await postJson('/api/admin/upload', {
      ...editionPayload,
      bodyOriginal: body,
      publications: pubs.filter((p) => p.selected).map((p) => ({ titleFr: p.title.trim(), type: p.type })),
    })
    setBusy(false)
    if (res.ok) {
      setDone({ count: res.data.count, firstId: res.data.ids?.[0] })
      setGaps(res.data.gaps ?? null)
      setBrhGaps(null)
      setPubs((list) => list.filter((p) => !p.selected))
    } else setError(t.cms.publishFailed)
  }

  // Publication manuelle d'un seul document.
  async function publishManual() {
    if (!manualType || !titleFr.trim() || !body.trim()) {
      setError(t.cms.needFields)
      return
    }
    setBusy(true)
    setError(null)
    const res = await postJson('/api/admin/upload', {
      ...editionPayload,
      type: manualType,
      titleFr,
      bodyOriginal: body,
      status,
      keywords: parseKeywordsInput(keywords),
    })
    setBusy(false)
    if (res.ok) {
      setDone({ count: 1, firstId: res.data.id })
      setGaps(res.data.gaps ?? null)
      setBrhGaps(null)
      setTitleFr('')
    } else setError(t.cms.publishFailed)
  }

  // Publication d'une circulaire BRH : numéro canonisé côté serveur
  // (« Circulaire n° {N} »), sceau apposé, manquants renvoyés dans la réponse.
  async function publishCirculaire() {
    const num = Number(circNumber)
    if (!Number.isInteger(num) || num <= 0 || !circTitle.trim() || !body.trim()) {
      setError(t.cms.needCircFields)
      return
    }
    setBusy(true)
    setError(null)
    const res = await postJson('/api/admin/upload', {
      type: 'CIRCULAIRE_BRH',
      titleFr: circTitle.trim(),
      bodyOriginal: body,
      circulaireNumber: num,
      publicationDate: circDate || undefined,
      effectiveDate: circEffDate || undefined,
      matiere: circMatiere.trim() || undefined,
      status: circStatus,
      keywords: parseKeywordsInput(keywords),
    })
    setBusy(false)
    if (res.ok) {
      setDone({ count: 1, firstId: res.data.id })
      setBrhGaps(res.data.brhGaps ?? null)
      setGaps(null)
    } else setError(t.cms.publishFailed)
  }

  return (
    <div className="space-y-5">
      {done && (
        <div className="flex items-center justify-between rounded-xl border border-fey/30 bg-fey-50 px-4 py-3 text-sm text-fey">
          <span>
            ✔ {done.count} {t.cms.published}
          </span>
          {done.firstId && (
            <a href={`/${locale}/doc/${done.firstId}`} className="font-semibold underline">
              {t.search.open} →
            </a>
          )}
        </div>
      )}

      {/* Alerte numéros manquants de l'année (détection après publication) */}
      {gaps && gaps.missing.length > 0 && (
        <div className="rounded-xl border border-soley/40 bg-soley-50 px-4 py-3 text-sm text-lank">
          <p className="font-semibold">
            ⚠ {t.cms.gapsWarning} {gaps.year} ({gaps.missing.length})
          </p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-lank/75">
            {gaps.missing.slice(0, 30).join(' · ')}
            {gaps.missing.length > 30 ? ` … (+${gaps.missing.length - 30})` : ''}
          </p>
          <a href={`/${locale}/admin/moniteur/manquants`} className="mt-1 inline-block text-xs font-semibold underline">
            {t.moniteur.missingLink} →
          </a>
        </div>
      )}

      {/* Alerte numéros de circulaires BRH manquants (détection après publication) */}
      {brhGaps && brhGaps.missing.length > 0 && (
        <div className="rounded-xl border border-soley/40 bg-soley-50 px-4 py-3 text-sm text-lank">
          <p className="font-semibold">
            ⚠ {t.cms.brhGapsWarning} ({brhGaps.missing.length})
          </p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-lank/75">
            {brhGaps.missing.slice(0, 30).join(' · ')}
            {brhGaps.missing.length > 30 ? ` … (+${brhGaps.missing.length - 30})` : ''}
          </p>
          <a href={`/${locale}/admin/brh`} className="mt-1 inline-block text-xs font-semibold underline">
            {t.admin.brhNav} →
          </a>
        </div>
      )}

      {/* 1 — Dépôt du PDF + analyse */}
      <div className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-1 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-lank/20 px-6 py-6 text-center hover:border-sitwon">
            <input type="file" accept="application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <span className="text-sm text-lank/60">{file?.name ?? t.cms.drop}</span>
          </label>
          <button
            onClick={analyze}
            disabled={!file || analyzing}
            className="rounded-lg bg-lank px-4 py-2.5 text-sm font-semibold text-white hover:bg-lank-600 disabled:opacity-40"
          >
            {analyzing ? t.cms.analyzing : `✨ ${t.cms.analyze}`}
          </button>
        </div>
        {analysis && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded-full px-2 py-0.5 font-medium ${
                analysis.ai ? 'bg-sitwon-50 text-sitwon-700' : 'bg-soley-50 text-soley-700'
              }`}
            >
              {analysis.ai ? `✨ ${t.cms.aiBadge}` : t.cms.heuristicBadge}
            </span>
            {analysis.detected && (
              <span className="rounded-full bg-fey-50 px-2 py-0.5 font-medium text-fey">
                {analysis.detected === 'CIRCULAIRE_BRH' ? t.cms.detectedCirculaire : t.cms.detectedMoniteur}
              </span>
            )}
            {analysis.aiError && <span className="text-red-600">{t.cms.aiFailed}</span>}
            {!analysis.textLayer && <span className="text-soley-700">{t.cms.noTextLayer}</span>}
          </div>
        )}
      </div>

      {/* 2 — Nature du document : édition du Moniteur ↔ circulaire BRH */}
      <div className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-lank">
            {mode === 'CIRCULAIRE_BRH' ? t.cms.circulaireMeta : t.cms.editionMeta}
          </h2>
          <div className="flex gap-1 rounded-lg border border-lank/15 p-1" role="tablist" aria-label={t.cms.docKindLabel}>
            {(['MONITEUR', 'CIRCULAIRE_BRH'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={mode === v}
                onClick={() => setMode(v)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  mode === v ? 'bg-lank text-white' : 'text-lank/60 hover:bg-paper'
                }`}
              >
                {v === 'MONITEUR' ? t.cms.modeMoniteur : t.cms.modeCirculaire}
              </button>
            ))}
          </div>
        </div>

        {mode === 'MONITEUR' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-lank/55">
                {t.cms.editionTypeLabel}
              </span>
              <div className="flex gap-1 rounded-lg border border-lank/15 p-1">
                {(['REGULIERE', 'SPECIALE'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setEditionType(v)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                      editionType === v ? 'bg-lank text-white' : 'text-lank/60 hover:bg-paper'
                    }`}
                  >
                    {v === 'REGULIERE' ? t.moniteur.regularOne : t.moniteur.specialOne}
                  </button>
                ))}
              </div>
            </div>
            <Field label={t.cms.moniteurNumber} value={moniteurNumber} onChange={setMoniteurNumber} placeholder="35" />
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-lank/55">
                {t.moniteur.pubDate}
              </label>
              <input
                type="date"
                value={pubDate}
                onChange={(e) => setPubDate(e.target.value)}
                className={fieldCls}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={t.cms.circulaireNumber} value={circNumber} onChange={setCircNumber} placeholder="114" />
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-lank/55">
                  {t.brh.pubDate}
                </label>
                <input
                  type="date"
                  value={circDate}
                  onChange={(e) => setCircDate(e.target.value)}
                  className={fieldCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-lank/55">
                  {t.brh.effDate}
                </label>
                <input
                  type="date"
                  value={circEffDate}
                  onChange={(e) => setCircEffDate(e.target.value)}
                  className={fieldCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-lank/55">
                  {t.admin.status}
                </label>
                <select value={circStatus} onChange={(e) => setCircStatus(e.target.value)} className={fieldCls}>
                  {['EN_VIGUEUR', 'PUBLIE', 'ABROGE', 'MODIFIE'].map((s) => (
                    <option key={s} value={s}>
                      {(t.statuses as Record<string, string>)[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t.cms.circulaireTitle} value={circTitle} onChange={setCircTitle} />
              <Field label={t.cms.matiereField} value={circMatiere} onChange={setCircMatiere} placeholder="Droit bancaire - Politique monétaire" />
            </div>
            <div>
              <Field
                label={t.cms.keywordsField}
                value={keywords}
                onChange={setKeywords}
                placeholder="politique monétaire, réserves obligatoires, BRH"
              />
              <p className="mt-1 text-[11px] text-lank/45">{t.cms.keywordsHint}</p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={publishCirculaire}
                disabled={busy}
                className="rounded-lg bg-fey px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? t.common.loading : t.cms.publishCirculaire}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3 — Titres extraits (orthographe modifiable, type par publication) — Moniteur */}
      {mode === 'MONITEUR' && pubs.length > 0 && (
        <div className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-lank">
              {t.cms.extractedTitles} ({pubs.length})
            </h2>
            <button
              onClick={publishSelected}
              disabled={busy || !selectedCount}
              className="rounded-lg bg-fey px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? t.common.loading : `${t.cms.publishSelected} (${selectedCount})`}
            </button>
          </div>
          <p className="mb-3 text-xs text-lank/45">{t.cms.editHint}</p>
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {pubs.map((p, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-lank/10 bg-paper/60 p-2">
                <input
                  type="checkbox"
                  checked={p.selected}
                  onChange={(e) => patchPub(i, { selected: e.target.checked })}
                  className="mt-2 h-4 w-4 accent-lank"
                />
                <textarea
                  value={p.title}
                  onChange={(e) => patchPub(i, { title: e.target.value })}
                  rows={2}
                  className="flex-1 resize-y rounded-md border border-lank/15 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-sitwon"
                />
                <select
                  value={p.type}
                  onChange={(e) => patchPub(i, { type: e.target.value as DocType })}
                  className="rounded-md border border-lank/15 bg-white px-2 py-1.5 text-xs outline-none focus:border-sitwon"
                >
                  {FULLTEXT_TYPE_LIST.map((m) => (
                    <option key={m.type} value={m.type}>
                      {m.badge}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 — Écran scindé : PDF source ↔ texte (orthographe modifiable) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-lank/45">{t.cms.splitScreen}</p>
        {/* OCR : nécessite la vision IA (analysis.ai) — inutile de proposer sans clé configurée. */}
        {file && analysis?.ai && (
          <div className="flex items-center gap-2">
            {!analysis.textLayer && <span className="text-xs font-medium text-soley-700">{t.cms.ocrSuggest}</span>}
            <button
              onClick={runOcr}
              disabled={ocrBusy}
              title={t.cms.ocrHint}
              className="rounded-lg border border-lank/20 bg-white px-3 py-1.5 text-xs font-semibold text-lank hover:border-sitwon disabled:opacity-40"
            >
              {ocrBusy ? t.cms.ocrBusy : `🔎 ${t.cms.ocr}`}
            </button>
          </div>
        )}
      </div>
      {ocrNote && <p className="text-xs text-fey">✔ {ocrNote}</p>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-96 overflow-hidden rounded-xl border border-lank/10 bg-lank/5">
          {pdfUrl ? (
            <object data={pdfUrl} type="application/pdf" className="h-full w-full">
              <p className="p-4 text-sm text-lank/50">{file?.name}</p>
            </object>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-lank/30">{t.cms.drop}</div>
          )}
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t.cms.validate}
          className="official-text h-96 w-full rounded-xl border border-lank/15 bg-white p-4 text-sm outline-none focus:border-sitwon"
        />
      </div>

      {/* 5 — Publication manuelle (un document) — Moniteur (la circulaire a son propre formulaire) */}
      {mode === 'MONITEUR' && (
      <div className="rounded-2xl border border-lank/10 bg-white shadow-card">
        <button
          onClick={() => setManualOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3 text-sm font-semibold text-lank"
        >
          {t.cms.manualMode}
          <span className="text-lank/40">{manualOpen ? '▴' : '▾'}</span>
        </button>
        {manualOpen && (
          <div className="grid grid-cols-1 gap-4 border-t border-lank/10 p-5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-lank/55">
                {t.cms.typeRequired} *
              </label>
              <select value={manualType} onChange={(e) => setManualType(e.target.value as DocType)} className={fieldCls}>
                <option value="">—</option>
                {FULLTEXT_TYPE_LIST.map((m) => (
                  <option key={m.type} value={m.type}>
                    {m.num}. {m.label[locale]}
                  </option>
                ))}
              </select>
            </div>
            <Field label={`${t.cms.titleField} *`} value={titleFr} onChange={setTitleFr} />
            <div className="sm:col-span-2">
              <Field
                label={t.cms.keywordsField}
                value={keywords}
                onChange={setKeywords}
                placeholder="politique monétaire, réserves obligatoires, BRH"
              />
              <p className="mt-1 text-[11px] text-lank/45">{t.cms.keywordsHint}</p>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-lank/55">
                {t.admin.status}
              </label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldCls}>
                {['PUBLIE', 'EN_VIGUEUR', 'ABROGE', 'MODIFIE'].map((s) => (
                  <option key={s} value={s}>
                    {(t.statuses as Record<string, string>)[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={publishManual}
                disabled={busy}
                className="rounded-lg bg-lank px-5 py-2.5 text-sm font-semibold text-white hover:bg-lank-600 disabled:opacity-50"
              >
                {busy ? t.common.loading : t.cms.publish}
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
      <p className="max-w-xl text-xs text-lank/45">{t.cms.note}</p>
    </div>
  )
}

