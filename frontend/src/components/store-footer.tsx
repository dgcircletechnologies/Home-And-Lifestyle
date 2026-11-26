'use client';

import Link from 'next/link';
import { useStoreConfig } from '../features/store/use-store-config';

export function StoreFooter() {
  const store = useStoreConfig();

  return (
    <footer className="store-footer h-auto">
      <div className="store-footer-intro">
        <Link href="/" className="store-footer-brand">
          {store?.storeName ?? 'Home & Lifestyle'}
        </Link>
        <p className="store-footer-tagline">Objects for the rooms and rituals that feel like yours.</p>
        <div className="store-footer-contact">
          {store?.supportEmail && <a href={`mailto:${store.supportEmail}`}>{store.supportEmail}</a>}
          {store?.supportPhone && (
            <a className="tabular-nums" href={`tel:${store.supportPhone.replace(/[^+\d]/g, '')}`}>
              {store.supportPhone}
            </a>
          )}
          {store?.publicAddress && <address>{store.publicAddress}</address>}
        </div>
      </div>
      <nav aria-label="Support links" className="flex flex-col items-start text-left">
        <strong>Support</strong>
        <Link href="/contact">Contact &amp; Support</Link>
        <Link href="/faq">FAQ</Link>
        <Link href="/account/orders">My Orders</Link>
        <Link href="/about">About Us</Link>
      </nav>
      <nav aria-label="Policy links" className="flex flex-col items-start text-left">
        <strong>Policies</strong>
        <Link href="/shipping-policy">Shipping &amp; Delivery</Link>
        <Link href="/cancellation-and-returns">Cancellation &amp; Returns</Link>
        <Link href="/privacy-policy">Privacy Policy</Link>
        <Link href="/terms-and-conditions">Terms &amp; Conditions</Link>
      </nav>
      <p className="store-footer-bottom">
        © {new Date().getFullYear()} {store?.storeName ?? 'Home & Lifestyle'} · India · Prices in INR
      </p>
    </footer>
  );
}
