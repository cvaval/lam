/**
 * AUDIT DES LIENS de la plateforme publique — exploration récursive.
 *
 *   node scripts/audit-liens.mjs [origine]        (défaut : http://localhost:3100)
 *
 * Part des trois racines de langue, suit tout lien interne, et contrôle :
 *  - le code de réponse de chaque URL distincte ;
 *  - l'existence de l'ANCRE ciblée (`#id`) dans la page d'arrivée — un `#s9` qui ne
 *    correspond à rien ne casse rien visiblement, mais dépose le lecteur au mauvais
 *    endroit, ce qu'aucun code 200 ne révèle ;
 *  - les liens externes et les `mailto:`, listés sans être suivis.
 *
 * ⚠️ LECTURE SEULE, ET AUCUNE ROUTE D'AUTHENTIFICATION EN POST. La base est celle de
 * PRODUCTION : un POST sur /api/auth/login incrémenterait les compteurs d'échec de
 * comptes réels et finirait par les verrouiller.
 */
const ORIGINE = process.argv[2] ?? 'http://localhost:3100'
const RACINES = ['/fr', '/en', '/ht']
/** Jamais explorées : coûteuses, protégées, ou hors du périmètre public. */
const EXCLUS = /^\/(api|_next|maps|brand|favicon|icon-|apple-|site\.webmanifest)/

/**
 * ⚠️ NORMALISATION DES VARIANTES. La carte judiciaire lie 149 communes ; avec les trois
 * langues et les combinaisons de couches, l'exploration naïve dépassait 450 URL — chacune
 * interrogeant la base de PRODUCTION, et toutes en file d'attente derrière un pool d'UNE
 * connexion. Ce n'était plus un audit de liens mais un test de charge involontaire.
 *
 * On garde donc un ÉCHANTILLON par forme d'URL : la 1re, la 2e et la dernière valeur de
 * chaque paramètre. Un lien cassé dans cette famille l'est pour toutes — elles sortent
 * du même gabarit.
 */
const ECHANTILLON = 3
const vusParForme = new Map()
function retenir(u) {
  const [chemin, requete] = u.split('?')
  if (!requete) return true
  const forme = chemin + '?' + [...new URLSearchParams(requete).keys()].sort().join(',')
  const n = (vusParForme.get(forme) ?? 0) + 1
  vusParForme.set(forme, n)
  return n <= ECHANTILLON
}

const vues = new Map() // url → { statut, ancres:Set }
const aVoir = [...RACINES]
const liens = [] // { depuis, vers, ancre }
const externes = new Set()
const courriels = new Set()

const ancresDe = (html) => {
  const s = new Set()
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) s.add(m[1])
  for (const m of html.matchAll(/\sname="([^"]+)"/g)) s.add(m[1])
  return s
}

async function explorer(chemin) {
  if (vues.has(chemin)) return
  const t0 = performance.now()
  let res, html = ''
  try {
    res = await fetch(ORIGINE + chemin, { redirect: 'manual' })
    if (res.status === 200) html = await res.text()
  } catch (e) {
    vues.set(chemin, { statut: 'ERR ' + e.message.slice(0, 40), ancres: new Set(), ms: 0 })
    return
  }
  vues.set(chemin, { statut: res.status, ancres: ancresDe(html), ms: Math.round(performance.now() - t0) })
  if (res.status !== 200) return

  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const brut = m[1]
    if (brut.startsWith('mailto:')) { courriels.add(brut); continue }
    if (/^https?:\/\//.test(brut)) {
      if (!brut.startsWith(ORIGINE)) { externes.add(brut); continue }
    }
    const u = brut.startsWith(ORIGINE) ? brut.slice(ORIGINE.length) : brut
    if (!u.startsWith('/')) continue
    const [sansAncre, ancre] = u.split('#')
    const cible = sansAncre === '' ? chemin : sansAncre
    liens.push({ depuis: chemin, vers: cible, ancre: ancre || null })
    if (!EXCLUS.test(cible) && !vues.has(cible) && !aVoir.includes(cible) && retenir(cible)) aVoir.push(cible)
  }
}

while (aVoir.length) {
  // Par lots : l'exploration séquentielle sur ~150 URL prendrait des minutes.
  const lot = aVoir.splice(0, 3)
  await Promise.all(lot.map(explorer))
}

// ── Rapport ────────────────────────────────────────────────────────────────
const morts = []
const ancresMortes = []
for (const l of liens) {
  if (EXCLUS.test(l.vers)) continue
  const cible = vues.get(l.vers)
  if (!cible) continue
  if (cible.statut !== 200 && !(cible.statut >= 300 && cible.statut < 400)) {
    morts.push(`${l.vers}  (${cible.statut})  ← ${l.depuis}`)
  } else if (l.ancre && cible.statut === 200 && !cible.ancres.has(l.ancre)) {
    ancresMortes.push(`${l.vers}#${l.ancre}  ← ${l.depuis}`)
  }
}

const pages = [...vues.entries()].sort((a, b) => b[1].ms - a[1].ms)
console.log(`URL explorées : ${vues.size} · liens suivis : ${liens.length} · formes échantillonnées : ${vusParForme.size}`)
console.log(`\nRéponses :`)
const parStatut = {}
for (const [, v] of vues) parStatut[v.statut] = (parStatut[v.statut] ?? 0) + 1
for (const [k, v] of Object.entries(parStatut).sort()) console.log(`  ${k} : ${v}`)

console.log(`\nLIENS MORTS : ${new Set(morts).size}`)
for (const m of [...new Set(morts)].slice(0, 20)) console.log('  ✗ ' + m)
console.log(`ANCRES MORTES : ${new Set(ancresMortes).size}`)
for (const a of [...new Set(ancresMortes)].slice(0, 20)) console.log('  ✗ ' + a)

console.log(`\n10 pages les plus lentes (1er appel, à froid) :`)
for (const [u, v] of pages.slice(0, 10)) console.log(`  ${String(v.ms).padStart(6)} ms  ${v.statut}  ${u}`)

console.log(`\nExternes (${externes.size}) : ${[...externes].join(' · ') || '—'}`)
console.log(`Courriels (${courriels.size}) : ${[...courriels].join(' · ') || '—'}`)
