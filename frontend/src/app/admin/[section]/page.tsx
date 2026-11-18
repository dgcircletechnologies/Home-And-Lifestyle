import { notFound } from 'next/navigation';
import { AdminPlaceholder } from '../../../features/admin/placeholder';
const sections: Record<string,string> = { categories: 'Catalogue', products: 'Products', customers: 'Customers', orders: 'Orders', promotions: 'Promotions', reviews: 'Reviews', reports: 'Reports', settings: 'Settings', profile: 'My Profile' };
export default async function Page({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; const title = sections[section]; if (!title) notFound(); return <AdminPlaceholder title={title}/>; }
