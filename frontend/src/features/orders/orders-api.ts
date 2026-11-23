import { api } from '../../lib/api';

export type PaymentLaunch = { orderId: string; orderNumber: string; razorpayOrderId: string; amount: number; currency: 'INR'; keyId: string; prefill: { name: string; email: string; contact: string } };
export type CustomerOrder = { id: string; orderNumber: string; createdAt: string; status: string; paymentStatus: string; currency: string; sourceMode: string; subtotalPaise: number; discountPaise: number; automaticDiscountPaise: number; couponDiscountPaise: number; shippingPaise: number; totalPaise: number; couponCode: string | null; shippingAddress: unknown; billingAddress: unknown; lines: { id: string; productName: string; sku: string; quantity: number; unitPricePaise: number; effectiveUnitPricePaise: number; discountPaise: number; totalPaise: number; attributes: { title: string; value: string }[]; image: { url: string; altText?: string | null } | null }[]; payments: { id: string; status: string; providerPaymentId: string | null; failureCode: string | null; failureReason: string | null; paidAt: string | null }[] };
export const ordersApi = {
  list: () => api<CustomerOrder[]>('orders'),
  detail: (id: string) => api<CustomerOrder>(`orders/${encodeURIComponent(id)}`),
  checkout: (body: { mode: 'CART' | 'DIRECT'; shippingAddressId: string; billingAddressId: string; couponCode?: string; variantId?: string; quantity?: number }) => api<PaymentLaunch>('orders/checkout', { method: 'POST', body }),
  retry: (id: string) => api<PaymentLaunch>(`orders/${encodeURIComponent(id)}/retry-payment`, { method: 'POST' }),
  verify: (body: { orderId: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) => api<{ orderId: string; status: string }>('payments/razorpay/verify', { method: 'POST', body }),
  fail: (body: { orderId: string; razorpayOrderId: string; code?: string; reason?: string }) => api<{ orderId: string; status: string }>('payments/razorpay/fail', { method: 'POST', body }),
};
