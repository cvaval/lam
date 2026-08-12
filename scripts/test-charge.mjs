/**
 * TEST DE CHARGE — montée progressive en utilisateurs simultanés.
 *
 *   node scripts/test-charge.mjs [origine] [duréeParPalierSec]
 *
 * ⚠️ LECTURE SEULE, GET UNIQUEMENT, ET AUCUNE ROUTE D'AUTHENTIFICATION. Un POST sur
 * /api/auth/login incrémenterait les compteurs d'échec de comptes RÉELS et finirait par
 * les verrouiller ; /api/auth/verify est protégé par un frein par IP qui bannirait la
 * machine de test. Le mélange ci-dessous reproduit une navigation ordinaire.
 *
 * ⚠️ CE QU'UNE MESURE LOCALE NE DIT PAS. En local, `next start` est UN processus avec un
 * pool d'UNE connexion (`connection_limit=1`) : au-delà d'un utilisateur, on ne mesure
 * plus que la file d'attente. Seule une mesure contre la production — où Vercel répartit
 * sur plusieurs instances, chacune avec sa connexion — a un sens.
 *
 * Bornes volontaires : paliers courts et plafond de requêtes, pour caractériser sans
 * dégrader un site qui sert de vrais visiteurs.
 */
const ORIGINE = process.argv[2] ?? 'https://lam.ht'
const DUREE = Number(process.argv[3] ?? 8) * 1000
const PALIERS = [1, 5, 10, 20, 40]
const PLAFOND = 4000 // garde-fou absolu, tous paliers confondus

/** Navigation type : deux tiers de pages légères, un tiers de carte (la plus coûteuse). */
const PARCOURS = [
  '/fr', '/en', '/fr/publications', '/fr/publications/egouvernance', '/fr/cgu',
  '/fr/login', '/ht', '/fr/mentions-legales',
  '/fr/juridictions', '/fr/juridictions?commune=commune-ouest-port-au-prince',
  '/api/public/jurisdictions/map-points',
]

const pct = (t, p) => { const s = t.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))] }
let envoyees = 0

async function utilisateur(finAt, latences, erreurs, statuts) {
  let i = Math.floor(Math.random() * PARCOURS.length)
  while (Date.now() < finAt && envoyees < PLAFOND) {
    const url = PARCOURS[i++ % PARCOURS.length]
    envoyees++
    const t0 = performance.now()
    try {
      const r = await fetch(ORIGINE + url, { redirect: 'manual' })
      await r.arrayBuffer()
      latences.push(performance.now() - t0)
      statuts[r.status] = (statuts[r.status] ?? 0) + 1
    } catch (e) {
      erreurs.push(String(e.message).slice(0, 50))
    }
  }
}

console.log(`Cible : ${ORIGINE}   ·   paliers de ${DUREE / 1000} s   ·   GET seulement\n`)
console.log('  simultanés   requêtes   débit/s    médiane      p95        max     erreurs  statuts')
for (const n of PALIERS) {
  if (envoyees >= PLAFOND) { console.log('  (plafond de requêtes atteint — arrêt)'); break }
  const latences = [], erreurs = [], statuts = {}
  const t0 = Date.now()
  const fin = t0 + DUREE
  await Promise.all(Array.from({ length: n }, () => utilisateur(fin, latences, erreurs, statuts)))
  const sec = (Date.now() - t0) / 1000
  const codes = Object.entries(statuts).map(([k, v]) => `${k}:${v}`).join(' ')
  console.log(
    `  ${String(n).padStart(8)}   ${String(latences.length).padStart(8)}   ${(latences.length / sec).toFixed(1).padStart(7)}   ` +
    `${(Math.round(pct(latences, 0.5)) + ' ms').padStart(8)}  ${(Math.round(pct(latences, 0.95)) + ' ms').padStart(8)}  ` +
    `${(Math.round(Math.max(...latences)) + ' ms').padStart(8)}   ${String(erreurs.length).padStart(6)}  ${codes}`,
  )
  if (erreurs.length) console.log(`      erreurs : ${[...new Set(erreurs)].slice(0, 3).join(' · ')}`)
  // Respiration entre paliers : on mesure un régime, pas une rafale ininterrompue.
  await new Promise((r) => setTimeout(r, 1500))
}
console.log(`\n  Total envoyé : ${envoyees} requêtes (plafond ${PLAFOND}).`)
