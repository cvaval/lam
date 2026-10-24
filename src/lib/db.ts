import { PrismaClient } from '@prisma/client'
import { avecReessaiConnexion } from './db-reessai'

// Singleton Prisma — évite d'épuiser le pool de connexions en dev (hot reload).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/**
 * `PRISMA_LOG_QUERIES=1` fait émettre un évènement par requête SQL — DIAGNOSTIC de
 * performance uniquement (compter les allers-retours d'une page, débusquer un N+1).
 * Désactivé par défaut : en production le volume noierait les journaux, et une requête
 * journalisée peut contenir des valeurs de paramètres.
 */
const journaliserRequetes = process.env.PRISMA_LOG_QUERIES === '1'

function creerClient(): PrismaClient {
  const client = new PrismaClient({
    log: journaliserRequetes
      ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
      : process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  })
  // Attente de connexion expirée (P2024) → requête rejouée (db-reessai.ts). Un middleware et non
  // une extension : le type `PrismaClient` reste celui que tout le code attend.
  client.$use((params, next) => avecReessaiConnexion(() => next(params)))
  return client
}

export const prisma = globalForPrisma.prisma ?? creerClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
