import { api } from '../../lib/api';
export type Dashboard = { products: number; categories: number; customers: number; orders: { value: null; label: string }; recentProducts: { id: string; name: string; status: string; stock: number; updatedAt: string }[] };
export const dashboardService = { get: (signal?: AbortSignal) => api<Dashboard>('admin/dashboard', { signal }) };
