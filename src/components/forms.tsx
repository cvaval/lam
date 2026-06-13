'use client'

/**
 * Primitives de formulaire partagées (admin/CMS) — une seule source pour le style
 * des champs et les étiquettes, afin que les évolutions de design se fassent ici.
 */

export const fieldCls =
  'w-full rounded-lg border border-lank/15 bg-white px-3 py-2 text-sm outline-none focus:border-sitwon'

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-lank/55">
      {children} {hint && <span className="font-normal normal-case text-lank/35">· {hint}</span>}
    </span>
  )
}

export function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      {children}
    </label>
  )
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={fieldCls}
      />
    </div>
  )
}
