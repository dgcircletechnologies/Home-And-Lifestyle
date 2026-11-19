import { Suspense } from 'react';
import { BrowsePage } from '../../features/store/browse-page';
export default function Shop() { return <Suspense fallback={<p>Finding pieces…</p>}><BrowsePage /></Suspense>; }
