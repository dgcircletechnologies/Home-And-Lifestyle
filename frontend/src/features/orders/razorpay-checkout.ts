import { ordersApi, type PaymentLaunch } from './orders-api';

type RazorpayResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (event: string, handler: (response: { error?: { code?: string; description?: string } }) => void) => void };
type RazorpayConstructor = new (options: { key: string; amount: number; currency: string; order_id: string; name: string; prefill: PaymentLaunch['prefill']; handler: (response: RazorpayResponse) => void; modal: { ondismiss: () => void } }) => RazorpayInstance;
declare global { interface Window { Razorpay?: RazorpayConstructor } }

let scriptPromise: Promise<void> | null = null;
function loadScript() {
  const source = process.env.NEXT_PUBLIC_RAZORPAY_CHECKOUT_SCRIPT_URL;
  if (!source) throw Error('Online payment is unavailable because the checkout script is not configured.');
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script'); script.src = source; script.async = true;
    script.onload = () => window.Razorpay ? resolve() : reject(Error('The payment window could not be loaded.'));
    script.onerror = () => reject(Error('The payment window could not be loaded. Please try again.'));
    document.head.append(script);
  }).catch(error => { scriptPromise = null; throw error; });
  return scriptPromise;
}

export async function openPayment(launch: PaymentLaunch, onResult: (orderId: string) => void, onPaid?: () => Promise<void>) {
  await loadScript();
  if (!window.Razorpay) throw Error('The payment window could not be loaded.');
  let completed = false;
  const finishFailure = async (code: string, reason: string) => {
    if (completed) return; completed = true;
    try { await ordersApi.fail({ orderId: launch.orderId, razorpayOrderId: launch.razorpayOrderId, code, reason }); } catch { /* The result page reads the durable server state. */ }
    finally { onResult(launch.orderId); }
  };
  const checkout = new window.Razorpay({ key: launch.keyId, amount: launch.amount, currency: launch.currency, order_id: launch.razorpayOrderId, name: 'Home & Lifestyle', prefill: launch.prefill,
    handler: response => { if (completed) return; completed = true; void (async () => { try { const result = await ordersApi.verify({ orderId: launch.orderId, razorpayOrderId: response.razorpay_order_id, razorpayPaymentId: response.razorpay_payment_id, razorpaySignature: response.razorpay_signature }); if (result.status === 'PAID') await onPaid?.(); } catch { /* The result page checks the authoritative order state. */ } finally { onResult(launch.orderId); } })(); },
    modal: { ondismiss: () => { void finishFailure('CHECKOUT_DISMISSED', 'Payment window was closed before completion.'); } },
  });
  checkout.on('payment.failed', response => { void finishFailure(response.error?.code ?? 'PAYMENT_FAILED', response.error?.description ?? 'Payment failed.'); });
  checkout.open();
}
