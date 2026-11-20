import { api } from '../../lib/api';
export type StoreCategory = { id: string; name: string; slug: string; parentId: string | null; image: { url: string; altText: string | null } | null };
export type StoreProduct = { id: string; name: string; slug: string; description: string; story: string | null; isFeatured: boolean; giftWrapEligible: boolean; image: { url: string; altText: string | null } | null; images: { url: string; altText: string | null }[]; minPricePaise: number | null; maxPricePaise: number | null; compareAtPricePaise: number | null; available: boolean; variants: { id: string; sku: string; pricePaise: number; optionCombinationKey: string; available: boolean }[]; categories: { name: string; slug: string }[] };
export type StoreCollection = { name: string; slug: string; description: string | null; products?: StoreProduct[] };
export type StoreMenu = { categories: StoreCategory[]; directory: StoreCategory[]; collections: StoreCollection[] };
export type StoreHome = { categories: StoreCategory[]; featured: StoreProduct[]; latest: StoreProduct[]; giftable: StoreProduct[]; collections: StoreCollection[]; categoryRows: { slug: string; products: StoreProduct[] }[] };
export type ProductPage = { items: StoreProduct[]; total: number; page: number; pageSize: number };
export type ShopPage = Omit<ProductPage, 'items'> & { totalPages: number; onSale: boolean; items: StoreProduct[]; filters: Record<string, {value:string;label:string}[]> };
export const catalog = {
  shop: (query: URLSearchParams, signal?: AbortSignal) => api<ShopPage>(`storefront/shop?${query}`, { signal }),
  home: () => api<StoreHome>('storefront/home'),
  navigation: () => api<StoreMenu>('storefront/navigation'),
  products: (query: URLSearchParams) => api<ProductPage>(`storefront/products?${query}`),
  product: (slug: string) => api<StoreProduct>(`storefront/products/${slug}`),
  category: (slug: string) => api<{ name: string; slug: string; description: string | null; imageUrl: string | null }>(`storefront/categories/${slug}`),
  collection: (slug: string) => api<StoreCollection>(`storefront/collections/${slug}`),
  pin: (pin: string) => api<{ pinCode: string; available: boolean; message: string }>(`storefront/serviceability/${pin}`),
};
export const rupees = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: paise % 100 === 0 ? 0 : 2 }).format(paise / 100);
export const productHref = (product: StoreProduct) => `/products/${product.slug}`;
export const categoryHref = (category: Pick<StoreCategory,'slug'>) => `/categories/${category.slug}`;
