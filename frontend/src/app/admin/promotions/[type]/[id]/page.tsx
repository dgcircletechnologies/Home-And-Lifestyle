import { PromotionEditorPage } from '../../../../../features/admin/promotion-editor-page';
export default async function Page({ params }: { params: Promise<{ type: 'automatic' | 'coupon'; id: string }> }) { const { type, id } = await params; return <PromotionEditorPage type={type} id={id} />; }
