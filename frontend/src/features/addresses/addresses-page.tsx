'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AddressForm } from './address-form';
import { addressesApi, addressLines, type Address } from './addresses-api';
import { StoreCTA } from '../store/store-cta';

export function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const [busyId, setBusyId] = useState('');
  const load = useCallback(async () => { const rows = await addressesApi.list(); setAddresses(rows); setError(''); setLoading(false); }, []);
  useEffect(() => { let live = true; addressesApi.list().then(rows => { if (live) setAddresses(rows); }).catch(reason => { if (live) setError(reason instanceof Error ? reason.message : 'Addresses could not be loaded.'); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, []);
  const save = async (input: Parameters<typeof addressesApi.create>[0]) => {
    const saved = editing && editing !== 'new' ? await addressesApi.update(editing.id, input) : await addressesApi.create(input);
    setAddresses(current => [...current.filter(row => row.id !== saved.id).map(row => saved.isDefault ? { ...row, isDefault: false } : row), saved].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.id.localeCompare(b.id)));
    setEditing(null); setNotice('Address saved.');
    void load().catch(() => setError('Address saved, but the latest list could not be loaded. Retry to refresh.'));
  };
  const setDefault = async (address: Address) => { setBusyId(address.id); setError(''); try { await addressesApi.update(address.id, { isDefault: true }); await load(); setNotice('Default address updated.'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update the default address.'); } finally { setBusyId(''); } };
  const remove = async (address: Address) => { if (!window.confirm(`Delete the address for ${address.fullName}?`)) return; setBusyId(address.id); setError(''); try { await addressesApi.remove(address.id); await load(); setNotice('Address removed.'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not remove this address.'); } finally { setBusyId(''); } };
  return <div className="store-address-page"><nav className="store-breadcrumb" aria-label="Breadcrumb"><Link href="/account">My profile</Link><span aria-hidden="true">/</span><span aria-current="page">Manage addresses</span></nav><div className="store-flow-heading"><p className="store-kicker">Your details</p><h1>Manage addresses</h1><p>Keep your favourite destinations close at hand.</p></div>{notice && <p role="status" className="store-form-success">{notice}</p>}{error && <p role="alert" className="store-form-error">{error} <button type="button" onClick={() => void load()}>Retry</button></p>}
    {loading ? <p role="status">Loading your addresses…</p> : <><div className="store-address-list">{addresses.map(address => <article key={address.id} className="store-address-card"><div className="store-address-card-top"><span>{address.label ?? 'Address'}</span>{address.isDefault && <strong>Default</strong>}</div><h2>{address.fullName}</h2>{addressLines(address).map(line => <p key={line}>{line}</p>)}<p>+91 {address.phone}</p><div className="store-address-card-actions"><button type="button" onClick={() => { setEditing(address); setNotice(''); }}>Edit</button><button type="button" disabled={busyId === address.id} onClick={() => void remove(address)}>Delete</button>{!address.isDefault && <button type="button" disabled={busyId === address.id} onClick={() => void setDefault(address)}>Set as default</button>}</div></article>)}</div>{!addresses.length && <div className="store-address-empty"><h2>No saved addresses yet.</h2><p>Add an address to make checkout easier when you’re ready.</p></div>}{editing ? <AddressForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? undefined : editing} title={editing === 'new' ? 'Add a new address' : 'Edit address'} onSave={save} onCancel={() => setEditing(null)}/> : <StoreCTA onClick={() => { setEditing('new'); setNotice(''); }} className="store-add-address">+ Add New Address</StoreCTA>}</>}
  </div>;
}
