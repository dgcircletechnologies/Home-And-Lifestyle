import { api } from '../../lib/api';

export type StoreDetails = { storeName: string; supportEmail: string | null; supportPhone: string | null; publicAddress: string | null; businessHours: string | null; version: number; market: string; currency: string; language: string; timezone: string };
export type ShippingPolicy = { version: number };
export type GiftingSettings = { version: number; giftWrapDefaultEligible: boolean; giftMessagesAvailable: boolean; giftReceiptsAvailable: boolean; giftWrapFeePaise: number; enquiryRouting: string };
export type PinEntry = { pinCode: string; supported: false; enabled: true; reason: string | null };
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

const base = 'admin/settings';
export const settingsService = {
  store: () => api<StoreDetails>(base + '/store'),
  saveStore: (value: Pick<StoreDetails, 'version' | 'storeName' | 'supportEmail' | 'supportPhone' | 'publicAddress' | 'businessHours'>) =>
    api<StoreDetails>(base + '/store', { method: 'PATCH', body: value }),
  shipping: () => api<ShippingPolicy>(base + '/shipping'),
  gifting: () => api<GiftingSettings>(base + '/gifting'),
  saveGifting: (value: Pick<GiftingSettings, 'version' | 'giftWrapDefaultEligible' | 'giftMessagesAvailable' | 'giftReceiptsAvailable' | 'giftWrapFeePaise'>) =>
    api<GiftingSettings>(base + '/gifting', { method: 'PATCH', body: value }),
  pins: (query: URLSearchParams) => api<Page<PinEntry>>(base + '/shipping/pins?' + query),
  blockPin: (body: { version: number; pinCode: string; reason: string | null }) =>
    api<{ version: number; pinCode: string }>(base + '/shipping/pins', { method: 'POST', body }),
  unblockPin: (pin: string, version: number) =>
    api(base + '/shipping/pins/' + pin, { method: 'DELETE', body: { version } }),
};
export const money = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
export function parseRupees(value: string): number | null {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ''] = value.trim().split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(paise) && paise <= 100_000_000 ? paise : null;
}
