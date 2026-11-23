'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../auth/provider';

export type GuestItem = { variantId: string; quantity: number };
export type CartLine = { itemId: string | null; variantId: string; quantity: number; product: { id: string; slug: string; name: string; image: { url: string; altText: string | null } | null } | null; variant: { id: string; sku: string; pricePaise: number; stockQuantity: number; attributes: { title: string; value: string }[] } | null; unitPricePaise: number; effectiveUnitPricePaise: number; automaticDiscountPaise: number; couponDiscountPaise: number; lineTotalPaise: number; warning: string | null };
export type CartSummary = { currency: 'INR'; items: CartLine[]; itemCount: number; subtotalPaise: number; automaticDiscountPaise: number; couponDiscountPaise: number; estimatedTotalPaise: number; coupon: { code: string; valid: boolean; message: string; savingsPaise: number } | null; canCheckout: boolean; note: string; notes?: string[] };
type CartContextValue = { summary: CartSummary | null; loading: boolean; error: string; mergeNotes: string[]; count: number; couponCode: string; add: (variantId: string, quantity?: number) => Promise<void>; update: (line: CartLine, quantity: number) => Promise<void>; remove: (line: CartLine) => Promise<void>; applyCoupon: (code: string) => Promise<CartSummary>; clearCoupon: () => Promise<void>; refresh: () => Promise<void>; mergeGuestAfterLogin: () => Promise<void> };
const KEY = 'hl_guest_cart_v1';
const CartContext = createContext<CartContextValue | null>(null);
const parseGuest = (raw: string): GuestItem[] => {
  try { const value: unknown = JSON.parse(raw); return Array.isArray(value) ? value.filter((row): row is GuestItem => row && typeof row.variantId === 'string' && Number.isInteger(row.quantity) && row.quantity > 0 && row.quantity <= 1000000).slice(0, 100) : []; } catch { return []; }
};
const readGuest = () => parseGuest(localStorage.getItem(KEY) ?? '[]');
const subscribeGuest = (callback: () => void) => { window.addEventListener('storage', callback); window.addEventListener('hl:cart', callback); return () => { window.removeEventListener('storage', callback); window.removeEventListener('hl:cart', callback); }; };
const saveGuest = (items: GuestItem[]) => { localStorage.setItem(KEY, JSON.stringify(items)); window.dispatchEvent(new Event('hl:cart')); };
const preview = (items: GuestItem[], couponCode?: string) => api<CartSummary>('cart/preview', { method: 'POST', body: { items, ...(couponCode ? { couponCode } : {}) } });

export function CartProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [summary, setSummary] = useState<CartSummary | null>(null);
  const rawGuest = useSyncExternalStore(subscribeGuest, () => localStorage.getItem(KEY) ?? '[]', () => '[]');
  const guestItems = useMemo(() => parseGuest(rawGuest), [rawGuest]);
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mergeNotes, setMergeNotes] = useState<string[]>([]);
  const mergeLock = useRef<Promise<void> | null>(null);
  const ready = useRef(false);
  const account = auth.status === 'authenticated' && auth.user?.role === 'CUSTOMER';
  const activeIdentity = useRef('');

  const refresh = useCallback(async () => {
    if (!ready.current || auth.status === 'initializing') return;
    const identity = account ? auth.user!.id : 'guest';
    if (activeIdentity.current !== identity) { activeIdentity.current = identity; setSummary(null); setLoading(true); if (identity === 'guest') setMergeNotes([]); }
    try {
      const next = account ? await api<CartSummary>(`cart${couponCode ? `?couponCode=${encodeURIComponent(couponCode)}` : ''}`) : await preview(readGuest(), couponCode);
      setSummary(next); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Cart could not be refreshed.'); }
    finally { setLoading(false); }
  }, [account, auth.status, auth.user, couponCode]);

  const mergeGuestAfterLogin = useCallback(async () => {
    if (mergeLock.current) return mergeLock.current;
    const items = readGuest();
    if (!items.length) return;
    const task = (async () => {
      const next = await api<CartSummary>('cart/merge', { method: 'POST', body: { items } });
      localStorage.removeItem(KEY); window.dispatchEvent(new Event('hl:cart')); setSummary(next); setMergeNotes(next.notes ?? []); setError('');
    })();
    mergeLock.current = task;
    try { await task; } finally { mergeLock.current = null; }
  }, []);

  useEffect(() => { ready.current = true; }, []);
  useEffect(() => {
    if (!ready.current || auth.status === 'initializing') return;
    let live = true;
    (async () => { try { if (account) await mergeGuestAfterLogin(); if (live) await refresh(); } catch (reason) { if (live) { setError(reason instanceof Error ? reason.message : 'Guest cart could not be merged. Please retry.'); setLoading(false); } } })();
    return () => { live = false; };
  }, [account, auth.status, auth.user?.id, guestItems, mergeGuestAfterLogin, refresh]);

  const add = async (variantId: string, quantity = 1) => {
    if (account) { const next = await api<CartSummary>('cart/items', { method: 'POST', body: { variantId, quantity } }); setSummary(couponCode ? await api<CartSummary>(`cart?couponCode=${encodeURIComponent(couponCode)}`) : next); return; }
    const current = readGuest(); const existing = current.find(item => item.variantId === variantId);
    const nextItems = existing ? current.map(item => item.variantId === variantId ? { ...item, quantity: item.quantity + quantity } : item) : [...current, { variantId, quantity }];
    const next = await preview(nextItems, couponCode);
    const line = next.items.find(item => item.variantId === variantId);
    if (!line || line.warning) throw Error(line?.warning ?? 'This piece is unavailable.');
    saveGuest(nextItems); setSummary(next); setError('');
  };
  const update = async (line: CartLine, quantity: number) => {
    if (quantity < 1 || !Number.isInteger(quantity)) throw Error('Quantity must be at least one.');
    if (line.variant && quantity > line.variant.stockQuantity) throw Error(`Only ${line.variant.stockQuantity} available.`);
    if (account) { if (!line.itemId) throw Error('Cart item could not be updated.'); const next = await api<CartSummary>(`cart/items/${line.itemId}`, { method: 'PATCH', body: { quantity } }); setSummary(couponCode ? await api<CartSummary>(`cart?couponCode=${encodeURIComponent(couponCode)}`) : next); return; }
    const nextItems = readGuest().map(item => item.variantId === line.variantId ? { ...item, quantity } : item);
    const next = await preview(nextItems, couponCode); saveGuest(nextItems); setSummary(next);
  };
  const remove = async (line: CartLine) => {
    if (account) { if (!line.itemId) throw Error('Cart item could not be removed.'); const next = await api<CartSummary>(`cart/items/${line.itemId}`, { method: 'DELETE' }); setSummary(couponCode ? await api<CartSummary>(`cart?couponCode=${encodeURIComponent(couponCode)}`) : next); return; }
    const nextItems = readGuest().filter(item => item.variantId !== line.variantId);
    const next = await preview(nextItems, couponCode); saveGuest(nextItems); setSummary(next);
  };
  const applyCoupon = async (code: string) => {
    const normalized = code.trim().toUpperCase();
    const next = account ? await api<CartSummary>(`cart?couponCode=${encodeURIComponent(normalized)}`) : await preview(readGuest(), normalized);
    setSummary(next); if (next.coupon?.valid) setCouponCode(normalized); return next;
  };
  const clearCoupon = async () => { setCouponCode(''); const next = account ? await api<CartSummary>('cart') : await preview(readGuest()); setSummary(next); };
  return <CartContext.Provider value={{ summary, loading, error, mergeNotes, count: summary?.itemCount ?? guestItems.reduce((sum, item) => sum + item.quantity, 0), couponCode, add, update, remove, applyCoupon, clearCoupon, refresh, mergeGuestAfterLogin }}>{children}</CartContext.Provider>;
}
export function useCart() { const value = useContext(CartContext); if (!value) throw Error('useCart must be used inside CartProvider.'); return value; }
