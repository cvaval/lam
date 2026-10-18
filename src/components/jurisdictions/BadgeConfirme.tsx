/**
 * Badge « Confirmé » d'un notaire — propre à Agora : une petite coche BLEU PROFOND (#152E38) dans un
 * disque, et le libellé sur fond sauge. Ni sceau dentelé « vérifié », ni logo ou ressource d'un
 * réseau social. Il dit une seule chose : les informations de la fiche ont été confirmées par le
 * notaire (validation du master admin). Ce n'est ni une certification professionnelle, ni une
 * reconnaissance du MJSP, ni une garantie des prestations — et son absence ne dit rien.
 *
 * N'est rendu QUE si le serveur l'a autorisé (`confirmedOn`, voir notaires-confirmation.ts).
 * Infobulle (`title`) et nom accessible : « Informations confirmées par le notaire. »
 */
export function CocheConfirme({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false" className={`${className} shrink-0`}>
      <circle cx="10" cy="10" r="9.25" fill="#152E38" />
      <path d="M5.9 10.3l2.6 2.6 5.6-5.8" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function BadgeConfirme({ libelle, infobulle, avecLibelle = true }: { libelle: string; infobulle: string; avecLibelle?: boolean }) {
  return (
    <span title={infobulle} className="inline-flex items-center gap-1.5 align-middle font-sans">
      <CocheConfirme />
      {avecLibelle && (
        <span aria-hidden="true" className="rounded-full bg-[#E9EDE7] px-2.5 py-0.5 text-[12px] font-medium leading-5 text-[#152E38]">
          {libelle}
        </span>
      )}
      <span className="sr-only">{infobulle}</span>
    </span>
  )
}
