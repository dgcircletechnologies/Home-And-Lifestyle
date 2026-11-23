import { Suspense } from 'react';
import { CheckoutPage } from '../../features/checkout/checkout-page';
export default function Page() { return <Suspense fallback={<div className="store-checkout-page" role="status">Preparing checkout…</div>}><CheckoutPage/></Suspense>; }
