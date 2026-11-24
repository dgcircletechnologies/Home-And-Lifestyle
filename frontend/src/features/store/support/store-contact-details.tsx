'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import type { PublicStoreConfig } from '../use-store-config';

export function StoreContactDetails({ compact = false, showHours = false }: { compact?: boolean; showHours?: boolean }) {
  const [store, setStore] = useState<PublicStoreConfig>();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    const refresh = () => { void api<PublicStoreConfig>('store/config').then(value => { if (live) setStore(value); }).catch(() => { if (live) setStore(undefined); }).finally(() => { if (live) setLoading(false); }); };
    refresh();
    window.addEventListener('store:config-updated', refresh);
    return () => { live = false; window.removeEventListener('store:config-updated', refresh); };
  }, []);
  const email = store?.supportEmail?.trim();
  const phone = store?.supportPhone?.trim();
  const address = store?.publicAddress?.trim();
  const hours = store?.businessHours?.trim();
  return <div className={`store-contact-details${compact ? ' is-compact' : ''}`} aria-live="polite">
    {email && <div><h3>Email</h3><a href={`mailto:${email}`}>{email}</a></div>}
    {phone && <div><h3>Phone</h3><a className="tabular-nums" href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</a></div>}
    {address && <div><h3>Studio / store address</h3><address>{address}</address></div>}
    {showHours && hours && <div><h3>Business hours</h3><p className="tabular-nums">{hours}</p></div>}
    {loading && <p role="status">Loading store contact details…</p>}
    {!loading && !email && !phone && !address && (!showHours || !hours) && <p>Contact details are temporarily unavailable. Please check back soon.</p>}
  </div>;
}
