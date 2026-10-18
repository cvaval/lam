import { CocheConfirme } from './CocheConfirme'
import { InfobulleConfirme } from './InfobulleConfirme'

export { CocheConfirme }

/**
 * Badge « Confirmé » d'un notaire — la coche bleu profond (infobulle au survol, au focus ou au
 * toucher : « Informations confirmées par le notaire. ») et le libellé « Confirmé » sur fond sauge.
 * Il dit une seule chose : les informations de la fiche ont été confirmées par le notaire (validation
 * du master admin). Ni certification professionnelle, ni reconnaissance du MJSP, ni garantie des
 * prestations — et son absence ne dit rien.
 *
 * N'est rendu QUE si le serveur l'a autorisé (`confirmedOn`, voir notaires-confirmation.ts).
 */
export function BadgeConfirme({ libelle, infobulle, avecLibelle = true, taille }: { libelle: string; infobulle: string; avecLibelle?: boolean; taille?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 align-middle font-sans">
      <InfobulleConfirme texte={infobulle} taille={taille} />
      {avecLibelle && (
        <span className="rounded-md bg-[#E9EDE7] px-2.5 py-0.5 text-[12px] font-medium leading-5 text-[#152E38]">
          {libelle}
        </span>
      )}
    </span>
  )
}
