/**
 * Écriture d'un import « Notaires.docx » — séparée du script pour être testée
 * (import-notaires-docx-ecriture.test.ts). N'est appelée que sur une base LOCALE identifiée.
 *
 *  - ÉCRITURE CONDITIONNELLE : une fiche absente est créée ; sinon chaque champ n'est écrit que s'il
 *    est TOUJOURS absent au moment d'écrire (SQL `… AND (champ IS NULL OR btrim(champ) = '')`). Ce qui
 *    a été rempli entre la simulation et l'écriture n'est pas écrasé et devient une proposition ;
 *  - propositions idempotentes (`sourceKey`) : un second passage ne crée rien, ne rouvre rien ;
 *  - AUCUNE confirmation n'est créée ; compléter une fiche confirmée l'INVALIDE.
 */
import { Prisma, type PrismaClient } from '@prisma/client'
import { invaliderSiModifie } from '../../src/lib/jurisdictions/notaires-confirmation'
import { cleProposition, type PlanEntree } from './import-notaires-docx'

export type Resultat = { rang: number; ecrit: string[]; concurrence: string[]; proposition: 'creee' | 'existante' | null; invalidees: string[] }

export async function appliquer(prisma: PrismaClient, p: PlanEntree, ctx: { sha: string; fichier: string; jour: string }): Promise<Resultat> {
  const res: Resultat = { rang: p.rang, ecrit: [], concurrence: [], proposition: null, invalidees: [] }
  const id = p.rapprochement.notaryId
  if (id && p.completions.length) {
    await prisma.$transaction(async (tx) => {
      const val = (champ: string) => p.completions.find((c) => c.champ === champ)?.valeur
      const adresse = val('address') as string | undefined
      const tels = val('phones') as string[] | undefined
      const courriel = val('email') as string | undefined
      const existe = await tx.notaryContact.findUnique({ where: { notaryId: id }, select: { id: true } })
      let cree = false
      if (!existe) {
        try {
          await tx.notaryContact.create({
            data: {
              id: `contact-${id}`, notaryId: id, address: adresse ?? null, phonesJson: JSON.stringify(tels ?? []), email: courriel ?? null,
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
        if (courriel !== undefined) {
          const n = await tx.$executeRaw`UPDATE "NotaryContact" SET email = ${courriel}, "updatedAt" = now() WHERE "notaryId" = ${id} AND active AND (email IS NULL OR btrim(email) = '')`
          ;(n ? res.ecrit : res.concurrence).push('email')
        }
      }
      // Une fiche CONFIRMÉE qu'on complète change de version : la confirmation est invalidée.
      res.invalidees = await invaliderSiModifie(tx, id, null, `Complément importé depuis « ${ctx.fichier} »`)
    })
  }
  // Ce qui n'a pas pu être écrit (valeur apparue entre-temps) rejoint les propositions.
  for (const champ of res.concurrence) {
    const c = p.completions.find((x) => x.champ === champ)!
    p.propositions.push({ champ: champ as 'address' | 'phones' | 'email', existant: '(rempli entre la simulation et l’écriture)', propose: Array.isArray(c.valeur) ? c.valeur.join(' ; ') : c.valeur, motif: 'valeur apparue en base avant l’écriture : non écrasée' })
  }
  if (p.propositions.length || p.anomalies.length) {
    const sourceKey = cleProposition(ctx.sha, p.rang)
    const deja = await prisma.notaryRequest.findUnique({ where: { sourceKey }, select: { id: true } })
    if (deja) res.proposition = 'existante'
    else {
      const emails = p.propose.emails
      await prisma.notaryRequest.create({
        data: {
          kind: 'IMPORT',
          notaryId: id,
          sourceKey,
          payloadJson: JSON.stringify({
            source: { fichier: ctx.fichier, sha256: ctx.sha, rang: p.rang },
            notaryName: p.nom,
            rapprochement: p.rapprochement,
            address: p.propose.address,
            phones: p.propose.phones,
            email: emails.length === 1 ? emails[0] : null,
            emails,
            propositions: p.propositions,
            anomalies: p.anomalies,
          }),
          requesterName: `Import — ${ctx.fichier}`,
          requesterRole: 'AUTRE',
          requesterEmail: 'legal@agora.ht',
          locale: 'fr',
        },
      })
      res.proposition = 'creee'
    }
  }
  return res
}
