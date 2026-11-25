'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { rupees } from '../store/catalog';
import { StorePhoto } from '../store/storefront-ui';
import { StoreCTA } from '../store/store-cta';
import { ordersApi, type CustomerOrder } from './orders-api';
import { RetryPayment, StatusBadge } from './order-detail';

export function OrdersPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { let live = true; ordersApi.list().then(rows => { if (live) setOrders(rows); }).catch(reason => { if (live) setError(reason instanceof Error ? reason.message : 'Orders could not be loaded.'); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, []);
  return <div className="store-order-page"><nav className="store-breadcrumb" aria-label="Breadcrumb"><Link href="/account">My Account</Link><span aria-hidden="true">/</span><span aria-current="page">My Orders</span></nav><div className="store-flow-heading"><p className="store-kicker">Your collection</p><h1>My Orders</h1><p>See your pieces, payment progress, and delivery status together.</p></div>{loading ? <p role="status">Loading your orders…</p> : error ? <p role="alert" className="store-form-error">{error}</p> : orders.length ? <div className="store-orders-list">{orders.map(order => <article className="store-orders-card" key={order.id}><div className="store-orders-card-head"><div><small>Placed {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</small><h2 className="tabular-nums">{order.orderNumber}</h2></div><strong className="tabular-nums">{rupees(order.totalPaise)}</strong></div><div className="store-orders-previews">{order.lines.map(line => <div key={line.id}><div className="store-order-photo shrink-0"><StorePhoto url={line.image?.url} alt={line.image?.altText || line.productName}/></div><span>{line.productName}<small>SKU {line.sku} · Qty {line.quantity}</small></span></div>)}</div><div className="store-orders-card-foot"><div><StatusBadge value={order.status}/><StatusBadge value={order.paymentStatus} payment/></div><div><StoreCTA href={`/account/orders/${order.id}`} variant="secondary">View Details</StoreCTA><RetryPayment order={order} onError={setError}/></div></div></article>)}</div> : <div className="store-address-empty"><h2>No orders yet.</h2><p>Find a piece that feels like home.</p><StoreCTA href="/shop">Shop All</StoreCTA></div>}</div>;
}
