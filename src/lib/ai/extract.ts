import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { GoogleGenAI } from '@google/genai'
// L'helper zod du SDK requiert l'API zod v4 (sous-chemin fourni par zod ≥ 3.25).
import { z } from 'zod/v4'
import { PDFDocument } from 'pdf-lib'
import { fold } from '../search/normalize'
import { heuristicKeywords, normalizeKeywords } from './keywords'
import { INDEX_CATEGORIES, type DocType, type IndexCategory } from '../types'
import { getProvider, isAiConfigured, resolveModel, parseGeminiJson } from './provider'

/**
 * Extraction intelligente (CMS §08). À partir des premières pages d'un document
 * téléversé, détecte sa NATURE (édition du Moniteur ou circulaire BRH) puis :
 *  - Moniteur : numéro de l'édition, type (régulière / numéro spécial), date de
 *    publication, et liste des TITRES de publications (le sommaire) — en
 *    distinguant les titres du corps de texte ;
 *  - Circulaire BRH : numéro de circulaire (entier), date, titre/objet, matière
 *    si déductible.
 *
 * Fournisseurs IA :
 *  - Anthropic (défaut) : Claude vision PDF native + thinking adaptatif.
 *  - Gemini (LV_AI_PROVIDER=gemini) : gemini-2.0-flash, tier GRATUIT disponible,
 *    vision PDF native ; sans thinking adaptatif (non requis pour l'extraction).
 *  - Heuristique : regex sur la couche texte — repli si aucune clé configurée.
 */

export { isAiConfigured } from './provider'

export const ExtractionSchema = z.object({
  documentKind: z
    .enum(['MONITEUR', 'CIRCULAIRE_BRH'])
    .describe(
      "MONITEUR pour une édition du journal officiel « Le Moniteur » ; CIRCULAIRE_BRH pour une circulaire de la Banque de la République d'Haïti (BRH)",
    ),
  moniteurNumber: z
    .string()
    .nullable()
    .describe(
      "Numéro de l'édition du Moniteur tel qu'imprimé (ex. « 35 », « 17 » pour un spécial) — sans le préfixe « No. » ; null si circulaire BRH",
    ),
  editionType: z
    .enum(['REGULIERE', 'SPECIALE'])
    .nullable()
    .describe("SPECIALE si l'en-tête porte « NUMÉRO SPÉCIAL » / « ÉDITION SPÉCIALE », sinon REGULIERE ; null si circulaire BRH"),
  publicationDate: z.string().nullable().describe('Date de publication (ou date de la circulaire) au format YYYY-MM-DD'),
  // En-tête du fascicule (méthodologie Le Moniteur — table « numero »)
  anneeParution: z
    .number()
    .int()
    .nullable()
    .describe("Année de parution / « … Année » du journal (ex. « 178e Année » ⇒ 178) — null si circulaire BRH ou absente"),
  directeurGeneral: z
    .string()
    .nullable()
    .describe("Nom du Directeur général mentionné dans l'ours / le bas de l'en-tête — null si absent"),
  issn: z.string().nullable().describe('ISSN du journal si imprimé (ex. 1683-2930) — null sinon'),
  ville: z.string().nullable().describe("Ville de publication (généralement « Port-au-Prince ») — null si absente"),
  publications: z
    .array(
      z.object({
        title: z.string().describe("Titre complet de la publication, orthographe corrigée si l'OCR est défectueux"),
        category: z
          .enum(['LOI', 'DECRET', 'ARRETE', 'AVIS', 'SOCIETE', 'MARQUE', 'CIRCULAIRE', 'AUTRE'])
          .describe('Nature juridique de la publication'),
        // Données structurées de société pour les AVIS commerciaux (SA/SARL…) —
        // alimentent l'index des sociétés. null pour les autres natures.
        societe: z
          .object({
            denomination: z.string().describe('Dénomination sociale exacte, ex. « PARA BELLUM S.A. »'),
            formeJuridique: z.string().nullable().describe('Forme juridique, ex. « Société Anonyme » — null si absente'),
            siegeSocial: z.string().nullable().describe('Siège social (commune/adresse) — null si absent'),
            nif: z.string().nullable().describe("Numéro d'identification fiscale (NIF/immatriculation DGI) — null si absent"),
            patente: z.string().nullable().describe('Numéro de patente — null si absent'),
            capital: z.number().nullable().describe('Capital social en chiffres (sans devise) — null si absent'),
            devise: z.string().nullable().describe('Devise du capital (ex. HTG, USD) — null si absente'),
            typeOperation: z
              .enum(['constitution', 'modification', 'dissolution'])
              .nullable()
              .describe("Nature de l'opération sociale publiée — null si indéterminée"),
            notaire: z.string().nullable().describe("Notaire instrumentant l'acte — null si absent"),
            dateActe: z.string().nullable().describe("Date de l'acte de société au format YYYY-MM-DD — null si absente"),
          })
          .nullable()
          .describe('Présent UNIQUEMENT si la publication est un AVIS de société (constitution/modification/dissolution) ; null sinon'),
      }),
    )
    .describe("Tous les titres de publications listés au sommaire / en première page, dans l'ordre ; liste vide si circulaire BRH"),
  circulaireNumber: z
    .number()
    .int()
    .nullable()
    .describe("Numéro de la circulaire BRH (entier, ex. 114) — null si le document n'est pas une circulaire"),
  circulaireTitle: z
    .string()
    .nullable()
    .describe("Titre ou objet de la circulaire BRH (ligne « Objet : … » ou intitulé), orthographe corrigée — null sinon"),
  matiere: z
    .string()
    .nullable()
    .describe("Matière juridique si déductible, ex. « Droit bancaire - Politique monétaire » — null si non déductible"),
  keywords: z
    .array(z.string())
    .describe(
      "5 à 10 mots-clés THÉMATIQUES en français pour l'indexation par thèmes (matières, notions, institutions, objets du texte), du plus au moins central ; courts (1 à 5 mots) ; minuscules sauf noms propres/sigles ; jamais le numéro ni la date du document",
    ),
})

export type ExtractionResult = z.infer<typeof ExtractionSchema>

/** Données structurées d'une société publiée en AVIS (méthodologie Le Moniteur). */
export interface SocieteData {
  denomination: string
  formeJuridique: string | null
  siegeSocial: string | null
  nif: string | null
  patente: string | null
  capital: number | null
  devise: string | null
  typeOperation: 'constitution' | 'modification' | 'dissolution' | null
  notaire: string | null
  dateActe: string | null
}

/** En-tête d'un fascicule du Moniteur (table « numero » de la méthodologie). */
export interface EditionMeta {
  anneeParution: number | null
  directeurGeneral: string | null
  issn: string | null
  ville: string | null
}

export interface ExtractOutcome {
  ai: boolean
  documentKind: 'MONITEUR' | 'CIRCULAIRE_BRH'
  edition: {
    moniteurNumber: string | null
    editionType: 'REGULIERE' | 'SPECIALE' | null
    publicationDate: string | null
    /** en-tête du fascicule (année de parution, directeur général, ISSN, ville) */
    meta: EditionMeta
  }
  circulaire: {
    number: number | null
    title: string | null
    matiere: string | null
  }
  /** mots-clés thématiques du document (indexation par thèmes) */
  keywords: string[]
  publications: { title: string; category: IndexCategory; type: DocType; societe: SocieteData | null }[]
}

const MAX_AI_PAGES = 4
// OCR intégral : transcription de toutes les pages d'un scan (plafonné pour borner le coût).
const MAX_OCR_PAGES = 40

/** Catégorie → service de texte intégral proposé par défaut dans le formulaire. */
export function categoryToDocType(category: IndexCategory): DocType {
  switch (category) {
    case 'MARQUE':
      return 'MARQUE'
    case 'CIRCULAIRE':
      return 'CIRCULAIRE_BRH'
    default:
      return 'LEGISLATION'
  }
}

// Tronque le PDF à ses premières pages (le sommaire vit en page 1) — limite le coût IA.
async function firstPagesBase64(pdfBytes: Uint8Array, pages = MAX_AI_PAGES): Promise<string> {
  const src = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const count = Math.min(pages, src.getPageCount())
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, Array.from({ length: count }, (_, i) => i))
  for (const p of copied) out.addPage(p)
  return out.saveAsBase64()
}

const PROMPT = `Tu es documentaliste juridique pour les sources officielles de la République d'Haïti.
Ce document est SOIT le début d'une édition du journal officiel « Le Moniteur », SOIT une circulaire de la Banque de la République d'Haïti (BRH). Détermine d'abord sa nature (documentKind) :
- CIRCULAIRE_BRH : l'en-tête porte « BANQUE DE LA RÉPUBLIQUE D'HAÏTI » (ou « BRH ») et un intitulé « CIRCULAIRE N° … » ; le document s'adresse aux banques et institutions financières.
- MONITEUR : en-tête du journal officiel « LE MONITEUR », numéro d'édition (« No. … »), sommaire de publications.

Si c'est une CIRCULAIRE BRH, extrais de la première page :
1. circulaireNumber : le numéro de la circulaire (entier, ex. « CIRCULAIRE N° 114 » ⇒ 114).
2. publicationDate : la date de la circulaire au format YYYY-MM-DD.
3. circulaireTitle : le titre ou l'objet (ligne « Objet : … » ou intitulé complet), orthographe corrigée.
4. matiere : la matière juridique si déductible du contenu (ex. « Droit bancaire - Politique monétaire », « Droit bancaire - Change », « Droit bancaire - LBC/FT ») ; null sinon.
Laisse moniteurNumber et editionType à null et publications vide.

Si c'est une édition du MONITEUR :
1. L'en-tête de la première page porte le numéro de l'édition (« No. … ») et sa date. Les éditions spéciales portent la mention « NUMÉRO SPÉCIAL » ou « ÉDITION SPÉCIALE ».
2. Remplis l'en-tête du fascicule : anneeParution (« 178e Année » ⇒ 178), directeurGeneral (nom du Directeur général dans l'ours), issn (ex. 1683-2930) et ville (généralement « Port-au-Prince ») — null pour ce qui est absent.
3. Le SOMMAIRE (ou la première page) liste les publications de l'édition : lois, décrets, arrêtés, avis (souvent des autorisations de fonctionnement de sociétés anonymes), extraits du registre des marques de fabrique et de commerce, circulaires, communiqués. Certains titres sont doublés en créole haïtien (« Arete ki… ») : ce sont des publications distinctes, garde-les.
4. Distingue soigneusement les TITRES de publications du corps de texte, des en-têtes de rubrique et des mentions d'éditeur. Un titre décrit un acte (« Arrêté nommant… », « Loi portant… », « Avis autorisant… »).
5. Pour chaque AVIS de société (constitution, modification de capital, dissolution d'une SA/SARL…), remplis l'objet « societe » avec les données structurées visibles (dénomination, forme juridique, siège, NIF/immatriculation, patente, capital en chiffres, devise, type d'opération, notaire, date de l'acte). Mets « societe » à null pour toute autre nature (loi, décret, arrêté, marque…).
6. Corrige l'orthographe évidente cassée par l'OCR (accents, espaces) sans réécrire le sens.
Laisse circulaireNumber, circulaireTitle et matiere à null.

Dans TOUS les cas, remplis keywords : 5 à 10 mots-clés thématiques en français pour l'indexation par thèmes (matières juridiques, notions, institutions, objets du texte), du plus au moins central, courts (1 à 5 mots), minuscules sauf noms propres et sigles (BRH, UCREF, KYC…) — jamais le numéro ni la date du document.
Rends le résultat structuré.`

// Appel Gemini résilient : sur 429 (limite par minute du tier gratuit), attend le
// délai indiqué par l'API (retryDelay) puis réessaie. Évite d'épuiser un lot à
// cause du débit ; n'aide pas si la limite QUOTIDIENNE est atteinte (échoue après
// les tentatives — il faut alors attendre la réinitialisation à minuit Pacifique).
async function geminiGenerate(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
): Promise<Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>> {
  const MAX_ATTEMPTS = 5
  for (let attempt = 1; ; attempt++) {
    try {
      return await ai.models.generateContent(params)
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e)
      const is429 = /\b429\b|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(msg)
      if (!is429 || attempt >= MAX_ATTEMPTS) throw e
      const m = msg.match(/retryDelay"?:?\s*"?(\d+)s/i)
      const waitMs = ((m ? Number(m[1]) : 30) + 2) * 1000
      await new Promise((r) => setTimeout(r, waitMs))
    }
  }
}

// ── Anthropic : extraction ──

async function anthropicExtract(pdfBytes: Uint8Array, model: string): Promise<ExtractionResult> {
  const client = new Anthropic()
  const data = await firstPagesBase64(pdfBytes)
  const response = await client.messages.parse({
    model,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(ExtractionSchema) },
  })
  if (!response.parsed_output) throw new Error('Extraction IA : sortie non analysable')
  return response.parsed_output
}

// ── Gemini : extraction ──

const GEMINI_EXTRACT_JSON_HINT = `

Réponds UNIQUEMENT en JSON valide selon cette structure (respecte les valeurs d'enum exactement) :
{
  "documentKind": "MONITEUR" | "CIRCULAIRE_BRH",
  "moniteurNumber": "35" | null,
  "editionType": "REGULIERE" | "SPECIALE" | null,
  "publicationDate": "2024-01-15" | null,
  "anneeParution": 178 | null,
  "directeurGeneral": "Nom Prénom" | null,
  "issn": "1683-2930" | null,
  "ville": "Port-au-Prince" | null,
  "publications": [{"title": "Arrêté nommant…", "category": "LOI"|"DECRET"|"ARRETE"|"AVIS"|"SOCIETE"|"MARQUE"|"CIRCULAIRE"|"AUTRE", "societe": null | {"denomination": "X S.A.", "formeJuridique": "Société Anonyme"|null, "siegeSocial": null, "nif": null, "patente": null, "capital": 5000000|null, "devise": "HTG"|null, "typeOperation": "constitution"|"modification"|"dissolution"|null, "notaire": null, "dateActe": "2022-12-22"|null}}],
  "circulaireNumber": 114 | null,
  "circulaireTitle": "Objet de la circulaire" | null,
  "matiere": "Droit bancaire - Politique monétaire" | null,
  "keywords": ["mot-clé 1", "mot-clé 2"]
}`

async function geminiExtract(pdfBytes: Uint8Array, model: string): Promise<ExtractionResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  const data = await firstPagesBase64(pdfBytes)
  const response = await geminiGenerate(ai, {
    model,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'application/pdf', data } },
          { text: PROMPT + GEMINI_EXTRACT_JSON_HINT },
        ],
      },
    ],
    config: { responseMimeType: 'application/json' },
  })
  const parsed = parseGeminiJson(response.text ?? '{}')
  const result = ExtractionSchema.safeParse(parsed)
  if (!result.success) throw new Error('Gemini extract : réponse invalide')
  return result.data
}

// ── OCR intégral ──

const OCR_PROMPT = `Tu es un moteur de reconnaissance de caractères (OCR) pour des documents juridiques officiels de la République d'Haïti (circulaires de la Banque de la République d'Haïti, Le Moniteur).
Transcris FIDÈLEMENT et INTÉGRALEMENT le texte de ce document, page après page, dans l'ordre.
Règles :
- Restitue le texte tel qu'il apparaît : ne résume pas, ne reformule pas, ne traduis pas.
- Corrige uniquement les césures de fin de ligne et les erreurs d'OCR manifestes (lettres mal reconnues, accents), sans changer le sens ni le vocabulaire.
- Conserve la structure : titres, numéros et intitulés d'articles, listes numérotées (garde le numéro d'origine), paragraphes (un saut de ligne entre les paragraphes).
- TEXTE BRUT UNIQUEMENT : n'utilise AUCUN Markdown (pas de « # », pas de « ## », pas de tableaux en « | … | », pas de « **gras** »). Pour un tableau, restitue chaque ligne en texte simple.
- Ignore les filigranes, tampons illisibles, numéros de page isolés et n'écris pas de marqueurs de page (« Page 3 », « ## Page 3 »).
- N'ajoute aucun commentaire, en-tête, légende ni note de ta part : restitue UNIQUEMENT le texte du document.`

/**
 * Nettoie une transcription OCR pour un stockage propre : retire les artefacts
 * Markdown (titres « ## », lignes de tableau « | … | »), les marqueurs et numéros
 * de page isolés, et normalise les sauts de ligne. Déterministe.
 */
export function cleanOcrText(raw: string): string {
  const lines = raw.replace(/\r/g, '').split('\n')
  const out: string[] = []
  for (let line of lines) {
    if (/^\s*#{1,6}\s*page\s+\d+\s*$/i.test(line)) continue // « ## Page 3 »
    if (/^\s*page\s+\d+\s*$/i.test(line)) continue // « Page 3 »
    if (/^\s*\d{1,4}\s*$/.test(line)) continue // numéro de page isolé
    if (/^\s*\|?[\s:|-]*\|[\s:|-]*\|?\s*$/.test(line) && /[-|]{3,}/.test(line)) continue // séparateur markdown |---|
    line = line.replace(/^\s*#{1,6}\s+/, '') // « ## Titre » → « Titre »
    if (/^\s*\|.*\|\s*$/.test(line)) line = line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').replace(/\s*\|\s*/g, '  ').trimEnd() // ligne de tableau → texte
    out.push(line)
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export interface OcrResult {
  text: string
  /** nombre de pages effectivement transcrites */
  pages: number
  /** true si le document dépassait MAX_OCR_PAGES (transcription partielle) */
  truncated: boolean
}

/**
 * Reconnaissance de texte d'un PDF numérisé via l'IA (vision PDF native).
 * Pour les documents sans couche texte exploitable. Nécessite ANTHROPIC_API_KEY
 * ou GEMINI_API_KEY selon LV_AI_PROVIDER.
 *
 * Note Gemini : limite de sortie ~8 192 tokens (≈ 24 pages denses). Les très
 * longs documents peuvent être tronqués — préférer Anthropic pour les scans longs.
 */
export async function ocrDocument(pdfBytes: Uint8Array): Promise<OcrResult> {
  if (!isAiConfigured()) throw new Error('OCR indisponible : aucune clé IA configurée')
  const src = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const total = src.getPageCount()
  const pages = Math.min(total, MAX_OCR_PAGES)
  const data = await firstPagesBase64(pdfBytes, pages)
  const model = resolveModel({ anthropic: 'claude-opus-4-8', gemini: 'gemini-2.0-flash' })

  if (getProvider() === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const response = await geminiGenerate(ai, {
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'application/pdf', data } },
            { text: OCR_PROMPT },
          ],
        },
      ],
      config: { maxOutputTokens: 65536 },
    })
    const text = cleanOcrText(response.text ?? '')
    return { text, pages, truncated: total > pages }
  }

  // Anthropic — transcription mécanique : effort bas, streaming.
  const client = new Anthropic()
  const stream = client.messages.stream({
    model,
    max_tokens: 64000,
    output_config: { effort: 'low' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
          { type: 'text', text: OCR_PROMPT },
        ],
      },
    ],
  })
  const message = await stream.finalMessage()
  const text = cleanOcrText(
    message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n'),
  )
  return { text, pages, truncated: total > pages }
}

// ── Extraction des tableaux & encadrés colorés (rendu visuel du PDF) ──

const RichCellSchema = z.object({
  text: z.string().describe('Contenu de la cellule, orthographe OCR corrigée (vide si cellule à remplir)'),
  header: z.boolean().nullable().describe("true si cellule d'en-tête"),
  colSpan: z.number().int().nullable().describe('Fusion horizontale (≥2), sinon null'),
  rowSpan: z.number().int().nullable().describe('Fusion verticale (≥2), sinon null'),
  bg: z.string().nullable().describe('Couleur de fond en hex (#rrggbb) approchant la teinte vue, sinon null'),
  color: z.string().nullable().describe('Couleur du texte en hex, sinon null'),
  align: z.enum(['left', 'center', 'right']).nullable(),
  bold: z.boolean().nullable(),
})

const RichBlockSchema = z.object({
  type: z.enum(['table', 'note']).describe('table = tableau ; note = encadré/cartouche coloré'),
  caption: z.string().nullable().describe("Légende du tableau si distincte d'un titre déjà dans le texte, sinon null"),
  text: z.string().nullable().describe("Texte de l'encadré (type=note), sinon null"),
  bg: z.string().nullable().describe("Fond de l'encadré en hex (type=note)"),
  color: z.string().nullable(),
  afterText: z
    .string()
    .nullable()
    .describe('Extrait VERBATIM (copié du TEXTE DU DOCUMENT fourni) des ~8-15 mots situés JUSTE AVANT le bloc, pour le repositionner'),
  untilText: z
    .string()
    .nullable()
    .describe('Extrait VERBATIM (copié du TEXTE fourni) des ~8-15 mots situés JUSTE APRÈS le bloc (où le texte normal reprend)'),
  rows: z.array(z.array(RichCellSchema)).nullable().describe('Lignes du tableau (type=table) ; chaque ligne = tableau de cellules'),
})

export const RichTablesSchema = z.object({
  blocks: z.array(RichBlockSchema).describe("Tous les tableaux et encadrés colorés du document, dans l'ordre d'apparition"),
})

const RICH_PROMPT = `Tu es documentaliste juridique. Reproduis FIDÈLEMENT les TABLEAUX et les ENCADRÉS colorés (cartouches, notes sur fond teinté) de ce document officiel haïtien, tels qu'ils apparaissent VISUELLEMENT.

Pour CHAQUE tableau (type "table") :
- rows : la grille complète, ligne par ligne, chaque cellule avec son texte (orthographe OCR corrigée, sans rien réécrire d'autre) ; marque les cellules d'en-tête (header=true) ; renseigne colSpan/rowSpan pour les cellules fusionnées ; align si le contenu est centré/à droite.
- COULEURS : pour toute cellule sur fond teinté (en-têtes ombrés, totaux, etc.), donne bg en hex approchant la teinte réelle (gris clair ≈ #d9d9d9, bleu pâle ≈ #dce6f1, vert pâle ≈ #e2efda…). Laisse bg null pour le blanc.
- caption : seulement si le tableau a un titre qui n'est PAS déjà une ligne de texte juste avant (sinon null, pour éviter les doublons).

Pour CHAQUE encadré coloré (type "note") : text = son contenu, bg = sa couleur de fond en hex.

PLACEMENT (essentiel) : pour chaque bloc, copie dans afterText un extrait EXACT et VERBATIM (tel quel, accents et fautes d'OCR compris) du TEXTE DU DOCUMENT fourni ci-dessous, correspondant aux ~8-15 mots situés juste AVANT le bloc ; et dans untilText l'extrait EXACT des ~8-15 mots situés juste APRÈS le bloc (là où le texte courant reprend). Ces ancres servent à replacer le bloc dans le flux : elles DOIVENT être des copies littérales du texte fourni, pas une paraphrase.

N'invente aucune donnée : les cellules à remplir restent vides. Ne renvoie QUE les tableaux et encadrés (pas les paragraphes ordinaires).

TEXTE DU DOCUMENT (couche OCR, pour les ancres afterText/untilText) :
"""
{BODY}
"""`

export interface RichExtractionResult {
  blocks: unknown[]
  pages: number
}

const GEMINI_RICH_JSON_HINT = `

Réponds UNIQUEMENT en JSON valide : {"blocks": [{"type": "table"|"note", "caption": null, "text": null, "bg": null, "color": null, "afterText": "...", "untilText": "...", "rows": [[{"text": "...", "header": true|false|null, "colSpan": null, "rowSpan": null, "bg": "#d9d9d9"|null, "color": null, "align": "left"|"center"|"right"|null, "bold": null}]]}]}`

/**
 * Extraction des tableaux et encadrés colorés d'un PDF via l'IA (vision PDF).
 * `bodyText` (couche OCR du document) est fourni au modèle pour des ancres
 * afterText/untilText littérales (src/lib/doc/richblocks.ts → buildBodySegments).
 * Nécessite ANTHROPIC_API_KEY ou GEMINI_API_KEY selon LV_AI_PROVIDER.
 */
export async function extractRichTables(pdfBytes: Uint8Array, bodyText: string): Promise<RichExtractionResult> {
  if (!isAiConfigured()) throw new Error('Extraction des tableaux indisponible : aucune clé IA configurée')
  const src = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const pages = Math.min(src.getPageCount(), MAX_OCR_PAGES)
  const data = await firstPagesBase64(pdfBytes, pages)
  const prompt = RICH_PROMPT.replace('{BODY}', bodyText.slice(0, 60_000))
  const model = resolveModel({ anthropic: 'claude-opus-4-8', gemini: 'gemini-2.0-flash' })

  if (getProvider() === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const response = await geminiGenerate(ai, {
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'application/pdf', data } },
            { text: prompt + GEMINI_RICH_JSON_HINT },
          ],
        },
      ],
      config: { responseMimeType: 'application/json', maxOutputTokens: 65536 },
    })
    // Tolérant : on garde les blocs bruts (un champ manquant/atypique ne doit pas
    // tout jeter) — le nettoyage/validation final vit dans parseRichBlocks
    // (src/lib/doc/richblocks.ts), appliqué avant stockage et affichage.
    const parsed = parseGeminiJson(response.text ?? '{"blocks":[]}') as { blocks?: unknown }
    const blocks = Array.isArray(parsed?.blocks) ? parsed.blocks : []
    return { blocks, pages }
  }

  // Anthropic
  const client = new Anthropic()
  const response = await client.messages.parse({
    model,
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
          { type: 'text', text: prompt },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(RichTablesSchema) },
  })
  const blocks = response.parsed_output?.blocks ?? []
  return { blocks, pages }
}

// ── Repli heuristique (sans clé API) — regex sur la couche texte ──

const TITLE_START =
  /^(loi|décret|decret|arrêté|arrete|arrêtés|avis|extraits? du registre|circulaire|communiqué|communique|décision|decision|ordonnance|aret[eè]|lwa|dekr[eè]|kominike)/i

function lineCategory(line: string): IndexCategory {
  const f = fold(line)
  if (f.includes('marque') && (f.includes('fabrique') || f.includes('commerce'))) return 'MARQUE'
  if (f.includes('societe anonyme') || f.includes('societes anonymes')) return 'SOCIETE'
  if (f.startsWith('circulaire')) return 'CIRCULAIRE'
  if (f.startsWith('loi') || f.startsWith('lwa')) return 'LOI'
  if (f.startsWith('decret') || f.startsWith('dekr')) return 'DECRET'
  if (f.startsWith('arret') || f.startsWith('aret')) return 'ARRETE'
  if (f.startsWith('avis')) return 'AVIS'
  return 'AUTRE'
}

const FR_MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
}

/** Détection légère d'une société à partir du titre d'un AVIS (repli sans IA). */
export function parseSocieteFromTitle(title: string): SocieteData | null {
  const f = fold(title)
  if (!/soci[ée]t[ée]|\bs\.?a\.?\b|\bsarl\b|\bdenomm/.test(f)) return null
  // « … dénommée : "PARA BELLUM S.A." … » ou « … société anonyme PARA BELLUM S.A. »
  const quoted = title.match(/[«"“]([^»"”\n]{2,80})[»"”]/)
  const named = title.match(/d[ée]nomm[ée]e?\s*:?\s*([A-ZÀ-Ü0-9][^,\n.]{2,80})/)
  const denomination = (quoted?.[1] ?? named?.[1] ?? '').trim()
  if (!denomination) return null
  let typeOperation: SocieteData['typeOperation'] = null
  if (/dissol/.test(f)) typeOperation = 'dissolution'
  else if (/modif|augmentation|capital|fusion/.test(f)) typeOperation = 'modification'
  else if (/constitu|fonctionnement|autoris/.test(f)) typeOperation = 'constitution'
  return {
    denomination,
    formeJuridique: /\bs\.?a\.?\b|anonyme/.test(f) ? 'Société Anonyme' : null,
    siegeSocial: null,
    nif: null,
    patente: null,
    capital: null,
    devise: null,
    typeOperation,
    notaire: null,
    dateActe: null,
  }
}

export function heuristicExtract(firstPageText: string): ExtractionResult {
  const text = firstPageText.slice(0, 12000)
  const f = fold(text)

  // ── Circulaire BRH ? — en-tête BRH + intitulé « CIRCULAIRE N° … » ──
  const circMatch = f.match(/circulaire\s+n[°ºo]?\s*\.?\s*(\d+)/)
  const brhHeader = /banque de la republique d'?haiti|\bbrh\b/.test(f)
  if (circMatch && brhHeader) {
    const num = Number(circMatch[1])
    const dateM = f.match(/(\d{1,2})(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(\d{4})/)
    const objetM = text.match(/objet\s*:\s*([^\n]{4,300})/i)
    return {
      documentKind: 'CIRCULAIRE_BRH',
      moniteurNumber: null,
      editionType: null,
      publicationDate: dateM
        ? `${dateM[3]}-${String(FR_MONTHS[dateM[2]]).padStart(2, '0')}-${String(Number(dateM[1])).padStart(2, '0')}`
        : null,
      anneeParution: null,
      directeurGeneral: null,
      issn: null,
      ville: null,
      publications: [],
      circulaireNumber: Number.isFinite(num) ? num : null,
      circulaireTitle: objetM ? objetM[1].replace(/\s+/g, ' ').trim() : `Circulaire BRH n° ${num}`,
      matiere: null,
      keywords: heuristicKeywords({ body: text }),
    }
  }

  const special = /numero special|edition speciale/.test(f)
  const numMatch = text.match(/N[oº°]\s*\.?\s*(\d+[A-Z]?)/i)
  const dateMatch = f.match(/(\d{1,2})(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(\d{4})/)
  let publicationDate: string | null = null
  if (dateMatch) {
    const [, d, m, y] = dateMatch
    publicationDate = `${y}-${String(FR_MONTHS[m]).padStart(2, '0')}-${String(Number(d)).padStart(2, '0')}`
  }

  const lines = text.split(/\n+/).map((l) => l.replace(/\s+/g, ' ').trim())
  const titles: string[] = []
  let current: string | null = null
  for (const line of lines) {
    if (line.length < 4) continue
    if (TITLE_START.test(line)) {
      if (current) titles.push(current)
      current = line
    } else if (current && /^[a-zà-ÿ0-9«"(]/.test(line) && current.length < 400) {
      current = `${current} ${line}`
    } else if (current) {
      titles.push(current)
      current = null
    }
  }
  if (current) titles.push(current)

  // En-tête : « 178e Année » et ISSN si présents.
  const anneeM = f.match(/(\d{1,3})\s*e?\s*ann[ée]e/)
  const issnM = text.match(/issn\s*:?\s*([\dX-]{8,12})/i)
  const villeM = /port-au-prince/.test(f) ? 'Port-au-Prince' : null

  return {
    documentKind: 'MONITEUR',
    moniteurNumber: numMatch?.[1] ?? null,
    editionType: special ? 'SPECIALE' : numMatch ? 'REGULIERE' : null,
    publicationDate,
    anneeParution: anneeM ? Number(anneeM[1]) : null,
    directeurGeneral: null,
    issn: issnM ? issnM[1] : null,
    ville: villeM,
    publications: titles.slice(0, 60).map((title) => {
      const category = lineCategory(title)
      return { title, category, societe: category === 'SOCIETE' || category === 'AVIS' ? parseSocieteFromTitle(title) : null }
    }),
    circulaireNumber: null,
    circulaireTitle: null,
    matiere: null,
    keywords: heuristicKeywords({ body: text }),
  }
}

/** Forme commune de la réponse (IA ou heuristique) consommée par l'UploadStudio. */
export function toOutcome(result: ExtractionResult, ai: boolean): ExtractOutcome {
  return {
    ai,
    documentKind: result.documentKind,
    edition: {
      moniteurNumber: result.moniteurNumber,
      editionType: result.editionType,
      publicationDate: result.publicationDate,
      meta: {
        anneeParution: result.anneeParution ?? null,
        directeurGeneral: result.directeurGeneral ?? null,
        issn: result.issn ?? null,
        ville: result.ville ?? null,
      },
    },
    circulaire: {
      number: result.circulaireNumber,
      title: result.circulaireTitle,
      matiere: result.matiere,
    },
    keywords: normalizeKeywords(result.keywords),
    publications: result.publications.map((p) => {
      const category = (INDEX_CATEGORIES as readonly string[]).includes(p.category)
        ? (p.category as IndexCategory)
        : 'AUTRE'
      return {
        title: p.title,
        category,
        type: categoryToDocType(category),
        societe: p.societe ?? null,
      }
    }),
  }
}

/** Point d'entrée : IA (Anthropic ou Gemini) si configurée, heuristique sinon. */
export async function extractDocument(pdfBytes: Uint8Array, firstPageText: string): Promise<ExtractOutcome> {
  if (isAiConfigured()) {
    const model = resolveModel({ anthropic: 'claude-opus-4-8', gemini: 'gemini-2.0-flash' })
    return toOutcome(
      getProvider() === 'gemini' ? await geminiExtract(pdfBytes, model) : await anthropicExtract(pdfBytes, model),
      true,
    )
  }
  return toOutcome(heuristicExtract(firstPageText), false)
}
