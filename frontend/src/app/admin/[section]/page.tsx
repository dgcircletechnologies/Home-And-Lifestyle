import { notFound, redirect } from 'next/navigation';
import { AdminPlaceholder } from '../../../features/admin/placeholder';
const sections: Record<string,string> = { categories: 'Catalogue', products: 'Products', customers: 'Customers', orders: 'Orders', promotions: 'Promotions', reviews: 'Reviews', profile: 'My Profile' };
export default async function Page({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; if (section === 'reports') redirect('/admin'); const title = sections[section]; if (!title) notFound(); return <AdminPlaceholder title={title}/>; }
