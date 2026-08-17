/**
 * Lecture de la ligne « Composition » d'un sommaire de recueil.
 *
 * Trois gabarits coexistent dans le recueil 1964-1965, et ils ne se distinguent pas au
 * premier coup d'œil :
 *
 *   A. « Composition : Luc Boivert, Président ; Ludovic Magloire, …, Juges
 *        — Ministère Public : Anthony Rivière, Substitut du Commissaire du Gouvernement »
 *   B. « Composition : Félix Diambois, Vice-Président ; Léonce Pierre-Antoine, … et André
 *        Rousseau, Juges. Ministère Public : Catinat Sansaricq, Substitut…, présent au
 *        prononcé ; conclusions lues à l'audience du 6 octobre 1964 par Jh. Marthyl St
 *        Julien, Commissaire du Gouvernement. Greffe : Joseph Lucien, Commis-Greffier. »
 *   C. « Luc BOIVERT (Président), Ludovic MAGLOIRE, … et André ROUSSEAU, Juges
 *        — Ministère Public : Max DUPLESSY, Substitut… — Greffe : Clément ROMULUS,
 *        Commis-Greffier. »
 *   D. « Composition du siège : Ludovic Magloire, Juge, faisant fonction de Président,
 *        Louis B. Vilgrain, … et Louis Banatte, Juges — en présence de M. Arsène Amisial,
 *        Substitut…, avec l'assistance de M. Clément Romulus, Commis-Greffier. »
 *
 * ⚠️ LE GABARIT D N'ÉTIQUETTE RIEN. 33 compositions de la Première Section n'écrivent ni
 * « Ministère Public : » ni « Greffe : » : elles disent « en présence de M. X » et « avec
 * l'assistance de M. Y », et séparent la présidence des juges par une simple VIRGULE. Un
 * analyseur qui cherche le point-virgule et les deux-points ne voit rien de ces 33 lignes —
 * il en fait un magistrat nommé « Juges — en présence de M. Arsène Amisial ».
 *
 * ⚠️ LA DEUXIÈME SECTION EST PRÉSIDÉE PAR UN VICE-PRÉSIDENT. 78 compositions sur 133 le
 * disent. Le rôle n'a pas été inventé pour la circonstance : il est relevé du recueil, et
 * l'écrire « Président » serait une inexactitude sur la formation.
 *
 * ⚠️ LE MINISTÈRE PUBLIC PORTE DE LA PROSE, ET CETTE PROSE NOMME D'AUTRES MAGISTRATS.
 * « conclusions lues à l'audience du 6 octobre 1964 par Jh. Marthyl St Julien » désigne
 * quelqu'un qui n'a pas siégé. On ne retient donc comme membre que le nom EN TÊTE de
 * chaque segment ; tout le reste part dans `note`, intact, et s'affiche tel quel. Émietter
 * cette prose en noms attribuerait des arrêts à des magistrats qui ne les ont pas rendus —
 * et rien à l'écran ne le montrerait.
 *
 * ⚠️ TOUTE PARENTHÈSE FINALE N'EST PAS UN NOM. « (Le prononcé porte par erreur "Mil Neuf
 * Cent Quatre-Vingt-Quatre" pour Soixante-Quatre.) » suit le greffier dans le gabarit C.
 * D'où le garde-fou `ressembleAUnNom`, et un avertissement — jamais un silence — pour tout
 * fragment écarté.
 */

export type RoleSiege =
  | 'PRESIDENT'
  | 'VICE_PRESIDENT'
  | 'PRESIDENT_FF'
  | 'JUGE'
  | 'MINISTERE_PUBLIC'
  | 'GREFFE'

export interface Membre {
  /** Graphie de CE recueil-là — « Louis B. VILGRAIN » ici, « Louis VILGRAIN » ailleurs. */
  nameAsWritten: string
  role: RoleSiege
  position: number
  /** Qualité littérale : « Substitut du Commissaire du Gouvernement », « Commis-Greffier ». */
  qualite: string | null
}

export interface Composition {
  membres: Membre[]
  /** Ce que le recueil dit en plus des noms — conclusions, réquisitoires, mentions. */
  note: string | null
  avertissements: string[]
}

/** Rôle de présidence, dans les graphies relevées. */
const PRESIDENCE: [RegExp, RoleSiege][] = [
  // ⚠️ Le « Juge, » qui précède d'ordinaire est parfois absent — « Frédéric ROBINSON,
  // faisant fonction de Président » — et le recueil écrit aussi « faisant OFFICE de ».
  [/^(?:juge\s*,?\s*)?(?:faisant\s+(?:fonction|office)|remplissant les fonctions)\s+de\s+pr[ée]sident/i, 'PRESIDENT_FF'],
  [/^vice-?pr[ée]sident/i, 'VICE_PRESIDENT'],
  [/^pr[ée]sident/i, 'PRESIDENT'],
]

/**
 * Clé de rapprochement : minuscules, sans accents, sans initiales ni ponctuation, avec les
 * abréviations usuelles développées. « Ulrick Is. NOEL », « Ulrick IS. NOEL » et
 * « Ulrick Noël » partagent « noel ulrick » ; « ST JULIEN » rejoint « Saint-Julien ».
 *
 * ⚠️ ELLE SUGGÈRE, ELLE NE DÉCIDE PAS. Deux magistrats peuvent porter le même nom : c'est
 * à la rédaction de confirmer un rapprochement, jamais à cette fonction.
 */
export function cleMagistrat(nom: string): string {
  return motsMagistrat(nom).sort().join(' ')
}

/**
 * Les mots significatifs d'un nom, normalisés — la matière première de `cleMagistrat`.
 *
 * ⚠️ LA RECHERCHE PAR MAGISTRAT DOIT NORMALISER EXACTEMENT COMME LA CLÉ. Chercher
 * « Noel » alors que la base porte « Ulrick Is. NOËL » ne doit pas échouer sur un accent.
 * Les deux fonctions partagent donc ce corps : les laisser diverger rendrait des
 * magistrats introuvables sans que rien ne le signale.
 */
export function motsMagistrat(nom: string): string[] {
  return recoller(nom)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bst\b\.?/g, 'saint')
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter((m) => m.length > 2) // « Is. », « B. », « J. », « Jh. » : initiales écartées
}

/**
 * ⚠️ LA PAGINATION DU RECUEIL COUPE LES NOMS EN DEUX. « Félix DIAM- ( 3 ) BOIS » est
 * Félix DIAMBOIS, séparé par le numéro de page imprimé au milieu de la ligne. Sans
 * recollage, il devient un magistrat de plus, portant un seul arrêt.
 */
export function recoller(nom: string): string {
  return nom.replace(/-\s*\(\s*\d+\s*\)\s*/g, '').replace(/\s+/g, ' ').trim()
}

/** Mots de rôle qui closent une énumération : ils étiquettent, ils ne nomment personne. */
const ETIQUETTE_DE_ROLE = /^(?:juges?|conseillers?|magistrats?|membres?|soussign[ée]e?s?|pr[ée]sidents?|vice-?pr[ée]sidents?)$/i

/** Un nom de magistrat : deux mots au moins, pas de chiffre, pas une phrase. */
function ressembleAUnNom(x: string): boolean {
  const s = x.trim()
  if (s.length < 4 || s.length > 60) return false
  if (/\d/.test(s)) return false
  if (/\b(audience|conclusions|r[ée]quisitoire|pronon|erreur|lecture|lues?|lu par)\b/i.test(s)) return false
  return /^[A-ZÉÈÊÎÔÛÄÖÜ]/.test(s) && s.split(/\s+/).length >= 2
}

/** Sépare « A, B, C et D » — sans couper « Jh. Marthyl St Julien ». */
function separerNoms(x: string): string[] {
  // Recollage AVANT le découpage : « Félix DIAM- ( 3 ) BOIS » doit redevenir un nom avant
  // qu'on lui demande s'il en est un — le numéro de page le faisait rejeter comme chiffré.
  return recoller(x)
    .split(/\s*[,;]\s*|\s+et\s+/i)
    .map((s) => s.trim().replace(/^(?:et|le|la)\s+/i, '').replace(/[.\s]+$/, ''))
    .filter(Boolean)
}

/** Retire l'étiquette de tête (« Composition : », « Composition du siège : »). */
function sansEtiquette(ligne: string): string {
  return ligne.replace(/^\s*composition(?:\s+du\s+si[èe]ge)?\s*[:—–-]?\s*/i, '').trim()
}

/**
 * Découpe la ligne en trois segments — siège, ministère public, greffe — quel que soit le
 * séparateur du gabarit (tiret cadratin, point, point-virgule).
 */
const RE_MP = /(?:minist[èe]re\s+public|min\.\s*public)\s*:|[—–-]?\s*en\s+pr[ée]sence\s+de\s+/i
const RE_GREFFE = /greffe\s*:|(?:avec\s+l['’]assistance|assist[ée]s?)\s+de\s+/i

function segmenter(x: string) {
  const iMp = x.search(RE_MP)
  const iGr = x.search(RE_GREFFE)
  const bornes = [iMp, iGr].filter((i) => i >= 0).sort((a, b) => a - b)
  const finSiege = bornes.length ? bornes[0] : x.length
  const coupe = (debut: number) => {
    if (debut < 0) return ''
    const suivantes = [iMp, iGr].filter((i) => i > debut)
    return x.slice(debut, suivantes.length ? Math.min(...suivantes) : x.length)
  }
  return {
    siege: x.slice(0, finSiege).replace(/\s*[—–-]\s*$/, '').replace(/[.\s;]+$/, '').trim(),
    mp: coupe(iMp).replace(RE_MP, '').replace(/\s*[—–-]\s*$/, '').trim(),
    greffe: coupe(iGr).replace(RE_GREFFE, '').replace(/\s*[—–-]\s*$/, '').trim(),
  }
}

/**
 * Le premier segment d'une prose de ministère public ou de greffe : « Catinat Sansaricq,
 * Substitut du Commissaire du Gouvernement, présent au prononcé ; conclusions lues… »
 * rend le nom, la qualité, et le reste — qui n'est pas émietté.
 */
function tete(x: string): { nom: string; qualite: string | null; reste: string | null } {
  const v = x.replace(/\s+/g, ' ').replace(/^(?:M\.|Mme|Me|Monsieur|Madame)\s+/i, '').trim()
  const i = v.indexOf(',')
  if (i < 0) return { nom: v.replace(/[.\s]+$/, ''), qualite: null, reste: null }
  const nom = v.slice(0, i).trim()
  const apres = v.slice(i + 1).trim()
  // La qualité s'arrête à la première ponctuation forte ou parenthèse : au-delà, c'est
  // de la prose sur le déroulé de l'audience, pas sur la personne.
  const j = apres.search(/[;(]|,\s*(?=pr[ée]sent|conclusions|r[ée]quisitoire)/i)
  const qualite = (j < 0 ? apres : apres.slice(0, j)).replace(/[.\s]+$/, '').trim()
  // La virgule ou le point-virgule qui BORNE la qualité n'appartient pas à la suite :
  // « , présent au prononcé » se lirait tel quel sur la fiche.
  const reste = j < 0 ? null : apres.slice(j).replace(/^[,;\s]+/, '').replace(/[.\s]+$/, '').trim()
  return { nom, qualite: qualite || null, reste: reste || null }
}

export function lireComposition(ligne: string): Composition {
  const membres: Membre[] = []
  const avertissements: string[] = []
  const notes: string[] = []
  const brut = sansEtiquette(ligne)
  if (!brut) return { membres, note: null, avertissements }

  const { siege, mp, greffe } = segmenter(brut)
  const ajouter = (nom: string, role: RoleSiege, qualite: string | null, ou: string) => {
    if (!ressembleAUnNom(nom)) {
      // ⚠️ UN MOT DE RÔLE N'EST PAS UN FRAGMENT PERDU. « …, André ROUSSEAU et Max DUPLESSY,
      // Juges, » laisse « Juges » en dernier segment : il est écarté à juste titre, et le
      // signaler produisait 97 avertissements identiques sur 82 arrêts — de quoi noyer les
      // deux qui comptaient. On se tait sur ce qu'on sait écarter.
      if (nom.trim() && !ETIQUETTE_DE_ROLE.test(nom.trim()))
        avertissements.push(`${ou} — fragment écarté : « ${nom.trim().slice(0, 70)} »`)
      return
    }
    membres.push({ nameAsWritten: recoller(nom).trim(), role, position: membres.length, qualite })
  }

  // --- Le siège -----------------------------------------------------------------------
  // Gabarit C : la présidence est entre parenthèses, collée au nom.
  const parenth = /^(.+?)\s*\((pr[ée]sident|vice-?pr[ée]sident)e?\)\s*,?\s*/i.exec(siege)
  let restantSiege = siege
  if (parenth) {
    ajouter(parenth[1], /vice/i.test(parenth[2]) ? 'VICE_PRESIDENT' : 'PRESIDENT', parenth[2], 'siège')
    restantSiege = siege.slice(parenth[0].length)
  } else {
    // Gabarits A, B et D : « NOM, Rôle <séparateur> les autres, Juges ». Le séparateur
    // varie — point-virgule (A, B) ou simple virgule (D) : c'est le RÔLE qui borne la
    // présidence, pas la ponctuation. Se fier au point-virgule laissait 33 compositions
    // de la Première Section entièrement illisibles.
    const virg = restantSiege.indexOf(',')
    if (virg > 0) {
      const nom = restantSiege.slice(0, virg)
      const apres = restantSiege.slice(virg + 1).trimStart()
      const trouve = PRESIDENCE.map(([re, role]) => ({ m: re.exec(apres), role })).find((h) => h.m)
      if (trouve) {
        ajouter(nom, trouve.role, trouve.m![0], 'siège')
        // Une parenthèse éditoriale peut suivre le rôle — « Président (graphie de la
        // source ; lecture à vérifier) » : elle appartient à la note, pas au siège.
        // « Vice-Président de la Cour » : la qualité peut se prolonger sans virgule.
        restantSiege = apres.slice(trouve.m![0].length).replace(/^\s*(?:de\s+la\s+Cour)?\s*(\([^)]*\))?\s*[;,]?\s*/, (t) => {
          const par = /\(([^)]*)\)/.exec(t)
          if (par) notes.push(par[1].trim())
          return ''
        })
      } else {
        avertissements.push(`siège — présidence non reconnue : « ${apres.slice(0, 70)} »`)
      }
    }
  }
  // Toute parenthèse restante dans le siège — « Juges (« Ainsi décidé ») » — est une
  // mention du recueil, pas un magistrat.
  restantSiege = restantSiege.replace(/\(([^)]*)\)/g, (_, t) => { notes.push(String(t).trim()); return ' ' })
  // Le reste du siège, ce sont les juges : « A, B, C et D, Juges ».
  const qualiteJuges = /,\s*(juges?)\s*\.?\s*$/i.exec(restantSiege)?.[1] ?? null
  for (const nom of separerNoms(restantSiege.replace(/,\s*juges?\s*\.?\s*$/i, ''))) {
    ajouter(nom, 'JUGE', qualiteJuges, 'siège')
  }

  // --- Le ministère public et le greffe -----------------------------------------------
  for (const [seg, role, ou] of [
    [mp, 'MINISTERE_PUBLIC' as RoleSiege, 'ministère public'],
    [greffe, 'GREFFE' as RoleSiege, 'greffe'],
  ] as const) {
    if (!seg) continue
    const { nom, qualite, reste } = tete(seg)
    ajouter(nom, role, qualite, ou)
    if (reste) notes.push(reste)
  }

  return { membres, note: notes.length ? notes.join(' · ') : null, avertissements }
}

/**
 * La ligne de composition d'un ARRÊT, tirée de sa formule de clôture.
 *
 * Les recueils sans sommaire analytique — celui de l'exercice 1965-1966 — ne portent aucune
 * ligne « Composition : ». La formation se lit dans l'arrêt lui-même :
 *
 *   « Ainsi jugé et prononcé par Nous, Frédéric ROBINSON, Président, Louis B. VILGRAIN,
 *     Ulrick Is. NOEL, André ROUSSEAU et Max DUPLESSY, Juges, en audience publique du
 *     Dix-Sept Novembre Mil Neuf Cent Soixante-Cinq, en présence de Monsieur Anthony
 *     RIVIERE, Substitut du Commissaire du Gouvernement et assistés de Monsieur Clément
 *     ROMULUS, Commis-Greffier.- »
 *
 * Débarrassée de son en-tête et de sa clause d'audience, cette phrase EST le gabarit D, que
 * `lireComposition` sait déjà lire. On ne réécrit donc pas d'analyseur : on prépare la ligne.
 *
 * ⚠️ LA CLAUSE D'AUDIENCE DOIT PARTIR, et pas seulement pour faire propre. Laissée en place,
 * « en audience publique du Dix-Sept Novembre Mil Neuf Cent Soixante-Cinq » se présente au
 * découpage des noms comme un segment de plus — une date en toutes lettres ne porte aucun
 * chiffre qui la trahirait.
 *
 * ⚠️ L'INVARIANT EST « PRONONCÉ PAR NOUS », PAS « AINSI JUGÉ » : un arrêt sur 82 ouvre sa
 * formule sans « Ainsi jugé ». Et l'on retient la DERNIÈRE formule du texte — un arrêt cite
 * parfois celle de la décision qu'il casse.
 */
export function ligneCompositionDeLArret(texte: string): string | null {
  const t = (texte ?? '').replace(/\s+/g, ' ')
  // ⚠️ DEUX FORMULES, ET LA SECONDE EST INVERSÉE. La plupart des arrêts écrivent « prononcé
  // par Nous, <noms>, en audience publique du <date> » ; un autre écrit « rendu en audience
  // publique du <date>, par Nous, <noms> ». Sans le second ancrage, sa formation est perdue.
  const ancres = [...t.matchAll(/(?:ainsi\s+(?:jug|d[ée]lib)[ée]r?[ée]e?\s+et\s+)?prononc[ée]e?\s+par\s+nous\s*,?\s*/gi)]
  const secours = ancres.length ? [] : [...t.matchAll(/\bpar\s+nous\s*,\s*/gi)]
  const a = (ancres.length ? ancres : secours)[Math.max(0, (ancres.length ? ancres : secours).length - 1)]
  if (!a) return null
  // Bornes de fin : les formules de clôture du greffe, qui ne nomment personne.
  let s = t.slice(a.index + a[0].length).split(/\bIl est ordonn[ée]|\bEn foi de quoi/i)[0]
  const iAud = s.search(/(?:[àa]|en)\s+l?['’]?\s*audience/i)
  if (iAud >= 0) {
    const apres = s.slice(iAud).search(/en\s+pr[ée]sence\s+de|avec\s+l['’]assistance|assist[ée]e?s?\s+de/i)
    s = apres >= 0 ? `${s.slice(0, iAud)}, ${s.slice(iAud + apres)}` : s.slice(0, iAud)
  }
  return s
    // « par Nous, soussignés, Félix DIAMBOIS, Vice-Président… » : le mot n'est pas un nom,
    // et placé en tête il se présentait au lecteur comme le président de la formation.
    .replace(/^soussign[ée]e?s?\s*,?\s*/i, '')
    .replace(/\s*,\s*,\s*/g, ', ')
    .replace(/[,;.\s-]+$/, '')
    .trim() || null
}
