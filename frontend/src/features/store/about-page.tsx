'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Mail, MapPin, Phone } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { PublicStoreConfig } from './use-store-config';

const pillars = [
  { number: '01', title: 'Thoughtful craft', body: 'Useful pieces with character, chosen for the details you notice every day.' },
  { number: '02', title: 'Tactile materials', body: 'Textures, finishes and forms that make a room feel lived in and loved.' },
  { number: '03', title: 'Everyday rituals', body: 'From morning tea to a slower evening, little objects can make familiar moments feel special.' },
  { number: '04', title: 'Made for India', body: 'A considered edit for the rooms, routines and celebrations we share across India.' },
];

export function AboutPage() {
  const [store,setStore] = useState<PublicStoreConfig>();
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState(false);
  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    void api<PublicStoreConfig>('store/config').then(setStore).catch(() => setError(true)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { let live = true; void api<PublicStoreConfig>('store/config').then(value => { if (live) setStore(value); }).catch(() => { if (live) setError(true); }).finally(() => { if (live) setLoading(false); }); const refresh = () => load(); window.addEventListener('store:config-updated',refresh); return () => { live = false; window.removeEventListener('store:config-updated',refresh); }; }, [load]);
  const address = store?.publicAddress?.trim();
  const email = store?.supportEmail?.trim();
  const phone = store?.supportPhone?.trim();
  const hasContact = Boolean(address || email || phone);

  return <div className="store-about">
    <section className="store-about-hero" aria-labelledby="about-title">
      <div className="store-about-intro"><p className="store-kicker">The story so far</p><h1 id="about-title">A home that feels a little more <em>you.</em></h1><p>We bring together considered home décor, kitchenware and everyday objects for the spaces you call your own. Rooted in India, our edit is about colour, texture and the small rituals that make a place feel like home.</p><Link className="store-home-cta" href="/shop">Explore the collection <ArrowRight size={18}/></Link></div>
      <div className="store-about-hero-image"><Image src="/images/home-hero-placeholder.png" alt="Sunlit living room with a sculptural lamp, cushions and a ceramic vase" fill priority sizes="(max-width: 760px) 100vw, 52vw"/></div>
    </section>
    <section className="store-about-section" aria-labelledby="about-philosophy"><div className="store-about-heading"><p className="store-kicker">What guides us</p><h2 id="about-philosophy">Good things, thoughtfully chosen.</h2></div><div className="store-about-pillars">{pillars.map(pillar=><article key={pillar.number}><span aria-hidden="true">{pillar.number}</span><h3>{pillar.title}</h3><p>{pillar.body}</p></article>)}</div></section>
    <section className="store-about-contact" aria-labelledby="about-contact"><div><p className="store-kicker">Come say hello</p><h2 id="about-contact">Visit &amp; contact us.</h2><p>Have a question about a piece or your order? We would love to hear from you.</p></div><div className="store-about-contact-details" aria-live="polite">{loading?<p role="status">Loading store details…</p>:error?<p role="alert">Contact details are temporarily unavailable. <button className="store-about-retry" onClick={load}>Try again</button></p>:hasContact?<>
      {address&&<div className="store-about-contact-item"><MapPin aria-hidden="true" size={21}/><div><h3>Our address</h3><address>{address}</address></div></div>}
      {email&&<div className="store-about-contact-item"><Mail aria-hidden="true" size={21}/><div><h3>Email us</h3><a href={`mailto:${email}`}>{email}</a></div></div>}
      {phone&&<div className="store-about-contact-item"><Phone aria-hidden="true" size={21}/><div><h3>Call us</h3><a href={`tel:${phone.replace(/[^+\d]/g,'')}`}>{phone}</a></div></div>}
    </>:<p>Our contact details are being updated. Please check back soon.</p>}</div></section>
    <section className="store-about-ending" aria-labelledby="about-next"><p className="store-kicker">Find something for your space</p><h2 id="about-next">Make room for something lovely.</h2><Link className="store-home-cta" href="/shop">Shop all pieces <ArrowRight size={18}/></Link></section>
  </div>;
}
