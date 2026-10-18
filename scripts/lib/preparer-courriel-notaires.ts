/**
 * Préparation (JAMAIS l'envoi) du courriel « Agora — Vérifiez les informations de votre étude
 * notariale » — fonctions PURES, testées dans preparer-courriel-notaires.test.ts.
 *
 * Chaque destinataire reçoit `{{lien_fiche_notaire}}` : l'annuaire avec SA fiche ouverte, construit
 * à partir de l'IDENTIFIANT EN BASE (`lienFicheNotaire`) — jamais un annuaire générique, aucune donnée
 * privée, aucun droit de modification. Le rapprochement destinataire ↔ fiche réutilise les règles de
 * l'import (`rapprocher`) : seul un rapprochement EXACT et UNIQUE est admis.
 *
 * LA PRÉPARATION EST BLOQUÉE dès qu'UNE ligne l'est (rapprochement ambigu ou incertain, identifiant
 * inconnu, nom qui ne correspond pas à l'identifiant donné, courriel illisible ou en double, lien
 * impossible) : rien n'est produit pour l'envoi tant que la liste n'est pas entièrement sûre.
 */
import { EMAIL_RE } from '../../src/lib/jurisdictions/coordonnees'
import { ID_NOTAIRE_RE, lienFicheNotaire } from '../../src/lib/jurisdictions/fiche-notaire'
import { rapprocher, type NotaireRef } from './import-notaires-docx'

export interface Destinataire {
  /** Ligne du fichier (1 = première ligne de données), pour le rapport. */
  ligne: number
  courriel: string
  /** Nom tel que la liste des destinataires l'écrit. */
  nom: string
  /** Identifiant de l'inscription, quand la liste le donne (il prévaut, mais le nom doit y correspondre). */
  notaryId?: string | null
}
export interface Pret { courriel: string; nom: string; notaryId: string; lien_fiche_notaire: string }
export interface Bloque { ligne: number; courriel: string; nom: string; motif: string }

export function preparerEnvoi(
  destinataires: readonly Destinataire[],
  notaires: readonly NotaireRef[],
  opts: { origine?: string; locale?: string } = {},
): { prets: Pret[]; bloques: Bloque[] } {
  const prets: Pret[] = []
  const bloques: Bloque[] = []
  const vus = new Set<string>()
  const parId = new Map(notaires.map((n) => [n.id, n]))
  for (const d of destinataires) {
    const courriel = d.courriel.trim()
    const nom = d.nom.trim()
    const bloquer = (motif: string) => bloques.push({ ligne: d.ligne, courriel, nom, motif })
    if (!EMAIL_RE.test(courriel)) { bloquer('courriel du destinataire illisible'); continue }
    if (vus.has(courriel.toLowerCase())) { bloquer('courriel en double dans la liste'); continue }
    vus.add(courriel.toLowerCase())

    let notaryId: string | null = null
    const id = d.notaryId?.trim() || null
    if (id) {
      const n = parId.get(id)
      if (!ID_NOTAIRE_RE.test(id) || !n || !n.active) { bloquer(`identifiant « ${id} » inconnu ou retiré de la liste`); continue }
      // L'identifiant ne suffit pas : le nom de la liste doit désigner CETTE inscription.
      if (nom && rapprocher(nom, [n]).niveau !== 'EXACT') { bloquer(`le nom « ${nom} » ne correspond pas à la fiche « ${n.displayName ?? n.fullName} » (${id})`); continue }
      notaryId = id
    } else {
      if (!nom) { bloquer('ni nom ni identifiant : rapprochement impossible'); continue }
      const r = rapprocher(nom, notaires)
      if (r.niveau === 'MULTIPLE') { bloquer(`rapprochement AMBIGU : ${r.candidats.length} inscriptions portent ce nom (${r.candidats.map((c) => `${c.id}, ${c.commune ?? '?'}`).join(' ; ')}) — désigner l'identifiant`); continue }
      if (r.niveau !== 'EXACT' || !r.notaryId) {
        const c = r.candidats[0]
        bloquer(`rapprochement ${r.niveau.toLowerCase()}${c ? ` (candidat : ${c.nom}, ${c.id})` : ''} — à trancher avant tout envoi`)
        continue
      }
      notaryId = r.notaryId
    }
    let lien: string
    try { lien = lienFicheNotaire(notaryId, opts) } catch (e) { bloquer(`lien impossible : ${(e as Error).message}`); continue }
    const n = parId.get(notaryId)!
    prets.push({ courriel, nom: n.displayName ?? n.fullName, notaryId, lien_fiche_notaire: lien })
  }
  return { prets, bloques }
}

/**
 * Le modèle doit porter les variables de personnalisation, et le bouton « Consulter mes
 * informations » pointer vers `{{lien_fiche_notaire}}` — jamais vers un lien en dur.
 */
export function verifierModele(html: string): string[] {
  const manques: string[] = []
  if (!html.includes('{{lien_fiche_notaire}}')) manques.push('variable {{lien_fiche_notaire}} absente')
  if (!html.includes('{{nom}}')) manques.push('variable {{nom}} absente')
  const bouton = /<a\b[^>]*href="([^"]*)"[^>]*>\s*Consulter mes informations/i.exec(html)
  if (!bouton) manques.push('bouton « Consulter mes informations » introuvable')
  else if (bouton[1] !== '{{lien_fiche_notaire}}') manques.push(`le bouton « Consulter mes informations » pointe vers « ${bouton[1]} » au lieu de {{lien_fiche_notaire}}`)
  return manques
}

/** Lecture tolérante d'un CSV (`,` ou `;`, guillemets doubles) ; en-tête : courriel, nom, notaryId. */
export function lireCsvDestinataires(texte: string): Destinataire[] {
  const lignes = texte.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  if (!lignes.length) return []
  const sep = (lignes[0].match(/;/g)?.length ?? 0) > (lignes[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const champs = (l: string) => {
    const out: string[] = []
    let cur = ''
    let guil = false
    for (let i = 0; i < l.length; i++) {
      const ch = l[i]
      if (guil) {
        if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') guil = false
        else cur += ch
      } else if (ch === '"') guil = true
      else if (ch === sep) { out.push(cur); cur = '' } else cur += ch
    }
    out.push(cur)
    return out.map((x) => x.trim())
  }
  const tete = champs(lignes[0]).map((h) => h.toLowerCase())
  const col = (...noms: string[]) => tete.findIndex((h) => noms.includes(h))
  const iC = col('courriel', 'email', 'e-mail')
  const iN = col('nom', 'name')
  const iId = col('notaryid', 'identifiant', 'id')
  if (iC < 0) throw new Error('colonne « courriel » absente de l’en-tête')
  return lignes.slice(1).map((l, k) => {
    const f = champs(l)
    return { ligne: k + 1, courriel: f[iC] ?? '', nom: iN >= 0 ? f[iN] ?? '' : '', notaryId: iId >= 0 ? f[iId] || null : null }
  })
}
