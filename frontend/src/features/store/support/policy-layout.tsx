import type { ReactNode } from 'react';
import Link from 'next/link';
import { StoreContactDetails } from './store-contact-details';

export function PolicyPageLayout({ eyebrow = 'Information & support', title, subtitle, children, updated = true }: { eyebrow?: string; title: string; subtitle: string; children: ReactNode; updated?: boolean }) {
  return <div className="store-policy-page"><header className="store-policy-header"><Link href="/" className="store-policy-back">← Home</Link><p className="store-kicker">{eyebrow}</p><h1>{title}</h1><p className="store-policy-subtitle">{subtitle}</p>{updated && <p className="store-policy-updated tabular-nums">Draft updated 24 November 2026 · Operational timelines are under review</p>}</header><div className="store-policy-body">{children}</div></div>;
}

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="store-policy-section"><h2>{title}</h2>{children}</section>;
}

export function PolicyQuestions() {
  return <aside className="store-policy-questions"><div><p className="store-kicker">Still have a question?</p><h2>We’re here to help.</h2><p>Include your order number when writing about an order.</p></div><StoreContactDetails compact /><Link href="/contact" className="store-home-cta">Contact &amp; support →</Link></aside>;
}
