/**
 * § 7.1 — **L'APERÇU OBLIGATOIRE NE SE REPLIE PAS SUR UN AUTRE CALENDRIER.**
 *
 * ⚠️ **LE DÉFAUT 8, ET CE QU'IL RENDAIT POSSIBLE.** `calculerApercu` posait
 * `entreesCalendrier: calendrier.ok ? calendrier.valeur : undefined`, sous le commentaire
 * « L'aperçu montre ce que rendrait le calendrier TEL QU'IL EST EN BASE ». Or `undefined` fait
 * retomber `calculer()` sur `calendrier(VERSION_CALENDRIER_COURANTE)` (`calcul.ts:694`
 * et `:601`) — le calendrier du CODE. Tant que la constante valait 1, le repli coïncidait avec
 * la base et le commentaire était vrai ; **depuis qu'elle vaut 2 et que la base est restée en
 * 1**, il montrait à un éditeur une date calculée sous un calendrier qui n'est pas en vigueur,
 * sans que rien à l'écran ne le signale (l'aperçu n'affiche pas le numéro de version). L'écart
 * se refermera à `--apply` ; il est ouvert dès maintenant et pour toute la durée d'attente.
 *
 * Ce fichier teste `apercuDeLEntree`, la fonction PURE que le composant appelle — pas de
 * navigateur, pas de base : ce qui est en jeu est une décision, pas un rendu.
 */
import { describe, expect, it } from 'vitest'
import { CALENDRIER_V1, VERSION_CALENDRIER_COURANTE } from '@/lib/delais/feries'
import { apercuDeLEntree } from './DelaiEntryForm'
import type { LigneFerieAdmin } from './DelaiAdmin'

/** Une entrée de délai valide et calculable : 30 jours francs, prorogeables. */
const CHAMPS = {
  code: 'CPC',
  article: 'Art. 1000',
  articleContexte: null,
  articleOccurrence: 1,
  tableau: 1,
  tableauTitreFr: null,
  ordre: 0,
  objetFr: 'Objet de contrôle',
  objetEn: '',
  objetHt: '',
  traductionRelue: false,
  dureeTexte: '30 jours',
  dureeFondementFr: null,
  kind: 'JOURS',
  jours: 30,
  nbDistances: 0,
  distanceAideFr: null,
  distanceDoubleFr: null,
  supplementJson: null,
  avisDistance: null,
  citationArticle: null,
  regime: 'FRANC',
  regimeIncertain: false,
  regimeFondement: 'C. pr. civ., art. 987 : tous les délais du Code sont francs.',
  prorogation991: 'OUI',
  prorogationFondement: 'C. pr. civ., art. 991 al. 3.',
  motifRefusFr: null,
  motifRefusEn: null,
  motifRefusHt: null,
  pointDepartFr: 'Date de réception de l’acte',
  pointDepartEn: '',
  pointDepartHt: '',
  sanctionFr: null,
  sanctionEn: null,
  sanctionHt: null,
}

const IDENTITE = { slug: 'apercu', codeLibelle: 'CPC', revision: 1 }

/** Les lignes de calendrier telles que le back-office les charge, montées depuis la v1. */
function feriesDeLaBase(): LigneFerieAdmin[] {
  return CALENDRIER_V1.map((e, i) => ({
    id: `f${i}`,
    versionCalendrier: 1,
    cle: e.cle,
    typeEntree: e.typeEntree,
    libelleFr: e.libelleFr,
    libelleEn: e.libelleEn,
    libelleHt: e.libelleHt,
    categorie: e.categorie,
    autorite: e.autorite,
    journee: e.journee,
    noteJourneeFr: e.noteJourneeFr ?? null,
    noteJourneeEn: e.noteJourneeEn ?? null,
    noteJourneeHt: e.noteJourneeHt ?? null,
    traductionRelue: e.traductionRelue,
    mobile: e.mobile,
    offsetPaques: e.offsetPaques ?? null,
    mois: e.mois ?? null,
    jour: e.jour ?? null,
    source: e.source,
    sourceDocId: e.sourceDocId ?? null,
    appliqueDepuis: e.appliqueDepuis,
    observationsN: e.observationsN ?? null,
    observationsTexteFr: e.observationsTexteFr ?? null,
    observationsBorneFr: e.observationsBorneFr ?? null,
    rechercheCorpusQ: e.rechercheCorpusQ ?? null,
  }))
}

describe('§ 7.1 — l’aperçu obligatoire du back-office', () => {
  it('calcule sur le calendrier LU EN BASE quand la conversion réussit', () => {
    const r = apercuDeLEntree(CHAMPS, feriesDeLaBase(), IDENTITE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.resultat.statut).toBe('CALCUL')
  })

  /**
   * ⚠️ **LE DÉFAUT 8.** Une seule ligne du calendrier illisible — ici un décalage pascal hors
   * des sept admis — et `versCalendrier` échoue. L'aperçu doit REFUSER, pas se rabattre sur le
   * calendrier du code.
   */
  it('DÉFAUT 8 — REFUSE de calculer quand le calendrier de la base est illisible', () => {
    const abimees = feriesDeLaBase()
    abimees[0] = { ...abimees[0], mobile: true, offsetPaques: 7 }
    const r = apercuDeLEntree(CHAMPS, abimees, IDENTITE)
    expect(r.ok, 'un aperçu a été calculé sur un calendrier qui n’est pas celui de la base').toBe(
      false,
    )
    if (r.ok) return
    // … et il DIT pourquoi : un aperçu muet est un aperçu qui ment.
    expect(r.motif).toContain(abimees[0].cle)
    expect(r.motif.trim().length).toBeGreaterThan(10)
  })

  /**
   * ⚠️ **LA SONDE QUI REND LE DÉFAUT VISIBLE**, et qui vaudra encore quand la base sera passée
   * en v2 : tant que la version du CODE et celle de la BASE peuvent différer, un repli sur
   * `entreesCalendrier: undefined` afficherait la date d'une autre règle. On vérifie que le
   * refus ne dépend pas de la coïncidence des deux nombres.
   */
  it('DÉFAUT 8 — le refus ne dépend pas de l’accord entre la version du code et celle de la base', () => {
    const enBase = feriesDeLaBase()
    expect(enBase[0].versionCalendrier).toBe(1)
    // Le code est passé en v2 ; la base est restée en v1. C'est exactement la situation
    // ouverte tant que `scripts/migrer-calendrier-v2.ts --apply` n'a pas été lancé.
    expect(VERSION_CALENDRIER_COURANTE).toBeGreaterThanOrEqual(1)
    const bon = apercuDeLEntree(CHAMPS, enBase, IDENTITE)
    expect(bon.ok).toBe(true)
    // … et si la base devient illisible, aucune version ne sert de repli.
    const r = apercuDeLEntree(CHAMPS, [{ ...enBase[0], source: '   ' }, ...enBase.slice(1)], IDENTITE)
    expect(r.ok).toBe(false)
  })

  /** L'entrée elle-même reste contrôlée : une conversion qui échoue refuse aussi, et dit pourquoi. */
  it('refuse également quand l’ENTRÉE ne se convertit pas, et le motive', () => {
    const r = apercuDeLEntree({ ...CHAMPS, kind: 'SEMAINES' }, feriesDeLaBase(), IDENTITE)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motif.trim().length).toBeGreaterThan(10)
  })
})
