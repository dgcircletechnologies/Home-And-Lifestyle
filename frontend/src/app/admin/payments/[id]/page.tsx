import { PaymentDetailPage } from '../../../../features/admin/payment-detail-page';
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <PaymentDetailPage id={id} />; }
