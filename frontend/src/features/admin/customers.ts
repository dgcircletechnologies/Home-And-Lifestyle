import { api } from '../../lib/api';
export type CustomerRow = { id: string; customerId: string | null; name: string; avatarUrl: string | null; email: string; phone: string | null; verifiedAt: string | null; disabledAt: string | null; deletedAt: string | null; createdAt: string };
export type CustomerList = { items: CustomerRow[]; page: number; pageSize: number; total: number };
export const customersService = { list: (params: URLSearchParams, signal?: AbortSignal) => api<CustomerList>(`admin/customers?${params}`, { signal }) };
