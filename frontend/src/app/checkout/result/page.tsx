import { Suspense } from 'react';
import { PaymentResult } from '../../../features/orders/payment-result';
export default function Page() { return <Suspense fallback={<div className="store-order-page" role="status">Checking payment…</div>}><PaymentResult/></Suspense>; }
