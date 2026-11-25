'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../../components/avatar';
import { useAuth } from '../auth/provider';
import { api, ApiError } from '../../lib/api';

export function CustomerProfile() {
  const auth = useAuth();
  const [name, setName] = useState(auth.user?.name ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  const [maxBytes, setMaxBytes] = useState(5242880);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);
  useEffect(() => {
    if (!auth.user?.id) return;
    let live = true;
    api<{ maxBytes: number }>('account/photo/config').then(value => { if (live) setMaxBytes(value.maxBytes); }).catch(() => undefined);
    return () => { live = false; };
  }, [auth.user?.id]);
  const choose = (next: File | null) => {
    if (next && !['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) { setError('Choose a JPEG, PNG, or WebP image.'); return; }
    if (next && next.size > maxBytes) { setError(`Choose an image no larger than ${(maxBytes / 1024 / 1024).toFixed(1)} MB.`); return; }
    setError('');
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = next ? URL.createObjectURL(next) : null;
    previewRef.current = url; setFile(next); setPreview(url);
  };
  const saveName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await api('account/profile', { method: 'PATCH', body: { name: name.trim() } }); await auth.refreshUser(); setNotice('Name saved.'); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to save your name.'); }
    finally { setBusy(false); }
  };
  const upload = async () => {
    if (!file || busy) return;
    setBusy(true); setError(''); setNotice('');
    try { const form = new FormData(); form.append('image', file); await api('account/photo', { method: 'POST', body: form, timeoutMs: 30000 }); await auth.refreshUser(); choose(null); setNotice('Profile photo saved.'); }
    catch (cause) { setError(cause instanceof ApiError && cause.code === 'IMAGE_STORAGE_UNAVAILABLE' ? 'Profile photos need Cloudinary configuration on the backend. Ask an administrator to check it.' : cause instanceof ApiError ? cause.message : 'Unable to save photo.'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (busy || !window.confirm('Remove your profile photo?')) return;
    setBusy(true); setError(''); setNotice('');
    try { await api('account/photo', { method: 'DELETE' }); await auth.refreshUser(); choose(null); setNotice('Profile photo removed.'); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to remove photo.'); }
    finally { setBusy(false); }
  };
  if (!auth.user) return <div className="store-account-page"><p role="status">Loading your profile…</p></div>;
  return <div className="store-account-page store-profile-page">
    <nav className="store-breadcrumb" aria-label="Breadcrumb"><Link href="/account">My Account</Link><span aria-hidden="true">/</span><span aria-current="page">Profile Details</span></nav>
    <header className="store-flow-heading"><p className="store-kicker">Your details</p><h1>Profile Details</h1><p>Keep your name and photo feeling like you.</p></header>
    <div className="store-profile-card"><div className="store-profile-identity"><Avatar name={auth.user.name} url={preview ?? auth.user.avatarUrl} size="lg"/><div><strong>{auth.user.name}</strong><span>{auth.user.email}</span></div></div>
      {error && <p role="alert" className="store-form-error">{error}</p>}{notice && <p role="status" className="store-form-success">{notice}</p>}
      <form onSubmit={saveName} className="store-profile-form"><h2>Your name</h2><label htmlFor="profile-name">Full name</label><input id="profile-name" value={name} onChange={event => setName(event.target.value)} minLength={1} maxLength={100} required autoComplete="name"/><button type="submit" className="store-flow-cta" disabled={busy || !name.trim() || name.trim() === auth.user.name}>{busy ? 'Saving…' : 'Save name'}</button></form>
      <section className="store-profile-photo"><h2>Profile photo</h2><p>JPEG, PNG, or WebP · up to {(maxBytes / 1024 / 1024).toFixed(1)} MB · 32–8192 pixels per side, up to 16 megapixels. Your photo appears beside your reviews.</p><label htmlFor="profile-photo">Choose a photo</label><input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => choose(event.target.files?.[0] ?? null)}/><div className="store-profile-actions"><button type="button" className="store-flow-cta" disabled={busy || !file} onClick={() => void upload()}>{busy ? 'Saving…' : 'Save photo'}</button>{file && <button type="button" className="store-flow-cta store-flow-cta-secondary" disabled={busy} onClick={() => choose(null)}>Clear selection</button>}{auth.user.avatarUrl && <button type="button" className="store-flow-cta store-flow-cta-secondary" disabled={busy} onClick={() => void remove()}>Remove current photo</button>}</div></section>
      <div className="store-profile-back-row"><Link href="/account" className="store-account-back">← Back to My Account</Link></div>
    </div>
  </div>;
}
