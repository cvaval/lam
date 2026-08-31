/**
 * CODE DES INVESTISSEMENTS — POSER LES PASTILLES « MODIFIÉ » DES LOIS DE FINANCES.
 *
 *     npx tsx scripts/pastilles-code-investissements.ts            # simulation
 *     npx tsx scripts/pastilles-code-investissements.ts --apply    # Me Vaval, elle seule
 *
 * ─── CE QUE L'AUDIT A TROUVÉ ───────────────────────────────────────────────────────────────
 * Le Code des investissements a été versé le 30 août dans sa rédaction de 2002, sans une pastille.
 * Or CINQ lois de finances du corpus (exercices 2020-2021, 2021-2022, 2023-2024, 2024-2025 et
 * 2025-2026) le modifient NOMMÉMENT — « L'article 28 de la Loi du 9 septembre 2002 portant sur le
 * Code des Investissements se lit désormais comme suit : ». Le lecteur voyait donc un texte de 2002
 * présenté comme en vigueur.
 *
 * ─── CE QUE LE SCRIPT FAIT ─────────────────────────────────────────────────────────────────
 * Il pose `status = 'modifié'` sur les articles atteints, et sous chacun une note qui nomme les lois
 * modificatrices dans l'ordre chronologique, avec leur propre numéro d'article. Il pose en outre un
 * `CrossRef` `MODIFIE` de CHAQUE loi de finances VERS le Code : le sens est celui de la réalité —
 * c'est la loi qui modifie le Code, pas l'inverse.
 *
 * ⚠️ CE QU'IL NE FAIT PAS, ET POURQUOI. Il ne remplace PAS la rédaction des articles. Les nouvelles
 * rédactions sont bien dans les lois de finances, mais leur texte porte des corruptions d'OCR
 * manifestes — « confonnément » pour conformément, « désonnais » pour désormais,
 * « intenninistérielle » pour interministérielle. On ne verse pas cela dans un Code. La substitution
 * demande un tirage propre du Moniteur, article par article : elle reste un point ouvert, déclaré.
 * La pastille prévient le lecteur ; c'est déjà tout autre chose que de lui montrer 2002 en silence.
 *
 * ⚠️ SEPT ARTICLES, PAS QUATORZE. Les lois de finances citent aussi des sous-articles décimaux
 * (27.1, 27.3, 29.4, 31.2, 33.2, 35.1, 35.2) qui n'existent PAS dans le texte de 2002 : ils ont été
 * créés par des amendements antérieurs, absents du corpus. Aucune pastille ne se pose sur une ancre
 * qui n'existe pas — le script le vérifie et le dit.
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated } from '../src/lib/legislation/annotated'

const APPLY = process.argv.includes('--apply')
const SOURCE = 'CODE_INVESTISSEMENTS_2002'
/** Les quatre valeurs admises par STATUS_BADGE (AnnotatedText.tsx). */
const PASTILLE = 'modifié'

type Touche = { exercice: string; docId: string; artLoi: string; artCode: string; verbe: string }

/** « L'article 28 … du Code des Investissements … se lit désormais comme suit » → { 28, réécrit } */
function analyser(ligne: string): { artCode: string; verbe: string } | null {
  const t = ligne.trim()
  if (!/Code des Investissements/i.test(t) || /^\s*(•|Vu )/.test(t)) return null
  const m =
    t.match(/[Aa]rticle\s+(\d+)(?:\.(\d+))?(?:,\s*alinéa\s+\d+)?\s+d[eu]\s/) ??
    t.match(/alinéa\s+\d+\s+de\s+l['’]\s*[Aa]rticle\s+(\d+)(?:\.(\d+))?/)
  if (!m) return null
  const artCode = m[1] + (m[2] ? `-${m[2]}` : '')
  const verbe = /se lit\s+(?:désormais\s+)?comme suit|se lit désonnais|se lit désormais/i.test(t)
    ? 'réécrit'
    : /traitant de l['’]exonération|traitant des/i.test(t)
      ? 'modifié'
      : 'touché'
  return { artCode, verbe }
}

async function main() {
  const code = await prisma.document.findFirst({
    where: { source: SOURCE },
    select: { id: true, titleFr: true, bodyOriginal: true, annotationsJson: true },
  })
  if (!code) throw new Error(`${SOURCE} introuvable. STOP`)
  const a = JSON.parse(String(code.annotationsJson ?? '{}'))

  const anc = new Set((segmentAnnotated(code.bodyOriginal ?? '', a.toc ?? []) as { kind: string; anchor?: string | null; jurisKey?: string | null }[])
    .filter((x) => x.kind === 'body' && x.anchor).map((x) => x.anchor!))
  const cle = new Map((segmentAnnotated(code.bodyOriginal ?? '', a.toc ?? []) as { kind: string; anchor?: string | null; jurisKey?: string | null }[])
    .filter((x) => x.kind === 'body' && x.anchor && x.jurisKey).map((x) => [x.anchor!, x.jurisKey!]))

  const lf = await prisma.document.findMany({
    where: { source: 'LOIS_FINANCES', bodyOriginal: { contains: 'Code des Investissements' } },
    select: { id: true, titleFr: true, publicationDate: true, bodyOriginal: true },
  })

  const touches: Touche[] = []
  for (const x of lf) {
    const lignes = (x.bodyOriginal ?? '').split('\n')
    for (let i = 0; i < lignes.length; i++) {
      const r = analyser(lignes[i])
      if (!r) continue
      const artLoi = (lignes[i].trim().match(/^Article\s+(\d+)/) ?? [])[1] ?? '?'
      touches.push({ exercice: (x.titleFr ?? '').replace("Loi de finances de l'exercice ", ''), docId: x.id, artLoi, artCode: r.artCode, verbe: r.verbe })
    }
  }
  if (!touches.length) throw new Error('aucune modification relevée — la mesure a échoué, on n’écrit rien. STOP')

  // Regroupé par article DU CODE, ordonné par exercice.
  const parArt = new Map<string, Touche[]>()
  for (const t of touches) { if (!parArt.has(t.artCode)) parArt.set(t.artCode, []); parArt.get(t.artCode)!.push(t) }
  for (const v of parArt.values()) v.sort((p, q) => p.exercice.localeCompare(q.exercice))

  const presents = [...parArt.keys()].filter((k) => anc.has(`art-${k}`)).sort((p, q) => parseFloat(p) - parseFloat(q))
  const absents = [...parArt.keys()].filter((k) => !anc.has(`art-${k}`)).sort((p, q) => parseFloat(p) - parseFloat(q))
  if (!presents.length) throw new Error('aucun article touché n’existe dans la fiche — état inattendu. STOP')

  // ⚠️ IDEMPOTENCE : les pastilles sont-elles déjà posées ?
  const statusActuel = (a.status ?? {}) as Record<string, string>
  const dejaPosees = presents.filter((k) => statusActuel[`art-${k}`] === PASTILLE).length
  if (dejaPosees === presents.length) { console.log('les pastilles sont déjà posées — rien à faire.'); await prisma.$disconnect(); return }
  if (dejaPosees) throw new Error(`${dejaPosees} pastille(s) sur ${presents.length} déjà posées : état partiel, on ne devine pas. STOP`)

  const status: Record<string, string> = { ...statusActuel }
  const commentaires: Record<string, string[]> = { ...((a.commentaires ?? {}) as Record<string, string[]>) }
  for (const k of presents) {
    const anchor = `art-${k}`
    status[anchor] = PASTILLE
    const v = parArt.get(k)!
    const detail = v.map((t) => `loi de finances ${t.exercice}, article ${t.artLoi} (${t.verbe})`).join(' ; ')
    const note =
      `⚠️ Article MODIFIÉ depuis 2002 — ${detail}. La rédaction affichée ci-dessus est celle du ` +
      `texte publié au Moniteur en 2002 : elle n’est plus en vigueur. Les rédactions nouvelles ` +
      `figurent dans les lois de finances liées, dont le texte au corpus porte des corruptions ` +
      `d’OCR ; elles n’ont pas été substituées ici, faute d’un tirage propre du Journal officiel.`
    const k2 = cle.get(anchor)
    if (!k2) throw new Error(`${anchor} : aucune clé de commentaire — le bloc n’existe pas. STOP`)
    commentaires[k2] = [note, ...(commentaires[k2] ?? [])]
  }

  console.log(`« ${code.titleFr?.slice(0, 74)} »\n`)
  console.log(`  ${lf.length} loi(s) de finances nomment ce Code · ${touches.length} mention(s) modificatrice(s)`)
  console.log(`  ${presents.length} article(s) du Code recevront la pastille « ${PASTILLE} » :\n`)
  for (const k of presents) {
    const v = parArt.get(k)!
    console.log(`     art. ${k.padEnd(4)} ← ${v.map((t) => `${t.exercice}/art.${t.artLoi} (${t.verbe})`).join(' · ')}`)
  }
  if (absents.length) {
    console.log(`\n  ⚠️ ${absents.length} article(s) cités par les lois de finances mais ABSENTS du texte de 2002 :`)
    console.log(`     ${absents.map((k) => `art. ${k}`).join(' · ')}`)
    console.log(`     Ce sont des sous-articles créés par des amendements ANTÉRIEURS, absents du corpus.`)
    console.log(`     Aucune pastille ne se pose sur une ancre qui n’existe pas.`)
  }
  const modificatrices = lf.filter((x) => touches.some((t) => t.docId === x.id))
  const visasSeuls = lf.filter((x) => !touches.some((t) => t.docId === x.id))
  console.log(`\n  ${modificatrices.length} renvoi(s) MODIFIE seront posés DES lois de finances VERS le Code — c’est la loi qui modifie.`)
  if (visasSeuls.length)
    console.log(`  ${visasSeuls.length} loi(s) ne font que VISER le Code sans le modifier — aucun renvoi : ${visasSeuls.map((x) => (x.titleFr ?? '').replace("Loi de finances de l'exercice ", '')).join(', ')}`)
  console.log(`  ⚠️ Les rédactions NE SONT PAS substituées : le texte des lois de finances porte des corruptions`)
  console.log(`     d’OCR (« confonnément », « désonnais », « intenninistérielle »). Point ouvert déclaré.`)

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  await prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: code.id },
      data: { annotationsJson: JSON.stringify({ ...a, status, commentaires }) },
    })
    // ⚠️ LE `kind` AFFIRME. Deux des lois trouvées ne font que VISER le Code dans leur préambule
    // (« Vu la Loi du 9 septembre 2002… ») sans rien modifier : leur poser un renvoi MODIFIE ferait
    // dire à la plateforme une chose fausse. Seules celles qui portent au moins une mention
    // modificatrice dans leur DISPOSITIF en reçoivent un.
    for (const x of modificatrices) {
      const arts = [...new Set(touches.filter((t) => t.docId === x.id).map((t) => t.artCode))].sort((p, q) => parseFloat(p) - parseFloat(q))
      await tx.crossRef.create({
        data: {
          fromId: x.id, toId: code.id, toType: 'LEGISLATION', kind: 'MODIFIE', position: 0, source: 'EDITORIAL',
          toLabel: code.titleFr ?? 'Code des investissements',
          note: `Modifie nommément le Code des investissements : article${arts.length > 1 ? 's' : ''} ${arts.join(', ')}. ` +
            `Formule employée : « L’article N de la Loi du 9 septembre 2002 portant sur le Code des Investissements se lit désormais comme suit ». ` +
            `⚠️ Les articles ${absents.join(', ')} cités par les lois de finances n’existent pas dans le texte de 2002 : ils procèdent d’amendements antérieurs, absents du corpus.`,
        },
      })
    }
    await audit({
      action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: code.id,
      meta: {
        motif:
          `Pastilles « ${PASTILLE} » posées sur ${presents.length} articles du Code des investissements — ` +
          `${presents.map((k) => `art. ${k}`).join(', ')} — modifiés nommément par ${modificatrices.length} lois de finances ` +
          `(exercices ${[...new Set(touches.map((t) => t.exercice))].sort().join(', ')}). Sous chaque article, une ` +
          `note nomme les lois modificatrices et leur propre article. Un CrossRef MODIFIE est posé DE chaque loi ` +
          `VERS le Code : c’est la loi qui modifie. ⚠️ Les rédactions ne sont PAS substituées — le texte des lois ` +
          `de finances au corpus porte des corruptions d’OCR manifestes ; la substitution demande un tirage propre ` +
          `du Journal officiel, article par article. ⚠️ ${absents.length} articles cités (${absents.join(', ')}) ` +
          `n’existent pas dans le texte de 2002 : sous-articles créés par des amendements antérieurs, absents du ` +
          `corpus. Défaut trouvé par l’audit adversarial du 30 août 2026.`,
        articles: presents, absents, lois: modificatrices.length, visasSeuls: visasSeuls.length, mentions: touches.length,
      },
    }, tx)
  }, { timeout: 120_000 })

  // On RELIT la base.
  await reindexDocument(code.id)
  const d2 = await prisma.document.findFirst({ where: { source: SOURCE }, select: { annotationsJson: true } })
  const a2 = JSON.parse(String(d2?.annotationsJson ?? '{}'))
  const posees = Object.entries((a2.status ?? {}) as Record<string, string>).filter(([, v]) => v === PASTILLE)
  const notes = Object.values((a2.commentaires ?? {}) as Record<string, string[]>).flat().filter((x) => x.includes('Article MODIFIÉ depuis 2002')).length
  const xr = await prisma.crossRef.count({ where: { toId: code.id, kind: 'MODIFIE' } })
  console.log(`\n✓ ${posees.length} pastille(s) « ${PASTILLE} » · ${notes} note(s) · ${xr} renvoi(s) MODIFIE vers le Code`)
  console.log(`  articles : ${posees.map(([k]) => k.replace('art-', '')).sort((p, q) => parseFloat(p) - parseFloat(q)).join(', ')}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
