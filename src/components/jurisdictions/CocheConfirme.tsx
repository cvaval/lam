/**
 * La coche « Confirmé » — propre à Agora : une coche blanche dans un disque BLEU PROFOND (#152E38).
 * Ni sceau dentelé « vérifié », ni logo ou ressource d'un réseau social. Décorative : le nom
 * accessible est porté par le bouton qui l'enveloppe (`InfobulleConfirme`).
 */
export function CocheConfirme({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false" className={`${className} shrink-0`}>
      <circle cx="10" cy="10" r="9.25" fill="#152E38" />
      <path d="M5.9 10.3l2.6 2.6 5.6-5.8" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
