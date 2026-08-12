import mammoth from 'mammoth'

/**
 * Extrait les paragraphes d'un .docx, pour l'analyseur de recueil.
 *
 * ⚠️ On emploie `mammoth`, DÉJÀ dépendance du projet (voir `src/lib/word.ts` et la route
 * de téléversement) — pas de nouvelle bibliothèque pour lire un zip.
 *
 * ⚠️ `extractRawText` rend un paragraphe par ligne, TABULATIONS COMPRISES. Les convertir
 * en espace : sans cela les colonnes d'un tableau restent collées, piège déjà rencontré
 * sur ce dépôt (les extracteurs maison ignoraient `<w:tab/>` et soudaient les colonnes
 * du Journal officiel).
 */
export async function paragraphesDuDocx(buf: Buffer): Promise<string[]> {
  if (buf.subarray(0, 2).toString('latin1') !== 'PK') {
    throw new Error('notDocx')
  }
  const { value } = await mammoth.extractRawText({ buffer: buf })
  return value
    .split('\n')
    .map((l) => l.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}
