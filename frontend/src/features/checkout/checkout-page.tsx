'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../auth/provider';
import { addressesApi, addressLines, type Address, type AddressInput } from '../addresses/addresses-api';
import { AddressForm } from '../addresses/address-form';
import { useCart, type CartSummary } from '../cart/cart-provider';
import { rupees } from '../store/catalog';
import { StorePhoto } from '../store/storefront-ui';
import { StoreCTA } from '../store/store-cta';
import { GiftOptionsControl } from '../store/gift-options-control';
import { ordersApi } from '../orders/orders-api';
import { openPayment } from '../orders/razorpay-checkout';

type Mode = 'cart' | 'direct';
function AddressPicker({ title, addresses, selected, onSelect, onAdd, name }: { title: string; addresses: Address[]; selected: string; onSelect: (id: string) => void; onAdd: () => void; name: string }) {
  return <section className="store-checkout-address-section"><div className="store-checkout-section-head"><h2>{title}</h2><Link href="/account/addresses">Manage addresses</Link></div>{addresses.length ? <div className="store-checkout-address-options" role="radiogroup" aria-label={title}>{addresses.map(address => <label key={address.id} className="store-checkout-address-option" data-selected={selected === address.id}><input type="radio" name={name} value={address.id} checked={selected === address.id} onChange={() => onSelect(address.id)}/><span className="store-checkout-address-copy"><span className="store-checkout-address-title"><strong>{address.fullName}</strong>{address.label && <em>{address.label}</em>}{address.isDefault && <small>Default</small>}</span><span>{addressLines(address).join(', ')}</span><span>+91 {address.phone}</span></span></label>)}</div> : <p className="store-checkout-address-empty">No saved addresses yet. Add one to continue.</p>}<button type="button" className="store-checkout-add" onClick={onAdd}>+ Add New Address</button></section>;
}

export function CheckoutPage() {
  const router = useRouter();
  const params = useSearchParams();
  const auth = useAuth();
  const cart = useCart();
  const mergeGuestAfterLogin = cart.mergeGuestAfterLogin;
  const appliedCouponCode = cart.couponCode;
  const query = params.toString();
  const mode: Mode = params.get('mode') === 'direct' ? 'direct' : 'cart';
  const requestedVariantId = params.get('variantId') ?? '';
  const requestedQuantity = params.get('quantity') ?? '1';
  const checkoutUrl = `/checkout${query ? `?${query}` : ''}`;
  const [summary, setSummary] = useState<CartSummary | null>(null);
  const giftDrafts = useRef<Record<string, string>>({});
  const [summaryError, setSummaryError] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressError, setAddressError] = useState('');
  const [shippingAddressId, setShippingAddressId] = useState('');
  const [billingAddressId, setBillingAddressId] = useState('');
  const [sameBilling, setSameBilling] = useState(true);
  const [addingFor, setAddingFor] = useState<'shipping' | 'billing' | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [launchedOrderId, setLaunchedOrderId] = useState('');
  const customer = auth.status === 'authenticated' && auth.user?.role === 'CUSTOMER';

  const refreshAddresses = useCallback(async () => {
    const rows = await addressesApi.list(); setAddresses(rows); setAddressError('');
    const first = rows.find(row => row.isDefault) ?? rows[0];
    setShippingAddressId(current => rows.some(row => row.id === current) ? current : first?.id ?? '');
    setBillingAddressId(current => rows.some(row => row.id === current) ? current : first?.id ?? '');
    return rows;
  }, []);

  useEffect(() => {
    if (!customer) return;
    let live = true;
    addressesApi.list().then(rows => { if (!live) return; setAddresses(rows); const first = rows.find(row => row.isDefault) ?? rows[0]; setShippingAddressId(first?.id ?? ''); setBillingAddressId(first?.id ?? ''); }).catch(reason => { if (live) setAddressError(reason instanceof Error ? reason.message : 'Addresses could not be loaded.'); });
    return () => { live = false; };
  }, [customer, auth.user?.id]);

  useEffect(() => {
    if (!customer) return;
    let live = true;
    (async () => {
      setSummaryLoading(true); setSummaryError('');
      try {
        let next: CartSummary;
        if (mode === 'direct') {
          const quantity = Number(requestedQuantity);
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedVariantId) || !/^[1-9][0-9]*$/.test(requestedQuantity) || !Number.isInteger(quantity) || quantity > 1000000) throw Error('This direct order link is invalid. Choose a piece again.');
          next = await api<CartSummary>('cart/preview', { method: 'POST', body: { items: [{ variantId: requestedVariantId, quantity }] } });
        } else {
          await mergeGuestAfterLogin();
          const code = appliedCouponCode || window.sessionStorage.getItem('hl_cart_coupon_v1');
          next = await api<CartSummary>(`cart${code ? `?couponCode=${encodeURIComponent(code)}` : ''}`);
        }
        if (live) setSummary(next);
      } catch (reason) { if (live) setSummaryError(reason instanceof Error ? reason.message : 'Order details could not be loaded.'); }
      finally { if (live) setSummaryLoading(false); }
    })();
    return () => { live = false; };
  }, [customer, auth.user?.id, mode, query, requestedVariantId, requestedQuantity, appliedCouponCode, mergeGuestAfterLogin]);

  const changeGift = async (variantId: string, selected: boolean, message: string | null) => {
    if (!summary) return;
    const current = summary;
    const items = current.items.map(item => item.variantId === variantId ? { ...item, giftWrapSelected: selected, giftMessage: selected ? message : null } : item);
    const giftWrapTotalPaise = items.reduce((total, item) => total + (item.giftWrapSelected ? item.giftWrapPricePaise * item.quantity : 0), 0);
    setSummary({ ...current, items, giftWrapTotalPaise, estimatedTotalPaise: current.estimatedTotalPaise - (current.giftWrapTotalPaise ?? 0) + giftWrapTotalPaise });
    setSummaryError('');
    try {
      let next: CartSummary;
      if (mode === 'direct') next = await api<CartSummary>('cart/preview', { method: 'POST', body: { items: items.map(item => ({ variantId: item.variantId, quantity: item.quantity, giftWrapSelected: item.giftWrapSelected, giftMessage: item.giftMessage })) } });
      else {
        const line = current.items.find(item => item.variantId === variantId)!;
        await cart.setGift(line, selected, message);
        const code = current.coupon?.valid ? current.coupon.code : null;
        next = await api<CartSummary>(`cart${code ? `?couponCode=${encodeURIComponent(code)}` : ''}`);
      }
      setSummary(next);
    } catch (reason) { setSummary(current); setSummaryError(reason instanceof Error ? reason.message : 'Gift options could not be updated.'); }
  };
  const saveAddress = async (input: AddressInput) => {
    const created = await addressesApi.create(input);
    setAddresses(current => [...current.map(row => created.isDefault ? { ...row, isDefault: false } : row), created].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.id.localeCompare(b.id)));
    if (addingFor === 'shipping') setShippingAddressId(created.id);
    else setBillingAddressId(created.id);
    setAddingFor(null);
    void refreshAddresses().catch(() => setAddressError('Address saved, but the latest list could not be loaded. Retry to refresh.'));
  };
  const selectedBillingAddressId = sameBilling ? shippingAddressId : billingAddressId;
  const checkoutDraft = { mode, items: summary?.items.map(row => ({ variantId: row.variantId, quantity: row.quantity })) ?? [], couponCode: mode === 'cart' && summary?.coupon?.valid ? summary.coupon.code : null, shippingAddressId, billingAddressId: selectedBillingAddressId };
  const proceed = async () => {
    if (paymentBusy || !summary?.canCheckout || !checkoutDraft.shippingAddressId || !checkoutDraft.billingAddressId) return;
    setPaymentBusy(true); setPaymentError('');
    try {
      await cart.flushGiftWrites();
      const selectedGift = (variantId: string, selected: boolean, saved: string | null) => selected ? (giftDrafts.current[variantId]?.trim().slice(0, 250) || saved || null) : null;
      const launch = await ordersApi.checkout(mode === 'direct' ? { mode: 'DIRECT', shippingAddressId, billingAddressId: selectedBillingAddressId, variantId: requestedVariantId, quantity: Number(requestedQuantity), giftWrapSelected: summary.items[0]?.giftWrapSelected ?? false, giftMessage: selectedGift(requestedVariantId, summary.items[0]?.giftWrapSelected ?? false, summary.items[0]?.giftMessage ?? null) } : { mode: 'CART', shippingAddressId, billingAddressId: selectedBillingAddressId, ...(checkoutDraft.couponCode ? { couponCode: checkoutDraft.couponCode } : {}), giftOptions: summary.items.filter(item => item.isGiftWrapEligible).map(item => ({ variantId: item.variantId, giftWrapSelected: item.giftWrapSelected, giftMessage: selectedGift(item.variantId, item.giftWrapSelected, item.giftMessage) })) });
      setLaunchedOrderId(launch.orderId);
      await openPayment(launch, id => router.push(`/checkout/result?orderId=${encodeURIComponent(id)}`), mode === 'cart' ? cart.refresh : undefined);
    } catch (error) { setPaymentError(error instanceof ApiError && ['RAZORPAY_NOT_CONFIGURED', 'RAZORPAY_CONFIG_INVALID'].includes(error.code) ? 'Online payment is temporarily unavailable. Please try again later.' : error instanceof Error ? error.message : 'Payment could not be started.'); }
    finally { setPaymentBusy(false); }
  };

  if (auth.status === 'initializing') return <div className="store-checkout-page" role="status">Preparing checkout…</div>;
  if (auth.status === 'error') return <div className="store-checkout-page" role="alert"><h1>We couldn’t restore your session.</h1><p>{auth.error}</p><StoreCTA onClick={auth.retryInitialization}>Try again</StoreCTA></div>;
  if (!customer) return <div className="store-checkout-page"><nav className="store-breadcrumb" aria-label="Breadcrumb"><Link href="/shop">Shop All</Link><span aria-hidden="true">/</span><span aria-current="page">Checkout</span></nav><section className="store-checkout-gate"><p className="store-kicker">One little step</p><h1>Make yourself at home.</h1><p>Log in or create an account to choose your addresses and continue to checkout. Your selected pieces will be here when you return.</p><div><StoreCTA href={`/login?returnTo=${encodeURIComponent(checkoutUrl)}`}>Log In</StoreCTA><StoreCTA href={`/register?returnTo=${encodeURIComponent(checkoutUrl)}`} variant="secondary">Create Account</StoreCTA></div><small>New accounts need email verification before sign in.</small></section></div>;
  if (summaryLoading) return <div className="store-checkout-page" role="status">Preparing your order summary…</div>;
  if (summaryError || !summary) return <div className="store-checkout-page store-checkout-failure"><h1>We couldn’t prepare this order.</h1><p role="alert">{summaryError}</p><StoreCTA href={mode === 'cart' ? '/cart' : '/shop'}>Choose your pieces</StoreCTA></div>;
  if (!summary.items.length) return <div className="store-checkout-page store-checkout-failure"><h1>{mode === 'cart' ? 'Your cart is empty.' : 'This piece is unavailable.'}</h1><p>Choose a piece to continue.</p><StoreCTA href="/shop">Explore Shop All</StoreCTA></div>;
  if (summary.items.some(item => item.warning)) return <div className="store-checkout-page store-checkout-failure"><h1>Check your pieces before continuing.</h1>{summary.items.filter(item => item.warning).map(item => <p key={item.variantId} role="alert">{item.warning}</p>)}<StoreCTA href={mode === 'cart' ? '/cart' : '/shop'}>{mode === 'cart' ? 'Edit cart' : 'Back to Shop All'}</StoreCTA></div>;
  return <div className="store-checkout-page"><nav className="store-breadcrumb" aria-label="Breadcrumb"><Link href={mode === 'cart' ? '/cart' : '/shop'}>{mode === 'cart' ? 'Cart' : 'Shop All'}</Link><span aria-hidden="true">/</span><span aria-current="page">Checkout</span></nav><div className="store-flow-heading"><p className="store-kicker">Almost yours</p><h1>Checkout</h1><p>{mode === 'direct' ? 'Review your selected piece and choose where it should go.' : 'Review your cart and choose where your pieces should go.'}</p></div><div className="store-checkout-layout"><div className="store-checkout-addresses">
      {addressError && <p className="store-form-error" role="alert">{addressError} <button type="button" onClick={() => void refreshAddresses()}>Retry</button></p>}
      <AddressPicker title="Shipping address" addresses={addresses} selected={shippingAddressId} onSelect={setShippingAddressId} onAdd={() => setAddingFor('shipping')} name="shipping-address"/>
      {addingFor === 'shipping' && <AddressForm title="New shipping address" onSave={saveAddress} onCancel={() => setAddingFor(null)}/>}
      <section className="store-checkout-billing"><h2>Billing address</h2><label><input type="checkbox" checked={sameBilling} onChange={event => setSameBilling(event.target.checked)}/> Billing address same as shipping address</label></section>
      {!sameBilling && <><AddressPicker title="Choose billing address" addresses={addresses} selected={billingAddressId} onSelect={setBillingAddressId} onAdd={() => setAddingFor('billing')} name="billing-address"/>{addingFor === 'billing' && <AddressForm title="New billing address" onSave={saveAddress} onCancel={() => setAddingFor(null)}/>}</>}
    </div><aside className="store-checkout-summary" aria-label="Order summary"><div className="store-checkout-summary-head"><p className="store-kicker">Your pieces</p><h2>Order summary</h2>{mode === 'cart' && <Link href="/cart">Edit items or coupons →</Link>}</div><div className="store-checkout-lines">{summary.items.map(item => <div key={item.variantId} className="store-checkout-line"><div className="store-checkout-line-photo"><StorePhoto url={item.product?.image?.url} alt={item.product?.image?.altText || item.product?.name || 'Selected piece'}/></div><div><strong>{item.product?.name}</strong><small>SKU {item.variant?.sku} · Qty {item.quantity}</small>{Array.isArray(item.variant?.attributes) && item.variant.attributes.length > 0 && <small>{item.variant.attributes.filter(row => row.title && row.value).map(row => `${row.title}: ${row.value}`).join(' · ')}</small>}<span>{rupees(item.effectiveUnitPricePaise)}{item.effectiveUnitPricePaise < item.unitPricePaise && <del>{rupees(item.unitPricePaise)}</del>} × {item.quantity}</span></div><b>{rupees(item.effectiveUnitPricePaise * item.quantity)}</b>{item.isGiftWrapEligible && <div className="col-span-full"><GiftOptionsControl name={`checkout-${item.variantId}`} selected={item.giftWrapSelected} message={item.giftMessage} pricePaise={item.giftWrapPricePaise} quantity={item.quantity} allowMessage={item.allowGiftMessage} disabled={paymentBusy} onChange={(selected, message) => void changeGift(item.variantId, selected, message)} onDraftChange={draft => { giftDrafts.current[item.variantId] = draft; }}/></div>}</div>)}</div><div className="store-checkout-breakdown"><div><span>Subtotal</span><strong>{rupees(summary.subtotalPaise)}</strong></div>{summary.automaticDiscountPaise > 0 && <div className="store-cart-saving"><span>Product savings</span><strong>−{rupees(summary.automaticDiscountPaise)}</strong></div>}{mode === 'cart' && summary.coupon?.valid && summary.couponDiscountPaise > 0 && <div className="store-cart-saving"><span>Coupon · {summary.coupon.code}</span><strong>−{rupees(summary.couponDiscountPaise)}</strong></div>}<div><span>Shipping</span><span>Shipping included in cost</span></div>{summary.items.some(item => item.giftWrapSelected) && <div><span>Gift Wrapping</span><strong className="tabular-nums">{rupees(summary.giftWrapTotalPaise)}</strong></div>}<div className="store-checkout-total"><span>Total</span><strong>{rupees(summary.estimatedTotalPaise)}</strong></div></div><StoreCTA disabled={paymentBusy || !checkoutDraft.shippingAddressId || !checkoutDraft.billingAddressId || !summary.canCheckout} onClick={() => void proceed()} className="store-checkout-payment">{paymentBusy ? 'Opening payment…' : 'Proceed to Payment'}</StoreCTA><p className="store-checkout-helper">{!checkoutDraft.shippingAddressId || !checkoutDraft.billingAddressId ? 'Choose shipping and billing addresses to continue.' : 'Secure online payment via Razorpay.'}</p>{summaryError && <p className="store-form-error" role="alert">{summaryError}</p>}{paymentError && <p className="store-form-error" role="alert">{paymentError}{launchedOrderId && <> <Link href={`/account/orders/${launchedOrderId}`}>View this order</Link></>}</p>}<p className="store-checkout-estimate">Prices and stock are checked again when payment begins.</p></aside></div></div>;
}
