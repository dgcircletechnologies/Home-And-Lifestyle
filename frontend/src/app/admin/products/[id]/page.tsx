import { ProductDetailPage } from '../../../../features/admin/product-detail-page';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <ProductDetailPage id={(await params).id}/>; }
