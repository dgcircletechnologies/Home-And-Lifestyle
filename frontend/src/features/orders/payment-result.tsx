'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../auth/provider';
import { StoreCTA } from '../store/store-cta';
import { OrderDetails } from './order-detail';
export function PaymentResult() {
  const auth = useAuth(); const params = useSearchParams(); const id = params.get('orderId');
  if (auth.status === 'initializing') return <div className="store-order-page" role="status">Checking payment…</div>;
  if (auth.status !== 'authenticated' || auth.user?.role !== 'CUSTOMER') return <div className="store-order-page"><h1>Log in to view your payment.</h1><StoreCTA href={`/login?returnTo=${encodeURIComponent(`/checkout/result?orderId=${id ?? ''}`)}`}>Log In</StoreCTA></div>;
  if (!id) return <div className="store-order-page"><h1>Choose an order to view.</h1><Link href="/account/orders">View My Orders</Link></div>;
  return <OrderDetails key={params.toString()} id={id} result/>;
}
