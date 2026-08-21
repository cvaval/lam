/**
 * § 7.3 — LA SIGNATURE DU PERMALIEN. **Le seul moyen de distinguer un permalien AUTHENTIQUE
 * d'un permalien FABRIQUÉ.**
 *
 * Le problème, tel qu'il se posait. Une entrée masquée ou supprimée restait calculable sur
 * une date NEUVE : il suffisait d'ajouter `r=`. Le refus s'écrivait
 * `if (statut !== 'visible' && q.r == null)`, or `r` est un petit entier (1, 2, 3…) que tout
 * permalien porte déjà et que n'importe qui devine, tandis que `d` reste entièrement libre.
 * `?e=<slug-retiré>&r=1&d=<n'importe quelle date>` rendait donc un résultat complet sous une
 * règle que la rédaction avait retirée du répertoire — la voie fabriquée passait, pendant que
 * la voie honnête (un permalien sans `r`) était refusée en 410.
 *
 * La règle, désormais :
 *
 *  - **tout permalien émis est signé** (`sig`), qu'il porte sur une entrée visible ou non ;
 *  - une entrée **visible** se calcule librement, signature ou pas : l'URL reste modifiable
 *    à la main, partageable, et le calculateur la propose au menu ;
 *  - une entrée **retirée** (masquée ou supprimée) n'est rendue **que sur signature valide**.
 *    Le permalien copié avant le retrait la porte : il continue de rendre le calcul tel qu'il
 *    a été rendu, avec son bandeau (§ 7.3). Une URL forgée ne la porte pas : 410.
 *
 * **La reproductibilité à dix ans tient tant que le secret tient.** C'est la contrepartie
 * assumée : le secret est une donnée d'exploitation, au même titre que la base.
 *
 * ⚠️ **Aucun secret en dur en production.** Le dépôt exige déjà `TRUSTED_DEVICE_SECRET` en
 * production (`src/lib/auth/crypto.ts` lève au démarrage sans lui) : on s'aligne sur cette
 * convention, avec un secret de développement explicite hors production pour que les tests et
 * le poste local fonctionnent sans configuration.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Le secret. `DELAIS_PERMALINK_SECRET` est le nom propre ; à défaut, on dérive du secret de
 * signature des appareils de confiance — **avec une étiquette de domaine**, pour qu'aucune
 * signature de l'un ne vaille jamais pour l'autre.
 */
const ETIQUETTE = 'lam:delais:permalien:v1'

const BRUT = process.env.DELAIS_PERMALINK_SECRET?.trim() || process.env.TRUSTED_DEVICE_SECRET?.trim()

if (process.env.NODE_ENV === 'production' && !BRUT) {
  throw new Error(
    'DELAIS_PERMALINK_SECRET (ou TRUSTED_DEVICE_SECRET) manquant en production : sans lui, ' +
      'aucun permalien du calculateur de délais ne peut être authentifié (§ 7.3).',
  )
}

const SECRET = `${ETIQUETTE}|${BRUT ?? 'dev-delais-permalien-secret'}`

/** 96 bits en base64url : assez court pour tenir dans une URL, assez long pour ne pas se forger. */
const LONGUEUR = 16

/**
 * La signature de la requête canonique — `d|e|r|c|w|km|sup|n|f|src`, exactement la chaîne que
 * `queryPermalien` produit, **sans `sig`**. Signer la query entière fait que changer un seul
 * paramètre invalide la signature : c'est le point.
 */
export function signerQuery(query: string): string {
  return createHmac('sha256', SECRET).update(query).digest('base64url').slice(0, LONGUEUR)
}

/** Comparaison à temps constant. Une signature absente ou mal formée est simplement fausse. */
export function signatureValide(query: string, fournie: string | null | undefined): boolean {
  if (!fournie) return false
  const a = Buffer.from(signerQuery(query))
  const b = Buffer.from(fournie)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
