'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { catalog, categoryHref, type StoreCategory } from '../features/store/catalog';
import { useStoreConfig } from '../features/store/use-store-config';

export function StoreFooter() {
  const store = useStoreConfig();
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  useEffect(() => {
    let live = true;
    catalog.navigation().then(value => { if (live) setCategories(value.categories.filter(item => !item.parentId).slice(0, 3)); }).catch(() => {});
    return () => { live = false; };
  }, []);
  return <footer className="store-footer">
    <div className="store-footer-intro"><Link href="/" className="store-footer-brand">{store?.storeName ?? 'Home & Lifestyle'}</Link><p>Objects for the rooms and rituals that feel like yours.</p>{store?.supportEmail && <a href={`mailto:${store.supportEmail}`}>{store.supportEmail}</a>}{store?.supportPhone && <a className="tabular-nums" href={`tel:${store.supportPhone.replace(/[^+\d]/g, '')}`}>{store.supportPhone}</a>}{store?.publicAddress && <address>{store.publicAddress}</address>}</div>
    <nav aria-label="Shop links"><strong>Shop</strong><Link href="/shop">Shop all</Link><Link href="/shop?collection=new-arrivals">New arrivals</Link>{categories.map(category => <Link key={category.id} href={categoryHref(category)}>{category.name}</Link>)}</nav>
    <nav aria-label="Support links"><strong>Support</strong><Link href="/contact">Contact &amp; Support</Link><Link href="/faq">FAQ</Link><Link href="/account/orders">My Orders</Link><Link href="/about">About Us</Link></nav>
    <nav aria-label="Policy links"><strong>Policies</strong><Link href="/shipping-policy">Shipping &amp; Delivery Policy</Link><Link href="/cancellation-and-returns">Cancellation &amp; Returns</Link><Link href="/privacy-policy">Privacy Policy</Link><Link href="/terms-and-conditions">Terms &amp; Conditions</Link></nav>
    <p className="store-footer-bottom">© {new Date().getFullYear()} {store?.storeName ?? 'Home & Lifestyle'} · India · Prices in INR</p>
  </footer>;
}
