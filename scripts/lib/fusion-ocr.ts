/**
 * Fusion de DEUX lectures OCR d'une même page du Moniteur — fonctions PURES, testées à part.
 *
 * Banc du 12 oct. 2026 (10 pages, 2013-2025) : Claude et Tesseract concordent à 97 %, et leurs
 * défauts ne se recouvrent pas.
 *  - Claude rend un texte PROPRE (accents rétablis, paragraphes refaits, sans titre courant)
 *    mais saute parfois des mots du corps : « sur ordinateur » (LM2020-50), « également »
 *    (LM2021-100). Pour un texte juridique, une omission est la pire des fautes.
 *  - Tesseract lit TOUT, mais estropie des lettres (« MOMTEUR », « Décrèt », « IIs ») et garde les
 *    coupures de ligne ; il saute aussi, parfois, un nom sous une signature.
 * D'où la règle : on part du texte de Claude, et on y réinsère, à leur place, les mots que
 * Tesseract a lus et que Claude a sautés — jamais ses débris (titre courant, bruit de scan).
 */

/** Une lecture Tesseract débarrassée de ce que la fusion ne doit jamais reprendre. */
export function tesseractPropre(t: string): string {
  return t
    .normalize('NFC')
    .replace(/’/g, "'")
    .split('\n')
    .filter((l) => !/<<\s*LE MONITEUR\s*>>/i.test(l)) // titre courant
    .join('\n')
    .replace(/(\p{L})-\n(\p{L})/gu, '$1$2') // césure de fin de ligne
    .replace(/-[ \t]+(?=[a-zà-ÿ0-9])/g, '-') // « Port- au-Prince » → « Port-au-Prince »
}

/** Forme de comparaison d'un mot : casse, apostrophe, ponctuation de bord, « M » = « Me ». */
function cle(w: string): string {
  const c = w.normalize('NFC').replace(/’/g, "'").toLowerCase().replace(/^[.,;:()«»"]+|[.,;:()«»"]+$/g, '')
  return c === 'm' || c === 'm°' ? 'me' : c
}

const MOIS = 'janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre'

/** Ce que Tesseract lit et que Claude omet à raison : titre courant, bruit de numérisation. */
export function debris(txt: string): boolean {
  // Un caractère hors du français imprimé (« ÿUÀŒCM‘ », « Ér#t/ », « ®'f'ﬁ ») trahit une lecture de
  // signature ou de tampon : jamais repris.
  if (/[^\p{L}\p{N}\s'’\-.,;:()«»"°/&%]|[ÿŒœ®©#|_~^<>{}[\]\\]/u.test(txt)) return true
  // Un même mot répété (« Nicolas Nicolas ») : cellule de tableau lue deux fois, pas une phrase.
  const ws = txt.split(/\s+/).filter(Boolean)
  if (ws.length >= 2 && ws.every((w) => w.toLowerCase() === ws[0].toLowerCase())) return true
  // Lettres isolées (« m W e ») : bruit, pas des mots — hormis « à », « a », « y ».
  if (txt.split(/\s+/).some((w) => /^\p{L}$/u.test(w) && !/^[àay]$/i.test(w))) return true
  // Titre courant (« N° 50 - Mardi 17 Mars 2020 ») : Claude l'omet exprès.
  if (new RegExp(`(lundi|mardi|mercredi|jeudi|vendredi)\\s+\\d{1,2}\\s+(${MOIS})\\s+\\d{4}`, 'i').test(txt)) return true
  // Pied d'imprimeur (« Tirage : 850 exemplaires », « PRESSES NATIONALES D'HAÏTI ») : déplacé, jamais omis.
  if (/exemplaires|presses\s+nationales|tirage|issn|d[ée]p[ôo]t\s+l[ée]gal/i.test(txt)) return true
  const mots = txt.match(/\p{L}{3,}/gu) ?? []
  if (mots.length < 2) return true
  const sansBlanc = txt.replace(/\s/g, '')
  const lettres = (sansBlanc.match(/\p{L}/gu) ?? []).length
  return lettres < 0.6 * sansBlanc.length
}

interface Jeton {
  debut: number
  fin: number
  mot: string
}

function jetons(t: string): Jeton[] {
  return [...t.matchAll(/\S+/g)].map((m) => ({ debut: m.index!, fin: m.index! + m[0].length, mot: m[0] }))
}

type Op = { op: 'egal' | 'retire' | 'ajoute' | 'remplace'; a1: number; a2: number; b1: number; b2: number }

/**
 * Alignement de deux suites de mots (plus longue sous-suite commune, programmation dynamique),
 * rendu en opérations au sens de difflib : « retire » = mots de A absents de B.
 * Pages de quelques centaines de mots : n × m reste de l'ordre du million d'opérations.
 */
export function aligner(a: string[], b: string[]): Op[] {
  const n = a.length
  const m = b.length
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const ops: Op[] = []
  const pousser = (op: Op['op'], a1: number, a2: number, b1: number, b2: number) => {
    const der = ops[ops.length - 1]
    if (der && der.op === op && der.a2 === a1 && der.b2 === b1) {
      der.a2 = a2
      der.b2 = b2
    } else ops.push({ op, a1, a2, b1, b2 })
  }
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      pousser('egal', i, i + 1, j, j + 1)
      i++
      j++
    } else if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) {
      pousser('ajoute', i, i, j, j + 1)
      j++
    } else {
      pousser('retire', i, i + 1, j, j)
      i++
    }
  }
  // Un « retire » suivi d'un « ajoute » au même endroit est un remplacement.
  const fusion: Op[] = []
  for (const o of ops) {
    const der = fusion[fusion.length - 1]
    if (der && ((der.op === 'retire' && o.op === 'ajoute') || (der.op === 'ajoute' && o.op === 'retire')) && der.a2 === o.a1 && der.b2 === o.b1) {
      fusion[fusion.length - 1] = { op: 'remplace', a1: der.a1, a2: o.a2, b1: der.b1, b2: o.b2 }
    } else fusion.push(o)
  }
  return fusion
}

export interface Fusion {
  texte: string
  /** Passages réinsérés depuis Tesseract (omissions de Claude). */
  reinseres: string[]
  /** Divergences de plusieurs mots : à relire, rien n'est tranché d'office. */
  desaccords: { tesseract: string; claude: string }[]
}

/** Forme de vocabulaire d'un mot : minuscules, sans accents ni ponctuation de bord. */
export function formeVocabulaire(w: string): string {
  return w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/’/g, "'").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

/**
 * Part des mots (3 lettres et plus) d'un texte que Claude écrit ailleurs dans le corpus.
 *
 * ⚠️ LE NOMBRE DE MOTS DE TESSERACT NE DIT PAS QU'IL A LU. Sur les tableaux budgétaires imprimés en
 * travers (Spéciaux 2019-2024), Tesseract lit le texte à l'envers — « sasuadaq » pour « dépenses » —
 * et rend 400 « mots » là où Claude, honnête, en transcrit 150 et signale le reste illisible. Le
 * repli sur Tesseract y aurait versé du charabia (13 oct. 2026 : 42 pages sur 44). Mesures : page
 * ordinaire ≥ 0,95 ; tableau tourné 0,04-0,10 ; coupon d'abonnement à pointillés ≈ 0,78.
 */
export function partLisible(texte: string, vocabulaire: Set<string>): number {
  const mots = (texte.match(/\p{L}{3,}/gu) ?? []).map(formeVocabulaire)
  return mots.length ? mots.filter((m) => vocabulaire.has(m)).length / mots.length : 0
}
/** Seuil au-dessus duquel la lecture de Tesseract peut remplacer une lecture de Claude incomplète. */
export const SEUIL_LISIBLE = 0.9

/**
 * Texte de Claude, complété des mots que Tesseract a lus et que Claude a sautés.
 * `vocabulaire` (facultatif) : les mots que Claude emploie dans tout le corpus. Fourni, il exige
 * que chaque mot réinséré y figure — un mot que Claude n'écrit NULLE PART est une faute ou un débris
 * de Tesseract (« Coillationnée », « SHETETEENTE », « ASSAGNOL »), pas une omission.
 */
export function fusionner(claude: string, tesseract: string, vocabulaire?: Set<string>): Fusion {
  const base = claude.normalize('NFC')
  const H = jetons(base)
  const T = jetons(tesseractPropre(tesseract))
  const ops = aligner(
    T.map((x) => cle(x.mot)),
    H.map((x) => cle(x.mot)),
  )
  const insertions: { pos: number; txt: string }[] = []
  const desaccords: Fusion['desaccords'] = []
  // Forme plate, SANS ACCENTS : Claude écrit « RÉPUBLIQUE D'HAÏTI » là où Tesseract lit « REPUBLIQUE D'HAITI ».
  const plat = (s: string) =>
    ` ${s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/’/g, "'").replace(/[^\p{L}\p{N}']+/gu, ' ').trim()} `
  const occurrences = (meule: string, aiguille: string) => meule.split(aiguille).length - 1
  const basePlate = plat(base)
  const tessPlate = plat(T.map((x) => x.mot).join(' '))
  // Couverture par PAIRES de mots pleins (≥ 3 lettres) : une paire est « couverte » si Claude l'a
  // au moins autant de fois que Tesseract. Une lettre fausse ne casse qu'une ou deux paires.
  const paires = (s: string) => {
    const m = plat(s).trim().split(' ').filter((w) => (w.match(/\p{L}/gu) ?? []).length >= 3)
    return m.slice(1).map((w, i) => ` ${m[i]} ${w} `)
  }
  const dejaCouvert = (txt: string) => {
    const p = paires(txt)
    if (!p.length) return false
    return p.filter((x) => occurrences(basePlate, x) >= occurrences(tessPlate, x)).length / p.length >= 0.5
  }
  // ⚠️ L'ORDRE DE LECTURE DIFFÈRE SUR LES PAGES À COLONNES ET LES MANCHETTES. Un bloc que les deux
  // moteurs placent à des endroits différents paraît « omis » à l'un d'eux : le réinsérer le
  // DOUBLE (essai du 12 oct. 2026 : « URGENCE » treize fois, la manchette deux fois). On ne
  // reprend donc qu'une omission ENCADRÉE — au moins deux mots concordants de part et d'autre —
  // et absente du texte de Claude.
  const encadre = (i: number) =>
    ops[i - 1]?.op === 'egal' && ops[i - 1].b2 - ops[i - 1].b1 >= 2 && ops[i + 1]?.op === 'egal' && ops[i + 1].b2 - ops[i + 1].b1 >= 2
  for (const [i, o] of ops.entries()) {
    if (o.op === 'retire') {
      const txt = T.slice(o.a1, o.a2)
        .map((x) => x.mot)
        .join(' ')
      if (!encadre(i)) continue
      // Un mot isolé n'est repris que s'il en est un vrai (« également ») — pas un débris (« LLe) »).
      if (o.a2 - o.a1 === 1 && !/^[\p{L}'’-]{4,}[.,;:]?$/u.test(txt)) continue
      if (o.a2 - o.a1 >= 2 && debris(txt)) continue
      // ⚠️ AUDIT DU 12 OCT. 2026 : sur 3 576 pages, 271 réinsertions, dont une bonne part de blocs
      // DÉJÀ présents chez Claude mais lus par Tesseract avec une lettre fausse ou du bruit (listes
      // de signataires, « PS Léonel CHARLES Trésorier m W e Diony CHARLES ») — l'égalité exacte ne
      // les voyait pas. Les omissions avérées de Claude font un ou deux mots : au-delà de huit, ce
      // n'est plus une omission mais un bloc lu ailleurs — signalé, jamais réinséré.
      if (o.a2 - o.a1 > 8) {
        desaccords.push({ tesseract: txt, claude: '' })
        continue
      }
      if (o.a2 - o.a1 >= 2 && dejaCouvert(txt)) continue
      if (vocabulaire && !txt.split(/\s+/).map(formeVocabulaire).filter(Boolean).every((w) => vocabulaire.has(w))) continue
      // Déjà chez Claude autant de fois que chez Tesseract : c'est un déplacement, pas une omission.
      if (occurrences(basePlate, plat(txt)) >= occurrences(tessPlate, plat(txt))) continue
      insertions.push({ pos: o.b1 > 0 ? H[o.b1 - 1].fin : 0, txt })
    } else if (o.op === 'remplace' && Math.max(o.a2 - o.a1, o.b2 - o.b1) >= 3) {
      desaccords.push({
        tesseract: T.slice(o.a1, o.a2).map((x) => x.mot).join(' '),
        claude: H.slice(o.b1, o.b2).map((x) => x.mot).join(' '),
      })
    }
  }
  let texte = base
  for (const { pos, txt } of [...insertions].sort((x, y) => y.pos - x.pos)) {
    texte = pos === 0 ? `${txt} ${texte}` : `${texte.slice(0, pos)} ${txt}${texte.slice(pos)}`
  }
  return { texte, reinseres: insertions.map((x) => x.txt), desaccords }
}
