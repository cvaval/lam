/**
 * Squelette de chargement de l'espace authentifié (audit UX 15 juil. : toutes
 * les pages sont `force-dynamic` — sans lui, la navigation bloque sans retour
 * visuel). Réutilise l'utilitaire `.skeleton` (globals.css, cahier v2).
 */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="skeleton h-5 w-56 rounded-lg" />
      <div className="skeleton h-9 w-full max-w-xl rounded-full" />
      <div className="grid gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
            <div className="skeleton h-4 w-2/3 rounded" />
            <div className="skeleton mt-3 h-3 w-full rounded" />
            <div className="skeleton mt-2 h-3 w-5/6 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
