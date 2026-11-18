import { ReviewDetailPage } from '../../../../features/admin/review-detail-page';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ReviewDetailPage id={id} />; }
