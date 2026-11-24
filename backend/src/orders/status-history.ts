// Historical admin rows predate checkout/payment history. Keep their original fields intact.
export const statusLabel = (status: string, action?: string) => ({
  PENDING_PAYMENT: 'Order Placed', NEW: 'Payment Confirmed', ACCEPTED: 'Accepted',
  PROCESSING: 'Processing', READY_TO_SHIP: 'Ready to Ship', SHIPPED: 'Shipped',
  DELIVERED: 'Delivered', REJECTED: 'Rejected', CANCELLED: 'Cancelled',
  ON_HOLD: 'On Hold', PAYMENT_EXCEPTION: 'Payment needs attention',
} as Record<string, string>)[status] ?? (action === 'payment_failed' ? 'Payment Failed' : status.replaceAll('_', ' '));

type History = { id: string; previousStatus: string | null; status: string; action: string; paymentStatus: string | null; actorType: string; note: string | null; internalNote: string | null; reason: string | null; resumedFrom: string | null; createdAt: Date; admin: { name: string; email: string } | null };
type Order = { id: string; status: string; createdAt: Date };

export function completeHistory(order: Order, rows: History[]) {
  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  if (!sorted.length || sorted[0].previousStatus) {
    const initial = sorted[0]?.previousStatus ?? order.status;
    sorted.unshift({ id: `legacy-${order.id}`, previousStatus: null, status: initial, action: 'created', paymentStatus: null, actorType: 'SYSTEM', note: null, internalNote: null, reason: null, resumedFrom: null, createdAt: order.createdAt, admin: null });
  }
  return sorted.map(row => ({ id: row.id, fromStatus: row.previousStatus, toStatus: row.status, status: row.status, label: row.action === 'payment_failed' ? 'Payment Failed' : row.action === 'payment_retry' ? 'Payment Retried' : statusLabel(row.status), paymentStatus: row.paymentStatus, actorType: row.actorType, actor: row.actorType === 'ADMIN' ? row.admin : null, note: row.note, internalNote: row.internalNote ?? row.reason, action: row.action, resumedFrom: row.resumedFrom, createdAt: row.createdAt }));
}

export function customerHistory(order: Order, rows: History[]) {
  return completeHistory(order, rows).map(({ id, toStatus, label, note, createdAt }) => ({ id, toStatus, label, note, createdAt }));
}
