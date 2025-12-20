import { Prisma } from '@prisma/client';
import { config } from '../config';
import type { InterestInput } from '../validation';
import { prisma } from './prisma';

export type InterestRecord = {
  id: number;
  name: string;
  organization: string | null;
  role: string | null;
  country: string | null;
  city: string | null;
  website: string | null;
  email: string | null;
  message: string | null;
  is_demo: boolean;
  created_at: string;
};

type InterestRow = {
  id: number | bigint;
  name: string;
  organization: string | null;
  role: string | null;
  country: string | null;
  city: string | null;
  website: string | null;
  email: string | null;
  message: string | null;
  is_demo: boolean;
  created_at: string | Date;
};

const mapInterestRow = (row: InterestRow): InterestRecord => ({
  id: Number(row.id),
  name: row.name,
  organization: row.organization,
  role: row.role,
  country: row.country,
  city: row.city,
  website: row.website,
  email: row.email,
  message: row.message,
  is_demo: Boolean(row.is_demo),
  created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
});

export async function refreshInterestSearch() {
  await prisma.$executeRaw`REFRESH MATERIALIZED VIEW interests_search`;
}

export async function insertInterest(input: InterestInput) {
  const created = await prisma.interest.create({
    data: {
      name: input.name,
      organization: input.organization ?? null,
      role: input.role ?? null,
      country: input.country ?? null,
      city: input.city ?? null,
      website: input.website ?? null,
      email: input.email ?? null,
      message: input.message ?? null,
      shareEmail: Boolean(input.shareEmail),
      publicListing: true,
      consentPublic: true,
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  if (config.refreshSearchOnWrite) {
    await refreshInterestSearch();
  }

  return { id: Number(created.id), created_at: created.createdAt.toISOString() };
}

export async function listInterests(limit: number, search?: string) {
  if (search) {
    const query = Prisma.sql`
      SELECT id, name, organization, role, country, city, website, email, message, is_demo, created_at
      FROM interests_search
      WHERE document @@ plainto_tsquery('simple', ${search})
      ORDER BY ts_rank(document, plainto_tsquery('simple', ${search})) DESC, created_at DESC
      LIMIT ${limit};
    `;
    const result = await prisma.$queryRaw<InterestRow[]>(query);
    return result.map(mapInterestRow);
  }

  const results = await prisma.interest.findMany({
    where: { publicListing: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      name: true,
      organization: true,
      role: true,
      country: true,
      city: true,
      website: true,
      email: true,
      message: true,
      shareEmail: true,
      isDemo: true,
      createdAt: true,
    },
  });

  return results.map((record) => ({
    id: Number(record.id),
    name: record.name,
    organization: record.organization,
    role: record.role,
    country: record.country,
    city: record.city,
    website: record.website,
    email: record.shareEmail ? record.email : null,
    message: record.message,
    is_demo: record.isDemo,
    created_at: record.createdAt.toISOString(),
  }));
}

export async function countInterests(search?: string) {
  if (search) {
    const query = Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM interests_search
      WHERE document @@ plainto_tsquery('simple', ${search});
    `;
    const result = await prisma.$queryRaw<{ total: number | bigint }[]>(query);
    return result[0]?.total ? Number(result[0].total) : 0;
  }

  return prisma.interest.count({ where: { publicListing: true } });
}
