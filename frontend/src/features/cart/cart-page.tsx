'use client';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { rupees } from '../store/catalog';
import { StorePhoto } from '../store/storefront-ui';
import { useCart, type CartLine } from './cart-provider';
import { StoreCTA } from '../store/store-cta';

export function CartPage() {
  const cart = useCart();
  const [code, setCode] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const summary = cart.summary;
  const change = async (line: CartLine, quantity: number | null) => {
    setBusy(line.variantId); setNotice('');
    try { if (quantity === null) await cart.remove(line); else await cart.update(line, quantity); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : 'Cart could not be updated.'); }
    finally { setBusy(''); }
  };
  const apply = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy('coupon'); setCouponMessage('');
    try { const result = await cart.applyCoupon(code); setCouponMessage(result.coupon?.message ?? 'Coupon could not be applied.'); }
    catch (reason) { setCouponMessage(reason instanceof Error ? reason.message : 'Coupon could not be checked.'); }
    finally { setBusy(''); }
  };
  return <div className="store-cart-page">
    <nav className="store-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Cart</span></nav>
    <div className="store-cart-heading"><p className="store-kicker">Your edit</p><h1>Your cart<span>{summary?.itemCount ? ` (${summary.itemCount})` : ''}</span></h1><p>Thoughtful pieces for the spaces you call yours.</p></div>
    {cart.mergeNotes.length > 0 && <div className="store-cart-merge-notes" role="status">{cart.mergeNotes.map((message, index) => <p key={index}>{message}</p>)}</div>}
    {cart.loading && !summary ? <p role="status">Opening your cart…</p> : !summary?.items.length ? <div className="store-cart-empty"><ShoppingBag size={42} strokeWidth={1.2}/><h2>Your cart is waiting for a little inspiration.</h2><p>Discover something lovely for your home.</p><Link className="store-cart-cta" href="/shop">Explore Shop All</Link></div> : <div className="store-cart-layout">
      <section className="store-cart-items" aria-label="Cart items"><div className="store-cart-items-head"><h2>Your pieces</h2><span>{summary.itemCount} {summary.itemCount === 1 ? 'item' : 'items'}</span></div>{summary.items.map(line => <article key={line.itemId ?? line.variantId} className="store-cart-item"><Link className="store-cart-photo" href={line.product ? `/products/${line.product.slug}` : '/shop'}><StorePhoto url={line.product?.image?.url} alt={line.product?.image?.altText || line.product?.name || 'Unavailable piece'}/></Link><div className="store-cart-item-body"><div className="store-cart-item-top"><div><Link href={line.product ? `/products/${line.product.slug}` : '/shop'} className="store-cart-name">{line.product?.name ?? 'Unavailable piece'}</Link><p className="store-cart-sku">SKU {line.variant?.sku ?? 'unavailable'}</p></div><button className="store-cart-remove" type="button" disabled={busy === line.variantId} onClick={() => void change(line, null)}><Trash2 size={15}/> Remove</button></div>{Array.isArray(line.variant?.attributes) && line.variant.attributes.length > 0 && <p className="store-cart-attributes">{line.variant.attributes.filter(row => row.title && row.value).map(row => `${row.title}: ${row.value}`).join(' · ')}</p>}<div className="store-cart-item-bottom"><div className="store-cart-unit"><strong>{rupees(line.effectiveUnitPricePaise)}</strong>{line.effectiveUnitPricePaise < line.unitPricePaise && <del>{rupees(line.unitPricePaise)}</del>}<small>each</small></div><div className="store-cart-stepper" role="group" aria-label={`Quantity for ${line.product?.name ?? 'item'}`}><button type="button" aria-label="Decrease quantity" disabled={busy === line.variantId || line.quantity <= 1} onClick={() => void change(line, line.quantity - 1)}><Minus size={15}/></button><output aria-label="Quantity">{line.quantity}</output><button type="button" aria-label="Increase quantity" disabled={busy === line.variantId || !line.variant || line.quantity >= line.variant.stockQuantity} onClick={() => void change(line, line.quantity + 1)}><Plus size={15}/></button></div><strong className="store-cart-line-total">{rupees(line.effectiveUnitPricePaise * line.quantity)}</strong></div>{line.warning && <p className="store-cart-warning" role="alert">{line.warning}</p>}</div></article>)}<Link className="store-cart-continue" href="/shop">← Continue shopping</Link></section>
      <aside className="store-cart-summary" aria-label="Order summary"><p className="store-kicker">The details</p><h2>Order summary</h2><div className="store-cart-totals"><div><span>Subtotal · {summary.itemCount} {summary.itemCount === 1 ? 'item' : 'items'}</span><strong>{rupees(summary.subtotalPaise)}</strong></div>{summary.automaticDiscountPaise > 0 && <div className="store-cart-saving"><span>Product savings</span><strong>−{rupees(summary.automaticDiscountPaise)}</strong></div>}{summary.couponDiscountPaise > 0 && <div className="store-cart-saving"><span>Coupon savings</span><strong>−{rupees(summary.couponDiscountPaise)}</strong></div>}<div className="store-cart-total"><span>Estimated total</span><strong>{rupees(summary.estimatedTotalPaise)}</strong></div></div><div className="store-cart-coupon"><label htmlFor="cart-coupon">Have a coupon?</label>{summary.coupon?.valid ? <div className="store-cart-coupon-applied"><span><strong>{summary.coupon.code}</strong> · {rupees(summary.coupon.savingsPaise)} saved</span><button type="button" onClick={() => { setCouponMessage(''); setCode(''); void cart.clearCoupon(); }}>Remove</button></div> : <form onSubmit={apply}><input id="cart-coupon" value={code} onChange={event => setCode(event.target.value)} placeholder="Enter code" maxLength={40} autoComplete="off"/><button type="submit" disabled={busy === 'coupon' || !code.trim()}>{busy === 'coupon' ? 'Checking…' : 'Apply'}</button></form>}{couponMessage && <p className={summary.coupon?.valid ? 'store-cart-success' : 'store-cart-warning'} role="status">{couponMessage}</p>}</div><StoreCTA href="/checkout" disabled={!summary.canCheckout} className="store-cart-checkout">Proceed to Checkout</StoreCTA><p className="store-cart-note">{summary.note}</p></aside>
    </div>}
    {(notice || cart.error) && <p className="store-cart-page-notice" role="status">{notice || cart.error}</p>}
  </div>;
}
