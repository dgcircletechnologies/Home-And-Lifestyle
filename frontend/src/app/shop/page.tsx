import { Suspense } from 'react';
import { ShopAllPage } from '../../features/store/shop-all-page';
export default function Shop() { return <Suspense fallback={<div className="store-browse" role="status">Finding pieces…</div>}><ShopAllPage /></Suspense>; }
