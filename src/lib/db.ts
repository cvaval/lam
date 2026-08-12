import { PrismaClient } from '@prisma/client'

// Singleton Prisma — évite d'épuiser le pool de connexions en dev (hot reload).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/**
 * `PRISMA_LOG_QUERIES=1` fait émettre un évènement par requête SQL — DIAGNOSTIC de
 * performance uniquement (compter les allers-retours d'une page, débusquer un N+1).
 * Désactivé par défaut : en production le volume noierait les journaux, et une requête
 * journalisée peut contenir des valeurs de paramètres.
 */
const journaliserRequetes = process.env.PRISMA_LOG_QUERIES === '1'

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: journaliserRequetes
      ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
      : process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
