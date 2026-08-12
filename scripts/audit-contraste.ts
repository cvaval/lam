/**
 * AUDIT DE CONTRASTE DE TOUTE LA PLATEFORME — statique, sur le source JSX.
 *
 *   npx tsx scripts/audit-contraste.ts            # échecs seulement
 *   npx tsx scripts/audit-contraste.ts --tout     # + le détail des paires vues
 *   npx tsx scripts/audit-contraste.ts --fichier src/components/Landing.tsx
 *
 * POURQUOI STATIQUE plutôt qu'au navigateur : la moitié de la plateforme est derrière
 * l'authentification (tableau de bord, lecteur de documents, back-office) et aucune
 * session ne peut être ouverte ici — la base pointe sur la PRODUCTION. Un balayage au
 * navigateur ne verrait que les 8 pages publiques. L'analyse du source les voit toutes.
 *
 * CE QU'IL FAIT : il reconstruit l'arbre JSX de chaque fichier, propage le fond hérité
 * (`bg-*` du plus proche ancêtre, `bg-koton` du body à défaut), résout les teintes
 * `couleur/opacité` par composition alpha, puis applique le seuil WCAG qui convient à la
 * taille et à la graisse du texte (4,5:1 — 3:1 au-delà de 24 px, ou 18,66 px en gras).
 *
 * CE QU'IL NE VOIT PAS, et qu'il faut garder en tête :
 *  - les fonds posés en CSS pur (`globals.css`) ou en style inline calculé ;
 *  - un composant dont le fond est fixé par SON APPELANT (`<Carte className="bg-chabon">`) :
 *    l'ascendance s'arrête au fichier. D'où l'option `RACINES` ci-dessous, qui déclare le
 *    fond réel des fichiers concernés — sans elle, ils seraient audités sur Koton et les
 *    verdicts seraient faux dans les DEUX sens.
 *  - le texte dont la couleur vient d'une variable ;
 *  - le JSX passé en PROP (`fallback={<div>…</div>}`) : l'ascendance se perd en
 *    traversant un attribut. C'est ainsi que le repli `<noscript>` de la carte
 *    judiciaire a échappé au contrôle — seul le navigateur l'a vu.
 *
 * Il ne remplace donc pas un coup d'œil, il le CIBLE : c'est l'écran qui tranche.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { BRAND_COLORS } from '../src/lib/brand-colors'

// ── Palette résolue ────────────────────────────────────────────────────────────
const C = BRAND_COLORS
const TOKENS: Record<string, string> = {
  chabon: C.chabon, adwaz: C.adwaz, koton: C.koton, blan: C.blan, grafit: C.grafit,
  wouj: C.wouj, sitwon: C.sitwon, ank: C.ank, liy: C.liy, pil: C.pil,
  'sitwon-pal': C.sitwonPal, vet: C.vet, ble: C.ble, inverse: C.inverse,
  white: '#FFFFFF', black: '#000000', transparent: 'transparent', current: 'transparent',
}

/** Fond du body — `@apply bg-koton text-ank` dans globals.css. */
const FOND_PAR_DEFAUT = C.koton

/**
 * Fichiers dont le fond est imposé par l'appelant : l'analyse du seul fichier conclurait
 * à tort. Chaque entrée est une CONSTATATION, pas une préférence — vérifiée au source.
 */
const RACINES: { prefixe: string; fond: string; motif: string }[] = [
  { prefixe: 'src/components/home/', fond: C.chabon, motif: 'héros rendu dans <section class="bg-chabon"> (Landing.tsx)' },
  { prefixe: 'src/components/HeroVisual.tsx', fond: C.chabon, motif: 'visuel du héros, même section Chabon' },
  { prefixe: 'src/components/AdminNav.tsx', fond: C.chabon, motif: 'rendu dans <aside class="bg-chabon"> (admin/layout.tsx)' },
]

type RGB = [number, number, number]

function hexRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function melange(avant: RGB, arriere: RGB, alpha: number): RGB {
  return [0, 1, 2].map((i) => avant[i] * alpha + arriere[i] * (1 - alpha)) as RGB
}
function luminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function contraste(a: RGB, b: RGB): number {
  const [l1, l2] = [luminance(a), luminance(b)]
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

/** `ank/45` → { hex, alpha }. Rend null pour une couleur hors palette. */
function resoudre(valeur: string): { hex: string; alpha: number } | null {
  const arbitraire = valeur.match(/^\[#([0-9A-Fa-f]{3,8})\]$/)
  if (arbitraire) {
    const h = arbitraire[1]
    return { hex: `#${h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6)}`, alpha: 1 }
  }
  const m = valeur.match(/^([a-z-]+?)(?:\/(\d{1,3}))?$/)
  if (!m) return null
  const hex = TOKENS[m[1]]
  if (!hex || hex === 'transparent') return null
  return { hex, alpha: m[2] ? Number(m[2]) / 100 : 1 }
}

// ── Tailles : échelle de la charte + échelle Tailwind + arbitraires ────────────
const TAILLES: Record<string, number> = {
  'display-1': 44, 'display-2': 36, 'display-3': 28, body: 16, 'body-sm': 14,
  label: 12, 'label-sm': 11, legal: 17, meta: 12,
  xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36,
  '5xl': 48, '6xl': 60, '7xl': 72,
}
/** Ces tailles de la charte portent une graisse ≥ 600 dans leur définition. */
const TAILLES_GRASSES = new Set(['label', 'label-sm', 'display-1', 'display-2', 'display-3'])
const GRAISSES: Record<string, number> = {
  thin: 100, extralight: 200, light: 300, normal: 400, medium: 500,
  semibold: 600, bold: 700, extrabold: 800, black: 900,
}

interface Element {
  balise: string
  classes: string[]
  fond: string           // hex effectif
  /**
   * TOUTES les couleurs de texte déclarées sur cet élément. Un `className` conditionnel
   * (`actif ? 'text-ank' : 'text-ank/40'`) en offre plusieurs : n'en juger qu'une —
   * la dernière — laissait passer la branche fautive. Chaque branche est un rendu réel.
   */
  textes: string[]
  /**
   * Fonds que cet élément peut présenter à ses enfants : le socle, plus ceux qu'apporte
   * chacune de ses branches. Une condition (`chaud ? …`) est souvent la MÊME chez le
   * parent et chez l'enfant : leurs branches vont ensemble, et rien ne permet ici de
   * savoir laquelle. On ne conclut donc à un défaut que s'il vaut sur TOUS ces fonds.
   */
  fondsAlt: string[]
  taille: number
  graisse: number
  ligne: number
}

/**
 * Décompose une expression `className` en un socle et ses BRANCHES.
 *
 * ⚠️ Une version naïve — apparier tout couple de guillemets — est FAUSSE : dans
 * `` `base ${a ? 'x' : 'y'}` ``, elle marie le guillemet fermant de `'x'` à l'ouvrant de
 * `'y'` et ne capture que l'intervalle ` : `. Toutes les classes conditionnelles lui
 * échappaient, silencieusement.
 *
 * ⚠️ Et il ne suffit pas de les mettre à plat : `actif ? 'bg-chabon text-white' : 'text-ank/60'`
 * apparierait alors le fond de la branche ACTIVE au texte de l'INACTIVE — un défaut
 * imaginaire. Chaque branche est donc évaluée comme un rendu à part entière, socle compris.
 */
function classesDe(attribut: string): { socle: string[]; branches: string[][] } {
  const mots = (t: string) => t.split(/\s+/).filter(Boolean)
  const corps = attribut.replace(/^\{|\}$/g, '').trim()

  // `className="a b"` ou `className='a b'` — une seule liste, aucun choix.
  const simple = corps.match(/^(['"])([^'"]*)\1$/)
  if (simple) return { socle: mots(simple[2]), branches: [] }

  const socle: string[] = []
  const branches: string[][] = []

  if (corps.startsWith('`')) {
    // Gabarit : le littéral hors `${…}` est commun, chaque chaîne interne est une branche.
    const inter = corps.slice(1, -1)
    let i = 0
    while (i < inter.length) {
      const d = inter.indexOf('${', i)
      if (d < 0) { socle.push(...mots(inter.slice(i))); break }
      socle.push(...mots(inter.slice(i, d)))
      let prof = 1, j = d + 2
      while (j < inter.length && prof > 0) { if (inter[j] === '{') prof++; else if (inter[j] === '}') prof--; j++ }
      for (const m of inter.slice(d + 2, j - 1).matchAll(/(['"])([^'"]*)\1/g)) branches.push(mots(m[2]))
      i = j
    }
  } else {
    for (const m of corps.matchAll(/(['"])([^'"]*)\1/g)) branches.push(mots(m[2]))
  }
  return { socle, branches }
}

/**
 * Variantes visant un PSEUDO-ÉLÉMENT : elles habillent une autre boîte que l'élément.
 * `file:bg-chabon` peint le bouton d'un champ de fichier, pas le champ — confondre les
 * deux faisait juger `text-grafit` sur du Chabon, et inventer un défaut inexistant.
 * Chacune forme donc son propre compartiment, avec son fond.
 */
const PSEUDO = ['file', 'before', 'after', 'placeholder', 'marker', 'selection', 'first-letter', 'first-line']

/**
 * Décompose une classe en (compartiment, classe nue). On écarte les états TRANSITOIRES
 * — un contraste faible au seul survol se juge autrement — et on retire les points
 * d'arrêt, qui ne changent pas le rendu au repos.
 */
function decomposer(cls: string): { pseudo: string; nu: string } | null {
  if (/^(hover|focus|focus-within|focus-visible|active|visited|disabled|group-\w+|peer-\w+|aria-\w+|data-\w+|motion-\w+|print|dark):/.test(cls)) return null
  let reste = cls.replace(/^(?:(?:sm|md|lg|xl|2xl|first|last|odd|even):)+/, '')
  let pseudo = ''
  const m = reste.match(/^([a-z-]+):(.+)$/)
  if (m && PSEUDO.includes(m[1])) { pseudo = m[1]; reste = m[2] }
  else if (m) return null // variante inconnue : on ne devine pas
  return { pseudo, nu: reste }
}

function auditerFichier(chemin: string, source: string, fondRacine: string) {
  const echecs: {
    ligne: number; extrait: string; texte: string; fond: string; ratio: number; seuil: number; px: number
  }[] = []
  const pile: Element[] = [{
    balise: ':root', classes: [], fond: fondRacine, textes: [], fondsAlt: [], taille: 16, graisse: 400, ligne: 0,
  }]

  // Découpe en balises. On ignore les fragments <> et les commentaires {/* */}.
  const rx = /<\/?([A-Za-z][\w.]*)((?:[^<>'"{}]|'[^']*'|"[^"]*"|\{(?:[^{}]|\{[^{}]*\})*\})*)(\/?)>/g
  let m: RegExpExecArray | null
  while ((m = rx.exec(source))) {
    const [complet, balise, attributs, autoFermante] = m
    const ligne = source.slice(0, m.index).split('\n').length
    if (complet.startsWith('</')) {
      for (let i = pile.length - 1; i > 0; i--) if (pile[i].balise === balise) { pile.length = i; break }
      continue
    }

    const attrClass = attributs.match(/className=(\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*"|'[^']*')/)
    const decoupe = attrClass ? classesDe(attrClass[1]) : { socle: [], branches: [] }
    // Une branche = un rendu possible. Sans branche, le socle est le seul rendu.
    const rendus = decoupe.branches.length
      ? decoupe.branches.map((b) => [...decoupe.socle, ...b])
      : [decoupe.socle]
    const classes = [...new Set(rendus.flat())] // pour l'empilement (fond hérité par les enfants)
    const parent = pile[pile.length - 1]

    /** Résout un rendu (liste de classes) sur le contexte du parent. */
    const resoudreRendu = (liste: string[]) => {
      let fond = parent.fond
      const textes: string[] = []
      let taille = parent.taille
      let graisse = parent.graisse
      // Compartiments des pseudo-éléments : fond et couleurs propres, hérités de
      // l'élément à défaut de déclaration explicite.
      const pseudos = new Map<string, { fond: string | null; textes: string[] }>()

      for (const brute of liste) {
        const d = decomposer(brute)
        if (!d) continue
        const { pseudo, nu } = d
        if (pseudo && !pseudos.has(pseudo)) pseudos.set(pseudo, { fond: null, textes: [] })
        const seau = pseudo ? pseudos.get(pseudo)! : null

        const bg = nu.match(/^bg-(.+)$/)
        if (bg) {
          const r = resoudre(bg[1])
          if (r) {
            // Un fond translucide se compose sur celui qu'il recouvre — pas sur du blanc.
            const dessous = seau ? (seau.fond ?? fond) : fond
            const compose = `#${melange(hexRgb(r.hex), hexRgb(dessous), r.alpha).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
            if (seau) seau.fond = compose
            else fond = compose
          }
        }
        const tx = nu.match(/^text-(.+)$/)
        if (tx) {
          // Taille et graisse ne se déclarent pas par pseudo-élément ici : on les lit
          // sur l'élément, quel que soit le compartiment.
          if (TAILLES[tx[1]] != null) { taille = TAILLES[tx[1]]; if (TAILLES_GRASSES.has(tx[1])) graisse = 600 }
          else if (/^\[(\d+(?:\.\d+)?)px\]$/.test(tx[1])) taille = Number(tx[1].match(/[\d.]+/)![0])
          else if (resoudre(tx[1])) {
            const cible = seau ? seau.textes : textes
            if (!cible.includes(tx[1])) cible.push(tx[1])
          }
        }
        const fw = nu.match(/^font-(\w+)$/)
        if (fw && GRAISSES[fw[1]]) graisse = GRAISSES[fw[1]]
      }
      return { fond, textes, taille, graisse, pseudos }
    }

    /**
     * ⚠️ CE QUI SE TRANSMET AUX ENFANTS, c'est le SOCLE — jamais un fond conditionnel.
     *
     * Dans `chaud ? 'bg-koton text-ank' : 'text-koton/85'`, un descendant ne peut pas
     * hériter de `bg-koton` : on ignore sous quelle branche il se trouve, et le supposer
     * revient à marier le fond d'une branche au texte de l'autre — un défaut imaginaire
     * (constaté sur HeroVisual). Le fond conditionnel sert à juger l'élément LUI-MÊME,
     * pas sa descendance.
     *
     * Contrepartie assumée : un enfant réellement posé sur un fond conditionnel sombre
     * échappe au contrôle. C'est le sens de la prudence — mieux vaut taire un doute que
     * signaler un défaut inexistant, qui ferait perdre confiance dans tout le rapport.
     */
    const { fond, taille, graisse } = resoudreRendu(decoupe.socle)
    const textes: string[] = []
    const fondsAlt = [...new Set(rendus.map((r) => resoudreRendu(r).fond))].filter((f) => f !== fond)

    const el: Element = { balise, classes, fond, textes, fondsAlt, taille, graisse, ligne }
    // ⚠️ La barre de `<div … />` est avalée par le groupe d'attributs (elle passe le
    // filtre `[^<>'"{}]`), donc le groupe de capture arrive VIDE. Sans ce second test,
    // toute balise auto-fermante restait empilée et ses voisines héritaient de SON fond —
    // c'est ainsi qu'une carte blanche était auditée sur Chabon.
    const auto = autoFermante === '/' || /\/\s*$/.test(attributs)
    if (!auto && !/^(br|hr|img|input|source|meta|link|path|circle|rect|polygon|line|stop|use)$/.test(balise)) pile.push(el)

    // Un élément qui ne fait que POSER une couleur pour ses enfants est jugé quand même :
    // s'il porte du texte, c'est cette couleur qui s'applique ; sinon le verdict vaut
    // pour ses descendants, qui héritent.
    const aJuger: { texte: string; sur: string; px: number; fw: number }[] = []
    const vus = new Set<string>()
    for (const rendu of rendus) {
      const r = resoudreRendu(rendu)
      for (const t of r.textes) {
        const cle = `${t}|${r.fond}`
        if (!vus.has(cle)) { vus.add(cle); aJuger.push({ texte: t, sur: r.fond, px: r.taille, fw: r.graisse }) }
      }
      for (const [nom, seau] of r.pseudos)
        for (const t of seau.textes) {
          const cle = `${nom}:${t}|${seau.fond ?? r.fond}`
          if (!vus.has(cle)) { vus.add(cle); aJuger.push({ texte: `${nom}:${t}`, sur: seau.fond ?? r.fond, px: r.taille, fw: r.graisse }) }
        }
    }

    for (const { texte: brut, sur, px, fw } of aJuger) {
      const texte = brut.includes(':') ? brut.split(':')[1] : brut
      const r = resoudre(texte)!
      const grand = px >= 24 || (px >= 18.66 && fw >= 600)
      const seuil = grand ? 3 : 4.5
      // Le fond retenu, puis ceux que le parent pouvait présenter : un seul suffisant
      // et le doute profite au code.
      const candidats = [sur, ...parent.fondsAlt]
      const ratios = candidats.map((c) => {
        const rgb = hexRgb(c)
        return contraste(melange(hexRgb(r.hex), rgb, r.alpha), rgb)
      })
      const ratio = Math.max(...ratios)
      const fondRetenu = candidats[ratios.indexOf(ratio)]
      if (ratio < seuil) {
        const extrait = source.split('\n')[ligne - 1]?.trim().slice(0, 90) ?? ''
        echecs.push({ ligne, extrait, texte: brut, fond: fondRetenu, ratio: +ratio.toFixed(2), seuil, px })
      }
    }
  }
  return echecs
}

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) fichiers(p, acc)
    else if (p.endsWith('.tsx')) acc.push(p)
  }
  return acc
}

function main() {
  const argv = process.argv.slice(2)
  const ixF = argv.indexOf('--fichier')
  const cible = ixF >= 0 ? [argv[ixF + 1]] : fichiers('src')
  const total: { fichier: string; echecs: ReturnType<typeof auditerFichier> }[] = []

  for (const f of cible) {
    const rel = relative(process.cwd(), f)
    const racine = RACINES.find((r) => rel.startsWith(r.prefixe))
    const echecs = auditerFichier(rel, readFileSync(f, 'utf8'), racine?.fond ?? FOND_PAR_DEFAUT)
    if (echecs.length) total.push({ fichier: rel, echecs })
  }

  total.sort((a, b) => b.echecs.length - a.echecs.length)
  // Sortie exploitable par un correcteur : fichier|ligne|classe|fond|ratio
  if (argv.includes('--liste')) {
    for (const { fichier, echecs } of total)
      for (const e of echecs) console.log(`${fichier}|${e.ligne}|${e.texte}|${e.fond}|${e.ratio}`)
    return
  }
  let n = 0
  for (const { fichier, echecs } of total) {
    console.log(`\n${fichier}  —  ${echecs.length}`)
    for (const e of echecs) {
      n++
      console.log(`  ${String(e.ligne).padStart(4)}  ${e.ratio.toFixed(2)}:1 < ${e.seuil}  ${e.px}px  text-${e.texte} sur ${e.fond}`)
      if (argv.includes('--tout')) console.log(`        ${e.extrait}`)
    }
  }
  console.log(`\n${n} échec(s) de contraste dans ${total.length} fichier(s) sur ${cible.length} audités.`)
  console.log('Seuils WCAG AA : 4,5:1 · 3:1 au-delà de 24 px (ou 18,66 px en gras).')
}

main()
