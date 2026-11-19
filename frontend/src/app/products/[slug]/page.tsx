import { ProductPage } from '../../../features/store/product-page';
export default async function ProductRoute({params}:{params:Promise<{slug:string}>}) { const {slug}=await params; return <ProductPage slug={slug}/>; }
