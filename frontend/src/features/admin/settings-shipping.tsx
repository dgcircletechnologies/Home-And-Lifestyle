'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { settingsService, type Page, type PinEntry } from './settings';

const card = 'min-w-0 rounded-[var(--hl-radius)] border border-[var(--hl-border)] bg-white p-5 sm:p-6';
const input = 'mt-1 w-full rounded-xl border border-[var(--hl-border)] bg-white px-3 py-2.5 text-sm focus:border-[var(--hl-primary)]';
const primary = 'min-h-11 rounded-xl bg-[var(--hl-primary)] px-5 text-sm font-bold text-white disabled:opacity-50';
const failure = (error: unknown) => error instanceof ApiError ? error.message : 'The request failed. Please try again.';
const pinPattern = /^[1-9][0-9]{5}$/;

export function ShippingSection({ onDirty }: { onDirty: (value: boolean) => void }) {
  const [version, setVersion] = useState<number>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const load = useCallback(async () => {
    const shipping = await settingsService.shipping();
    setVersion(shipping.version);
    setError('');
  }, []);

  useEffect(() => {
    let live = true;
    settingsService.shipping()
      .then(shipping => { if (live) setVersion(shipping.version); })
      .catch(cause => { if (live) setError(failure(cause)); });
    return () => { live = false; };
  }, []);

  if (version === undefined) {
    return <section className={card} role={error ? 'alert' : 'status'}>
      {error || 'Loading delivery settings…'}
      {error && <button type="button" className="ml-2 underline" onClick={() => void load().catch(cause => setError(failure(cause)))}>Retry</button>}
    </section>;
  }

  return <div className="grid min-w-0 gap-5">
    <section className={card}>
      <h2 className="text-2xl">Shipping &amp; Delivery</h2>
      <p className="mt-2 text-sm text-[var(--hl-muted)]">Shipping is included in product cost. Checkout adds ₹0 in separate shipping fees.</p>
    </section>
    <RestrictedPinManager
      version={version}
      revision={revision}
      onDirty={onDirty}
      changed={nextVersion => { setVersion(nextVersion); setRevision(current => current + 1); }}
    />
  </div>;
}

function RestrictedPinManager({ version, revision, changed, onDirty }: {
  version: number;
  revision: number;
  changed: (version: number) => void;
  onDirty: (value: boolean) => void;
}) {
  const [data, setData] = useState<Page<PinEntry>>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pinCode, setPinCode] = useState('');
  const [pinTouched, setPinTouched] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const pinError = pinTouched && !pinPattern.test(pinCode) ? 'Enter a valid 6-digit Indian PIN code.' : '';

  useEffect(() => onDirty(Boolean(pinCode || reason)), [pinCode, reason, onDirty]);
  useEffect(() => {
    let live = true;
    const query = new URLSearchParams({ page: String(page) });
    if (search) query.set('search', search);
    settingsService.pins(query)
      .then(value => { if (live) { setData(value); setError(''); } })
      .catch(cause => { if (live) setError(failure(cause)); });
    return () => { live = false; };
  }, [search, page, retry, revision]);

  const restrict = async () => {
    setPinTouched(true);
    if (!pinPattern.test(pinCode)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await settingsService.blockPin({ version, pinCode, reason: reason.trim() || null });
      changed(result.version);
      setPinCode(''); setPinTouched(false); setReason('');
      setNotice('PIN ' + result.pinCode + ' restricted.');
      setRetry(current => current + 1);
    } catch (cause) { setError(failure(cause)); }
    finally { setBusy(false); }
  };

  const unrestrict = async (pin: PinEntry) => {
    if (!confirm('Unrestrict PIN ' + pin.pinCode + '? Delivery will be available again.')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await settingsService.unblockPin(pin.pinCode, version);
      changed(version + 1);
      setNotice('PIN ' + pin.pinCode + ' unrestricted.');
      setRetry(current => current + 1);
    } catch (cause) { setError(failure(cause)); }
    finally { setBusy(false); }
  };

  return <section className={card}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-xl">Restricted PIN Codes</h3>
        <p className="mt-1 text-sm text-[var(--hl-muted)]">All valid 6-digit Indian PIN codes are deliverable by default. Add only PIN codes where delivery is restricted or unavailable.</p>
      </div>
      <span className="admin-status" data-tone="accent">{data?.total ?? '—'} restricted</span>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(16rem,1fr)_minmax(17rem,1fr)]">
      <div>
        <label className="text-sm font-bold">Search restricted PINs
          <input type="search" inputMode="numeric" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className={input} placeholder="Start typing a PIN" />
        </label>
        <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-[var(--hl-border)]">
          {data?.items.map(pin => <div key={pin.pinCode} className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--hl-border)] p-3 text-sm last:border-0">
            <span className="min-w-0"><strong className="font-mono">{pin.pinCode}</strong>{pin.reason && <span className="mt-1 block break-words text-xs text-[var(--hl-muted)]">{pin.reason}</span>}</span>
            <button type="button" disabled={busy} onClick={() => void unrestrict(pin)} className="min-h-10 text-xs font-bold text-[var(--hl-error)]">Remove / Unrestrict</button>
          </div>)}
          {data && !data.items.length && <p className="p-6 text-center text-sm text-[var(--hl-muted)]">No restricted PIN codes match. Valid unlisted PINs are deliverable.</p>}
          {!data && !error && <p className="p-6 text-sm text-[var(--hl-muted)]">Loading restricted PIN codes…</p>}
        </div>
        {data && <div className="mt-3 flex items-center justify-between text-xs">
          <span>Page {data.page} · {data.total} restricted</span>
          <span className="flex gap-3">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <button type="button" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Next</button>
          </span>
        </div>}
      </div>
      <div className="rounded-xl border border-[var(--hl-border)] bg-[var(--hl-page)] p-4">
        <h4 className="font-bold">Add Restricted PIN Code</h4>
        <label className="mt-3 block text-sm font-bold">Indian PIN code (required)
          <input inputMode="numeric" autoComplete="postal-code" maxLength={6} value={pinCode}
            onChange={event => { setPinCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setPinTouched(true); }}
            onBlur={() => setPinTouched(true)} aria-invalid={Boolean(pinError)} aria-describedby={pinError ? 'restricted-pin-error' : undefined}
            className={input} placeholder="560001" />
        </label>
        {pinError && <p id="restricted-pin-error" className="mt-1 text-xs text-[var(--hl-error)]">{pinError}</p>}
        <label className="mt-3 block text-sm font-bold">Reason (optional)
          <input maxLength={250} value={reason} onChange={event => setReason(event.target.value)} className={input} placeholder="Remote area / courier unavailable" />
        </label>
        <button type="button" disabled={busy || !pinPattern.test(pinCode)} onClick={() => void restrict()} className={primary + ' mt-4'}>{busy ? 'Saving…' : 'Add Restricted PIN Code'}</button>
      </div>
    </div>
    {error && <p role="alert" className="mt-4 text-sm text-[var(--hl-error)]">{error} <button type="button" onClick={() => setRetry(current => current + 1)} className="underline">Retry list</button></p>}
    {notice && <p role="status" className="mt-4 text-sm text-[var(--hl-success)]">{notice}</p>}
  </section>;
}
