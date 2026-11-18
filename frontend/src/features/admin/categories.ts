import { api } from '../../lib/api';

export type CategoryStatus = 'ACTIVE' | 'INACTIVE';
export type CategoryImage = { url: string; format: string | null; width: number | null; height: number | null; resourceType: string } | null;
export type Category = { id: string; name: string; slug: string; description: string | null; status: CategoryStatus; parentId: string | null; parent?: { id: string; name: string } | null; image: CategoryImage; createdAt: string; updatedAt: string; _count?: { children: number; products: number } };
export type CategoryList = { items: Category[]; page: number; pageSize: number; total: number };
export type CategoryInput = { name: string; slug: string; description?: string | null; parentId?: string | null };
export type ParentOption = { id: string; name: string; status: CategoryStatus };
export const categoryService = {
  list: (params: URLSearchParams, signal?: AbortSignal) => api<CategoryList>(`admin/categories?${params}`, { signal }),
  parents: (excludeId?: string, signal?: AbortSignal) => api<ParentOption[]>(`admin/categories/parents${excludeId ? `?excludeId=${encodeURIComponent(excludeId)}` : ''}`, { signal }),
  detail: (id: string, signal?: AbortSignal) => api<Category>(`admin/categories/${id}`, { signal }),
  create: (input: CategoryInput) => api<Category>('admin/categories', { method: 'POST', body: input }),
  update: (id: string, input: Partial<CategoryInput>) => api<Category>(`admin/categories/${id}`, { method: 'PATCH', body: input }),
  status: (id: string, status: CategoryStatus) => api<Category>(`admin/categories/${id}/status`, { method: 'PATCH', body: { status } }),
  remove: (id: string) => api<Category>(`admin/categories/${id}`, { method: 'DELETE' }),
  upload: (id: string, image: File) => { const form = new FormData(); form.set('image', image); return api<Category>(`admin/categories/${id}/image`, { method: 'POST', body: form, timeoutMs: 45000 }); },
  removeImage: (id: string) => api<Category>(`admin/categories/${id}/image`, { method: 'DELETE' }),
};
