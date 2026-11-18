import { api } from '../../lib/api';

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SPAM';
export type Review = { id: string; title: string | null; body: string; rating: number; moderationStatus: ReviewStatus; moderationVersion: number; moderationReason: string | null; trashedAt: string | null; createdAt: string; updatedAt: string; customer: { id: string | null; name: string; avatarUrl: string | null }; product: { id: string; name: string; thumbnailUrl: string | null }; hasReply: boolean; storeReply: { body: string; createdAt: string } | null; allowedActions: string[]; history?: { id: string; action: string; previousStatus: string; status: string; reason: string | null; createdAt: string; adminName: string }[]; verifiedPurchase?: boolean; ratingSummary?: { publishedReviews: number; ratingCount: number; averageRating: number | null } };
export type ReviewList = { items: Review[]; total: number; page: number; pageSize: number; counts: Record<string, number> };
export const reviewsService = {
  list: (query: URLSearchParams) => api<ReviewList>(`admin/reviews?${query}`),
  detail: (id: string) => api<Review>(`admin/reviews/${id}`),
  decide: (id: string, action: string, expectedVersion: number, reason?: string) => api<Review>(`admin/reviews/${id}/status`, { method: 'PATCH', body: { action, expectedVersion, ...(reason ? { reason } : {}) } }),
  reply: (id: string, body: string, expectedVersion: number) => api<Review>(`admin/reviews/${id}/reply`, { method: 'POST', body: { body, expectedVersion } }),
  removeReply: (id: string, expectedVersion: number) => api<Review>(`admin/reviews/${id}/reply`, { method: 'DELETE', body: { expectedVersion } }),
};
