'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar } from '../../components/avatar';
import { useAuth } from '../../features/auth/provider';

const sections = [
  { href: '/account/profile', title: 'Profile Details', description: 'Update your name and profile photo.' },
  { href: '/account/orders', title: 'My Orders', description: 'See your purchases and delivery progress.' },
  { href: '/account/addresses', title: 'Manage Addresses', description: 'Keep your delivery details ready.' },
];

export default function Account() {
  const auth = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await auth.logout(); router.replace('/'); }
    catch { setError('Sign out could not reach the server. Please try again.'); }
    finally { setBusy(false); }
  };
  if (!auth.user) return <div className="store-account-page"><p role="status">Loading your account…</p></div>;
  return <div className="store-account-page">
    <nav className="store-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">My Account</span></nav>
    <header className="store-flow-heading"><p className="store-kicker">Your space</p><h1>My Account</h1><p>A place for your details, orders and delivery addresses.</p></header>
    <section className="store-account-welcome" aria-label="Signed-in customer">
      <div className="store-account-person"><Avatar name={auth.user.name} url={auth.user.avatarUrl} size="lg"/><div><p className="store-kicker">Welcome home</p><h2>{auth.user.name}</h2><p className="store-account-email">{auth.user.email}</p></div></div>
      <button type="button" className="store-flow-cta store-flow-cta-secondary" disabled={busy} onClick={() => void signOut()}>{busy ? 'Signing out…' : 'Sign Out'}</button>
    </section>
    {error && <p className="store-form-error" role="alert">{error}</p>}
    <nav className="store-account-sections" aria-label="Account sections">{sections.map(section => <Link className="store-account-section" href={section.href} key={section.href}><span><strong>{section.title}</strong><small>{section.description}</small></span><span aria-hidden="true">↗</span></Link>)}</nav>
  </div>;
}
