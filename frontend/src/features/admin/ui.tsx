import type { ReactNode } from 'react';

type Tone = 'success' | 'warning' | 'danger' | 'accent' | 'neutral';
const tones: Record<string, Tone> = {
  ACTIVE: 'success', PUBLISHED: 'success', APPROVED: 'success', DELIVERED: 'success', SUCCEEDED: 'success', ACCEPTED: 'success', VERIFIED: 'success',
  NEW: 'accent', SCHEDULED: 'accent', PROCESSING: 'accent', READY_TO_SHIP: 'accent', SHIPPED: 'accent',
  PENDING: 'warning', ON_HOLD: 'warning', DRAFT: 'warning', UNVERIFIED: 'warning', PARTIALLY_REFUNDED: 'warning',
  FAILED: 'danger', CANCELLED: 'danger', REJECTED: 'danger', SPAM: 'danger', BLOCKED: 'danger', DELETED: 'danger',
};
export function StatusLabel({ status, label }: { status: string | null | undefined; label?: string }) {
  const key = (status ?? '').toUpperCase();
  return <span className="admin-status" data-tone={tones[key] ?? 'neutral'}>{label ?? (status ? status.replaceAll('_', ' ') : 'No attempt')}</span>;
}
export function AdminPageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--hl-accent)]">{eyebrow}</p><h1 className="mt-2">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--hl-muted)]">{description}</p>}</div>{action}</div>;
}
export function AdminEmpty({ title, detail }: { title: string; detail?: string }) {
  return <div className="grid min-h-40 place-content-center rounded-[var(--hl-radius)] border border-dashed border-[var(--hl-border)] bg-[var(--hl-surface)] p-8 text-center"><p className="font-semibold">{title}</p>{detail && <p className="mt-1 text-sm text-[var(--hl-muted)]">{detail}</p>}</div>;
}
