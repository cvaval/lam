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
 *  - AUCUNE confirmation n'est créée ; compléter une fiche confirmée l'INVALIDE.
 */
import { Prisma, type PrismaClient } from '@prisma/client'
import { invaliderSiModifie } from '../../src/lib/jurisdictions/notaires-confirmation'
import { cleProposition, type PlanEntree } from './import-notaires-docx'

export type Resultat = { rang: number; ecrit: string[]; concurrence: string[]; proposition: 'creee' | 'mise-a-jour' | 'existante' | null; invalidees: string[] }

export async function appliquer(prisma: PrismaClient, p: PlanEntree, ctx: { sha: string; fichier: string; jour: string }): Promise<Resultat> {
  const res: Resultat = { rang: p.rang, ecrit: [], concurrence: [], proposition: null, invalidees: [] }
  const id = p.rapprochement.notaryId
  if (id && p.completions.length) {
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
              sourceJson: JSON.stringify({ providedBy: 'Document « Notaires.docx » transmis à la rédaction', providedOn: ctx.jour, channel: 'Import d’un document Word', evidence: null, file: ctx.fichier, sha256: ctx.sha, rang: p.rang }),
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
      // Une fiche CONFIRMÉE qu'on complète change de version : la confirmation est invalidée.
      res.invalidees = await invaliderSiModifie(tx, id, null, `Complément importé depuis « ${ctx.fichier} »`)
    })
  }
  // Ce qui n'a pas pu être écrit (valeur apparue entre-temps) rejoint les propositions.
  for (const champ of res.concurrence) {
    const c = p.completions.find((x) => x.champ === champ)!
    p.propositions.push({ champ: champ as 'address' | 'phones' | 'emails', existant: '(rempli entre la simulation et l’écriture)', propose: Array.isArray(c.valeur) ? c.valeur.join(' ; ') : c.valeur, motif: 'valeur apparue en base avant l’écriture : non écrasée' })
  }
  const sourceKey = cleProposition(ctx.sha, p.rang)
  const deja = await prisma.notaryRequest.findUnique({ where: { sourceKey }, select: { id: true, status: true, notaryId: true, payloadJson: true } })
  if (!deja && !p.propositions.length && !p.anomalies.length) return res
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
  })
  if (deja) {
    // Ouverte et dont le rapprochement ou les champs proposés ont changé : elle reprend la nouvelle
    // lecture (même si plus rien n'est à proposer — le master admin la clôt). Tranchée : on n'y
    // touche pas.
    const ouverte = deja.status === 'NOUVELLE' || deja.status === 'EN_COURS'
    const champs = (xs: Array<{ champ?: unknown }> | undefined) => [...new Set((xs ?? []).map((x) => String(x.champ)))].sort().join(',')
    let avant: { niveau: unknown; champs: string } = { niveau: null, champs: '?' }
    try {
      const a = JSON.parse(deja.payloadJson) as { rapprochement?: { niveau?: unknown }; propositions?: Array<{ champ?: unknown }> }
      avant = { niveau: a.rapprochement?.niveau ?? null, champs: champs(a.propositions) }
    } catch { /* illisible : traité comme changé */ }
    if (ouverte && (deja.notaryId !== id || avant.niveau !== p.rapprochement.niveau || avant.champs !== champs(p.propositions))) {
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
