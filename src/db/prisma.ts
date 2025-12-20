import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { pool } from './pool';

type GlobalWithPrisma = typeof globalThis & { prisma?: PrismaClient };

const globalWithPrisma = globalThis as GlobalWithPrisma;

const adapter = new PrismaPg(pool, { disposeExternalPool: false });

export const prisma = globalWithPrisma.prisma ?? new PrismaClient({
  adapter,
});

if (process.env.NODE_ENV !== 'production') {
  globalWithPrisma.prisma = prisma;
}
