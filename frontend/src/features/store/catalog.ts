import { api } from '../../lib/api';
export type StoreCategory = { id: string; name: string; slug: string; parentId: string | null; image: { url: string; altText: string | null } | null };
export type StoreVariant = { id: string; sku: string; pricePaise: number; effectivePricePaise: number; compareAtPricePaise: number | null; stockQuantity: number; attributes: { title: string; value: string }[]; dimensions?: unknown; optionCombinationKey: string; available: boolean };
export type StoreProduct = { id: string; name: string; slug: string; description: string; story: string | null; isFeatured: boolean; giftWrapEligible: boolean; image: { url: string; altText: string | null } | null; images: { url: string; altText: string | null }[]; minPricePaise: number | null; maxPricePaise: number | null; compareAtPricePaise: number | null; variantCount: number; available: boolean; variants: StoreVariant[]; categories: { name: string; slug: string }[]; materials?: string[]; dimensions?: unknown; careInstructions?: string | null; attributes?: { key: string; value: string }[]; tags?: string[]; collections?: string[] };
export type StoreReview = { id: string; rating: number; title: string | null; body: string; createdAt: string; reviewerName: string; avatarUrl: string | null; verifiedPurchase: boolean; storeReply: { body: string; createdAt: string | null } | null };
export type StoreReviews = { summary: { averageRating: number | null; reviewCount: number }; items: StoreReview[]; page: number; pageSize: number };
export type StoreCollection = { name: string; slug: string; description: string | null; products?: StoreProduct[] };
export type StoreOffer = { id: string; title: string; discountType: 'FIXED' | 'PERCENTAGE'; discountValue: number; targetType: 'PRODUCT' | 'CATEGORY'; targetId: string; targetName: string; targetSlug: string };
export type StoreMenu = { categories: StoreCategory[]; directory: StoreCategory[]; collections: StoreCollection[] };
export type StoreHome = { categories: StoreCategory[]; featured: StoreProduct[]; latest: StoreProduct[]; giftable: StoreProduct[]; collections: StoreCollection[]; categoryRows: { slug: string; products: StoreProduct[] }[]; offers: StoreOffer[] };
export type ProductPage = { items: StoreProduct[]; total: number; page: number; pageSize: number };
export type ShopPage = Omit<ProductPage, 'items'> & { totalPages: number; onSale: boolean; items: StoreProduct[]; filters: Record<string, {value:string;label:string}[]> };
export const catalog = {
  shop: (query: URLSearchParams, signal?: AbortSignal) => api<ShopPage>(`storefront/shop?${query}`, { signal }),
  home: () => api<StoreHome>('storefront/home'),
  offers: () => api<StoreOffer[]>('storefront/offers'),
  navigation: () => api<StoreMenu>('storefront/navigation'),
  products: (query: URLSearchParams) => api<ProductPage>(`storefront/products?${query}`),
  product: (slug: string) => api<StoreProduct>(`storefront/products/${slug}`),
  reviews: (slug: string, page = 1) => api<StoreReviews>(`storefront/products/${slug}/reviews?page=${page}`),
  submitReview: (slug: string, body: { rating: number; title?: string; body: string }) => api<{ id: string; moderationStatus: 'PENDING'; message: string }>(`customer/products/${slug}/reviews`, { method: 'POST', body }),
  category: (slug: string) => api<{ name: string; slug: string; description: string | null; imageUrl: string | null }>(`storefront/categories/${slug}`),
  collection: (slug: string) => api<StoreCollection>(`storefront/collections/${slug}`),
  pin: (pin: string) => api<{ pinCode: string; available: boolean; message: string }>(`storefront/serviceability/${pin}`),
};
export const rupees = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: paise % 100 === 0 ? 0 : 2 }).format(paise / 100);
export const productHref = (product: StoreProduct) => `/products/${product.slug}`;
export const categoryHref = (category: Pick<StoreCategory,'slug'>) => `/categories/${category.slug}`;
