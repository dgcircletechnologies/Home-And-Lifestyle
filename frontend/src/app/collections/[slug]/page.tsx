import { Suspense } from 'react';
import { BrowsePage } from '../../../features/store/browse-page';
export default async function CollectionPage({params}:{params:Promise<{slug:string}>}) { const {slug}=await params; return <Suspense fallback={<p>Finding pieces…</p>}><BrowsePage collection={slug}/></Suspense>; }
