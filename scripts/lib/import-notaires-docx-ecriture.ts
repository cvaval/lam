/**
 * Écriture d'un import « Notaires.docx » — séparée du script pour être testée
 * (import-notaires-docx-ecriture.test.ts). N'est appelée que sur une base LOCALE identifiée.
 *
 *  - ÉCRITURE CONDITIONNELLE : une fiche absente est créée ; sinon chaque champ n'est écrit que s'il
 *    est TOUJOURS absent au moment d'écrire (SQL `… AND (champ IS NULL OR btrim(champ) = '')`). Ce qui
 *    a été rempli entre la simulation et l'écriture n'est pas écrasé et devient une proposition ;
 *  - propositions idempotentes (`sourceKey`) : un second passage ne crée rien, ne rouvre rien. Une
 *    proposition ENCORE OUVERTE est remise à jour quand le RAPPROCHEMENT de la même entrée a changé
 *    (ex. : établi depuis par une décision de nom de la cliente) ou quand les CHAMPS qu'elle propose
 *    ont changé (ex. : courriels désormais publiés) — pas pour le seul libellé d'un motif, qui
 *    change avec les compléments du passage précédent ; une proposition tranchée (acceptée ou
 *    refusée) n'est jamais modifiée ;
 *  - DÉCISION de la cliente : une valeur publiée n'est remplacée (ou augmentée) que si elle est
 *    TOUJOURS celle que la décision a vue (`… AND address = <avant>`) ; sinon rien n'est écrit et
 *    l'écart devient une proposition. La provenance de la fiche cite la décision mot pour mot. Une
 *    proposition que la décision laisse SANS OBJET est close (acceptée), la note citant la décision ;
 *    sans décision, l'import ne clôt jamais rien ;
 *  - AUCUNE confirmation n'est créée ; compléter une fiche confirmée l'INVALIDE.
 */
import { Prisma, type PrismaClient } from '@prisma/client'
import { invaliderSiModifie } from '../../src/lib/jurisdictions/notaires-confirmation'
import { cleProposition, type PlanEntree } from './import-notaires-docx'

export type Resultat = {
  rang: number; ecrit: string[]; modifie: string[]; concurrence: string[]
  proposition: 'creee' | 'mise-a-jour' | 'close' | 'existante' | null; invalidees: string[]
}

/** Provenance d'une écriture sur décision : la décision, citée, et le document. */
const provenanceDecision = (p: PlanEntree) => p.decision
  ? { decision: { par: p.decision.par, decidedOn: p.decision.decidedOn, texte: p.decision.texte } }
  : {}

export async function appliquer(prisma: PrismaClient, p: PlanEntree, ctx: { sha: string; fichier: string; jour: string }): Promise<Resultat> {
  const res: Resultat = { rang: p.rang, ecrit: [], modifie: [], concurrence: [], proposition: null, invalidees: [] }
  const id = p.rapprochement.notaryId
  if (id && (p.completions.length || p.modifications.length)) {
    await prisma.$transaction(async (tx) => {
      const val = (champ: string) => p.completions.find((c) => c.champ === champ)?.valeur
      const adresse = val('address') as string | undefined
      const tels = val('phones') as string[] | undefined
      const courriels = val('emails') as string[] | undefined
      const existe = await tx.notaryContact.findUnique({ where: { notaryId: id }, select: { id: true } })
      let cree = false
      if (!existe) {
        try {
          await tx.notaryContact.create({
            data: {
              id: `contact-${id}`, notaryId: id, address: adresse ?? null, phonesJson: JSON.stringify(tels ?? []),
              email: courriels?.[0] ?? null, emailsJson: JSON.stringify(courriels ?? []),
              searchAliasesJson: '[]', observation: null, upToDateOn: new Date(`${ctx.jour}T00:00:00.000Z`), active: true,
              sourceJson: JSON.stringify({ providedBy: 'Document « Notaires.docx » transmis à la rédaction', providedOn: ctx.jour, channel: 'Import d’un document Word', evidence: null, file: ctx.fichier, sha256: ctx.sha, rang: p.rang, ...provenanceDecision(p) }),
            },
          })
          cree = true
          res.ecrit.push(...p.completions.map((c) => c.champ))
        } catch (e) {
          // Fiche créée entre-temps par une autre écriture : on retombe sur les écritures conditionnelles.
          if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e
        }
      }
      if (!cree) {
        // ÉCRITURE CONDITIONNELLE : seulement si le champ est TOUJOURS absent au moment d'écrire.
        if (adresse !== undefined) {
          const n = await tx.$executeRaw`UPDATE "NotaryContact" SET address = ${adresse}, "updatedAt" = now() WHERE "notaryId" = ${id} AND active AND (address IS NULL OR btrim(address) = '')`
          ;(n ? res.ecrit : res.concurrence).push('address')
        }
        if (tels !== undefined) {
          const n = await tx.$executeRaw`UPDATE "NotaryContact" SET "phonesJson" = ${JSON.stringify(tels)}, "updatedAt" = now() WHERE "notaryId" = ${id} AND active AND ("phonesJson" IS NULL OR btrim("phonesJson") IN ('', '[]'))`
          ;(n ? res.ecrit : res.concurrence).push('phones')
        }
        if (courriels !== undefined) {
          // La fiche n'a AUCUN courriel (ni liste, ni `email` d'avant la liste) au moment d'écrire.
          const n = await tx.$executeRaw`UPDATE "NotaryContact" SET email = ${courriels[0] ?? null}, "emailsJson" = ${JSON.stringify(courriels)}, "updatedAt" = now() WHERE "notaryId" = ${id} AND active AND ("emailsJson" IS NULL OR btrim("emailsJson") IN ('', '[]')) AND (email IS NULL OR btrim(email) = '')`
          ;(n ? res.ecrit : res.concurrence).push('emails')
        }
      }
      // DÉCISION : la valeur publiée n'est remplacée que si elle est TOUJOURS celle que la décision a vue.
      for (const m of p.modifications) {
        const avant = m.avant
        const apres = m.apres
        let n = 0
        if (m.champ === 'address') {
          n = await tx.$executeRaw`UPDATE "NotaryContact" SET address = ${apres as string}, "updatedAt" = now() WHERE "notaryId" = ${id} AND active AND address = ${avant as string}`
        } else if (m.champ === 'phones') {
          n = await tx.$executeRaw`UPDATE "NotaryContact" SET "phonesJson" = ${JSON.stringify(apres)}, "updatedAt" = now() WHERE "notaryId" = ${id} AND active AND "phonesJson" = ${JSON.stringify(avant)}`
        } else {
          const liste = apres as string[]
          n = await tx.$executeRaw`UPDATE "NotaryContact" SET email = ${liste[0] ?? null}, "emailsJson" = ${JSON.stringify(liste)}, "updatedAt" = now() WHERE "notaryId" = ${id} AND active AND "emailsJson" = ${JSON.stringify(avant)}`
        }
        ;(n ? res.modifie : res.concurrence).push(m.champ)
      }
      if (res.modifie.length) {
        // Provenance : la décision, citée, et la provenance précédente gardée.
        const f = await tx.notaryContact.findUnique({ where: { notaryId: id }, select: { sourceJson: true } })
        let precedent: unknown = null
        try { precedent = JSON.parse(f?.sourceJson ?? 'null') } catch { precedent = f?.sourceJson ?? null }
        await tx.notaryContact.update({
          where: { notaryId: id },
          data: {
            upToDateOn: new Date(`${p.decision!.decidedOn}T00:00:00.000Z`),
            sourceJson: JSON.stringify({
              providedBy: p.decision!.par, providedOn: p.decision!.decidedOn, channel: `Décision transmise à la rédaction — document « ${ctx.fichier} »`,
              evidence: null, file: ctx.fichier, sha256: ctx.sha, rang: p.rang, champs: res.modifie, ...provenanceDecision(p), precedent,
            }),
          },
        })
      }
      // Une fiche CONFIRMÉE qu'on complète ou modifie change de version : la confirmation est invalidée.
      res.invalidees = await invaliderSiModifie(tx, id, null, `${res.modifie.length ? 'Modification sur décision' : 'Complément'} importé depuis « ${ctx.fichier} »`)
    })
  }
  // Ce qui n'a pas pu être écrit (valeur apparue entre-temps) rejoint les propositions.
  const texte = (v: string | string[]) => (Array.isArray(v) ? v.join(' ; ') : v)
  for (const champ of res.concurrence) {
    const c = p.completions.find((x) => x.champ === champ)
    const m = p.modifications.find((x) => x.champ === champ)
    if (c) p.propositions.push({ champ: champ as 'address' | 'phones' | 'emails', existant: '(rempli entre la simulation et l’écriture)', propose: texte(c.valeur), motif: 'valeur apparue en base avant l’écriture : non écrasée' })
    else if (m) p.propositions.push({ champ: m.champ, existant: '(modifiée depuis la décision)', propose: texte(m.apres), motif: 'la fiche a changé depuis la décision : rien n’est remplacé, décision à revoir' })
  }
  const sourceKey = cleProposition(ctx.sha, p.rang)
  const deja = await prisma.notaryRequest.findUnique({ where: { sourceKey }, select: { id: true, status: true, notaryId: true, payloadJson: true } })
  if (!deja && ((!p.propositions.length && !p.anomalies.length) || (p.decision && !p.propositions.length))) return res
  const emails = p.propose.emails
  const payloadJson = JSON.stringify({
    source: { fichier: ctx.fichier, sha256: ctx.sha, rang: p.rang },
    notaryName: p.nom,
    rapprochement: p.rapprochement,
    address: p.propose.address,
    phones: p.propose.phones,
    email: emails[0] ?? null,
    emails,
    propositions: p.propositions,
    anomalies: p.anomalies,
    ...(p.decision ? { decision: { par: p.decision.par, decidedOn: p.decision.decidedOn, texte: p.decision.texte } } : {}),
  })
  // Décision qui ne laisse rien à proposer : la proposition est SANS OBJET — close, la décision citée.
  const tranchee = Boolean(p.decision) && !p.propositions.length && !res.concurrence.length
  const noteDecision = p.decision ? `Décision de ${p.decision.par} (${p.decision.decidedOn}) : « ${p.decision.texte} » — appliquée par l’import de « ${ctx.fichier} ».` : ''
  if (deja) {
    // Ouverte et laissée sans objet par une décision : close. Ouverte et dont le rapprochement, les
    // champs proposés ou la décision ont changé : elle reprend la nouvelle lecture (sans décision,
    // même vide, c'est le master admin qui la clôt). Tranchée : on n'y touche pas.
    const ouverte = deja.status === 'NOUVELLE' || deja.status === 'EN_COURS'
    if (ouverte && tranchee) {
      await prisma.notaryRequest.update({
        where: { id: deja.id },
        data: { payloadJson, notaryId: id, status: 'ACCEPTEE', decidedAt: new Date(), decisionNote: noteDecision.slice(0, 1000) },
      })
      res.proposition = 'close'
      return res
    }
    const champs = (xs: Array<{ champ?: unknown }> | undefined) => [...new Set((xs ?? []).map((x) => String(x.champ)))].sort().join(',')
    let avant: { niveau: unknown; champs: string; decision: unknown } = { niveau: null, champs: '?', decision: null }
    try {
      const a = JSON.parse(deja.payloadJson) as { rapprochement?: { niveau?: unknown }; propositions?: Array<{ champ?: unknown }>; decision?: { texte?: unknown } }
      avant = { niveau: a.rapprochement?.niveau ?? null, champs: champs(a.propositions), decision: a.decision?.texte ?? null }
    } catch { /* illisible : traité comme changé */ }
    if (ouverte && (deja.notaryId !== id || avant.niveau !== p.rapprochement.niveau || avant.champs !== champs(p.propositions) || avant.decision !== (p.decision?.texte ?? null))) {
      await prisma.notaryRequest.update({ where: { id: deja.id }, data: { payloadJson, notaryId: id } })
      res.proposition = 'mise-a-jour'
    } else res.proposition = 'existante'
    return res
  }
  await prisma.notaryRequest.create({
    data: {
      kind: 'IMPORT',
      notaryId: id,
      sourceKey,
      payloadJson,
      requesterName: `Import — ${ctx.fichier}`,
      requesterRole: 'AUTRE',
      requesterEmail: 'legal@agora.ht',
      locale: 'fr',
    },
  })
  res.proposition = 'creee'
  return res
}
