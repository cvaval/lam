/**
 * Code civil — remise en ordre du dispositif, de l'appareil et des textes connexes.
 *
 * Le recueil imprime, à la suite de certains articles, des renvois éditoriaux (« V. le D.
 * du 8 octobre 1982 ») et des textes connexes reproduits en clair (intitulé, référence au
 * Moniteur, parfois plusieurs alinéas). L'océrisation les a versés dans le CORPS, où ils se
 * lisent comme des alinéas du Code. Symétriquement, l'énumération de certains articles
 * (« La qualité de citoyen se perd: 1. … 2. … ») a été rangée en JURISPRUDENCE.
 *
 * Cinq gestes, et rien d'autre :
 *
 *  A. REPLIS — dans un article, à partir de la première ligne éditoriale, tout va au
 *     pliable « Textes connexes ». Règle vérifiée sur la totalité du Code : 85 articles
 *     portent une telle insertion, et 3 seulement ont une suite après elle — les trois
 *     fois, la suite du texte annexé (arts 57, 151, 781). Le dispositif ne reprend jamais
 *     après une insertion. Les lignes déjà présentes dans le pliable ne sont pas
 *     dupliquées : elles sont simplement retirées du corps.
 *  B. ITEMS — les « notes » qui sont en réalité les items d'une énumération annoncée par
 *     l'article retournent au corps, dans l'ordre, sous leur chapeau.
 *  C. SUPPRESSIONS — les gloses écartées par la cliente.
 *  D. OCR — « Art. |. » pour « Art. 1. » (la barre est un 1 mal lu).
 *  E. RECOMPOSITIONS — deux blocs connexes malformés (arts 95 et 740).
 *
 * Invariants vérifiés AVANT toute écriture, sinon le script refuse d'écrire :
 *   · rien ne disparaît : toute ligne retirée du corps se retrouve dans le pliable de SON
 *     article, à la tolérance près des variantes d'OCR (« art. 1er » ≡ « art. 1 ») ;
 *   · aucune ligne retirée n'est un en-tête du sommaire ;
 *   · les clés d'annotation d'AVANT existent toujours APRÈS (aucune orpheline) ;
 *   · aucun article touché n'est sous overlay d'amendement (sinon le lecteur affiche la
 *     version en vigueur et la correction serait invisible) ;
 *   · les ancres visées dans un autre document (Constitution) existent réellement ;
 *   · l'appareil ANNEXÉ du Code (lois reproduites en fin d'ouvrage) n'est pas touché.
 *
 *     npx tsx scripts/corriger-articles-code-civil.ts
 *     npx tsx scripts/corriger-articles-code-civil.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { parseAnnotations, segmentAnnotated, type ConnexeBlock } from '../src/lib/legislation/annotated'
import { getAmendments } from '../src/lib/legislation/amendments'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
/** `--voir=18,38,781` : affiche l'article tel qu'il SERA rendu (corps + pliable). */
const VOIR = (process.argv.find((a) => a.startsWith('--voir='))?.slice(7) ?? '')
  .split(',').map(Number).filter(Boolean)

/** Ligne qui OUVRE une insertion éditoriale — et, dans le pliable, un nouveau bloc. */
const EDITORIALE = /^(?:V\.\s*|Voir\s|Décret\b|Décret-loi\b|Loi\b|Arrêté\b|Constitution\b|Ainsi modifié)/
/** Marqueurs d'une note de JURISPRUDENCE — un article qui en porte n'est pas une énumération. */
const MARQUE_JURIS = /Cass\.|Bull\.|arrêt|D\.\s?P\.|Trib\.|pourvoi|jugement attaqué/i

/**
 * Articles dont les notes sont, à coup sûr, les items du dispositif (liste cliente). Ils
 * sont traités même si la détection automatique ne les propose pas, et le script échoue
 * s'il n'y parvient pas. La valeur est le début de la ligne qui annonce la liste ;
 * `null` = détection automatique du chapeau.
 */
const ITEMS_EXPLICITES: Record<number, string | null> = {
  18: null, 25: null, 75: null, 212: null, 326: null, 639: null, 661: null, 738: 'Sont exceptées',
}

/**
 * Variantes d'un même mot entre le corps et le pliable, constatées SUR PIÈCE. L'invariant
 * de conservation les accepte ; toute autre différence l'arrête.
 *   · art. 151 : le corps écrit « … et autres pièces y relatif », le pliable « y relatives »
 *     (les deux alinéas y sont autrement identiques, mot pour mot).
 */
const VARIANTES = new Map([['relatif', 'relative']])

/** Lignes SUPPRIMÉES (ni corps ni pliable) — décision éditoriale de la cliente. */
const SUPPRESSIONS: Record<number, string[]> = {
  221: ["Suivant l'art. 174 de la Constitution de 1987, l'expression"],
}

/**
 * Bloc connexe de l'art. 95 : son contenu recopiait la jurisprudence de l'article (les deux
 * mêmes notes y figurent). L'intitulé portait à lui seul tout le décret : on le scinde en
 * intitulé + disposition, et la jurisprudence sort du pliable.
 */
const RECOMPOSER_95 = {
  label: 'Décret du 8 octobre 1982, art. 5.',
  text: 'Les époux choisissent de concert la résidence de la famille. Cependant le domicile conjugal demeure celui du mari.',
}

/**
 * Bloc connexe de l'art. 740 : l'intitulé avait avalé l'ARTICLE 1er de la loi (le contenu
 * commence à l'article 2). On lui rend son article 1er et on recoud le mot coupé par l'OCR
 * (« condi- tions »). « Art. l* » y encode le « 1er » en exposant.
 */
const RECOMPOSER_740 = {
  label:
    "Loi du 16 juin 1975 accordant le droit de propriété immobilière aux étrangers et fixant les conditions nouvelles de l'exercice de ce droit (Le Moniteur, No. 50 du 7 juillet 1975)",
  article1:
    "Art. 1er. Aucun étranger ne peut acquérir de propriété immobilière en Haïti, s'il n'a sa résidence dans l'une des Communes de la République et si ce n'est pour les besoins de sa demeure ou de ses entreprises agricoles, commerciales, industrielles ou d'enseignement.",
}

// ── outils ────────────────────────────────────────────────────────────────────
const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim().toLowerCase()
/** Empreinte pour comparer deux contenus : ponctuation neutralisée et mots recousus —
 *  l'OCR coupe (« condi- tions nouvelles ») là où le corps écrit le mot entier. */
const mots = (s: string) =>
  norm(s).replace(/(\p{L})-\s+(\p{L})/gu, '$1$2').replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim()

/** Mots PLEINS d'un contenu : au moins 4 lettres, pluriel neutralisé. Les mots-outils
 *  (« de la le des et en ») sont écartés — ce sont eux qui rendent deux textes français
 *  quelconques superficiellement semblables. */
function pleins(s: string): string[] {
  return mots(s)
    .split(' ')
    .filter((w) => w.length >= 4)
    .map((w) => w.replace(/s$/, ''))
}

/**
 * Ce contenu est-il DÉJÀ dans le pliable ?
 *
 * Trois mesures ont été essayées, et les deux premières se sont trompées sur des cas réels :
 *   · l'égalité littérale ratait « art. 1er » ≡ « art. 1 », « déclaration(s) », « y relatif »
 *     ≡ « y relatives », « ll devra » ≡ « Il devra » — autant de variantes de l'OCR ou du
 *     recueil pour un texte identique ;
 *   · l'alignement de TOUS les mots déclarait présents deux alinéas absents (art. 151) :
 *     les mots-outils français (« de la le des en ») suffisaient à franchir le seuil.
 *
 * On aligne donc les seuls MOTS PLEINS, dans l'ordre : deux textes ne s'alignent à 85 %
 * sur leur vocabulaire propre que s'ils disent la même chose.
 */
function dejaPresent(contenu: string, blob: string): boolean {
  if (mots(contenu).length > 10 && mots(blob).includes(mots(contenu))) return true
  const a = pleins(contenu)
  const b = pleins(blob)
  if (a.length < 2 || !b.length) return false
  const dp = new Array(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    let diag = 0
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? diag + 1 : Math.max(dp[j], dp[j - 1])
      diag = tmp
    }
  }
  return dp[b.length] / a.length >= 0.85
}

/** Groupe de lignes repliées → bloc { intitulé, contenu }, avec lien sortant si possible. */
function enBloc(groupe: string[], constitutionId: string | null, ancresConst: Set<string>): ConnexeBlock {
  const tete = groupe[0].trim()
  const suite = groupe.slice(1).map((l) => l.trim()).join('\n')
  // « Décret du 8 octobre 1982, art. 16. La majorité est fixée à 18 ans. » → intitulé + disposition.
  const m = /^((?:Décret|Décret-loi|Loi|Arrêté|Constitution)[^.]{0,120}?,\s*[Aa]rt\.?\s*\d+(?:er)?\s*\.)\s*(.+)$/u.exec(tete)
  const bloc: ConnexeBlock = m
    ? { label: m[1].trim(), text: [m[2].trim(), suite].filter(Boolean).join('\n') }
    : /^(?:V\.|Voir|Ainsi modifié)/.test(tete)
      ? { label: '', text: [tete, suite].filter(Boolean).join('\n') } // renvoi nu : la ligne EST le bloc
      : { label: tete, text: suite } // intitulé de texte connexe
  // Renvoi à la Constitution → l'intitulé devient un lien vers le texte en ligne. La formule
  // du recueil est conservée telle quelle ; elle devient simplement cliquable.
  if (constitutionId && /Constitution de 1987/.test(tete)) {
    const n = /art\.?\s*(\d+)/i.exec(tete)?.[1]
    if (!bloc.label) { bloc.label = tete; bloc.text = suite }
    bloc.docId = constitutionId
    if (n && ancresConst.has(`art-${n}`)) bloc.anchor = `art-${n}`
  }
  return bloc
}

async function main() {
  const doc = await prisma.document.findFirst({
    where: { source: 'CODE_CIVIL_ANNOTE' },
    select: { id: true, bodyOriginal: true, annotationsJson: true, richBlocksJson: true },
  })
  if (!doc) throw new Error('Code civil introuvable.')
  if (doc.richBlocksJson && doc.richBlocksJson !== '[]')
    throw new Error('richBlocksJson non vide : les blocs riches sont indexés sur le corps, à traiter avant.')

  const ann = parseAnnotations(doc.annotationsJson)!
  const brut = JSON.parse(doc.annotationsJson!) as {
    toc: Array<{ anchor: string; label: string; level: number; kind: string }>
    jurisprudence: Record<string, Array<{ ref?: string; excerpt?: string }>>
    connexe: Record<string, ConnexeBlock[]>
  }
  const titresToc = new Set(brut.toc.map((t) => norm(t.label)))

  // ── cible des renvois à la Constitution ──────────────────────────────────────
  const constitution = await prisma.document.findFirst({
    where: { source: 'CONSTITUTION_1987' },
    select: { id: true, bodyOriginal: true, annotationsJson: true },
  })
  const ancresConst = new Set<string>()
  if (constitution) {
    const ac = parseAnnotations(constitution.annotationsJson)
    for (const b of segmentAnnotated(constitution.bodyOriginal, ac?.toc ?? []))
      if (b.kind === 'body' && b.anchor) ancresConst.add(b.anchor)
  }
  console.log(`Constitution : ${constitution ? `${ancresConst.size} articles ancrés` : 'ABSENTE — aucun lien sortant'}`)

  // ── le corps, article par article (l'appareil ANNEXÉ est exclu) ──────────────
  const lignes = doc.bodyOriginal.split('\n')
  const clesAvant = new Map<string, string>()
  const duCode = new Set<string>()
  for (const b of segmentAnnotated(doc.bodyOriginal, ann.toc)) {
    if (b.kind !== 'body' || !b.anchor) continue
    if (b.jurisKey) clesAvant.set(b.anchor, b.jurisKey)
    if (!b.noAnchors) duCode.add(b.anchor)
  }
  const teteDe = new Map<string, number>()
  for (let i = 0; i < lignes.length; i++) {
    const a = articleAnchorFromHeading(lignes[i])
    if (a && !teteDe.has(a)) teteDe.set(a, i)
  }
  /** Intervalle [début, fin[ des lignes d'un article. */
  function bornes(n: number): [number, number] {
    const d = teteDe.get(`art-${n}`)
    if (d === undefined) throw new Error(`article ${n} introuvable dans le corps`)
    let f = d + 1
    while (f < lignes.length && !articleAnchorFromHeading(lignes[f]) && !titresToc.has(norm(lignes[f]))) f++
    return [d, f]
  }

  const aSupprimer = new Set<number>()
  const artDeLigne = new Map<number, number>()
  const aInserer = new Map<number, string[]>()
  const journal: string[] = []
  const connexe: Record<string, ConnexeBlock[]> = JSON.parse(JSON.stringify(brut.connexe))
  const blobDe = (n: number) => (connexe[`art-${n}`] ?? []).map((c) => `${c.label} ${c.text}`).join(' ')
  let doublons = 0, crees = 0, completes = 0, ocr = 0, liens = 0

  const numeros = [...duCode]
    .map((a) => Number(/^art-(\d+)$/.exec(a)?.[1] ?? 0))
    .filter((n) => n > 0)
    .sort((a, b) => a - b)

  // ── A. replis ───────────────────────────────────────────────────────────────
  for (const n of numeros) {
    const [d, f] = bornes(n)
    let debut = -1
    for (let i = d + 1; i < f; i++)
      if (EDITORIALE.test(lignes[i].trim())) { debut = i; break }
    if (debut < 0) continue
    // regroupement : une nouvelle entrée du pliable à chaque intitulé ou renvoi ; les
    // lignes qui suivent (référence au Moniteur, alinéas de la loi) le prolongent.
    const groupes: string[][] = []
    for (let i = debut; i < f; i++) {
      const l = lignes[i].trim()
      if (!l) continue
      if (titresToc.has(norm(l))) throw new Error(`art ${n} : « ${l.slice(0, 50)} » est un en-tête du sommaire`)
      if (EDITORIALE.test(l) || !groupes.length) groupes.push([l])
      else groupes[groupes.length - 1].push(l)
      aSupprimer.add(i)
      artDeLigne.set(i, n)
    }
    for (const g of groupes) {
      if (g.every((l) => dejaPresent(l, blobDe(n)))) {
        doublons++
        journal.push(`art ${n} : doublon retiré du corps — « ${g[0].slice(0, 55)}… »`)
        continue
      }
      // l'intitulé est déjà là mais pas sa suite : on complète le bloc existant
      const existant = g.length > 1
        ? (connexe[`art-${n}`] ?? []).find((c) => dejaPresent(g[0], `${c.label} ${c.text}`))
        : undefined
      if (existant) {
        const manquantes = g.slice(1).filter((l) => !dejaPresent(l, `${existant.label} ${existant.text}`))
        if (!manquantes.length) {
          doublons++
          journal.push(`art ${n} : doublon retiré du corps — « ${g[0].slice(0, 55)}… »`)
          continue
        }
        existant.text = [existant.text, ...manquantes].filter(Boolean).join('\n')
        completes++
        journal.push(`art ${n} : ${manquantes.length} alinéa(s) rendus au texte connexe « ${g[0].slice(0, 45)}… »`)
        continue
      }
      const bloc = enBloc(g, constitution?.id ?? null, ancresConst)
      ;(connexe[`art-${n}`] ??= []).push(bloc)
      crees++
      if (bloc.docId) liens++
      journal.push(`art ${n} : replié — « ${g[0].slice(0, 55)}… »${bloc.docId ? ' → Constitution' : ''}`)
    }
  }

  // ── B. items d'énumération rendus au dispositif ─────────────────────────────
  const itemsFaits: number[] = []
  for (const n of numeros) {
    const cle = clesAvant.get(`art-${n}`)
    const notes = cle ? brut.jurisprudence[cle] ?? [] : []
    if (!notes.length) continue
    const explicite = n in ITEMS_EXPLICITES
    const tousItems = notes.every((j) => /^\s*(?:\d{1,2}\.|[a-z]\))\s/u.test(j.excerpt ?? ''))
    if (!tousItems) {
      if (explicite) throw new Error(`art ${n} : annoncé comme énumération, mais une note n'est pas un item`)
      continue
    }
    if (!explicite && notes.some((j) => MARQUE_JURIS.test(`${j.excerpt ?? ''} ${j.ref ?? ''}`))) continue
    // chapeau : la ligne (restée au corps) qui annonce la liste — il doit y en avoir UNE
    const [d, f] = bornes(n)
    const pref = ITEMS_EXPLICITES[n]
    const cands: number[] = []
    for (let i = d; i < f; i++) {
      if (aSupprimer.has(i)) continue
      const l = lignes[i].trim()
      if (!l) continue
      if (pref ? norm(l).startsWith(norm(pref)) : /[:,;]$/.test(l)) cands.push(i)
    }
    if (cands.length !== 1) {
      if (explicite) throw new Error(`art ${n} : ${cands.length} chapeaux candidats — ambigu`)
      continue
    }
    aInserer.set(cands[0], notes.map((j) => (j.excerpt ?? '').trim()))
    itemsFaits.push(n)
    journal.push(`art ${n} : ${notes.length} items rendus au dispositif, après « ${lignes[cands[0]].trim().slice(0, 45)}… »`)
  }
  const oublies = Object.keys(ITEMS_EXPLICITES)
    .map(Number)
    .filter((n) => !itemsFaits.includes(n) && (brut.jurisprudence[clesAvant.get(`art-${n}`) ?? ''] ?? []).length)
  if (oublies.length) throw new Error(`articles nommés par la cliente non traités : ${oublies.join(', ')}`)

  // ── C. suppressions ─────────────────────────────────────────────────────────
  for (const [art, prefixes] of Object.entries(SUPPRESSIONS)) {
    const n = Number(art)
    const [d, f] = bornes(n)
    for (const pref of prefixes) {
      let vu = false
      for (let i = d + 1; i < f; i++) {
        if (aSupprimer.has(i) || !norm(lignes[i]).startsWith(norm(pref))) continue
        aSupprimer.add(i)
        vu = true
        journal.push(`art ${n} : SUPPRIMÉE — « ${lignes[i].trim().slice(0, 60)}… »`)
      }
      if (!vu) journal.push(`art ${n} : « ${pref.slice(0, 40)}… » absente — déjà supprimée`)
    }
  }

  // ── D. OCR : la barre verticale est un 1 ────────────────────────────────────
  for (const n of numeros) {
    const [d, f] = bornes(n)
    for (let i = d; i < f; i++) {
      if (!/Art\.\s*\|\s*\./.test(lignes[i])) continue
      lignes[i] = lignes[i].replace(/Art\.\s*\|\s*\./g, 'Art. 1.')
      ocr++
      journal.push(`art ${n} : OCR « Art. |. » → « Art. 1. »`)
    }
  }

  // ── overlays : la correction doit être VISIBLE ──────────────────────────────
  const touches = [...new Set([...artDeLigne.values(), ...itemsFaits, ...Object.keys(SUPPRESSIONS).map(Number)])]
  const overlays = await getAmendments(doc.id)
  const sousOverlay = touches.filter((n) => overlays.get(`art-${n}`)?.inForce)
  if (sousOverlay.length)
    throw new Error(`articles sous overlay d'amendement (correction invisible) : ${sousOverlay.join(', ')}`)

  // ── application sur le corps ────────────────────────────────────────────────
  const corps: string[] = []
  for (let i = 0; i < lignes.length; i++) {
    if (aSupprimer.has(i)) continue
    corps.push(lignes[i])
    const ajouts = aInserer.get(i)
    if (ajouts) corps.push(...ajouts)
  }
  const nouveauCorps = corps.join('\n')

  // ── E. recompositions ponctuelles ───────────────────────────────────────────
  const av740 = connexe['art-740']?.[0]
  if (av740 && /Art\.\s*l\*/.test(av740.label)) {
    connexe['art-740'][0] = { ...av740, label: RECOMPOSER_740.label, text: `${RECOMPOSER_740.article1}\n${av740.text}` }
    journal.push("art 740 : article 1er de la loi rendu au contenu (il était avalé par l'intitulé) ; « condi- tions » recousu")
  }
  const av95 = connexe['art-95']?.[0]
  if (av95 && mots(av95.text).startsWith(mots('1. La loi conditionne le changement de domicile'))) {
    connexe['art-95'][0] = { ...av95, ...RECOMPOSER_95 }
    journal.push('art 95 : jurisprudence retirée du pliable, intitulé scindé en intitulé + disposition')
  }

  // ── jurisprudence ───────────────────────────────────────────────────────────
  const jurisprudence: Record<string, Array<{ ref?: string; excerpt?: string }>> = JSON.parse(JSON.stringify(brut.jurisprudence))
  for (const n of itemsFaits) delete jurisprudence[clesAvant.get(`art-${n}`)!]

  // ── INVARIANT : rien ne disparaît ───────────────────────────────────────────
  // Mesure INDÉPENDANTE de celle qui a servi à décider : pour chaque article touché, tout
  // mot rare présent AVANT (corps + pliable) doit l'être encore APRÈS. Un détecteur et son
  // contrôle qui partagent la même mesure partagent aussi ses angles morts — c'est ainsi
  // que les deux alinéas de la loi de 1945 (art. 151) ont failli disparaître.
  const corpsApres = new Map<number, string>()
  for (const n of touches) {
    const [d, f] = bornes(n)
    const gardees: string[] = []
    for (let i = d; i < f; i++) {
      if (!aSupprimer.has(i)) gardees.push(lignes[i])
      const aj = aInserer.get(i)
      if (aj) gardees.push(...aj)
    }
    corpsApres.set(n, gardees.join('\n'))
  }
  const effacesAutorises = new Set<string>()
  for (const [art, prefixes] of Object.entries(SUPPRESSIONS)) {
    const [d, f] = bornes(Number(art))
    for (let i = d; i < f; i++)
      if (aSupprimer.has(i) && prefixes.some((p) => norm(lignes[i]).startsWith(norm(p))))
        pleins(lignes[i]).filter((w) => w.length >= 6).forEach((w) => effacesAutorises.add(w))
  }
  const perdus: string[] = []
  for (const n of touches) {
    const [d, f] = bornes(n)
    const avant = `${lignes.slice(d, f).join(' ')} ${(brut.connexe[`art-${n}`] ?? []).map((c) => `${c.label} ${c.text}`).join(' ')}`
    const apres = `${corpsApres.get(n)} ${blobDe(n)} ${(jurisprudence[clesAvant.get(`art-${n}`) ?? ''] ?? []).map((j) => j.excerpt ?? '').join(' ')}`
    const dedans = new Set(pleins(apres))
    const absents = [...new Set(pleins(avant).filter((w) => w.length >= 6))].filter(
      (w) => !dedans.has(w) && !effacesAutorises.has(w) && !dedans.has(VARIANTES.get(w) ?? '\u0000'),
    )
    if (absents.length) perdus.push(`art ${n} : ${absents.slice(0, 8).join(', ')}`)
  }
  if (perdus.length) {
    perdus.forEach((l) => console.error('  ⚠ ' + l))
    throw new Error(`${perdus.length} article(s) perdraient du texte — aucune écriture`)
  }

  for (const [, ajouts] of aInserer)
    for (const a of ajouts)
      if (!mots(nouveauCorps).includes(mots(a))) throw new Error(`item non réinséré : « ${a.slice(0, 60)} »`)

  // ── INVARIANT : aucune clé d'annotation orpheline ───────────────────────────
  const clesApres = new Set<string>()
  for (const b of segmentAnnotated(nouveauCorps, brut.toc))
    if (b.kind === 'body' && b.jurisKey) clesApres.add(b.jurisKey)
  const orphelines = Object.keys(jurisprudence).filter((k) => !clesApres.has(k))
  const artsPerdus = [...clesAvant].filter(([a]) => ![...clesApres].some((k) => k.endsWith(`|${a}`)))

  // ── rapport ─────────────────────────────────────────────────────────────────
  console.log(`\n${journal.length} opérations :`)
  journal.forEach((l) => console.log('  ' + l))
  console.log(`\narticles touchés : ${touches.length}`)
  console.log(`lignes retirées du corps : ${aSupprimer.size}`)
  console.log(`  · blocs créés dans le pliable : ${crees} (dont ${liens} liés à la Constitution)`)
  console.log(`  · doublons d'un bloc existant : ${doublons}`)
  console.log(`  · alinéas rendus à un bloc existant : ${completes}`)
  console.log(`items rendus au dispositif : ${[...aInserer.values()].flat().length} (${itemsFaits.length} articles)`)
  console.log(`corrections d'OCR : ${ocr}`)
  console.log(`corps : ${lignes.length} → ${corps.length} lignes`)
  console.log(`clés d'annotation orphelines : ${orphelines.length}${orphelines.length ? ' — ' + orphelines.slice(0, 5).join(', ') : ''}`)
  console.log(`articles perdus par la segmentation : ${artsPerdus.length}`)
  if (orphelines.length || artsPerdus.length) throw new Error('segmentation incohérente — aucune écriture')

  for (const n of VOIR) {
    console.log(`\n╔══ ARTICLE ${n} — tel qu'il sera rendu ══`)
    console.log('║ CORPS :')
    ;(corpsApres.get(n) ?? '(article non touché)').split('\n').filter((l) => l.trim()).forEach((l) => console.log('║   ' + l.trim().slice(0, 150)))
    const cx = connexe[`art-${n}`] ?? []
    console.log(`║ PLIABLE « Textes connexes » : ${cx.length} bloc(s)`)
    cx.forEach((c, i) => {
      console.log(`║   [${i}] intitulé : ${c.label || '(nu)'}${c.docId ? `   → /doc/${c.docId.slice(0, 8)}…${c.anchor ? '#' + c.anchor : ''}` : ''}`)
      c.text.split('\n').filter(Boolean).forEach((l) => console.log('║       ' + l.slice(0, 150)))
    })
  }

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }
  await prisma.$transaction(
    async (tx) => {
      await tx.document.update({
        where: { id: doc.id },
        data: { bodyOriginal: nouveauCorps, annotationsJson: JSON.stringify({ ...brut, connexe, jurisprudence }) },
      })
      await audit(
        { action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: doc.id,
          meta: { source: 'CODE_CIVIL_ANNOTE', motif: 'dispositif, appareil et textes connexes remis en ordre',
                  articles: touches.length, replis: aSupprimer.size, items: [...aInserer.values()].flat().length, ocr } },
        tx,
      )
    },
    { timeout: 120_000, maxWait: 30_000 },
  )
  console.log('\n✓ Écrit et journalisé.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
