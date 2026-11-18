import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ModerationStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma.service';

type Query = { page: number; pageSize: number; search?: string; status: 'ALL' | 'TRASH' | ModerationStatus; productId?: string; rating?: number; replied: 'all' | 'yes' | 'no'; sort: 'newest' | 'oldest' };
type Action = 'approve' | 'unpublish' | 'reject' | 'spam' | 'trash' | 'restore';
const missing = () => new NotFoundException({ code: 'REVIEW_NOT_FOUND', message: 'Review not found.' });
const stale = () => new ConflictException({ code: 'REVIEW_CHANGED', message: 'This review changed. Refresh it before deciding.' });
const listInclude = { customer: { include: { user: { select: { id: true, name: true, avatarUrl: true, deletedAt: true } } } }, product: { select: { id: true, name: true, status: true, images: { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }], take: 1, select: { url: true } } } } } satisfies Prisma.ReviewInclude;
const include = { ...listInclude, history: { orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }], include: { admin: { select: { name: true } } } } } satisfies Prisma.ReviewInclude;
type SummaryRow = Prisma.ReviewGetPayload<{ include: typeof listInclude }>;
const actions = (row: SummaryRow): Action[] => row.trashedAt ? ['restore'] : row.moderationStatus === 'PENDING' ? ['approve', 'reject', 'spam', 'trash'] : row.moderationStatus === 'APPROVED' ? ['unpublish', 'spam', 'trash'] : ['approve', 'trash', ...(row.moderationStatus === 'REJECTED' ? ['spam' as const] : ['reject' as const])];
const visible = (row: SummaryRow) => ({ id: row.id, rating: row.rating, title: row.title, body: row.body, moderationStatus: row.moderationStatus, moderationVersion: row.moderationVersion, moderationReason: row.moderationReason, trashedAt: row.trashedAt, createdAt: row.createdAt, updatedAt: row.updatedAt, customer: { id: row.customer?.user?.deletedAt ? null : row.customer?.user?.id ?? null, name: row.customer?.user?.deletedAt ? 'Former customer' : row.customer?.user?.name ?? row.customer?.name ?? 'Former customer', avatarUrl: row.customer?.user?.deletedAt ? null : row.customer?.user?.avatarUrl ?? null }, product: { id: row.product.id, name: row.product.name, thumbnailUrl: row.product.images[0]?.url ?? null }, hasReply: Boolean(row.storeReply), storeReply: row.storeReply ? { body: row.storeReply, createdAt: row.repliedAt } : null, allowedActions: actions(row) });

@Injectable()
export class AdminReviewsService {
  constructor(private readonly db: PrismaService) {}
  private async row(id: string) { const row = await this.db.review.findUnique({ where: { id }, include }); if (!row) throw missing(); return row; }
  private where(query: Query): Prisma.ReviewWhereInput { return { ...(query.status === 'TRASH' ? { trashedAt: { not: null } } : { trashedAt: null, ...(query.status === 'ALL' ? {} : { moderationStatus: query.status }) }), ...(query.productId ? { productId: query.productId } : {}), ...(query.rating ? { rating: query.rating } : {}), ...(query.replied === 'yes' ? { storeReply: { not: null } } : query.replied === 'no' ? { storeReply: null } : {}), ...(query.search ? { OR: [{ body: { contains: query.search, mode: 'insensitive' } }, { title: { contains: query.search, mode: 'insensitive' } }, { product: { name: { contains: query.search, mode: 'insensitive' } } }, { customer: { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { user: { name: { contains: query.search, mode: 'insensitive' } } }] } }] } : {}) }; }
  async list(query: Query) {
    const where = this.where(query); const common = this.where({ ...query, status: 'ALL' });
    const [total, rows, trash] = await this.db.$transaction([
      this.db.review.count({ where }),
      this.db.review.findMany({ where, include: listInclude, orderBy: [{ createdAt: query.sort === 'oldest' ? 'asc' : 'desc' }, { id: query.sort === 'oldest' ? 'asc' : 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.db.review.count({ where: { ...common, trashedAt: { not: null } } }),
    ]);
    const groups = await this.db.review.groupBy({ by: ['moderationStatus'], where: common, _count: { _all: true }, orderBy: { moderationStatus: 'asc' } });
    const counts: Record<string, number> = { ALL: groups.reduce((sum, group) => sum + group._count._all, 0), PENDING: 0, APPROVED: 0, REJECTED: 0, SPAM: 0, TRASH: trash };
    groups.forEach(group => { counts[group.moderationStatus] = group._count._all; });
    return { items: rows.map(row => ({ ...visible(row), body: row.body.slice(0, 240), storeReply: undefined })), page: query.page, pageSize: query.pageSize, total, counts };
  }
  async detail(id: string) { const row = await this.row(id); return { ...visible(row), history: row.history.map(event => ({ id: event.id, action: event.action, previousStatus: event.previousStatus, status: event.status, reason: event.reason, createdAt: event.createdAt, adminName: event.admin.name })), verifiedPurchase: row.customerId ? Boolean(await this.db.order.findFirst({ where: { customerId: row.customerId, status: { in: ['DELIVERED', 'COMPLETED'] }, lines: { some: { productIdSnapshot: row.productId } } }, select: { id: true } })) : false, ratingSummary: await this.ratingSummary(row.productId) }; }
  async ratingSummary(productId: string) { const [publishedReviews, ratings] = await this.db.$transaction([this.db.review.count({ where: { productId, moderationStatus: 'APPROVED', trashedAt: null } }), this.db.review.aggregate({ where: { productId, moderationStatus: 'APPROVED', trashedAt: null }, _count: { rating: true }, _avg: { rating: true } })]); return { publishedReviews, ratingCount: ratings._count.rating, averageRating: ratings._avg.rating }; }
  async moderate(id: string, adminId: string, input: { action: Action; expectedVersion: number; reason?: string }) {
    const row = await this.row(id);
    if (row.moderationVersion !== input.expectedVersion) throw stale();
    if (!actions(row).includes(input.action)) throw new ConflictException({ code: 'REVIEW_ACTION_INVALID', message: 'This action is unavailable for the current review state.' });
    if (input.action === 'reject' && !input.reason) throw new BadRequestException({ code: 'REASON_REQUIRED', message: 'Enter an internal rejection reason.', fields: { reason: ['Reason is required.'] } });
    const state: ModerationStatus = input.action === 'approve' ? 'APPROVED' : input.action === 'reject' ? 'REJECTED' : input.action === 'spam' ? 'SPAM' : input.action === 'unpublish' || input.action === 'restore' ? 'PENDING' : row.moderationStatus;
    await this.db.$transaction(async tx => {
      const changed = await tx.review.updateMany({ where: { id, moderationVersion: row.moderationVersion }, data: { moderationVersion: { increment: 1 }, moderationStatus: state, moderationReason: input.action === 'reject' ? input.reason : null, trashedAt: input.action === 'trash' ? new Date() : input.action === 'restore' ? null : row.trashedAt } });
      if (changed.count !== 1) throw stale();
      await tx.reviewModerationHistory.create({ data: { reviewId: id, adminId, action: input.action, previousStatus: row.trashedAt ? 'TRASH' : row.moderationStatus, status: input.action === 'trash' ? 'TRASH' : state, reason: input.reason } });
    });
    return this.detail(id);
  }
  async reply(id: string, adminId: string, input: { body: string; expectedVersion: number }) { const row = await this.row(id); if (row.moderationVersion !== input.expectedVersion) throw stale(); if (row.trashedAt || row.moderationStatus !== 'APPROVED') throw new BadRequestException({ code: 'REVIEW_NOT_PUBLISHED', message: 'Publish this review before replying.' }); const changed = await this.db.review.updateMany({ where: { id, moderationVersion: row.moderationVersion }, data: { moderationVersion: { increment: 1 }, storeReply: input.body, repliedAt: new Date(), repliedById: adminId } }); if (!changed.count) throw stale(); return this.detail(id); }
  async removeReply(id: string, _adminId: string, input: { expectedVersion: number }) { const row = await this.row(id); if (row.moderationVersion !== input.expectedVersion) throw stale(); if (!row.storeReply) return this.detail(id); const changed = await this.db.review.updateMany({ where: { id, moderationVersion: row.moderationVersion }, data: { moderationVersion: { increment: 1 }, storeReply: null, repliedAt: null, repliedById: null } }); if (!changed.count) throw stale(); return this.detail(id); }
}
