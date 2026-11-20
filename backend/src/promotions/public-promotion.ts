import type { Prisma } from '../../generated/prisma/client';

/** The same publication window used for public catalogue prices and offer messaging. */
export const activeAutomaticPromotionWhere = (now: Date): Prisma.PromotionWhereInput => ({
  lifecycle: 'PUBLISHED',
  enabled: true,
  AND: [
    { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
    { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
  ],
});
