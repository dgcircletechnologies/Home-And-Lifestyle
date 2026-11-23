import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

type ProviderPayment = { id: string; order_id: string; amount: number; currency: string; status: string; error_code?: string; error_description?: string };

@Injectable()
export class RazorpayClient {
  config(webhook = false) {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
    const base = process.env.RAZORPAY_API_BASE_URL?.trim();
    const currency = process.env.RAZORPAY_CURRENCY?.trim();
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
    if (!keyId || !secret || !base || currency !== 'INR' || (webhook && !webhookSecret)) throw new ServiceUnavailableException({ code: 'RAZORPAY_NOT_CONFIGURED', message: 'Online payment is temporarily unavailable. Please ask the store to configure Razorpay.' });
    let url: URL;
    try { url = new URL(base); if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw Error(); }
    catch { throw new ServiceUnavailableException({ code: 'RAZORPAY_CONFIG_INVALID', message: 'The payment gateway configuration is invalid.' }); }
    return { keyId, secret, base: url.toString().replace(/\/$/, ''), currency, webhookSecret };
  }

  validSignature(payload: string | Buffer, signature: string | undefined, secret: string) {
    if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
    const expected = createHmac('sha256', secret).update(payload).digest();
    const received = Buffer.from(signature, 'hex');
    return received.length === expected.length && timingSafeEqual(expected, received);
  }

  private async request<T>(path: string, method: 'GET' | 'POST' = 'GET', body?: object): Promise<T> {
    const config = this.config();
    let response: Response;
    try {
      response = await fetch(`${config.base}${path}`, { method, headers: { Authorization: `Basic ${Buffer.from(`${config.keyId}:${config.secret}`).toString('base64')}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
    } catch { throw new BadGatewayException({ code: 'RAZORPAY_UNREACHABLE', message: 'The payment gateway could not be reached. Please try again.' }); }
    if (!response.ok) throw new BadGatewayException({ code: 'RAZORPAY_REQUEST_FAILED', message: 'The payment gateway could not process this request. Please try again.' });
    try { return await response.json() as T; } catch { throw new BadGatewayException({ code: 'RAZORPAY_RESPONSE_INVALID', message: 'The payment gateway returned an invalid response.' }); }
  }

  async createOrder(amountPaise: number, receipt: string) {
    const result = await this.request<{ id?: string; amount?: number; currency?: string }>('/orders', 'POST', { amount: amountPaise, currency: this.config().currency, receipt });
    if (!result.id || result.amount !== amountPaise || result.currency !== 'INR') throw new BadGatewayException({ code: 'RAZORPAY_RESPONSE_INVALID', message: 'The payment gateway returned an invalid order.' });
    return result.id;
  }

  payment(paymentId: string) { return this.request<ProviderPayment>(`/payments/${encodeURIComponent(paymentId)}`); }
  orderPayments(orderId: string) { return this.request<{ items: ProviderPayment[] }>(`/orders/${encodeURIComponent(orderId)}/payments`); }
}
