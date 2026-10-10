import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * Les libellés du formulaire des tiers, extraits du dictionnaire CÔTÉ SERVEUR : le composant
 * client ne reçoit que ces chaînes, jamais le dictionnaire entier.
 */
export function libellesDemande(t: Dictionary) {
  const j = t.judicial
  return {
    type: j.notaryRequestType,
    typeContact: j.notaryRequestTypeContact,
    typeListing: j.notaryRequestTypeListing,
    notary: j.notaryRequestNotary,
    notaryName: j.notaryRequestNotaryName,
    notaryNameHint: j.notaryRequestNotaryNameHint,
    commune: j.notaryRequestCommune,
    chooseCommune: j.notaryRequestChooseCommune,
    contactSection: j.notaryRequestContactSection,
    contactHint: j.notaryRequestContactHint,
    address: j.address,
    phone: j.notaryPhone,
    phonesHint: j.notaryRequestPhonesHint,
    /** Courriel PUBLIC de l'étude — à ne pas confondre avec `replyEmail`, privé. */
    officeEmail: j.notaryRequestOfficeEmail,
    message: j.notaryRequestMessage,
    you: j.notaryRequestYou,
    youHint: j.notaryRequestYouHint,
    name: j.notaryRequestName,
    role: j.notaryRequestRole,
    roleNotary: j.notaryRequestRoleNotary,
    roleOffice: j.notaryRequestRoleOffice,
    roleOther: j.notaryRequestRoleOther,
    roleOtherLabel: j.notaryRequestRoleOtherLabel,
    replyEmail: j.notaryRequestReplyEmail,
    consent: j.notaryRequestConsent,
    privacy: j.notaryRequestPrivacy,
    submit: j.notaryRequestSubmit,
    sending: j.notaryRequestSending,
    errorIntro: j.notaryRequestErrorIntro,
    /** Vérification humaine (Turnstile). */
    humain: {
      titre: j.humanCheckTitle,
      aide: j.humanCheckHint,
      mention: j.humanCheckNotice,
      sansJs: j.humanCheckNoscript,
      politique: j.notaryRequestPrivacy,
    },
    /** Code d'erreur renvoyé par la route → message. Un code inconnu est ignoré. */
    erreurs: {
      type: j.notaryRequestErrType,
      notaire: j.notaryRequestErrNotaire,
      nomNotaire: j.notaryRequestErrNomNotaire,
      commune: j.notaryRequestErrCommune,
      nom: j.notaryRequestErrNom,
      qualite: j.notaryRequestErrQualite,
      qualiteAutre: j.notaryRequestErrQualiteAutre,
      telephones: j.notaryRequestErrTelephones,
      courriel: j.notaryRequestErrCourriel,
      coordonnees: j.notaryRequestErrCoordonnees,
      courrielContact: j.notaryRequestErrCourrielContact,
      consentement: j.notaryRequestErrConsentement,
      frein: j.notaryRequestErrFrein,
      indisponible: j.notaryRequestErrIndisponible,
      humain: j.notaryRequestErrHumain,
      verification: j.notaryRequestErrVerification,
    } as Record<string, string>,
  }
}
export type LibellesDemande = ReturnType<typeof libellesDemande>
